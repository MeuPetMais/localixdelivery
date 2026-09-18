export type MpPaymentLike = {
  id?: string | number | null;
  status?: string | null;
  transaction_amount?: string | number | null;
  currency_id?: string | null;
  external_reference?: string | null;
  collector_id?: string | number | null;
  collector?: { id?: string | number | null } | null;
};

export type OrderLike = {
  id?: string | null;
  restaurant_id?: string | null;
};

export type OrderPaymentLike = {
  order_id?: string | null;
  restaurant_id?: string | null;
  payment_id?: string | number | null;
  transaction_amount?: string | number | null;
};

export type SnapshotLike = {
  order_id?: string | null;
  customer_total?: string | number | null;
  currency?: string | null;
};

export type RestaurantLike = {
  id?: string | null;
};

export type MercadoPagoAccountLike = {
  restaurant_id?: string | null;
  mp_user_id?: string | number | null;
  connected?: boolean | null;
};

export type TrustedMpContext = {
  resourceId: string;
  mp: MpPaymentLike | null;
  order: OrderLike | null;
  orderPayment: OrderPaymentLike | null;
  snapshot: SnapshotLike | null;
  restaurant: RestaurantLike | null;
  account: MercadoPagoAccountLike | null;
};

export type TrustBoundaryResult =
  | {
      ok: true;
      orderId: string;
      restaurantId: string;
      amount: number;
      currency: "BRL";
      sellerId: string;
    }
  | { ok: false; reason: string };

const KNOWN_MP_STATUSES = new Set([
  "approved",
  "pending",
  "in_process",
  "rejected",
  "cancelled",
  "refunded",
  "charged_back",
  "expired",
]);

export function money2(value: unknown): string | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n.toFixed(2);
}

export function readMpSellerId(mp: MpPaymentLike | null): string | null {
  const raw = mp?.collector_id ?? mp?.collector?.id ?? null;
  const sellerId = String(raw ?? "").trim();
  return sellerId.length > 0 ? sellerId : null;
}

function nonEmpty(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

export function validateTrustedMpPaymentContext(input: TrustedMpContext): TrustBoundaryResult {
  const resourceId = nonEmpty(input.resourceId);
  if (!resourceId) return { ok: false, reason: "missing_resource_id" };

  if (!input.mp) return { ok: false, reason: "mp_payment_not_found" };
  if (String(input.mp.id ?? "") !== resourceId) return { ok: false, reason: "mp_id_mismatch" };

  const mpExternalReference = nonEmpty(input.mp.external_reference);
  if (!mpExternalReference) return { ok: false, reason: "missing_mp_external_reference" };

  if (!input.order?.id || !input.order.restaurant_id)
    return { ok: false, reason: "order_not_found" };
  if (input.order.id !== mpExternalReference)
    return { ok: false, reason: "mp_external_reference_mismatch" };

  if (!input.orderPayment?.order_id) return { ok: false, reason: "order_payment_not_found" };
  if (input.orderPayment.order_id !== input.order.id)
    return { ok: false, reason: "order_payment_order_mismatch" };
  if (input.orderPayment.restaurant_id !== input.order.restaurant_id) {
    return { ok: false, reason: "order_payment_restaurant_mismatch" };
  }
  const persistedPaymentId = nonEmpty(input.orderPayment.payment_id);
  if (persistedPaymentId && persistedPaymentId !== String(input.mp.id)) {
    return { ok: false, reason: "order_payment_payment_id_mismatch" };
  }

  if (!input.snapshot?.order_id) return { ok: false, reason: "snapshot_not_found" };
  if (input.snapshot.order_id !== input.order.id)
    return { ok: false, reason: "snapshot_order_mismatch" };

  if (!input.restaurant?.id) return { ok: false, reason: "restaurant_not_found" };
  if (input.restaurant.id !== input.order.restaurant_id)
    return { ok: false, reason: "restaurant_order_mismatch" };

  if (!input.account?.restaurant_id || !input.account.connected)
    return { ok: false, reason: "mp_account_not_found" };
  if (input.account.restaurant_id !== input.order.restaurant_id)
    return { ok: false, reason: "mp_account_restaurant_mismatch" };
  const accountSellerId = nonEmpty(input.account.mp_user_id);
  if (!accountSellerId) return { ok: false, reason: "mp_account_missing_user_id" };
  const paymentSellerId = readMpSellerId(input.mp);
  if (!paymentSellerId) return { ok: false, reason: "mp_payment_missing_collector_id" };
  if (paymentSellerId !== accountSellerId) return { ok: false, reason: "mp_seller_mismatch" };

  const expectedAmount = money2(input.snapshot.customer_total);
  const receivedAmount = money2(input.mp.transaction_amount);
  if (!expectedAmount || !receivedAmount) return { ok: false, reason: "invalid_amount" };
  if (receivedAmount !== expectedAmount) return { ok: false, reason: "amount_mismatch" };

  const expectedCurrency = nonEmpty(input.snapshot.currency) ?? "BRL";
  if (expectedCurrency !== "BRL") return { ok: false, reason: "unsupported_currency" };
  if (input.mp.currency_id !== expectedCurrency) return { ok: false, reason: "currency_mismatch" };

  const status = String(input.mp.status ?? "").toLowerCase();
  if (!KNOWN_MP_STATUSES.has(status)) return { ok: false, reason: "invalid_mp_status" };

  return {
    ok: true,
    orderId: input.order.id,
    restaurantId: input.order.restaurant_id,
    amount: Number(receivedAmount),
    currency: "BRL",
    sellerId: paymentSellerId,
  };
}
