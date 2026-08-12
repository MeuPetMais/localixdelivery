#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PILOT_EXPECTED = Object.freeze({
  subtotal: 3.5,
  deliveryFee: 5,
  customerTotal: 9.49,
  platformFee: 0.99,
  serviceFeePayer: "customer",
  restaurantNet: 3.5,
});

const MONEY_TOLERANCE = 0.01;
const READ_ONLY_NOTICE = "READ-ONLY: this tool only runs select queries and optional Mercado Pago GET.";

function money(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

function sameMoney(left, right) {
  return Math.abs(money(left) - money(right)) <= MONEY_TOLERANCE;
}

function present(value) {
  return String(value ?? "").trim().length > 0;
}

function maskId(value) {
  const text = String(value ?? "");
  if (text.length <= 8) return text || null;
  return `${text.slice(0, 4)}...${text.slice(-4)}`;
}

export function parseArgs(argv) {
  const [command = "preflight", ...rest] = argv;
  const args = {};
  for (const item of rest) {
    if (!item.startsWith("--")) continue;
    const eq = item.indexOf("=");
    if (eq === -1) {
      args[item.slice(2)] = "true";
    } else {
      args[item.slice(2, eq)] = item.slice(eq + 1);
    }
  }
  return { command, args };
}

function envReader(source = process.env) {
  return { get: (key) => source[key] };
}

function addCheck(checks, section, name, ok, details = "", severity = "fail") {
  checks.push({ section, name, ok: Boolean(ok), details, severity });
}

function sectionStatus(checks, section) {
  const sectionChecks = checks.filter((check) => check.section === section);
  if (sectionChecks.some((check) => !check.ok && check.severity === "manual_review")) return "MANUAL_REVIEW";
  return sectionChecks.every((check) => check.ok) ? "PASS" : "FAIL";
}

function finalStatus(checks) {
  if (checks.some((check) => !check.ok && check.severity === "manual_review")) return "MANUAL_REVIEW";
  return checks.every((check) => check.ok) ? "PASS" : "FAIL";
}

export function expectedTokenSource(env) {
  return env.LOCALIX_ENV === "staging" &&
    env.LOCALIX_SUPABASE_ENVIRONMENT === "staging" &&
    env.MP_ENVIRONMENT === "sandbox"
    ? "mp_test_access_token"
    : "seller_oauth";
}

export function buildMpIdempotencyKey(orderId, method = "pix") {
  return `localix-mp-${method}-${orderId}`;
}

export function evaluatePreflight(input) {
  const env = input.env ?? {};
  const expected = { ...PILOT_EXPECTED, ...(input.expected ?? {}) };
  const checks = [];
  const runtime = env.LOCALIX_ENV;
  const supabaseEnv = env.LOCALIX_SUPABASE_ENVIRONMENT;
  const mpEnv = env.MP_ENVIRONMENT;
  const productionMode = runtime === "production" && supabaseEnv === "production" && mpEnv === "production";

  addCheck(checks, "PRE-FLIGHT", "LOCALIX_ENV production", runtime === "production", `actual=${runtime ?? "missing"}`);
  addCheck(checks, "PRE-FLIGHT", "LOCALIX_SUPABASE_ENVIRONMENT production", supabaseEnv === "production", `actual=${supabaseEnv ?? "missing"}`);
  addCheck(checks, "PRE-FLIGHT", "MP_ENVIRONMENT production", mpEnv === "production", `actual=${mpEnv ?? "missing"}`);
  addCheck(checks, "PRE-FLIGHT", "SUPABASE_URL present", present(env.SUPABASE_URL));
  addCheck(checks, "PRE-FLIGHT", "SUPABASE_SERVICE_ROLE_KEY present", present(env.SUPABASE_SERVICE_ROLE_KEY), "presence only");
  addCheck(checks, "PRE-FLIGHT", "APP_BASE_URL https", /^https:\/\/[^\s]+$/.test(String(env.APP_BASE_URL ?? env.APP_URL ?? "")));
  addCheck(checks, "PRE-FLIGHT", "MP_TOKEN_ENC_KEY present", present(env.MP_TOKEN_ENC_KEY), "presence only");
  addCheck(checks, "PRE-FLIGHT", "MP_WEBHOOK_SECRET present", present(env.MP_WEBHOOK_SECRET), "presence only");
  addCheck(checks, "PRE-FLIGHT", "MP_TEST_ACCESS_TOKEN absent in production", !present(env.MP_TEST_ACCESS_TOKEN), "production must not depend on test token");
  addCheck(checks, "PRE-FLIGHT", "token_source seller_oauth", productionMode && expectedTokenSource(env) === "seller_oauth");

  if (input.expectedSupabaseProjectRef) {
    addCheck(
      checks,
      "PRE-FLIGHT",
      "Supabase project expected",
      String(env.SUPABASE_URL ?? "").includes(input.expectedSupabaseProjectRef),
      `expected_ref=${input.expectedSupabaseProjectRef}`,
    );
  }

  const restaurant = input.restaurant;
  addCheck(checks, "PRE-FLIGHT", "restaurant found", Boolean(restaurant?.id));
  addCheck(checks, "PRE-FLIGHT", "restaurant active", restaurant?.active !== false);
  if (input.expectedRestaurantId) {
    addCheck(checks, "PRE-FLIGHT", "restaurant id expected", restaurant?.id === input.expectedRestaurantId);
  }
  if (input.expectedRestaurantSlug) {
    addCheck(checks, "PRE-FLIGHT", "restaurant slug expected", restaurant?.slug === input.expectedRestaurantSlug);
  }

  const account = input.account;
  addCheck(checks, "PRE-FLIGHT", "seller OAuth connected", account?.connected === true && present(account?.access_token));
  addCheck(checks, "PRE-FLIGHT", "seller OAuth not expired", !account?.expires_at || new Date(account.expires_at).getTime() > Date.now());
  if (input.expectedSellerId) {
    addCheck(checks, "PRE-FLIGHT", "seller expected", String(account?.mp_user_id ?? "") === String(input.expectedSellerId));
  }

  const settings = input.settings ?? {};
  const platformFee = money(Number(expected.subtotal) <= 30 ? settings.platform_fee_until_30 : settings.platform_fee_above_30);
  const serviceFeePayer = input.serviceFeePayer ?? "customer";
  const customerTotal = money(expected.subtotal + expected.deliveryFee + (serviceFeePayer === "customer" ? platformFee : 0));
  const restaurantNet = money(serviceFeePayer === "restaurant" ? expected.subtotal - platformFee : expected.subtotal);

  addCheck(checks, "PRICING", "service_fee_payer expected", serviceFeePayer === expected.serviceFeePayer, `actual=${serviceFeePayer}`);
  addCheck(checks, "PRICING", "platform_fee expected", sameMoney(platformFee, expected.platformFee), `actual=${platformFee}`);
  addCheck(checks, "PRICING", "customer_total expected", sameMoney(customerTotal, expected.customerTotal), `actual=${customerTotal}`);
  addCheck(checks, "PRICING", "restaurant_net expected", sameMoney(restaurantNet, expected.restaurantNet), `actual=${restaurantNet}`);

  const webhookUrl = input.webhookUrl ?? (present(env.SUPABASE_URL) ? `${String(env.SUPABASE_URL).replace(/\/+$/, "")}/functions/v1/mp-webhook` : null);
  addCheck(checks, "WEBHOOK", "webhook URL production", /^https:\/\/[^\s]+\/functions\/v1\/mp-webhook$/.test(String(webhookUrl ?? "")), webhookUrl ?? "missing");
  addCheck(checks, "IDEMPOTENCY", "idempotency key pattern configured", buildMpIdempotencyKey("order-id", "pix") === "localix-mp-pix-order-id");

  return {
    kind: "preflight",
    checks,
    final: finalStatus(checks),
    environment: { localix: runtime ?? null, supabase: supabaseEnv ?? null, mercadoPago: mpEnv ?? null },
    restaurant: restaurant ? { id: restaurant.id, slug: restaurant.slug, name: restaurant.name ?? null } : null,
    payment: { tokenSource: expectedTokenSource(env), webhookUrl },
  };
}

export function evaluatePostflight(input) {
  const expected = { ...PILOT_EXPECTED, ...(input.expected ?? {}) };
  const checks = [];
  const order = input.order;
  const snapshot = input.snapshot;
  const orderPayment = input.orderPayment;
  const splitRows = input.paymentSplitRows ?? [];
  const webhookEvents = input.webhookEvents ?? [];
  const mpPayment = input.mpPayment ?? null;
  const split = splitRows[0] ?? null;

  addCheck(checks, "PAYMENT", "order exists", Boolean(order?.id));
  addCheck(checks, "PAYMENT", "order status pago", order?.status === "pago", `actual=${order?.status ?? "missing"}`);
  addCheck(checks, "PAYMENT", "order total expected", sameMoney(order?.total, expected.customerTotal), `actual=${order?.total ?? "missing"}`);

  addCheck(checks, "PRICING", "snapshot exists", Boolean(snapshot));
  addCheck(checks, "PRICING", "snapshot customer_total", sameMoney(snapshot?.customer_total, expected.customerTotal), `actual=${snapshot?.customer_total ?? "missing"}`);
  addCheck(checks, "PRICING", "snapshot platform_fee", sameMoney(snapshot?.platform_fee, expected.platformFee), `actual=${snapshot?.platform_fee ?? "missing"}`);
  addCheck(checks, "PRICING", "snapshot service_fee_payer", snapshot?.service_fee_payer === expected.serviceFeePayer, `actual=${snapshot?.service_fee_payer ?? "missing"}`);

  addCheck(checks, "PAYMENT", "order_payment exists", Boolean(orderPayment));
  addCheck(checks, "PAYMENT", "order_payment APPROVED", orderPayment?.status === "APPROVED", `actual=${orderPayment?.status ?? "missing"}`);
  addCheck(checks, "PAYMENT", "transaction_amount expected", sameMoney(orderPayment?.transaction_amount, expected.customerTotal), `actual=${orderPayment?.transaction_amount ?? "missing"}`);
  if (mpPayment) {
    addCheck(checks, "PAYMENT", "Mercado Pago approved", mpPayment.status === "approved", `actual=${mpPayment.status ?? "missing"}`);
    addCheck(checks, "PAYMENT", "Mercado Pago amount expected", sameMoney(mpPayment.transaction_amount, expected.customerTotal), `actual=${mpPayment.transaction_amount ?? "missing"}`);
    addCheck(checks, "PAYMENT", "Mercado Pago application_fee expected", sameMoney(mpPayment.application_fee ?? mpPayment.marketplace_fee, expected.platformFee), `actual=${mpPayment.application_fee ?? mpPayment.marketplace_fee ?? "missing"}`, "manual_review");
  }
  if (mpPayment?.status === "approved" && orderPayment?.status !== "APPROVED") {
    addCheck(checks, "PAYMENT", "approved MP reconciled locally", false, "MP approved but local order_payment is not APPROVED");
  }

  addCheck(checks, "WEBHOOK", "webhook received", webhookEvents.length > 0);
  addCheck(checks, "WEBHOOK", "webhook processed", webhookEvents.some((event) => event.processed === true), `events=${webhookEvents.length}`);

  addCheck(checks, "SPLIT", "payment_split exists", splitRows.length > 0);
  addCheck(checks, "SPLIT", "payment_split not duplicated", splitRows.length <= 1, `rows=${splitRows.length}`);
  addCheck(checks, "SPLIT", "payment_split COMPLETED", split?.status === "COMPLETED", `actual=${split?.status ?? "missing"}`, split?.status === "MANUAL_REVIEW" ? "manual_review" : "fail");
  addCheck(checks, "SPLIT", "platform_amount expected", sameMoney(split?.platform_amount, expected.platformFee), `actual=${split?.platform_amount ?? "missing"}`, split ? "manual_review" : "fail");
  addCheck(checks, "SPLIT", "restaurant_amount expected", sameMoney(split?.restaurant_amount, expected.restaurantNet), `actual=${split?.restaurant_amount ?? "missing"}`, split ? "manual_review" : "fail");
  addCheck(checks, "SPLIT", "split without error", !present(split?.error_message), split?.error_message ?? "", split?.status === "MANUAL_REVIEW" ? "manual_review" : "fail");

  addCheck(checks, "REVENUE RECOGNITION", "realized_platform_revenue expected", sameMoney(snapshot?.realized_platform_revenue, expected.platformFee), `actual=${snapshot?.realized_platform_revenue ?? "missing"}`, "manual_review");

  addCheck(checks, "IDEMPOTENCY", "single split row", splitRows.length <= 1, `rows=${splitRows.length}`);
  addCheck(checks, "IDEMPOTENCY", "payment id stable", !orderPayment?.payment_id || !split?.payment_id || String(orderPayment.payment_id) === String(split.payment_id));

  return {
    kind: "postflight",
    checks,
    final: finalStatus(checks),
    environment: input.environment ?? {},
    restaurant: order ? { id: order.restaurant_id } : null,
    order,
    payment: {
      id: orderPayment?.payment_id ?? input.paymentId ?? null,
      mpStatus: mpPayment?.status ?? null,
      localStatus: orderPayment?.status ?? null,
    },
  };
}

export function formatReport(report) {
  const failed = report.checks.filter((check) => !check.ok);
  const sections = ["PRE-FLIGHT", "PRICING", "PAYMENT", "WEBHOOK", "SPLIT", "REVENUE RECOGNITION", "IDEMPOTENCY"];
  if (report.kind === "preflight") {
    return formatPreflightReport(report, failed);
  }
  const lines = [
    "MERCADO PAGO CONTROLLED TEST REPORT",
    "",
    `Environment: localix=${report.environment?.localix ?? "unknown"} supabase=${report.environment?.supabase ?? "unknown"} mp=${report.environment?.mercadoPago ?? "unknown"}`,
    `Restaurant: ${report.restaurant?.name ?? report.restaurant?.id ?? "unknown"}${report.restaurant?.slug ? ` (${report.restaurant.slug})` : ""}`,
    `Order: ${report.order?.id ?? "not provided"}${report.order?.order_number ? ` #${report.order.order_number}` : ""}`,
    `Payment: ${report.payment?.id ?? "not provided"}${report.payment?.localStatus ? ` local=${report.payment.localStatus}` : ""}${report.payment?.mpStatus ? ` mp=${report.payment.mpStatus}` : ""}`,
    "",
  ];
  for (const section of sections) {
    const hasChecks = report.checks.some((check) => check.section === section);
    if (hasChecks || section === "PRE-FLIGHT") lines.push(`${section}: ${sectionStatus(report.checks, section)}`);
  }
  lines.push("", `FINAL RESULT: ${report.final}`);
  if (report.final === "FAIL") lines.push("DO NOT RUN PAYMENT");
  lines.push("", "FAILED CHECKS:");
  if (failed.length === 0) {
    lines.push("[]");
  } else {
    for (const check of failed) {
      lines.push(`- [${check.section}] ${check.name}${check.details ? ` (${check.details})` : ""}`);
    }
  }
  lines.push("", READ_ONLY_NOTICE);
  return lines.join("\n");
}

function checkStatus(checks, names) {
  const selected = checks.filter((check) => names.includes(check.name));
  return selected.length > 0 && selected.every((check) => check.ok) ? "PASS" : "FAIL";
}

function formatPreflightReport(report, failed) {
  const checks = report.checks;
  const lines = [
    "MERCADO PAGO CONTROLLED TEST - PRE-FLIGHT",
    "",
    `Environment: ${checkStatus(checks, [
      "LOCALIX_ENV production",
      "LOCALIX_SUPABASE_ENVIRONMENT production",
      "MP_ENVIRONMENT production",
    ])}`,
    `Supabase: ${checkStatus(checks, [
      "SUPABASE_URL present",
      "SUPABASE_SERVICE_ROLE_KEY present",
      "Supabase project expected",
    ].filter((name) => checks.some((check) => check.name === name)))}`,
    `Restaurant: ${checkStatus(checks, [
      "restaurant found",
      "restaurant active",
      "restaurant id expected",
      "restaurant slug expected",
    ].filter((name) => checks.some((check) => check.name === name)))}`,
    `Seller OAuth: ${checkStatus(checks, [
      "seller OAuth connected",
      "seller OAuth not expired",
      "seller expected",
      "token_source seller_oauth",
    ].filter((name) => checks.some((check) => check.name === name)))}`,
    `Pricing: ${sectionStatus(checks, "PRICING")}`,
    `Webhook config: ${sectionStatus(checks, "WEBHOOK")}`,
    `Production safety: ${checkStatus(checks, [
      "MP_TEST_ACCESS_TOKEN absent in production",
      "MP_TOKEN_ENC_KEY present",
      "MP_WEBHOOK_SECRET present",
      "APP_BASE_URL https",
    ])}`,
    `Idempotency: ${sectionStatus(checks, "IDEMPOTENCY")}`,
    "",
    `FINAL RESULT: ${report.final}`,
  ];
  if (report.final !== "PASS") lines.push("DO NOT RUN PAYMENT");
  lines.push("", "FAILED CHECKS:");
  if (failed.length === 0) {
    lines.push("[]");
  } else {
    for (const check of failed) {
      lines.push(`- [${check.section}] ${check.name}${check.details ? ` (${check.details})` : ""}`);
    }
  }
  lines.push("", READ_ONLY_NOTICE);
  return lines.join("\n");
}

function formatFatalErrorReport(error) {
  const message = error instanceof Error ? error.message : String(error);
  return [
    "MERCADO PAGO CONTROLLED TEST - ERROR",
    "",
    "FINAL RESULT: FAIL",
    "DO NOT RUN PAYMENT",
    "",
    "FAILED CHECKS:",
    `- ${message}`,
    "",
    READ_ONLY_NOTICE,
  ].join("\n");
}

function requiredArg(args, names) {
  for (const name of names) {
    if (present(args[name])) return args[name];
  }
  throw new Error(`missing required argument: ${names.map((name) => `--${name}`).join(" or ")}`);
}

function optionalArg(args, names, fallback = null) {
  for (const name of names) {
    if (present(args[name])) return args[name];
  }
  return fallback;
}

function makeSupabase(env) {
  if (!present(env.SUPABASE_URL) || !present(env.SUPABASE_SERVICE_ROLE_KEY)) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function queryPreflight(sb, args, env) {
  const restaurantId = optionalArg(args, ["restaurant-id"], process.env.MP_CONTROLLED_TEST_RESTAURANT_ID);
  const restaurantSlug = optionalArg(args, ["restaurant-slug"], process.env.MP_CONTROLLED_TEST_RESTAURANT_SLUG);
  if (!restaurantId && !restaurantSlug) throw new Error("missing required argument: --restaurant-id or --restaurant-slug");
  const expectedSellerId = requiredArg(args, ["expected-seller-id"]);

  let restaurantQuery = sb.from("restaurants").select("id, slug, name, active, min_order, delivery_fee");
  restaurantQuery = restaurantId ? restaurantQuery.eq("id", restaurantId) : restaurantQuery.eq("slug", restaurantSlug);
  const { data: restaurant, error: restaurantError } = await restaurantQuery.maybeSingle();
  if (restaurantError) throw restaurantError;

  const { data: account, error: accountError } = restaurant?.id
    ? await sb
      .from("mercado_pago_accounts")
      .select("connected, mp_user_id, expires_at, access_token")
      .eq("restaurant_id", restaurant.id)
      .maybeSingle()
    : { data: null, error: null };
  if (accountError) throw accountError;

  const { data: tenantSettings, error: tenantError } = restaurant?.id
    ? await sb
      .from("tenant_payment_settings")
      .select("service_fee_payer")
      .eq("restaurant_id", restaurant.id)
      .maybeSingle()
    : { data: null, error: null };
  if (tenantError) throw tenantError;

  const { data: platformSettings, error: platformError } = await sb
    .from("platform_settings")
    .select("minimum_order, platform_fee_until_30, platform_fee_above_30")
    .eq("id", true)
    .maybeSingle();
  if (platformError) throw platformError;

  return evaluatePreflight({
    env,
    restaurant,
    account,
    serviceFeePayer: tenantSettings?.service_fee_payer ?? "customer",
    settings: platformSettings ?? { platform_fee_until_30: 0.99, platform_fee_above_30: 1.49 },
    expectedSellerId,
    expectedRestaurantId: restaurantId,
    expectedRestaurantSlug: restaurantSlug,
    expectedSupabaseProjectRef: optionalArg(args, ["expected-supabase-project-ref"], process.env.MP_CONTROLLED_TEST_SUPABASE_PROJECT_REF),
    expected: {
      subtotal: Number(optionalArg(args, ["subtotal"], PILOT_EXPECTED.subtotal)),
      deliveryFee: Number(optionalArg(args, ["delivery-fee"], restaurant?.delivery_fee ?? PILOT_EXPECTED.deliveryFee)),
      customerTotal: Number(optionalArg(args, ["customer-total"], PILOT_EXPECTED.customerTotal)),
      platformFee: Number(optionalArg(args, ["platform-fee"], PILOT_EXPECTED.platformFee)),
      serviceFeePayer: optionalArg(args, ["service-fee-payer"], PILOT_EXPECTED.serviceFeePayer),
      restaurantNet: Number(optionalArg(args, ["restaurant-net"], PILOT_EXPECTED.restaurantNet)),
    },
  });
}

async function decryptToken(payload, secret) {
  if (!payload) return null;
  if (!String(payload).startsWith("v1:")) return payload;
  if (!present(secret)) throw new Error("MP_TOKEN_ENC_KEY is required to read Mercado Pago payment status");
  const [, ivB64, ctB64] = String(payload).split(":");
  const enc = new TextEncoder();
  const keyHash = await crypto.subtle.digest("SHA-256", enc.encode(secret));
  const key = await crypto.subtle.importKey("raw", keyHash, "AES-GCM", false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: Buffer.from(ivB64, "base64") },
    key,
    Buffer.from(ctB64, "base64"),
  );
  return new TextDecoder().decode(plain);
}

async function fetchMercadoPagoPaymentReadOnly(token, paymentId) {
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { error: body?.message ?? body?.error ?? `mp_get_failed_${res.status}`, statusCode: res.status };
  return body;
}

async function queryPostflight(sb, args, env) {
  const orderId = requiredArg(args, ["order-id"]);
  const explicitPaymentId = optionalArg(args, ["payment-id"]);

  const { data: order, error: orderError } = await sb
    .from("orders")
    .select("id, order_number, status, total, payment_method, restaurant_id")
    .eq("id", orderId)
    .maybeSingle();
  if (orderError) throw orderError;

  const { data: snapshot, error: snapshotError } = await sb
    .from("order_pricing_snapshot")
    .select("subtotal, delivery_fee, platform_fee, customer_total, restaurant_net, service_fee_payer, realized_platform_revenue")
    .eq("order_id", orderId)
    .maybeSingle();
  if (snapshotError) throw snapshotError;

  const { data: orderPayment, error: paymentError } = await sb
    .from("order_payment")
    .select("provider, payment_method, payment_id, status, transaction_amount, last_error")
    .eq("order_id", orderId)
    .maybeSingle();
  if (paymentError) throw paymentError;

  const paymentId = explicitPaymentId ?? orderPayment?.payment_id ?? null;
  const { data: paymentSplitRows, error: splitError } = await sb
    .from("payment_split")
    .select("provider, payment_id, status, platform_amount, restaurant_amount, gateway_fee, split_reference, error_message")
    .eq("order_id", orderId);
  if (splitError) throw splitError;

  let eventsQuery = sb
    .from("payment_webhook_events")
    .select("event_id, processed, error_message, resource_id, external_reference, event_type, action, created_at");
  eventsQuery = paymentId
    ? eventsQuery.or(`resource_id.eq.${paymentId},external_reference.eq.${orderId}`)
    : eventsQuery.eq("external_reference", orderId);
  const { data: webhookEvents, error: eventsError } = await eventsQuery;
  if (eventsError) throw eventsError;

  let mpPayment = null;
  if (paymentId && order?.restaurant_id) {
    const { data: account, error: accountError } = await sb
      .from("mercado_pago_accounts")
      .select("access_token, connected")
      .eq("restaurant_id", order.restaurant_id)
      .maybeSingle();
    if (accountError) throw accountError;
    if (account?.connected && account.access_token) {
      const token = await decryptToken(account.access_token, env.MP_TOKEN_ENC_KEY);
      mpPayment = await fetchMercadoPagoPaymentReadOnly(token, paymentId);
    }
  }

  return evaluatePostflight({
    environment: { localix: env.LOCALIX_ENV, supabase: env.LOCALIX_SUPABASE_ENVIRONMENT, mercadoPago: env.MP_ENVIRONMENT },
    order,
    snapshot,
    orderPayment,
    paymentSplitRows: paymentSplitRows ?? [],
    webhookEvents: webhookEvents ?? [],
    mpPayment,
    paymentId,
  });
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const { command, args } = parseArgs(argv);
  const sb = makeSupabase(env);
  const report = command === "preflight"
    ? await queryPreflight(sb, args, env)
    : command === "report"
      ? await queryPostflight(sb, args, env)
      : null;
  if (!report) throw new Error(`unknown command: ${command}`);
  console.log(formatReport(report));
  process.exitCode = report.final === "PASS" ? 0 : 1;
}

function isDirectExecution() {
  if (!process.argv[1]) return false;
  return resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);
}

if (isDirectExecution()) {
  main().catch((error) => {
    console.log(formatFatalErrorReport(error));
    process.exitCode = 1;
  });
}
