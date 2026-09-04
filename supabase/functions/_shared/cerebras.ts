/**
 * Cerebras Inference — primary text-model provider (OpenAI-compatible).
 *
 * Endpoint: https://api.cerebras.ai/v1/chat/completions
 * Key: function secret `CEREBRAS_API_KEY`.
 *
 * The account currently serves three models, so every agent role is mapped onto
 * one of them (verified live against /v1/models):
 *   - qwen-3.8-27b   → the default workhorse (tools, workers, chat)
 *   - gpt-oss-120b   → manager / planner / final answers (strongest)
 *   - gemma-4-31b    → cheapest lane (titles, memory extraction, classifiers)
 * Requested ids that this provider does not serve (Kimi, GLM, abliterated-*)
 * are mapped onto the closest role model instead of 404-ing.
 */

const BASE = Deno.env.get("CEREBRAS_API_BASE") || "https://api.cerebras.ai/v1";

export const CEREBRAS_MODELS = {
  fast: "gemma-4-31b",
  worker: "qwen-3.8-27b",
  manager: "gpt-oss-120b",
} as const;

/** Every id the provider serves, in fallback order. */
export const CEREBRAS_LADDER: string[] = [
  CEREBRAS_MODELS.worker,
  CEREBRAS_MODELS.manager,
  CEREBRAS_MODELS.fast,
];

const ENV_NAMES = ["CEREBRAS_API_KEY", "CEREBRAS_KEY", "cerebras"];

export function cerebrasKey(): string {
  for (const name of ENV_NAMES) {
    const value = Deno.env.get(name)?.trim();
    if (value && value.length > 12) return value;
  }
  return "";
}

export function hasCerebras(): boolean {
  return cerebrasKey().length > 0;
}

/** Role → model. `role` wins; otherwise the requested id decides the lane. */
export function cerebrasModelFor(requested?: string | null, role?: string | null): string {
  const r = (role ?? "").trim().toLowerCase();
  if (r) {
    if (/(manager|planner|orchestrat|final|review|deep|research|code|coder)/.test(r)) {
      return CEREBRAS_MODELS.manager;
    }
    if (/(fast|title|memory|classif|extract|cheap|light)/.test(r)) return CEREBRAS_MODELS.fast;
    return CEREBRAS_MODELS.worker;
  }
  const id = (requested ?? "").trim().toLowerCase();
  if (!id) return CEREBRAS_MODELS.worker;
  if (CEREBRAS_LADDER.includes(id)) return id;
  if (/(gemma)/.test(id)) return CEREBRAS_MODELS.fast;
  if (/(oss|120b|large|max|ultra|pro|opus|thinking|reason|glm|kimi)/.test(id)) {
    return CEREBRAS_MODELS.manager;
  }
  if (/(flash|turbo|mini|fast|small|lite)/.test(id)) return CEREBRAS_MODELS.fast;
  return CEREBRAS_MODELS.worker;
}

/** Fields Cerebras rejects or ignores are dropped so callers keep one payload. */
export function cerebrasPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const {
    enable_thinking: _et,
    thinking_budget: _tb,
    enable_search: _es,
    search_options: _so,
    incremental_output: _io,
    result_format: _rf,
    include_reasoning: _ir,
    web_search_options: _ws,
    reasoning_effort,
    agentRole: _role,
    ...rest
  } = payload as Record<string, any>;

  const out: Record<string, unknown> = { ...rest };
  // gpt-oss-120b is the only reasoning-capable id here; the rest reject the field.
  if (reasoning_effort && out.model === CEREBRAS_MODELS.manager) {
    out.reasoning_effort = reasoning_effort === "none" ? "low" : reasoning_effort;
  }
  return out;
}

export interface CerebrasResult {
  response: Response;
  model: string;
}

/**
 * One chat-completions call against Cerebras. Returns null when the provider is
 * unusable (no key, or every model rejected), so callers fall back.
 */
export async function callCerebras(
  models: string[],
  payload: Record<string, unknown>,
  role?: string | null,
): Promise<CerebrasResult | null> {
  const key = cerebrasKey();
  if (!key) return null;

  const preferred = models.length
    ? models.map((m) => cerebrasModelFor(m, role))
    : [cerebrasModelFor(null, role)];
  const ladder = Array.from(new Set([...preferred, ...CEREBRAS_LADDER]));

  for (const model of ladder) {
    const body = cerebrasPayload({ ...payload, model });
    try {
      const response = await fetch(`${BASE}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ ...body, model }),
      });
      if (response.ok) return { response, model };
      const detail = (await response.text().catch(() => "")).slice(0, 400);
      console.error(`cerebras ${model} [${response.status}]: ${detail}`);
      if ([401, 402, 403].includes(response.status)) return null;
    } catch (error) {
      console.error("cerebras request failed", error);
    }
  }
  return null;
}
