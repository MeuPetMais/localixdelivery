import { describe, expect, it } from "vitest";
import { existingWebhookDelivery } from "./webhook-event-retry";

describe("Mercado Pago webhook duplicate delivery response", () => {
  it("acknowledges only an already processed event", () => {
    expect(existingWebhookDelivery(true)).toEqual({
      status: 200,
      body: { ok: true, duplicated: true },
    });
  });

  it.each([false, null, undefined])(
    "never acknowledges an unfinished event (%s)",
    (processed) => {
      expect(existingWebhookDelivery(processed)).toEqual({
        status: 503,
        body: { ok: false, error: "webhook_pending_recovery" },
      });
    },
  );
});
