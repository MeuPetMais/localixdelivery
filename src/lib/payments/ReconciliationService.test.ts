import { describe, it, expect } from 'vitest';
import {
  reconcile,
  summarize,
  type GatewayPayment,
  type InternalSnapshot,
} from './ReconciliationService';

const snap = (over: Partial<InternalSnapshot> = {}): InternalSnapshot => ({
  order_id: 'ord-1',
  expected_total: 100,
  platform_fee: 5.99,
  restaurant_amount: 94.01,
  localix_amount: 5.99,
  currency: 'BRL',
  ...over,
});

const gw = (over: Partial<GatewayPayment> = {}): GatewayPayment => ({
  id: 'mp-123',
  external_reference: 'ord-1',
  transaction_amount: 100,
  currency_id: 'BRL',
  fee_details: [{ type: 'mercadopago_fee', amount: 4.99 }],
  net_received_amount: 95.01,
  status: 'approved',
  ...over,
});

describe('ReconciliationService', () => {
  it('marks MATCHED when gateway equals expected', () => {
    const r = reconcile({ gateway: gw(), snapshot: snap() });
    expect(r.status).toBe('MATCHED');
    expect(r.reconciled).toBe(true);
    expect(r.difference_amount).toBe(0);
    expect(r.gateway_fee).toBe(4.99);
  });

  it('marks DIVERGENT when values differ', () => {
    const r = reconcile({
      gateway: gw({ transaction_amount: 90 }),
      snapshot: snap(),
    });
    expect(r.status).toBe('DIVERGENT');
    expect(r.reconciled).toBe(false);
    expect(r.difference_amount).toBe(-10);
  });

  it('marks MANUAL_REVIEW when order not found', () => {
    const r = reconcile({ gateway: gw(), snapshot: null });
    expect(r.status).toBe('MANUAL_REVIEW');
    expect(r.payment_id).toBe('mp-123');
  });

  it('marks PENDING when gateway data missing', () => {
    const r = reconcile({ gateway: null, snapshot: snap() });
    expect(r.status).toBe('PENDING');
    expect(r.order_id).toBe('ord-1');
  });

  it('marks FAILED when both sides missing', () => {
    const r = reconcile({ gateway: null, snapshot: null });
    expect(r.status).toBe('FAILED');
  });

  it('computes net when gateway does not provide it', () => {
    const r = reconcile({
      gateway: gw({ net_received_amount: null }),
      snapshot: snap(),
    });
    expect(r.received_total).toBe(95.01);
  });

  it('summarize aggregates counters', () => {
    const s = summarize([
      reconcile({ gateway: gw(), snapshot: snap() }),
      reconcile({
        gateway: gw({ transaction_amount: 90 }),
        snapshot: snap(),
      }),
      reconcile({ gateway: null, snapshot: snap() }),
    ]);
    expect(s.total).toBe(3);
    expect(s.matched).toBe(1);
    expect(s.divergent).toBe(1);
    expect(s.pending).toBe(1);
    expect(s.total_difference).toBe(-10);
  });
});
