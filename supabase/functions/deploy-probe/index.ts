/**
 * @doc Temporary diagnostic for the Freestyle deployment path: verifies the key
 * and, with `?deploy=1`, deploys a tiny static site end to end so the pipeline
 * can be validated without going through the chat agent.
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { deployStaticSite } from "../_shared/freestyle.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);
  const key = (Deno.env.get("FREESTYLE_API_KEY") ?? "").trim();
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (url.searchParams.get("deploy") === "1") {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    try {
      const result = await deployStaticSite(
        admin,
        [{ path: "index.html", content: "<!DOCTYPE html><title>probe</title><h1>probe ok</h1>" }],
        { displayName: "megsy-probe" },
      );
      return json({ ok: true, ...result });
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
    }
  }

  const resp = await fetch("https://api.freestyle.sh/v5/vms", {
    headers: { Authorization: `Bearer ${key}` },
  });
  return json({ configured: Boolean(key), status: resp.status });
});
