/**
 * @doc Temporary diagnostic: reports whether the configured Freestyle key is
 * accepted by the v5 API. Returns statuses only — never the key itself.
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const key = (Deno.env.get("FREESTYLE_API_KEY") ?? "").trim();
  const out: Record<string, unknown> = { configured: Boolean(key), length: key.length };
  for (const base of ["https://api.freestyle.sh", "https://beta-api.freestyle.sh"]) {
    try {
      const resp = await fetch(`${base}/v5/vms`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      out[base] = { status: resp.status, body: (await resp.text()).slice(0, 200) };
    } catch (error) {
      out[base] = { error: error instanceof Error ? error.message : String(error) };
    }
  }
  return new Response(JSON.stringify(out), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
