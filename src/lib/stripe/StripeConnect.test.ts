import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    from: vi.fn(),
  },
}));

import { supabase } from "@/integrations/supabase/client";
import { StripeConnectService } from "./StripeConnectService";
import { PaymentsReadinessService } from "@/lib/billing/PaymentsReadinessService";

const invoke = supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  // @ts-expect-error jsdom
  global.window = { location: { origin: "https://app.test" } } as any;
});

describe("StripeConnectService", () => {
  it("createExpressAccount devolve accountId + onboardingUrl", async () => {
    invoke.mockResolvedValue({
      data: { accountId: "acct_1", onboardingUrl: "https://stripe/x" },
      error: null,
    });
    const r = await StripeConnectService.createExpressAccount("r1");
    expect(r.accountId).toBe("acct_1");
    expect(r.onboardingUrl).toContain("stripe");
    expect(invoke).toHaveBeenCalledWith(
      "stripe-connect-create",
      expect.objectContaining({ body: expect.objectContaining({ restaurantId: "r1" }) }),
    );
  });

  it("createAccountLink pede apenas link (onlyLink=true)", async () => {
    invoke.mockResolvedValue({
      data: { url: "https://x", expiresAt: "2030-01-01" },
      error: null,
    });
    await StripeConnectService.createAccountLink("r1");
    expect(invoke).toHaveBeenCalledWith(
      "stripe-connect-create",
      expect.objectContaining({ body: expect.objectContaining({ onlyLink: true }) }),
    );
  });

  it("refreshAccount mapeia snapshot completo", async () => {
    invoke.mockResolvedValue({
      data: {
        accountId: "acct_1",
        status: "active",
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
        onboardingCompleted: true,
        lastSync: "2026-01-01T00:00:00Z",
        capabilities: { card: "active", pix: "pending", transfers: "active" },
      },
      error: null,
    });
    const s = await StripeConnectService.refreshAccount("r1");
    expect(s.status).toBe("active");
    expect(s.capabilities.pix).toBe("pending");
  });

  it("disconnectAccount envia flag disconnect", async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
    await StripeConnectService.disconnectAccount("r1");
    expect(invoke).toHaveBeenCalledWith(
      "stripe-connect-refresh",
      expect.objectContaining({ body: expect.objectContaining({ disconnect: true }) }),
    );
  });

  it("propaga erro da edge", async () => {
    invoke.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(StripeConnectService.refreshAccount("r1")).rejects.toThrow("boom");
  });

  it("propaga erro semântico do payload", async () => {
    invoke.mockResolvedValue({ data: { error: "restaurant_not_found" }, error: null });
    await expect(StripeConnectService.refreshAccount("r1")).rejects.toThrow(
      "restaurant_not_found",
    );
  });
});

describe("PaymentsReadinessService", () => {
  function mockRestaurant(row: any) {
    (supabase.from as any).mockReturnValue({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }),
      }),
    });
  }

  it("ready=true quando conta ativa e capabilities habilitadas", async () => {
    mockRestaurant({
      stripe_account_id: "acct_1",
      stripe_account_status: "active",
      stripe_charges_enabled: true,
      stripe_payouts_enabled: true,
      stripe_details_submitted: true,
      stripe_onboarding_completed: true,
    });
    const r = await PaymentsReadinessService.isReadyForPayments("r1");
    expect(r.ready).toBe(true);
    expect(r.reasons).toHaveLength(0);
  });

  it("reason=no_account quando sem stripe_account_id", async () => {
    mockRestaurant({
      stripe_account_id: null,
      stripe_account_status: "not_created",
      stripe_charges_enabled: false,
      stripe_payouts_enabled: false,
      stripe_details_submitted: false,
    });
    const r = await PaymentsReadinessService.isReadyForPayments("r1");
    expect(r.ready).toBe(false);
    expect(r.reasons).toContain("no_account");
  });

  it("reason=capabilities_inactive quando faltam capabilities", async () => {
    mockRestaurant({
      stripe_account_id: "acct_1",
      stripe_account_status: "onboarding_pending",
      stripe_charges_enabled: false,
      stripe_payouts_enabled: false,
      stripe_details_submitted: true,
    });
    const r = await PaymentsReadinessService.isReadyForPayments("r1");
    expect(r.ready).toBe(false);
    expect(r.reasons).toContain("capabilities_inactive");
  });

  it("reason=account_under_review quando restricted", async () => {
    mockRestaurant({
      stripe_account_id: "acct_1",
      stripe_account_status: "restricted",
      stripe_charges_enabled: false,
      stripe_payouts_enabled: false,
      stripe_details_submitted: true,
    });
    const r = await PaymentsReadinessService.isReadyForPayments("r1");
    expect(r.reasons).toContain("account_under_review");
  });
});
