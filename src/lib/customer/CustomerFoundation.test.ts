import { describe, expect, it, beforeEach } from "vitest";
import { CustomerValidator } from "./CustomerValidator";
import { CustomerAudit } from "./CustomerAudit";
import { CustomerEventBus, type CustomerDomainEvent } from "./CustomerEventBus";

describe("CustomerValidator.validateProfile", () => {
  it("accepts a valid profile", () => {
    expect(CustomerValidator.validateProfile({ full_name: "Ana", email: "a@b.com" }).ok).toBe(true);
  });
  it("rejects short name", () => {
    const r = CustomerValidator.validateProfile({ full_name: "A" });
    expect(r.ok).toBe(false);
    expect(r.issues[0].field).toBe("full_name");
  });
  it("rejects invalid email", () => {
    expect(CustomerValidator.validateProfile({ email: "nope" }).ok).toBe(false);
  });
  it("rejects invalid phone", () => {
    expect(CustomerValidator.validateProfile({ phone: "abc" }).ok).toBe(false);
  });
  it("requires contact when opted", () => {
    expect(CustomerValidator.validateProfile({}, { requireContact: true }).ok).toBe(false);
  });
});

describe("CustomerValidator.validateAddress", () => {
  it("requires label/street/neighborhood", () => {
    const r = CustomerValidator.validateAddress({});
    expect(r.ok).toBe(false);
    expect(r.issues.length).toBeGreaterThanOrEqual(3);
  });
  it("validates CEP format", () => {
    const r = CustomerValidator.validateAddress({ label: "Casa", street: "Rua A", neighborhood: "Centro", cep: "123" });
    expect(r.ok).toBe(false);
  });
  it("accepts complete address", () => {
    const r = CustomerValidator.validateAddress({ label: "Casa", street: "Rua A", neighborhood: "Centro", cep: "01000-000" });
    expect(r.ok).toBe(true);
  });
});

describe("CustomerValidator.validatePreferences", () => {
  it("rejects invalid language tag", () => {
    expect(CustomerValidator.validatePreferences({ language: "portuguese" }).ok).toBe(false);
  });
  it("accepts pt-BR", () => {
    expect(CustomerValidator.validatePreferences({ language: "pt-BR" }).ok).toBe(true);
  });
});

describe("CustomerEventBus", () => {
  beforeEach(() => CustomerEventBus.clear());
  it("delivers events to subscribers", async () => {
    const received: CustomerDomainEvent[] = [];
    CustomerEventBus.subscribe((e) => { received.push(e); });
    await CustomerEventBus.publish({
      type: "CustomerCreated", customerId: "u1", at: new Date().toISOString(),
    });
    expect(received).toHaveLength(1);
    expect(received[0].type).toBe("CustomerCreated");
  });
  it("unsubscribes cleanly", async () => {
    const received: CustomerDomainEvent[] = [];
    const off = CustomerEventBus.subscribe((e) => { received.push(e); });
    off();
    await CustomerEventBus.publish({ type: "CustomerCreated", customerId: "u1", at: "now" });
    expect(received).toHaveLength(0);
  });
});

describe("CustomerAudit", () => {
  beforeEach(() => CustomerAudit.clear());
  it("records and filters entries by customer", () => {
    CustomerAudit.record({ customerId: "u1", action: "profile.updated" });
    CustomerAudit.record({ customerId: "u2", action: "consent.recorded" });
    expect(CustomerAudit.list("u1")).toHaveLength(1);
    expect(CustomerAudit.list()).toHaveLength(2);
  });
});
