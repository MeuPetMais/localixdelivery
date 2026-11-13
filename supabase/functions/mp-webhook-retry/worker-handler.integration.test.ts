import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import ts from "typescript";
import { isClaimableEvent, nextWebhookRetry } from "./retry-policy";

// Exercise the actual deployed entrypoint body with isolated Supabase REST
// and HTTP adapters. No Supabase project, token, real gateway or live payment.
type Row = Record<string, unknown>;
type State = { payment_event_queue: Row[]; payment_webhook_events: Row[] };
type Comparator = { key: string; op: "eq" | "gte" | "lte" | "lt"; value: unknown };

function fakeSupabase(state: State) {
  function from(table: keyof State) {
    const filters: Comparator[] = [];
    let action: "read" | "update" = "read";
    let patch: Row = {};
    let orderBy = "";
    let max = Infinity;
    const query = {
      select: (_columns: string) => query,
      update: (value: Row) => {
        action = "update";
        patch = value;
        return query;
      },
      eq: (key: string, value: unknown) => {
        filters.push({ key, op: "eq", value });
        return query;
      },
      gte: (key: string, value: unknown) => {
        filters.push({ key, op: "gte", value });
        return query;
      },
      lte: (key: string, value: unknown) => {
        filters.push({ key, op: "lte", value });
        return query;
      },
      lt: (key: string, value: unknown) => {
        filters.push({ key, op: "lt", value });
        return query;
      },
      order: (key: string) => {
        orderBy = key;
        return query;
      },
      limit: (value: number) => {
        max = value;
        return query;
      },
      single: async () => {
        const result = execute();
        return { data: result[0] ?? null, error: result.length ? null : { code: "PGRST116" } };
      },
      maybeSingle: async () => {
        const result = execute();
        return { data: result[0] ?? null, error: null };
      },
      then: <T>(resolve: (value: { data: Row[]; error: null }) => T) =>
        Promise.resolve(resolve({ data: execute(), error: null })),
    };
    function execute() {
      const rows = state[table]
        .filter((r) =>
          filters.every((f) => {
            const a = r[f.key];
            if (f.op === "eq") return a === f.value;
            if (a == null) return false;
            const lhs = String(a);
            const rhs = String(f.value);
            if (f.op === "gte") return lhs >= rhs;
            if (f.op === "lte") return lhs <= rhs;
            return lhs < rhs;
          }),
        )
        .sort((a, b) => (orderBy ? String(a[orderBy]).localeCompare(String(b[orderBy])) : 0))
        .slice(0, max);
      if (action !== "update") return rows.map((r) => ({ ...r }));
      return rows.map((r) => {
        Object.assign(r, patch, { updated_at: new Date().toISOString() });
        return { ...r };
      });
    }
    return query;
  }
  return { from };
}

type Runtime = {
  client: ReturnType<typeof fakeSupabase>;
  handler: (req: Request) => Promise<Response>;
  state: State;
  replay: ReturnType<typeof vi.fn>;
  env: Record<string, string>;
};

function setup(options: { fail?: boolean; cutoff?: string } = {}): Runtime {
  const now = Date.now();
  const early = new Date(now - 6 * 60_000).toISOString();
  const state: State = {
    payment_event_queue: [
      {
        id: "q-1",
        event_id: "event-1",
        retry_count: 0,
        status: "pending",
        locked: false,
        created_at: new Date(now - 10 * 60_000).toISOString(),
        updated_at: early,
        next_retry: early,
      },
    ],
    payment_webhook_events: [
      {
        id: "event-1",
        provider: "mercado_pago",
        processed: false,
        processing_attempts: 1,
        updated_at: early,
        signature: null,
        resource_id: "synthetic-payment-1",
        event_id: "synthetic-event-1",
        payload_json: {
          id: "synthetic-event-1",
          type: "payment",
          data: { id: "synthetic-payment-1" },
        },
      },
    ],
  };
  const sb = fakeSupabase(state);
  const env: Record<string, string> = {
    MP_WEBHOOK_RETRY_WORKER_SECRET: "synthetic-secret",
    MP_WEBHOOK_REPLAY_SECRET: "synthetic-replay",
    MP_WEBHOOK_RETRY_CUTOVER: options.cutoff ?? new Date(now - 30 * 60_000).toISOString(),
    SUPABASE_URL: "https://synthetic.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "synthetic-service",
  };
  const replay = vi.fn(async (_url: URL, opts: RequestInit) => {
    expect((opts.headers as Record<string, string>)["x-localix-replay-secret"]).toBe(
      "synthetic-replay",
    );
    if (options.fail) {
      return new Response(JSON.stringify({ ok: false, error: "mp_unavailable" }), {
        status: 503,
      });
    }
    state.payment_webhook_events[0].processed = true;
    state.payment_webhook_events[0].updated_at = new Date().toISOString();
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  });
  let handler: Runtime["handler"] | undefined;
  let source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
  source = source.replace(/^import \{ createClient \} from "[^"]+";\n/m, "");
  source = source.replace(/^import \{ isClaimableEvent, nextWebhookRetry \} from "[^"]+";\n/m, "");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  runInNewContext(compiled, {
    Deno: {
      env: { get: (key: string) => env[key] },
      serve: (fn: Runtime["handler"]) => {
        handler = fn;
      },
    },
    createClient: () => sb,
    isClaimableEvent,
    nextWebhookRetry,
    fetch: replay,
    AbortSignal,
    Response,
    URL,
    Date,
    console,
  });
  if (!handler) throw Error("Worker did not register a handler");
  return { client: sb, handler, state, replay, env };
}

function request(secret = "synthetic-secret") {
  return new Request("https://synthetic.supabase.co/functions/v1/mp-webhook-retry", {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
  });
}

describe("Gate 4 — actual MP retry worker handler with isolated adapters", () => {
  it("recovers a pending event and finalizes its queue ticket", async () => {
    const r = setup();
    const response = await r.handler(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ completed: 1, retried: 0 });
    expect(r.replay).toHaveBeenCalledTimes(1);
    expect(r.state.payment_event_queue[0]).toMatchObject({ status: "completed", locked: false });
    expect(r.state.payment_webhook_events[0].processed).toBe(true);
    expect(r.state.payment_webhook_events[0].processing_attempts).toBe(2);
  });

  it("does not acknowledge successful completion when replay fails", async () => {
    const r = setup({ fail: true });
    const response = await r.handler(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ completed: 0, retried: 1 });
    expect(r.state.payment_event_queue[0]).toMatchObject({
      status: "pending",
      locked: false,
      retry_count: 1,
    });
    expect(r.state.payment_webhook_events[0].processed).toBe(false);
  });

  it("rejects an untrusted caller without selecting or changing queue state", async () => {
    const r = setup();
    const response = await r.handler(request("invalid"));
    expect(response.status).toBe(401);
    expect(r.replay).not.toHaveBeenCalled();
    expect(r.state.payment_event_queue[0]).toMatchObject({
      status: "pending",
      retry_count: 0,
      locked: false,
    });
  });

  it("does not replay historical events before the configured cutover", async () => {
    const r = setup({ cutoff: new Date(Date.now() - 60_000).toISOString() });
    const response = await r.handler(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ scanned: 0, completed: 0 });
    expect(r.replay).not.toHaveBeenCalled();
    expect(r.state.payment_webhook_events[0].processed).toBe(false);
  });

  it("invokes the actual MP receiver handler for a persisted synthetic non-financial event", async () => {
    const runtime = setup();
    runtime.state.payment_webhook_events[0].payload_json = {
      id: "synthetic-event-1",
      type: "unsupported_synthetic",
      data: { id: "synthetic-payment-1" },
    };
    const { readFileSync } = await import("node:fs");
    let receiverSource = readFileSync(new URL("../mp-webhook/index.ts", import.meta.url), "utf8");
    receiverSource = receiverSource.replace(/^import[^;]+;\\n/gm, "");
    const receiverCompiled = ts.transpileModule(receiverSource, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    }).outputText;
    let receiver: ((req: Request) => Promise<Response>) | undefined;
    runInNewContext(receiverCompiled, {
      exports: {},
      Deno: {
        env: {
          get: (key: string) =>
            key === "MP_WEBHOOK_REPLAY_SECRET" ? "synthetic-replay" : undefined,
        },
        serve: (handler: (req: Request) => Promise<Response>) => {
          receiver = handler;
        },
      },
      createClient: () => runtime.client,
      corsHeaders: {},
      json: (body: unknown, init: ResponseInit = {}) =>
        new Response(JSON.stringify(body), {
          ...init,
          headers: { "content-type": "application/json" },
        }),
      existingWebhookDelivery: () => ({
        status: 503,
        body: { ok: false, error: "webhook_pending_recovery" },
      }),
      shouldReplayExistingWebhook: (processed: boolean, internal: boolean) =>
        processed === false && internal,
      crypto,
      Response,
      URL,
      TextEncoder,
      Uint8Array,
      console,
    });
    expect(receiver).toBeTypeOf("function");
    runtime.replay.mockImplementation(async (url: URL, options: RequestInit) => {
      const request = new Request(url.toString(), options);
      return receiver!(request);
    });
    const response = await runtime.handler(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ completed: 1 });
    expect(runtime.state.payment_webhook_events[0].processed).toBe(true);
    expect(runtime.state.payment_event_queue[0].status).toBe("completed");
  });

  it("keeps a payment event pending when the real receiver cannot confirm it at the gateway", async () => {
    const runtime = setup();
    const receiverFile = readFileSync(new URL("../mp-webhook/index.ts", import.meta.url), "utf8");
    const receiverCompiled = ts.transpileModule(receiverFile.replace(/^import[^;]+;\n/gm, ""), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    }).outputText;
    let receiver: ((req: Request) => Promise<Response>) | undefined;
    const gateway = vi.fn(async () => new Response(null, { status: 404 }));
    runInNewContext(receiverCompiled, {
      exports: {},
      Deno: {
        env: {
          get: (key: string) =>
            key === "MP_WEBHOOK_REPLAY_SECRET" ? "synthetic-replay" : undefined,
        },
        serve: (handler: (req: Request) => Promise<Response>) => {
          receiver = handler;
        },
      },
      createClient: () => runtime.client,
      corsHeaders: {},
      json: (body: unknown, init: ResponseInit = {}) =>
        new Response(JSON.stringify(body), {
          ...init,
          headers: { "content-type": "application/json" },
        }),
      existingWebhookDelivery: () => ({
        status: 503,
        body: { ok: false, error: "webhook_pending_recovery" },
      }),
      shouldReplayExistingWebhook: (processed: boolean, internal: boolean) =>
        processed === false && internal,
      normalizeMpUserId: () => "synthetic-merchant",
      resolveMercadoPagoWebhookToken: async () => ({
        ok: true,
        token: "synthetic-token",
        restaurantId: "synthetic-restaurant",
        source: "synthetic",
      }),
      fetch: gateway,
      crypto,
      Response,
      URL,
      TextEncoder,
      Uint8Array,
      console,
    });
    expect(receiver).toBeTypeOf("function");
    runtime.replay.mockImplementation(async (url: URL, options: RequestInit) => {
      return receiver!(new Request(url.toString(), options));
    });
    const response = await runtime.handler(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ completed: 0, retried: 1 });
    expect(gateway).toHaveBeenCalledTimes(1);
    expect(runtime.state.payment_webhook_events[0].processed).toBe(false);
    expect(runtime.state.payment_event_queue[0]).toMatchObject({
      status: "pending",
      locked: false,
      retry_count: 1,
    });
  });
});
