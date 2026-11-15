import { describe, expect, it } from "vitest";
import { isClaimableEvent, nextWebhookRetry } from "./retry-policy";

describe("MP webhook queue retry policy", () => {
  const now = new Date("2026-11-13T16:00:00.000Z");

  it("increases the backoff and eventually stops", () => {
    expect(nextWebhookRetry(0, now)).toEqual({
      attempts: 1,
      status: "pending",
      nextRetry: "2026-11-13T16:01:00.000Z",
    });
    expect(nextWebhookRetry(2, now).nextRetry).toBe("2026-11-13T16:04:00.000Z");
    expect(nextWebhookRetry(5, now).status).toBe("failed");
  });

  it("never claims completed or recently touched events", () => {
    expect(isClaimableEvent(true, "2026-11-13T15:00:00Z", now)).toBe(false);
    expect(isClaimableEvent(null, "2026-11-13T15:00:00Z", now)).toBe(false);
    expect(isClaimableEvent(false, "2026-11-13T15:59:00Z", now)).toBe(false);
    expect(isClaimableEvent(false, "invalid", now)).toBe(false);
    expect(isClaimableEvent(false, "2026-11-13T15:55:00Z", now)).toBe(true);
  });
});
