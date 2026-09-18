import { describe, expect, it } from "vitest";
import { resolveMercadoPagoWebhookToken } from "./token-resolution";

function accounts(rows: Array<Record<string, unknown>>) {
  return {
    from: (table: string) => {
      expect(table).toBe("mercado_pago_accounts");
      const query = {
        select: () => query,
        eq: () => query,
        not: () => query,
        limit: async () => ({ data: rows, error: null }),
      };
      return query;
    },
  };
}

describe("deployed mp-webhook token resolution", () => {
  it("resolves only the connected seller account", async () => {
    const result = await resolveMercadoPagoWebhookToken(
      accounts([{ restaurant_id: "restaurant-1", access_token: "cipher", connected: true }]),
      {
        restaurantId: null,
        webhookUserId: "seller-1",
        decryptToken: async () => "seller-token",
        fallbackAccessToken: null,
      },
    );
    expect(result).toEqual({
      ok: true,
      token: "seller-token",
      restaurantId: "restaurant-1",
      source: "mp_user_id",
    });
  });

  it("does not use a global fallback in the webhook call path", async () => {
    const result = await resolveMercadoPagoWebhookToken(accounts([]), {
      restaurantId: null,
      webhookUserId: "seller-1",
      decryptToken: async () => null,
      fallbackAccessToken: null,
    });
    expect(result).toEqual({
      ok: false,
      token: null,
      restaurantId: null,
      reason: "mp_user_account_not_found",
    });
  });

  it("rejects ambiguous seller accounts", async () => {
    const result = await resolveMercadoPagoWebhookToken(
      accounts([{ restaurant_id: "a" }, { restaurant_id: "b" }]),
      {
        restaurantId: null,
        webhookUserId: "seller-1",
        decryptToken: async () => "token",
        fallbackAccessToken: null,
      },
    );
    expect(result).toMatchObject({ ok: false, reason: "mp_user_account_ambiguous" });
  });
});
