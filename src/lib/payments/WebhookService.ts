// WebhookService — processamento de eventos do Mercado Pago.
//
// Contrato:
//   - Núcleo puro `handleWebhook` é testável (injeta deps).
//   - Idempotência via (provider, event_id).
//   - Nunca modifica registros do Ledger (sempre append).
//   - Não altera OAuth / Providers / Checkout / PaymentIntent / PricingEngine.

import { EventBus, type PaymentEventName } from "./EventBus";

export type MpStatus =
  | "approved"
  | "pending"
  | "in_process"
  | "rejected"
  | "cancelled"
  | "refunded"
  | "charged_back"
  | "expired";

export type LocalPaymentStatus =
  | "PENDING"
  | "PROCESSING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "EXPIRED"
  | "REFUNDED"
  | "CHARGEBACK";

export interface MpPayment {
  id: string | number;
  status: MpStatus | string;
  status_detail?: string | null;
  transaction_amount?: number | null;
  currency_id?: string | null;
  external_reference?: string | null;
  date_approved?: string | null;
  date_of_expiration?: string | null;
}

export interface WebhookInput {
  provider?: string;
  headers: Record<string, string | null | undefined>;
  rawBody: string;
  parsed?: Record<string, any> | null;
}

export interface StoredEvent {
  id: string;
  duplicated: boolean;
}

// -------- Núcleo puro --------
export function mapStatus(s: string | null | undefined): LocalPaymentStatus {
  switch ((s ?? "").toLowerCase()) {
    case "approved": return "APPROVED";
    case "in_process": return "PROCESSING";
    case "pending": return "PENDING";
    case "rejected": return "REJECTED";
    case "cancelled": return "CANCELLED";
    case "expired": return "EXPIRED";
    case "refunded": return "REFUNDED";
    case "charged_back": return "CHARGEBACK";
    default: return "PENDING";
  }
}

export function eventNameFromStatus(status: LocalPaymentStatus): PaymentEventName {
  switch (status) {
    case "APPROVED": return "PaymentApproved";
    case "REJECTED": return "PaymentRejected";
    case "PENDING": return "PaymentPending";
    case "PROCESSING": return "PaymentProcessing";
    case "CANCELLED": return "PaymentCancelled";
    case "EXPIRED": return "PaymentExpired";
    case "REFUNDED": return "PaymentRefunded";
    case "CHARGEBACK": return "PaymentChargeback";
  }
}

/**
 * Validação HMAC do Mercado Pago (x-signature: ts=..,v1=..).
 * Se `secret` ausente, retorna `true` (aceito, mas registrado como sem verificação).
 */
export async function verifyMpSignature(opts: {
  secret: string | null | undefined;
  xSignature: string | null | undefined;
  xRequestId: string | null | undefined;
  dataId: string | null | undefined;
}): Promise<boolean> {
  if (!opts.secret) return true;
  if (!opts.xSignature || !opts.xRequestId || !opts.dataId) return false;
  const parts = Object.fromEntries(
    opts.xSignature.split(",").map((p) => {
      const [k, ...rest] = p.trim().split("=");
      return [k.trim(), rest.join("=").trim()];
    }),
  ) as Record<string, string>;
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;
  const manifest = `id:${opts.dataId};request-id:${opts.xRequestId};ts:${ts};`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(opts.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(manifest));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  // compare tempo-constante simples
  if (hex.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
}

// -------- Dependências injetáveis --------
export interface WebhookDeps {
  /** Persiste evento; retorna id + flag de duplicado (idempotência por event_id). */
  storeEvent(row: {
    provider: string;
    event_id: string | null;
    event_type: string | null;
    action: string | null;
    resource_id: string | null;
    external_reference: string | null;
    payload_json: Record<string, any>;
    signature: string | null;
  }): Promise<StoredEvent>;
  markProcessed(eventPk: string, ok: boolean, error?: string | null): Promise<void>;
  enqueueRetry(eventPk: string, err: string): Promise<void>;
  fetchMpPayment(paymentId: string): Promise<MpPayment | null>;
  updateOrderPayment(orderId: string, status: LocalPaymentStatus, patch: Record<string, any>): Promise<void>;
  updateOrder(orderId: string, patch: Record<string, any>): Promise<void>;
  recordLedger(entry: {
    orderId: string;
    restaurantId: string | null;
    provider: string;
    transactionType:
      | "PAYMENT_APPROVED" | "PAYMENT_PENDING" | "PAYMENT_FAILED"
      | "REFUND" | "CHARGEBACK";
    amount: number;
    referenceId: string | null;
    description: string;
    metadata?: Record<string, any>;
  }): Promise<void>;
  getOrderByPayment(paymentId: string, externalReference: string | null): Promise<
    { orderId: string; restaurantId: string | null } | null
  >;
}

export interface WebhookOutcome {
  ok: boolean;
  duplicated: boolean;
  status?: LocalPaymentStatus;
  eventName?: PaymentEventName;
  orderId?: string | null;
  reason?: string;
}

/** Orquestração pura — não conhece Supabase nem HTTP. */
export async function handleWebhook(
  deps: WebhookDeps,
  input: WebhookInput,
): Promise<WebhookOutcome> {
  const provider = input.provider ?? "mercado_pago";
  const body = input.parsed ?? safeJson(input.rawBody);
  const eventType = String(body?.type ?? body?.topic ?? "").toLowerCase() || null;
  const action = String(body?.action ?? "").toLowerCase() || null;
  const resourceId = String(
    body?.data?.id ?? body?.resource ?? body?.id ?? "",
  ) || null;
  const eventId = String(body?.id ?? "") || (resourceId && action ? `${action}:${resourceId}` : null);
  const externalReference = body?.external_reference ?? body?.data?.external_reference ?? null;
  const signature = input.headers["x-signature"] ?? null;

  const stored = await deps.storeEvent({
    provider,
    event_id: eventId,
    event_type: eventType,
    action,
    resource_id: resourceId,
    external_reference: externalReference,
    payload_json: body ?? {},
    signature,
  });

  if (stored.duplicated) {
    return { ok: true, duplicated: true, reason: "duplicated" };
  }

  // Só tratamos eventos de payment.
  const isPayment = (eventType && eventType.includes("payment")) || (action && action.startsWith("payment."));
  if (!isPayment || !resourceId) {
    await deps.markProcessed(stored.id, true, "ignored: not a payment event");
    return { ok: true, duplicated: false, reason: "ignored" };
  }

  try {
    const mp = await deps.fetchMpPayment(resourceId);
    if (!mp) {
      await deps.markProcessed(stored.id, false, "MP payment not found");
      return { ok: false, duplicated: false, reason: "mp_not_found" };
    }
    const local = mapStatus(mp.status);
    const link = await deps.getOrderByPayment(String(mp.id), mp.external_reference ?? externalReference);
    if (!link) {
      await deps.markProcessed(stored.id, true, "order not found");
      return { ok: true, duplicated: false, status: local, reason: "order_not_found" };
    }

    const amount = Number(mp.transaction_amount ?? 0) || 0;
    await deps.updateOrderPayment(link.orderId, local, {
      transaction_amount: amount,
      provider_payment_id: String(mp.id),
      status_detail: mp.status_detail ?? null,
      last_error: null,
    });

    if (local === "APPROVED") {
      await deps.updateOrder(link.orderId, { status: "pago" });
      await deps.recordLedger({
        orderId: link.orderId,
        restaurantId: link.restaurantId,
        provider,
        transactionType: "PAYMENT_APPROVED",
        amount,
        referenceId: String(mp.id),
        description: "Pagamento aprovado",
        metadata: { status_detail: mp.status_detail ?? null },
      });
    } else if (local === "PENDING" || local === "PROCESSING") {
      await deps.recordLedger({
        orderId: link.orderId,
        restaurantId: link.restaurantId,
        provider,
        transactionType: "PAYMENT_PENDING",
        amount,
        referenceId: String(mp.id),
        description: "Pagamento pendente",
      });
    } else if (local === "REJECTED" || local === "CANCELLED" || local === "EXPIRED") {
      await deps.recordLedger({
        orderId: link.orderId,
        restaurantId: link.restaurantId,
        provider,
        transactionType: "PAYMENT_FAILED",
        amount,
        referenceId: String(mp.id),
        description: `Pagamento ${local.toLowerCase()}`,
      });
    } else if (local === "REFUNDED") {
      await deps.recordLedger({
        orderId: link.orderId,
        restaurantId: link.restaurantId,
        provider,
        transactionType: "REFUND",
        amount,
        referenceId: String(mp.id),
        description: "Estorno",
      });
    } else if (local === "CHARGEBACK") {
      await deps.recordLedger({
        orderId: link.orderId,
        restaurantId: link.restaurantId,
        provider,
        transactionType: "CHARGEBACK",
        amount,
        referenceId: String(mp.id),
        description: "Chargeback",
      });
    }

    const eventName = eventNameFromStatus(local);
    await EventBus.publish(eventName, {
      provider,
      orderId: link.orderId,
      restaurantId: link.restaurantId,
      paymentId: String(mp.id),
      amount,
      currency: mp.currency_id ?? "BRL",
      raw: mp as any,
    });

    await deps.markProcessed(stored.id, true);
    return { ok: true, duplicated: false, status: local, eventName, orderId: link.orderId };
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    await deps.markProcessed(stored.id, false, msg);
    await deps.enqueueRetry(stored.id, msg).catch(() => {});
    return { ok: false, duplicated: false, reason: msg };
  }
}

function safeJson(s: string): Record<string, any> | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
