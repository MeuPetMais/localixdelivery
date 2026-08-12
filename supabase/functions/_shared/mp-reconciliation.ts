export type MpStatus = "approved" | "pending" | "in_process" | "rejected" | "cancelled" | "refunded" | "charged_back" | "expired";
export type LocalStatus = "PENDING" | "PROCESSING" | "APPROVED" | "REJECTED" | "CANCELLED" | "EXPIRED" | "REFUNDED" | "CHARGEBACK";

export type PricingSnapshot = {
  platform_fee: number;
  customer_total: number;
  restaurant_net: number;
  gateway_fee: number;
  service_fee_payer: string;
  realized_platform_revenue: number;
};

export type MercadoPagoSplitPlanRow = {
  order_id: string;
  payment_id: string | null;
  restaurant_id: string;
  provider: "mercadopago";
  restaurant_amount: number;
  platform_amount: number;
  gateway_fee: number;
  status: "PROCESSING" | "COMPLETED" | "FAILED" | "MANUAL_REVIEW";
  split_reference: string | null;
  error_message: string | null;
  processed_at?: string | null;
  metadata: Record<string, unknown>;
};

export type MercadoPagoSplitReconciliationPlan = {
  splitRow: MercadoPagoSplitPlanRow;
  realizedPlatformRevenueUpdate: number | null;
  ledgerReversal: {
    amount: number;
    referenceId: string;
    metadata: Record<string, unknown>;
  } | null;
};

export function mapMercadoPagoStatus(s: string | null | undefined): LocalStatus {
  switch ((s ?? "").toLowerCase() as MpStatus) {
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

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function extractMarketplaceFee(payment: Record<string, unknown>) {
  const direct = payment.marketplace_fee ?? payment.application_fee;
  if (direct !== undefined && direct !== null) {
    const amount = roundMoney(Number(direct));
    return Number.isFinite(amount)
      ? { ok: true as const, amount, source: direct === payment.marketplace_fee ? "marketplace_fee" : "application_fee" }
      : { ok: false as const, reason: "invalid" };
  }

  const feeDetails = Array.isArray(payment.fee_details) ? payment.fee_details : [];
  const detail = feeDetails.find((entry) => {
    const type = String((entry as { type?: unknown }).type ?? "").toLowerCase();
    const name = String((entry as { name?: unknown }).name ?? "").toLowerCase();
    return type.includes("marketplace") || type.includes("application") || name.includes("marketplace") || name.includes("application");
  }) as { amount?: unknown; type?: unknown; name?: unknown } | undefined;
  if (!detail) return { ok: false as const, reason: "missing" };
  const amount = roundMoney(Number(detail.amount));
  if (!Number.isFinite(amount)) return { ok: false as const, reason: "invalid" };
  return { ok: true as const, amount, source: String(detail.type ?? detail.name ?? "fee_details") };
}

function sumRefundedAmount(payment: Record<string, unknown>): number | null {
  const refunds = Array.isArray(payment.refunds) ? payment.refunds : null;
  if (refunds) {
    const total = refunds.reduce((sum, refund) => {
      const amount = Number((refund as { amount?: unknown }).amount ?? 0);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
    return roundMoney(total);
  }
  const transactionDetailsRefunded = (payment.transaction_details as { refunded_amount?: unknown } | undefined)?.refunded_amount;
  const direct = Number(payment.refunded_amount ?? transactionDetailsRefunded);
  return Number.isFinite(direct) && direct > 0 ? roundMoney(direct) : null;
}

function calculateRefundReversal(params: {
  localStatus: LocalStatus;
  paymentStatusDetail?: string | null;
  transactionAmount: number;
  expectedPlatformFee: number;
  payment: Record<string, unknown>;
}) {
  const statusDetail = String(params.paymentStatusDetail ?? "").toLowerCase();
  const isFullRefund = params.localStatus === "REFUNDED";
  const isPartialRefund = statusDetail === "partially_refunded";
  if (!isFullRefund && !isPartialRefund) return null;

  const transactionAmount = roundMoney(params.transactionAmount);
  if (!Number.isFinite(transactionAmount) || transactionAmount <= 0) {
    return { ok: false as const, reason: "invalid_transaction_amount" };
  }
  const refundedAmount = isFullRefund ? transactionAmount : sumRefundedAmount(params.payment);
  if (refundedAmount === null) return { ok: false as const, reason: "refund_amount_missing" };
  if (!Number.isFinite(refundedAmount) || refundedAmount < 0 || refundedAmount > transactionAmount) {
    return { ok: false as const, reason: "invalid_refund_amount" };
  }

  const ratio = Math.min(1, refundedAmount / transactionAmount);
  const reversedPlatformFee = roundMoney(params.expectedPlatformFee * ratio);
  return {
    ok: true as const,
    reversalStatus: refundedAmount >= transactionAmount ? "FULL" : "PARTIAL",
    refundedAmount,
    reversedPlatformFee,
    realizedPlatformRevenue: Math.max(0, roundMoney(params.expectedPlatformFee - reversedPlatformFee)),
  };
}

export function buildMercadoPagoSplitReconciliationPlan(params: {
  orderId: string;
  restaurantId: string;
  paymentId: string;
  localStatus: LocalStatus;
  payment: Record<string, unknown>;
  snapshot: PricingSnapshot | null;
  now?: string;
}): MercadoPagoSplitReconciliationPlan {
  const now = params.now ?? new Date().toISOString();

  if (!params.snapshot) {
    return {
      splitRow: {
        order_id: params.orderId,
        payment_id: params.paymentId,
        restaurant_id: params.restaurantId,
        provider: "mercadopago",
        restaurant_amount: 0,
        platform_amount: 0,
        gateway_fee: 0,
        status: "MANUAL_REVIEW",
        split_reference: `mp_payment:${params.paymentId}`,
        error_message: "pricing_snapshot_missing",
        metadata: {
          reason: "pricing_snapshot_missing",
          payment_id: params.paymentId,
          order_id: params.orderId,
          restaurant_id: params.restaurantId,
          checked_at: now,
        },
      },
      realizedPlatformRevenueUpdate: null,
      ledgerReversal: null,
    };
  }

  const snapshot = params.snapshot;
  const expectedPlatformFee = roundMoney(Number(snapshot.platform_fee ?? 0));
  const baseRow = {
    order_id: params.orderId,
    payment_id: params.paymentId,
    restaurant_id: params.restaurantId,
    provider: "mercadopago" as const,
    restaurant_amount: roundMoney(snapshot.restaurant_net),
    platform_amount: expectedPlatformFee,
    gateway_fee: roundMoney(snapshot.gateway_fee),
    split_reference: `mp_payment:${params.paymentId}`,
  };

  if (params.localStatus === "PENDING" || params.localStatus === "PROCESSING") {
    return {
      splitRow: {
        ...baseRow,
        status: "PROCESSING",
        error_message: null,
        processed_at: null,
        metadata: {
          gateway_status: params.payment.status ?? null,
          expected_platform_fee: expectedPlatformFee,
          service_fee_payer: snapshot.service_fee_payer,
        },
      },
      realizedPlatformRevenueUpdate: null,
      ledgerReversal: null,
    };
  }

  if (params.localStatus === "REJECTED" || params.localStatus === "CANCELLED" || params.localStatus === "EXPIRED") {
    return {
      splitRow: {
        ...baseRow,
        status: "FAILED",
        error_message: `payment_${params.localStatus.toLowerCase()}`,
        processed_at: now,
        metadata: {
          gateway_status: params.payment.status ?? null,
          expected_platform_fee: expectedPlatformFee,
          service_fee_payer: snapshot.service_fee_payer,
        },
      },
      realizedPlatformRevenueUpdate: null,
      ledgerReversal: null,
    };
  }

  if (params.localStatus === "CHARGEBACK") {
    return {
      splitRow: {
        ...baseRow,
        status: "MANUAL_REVIEW",
        error_message: "split_chargeback_reconciliation_required",
        processed_at: null,
        metadata: {
          gateway_status: params.payment.status ?? null,
          gateway_status_detail: params.payment.status_detail ?? null,
          expected_platform_fee: expectedPlatformFee,
          service_fee_payer: snapshot.service_fee_payer,
          reason: "chargeback_dispute_requires_manual_review",
        },
      },
      realizedPlatformRevenueUpdate: null,
      ledgerReversal: null,
    };
  }

  if (expectedPlatformFee < 0 || expectedPlatformFee >= roundMoney(snapshot.customer_total)) {
    return {
      splitRow: {
        ...baseRow,
        status: "MANUAL_REVIEW",
        error_message: "invalid_platform_fee",
        processed_at: null,
        metadata: {
          expected_platform_fee: expectedPlatformFee,
          customer_total: roundMoney(snapshot.customer_total),
          reason: "invalid_platform_fee",
        },
      },
      realizedPlatformRevenueUpdate: null,
      ledgerReversal: null,
    };
  }

  const refundReversal = calculateRefundReversal({
    localStatus: params.localStatus,
    paymentStatusDetail: String(params.payment.status_detail ?? ""),
    transactionAmount: roundMoney(snapshot.customer_total),
    expectedPlatformFee,
    payment: params.payment,
  });
  if (refundReversal) {
    if (!refundReversal.ok) {
      return {
        splitRow: {
          ...baseRow,
          status: "MANUAL_REVIEW",
          error_message: refundReversal.reason,
          processed_at: null,
          metadata: {
            expected_platform_fee: expectedPlatformFee,
            customer_total: roundMoney(snapshot.customer_total),
            service_fee_payer: snapshot.service_fee_payer,
            gateway_status: params.payment.status ?? null,
            gateway_status_detail: params.payment.status_detail ?? null,
            reason: refundReversal.reason,
          },
        },
        realizedPlatformRevenueUpdate: null,
        ledgerReversal: null,
      };
    }

    const previousRealized = roundMoney(Number(snapshot.realized_platform_revenue ?? 0));
    const nextRealized = refundReversal.realizedPlatformRevenue;
    const ledgerDelta = roundMoney(nextRealized - previousRealized);
    return {
      splitRow: {
        ...baseRow,
        status: "COMPLETED",
        error_message: null,
        processed_at: now,
        metadata: {
          expected_platform_fee: expectedPlatformFee,
          realized_platform_fee: nextRealized,
          reversed_platform_fee: refundReversal.reversedPlatformFee,
          refunded_amount: refundReversal.refundedAmount,
          reversal_status: refundReversal.reversalStatus,
          gateway_status: params.payment.status ?? null,
          gateway_status_detail: params.payment.status_detail ?? null,
          service_fee_payer: snapshot.service_fee_payer,
          checked_at: now,
        },
      },
      realizedPlatformRevenueUpdate: nextRealized,
      ledgerReversal: ledgerDelta < 0
        ? {
            amount: ledgerDelta,
            referenceId: `${params.paymentId}:${refundReversal.reversalStatus}:${refundReversal.refundedAmount}`,
            metadata: {
              payment_id: params.paymentId,
              order_id: params.orderId,
              restaurant_id: params.restaurantId,
              previous_realized_platform_revenue: previousRealized,
              realized_platform_revenue: nextRealized,
              reversed_platform_fee_delta: ledgerDelta,
              refund_reversal_status: refundReversal.reversalStatus,
            },
          }
        : null,
    };
  }

  const extraction = expectedPlatformFee === 0
    ? { ok: true as const, amount: 0, source: "zero_expected" }
    : extractMarketplaceFee(params.payment);
  const matches = extraction.ok && Math.abs(extraction.amount - expectedPlatformFee) <= 0.01;
  const status = matches ? "COMPLETED" : "MANUAL_REVIEW";
  const errorMessage = matches ? null : extraction.ok ? "marketplace_fee_divergent" : `marketplace_fee_${extraction.reason}`;

  return {
    splitRow: {
      ...baseRow,
      status,
      error_message: errorMessage,
      processed_at: matches ? now : null,
      metadata: {
        expected_platform_fee: expectedPlatformFee,
        realized_platform_fee: extraction.ok ? extraction.amount : null,
        marketplace_fee_source: extraction.ok ? extraction.source : null,
        payment_id: params.paymentId,
        order_id: params.orderId,
        restaurant_id: params.restaurantId,
        checked_at: now,
        reason: errorMessage,
      },
    },
    realizedPlatformRevenueUpdate: matches ? extraction.amount : null,
    ledgerReversal: null,
  };
}
