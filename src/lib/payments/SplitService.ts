/**
 * SplitService
 *
 * Executa o Split de pagamentos MP entre restaurante e plataforma.
 * READ-ONLY em relação a: PricingEngine, Ledger, Snapshot, Checkout,
 * OrderService, PaymentIntent, WebhookService, ReconciliationService.
 * Grava apenas em payment_split.
 *
 * Pré-condições obrigatórias:
 *   - snapshot (order_pricing_snapshot) presente
 *   - reconciliation.status === 'MATCHED'
 *   - restaurante conectado (mercado_pago_accounts ativo, token válido)
 *   - payment aprovado
 */

export type SplitStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'MANUAL_REVIEW';

export interface SplitSnapshot {
  order_id: string;
  restaurant_id: string;
  restaurant_amount: number; // restaurant_net do snapshot
  platform_amount: number;   // platform_revenue do snapshot
  gateway_fee: number;
  currency?: string | null;
}

export interface MpAccountState {
  connected: boolean;
  active: boolean;
  token_valid: boolean;
  restaurant_id: string;
}

export interface ReconciliationState {
  status: 'PENDING' | 'MATCHED' | 'DIVERGENT' | 'FAILED' | 'MANUAL_REVIEW';
}

export interface PaymentState {
  payment_id: string | null;
  approved: boolean;
}

export interface SplitInput {
  snapshot: SplitSnapshot | null;
  account: MpAccountState | null;
  reconciliation: ReconciliationState | null;
  payment: PaymentState | null;
}

export interface SplitPlan {
  order_id: string | null;
  payment_id: string | null;
  restaurant_id: string | null;
  provider: 'mercadopago';
  restaurant_amount: number;
  platform_amount: number;
  gateway_fee: number;
  status: SplitStatus;
  reason?: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Valida pré-condições e retorna o plano de split. NÃO executa I/O.
 * Se OK → status PROCESSING (pronto para chamar MP).
 * Se pagamento divergente/conciliação pendente → MANUAL_REVIEW.
 * Se snapshot/pagamento/account faltando → FAILED (com reason).
 */
export function planSplit(input: SplitInput): SplitPlan {
  const { snapshot, account, reconciliation, payment } = input;

  const base = (status: SplitStatus, reason?: string): SplitPlan => ({
    order_id: snapshot?.order_id ?? null,
    payment_id: payment?.payment_id ?? null,
    restaurant_id: snapshot?.restaurant_id ?? account?.restaurant_id ?? null,
    provider: 'mercadopago',
    restaurant_amount: snapshot ? round2(snapshot.restaurant_amount) : 0,
    platform_amount: snapshot ? round2(snapshot.platform_amount) : 0,
    gateway_fee: snapshot ? round2(snapshot.gateway_fee) : 0,
    status,
    reason,
  });

  if (!snapshot) return base('FAILED', 'snapshot_missing');
  if (!payment || !payment.approved || !payment.payment_id) {
    return base('FAILED', 'payment_not_approved');
  }
  if (!account) return base('FAILED', 'account_not_connected');
  if (!account.connected || !account.active) {
    return base('FAILED', 'account_inactive');
  }
  if (!account.token_valid) return base('FAILED', 'token_invalid');

  if (!reconciliation) return base('MANUAL_REVIEW', 'reconciliation_missing');
  if (reconciliation.status === 'DIVERGENT') {
    return base('MANUAL_REVIEW', 'reconciliation_divergent');
  }
  if (reconciliation.status !== 'MATCHED') {
    return base('MANUAL_REVIEW', `reconciliation_${reconciliation.status.toLowerCase()}`);
  }

  if (snapshot.restaurant_amount < 0 || snapshot.platform_amount < 0) {
    return base('FAILED', 'invalid_amounts');
  }

  return base('PROCESSING');
}

/**
 * Marca o plano com o resultado do gateway. Puro.
 */
export function finalizeSplit(
  plan: SplitPlan,
  gatewayResult:
    | { ok: true; split_reference: string }
    | { ok: false; reason: string },
): SplitPlan {
  if (plan.status !== 'PROCESSING') return plan;
  if (gatewayResult.ok) {
    return { ...plan, status: 'COMPLETED', reason: undefined };
  }
  return { ...plan, status: 'FAILED', reason: gatewayResult.reason };
}

export interface SplitSummary {
  total: number;
  completed: number;
  pending: number;
  processing: number;
  failed: number;
  manual_review: number;
  volume_total: number;
  platform_total: number;
  restaurant_total: number;
}

export function summarize(rows: SplitPlan[]): SplitSummary {
  const s: SplitSummary = {
    total: rows.length,
    completed: 0,
    pending: 0,
    processing: 0,
    failed: 0,
    manual_review: 0,
    volume_total: 0,
    platform_total: 0,
    restaurant_total: 0,
  };
  for (const r of rows) {
    if (r.status === 'COMPLETED') s.completed++;
    else if (r.status === 'PENDING') s.pending++;
    else if (r.status === 'PROCESSING') s.processing++;
    else if (r.status === 'FAILED') s.failed++;
    else if (r.status === 'MANUAL_REVIEW') s.manual_review++;
    s.platform_total = round2(s.platform_total + r.platform_amount);
    s.restaurant_total = round2(s.restaurant_total + r.restaurant_amount);
    s.volume_total = round2(s.volume_total + r.platform_amount + r.restaurant_amount);
  }
  return s;
}
