/** @doc Deep Research core — ported from src/lib/research/deepResearchCore.ts.
 * The model plans, searches the live web, cross-checks evidence, and writes
 * the cited report in one streamed run. Uses Abliteration instead of the
 * Lovable AI Gateway used in the local dev handler; the client-visible SSE
 * event shapes (`response.output_text.delta`, `response.reasoning_summary_text.delta`,
 * `response.web_search_call.searching`, `response.output_text.annotation.added`,
 * `response.failed`) are the same contract the client already parses.
 */
import { MODELS, modelKeys } from "../_shared/abliteration.ts";

const BASE = (Deno.env.get("ABLITERATION_API_BASE") || "https://api.abliteration.ai/v1").replace(/\/$/, "");

export type ResearchPayload = {
  query?: string;
  context?: string;
  depth?: string;
};

function researchInstructions(query: string, depth: string): string {
  const Arabic = /[\u0600-\u06FF]/.test(query);
  const scale =
    depth === "pro"
      ? { searches: "at least 8", words: "at least 1,800 words", sections: "5-7" }
      : depth === "ultra8x" || depth === "ultra4x"
        ? { searches: "at least 20", words: "at least 4,500 words", sections: "8-12" }
        : depth === "ultra2x"
          ? { searches: "at least 14", words: "at least 3,000 words", sections: "6-9" }
          : { searches: "at least 10", words: "at least 2,400 words", sections: "5-8" };

  const depthGuide =
    depth === "ultra8x" || depth === "ultra4x"
      ? "Search exhaustively from many independent angles and prioritize primary sources."
      : depth === "ultra2x"
        ? "Search broadly, compare conflicting accounts, and prioritize primary sources."
        : "Search deeply enough to support every important factual claim.";

  return [
    "You are Megsy Deep Research, an autonomous research analyst.",
    depthGuide,
    `Run ${scale.searches} distinct live web searches before writing. Plan the investigation internally, follow promising leads, and cross-check dates, names, numbers, and disputed claims across independent sources.`,
    "Prefer primary, official, academic, and established editorial sources. Use secondary sources only when they add necessary context.",
    `Write a long-form, exhaustive report of ${scale.words}. A short or superficial answer is a failed task — never compress the findings into a brief summary.`,
    `Structure the report as: a single specific editorial # title written by you (never use "Deep Research" or "بحث عميق" in it), a short descriptive standfirst, then ${scale.sections} thematic ## sections with ### subsections where useful, and a comparison table whenever items, figures, or timelines are compared. Do not number headings.`,
    "Every section must contain specific facts: exact dates, names, numbers, quotes, and documented events. Never use generic filler, invented facts, placeholder prose, or unsupported conclusions.",
    "Cite factual claims using the citations returned by web search. Finish with a Sources section listing every source actually used as markdown links; the reader UI will move all links and citation markers out of the prose.",
    "When live search returns a direct, authentic, non-logo image URL that clearly depicts the exact subject, place exactly one markdown image immediately below the title. Never invent an image URL and never use a generic or decorative image.",
    "Explicitly identify uncertainty or disagreement between sources. If evidence is insufficient, say exactly what could not be verified instead of pretending the research succeeded.",
    "Write one single clean report. Never expose your plan, search steps, tool traces or internal status lines, never repeat the same summary twice, and never mix languages: headings, body and table cells must all be in the report language.",
    `Write the complete report in ${Arabic ? "Arabic" : "the same language as the user's request"}.`,
  ].join("\n");
}

function errorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  const record = data as Record<string, unknown>;
  const nested = record.error && typeof record.error === "object"
    ? (record.error as Record<string, unknown>).message
    : undefined;
  return String(record.message ?? nested ?? fallback);
}

/**
 * Streams a Deep Research run as Server-Sent Events shaped like the OpenAI
 * Responses API stream that the client already parses:
 *  - `response.output_text.delta` — report text chunks
 *  - `response.reasoning_summary_text.delta` — reasoning trace chunks
 *  - `response.web_search_call.searching` — one event per web search
 *  - `response.output_text.annotation.added` — a `url_citation` annotation
 *  - `response.failed` / `error` — terminal error
 */
export async function streamDeepResearch(payload: ResearchPayload): Promise<Response> {
  const query = String(payload.query ?? "").trim();
  const context = String(payload.context ?? "").trim();
  const depth = String(payload.depth ?? "ultra");
  if (query.length < 3) {
    return Response.json({ error: "Enter a research topic." }, { status: 400 });
  }
  if (query.length > 20_000 || context.length > 20_000) {
    return Response.json({ error: "The research request is too large." }, { status: 400 });
  }

  const keys = await modelKeys(null);
  if (!keys.length) {
    return Response.json({ error: "Deep Research is not configured." }, { status: 500 });
  }

  const input = context
    ? `${query}\n\nConversation context for disambiguation only:\n${context}`
    : query;

  const requestSearches =
    depth === "pro" ? 8 : depth === "ultra8x" || depth === "ultra4x" ? 20 : depth === "ultra2x" ? 14 : 10;

  const body = {
    model: MODELS.standard,
    stream: true,
    messages: [
      { role: "system", content: researchInstructions(query, depth) },
      { role: "user", content: input },
    ],
    reasoning_effort:
      depth === "pro" ? "low" : depth === "ultra8x" || depth === "ultra4x" ? "high" : "medium",
    web_search_options: { search_count: requestSearches },
    max_tokens:
      depth === "pro"
        ? 10_000
        : depth === "ultra8x" || depth === "ultra4x"
          ? 48_000
          : depth === "ultra2x"
            ? 32_000
            : 24_000,
  };

  let upstream: Response | null = null;
  for (const entry of keys) {
    try {
      const resp = await fetch(`${BASE}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${entry.key}` },
        body: JSON.stringify(body),
      });
      if (resp.ok && resp.body) {
        upstream = resp;
        break;
      }
      console.error(`deep-research upstream [${resp.status}]`, await resp.text().catch(() => ""));
    } catch (error) {
      console.error("deep-research upstream request failed", error);
    }
  }

  if (!upstream || !upstream.body) {
    return Response.json(
      { error: "Deep Research failed. Please try again.", retryable: true },
      { status: 502 },
    );
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const sources = new Map<string, { url: string; title: string }>();
  let searchCount = 0;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      const reader = upstream!.body!.getReader();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let newline = buffer.indexOf("\n");
          while (newline !== -1) {
            const line = buffer.slice(0, newline).replace(/\r$/, "");
            buffer = buffer.slice(newline + 1);
            newline = buffer.indexOf("\n");
            if (!line.startsWith("data:")) continue;
            const raw = line.slice(5).trim();
            if (!raw || raw === "[DONE]") continue;
            let chunk: Record<string, any>;
            try {
              chunk = JSON.parse(raw);
            } catch {
              continue;
            }

            const choice = chunk.choices?.[0];
            const delta = choice?.delta ?? {};

            if (typeof delta.reasoning_content === "string" && delta.reasoning_content) {
              send({ type: "response.reasoning_summary_text.delta", delta: delta.reasoning_content });
            }
            if (typeof delta.content === "string" && delta.content) {
              send({ type: "response.output_text.delta", delta: delta.content });
            }
            const annotations = Array.isArray(delta.annotations) ? delta.annotations : [];
            for (const ann of annotations) {
              const url = String(ann?.url_citation?.url ?? ann?.url ?? "");
              if (!url || sources.has(url)) continue;
              sources.set(url, { url, title: String(ann?.url_citation?.title ?? ann?.title ?? url) });
              send({
                type: "response.output_text.annotation.added",
                annotation: { type: "url_citation", url, title: sources.get(url)!.title },
              });
            }
            const toolCalls = Array.isArray(delta.tool_calls) ? delta.tool_calls : [];
            if (toolCalls.length) {
              searchCount += 1;
              send({ type: "response.web_search_call.searching" });
            }
            if (choice?.finish_reason === "content_filter") {
              send({ type: "response.failed", error: { message: "Deep Research was filtered." } });
            }
          }
        }
      } catch (error) {
        send({
          type: "response.failed",
          error: { message: error instanceof Error ? error.message : "stream failed" },
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
