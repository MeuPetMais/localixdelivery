/**
 * ReconciliationService
 *
 * Compares Mercado Pago gateway data against internal Localix records
 * (PricingEngine snapshot, order_payment, financial_ledger).
 *
 * READ-ONLY: never mutates Ledger, Snapshot, PaymentIntent, PaymentService,
 * OrderService, PricingEngine or WebhookService state. It only inserts rows
 * into payment_reconciliation.
 */

export type ReconciliationStatus =
  | 'PENDING'
  | 'MATCHED'
  | 'DIVERGENT'
  | 'FAILED'
  | 'MANUAL_REVIEW';

export interface GatewayPayment {
  id: string | number;
  external_reference?: string | null;
  transaction_amount: number;
  currency_id?: string | null;
  fee_details?: Array<{ type?: string; amount: number }> | null;
  net_received_amount?: number | null;
  status?: string | null;
}

export interface InternalSnapshot {
  order_id: string;
  expected_total: number;
  platform_fee: number;
  restaurant_amount: number;
  localix_amount: number;
  currency?: string | null;
}

export interface ReconciliationInput {
  gateway: GatewayPayment | null;
  snapshot: InternalSnapshot | null;
}

export interface ReconciliationResult {
  order_id: string | null;
  payment_id: string | null;
  provider: 'mercadopago';
  external_reference: string | null;
  gateway_gross_amount: number | null;
  gateway_fee: number | null;
  platform_fee: number | null;
  restaurant_amount: number | null;
  localix_amount: number | null;
  expected_total: number | null;
  received_total: number | null;
  difference_amount: number | null;
  currency: string;
  status: ReconciliationStatus;
  reconciled: boolean;
  reason?: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const EPSILON = 0.01;

function sumFees(fees?: GatewayPayment['fee_details']): number {
  if (!fees || !Array.isArray(fees)) return 0;
  return round2(fees.reduce((acc, f) => acc + (Number(f?.amount) || 0), 0));
}

/**
 * Pure reconciliation logic. No I/O. Deterministic.
 */
export function reconcile(input: ReconciliationInput): ReconciliationResult {
  const { gateway, snapshot } = input;

  if (!gateway && !snapshot) {
    return baseResult({
      status: 'FAILED',
      reason: 'no_data',
    });
  }

  if (!snapshot) {
    return {
      ...baseResult({ status: 'MANUAL_REVIEW', reason: 'order_not_found' }),
      payment_id: gateway ? String(gateway.id) : null,
      external_reference: gateway?.external_reference ?? null,
      gateway_gross_amount: gateway ? round2(gateway.transaction_amount) : null,
      gateway_fee: gateway ? sumFees(gateway.fee_details) : null,
      received_total:
        gateway?.net_received_amount != null
          ? round2(gateway.net_received_amount)
          : gateway
            ? round2(gateway.transaction_amount - sumFees(gateway.fee_details))
            : null,
      currency: gateway?.currency_id ?? 'BRL',
    };
  }

  if (!gateway) {
    return {
      ...baseResult({ status: 'PENDING', reason: 'gateway_missing' }),
      order_id: snapshot.order_id,
      expected_total: round2(snapshot.expected_total),
      platform_fee: round2(snapshot.platform_fee),
      restaurant_amount: round2(snapshot.restaurant_amount),
      localix_amount: round2(snapshot.localix_amount),
      currency: snapshot.currency ?? 'BRL',
    };
  }

  const gatewayGross = round2(gateway.transaction_amount);
  const gatewayFee = sumFees(gateway.fee_details);
  const receivedTotal =
    gateway.net_received_amount != null
      ? round2(gateway.net_received_amount)
      : round2(gatewayGross - gatewayFee);
  const expected = round2(snapshot.expected_total);
  const diff = round2(gatewayGross - expected);
  const status: ReconciliationStatus =
    Math.abs(diff) < EPSILON ? 'MATCHED' : 'DIVERGENT';

  return {
    order_id: snapshot.order_id,
    payment_id: String(gateway.id),
    provider: 'mercadopago',
    external_reference: gateway.external_reference ?? snapshot.order_id,
    gateway_gross_amount: gatewayGross,
    gateway_fee: gatewayFee,
    platform_fee: round2(snapshot.platform_fee),
    restaurant_amount: round2(snapshot.restaurant_amount),
    localix_amount: round2(snapshot.localix_amount),
    expected_total: expected,
    received_total: receivedTotal,
    difference_amount: diff,
    currency: gateway.currency_id ?? snapshot.currency ?? 'BRL',
    status,
    reconciled: status === 'MATCHED',
    reason: status === 'MATCHED' ? undefined : 'amount_mismatch',
  };
}

function baseResult(opts: {
  status: ReconciliationStatus;
  reason?: string;
}): ReconciliationResult {
  return {
    order_id: null,
    payment_id: null,
    provider: 'mercadopago',
    external_reference: null,
    gateway_gross_amount: null,
    gateway_fee: null,
    platform_fee: null,
    restaurant_amount: null,
    localix_amount: null,
    expected_total: null,
    received_total: null,
    difference_amount: null,
    currency: 'BRL',
    status: opts.status,
    reconciled: false,
    reason: opts.reason,
  };
}

export interface ReconciliationSummary {
  total: number;
  matched: number;
  divergent: number;
  pending: number;
  manual_review: number;
  failed: number;
  total_difference: number;
}

export function summarize(rows: ReconciliationResult[]): ReconciliationSummary {
  const s: ReconciliationSummary = {
    total: rows.length,
    matched: 0,
    divergent: 0,
    pending: 0,
    manual_review: 0,
    failed: 0,
    total_difference: 0,
  };
  for (const r of rows) {
    if (r.status === 'MATCHED') s.matched++;
    else if (r.status === 'DIVERGENT') s.divergent++;
    else if (r.status === 'PENDING') s.pending++;
    else if (r.status === 'MANUAL_REVIEW') s.manual_review++;
    else if (r.status === 'FAILED') s.failed++;
    s.total_difference = round2(s.total_difference + (r.difference_amount ?? 0));
  }
  return s;
}
