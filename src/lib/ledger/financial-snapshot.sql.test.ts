import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFinancialSnapshot } from "./financial-statement-pagination";

const restaurant = "11111111-1111-4111-8111-111111111111";
const owner = "22222222-2222-4222-8222-222222222222";
const other = "33333333-3333-4333-8333-333333333333";
const migrations = new URL("../../../supabase/migrations/", import.meta.url);
const migration = readFileSync(
  new URL(
    readdirSync(migrations).find((file) =>
      file.endsWith("_gate4_consistent_financial_snapshot.sql"),
    )!,
    migrations,
  ),
  "utf8",
);
let db: PGlite;
beforeAll(async () => {
  db = await PGlite.create();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('test.user',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated,anon;
    CREATE TABLE public.restaurants(id uuid PRIMARY KEY,owner_id uuid);
    CREATE TABLE public.orders(id uuid PRIMARY KEY);
    GRANT SELECT ON public.restaurants TO authenticated;
    CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql STABLE AS
      $$ SELECT coalesce(current_setting('test.admin',true),'false') = 'true' $$;
    CREATE FUNCTION public.tg_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS
      $$ BEGIN RETURN NEW; END $$;
    INSERT INTO public.restaurants VALUES ('${restaurant}','${owner}'),('${other}','${other}');
  `);
  await db.exec(
    readFileSync(
      new URL("20260702232952_2822826e-0fbe-4ffc-a4e4-56badba019fd.sql", migrations),
      "utf8",
    ),
  );
  await db.exec(migration);
  await db.exec(`INSERT INTO public.financial_ledger(restaurant_id,transaction_type,amount,status,created_at)
    SELECT '${restaurant}','PAYMENT_APPROVED',1,'COMPLETED','2026-11-01'::timestamptz + i*interval '1 second'
    FROM generate_series(1,12001) i;
    INSERT INTO public.financial_ledger(restaurant_id,transaction_type,amount,status) VALUES('${other}','PAYMENT_APPROVED',999,'COMPLETED');
    SET ROLE authenticated; SET "test.user"='${owner}'; SET "test.admin"='false';`);
}, 60_000);
afterAll(async () => {
  await db?.close();
});
async function snapshot(tenant = restaurant) {
  const result = await db.query<{ payload: unknown }>(
    "SELECT public.get_restaurant_financial_snapshot($1::uuid) AS payload",
    [tenant],
  );
  return readFinancialSnapshot(async () => result.rows[0].payload, tenant);
}
describe("actual PostgreSQL snapshot function with original ledger RLS", () => {
  it("returns more than 10,000 entries as one scalar with exact completeness metadata", async () => {
    const result = await snapshot();
    expect(result.row_count).toBe(12001);
    expect(result.entries).toHaveLength(12001);
  });
  it("does not expose a different tenant even with a valid authenticated role", async () => {
    expect((await snapshot(other)).entries).toEqual([]);
  });
  it("preserves a snapshot while a write occurs inside the same SQL command", async () => {
    await db.exec("RESET ROLE");
    const result = await db.query<{ payload: unknown }>(`WITH inserted AS (
      INSERT INTO public.financial_ledger(restaurant_id,transaction_type,amount,status,created_at)
      VALUES('${restaurant}','PAYMENT_APPROVED',7,'COMPLETED','2020-01-01') RETURNING id
    ) SELECT public.get_restaurant_financial_snapshot('${restaurant}') AS payload FROM inserted`);
    const during = await readFinancialSnapshot(async () => result.rows[0].payload, restaurant);
    expect(during.row_count).toBe(12001);
    await db.exec("SET ROLE authenticated");
    expect((await snapshot()).row_count).toBe(12002);
    expect(during.entries).toHaveLength(12001);
  });
  it("honors the existing admin policy and still scopes the requested restaurant", async () => {
    await db.exec(`SET "test.user"='${other}'; SET "test.admin"='true'`);
    expect((await snapshot()).row_count).toBe(12002);
    expect((await snapshot(other)).entries).toHaveLength(1);
    await db.exec(`SET "test.user"='${owner}'; SET "test.admin"='false'`);
  });
  it("denies anonymous execution and authenticated direct ledger writes", async () => {
    await db.exec("SET ROLE anon");
    await expect(snapshot()).rejects.toThrow("permission denied");
    await db.exec("SET ROLE authenticated");
    await expect(
      db.exec(
        `INSERT INTO public.financial_ledger(restaurant_id,transaction_type,amount) VALUES('${restaurant}','ADJUSTMENT',999)`,
      ),
    ).rejects.toThrow();
  });
});
