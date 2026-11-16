import { describe, expect, it } from "vitest";
import { isAuthorizedPaymentAction, mapMpStatus } from "./mp-payment-action-policy";

const OWNER = "owner-user";
const CUSTOMER = "buyer-user";
const STRANGER = "another-user";

describe("Gate 4B: authorization of payment actions by object", () => {
  it("allows order owner and authenticated customer to create and read status", () => {
    for (const action of ["create", "status"]) {
      expect(isAuthorizedPaymentAction({ action, callerId: OWNER, ownerId: OWNER, customerId: CUSTOMER })).toBe(true);
      expect(isAuthorizedPaymentAction({ action, callerId: CUSTOMER, ownerId: OWNER, customerId: CUSTOMER })).toBe(true);
    }
  });

  it("denies strangers and callers without an order association", () => {
    for (const action of ["create", "status", "refund", "cancel"]) {
      expect(isAuthorizedPaymentAction({ action, callerId: STRANGER, ownerId: OWNER, customerId: CUSTOMER })).toBe(false);
      expect(isAuthorizedPaymentAction({ action, callerId: "", ownerId: OWNER, customerId: CUSTOMER })).toBe(false);
      expect(isAuthorizedPaymentAction({ action, callerId: CUSTOMER, ownerId: null, customerId: null })).toBe(false);
    }
  });

  it("allows only the restaurant owner to refund or cancel", () => {
    for (const action of ["refund", "cancel"]) {
      expect(isAuthorizedPaymentAction({ action, callerId: OWNER, ownerId: OWNER, customerId: CUSTOMER })).toBe(true);
      expect(isAuthorizedPaymentAction({ action, callerId: CUSTOMER, ownerId: OWNER, customerId: CUSTOMER })).toBe(false);
    }
  });

  it("fails closed for unknown actions and null customer on anonymous checkout", () => {
    expect(isAuthorizedPaymentAction({ action: "create", callerId: CUSTOMER, ownerId: OWNER, customerId: null })).toBe(false);
    expect(isAuthorizedPaymentAction({ action: "refund-all", callerId: OWNER, ownerId: OWNER, customerId: CUSTOMER })).toBe(false);
    expect(isAuthorizedPaymentAction({ action: "__proto__", callerId: OWNER, ownerId: OWNER, customerId: CUSTOMER })).toBe(false);
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
