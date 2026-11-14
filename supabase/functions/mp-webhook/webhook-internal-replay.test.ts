import { describe, expect, it } from "vitest";
import { shouldReplayExistingWebhook } from "./webhook-event-retry";

describe("Mercado Pago internal webhook recovery", () => {
  it("allows only pending events with valid internal authorization", () => {
    expect(shouldReplayExistingWebhook(false, true)).toBe(true);
    expect(shouldReplayExistingWebhook(false, false)).toBe(false);
    expect(shouldReplayExistingWebhook(true, true)).toBe(false);
    expect(shouldReplayExistingWebhook(null, true)).toBe(false);
  });
});
