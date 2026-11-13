import { afterEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";

const dbs: PGlite[] = [];
afterEach(async () => {
  await Promise.all(dbs.splice(0).map((db) => db.close()));
});

async function database() {
  const db = new PGlite();
  dbs.push(db);
  await db.exec(`
    CREATE TABLE payment_event_queue (
      id text PRIMARY KEY,
      status text NOT NULL DEFAULT 'pending',
      locked boolean NOT NULL DEFAULT false,
      retry_count integer NOT NULL DEFAULT 0,
      updated_at timestamptz NOT NULL
    );
    INSERT INTO payment_event_queue (id, updated_at)
      VALUES ('q-1', '2026-11-13T12:00:00Z');
    CREATE TABLE financial_ledger (
      id text PRIMARY KEY,
      provider text NOT NULL,
      reference_type text,
      reference_id text,
      transaction_type text NOT NULL,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    );
    CREATE UNIQUE INDEX financial_ledger_mp_idempotency_uidx
      ON financial_ledger (provider, reference_type, reference_id, transaction_type)
      WHERE provider = 'mercado_pago'
        AND reference_type IS NOT NULL AND reference_id IS NOT NULL
        AND metadata ? 'ledger_idempotency_key';
  `);
  return db;
}

describe("MP webhook retry PostgreSQL lease and ledger identity", () => {
  it("prevents two claimants from owning the same queue row", async () => {
    const db = await database();
    const sql = `
      UPDATE payment_event_queue
      SET locked = true, updated_at = '2026-11-13T12:01:00Z'
      WHERE id = 'q-1' AND status = 'pending' AND locked = false AND retry_count = 0
      RETURNING id
    `;
    expect((await db.query(sql)).rows).toHaveLength(1);
    expect((await db.query(sql)).rows).toHaveLength(0);
  });

  it("fences an old worker after a stale lease has been reclaimed", async () => {
    const db = await database();
    await db.exec(`
      UPDATE payment_event_queue SET locked=true, updated_at='2026-11-13T12:01:00Z'
      WHERE id='q-1';
      UPDATE payment_event_queue SET locked=false, updated_at='2026-11-13T12:11:00Z'
      WHERE id='q-1' AND locked=true AND updated_at='2026-11-13T12:01:00Z';
      UPDATE payment_event_queue SET locked=true, updated_at='2026-11-13T12:12:00Z'
      WHERE id='q-1' AND locked=false;
    `);
    const former = await db.query(`
      UPDATE payment_event_queue SET status='completed', locked=false
      WHERE id='q-1' AND locked=true AND retry_count=0
        AND updated_at='2026-11-13T12:01:00Z' RETURNING id
    `);
    expect(former.rows).toHaveLength(0);
    const owner = await db.query(`
      UPDATE payment_event_queue SET status='completed', locked=false
      WHERE id='q-1' AND locked=true AND retry_count=0
        AND updated_at='2026-11-13T12:12:00Z' RETURNING id
    `);
    expect(owner.rows).toHaveLength(1);
  });

  it("enforces unique completed payment identity at PostgreSQL level", async () => {
    const db = await database();
    const a = `INSERT INTO financial_ledger
      (id, provider,reference_type,reference_id,transaction_type,metadata)
      VALUES ('one','mercado_pago','mp_payment','mp-100','PAYMENT_APPROVED',
        '{"ledger_idempotency_key":"mp_payment:mp-100:PAYMENT_APPROVED"}')`;
    await db.exec(a);
    await expect(db.exec(a.replace("'one'", "'two'"))).rejects.toThrow();
    const rows = await db.query("SELECT id FROM financial_ledger");
    expect(rows.rows).toHaveLength(1);
  });
});
