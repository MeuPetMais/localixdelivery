import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sourcePath = new URL(
  "../../../supabase/functions/mp-payment-intent/index.ts",
  import.meta.url,
);
const source = readFileSync(sourcePath, "utf8");

const accessTokenFunction = source.slice(
  source.indexOf("async function getAccessToken"),
  source.indexOf("function sanitizeMpCause"),
);
const createPixPaymentFunction = source.slice(
  source.indexOf("async function createPixPayment"),
  source.indexOf("async function hashShort"),
);
const transparentCardFunction = source.slice(
  source.indexOf("async function createTransparentCardPayment"),
  source.indexOf("function toMoney"),
);
const refundFunction = source.slice(
  source.indexOf("async function createPaymentRefund"),
  source.indexOf("async function syncOrderStatusFromPayment"),
);
const refundFlow = source.slice(
  source.indexOf('if (action === "refund")'),
  source.indexOf("// ---------- CANCEL ----------"),
);
const cardCreateFlow = source.slice(
  source.indexOf('if (method !== "pix")'),
  source.indexOf("// PIX"),
);
const transparentCardCreateFlow = source.slice(
  source.indexOf("let transparentCard;"),
  source.indexOf("// 1) Garante linha em order_payment ANTES de chamar o MP."),
);
const pixCreateFlow = source.slice(
  source.indexOf("const rawPlatformFee"),
  source.indexOf("// ---------- STATUS ----------"),
);

describe("mp-payment-intent seller OAuth", () => {
  it("usa somente OAuth do seller, sem fallback MP_ACCESS_TOKEN", () => {
    expect(accessTokenFunction).toContain('.from("mercado_pago_accounts")');
    expect(accessTokenFunction).toContain('.select("access_token, connected")');
    expect(accessTokenFunction).toContain("!data?.connected || !data.access_token");
    expect(accessTokenFunction).toContain("const token = await decryptToken(data.access_token)");
    expect(accessTokenFunction).toContain('throw new Error("mercado_pago_seller_not_connected")');
    expect(source).not.toContain("MP_ACCESS_TOKEN");
  });
});

describe("mp-payment-intent transparent card", () => {
  it("cria cartao pelo /v1/payments e nao por Checkout Pro", () => {
    expect(transparentCardFunction).toContain('fetch("https://api.mercadopago.com/v1/payments"');
    expect(transparentCardFunction).toContain('"X-Idempotency-Key": params.idempotencyKey');
    expect(transparentCardCreateFlow).toContain("createTransparentCardPayment(token");
    expect(transparentCardCreateFlow.indexOf("createTransparentCardPayment(token")).toBeLessThan(
      transparentCardCreateFlow.lastIndexOf("return json({"),
    );
    expect(transparentCardCreateFlow).not.toContain("payment_url: paymentUrl");
  });

  it("retorna do fluxo transparente antes do legado Checkout Pro", () => {
    const transparentCall = cardCreateFlow.indexOf("createTransparentCardPayment(token");
    const transparentReturn = cardCreateFlow.indexOf("payment_id: String(transparentMp.id)");
    const legacyPreferenceCall = cardCreateFlow.indexOf("createCardPreference(token");

    expect(transparentCall).toBeGreaterThan(-1);
    expect(transparentReturn).toBeGreaterThan(transparentCall);
    expect(legacyPreferenceCall).toBeGreaterThan(transparentReturn);
    expect(cardCreateFlow.slice(transparentReturn, legacyPreferenceCall)).toContain(
      "return json({",
    );
  });

  it("usa snapshot como fonte financeira autoritativa", () => {
    expect(cardCreateFlow).toContain('.from("order_pricing_snapshot")');
    expect(cardCreateFlow).toContain('.select("customer_total, platform_fee, service_fee_payer")');
    expect(transparentCardCreateFlow).toContain("cardFinancials.customerTotal");
    expect(transparentCardFunction).toContain(
      "transaction_amount: Number(params.amount.toFixed(2))",
    );
    expect(transparentCardFunction).toContain(
      "application_fee: Number(params.platformFee.toFixed(2))",
    );
    expect(transparentCardFunction).not.toContain("payload?.amount");
  });

  it("falha fechado com snapshot ausente ou valores invalidos", () => {
    expect(cardCreateFlow).toContain("return json({");
    expect(cardCreateFlow).toContain('error: "missing_card_pricing_snapshot"');
    expect(source).toContain("customerTotal === null || customerTotal <= 0");
    expect(source).toContain('throw new Error("invalid_card_customer_total")');
    expect(source).toContain("platformFee === null || platformFee < 0");
    expect(source).toContain('throw new Error("invalid_card_platform_fee")');
    expect(source).toContain('throw new Error("invalid_card_service_fee_payer")');
  });

  it("encaminha somente campos necessarios do cartao", () => {
    expect(transparentCardFunction).toContain("token: params.card.token");
    expect(transparentCardFunction).toContain("payment_method_id: params.card.paymentMethodId");
    expect(transparentCardFunction).toContain("installments: params.card.installments");
    expect(transparentCardFunction).toContain(
      "if (params.card.issuerId) body.issuer_id = params.card.issuerId",
    );
    expect(transparentCardFunction).toContain(
      "body.payer.identification = params.card.payerIdentification",
    );
    expect(transparentCardFunction).not.toMatch(/card_number|security_code|cvv|expiration_date/i);
  });

  it("define external_reference como order.id e notification_url do webhook", () => {
    expect(transparentCardFunction).toContain("external_reference: params.externalReference");
    expect(transparentCardCreateFlow).toContain("externalReference: order.id");
    expect(transparentCardCreateFlow).toContain("mp-webhook");
  });

  it("usa idempotencia deterministica por pedido e token sem persistir token", () => {
    expect(source).toContain("async function buildCardIdempotencyKey(orderId, cardToken)");
    expect(source).toContain("await hashShort(cardToken)");
    expect(transparentCardFunction).not.toContain("crypto.randomUUID()");
    expect(transparentCardCreateFlow).toContain("transparentIdempotencyKey");
    expect(transparentCardCreateFlow).toContain("idempotencyKey: transparentIdempotencyKey");
  });

  it("persiste payment_id/status/raw sanitizado sem token", () => {
    expect(transparentCardCreateFlow).toContain("payment_id: String(transparentMp.id)");
    expect(transparentCardCreateFlow).toContain("payment_intent: String(transparentMp.id)");
    expect(transparentCardCreateFlow).toContain("status: transparentStatus");
    expect(transparentCardCreateFlow).toContain("raw: transparentRaw");
    expect(transparentCardCreateFlow).not.toContain("raw: transparentMp");
    expect(transparentCardCreateFlow).not.toContain("token:");
  });

  it("erro rejected preserva status_detail sanitizado e nao marca pedido como pago", () => {
    expect(transparentCardCreateFlow).toContain("last_error:");
    expect(transparentCardCreateFlow).toContain('transparentStatus === "REJECTED"');
    expect(transparentCardCreateFlow).toContain(
      "status_detail: transparentMp?.status_detail ?? null",
    );
    expect(transparentCardCreateFlow).not.toContain(
      "syncOrderStatusFromPayment(orderId, transparentStatus",
    );
    expect(transparentCardCreateFlow).not.toContain("PAYMENT_APPROVED");
    expect(transparentCardCreateFlow).not.toContain("financial_ledger");
  });

  it("resposta de cartao novo nao retorna redirect obrigatorio", () => {
    expect(transparentCardCreateFlow).toContain("payment_url: null");
    expect(transparentCardCreateFlow).toContain("payment_id: String(transparentMp.id)");
    expect(transparentCardCreateFlow).toContain("status: transparentStatus");
  });
});

describe("mp-payment-intent PIX preservado", () => {
  it("mantem PIX semanticamente inalterado", () => {
    expect(createPixPaymentFunction).toContain('fetch("https://api.mercadopago.com/v1/payments"');
    expect(createPixPaymentFunction).toContain('payment_method_id: "pix"');
    expect(createPixPaymentFunction).toContain(
      "application_fee: Number(params.platformFee.toFixed(2))",
    );
    expect(createPixPaymentFunction).toContain("date_of_expiration: params.expirationDate");
    expect(pixCreateFlow).toContain("amount: Number(order.total)");
    expect(pixCreateFlow).toContain("idempotencyKey: `localix-mp-pix-${orderId}`");
  });
});

describe("mp-payment-intent refund Mercado Pago", () => {
  it("cria refund total pelo endpoint oficial sem amount", () => {
    expect(refundFunction).toContain(
      "https://api.mercadopago.com/v1/payments/${paymentId}/refunds",
    );
    expect(refundFunction).toContain('method: "POST"');
    expect(refundFunction).toContain('"X-Idempotency-Key": idempotencyKey');
    expect(refundFunction).toContain("body: JSON.stringify({})");
    expect(refundFunction).not.toContain("amount");
  });

  it("usa payment_id vindo do banco e exige pagamento aprovado", () => {
    expect(refundFlow).toContain('const paymentId = String(existing?.payment_id ?? "").trim()');
    expect(refundFlow).toContain('error: "payment_id_missing"');
    expect(refundFlow).toContain('String(existing?.provider ?? "") !== "mercado_pago"');
    expect(refundFlow).toContain('currentPaymentStatus !== "APPROVED"');
    expect(refundFlow).toContain('error: "payment_not_refundable"');
    expect(refundFlow).not.toContain("payload?.payment_id");
  });

  it("usa idempotencia deterministica e retry retorna estado idempotente", () => {
    expect(source).toContain("async function buildRefundIdempotencyKey(orderId, paymentId)");
    expect(source).toContain("`${orderId}:${paymentId}:full`");
    expect(source).toContain("refundIdempotencyKey");
    expect(refundFlow).toContain('currentPaymentStatus === "REFUNDED"');
    expect(refundFlow).toContain("idempotent: true");
    expect(refundFlow).not.toContain("crypto.randomUUID()");
  });

  it("erro do MP nao marca pedido como reembolsado nem cria ledger", () => {
    const catchBlock = refundFlow.slice(
      refundFlow.indexOf("} catch (e) {"),
      refundFlow.indexOf("const refundRaw"),
    );
    expect(catchBlock).toContain("last_error: msg");
    expect(catchBlock).toContain("status: 502");
    expect(catchBlock).not.toContain("REFUNDED");
    expect(catchBlock).not.toContain("transitionOrder");
    expect(refundFlow).not.toContain("financial_ledger");
    expect(refundFlow).not.toContain("PAYMENT_APPROVED");
  });

  it("sucesso persiste refund sanitizado e transiciona para reembolsado", () => {
    expect(refundFlow).toContain("sanitizeMpRefundRaw(refund)");
    expect(refundFlow).toContain('status: "REFUNDED"');
    expect(refundFlow).toContain('status: "refunded"');
    expect(refundFlow).toContain("last_refund: refundRaw");
    expect(refundFlow).toContain('to: "reembolsado"');
    expect(refundFlow).toContain('service: "mp-payment-intent:refund"');
  });
});
