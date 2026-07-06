import { describe, it, expect, beforeEach } from "vitest";
import {
  BillingService,
  BillingEvents,
  EligibilityService,
  OnboardingService,
  RestaurantLifecycleService,
  RestaurantStatusService,
  ServiceFeeService,
} from "./index";
import type { BillingEvent } from "./BillingEvents";

beforeEach(() => BillingEvents.clear());

describe("EligibilityService", () => {
  it("aprova quando volume e ticket atendem BD-008/BD-009", () => {
    const r = EligibilityService.evaluate({ monthlyOrders: 800, averageTicket: 45 });
    expect(r.eligible).toBe(true);
    expect(r.reasons).toHaveLength(0);
  });
  it("reprova quando ticket ou volume estão abaixo", () => {
    const r = EligibilityService.evaluate({ monthlyOrders: 100, averageTicket: 10 });
    expect(r.eligible).toBe(false);
    expect(r.reasons.length).toBe(2);
  });
});

describe("RestaurantLifecycleService", () => {
  it("permite fluxo Draft -> Production", () => {
    const order = [
      "Draft","PendingVerification","PendingStripe","PendingSetup","PendingApproval","Production",
    ] as const;
    for (let i = 0; i < order.length - 1; i++) {
      expect(RestaurantLifecycleService.canTransition(order[i], order[i + 1])).toBe(true);
    }
  });
  it("bloqueia transições inválidas", () => {
    expect(() =>
      RestaurantLifecycleService.transition("r1", "Draft", "Production"),
    ).toThrow();
  });
  it("emite RestaurantApproved ao entrar em Production", () => {
    const events: BillingEvent[] = [];
    BillingEvents.on(e => events.push(e));
    RestaurantLifecycleService.transition("r1", "PendingApproval", "Production");
    expect(events.some(e => e.type === "RestaurantApproved")).toBe(true);
  });
});

describe("RestaurantStatusService", () => {
  it("mapeia Production como operational", () => {
    expect(RestaurantStatusService.fromState("Production")).toBe("operational");
    expect(RestaurantStatusService.fromState("Suspended")).toBe("blocked");
    expect(RestaurantStatusService.fromState("Closed")).toBe("closed");
    expect(RestaurantStatusService.fromState("Draft")).toBe("onboarding");
  });
});

describe("ServiceFeeService", () => {
  it("aplica R$0,99 por pedido (BD-003)", () => {
    const q = ServiceFeeService.quote("r1");
    expect(q.perOrderFee).toBe(0.99);
    expect(ServiceFeeService.calculate(100)).toBe(99);
  });
});

describe("OnboardingService", () => {
  it("calcula percentual do checklist", () => {
    const c = OnboardingService.buildChecklist("r1", {
      verified: true, gatewayConnected: true, setupComplete: false, approved: false,
    });
    expect(c.completedPct).toBe(50);
  });
});

describe("BillingService fachada", () => {
  it("expõe todos os subserviços", () => {
    expect(BillingService.eligibility).toBeDefined();
    expect(BillingService.lifecycle).toBeDefined();
    expect(BillingService.status).toBeDefined();
    expect(BillingService.onboarding).toBeDefined();
    expect(BillingService.serviceFee).toBeDefined();
    expect(BillingService.events).toBeDefined();
  });
});
