import { describe, it, expect, beforeEach } from "vitest";
import { NotificationCenter, type NotificationRepo } from "./NotificationCenter";
import { NotificationPreferenceService } from "./NotificationPreferenceService";
import { NotificationTemplateEngine, renderString } from "./NotificationTemplateEngine";
import { NotificationDispatcher } from "./NotificationDispatcher";
import { NotificationAuditService } from "./NotificationAuditService";
import { planRetry } from "./RetryEngine";
import { inQuietHours } from "./NotificationPreferenceService";
import { orderEventToRequest, paymentEventToRequest } from "./events";
import type {
  NotificationPreferences,
  NotificationRecord,
  NotificationRequest,
  NotificationTemplate,
} from "./types";

function makeCenter(overrides: {
  prefs?: NotificationPreferences | null;
  dropped?: (r: NotificationRequest, reason: string) => Promise<void>;
} = {}) {
  const inserts: any[] = [];
  const repo: NotificationRepo = {
    enqueue: async (input) => {
      const rec: NotificationRecord = {
        id: `n${inserts.length + 1}`,
        recipient_id: input.recipient_id,
        recipient_type: input.recipient_type ?? "customer",
        channel: input.channel,
        template_code: input.template_code,
        status: "PENDING",
        priority: input.priority ?? "NORMAL",
        payload_json: input.payload_json,
        attempts: 0,
        max_attempts: 5,
        scheduled_at: input.scheduled_at,
        sent_at: null,
        read_at: null,
        error_message: null,
        origin: input.origin,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      inserts.push(rec);
      return rec;
    },
    markStatus: async () => {},
    listPending: async () => inserts,
    listForRecipient: async (rid) => inserts.filter((i) => i.recipient_id === rid),
  };
  const prefs = new NotificationPreferenceService({
    get: async () => overrides.prefs ?? null,
  });
  const center = new NotificationCenter({
    repo,
    preferences: prefs,
    audit: { dropped: overrides.dropped ?? (async () => {}) },
  });
  return { center, inserts, repo };
}

describe("Notification Center", () => {
  it("renderString substitui variáveis", () => {
    expect(renderString("Olá {{ name }}!", { name: "Ana" })).toBe("Olá Ana!");
    expect(renderString("#{{o.n}}", { o: { n: 42 } })).toBe("#42");
    expect(renderString("{{missing}}", {})).toBe("");
  });

  it("enfileira quando canal está permitido", async () => {
    const { center, inserts } = makeCenter();
    const res = await center.notify({
      recipient_id: "u1",
      template_code: "ORDER_CREATED",
      payload: { order_number: 1 },
    });
    expect(res.enqueued).toBe(true);
    expect(inserts).toHaveLength(1);
    expect(inserts[0].channel).toBe("IN_APP");
    expect(inserts[0].status).toBe("PENDING");
  });

  it("bloqueia quando preferência desativa canal", async () => {
    let droppedReason = "";
    const { center, inserts } = makeCenter({
      prefs: {
        user_id: "u1",
        push_enabled: true,
        email_enabled: true,
        sms_enabled: false,
        whatsapp_enabled: false,
        in_app_enabled: false,
        marketing_enabled: false,
      },
      dropped: async (_r, reason) => {
        droppedReason = reason;
      },
    });
    const res = await center.notify({
      recipient_id: "u1",
      template_code: "ORDER_CREATED",
      channel: "IN_APP",
    });
    expect(res.enqueued).toBe(false);
    expect(res.reason).toBe("channel_disabled:IN_APP");
    expect(inserts).toHaveLength(0);
    expect(droppedReason).toBe("channel_disabled:IN_APP");
  });

  it("bloqueia marketing quando desabilitado", async () => {
    const { center } = makeCenter({
      prefs: {
        user_id: "u1",
        push_enabled: true,
        email_enabled: true,
        sms_enabled: true,
        whatsapp_enabled: true,
        in_app_enabled: true,
        marketing_enabled: false,
      },
    });
    const prefs = new NotificationPreferenceService({
      get: async () => ({
        user_id: "u1",
        push_enabled: true,
        email_enabled: true,
        sms_enabled: true,
        whatsapp_enabled: true,
        in_app_enabled: true,
        marketing_enabled: false,
      }),
    });
    const dec = await prefs.isAllowed("u1", "PUSH", { marketing: true });
    expect(dec.allowed).toBe(false);
    expect(dec.reason).toBe("marketing_disabled");
    expect(center).toBeTruthy();
  });

  it("quiet hours: bloqueia dentro da faixa que cruza meia-noite", () => {
    expect(inQuietHours(2, 22, 7)).toBe(true);
    expect(inQuietHours(23, 22, 7)).toBe(true);
    expect(inQuietHours(10, 22, 7)).toBe(false);
    expect(inQuietHours(9, 9, 12)).toBe(true);
    expect(inQuietHours(12, 9, 12)).toBe(false);
  });

  it("Template engine renderiza template válido", async () => {
    const tpl: NotificationTemplate = {
      code: "ORDER_CREATED",
      channel: "IN_APP",
      language: "pt-BR",
      subject: null,
      title: "Pedido {{n}}",
      body: "Recebemos seu pedido {{n}}",
      variables: ["n"],
      enabled: true,
    };
    const engine = new NotificationTemplateEngine({
      find: async () => tpl,
    });
    const out = await engine.render("ORDER_CREATED", "IN_APP", "pt-BR", { n: 42 });
    expect(out.title).toBe("Pedido 42");
    expect(out.body).toBe("Recebemos seu pedido 42");
  });

  it("Template engine lança erro se template não existir", async () => {
    const engine = new NotificationTemplateEngine({ find: async () => null });
    await expect(engine.render("X", "IN_APP", "pt-BR", {})).rejects.toThrow(/template_not_found/);
  });

  it("Dispatcher marca SENT em InAppProvider", async () => {
    const tpl: NotificationTemplate = {
      code: "ORDER_CREATED",
      channel: "IN_APP",
      language: "pt-BR",
      subject: null,
      title: "t",
      body: "b",
      variables: [],
      enabled: true,
    };
    const engine = new NotificationTemplateEngine({ find: async () => tpl });
    const audit = new NotificationAuditService({ log: async () => {} });
    const dispatcher = new NotificationDispatcher(engine, audit);
    const rec: NotificationRecord = {
      id: "n1",
      recipient_id: "u1",
      recipient_type: "customer",
      channel: "IN_APP",
      template_code: "ORDER_CREATED",
      status: "PENDING",
      priority: "NORMAL",
      payload_json: {},
      attempts: 0,
      max_attempts: 5,
      scheduled_at: new Date().toISOString(),
      sent_at: null,
      read_at: null,
      error_message: null,
      origin: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const outcome = await dispatcher.dispatch(rec);
    expect(outcome.next_status).toBe("SENT");
    expect(outcome.result.ok).toBe(true);
  });

  it("Dispatcher vai para RETRY em provider não implementado", async () => {
    const tpl: NotificationTemplate = {
      code: "PAYMENT_APPROVED",
      channel: "PUSH",
      language: "pt-BR",
      subject: null,
      title: "t",
      body: "b",
      variables: [],
      enabled: true,
    };
    const engine = new NotificationTemplateEngine({ find: async () => tpl });
    const audit = new NotificationAuditService({ log: async () => {} });
    const dispatcher = new NotificationDispatcher(engine, audit);
    const rec: NotificationRecord = {
      id: "n2",
      recipient_id: "u1",
      recipient_type: "customer",
      channel: "PUSH",
      template_code: "PAYMENT_APPROVED",
      status: "PENDING",
      priority: "HIGH",
      payload_json: {},
      attempts: 0,
      max_attempts: 3,
      scheduled_at: new Date().toISOString(),
      sent_at: null,
      read_at: null,
      error_message: null,
      origin: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const outcome = await dispatcher.dispatch(rec);
    expect(outcome.result.ok).toBe(false);
    expect(["RETRY", "DEAD_LETTER"]).toContain(outcome.next_status);
  });

  it("RetryEngine: escala exponencial e vai a DEAD_LETTER no limite", () => {
    const r1 = planRetry(0, 3);
    expect(r1.next_status).toBe("RETRY");
    expect(r1.attempts).toBe(1);
    const r2 = planRetry(2, 3);
    expect(r2.next_status).toBe("DEAD_LETTER");
    expect(r2.attempts).toBe(3);
  });

  it("Bridge de eventos: mapeia OrderDelivered → ORDER_DELIVERED", () => {
    const req = orderEventToRequest("OrderDelivered", {
      orderId: "o1",
      restaurantId: "r1",
      previousStatus: "saiu_para_entrega",
      currentStatus: "entregue",
      actorType: "restaurant",
      performedBy: null,
      reason: null,
      metadata: { order_number: 42 },
      occurredAt: new Date().toISOString(),
    });
    expect(req?.template_code).toBe("ORDER_DELIVERED");
    expect(req?.payload?.order_number).toBe(42);
  });

  it("Bridge de eventos: mapeia PaymentApproved → PAYMENT_APPROVED", () => {
    const req = paymentEventToRequest("PaymentApproved", {
      provider: "mp",
      orderId: "o1",
      restaurantId: "r1",
      paymentId: "p1",
      amount: 100,
      currency: "BRL",
    });
    expect(req?.template_code).toBe("PAYMENT_APPROVED");
  });

  it("Bridge: eventos sem mapeamento retornam null", () => {
    const req = orderEventToRequest("PaymentApproved" as any, {
      orderId: "o1",
      restaurantId: "r1",
      previousStatus: null,
      currentStatus: "pago",
      actorType: "system",
      performedBy: null,
      reason: null,
      metadata: {},
      occurredAt: new Date().toISOString(),
    });
    expect(req).toBeNull();
  });
});

// Corrige lint: usa 'beforeEach' importado (garante API disponível caso surja setup futuro).
beforeEach(() => {});
