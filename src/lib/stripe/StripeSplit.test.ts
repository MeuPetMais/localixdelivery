import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/platform-revenue", () => ({
  PlatformRevenueService: {
    getCurrentServiceFee: vi.fn(),
  },
}));

import { PlatformRevenueService } from "@/lib/platform-revenue";
import { StripeSplitService } from "./StripeSplitService";

const getFee = PlatformRevenueService.getCurrentServiceFee as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());

describe("StripeSplitService.calculateSplit", () => {
  it("pedido R$50 → fee da plataforma via PlatformRevenue", async () => {
    getFee.mockResolvedValue(1.49);
    const s = await StripeSplitService.calculateSplit({
      amount: 50,
      restaurantStripeAccountId: "acct_1",
      orderId: "o1",
      restaurantId: "r1",
    });
    expect(s.gross).toBe(50);
    expect(s.platformFee).toBe(1.49);
    expect(s.restaurantAmount).toBe(48.51);
    expect(s.destination).toBe("acct_1");
    expect(getFee).toHaveBeenCalledWith(50);
  });

  it("pedido R$100", async () => {
    getFee.mockResolvedValue(1.49);
    const s = await StripeSplitService.calculateSplit({
      amount: 100,
      restaurantStripeAccountId: "acct_1",
      orderId: "o1",
      restaurantId: "r1",
    });
    expect(s.restaurantAmount).toBe(98.51);
  });

  it("pedido R$200", async () => {
    getFee.mockResolvedValue(1.49);
    const s = await StripeSplitService.calculateSplit({
      amount: 200,
      restaurantStripeAccountId: "acct_1",
      orderId: "o1",
      restaurantId: "r1",
    });
    expect(s.restaurantAmount).toBe(198.51);
  });

  it("rejeita valor inválido", async () => {
    getFee.mockResolvedValue(0);
    await expect(
      StripeSplitService.calculateSplit({
        amount: 0,
        restaurantStripeAccountId: "acct_1",
        orderId: "o1",
        restaurantId: "r1",
      }),
    ).rejects.toThrow("invalid_amount");
  });

  it("rejeita destination ausente", async () => {
    getFee.mockResolvedValue(1);
    await expect(
      StripeSplitService.calculateSplit({
        amount: 50,
        restaurantStripeAccountId: "",
        orderId: "o1",
        restaurantId: "r1",
      }),
    ).rejects.toThrow("missing_destination");
  });
});

describe("StripeSplitService.buildTransferData", () => {
  it("converte para centavos e monta payload Stripe", () => {
    const payload = StripeSplitService.buildTransferData(
      { gross: 100, platformFee: 1.49, restaurantAmount: 98.51, destination: "acct_1" },
      { orderId: "o1", restaurantId: "r1", restaurantStripeAccountId: "acct_1" },
    );
    expect(payload.amount).toBe(10000);
    expect(payload.application_fee_amount).toBe(149);
    expect(payload.transfer_data.destination).toBe("acct_1");
    expect(payload.metadata.order_id).toBe("o1");
    expect(payload.metadata.platform_fee_brl).toBe("1.49");
  });
});

describe("StripeSplitService.validateSplit", () => {
  it("valida split correto", () => {
    const r = StripeSplitService.validateSplit({
      gross: 50, platformFee: 1.49, restaurantAmount: 48.51, destination: "acct_1",
    });
    expect(r.valid).toBe(true);
  });

  it("rejeita fee maior que total", () => {
    const r = StripeSplitService.validateSplit({
      gross: 1, platformFee: 5, restaurantAmount: -4, destination: "acct_1",
    });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("fee_exceeds_total");
  });

  it("rejeita soma inconsistente", () => {
    const r = StripeSplitService.validateSplit({
      gross: 50, platformFee: 1.49, restaurantAmount: 40, destination: "acct_1",
    });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("sum_mismatch");
  });

  it("rejeita destination inválido", () => {
    const r = StripeSplitService.validateSplit({
      gross: 50, platformFee: 1.49, restaurantAmount: 48.51, destination: "cus_1",
    });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("invalid_destination");
  });
});
