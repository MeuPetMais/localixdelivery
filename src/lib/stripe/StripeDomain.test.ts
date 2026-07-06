import { describe, it, expect, beforeEach } from "vitest";
import { StripeService } from "./StripeService";
import { StripeEventBus } from "./StripeEventBus";
import { StripeMapper } from "./StripeMapper";
import { StripeWebhookService } from "./StripeWebhookService";
import { StripeCapabilitiesService } from "./StripeCapabilitiesService";
import { StripeBalanceService } from "./StripeBalanceService";

beforeEach(() => StripeEventBus._reset());

describe("StripeMapper", () => {
  it("mapeia conta ativa", () => {
    const a = StripeMapper.account(
      {
        id: "acct_1",
        country: "BR",
        default_currency: "brl",
        details_submitted: true,
        charges_enabled: true,
        payouts_enabled: true,
        created: 1700000000,
      },
      "rest-1",
    );
    expect(a.status).toBe("active");
    expect(a.id).toBe("acct_1");
    expect(a.restaurantId).toBe("rest-1");
  });

  it("detecta onboarding pendente", () => {
    const a = StripeMapper.account({ id: "acct_2", details_submitted: false }, "rest-1");
    expect(a.status).toBe("onboarding_pending");
  });

  it("detecta rejeitada", () => {
    const a = StripeMapper.account(
      { id: "acct_3", requirements: { disabled_reason: "rejected.fraud" } },
      "rest-1",
    );
    expect(a.status).toBe("rejected");
  });

  it("mapeia balance", () => {
    const b = StripeMapper.balance({
      available: [{ amount: 1500, currency: "brl" }],
      pending: [{ amount: 500, currency: "brl" }],
    });
    expect(b.available).toBe(1500);
    expect(b.pending).toBe(500);
    expect(b.currency).toBe("brl");
  });
});

describe("StripeCapabilitiesService", () => {
  it("isReadyForCharges: true quando card+transfers ativos", () => {
    expect(
      StripeCapabilitiesService.isReadyForCharges({
        cardPayments: "active",
        transfers: "active",
      }),
    ).toBe(true);
  });
  it("isReadyForCharges: false quando pending", () => {
    expect(
      StripeCapabilitiesService.isReadyForCharges({
        cardPayments: "pending",
        transfers: "active",
      }),
    ).toBe(false);
  });
});

describe("StripeBalanceService.format", () => {
  it("formata em BRL", () => {
    const s = StripeBalanceService.format({ available: 12345, pending: 0, reserved: 0, currency: "brl" });
    expect(s).toContain("123,45");
  });
});

describe("StripeWebhookService + EventBus", () => {
  it("dispatch publica WebhookReceived e evento mapeado", async () => {
    const seen: string[] = [];
    StripeEventBus.subscribe((name) => {
      seen.push(name);
    });
    const evt = StripeWebhookService.parse({
      id: "evt_1",
      type: "account.updated",
      created: 1700000000,
      livemode: false,
      data: { object: { id: "acct_1" } },
    });
    await StripeWebhookService.dispatch(evt, "rest-1");
    expect(seen).toContain("WebhookReceived");
    expect(seen).toContain("AccountUpdated");
  });
});

describe("StripeService (placeholders)", () => {
  it("startOnboarding lança até o milestone de pagamentos", async () => {
    await expect(StripeService.startOnboarding("r1")).rejects.toThrow(/não implementado/i);
  });
  it("isPending retorna true quando não há conta", async () => {
    await expect(StripeService.isPending("r1")).resolves.toBe(true);
  });
});
