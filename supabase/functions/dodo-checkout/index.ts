/** @doc dodo-checkout — creates a Dodo Payments checkout session (global/USD payments)
 *  and a pending dodo_orders row. Kashier stays the Arabic/EGP path. */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// SKU -> { plan, amount (USD), credits, interval }
const SKU_TABLE: Record<
  string,
  { plan: string; amount: number; credits: number; interval: string }
> = {
  plan_pro_m_first: { plan: "pro", amount: 9, credits: 1000, interval: "month" },
  plan_pro_m: { plan: "pro", amount: 19, credits: 1000, interval: "month" },
  plan_elite_m: { plan: "elite", amount: 39, credits: 3000, interval: "month" },
  plan_elite_m_first: { plan: "elite", amount: 19, credits: 3000, interval: "month" },
};

const API_BASE = (Deno.env.get("DODO_PAYMENTS_ENVIRONMENT") || "live_mode") === "test_mode"
  ? "https://test.dodopayments.com"
  : "https://live.dodopayments.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const apiKey = Deno.env.get("DODO_PAYMENTS_API_KEY");
  if (!apiKey) return json({ error: "Dodo Payments is not configured" }, 503);

  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
  const { data: userData } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (!user) return json({ error: "unauthorized" }, 401);

  let payload: Record<string, unknown> = {};
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const sku = String(payload.sku ?? "");
  const info = SKU_TABLE[sku];
  if (!info) return json({ error: "unknown sku" }, 400);

  // Resolve the Dodo product for this tier/interval.
  const { data: product } = await admin
    .from("dodo_products")
    .select("product_id,interval")
    .eq("tier", info.plan)
    .eq("active", true)
    .maybeSingle();
  const productId = product?.product_id ?? String(payload.product_id ?? "");
  if (!productId) {
    return json({ error: `No Dodo product configured for plan "${info.plan}"` }, 503);
  }
  const isSubscription = (product?.interval ?? info.interval) !== "one_time";

  const orderId = `dodo_${crypto.randomUUID()}`;
  const siteUrl = Deno.env.get("SITE_URL") || "https://megsyai.com";

  const { error: insertErr } = await admin.from("dodo_orders").insert({
    order_id: orderId,
    user_id: user.id,
    amount: info.amount,
    currency: "USD",
    credits: info.credits,
    plan: info.plan,
    status: "pending",
    raw: { sku, product_id: productId },
  });
  if (insertErr) return json({ error: insertErr.message }, 500);

  const body = {
    payment_link: true,
    return_url: `${siteUrl}/billing/success?provider=dodo&order=${orderId}`,
    customer: { email: user.email ?? "", name: user.user_metadata?.full_name ?? user.email ?? "" },
    billing: {
      city: String(payload.city ?? "NA"),
      country: String(payload.country ?? "US"),
      state: String(payload.state ?? "NA"),
      street: String(payload.street ?? "NA"),
      zipcode: String(payload.zipcode ?? "00000"),
    },
    metadata: { order_id: orderId, user_id: user.id, sku, credits: String(info.credits), plan: info.plan },
    ...(isSubscription
      ? { product_id: productId, quantity: 1 }
      : { product_cart: [{ product_id: productId, quantity: 1 }] }),
  };

  const res = await fetch(`${API_BASE}/${isSubscription ? "subscriptions" : "payments"}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    await admin.from("dodo_orders").update({ status: "failed", raw: data }).eq("order_id", orderId);
    return json({ error: `Dodo error ${res.status}`, details: data }, 502);
  }

  const checkoutUrl = data.payment_link || data.checkout_url || data.url;
  await admin
    .from("dodo_orders")
    .update({
      dodo_payment_id: data.payment_id ?? null,
      dodo_subscription_id: data.subscription_id ?? null,
      raw: data,
    })
    .eq("order_id", orderId);

  return json({ ok: true, checkout_url: checkoutUrl, order_id: orderId });
});
