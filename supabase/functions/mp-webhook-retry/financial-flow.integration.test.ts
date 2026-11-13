import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import ts from "typescript";
import { recordMercadoPagoLedger } from "../mp-webhook/ledger-idempotency";
import { recordPaymentRefunds } from "../mp-webhook/refund-ledger";
import { recordChargebackLedger } from "../mp-webhook/chargeback-ledger";
import { validateTrustedMpPaymentContext } from "../mp-webhook/trust-boundary";
import {
  existingWebhookDelivery,
  shouldReplayExistingWebhook,
} from "../mp-webhook/webhook-event-retry";

const ORDER = "11111111-1111-4111-8111-111111111111";
const RESTAURANT = "22222222-2222-4222-8222-222222222222";
const PAYMENT = "synthetic-payment-1";
const SELLER = "synthetic-seller";
type Row = Record<string, unknown>;
type Table =
  | "payment_webhook_events"
  | "payment_event_queue"
  | "orders"
  | "order_payment"
  | "order_pricing_snapshot"
  | "restaurants"
  | "mercado_pago_accounts"
  | "payments"
  | "financial_ledger";
type State = Record<Table, Row[]>;
type Operation = { table: Table; kind: "upsert" | "insert" | "update" };

function createFixture(
  status: string,
  failTable?: Table,
  failCompletion = false,
  rejectTransition = false,
) {
  const eventBody: Row = {
    id: "synthetic-event-1",
    type: "payment",
    action: "payment.updated",
    data: { id: PAYMENT },
  };
  const mp: Row = {
    id: PAYMENT,
    status,
    transaction_amount: 50,
    currency_id: "BRL",
    external_reference: ORDER,
    collector_id: SELLER,
    payment_type_id: "account_money",
    refunds: status === "refunded" ? [{ id: "synthetic-refund-1", amount: 50 }] : [],
  };
  const state: State = {
    payment_webhook_events: [
      {
        id: "event-1",
        provider: "mercado_pago",
        event_id: "synthetic-event-1",
        processed: false,
        processing_attempts: 1,
        payload_json: eventBody,
        resource_id: PAYMENT,
      },
    ],
    payment_event_queue: [],
    orders: [{ id: ORDER, restaurant_id: RESTAURANT, status: "aguardando_pagamento" }],
    order_payment: [
      {
        id: "order-payment-1",
        order_id: ORDER,
        restaurant_id: RESTAURANT,
        provider: "mercado_pago",
        payment_id: PAYMENT,
        transaction_amount: 50,
      },
    ],
    order_pricing_snapshot: [{ order_id: ORDER, customer_total: 50, currency: "BRL" }],
    restaurants: [{ id: RESTAURANT }],
    mercado_pago_accounts: [{ restaurant_id: RESTAURANT, mp_user_id: SELLER, connected: true }],
    payments: [],
    financial_ledger: [],
  };
  const operations: Operation[] = [];
  const transitions: string[] = [];
  const client = {
    from(table: Table) {
      const filters: Array<[string, unknown]> = [];
      let kind: "read" | "upsert" | "insert" | "update" = "read";
      let patch: Row | null = null;
      let upsertConflict = "";
      let max = Infinity;
      const builder = {
        select: (_columns: string) => builder,
        eq: (key: string, value: unknown) => {
          filters.push([key, value]);
          return builder;
        },
        limit: (n: number) => {
          max = n;
          return builder;
        },
        upsert: (value: Row, options?: { onConflict?: string }) => {
          kind = "upsert";
          patch = value;
          upsertConflict = options?.onConflict ?? "";
          return builder;
        },
        insert: (value: Row) => {
          kind = "insert";
          patch = value;
          return builder;
        },
        update: (value: Row) => {
          kind = "update";
          patch = value;
          return builder;
        },
        maybeSingle: async () => {
          const r = execute();
          return { data: r.data?.[0] ?? null, error: r.error };
        },
        single: async () => {
          const r = execute();
          return { data: r.data?.[0] ?? null, error: r.error };
        },
        then: <T>(
          resolve: (value: {
            data: Row[] | null;
            error: { code?: string; message: string } | null;
          }) => T,
        ) => Promise.resolve(resolve(execute())),
      };
      function execute() {
        const matches = state[table]
          .filter((row) => filters.every(([key, value]) => row[key] === value))
          .slice(0, max);
        if (kind === "read") return { data: matches.map((row) => ({ ...row })), error: null };
        operations.push({ table, kind });
        if (table === failTable && (kind === "upsert" || kind === "insert")) {
          return { data: null, error: { message: "synthetic_persistence_failure" } };
        }
        if (
          table === "payment_webhook_events" &&
          kind === "update" &&
          patch?.processed === true &&
          failCompletion
        ) {
          return { data: null, error: { message: "synthetic_completion_failure" } };
        }
        if (kind === "insert") {
          if (
            table === "financial_ledger" &&
            state.financial_ledger.some(
              (row) =>
                row.provider === patch?.provider &&
                row.reference_type === patch?.reference_type &&
                row.reference_id === patch?.reference_id &&
                row.transaction_type === patch?.transaction_type &&
                Boolean((row.metadata as Row | undefined)?.ledger_idempotency_key) &&
                Boolean((patch?.metadata as Row | undefined)?.ledger_idempotency_key),
            )
          ) {
            return { data: null, error: { message: "duplicate", code: "23505" } };
          }
          state[table].push({ id: `synthetic-${table}-${state[table].length}`, ...patch });
          return { data: [state[table].at(-1)!], error: null };
        }
        if (kind === "upsert") {
          const keys = upsertConflict
            .split(",")
            .map((key) => key.trim())
            .filter(Boolean);
          const found = state[table].find((row) => keys.every((key) => row[key] === patch?.[key]));
          if (found) Object.assign(found, patch);
          else state[table].push({ id: `synthetic-${table}-${state[table].length}`, ...patch });
          return { data: [found ?? state[table].at(-1)!], error: null };
        }
        for (const row of matches) Object.assign(row, patch);
        return { data: matches, error: null };
      }
      return builder;
    },
  };
  const paymentsApi = vi.fn(async (url: string) => {
    if (url.includes("/v1/chargebacks/")) {
      return new Response(
        JSON.stringify({
          id: "synthetic-chargeback-1",
          payments: [PAYMENT],
          amount: 50,
          currency: "BRL",
        }),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify(mp), { status: 200 });
  });
  let handler: ((req: Request) => Promise<Response>) | undefined;
  const source = readFileSync(new URL("../mp-webhook/index.ts", import.meta.url), "utf8").replace(
    /^import[^;]+;\n/gm,
    "",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  runInNewContext(compiled, {
    Deno: {
      env: {
        get: (key: string) => (key === "MP_WEBHOOK_REPLAY_SECRET" ? "synthetic-replay" : undefined),
      },
      serve: (fn: (req: Request) => Promise<Response>) => {
        handler = fn;
      },
    },
    exports: {},
    createClient: () => client,
    corsHeaders: {},
    json: (body: unknown, init: ResponseInit = {}) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "content-type": "application/json" },
      }),
    decryptToken: async () => "synthetic",
    normalizeMpUserId: () => SELLER,
    resolveMercadoPagoWebhookToken: async () => ({
      ok: true,
      token: "synthetic",
      restaurantId: RESTAURANT,
      source: "synthetic",
    }),
    validateTrustedMpPaymentContext,
    transitionOrder: async (args: { to: string }) => {
      transitions.push(args.to);
      if (rejectTransition) return { ok: false, reason: "SYNTHETIC_TRANSITION_REJECTED" };
      state.orders[0].status = args.to;
      return { ok: true };
    },
    recordMercadoPagoLedger,
    recordPaymentRefunds,
    recordChargebackLedger,
    existingWebhookDelivery,
    shouldReplayExistingWebhook,
    fetch: paymentsApi,
    crypto,
    Response,
    URL,
    Date,
    TextEncoder,
    Uint8Array,
    console,
  });
  if (!handler) throw new Error("Receiver handler not registered");
  const invoke = () =>
    handler!(
      new Request(`https://synthetic.supabase.co/functions/v1/mp-webhook?data.id=${PAYMENT}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-localix-replay-secret": "synthetic-replay",
        },
        body: JSON.stringify(eventBody),
      }),
    );
  return { state, mp, eventBody, operations, transitions, paymentsApi, invoke };
}

describe("Gate 4 / Mercado Pago financial receiver with isolated gateway and database", () => {
  it("approved payment updates both payment views, order and exactly one ledger entry", async () => {
    const r = createFixture("approved");
    const res = await r.invoke();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, status: "APPROVED" });
    expect(r.state.order_payment[0].status).toBe("APPROVED");
    expect(r.state.payments).toHaveLength(1);
    expect(r.state.payments[0].status).toBe("approved");
    expect(r.transitions).toEqual(["pago"]);
    expect(r.state.financial_ledger).toHaveLength(1);
    expect(r.state.financial_ledger[0]).toMatchObject({
      transaction_type: "PAYMENT_APPROVED",
      amount: 50,
      currency: "BRL",
      reference_id: PAYMENT,
    });
    expect(r.state.payment_webhook_events[0].processed).toBe(true);
  });

  it("repeated approved payment does not create another ledger entry", async () => {
    const r = createFixture("approved");
    expect((await r.invoke()).status).toBe(200);
    const second = await r.invoke();
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ duplicated: true });
    expect(r.state.financial_ledger).toHaveLength(1);
  });

  it("refund is recorded once under a distinct refund reference", async () => {
    const r = createFixture("refunded");
    expect((await r.invoke()).status).toBe(200);
    expect(r.state.financial_ledger).toHaveLength(1);
    expect(r.state.financial_ledger[0]).toMatchObject({
      transaction_type: "REFUND",
      amount: 50,
      reference_id: `${PAYMENT}:refund:synthetic-refund-1`,
    });
    expect(r.transitions).toEqual(["reembolsado"]);
  });

  it("settled chargeback travels through receiver, order and one ledger entry", async () => {
    const r = createFixture("charged_back");
    r.mp.status_detail = "settled";
    r.eventBody.type = "topic_chargebacks_wh";
    r.eventBody.action = "chargebacks.updated";
    r.eventBody.data = { id: "synthetic-chargeback-1", payment_id: PAYMENT };
    const res = await r.invoke();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, status: "CHARGEBACK" });
    expect(r.transitions).toEqual(["chargeback"]);
    expect(r.state.financial_ledger).toHaveLength(1);
    expect(r.state.financial_ledger[0]).toMatchObject({
      transaction_type: "CHARGEBACK",
      amount: 50,
      reference_id: "synthetic-chargeback-1",
    });
    expect(r.state.payment_webhook_events[0].processed).toBe(true);
  });

  it("never acknowledges persistence failure in order_payment", async () => {
    const r = createFixture("approved", "order_payment");
    const res = await r.invoke();
    expect(res.status).toBe(503);
    expect(r.state.payment_webhook_events[0].processed).toBe(false);
    expect(r.state.financial_ledger).toHaveLength(0);
    expect(r.transitions).toHaveLength(0);
  });

  it("never acknowledges persistence failure in payments", async () => {
    const r = createFixture("approved", "payments");
    const res = await r.invoke();
    expect(res.status).toBe(503);
    expect(r.state.payment_webhook_events[0].processed).toBe(false);
    expect(r.state.financial_ledger).toHaveLength(0);
    expect(r.transitions).toHaveLength(0);
  });

  it("never returns completed status when the event completion update fails", async () => {
    const r = createFixture("approved", undefined, true);
    const res = await r.invoke();
    expect(res.status).toBe(503);
    expect(r.state.payment_webhook_events[0].processed).toBe(false);
    expect(r.state.financial_ledger).toHaveLength(1);
    expect(r.state.financial_ledger[0].transaction_type).toBe("PAYMENT_APPROVED");
  });
  it("does not acknowledge approved payment if order transition is rejected", async () => {
    const r = createFixture("approved", undefined, false, true);
    const res = await r.invoke();
    expect(res.status).toBe(503);
    expect(r.transitions).toEqual(["pago"]);
    expect(r.state.orders[0].status).toBe("aguardando_pagamento");
    expect(r.state.payment_webhook_events[0].processed).toBe(false);
    expect(r.state.financial_ledger).toHaveLength(0);
    expect(r.state.order_payment[0].status).toBe("APPROVED");
  });

  it("rejects amount mismatch without confirming the event or changing order", async () => {
    const r = createFixture("approved");
    r.mp.transaction_amount = 51;
    const res = await r.invoke();
    expect(res.status).toBe(503);
    expect(r.state.payment_webhook_events[0]).toMatchObject({ processed: false });
    expect(r.transitions).toHaveLength(0);
    expect(r.state.financial_ledger).toHaveLength(0);
    expect(r.state.orders[0].status).toBe("aguardando_pagamento");
  });
});
