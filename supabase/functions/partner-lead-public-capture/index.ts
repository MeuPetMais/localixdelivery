import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const productionOrigin = "https://localixdelivery.rngdigital.com.br";
const stagingPreviewPattern =
  /^https:\/\/localixdelivery-stagin-git-[a-z0-9-]+-alexandre-sanliver-s-projects\.vercel\.app$/;

function isAllowedOrigin(origin: string) {
  return origin === productionOrigin || stagingPreviewPattern.test(origin);
}

const allowed = new Set([
  "business_name",
  "contact_name",
  "phone",
  "email",
  "segment",
  "city",
  "neighborhood",
  "estimated_monthly_orders",
  "main_pain",
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
  "website",
]);

function headers(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin : "",
    "Access-Control-Allow-Headers": "content-type, x-client-info, apikey",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
    "Content-Type": "application/json",
  };
}

const clean = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : null);

async function hash(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  const h = headers(req);
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: h });
  if (req.method !== "POST")
    return new Response(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }), {
      status: 405,
      headers: h,
    });

  const origin = req.headers.get("origin") ?? "";
  if (!isAllowedOrigin(origin))
    return new Response(JSON.stringify({ error: "ORIGIN_NOT_ALLOWED" }), {
      status: 403,
      headers: h,
    });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "INVALID_JSON" }), {
      status: 400,
      headers: h,
    });
  }

  if (!body || typeof body !== "object")
    return new Response(JSON.stringify({ error: "INVALID_BODY" }), {
      status: 400,
      headers: h,
    });

  for (const key of Object.keys(body)) {
    if (!allowed.has(key))
      return new Response(JSON.stringify({ error: "UNKNOWN_FIELD", field: key }), {
        status: 400,
        headers: h,
      });
  }

  if (clean(body.website))
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: h,
    });

  const business_name = clean(body.business_name, 160);
  const contact_name = clean(body.contact_name, 160);
  const phone = (clean(body.phone, 30) ?? "").replace(/\D/g, "");
  const external_ref = clean(body.external_ref, 160);

  if (
    !business_name ||
    business_name.length < 2 ||
    !contact_name ||
    contact_name.length < 2 ||
    phone.length < 10 ||
    phone.length > 15 ||
    !external_ref
  )
    return new Response(JSON.stringify({ error: "REQUIRED_FIELDS" }), {
      status: 422,
      headers: h,
    });

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, service, { auth: { persistSession: false } });

  const forwarded = (
    req.headers.get("x-forwarded-for") ??
    req.headers.get("cf-connecting-ip") ??
    "unknown"
  )
    .split(",")[0]
    .trim();
  const ipHash = await hash(forwarded);

  const { data: allowedRate, error: rateError } = await sb.rpc(
    "consume_partner_lead_public_rate_limit",
    { _ip_hash: ipHash, _limit: 5, _window: "01:00:00" },
  );

  if (rateError) {
    console.error("public_lead_rate_limit_failed", { code: rateError.code });
    return new Response(JSON.stringify({ error: "CAPTURE_UNAVAILABLE" }), {
      status: 503,
      headers: h,
    });
  }

  if (!allowedRate)
    return new Response(JSON.stringify({ error: "RATE_LIMITED" }), {
      status: 429,
      headers: h,
    });

  const estimated =
    typeof body.estimated_monthly_orders === "number" &&
    Number.isInteger(body.estimated_monthly_orders) &&
    body.estimated_monthly_orders >= 0
      ? body.estimated_monthly_orders
      : null;

  const row = {
    business_name,
    contact_name,
    phone,
    email: clean(body.email, 254),
    segment: clean(body.segment, 100),
    city: clean(body.city, 120),
    neighborhood: clean(body.neighborhood, 120),
    estimated_monthly_orders: estimated,
    main_pain: clean(body.main_pain, 1000),
    source: clean(body.source, 80) ?? "meta_ads",
    medium: clean(body.medium, 80) ?? "paid_social",
    utm_source: clean(body.utm_source, 160),
    utm_medium: clean(body.utm_medium, 160),
    utm_campaign: clean(body.utm_campaign, 200),
    utm_content: clean(body.utm_content, 200),
    utm_term: clean(body.utm_term, 200),
    meta_campaign_id: clean(body.meta_campaign_id, 160),
    meta_adset_id: clean(body.meta_adset_id, 160),
    meta_ad_id: clean(body.meta_ad_id, 160),
    creative_code: clean(body.creative_code, 160),
    external_ref,
    status: "new",
    assigned_to: null,
    created_by: null,
  };

  const { data, error } = await sb.rpc("create_partner_lead_public_idempotent", {
    _business_name: row.business_name,
    _contact_name: row.contact_name,
    _phone: row.phone,
    _email: row.email,
    _segment: row.segment,
    _city: row.city,
    _neighborhood: row.neighborhood,
    _estimated_monthly_orders: row.estimated_monthly_orders,
    _main_pain: row.main_pain,
    _source: row.source,
    _medium: row.medium,
    _utm_source: row.utm_source,
    _utm_medium: row.utm_medium,
    _utm_campaign: row.utm_campaign,
    _utm_content: row.utm_content,
    _utm_term: row.utm_term,
    _meta_campaign_id: row.meta_campaign_id,
    _meta_adset_id: row.meta_adset_id,
    _meta_ad_id: row.meta_ad_id,
    _creative_code: row.creative_code,
    _external_ref: row.external_ref,
  });

  if (error) {
    console.error("public_lead_capture_failed", {
      code: error.code,
      message: error.message,
    });
    return new Response(JSON.stringify({ error: "CAPTURE_FAILED", code: error.code }), {
      status: 400,
      headers: h,
    });
  }

  return new Response(JSON.stringify({ ok: true, lead_id: data.id, status: data.status }), {
    status: 200,
    headers: h,
  });
});
