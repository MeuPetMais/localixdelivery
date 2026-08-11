export type MercadoPagoSplitStatus = "PROCESSING" | "COMPLETED" | "FAILED" | "MANUAL_REVIEW";

export class MercadoPagoSplitError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "MercadoPagoSplitError";
  }
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function validateMpSplitAmounts(params: {
  transactionAmount: number;
  platformFee: number;
}): { transactionAmount: number; platformFee: number; feeForGateway: number | null } {
  const transactionAmount = roundMoney(Number(params.transactionAmount));
  const platformFee = roundMoney(Number(params.platformFee));

  if (!Number.isFinite(transactionAmount) || transactionAmount <= 0) {
    throw new MercadoPagoSplitError("invalid_transaction_amount");
  }
  if (!Number.isFinite(platformFee) || platformFee < 0) {
    throw new MercadoPagoSplitError("invalid_platform_fee");
  }
  if (platformFee >= transactionAmount) {
    throw new MercadoPagoSplitError("platform_fee_greater_or_equal_total");
  }

  return {
    transactionAmount,
    platformFee,
    feeForGateway: platformFee > 0 ? platformFee : null,
  };
}

export function buildMpIdempotencyKey(params: {
  orderId: string;
  paymentMethod: "pix" | "checkout_pro";
}): string {
  if (!params.orderId) throw new MercadoPagoSplitError("order_id_required");
  return `localix-mp-${params.paymentMethod}-${params.orderId}`;
}

export function assertSnapshotBelongsToRestaurant(params: {
  orderRestaurantId: string | null | undefined;
  snapshotRestaurantId: string | null | undefined;
}): true {
  if (!params.orderRestaurantId || !params.snapshotRestaurantId || params.orderRestaurantId !== params.snapshotRestaurantId) {
    throw new MercadoPagoSplitError("pricing_snapshot_restaurant_mismatch");
  }
  return true;
}

export function buildCheckoutProSplitPayload(params: {
  orderId: string;
  transactionAmount: number;
  platformFee: number;
}): { marketplace_fee?: number; external_reference: string } {
  const amounts = validateMpSplitAmounts(params);
  return {
    external_reference: params.orderId,
    ...(amounts.feeForGateway === null ? {} : { marketplace_fee: amounts.feeForGateway }),
  };
}

export function buildPixSplitPayload(params: {
  orderId: string;
  transactionAmount: number;
  platformFee: number;
}): { transaction_amount: number; application_fee?: number; external_reference: string } {
  const amounts = validateMpSplitAmounts(params);
  return {
    transaction_amount: amounts.transactionAmount,
    external_reference: params.orderId,
    ...(amounts.feeForGateway === null ? {} : { application_fee: amounts.feeForGateway }),
  };
}

export type MpMarketplaceFeeExtraction =
  | { ok: true; amount: number; source: string }
  | { ok: false; reason: "missing" | "invalid" };

export type MpRefundReversal =
  | {
      ok: true;
      reversalStatus: "NONE" | "PARTIAL" | "FULL";
      refundedAmount: number;
      reversedPlatformFee: number;
      realizedPlatformRevenue: number;
    }
  | { ok: false; reason: "refund_amount_missing" | "invalid_refund_amount" | "invalid_transaction_amount" };

export function extractMpMarketplaceFee(payment: Record<string, unknown>): MpMarketplaceFeeExtraction {
  const direct = payment.marketplace_fee ?? payment.application_fee;
  if (direct !== undefined && direct !== null) {
    const amount = roundMoney(Number(direct));
    return Number.isFinite(amount) ? { ok: true, amount, source: direct === payment.marketplace_fee ? "marketplace_fee" : "application_fee" } : { ok: false, reason: "invalid" };
  }

  const feeDetails = Array.isArray(payment.fee_details) ? payment.fee_details : [];
  const marketplaceDetail = feeDetails.find((detail) => {
    const type = String((detail as { type?: unknown }).type ?? "").toLowerCase();
    const name = String((detail as { name?: unknown }).name ?? "").toLowerCase();
    return type.includes("marketplace") || type.includes("application") || name.includes("marketplace") || name.includes("application");
  }) as { amount?: unknown; type?: unknown; name?: unknown } | undefined;

  if (!marketplaceDetail) return { ok: false, reason: "missing" };
  const amount = roundMoney(Number(marketplaceDetail.amount));
  if (!Number.isFinite(amount)) return { ok: false, reason: "invalid" };
  return { ok: true, amount, source: String(marketplaceDetail.type ?? marketplaceDetail.name ?? "fee_details") };
}

export function reconcileMpMarketplaceFee(params: {
  expectedPlatformFee: number;
  payment: Record<string, unknown>;
}): {
  status: Extract<MercadoPagoSplitStatus, "COMPLETED" | "MANUAL_REVIEW">;
  expectedPlatformFee: number;
  realizedPlatformFee: number | null;
  reason: string | null;
  source: string | null;
} {
  const expectedPlatformFee = roundMoney(Number(params.expectedPlatformFee));
  if (!Number.isFinite(expectedPlatformFee) || expectedPlatformFee < 0) {
    throw new MercadoPagoSplitError("invalid_platform_fee");
  }
  if (expectedPlatformFee === 0) {
    return { status: "COMPLETED", expectedPlatformFee, realizedPlatformFee: 0, reason: null, source: "zero_expected" };
  }

  const extracted = extractMpMarketplaceFee(params.payment);
  if (!extracted.ok) {
    return {
      status: "MANUAL_REVIEW",
      expectedPlatformFee,
      realizedPlatformFee: null,
      reason: `marketplace_fee_${extracted.reason}`,
      source: null,
    };
  }

  const matches = Math.abs(extracted.amount - expectedPlatformFee) <= 0.01;
  return {
    status: matches ? "COMPLETED" : "MANUAL_REVIEW",
    expectedPlatformFee,
    realizedPlatformFee: extracted.amount,
    reason: matches ? null : "marketplace_fee_divergent",
    source: extracted.source,
  };
}

export function splitStatusForGatewayPayment(status: string): MercadoPagoSplitStatus {
  const normalized = status.toUpperCase();
  if (normalized === "PENDING" || normalized === "PROCESSING") return "PROCESSING";
  if (normalized === "REJECTED" || normalized === "CANCELLED" || normalized === "EXPIRED") return "FAILED";
  if (normalized === "APPROVED") return "PROCESSING";
  return "MANUAL_REVIEW";
}

export function extractMpRefundedAmount(payment: Record<string, unknown>): number | null {
  const refunds = Array.isArray(payment.refunds) ? payment.refunds : null;
  if (refunds) {
    const total = refunds.reduce((sum, refund) => {
      const amount = Number((refund as { amount?: unknown }).amount ?? 0);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
    return roundMoney(total);
  }

  const transactionDetailsRefunded = (payment.transaction_details as { refunded_amount?: unknown } | undefined)?.refunded_amount;
  const refundedAmount = Number(payment.refunded_amount ?? transactionDetailsRefunded);
  return Number.isFinite(refundedAmount) && refundedAmount > 0 ? roundMoney(refundedAmount) : null;
}

export function reconcileRefundReversal(params: {
  paymentStatus: string;
  paymentStatusDetail?: string | null;
  transactionAmount: number;
  expectedPlatformFee: number;
  payment: Record<string, unknown>;
}): MpRefundReversal {
  const transactionAmount = roundMoney(Number(params.transactionAmount));
  const expectedPlatformFee = roundMoney(Number(params.expectedPlatformFee));
  if (!Number.isFinite(transactionAmount) || transactionAmount <= 0) return { ok: false, reason: "invalid_transaction_amount" };
  if (!Number.isFinite(expectedPlatformFee) || expectedPlatformFee < 0) return { ok: false, reason: "invalid_refund_amount" };

  const status = params.paymentStatus.toLowerCase();
  const detail = String(params.paymentStatusDetail ?? "").toLowerCase();
  const isFullRefund = status === "refunded";
  const isPartialRefund = detail === "partially_refunded" || status === "partially_refunded";

  if (!isFullRefund && !isPartialRefund) {
    return {
      ok: true,
      reversalStatus: "NONE",
      refundedAmount: 0,
      reversedPlatformFee: 0,
      realizedPlatformRevenue: expectedPlatformFee,
    };
  }

  const refundedAmount = isFullRefund ? transactionAmount : extractMpRefundedAmount(params.payment);
  if (refundedAmount == null) return { ok: false, reason: "refund_amount_missing" };
  if (!Number.isFinite(refundedAmount) || refundedAmount < 0 || refundedAmount > transactionAmount) {
    return { ok: false, reason: "invalid_refund_amount" };
  }

  const refundRatio = Math.min(1, refundedAmount / transactionAmount);
  const reversedPlatformFee = roundMoney(expectedPlatformFee * refundRatio);
  const realizedPlatformRevenue = Math.max(0, roundMoney(expectedPlatformFee - reversedPlatformFee));
  return {
    ok: true,
    reversalStatus: refundedAmount >= transactionAmount ? "FULL" : "PARTIAL",
    refundedAmount,
    reversedPlatformFee,
    realizedPlatformRevenue,
  };
}

export function validateRefundRequest(params: {
  paymentStatus: string;
  transactionAmount: number;
  alreadyRefundedAmount: number;
  requestedAmount?: number | null;
}): { refundAmount: number; full: boolean; refundableAmount: number } {
  const transactionAmount = roundMoney(Number(params.transactionAmount));
  const alreadyRefundedAmount = roundMoney(Number(params.alreadyRefundedAmount));
  if (!Number.isFinite(transactionAmount) || transactionAmount <= 0) {
    throw new MercadoPagoSplitError("invalid_transaction_amount");
  }
  if (!Number.isFinite(alreadyRefundedAmount) || alreadyRefundedAmount < 0 || alreadyRefundedAmount > transactionAmount) {
    throw new MercadoPagoSplitError("invalid_refunded_amount");
  }
  if (params.paymentStatus.toLowerCase() !== "approved") {
    throw new MercadoPagoSplitError("invalid_payment_status_to_refund");
  }

  const refundableAmount = roundMoney(transactionAmount - alreadyRefundedAmount);
  const full = params.requestedAmount === undefined || params.requestedAmount === null;
  const refundAmount = full ? refundableAmount : roundMoney(Number(params.requestedAmount));
  if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
    throw new MercadoPagoSplitError("invalid_refund_amount");
  }
  if (refundAmount > refundableAmount) {
    throw new MercadoPagoSplitError("refund_amount_exceeds");
  }
  return { refundAmount, full: full || refundAmount === refundableAmount, refundableAmount };
}

export function buildMpRefundIdempotencyKey(params: {
  paymentId: string;
  refundAmount: number;
  alreadyRefundedAmount: number;
}): string {
  if (!params.paymentId) throw new MercadoPagoSplitError("payment_id_required");
  return `localix-mp-refund-${params.paymentId}-${roundMoney(params.alreadyRefundedAmount)}-${roundMoney(params.refundAmount)}`;
}
