import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set([\n  "https://localixdelivery.rngdigital.com.br",
  "https://localixdelivery-stagin-git-5346ae-alexandre-sanliver-s-projects.vercel.app",
]);
const allowed = new Set([
  "business_name",
  "contact_name",
  "phone",
  "segment",
  "city",
  "neighborhood",
  "estimated_monthly_orders",
  "current_channels",
  "main_pain",
  "is_decision_maker",
  "source",
  "medium",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "meta_campaign_id",
  "meta_adset_id",
  "meta_ad_id",
  "creative_code",
  "external_ref",
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin)
      ? origin
      : "https://localixdelivery-stagin-git-5346ae-alexandre-sanliver-s-projects.vercel.app",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
    "Content-Type": "application/json",
  };
}

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: cors });
  if (req.method !== "POST")
    return new Response(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }), {
      status: 405,
      headers: cors,
    });

  const auth = req.headers.get("Authorization");
  if (!auth)
    return new Response(JSON.stringify({ error: "AUTH_REQUIRED" }), {
      status: 401,
      headers: cors,
    });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return new Response(JSON.stringify({ error: "INVALID_JSON" }), {
      status: 400,
      headers: cors,
    });
  }

  if (!body || typeof body !== "object")
    return new Response(JSON.stringify({ error: "INVALID_BODY" }), {
      status: 400,
      headers: cors,
    });

  for (const key of Object.keys(body)) {
    if (!allowed.has(key))
      return new Response(JSON.stringify({ error: "UNKNOWN_FIELD", field: key }), {
        status: 400,
        headers: cors,
      });
  }

  if (
    typeof body.business_name !== "string" ||
    typeof body.contact_name !== "string" ||
    typeof body.phone !== "string"
  )
    return new Response(JSON.stringify({ error: "REQUIRED_FIELDS" }), {
      status: 422,
      headers: cors,
    });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const args: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) args["_" + key] = value;

  const { data, error } = await sb.rpc("create_partner_lead_manual", args);
  if (error) {
    console.error("partner_lead_capture_failed", { code: error.code, message: error.message });
    const status = error.message.includes("FORBIDDEN")
      ? 403
      : error.message.includes("AUTH_REQUIRED")
        ? 401
        : 400;
    return new Response(JSON.stringify({ error: "CAPTURE_FAILED", code: error.code }), {
      status,
      headers: cors,
    });
  }

  return new Response(
    JSON.stringify({ ok: true, lead_id: data?.id ?? null, status: data?.status ?? null }),
    { status: 200, headers: cors },
  );
});
