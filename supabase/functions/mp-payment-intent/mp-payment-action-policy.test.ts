import { describe, expect, it } from "vitest";
import { isAuthorizedPaymentAction, mapMpStatus } from "./mp-payment-action-policy";

const OWNER = "owner-user";
const CUSTOMER = "buyer-user";
const STRANGER = "another-user";

describe("Gate 4B: authorization of payment actions by object", () => {
  it.each([
    ["create", OWNER, true],
    ["create", CUSTOMER, true],
    ["create", STRANGER, false],
    ["status", OWNER, true],
    ["status", CUSTOMER, true],
    ["status", STRANGER, false],
    ["refund", OWNER, true],
    ["refund", CUSTOMER, false],
    ["refund", STRANGER, false],
    ["cancel", OWNER, true],
    ["cancel", CUSTOMER, false],
    ["cancel", STRANGER, false],
    ["refund-all", OWNER, false],
    ["__proto__", OWNER, false],
  ])("authorizes action %s for %s: %s", (action, callerId, expected) => {
    expect(
      isAuthorizedPaymentAction({
        action,
        callerId,
        ownerId: OWNER,
        customerId: CUSTOMER,
      }),
    ).toBe(expected);
  });

  it("rejects unauthenticated callers and customers without an order association", () => {
    expect(
      isAuthorizedPaymentAction({
        action: "create",
        callerId: "",
        ownerId: OWNER,
        customerId: CUSTOMER,
      }),
    ).toBe(false);
    expect(
      isAuthorizedPaymentAction({
        action: "create",
        callerId: CUSTOMER,
        ownerId: null,
        customerId: null,
      }),
    ).toBe(false);
    expect(
      isAuthorizedPaymentAction({
        action: "create",
        callerId: CUSTOMER,
        ownerId: OWNER,
        customerId: null,
      }),
    ).toBe(false);
  });
});

describe("Gate 4B: MP states do not create phantom approvals", () => {
  it.each([
    ["approved", "APPROVED"],
    ["in_process", "PROCESSING"],
    ["rejected", "REJECTED"],
    ["cancelled", "CANCELLED"],
    ["refunded", "REFUNDED"],
    ["charged_back", "CHARGEBACK"],
    ["unknown", "PENDING"],
    [null, "PENDING"],
  ])("maps %s to %s", (status, expected) => {
    expect(mapMpStatus(status)).toBe(expected);
  });

  it("never turns financial reversals into approvals", () => {
    for (const status of ["refunded", "charged_back", "REFUNDED", "CHARGED_BACK"]) {
      expect(mapMpStatus(status)).not.toBe("APPROVED");
    }
  });
});
