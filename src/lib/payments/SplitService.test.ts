import { describe, it, expect } from 'vitest';
import {
  planSplit,
  finalizeSplit,
  summarize,
  type SplitInput,
} from './SplitService';

const base = (over: Partial<SplitInput> = {}): SplitInput => ({
  snapshot: {
    order_id: 'ord-1',
    restaurant_id: 'rest-1',
    restaurant_amount: 94.01,
    platform_amount: 5.99,
    gateway_fee: 4.99,
    currency: 'BRL',
  },
  account: {
    connected: true,
    active: true,
    token_valid: true,
    restaurant_id: 'rest-1',
  },
  reconciliation: { status: 'MATCHED' },
  payment: { payment_id: 'mp-1', approved: true },
  ...over,
});

describe('SplitService.planSplit', () => {
  it('aprovado → PROCESSING', () => {
    const p = planSplit(base());
    expect(p.status).toBe('PROCESSING');
    expect(p.restaurant_amount).toBe(94.01);
    expect(p.platform_amount).toBe(5.99);
  });

  it('sem snapshot → FAILED snapshot_missing', () => {
    const p = planSplit(base({ snapshot: null }));
    expect(p.status).toBe('FAILED');
    expect(p.reason).toBe('snapshot_missing');
  });

  it('pagamento não aprovado → FAILED', () => {
    const p = planSplit(base({ payment: { payment_id: 'mp-1', approved: false } }));
    expect(p.status).toBe('FAILED');
    expect(p.reason).toBe('payment_not_approved');
  });

  it('restaurante desconectado → FAILED', () => {
    const p = planSplit(base({ account: null }));
    expect(p.status).toBe('FAILED');
    expect(p.reason).toBe('account_not_connected');
  });

  it('conta inativa → FAILED', () => {
    const p = planSplit(
      base({
        account: {
          connected: true,
          active: false,
          token_valid: true,
          restaurant_id: 'rest-1',
        },
      }),
    );
    expect(p.reason).toBe('account_inactive');
  });

  it('token inválido → FAILED', () => {
    const p = planSplit(
      base({
        account: {
          connected: true,
          active: true,
          token_valid: false,
          restaurant_id: 'rest-1',
        },
      }),
    );
    expect(p.reason).toBe('token_invalid');
  });

  it('conciliação divergente → MANUAL_REVIEW', () => {
    const p = planSplit(base({ reconciliation: { status: 'DIVERGENT' } }));
    expect(p.status).toBe('MANUAL_REVIEW');
    expect(p.reason).toBe('reconciliation_divergent');
  });

  it('conciliação pendente → MANUAL_REVIEW', () => {
    const p = planSplit(base({ reconciliation: { status: 'PENDING' } }));
    expect(p.status).toBe('MANUAL_REVIEW');
  });

  it('conciliação ausente → MANUAL_REVIEW', () => {
    const p = planSplit(base({ reconciliation: null }));
    expect(p.status).toBe('MANUAL_REVIEW');
    expect(p.reason).toBe('reconciliation_missing');
  });
});

describe('SplitService.finalizeSplit', () => {
  it('gateway ok → COMPLETED', () => {
    const p = planSplit(base());
    const done = finalizeSplit(p, { ok: true, split_reference: 'mp-split-1' });
    expect(done.status).toBe('COMPLETED');
  });

  it('gateway falhou → FAILED', () => {
    const p = planSplit(base());
    const done = finalizeSplit(p, { ok: false, reason: 'gateway_unavailable' });
    expect(done.status).toBe('FAILED');
    expect(done.reason).toBe('gateway_unavailable');
  });

  it('mantém status não-PROCESSING', () => {
    const p = planSplit(base({ snapshot: null }));
    const done = finalizeSplit(p, { ok: true, split_reference: 'x' });
    expect(done.status).toBe('FAILED');
  });
});

describe('SplitService.summarize', () => {
  it('agrega totais por status', () => {
    const rows = [
      finalizeSplit(planSplit(base()), { ok: true, split_reference: 'a' }),
      finalizeSplit(planSplit(base()), { ok: false, reason: 'x' }),
      planSplit(base({ reconciliation: { status: 'DIVERGENT' } })),
    ];
    const s = summarize(rows);
    expect(s.total).toBe(3);
    expect(s.completed).toBe(1);
    expect(s.failed).toBe(1);
    expect(s.manual_review).toBe(1);
    expect(s.platform_total).toBe(round2(5.99 * 3));
    expect(s.restaurant_total).toBe(round2(94.01 * 3));
  });
});

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
