// Stripe Domain — Mapper.
// Converte respostas cruas da API do Stripe para tipos internos do domínio.
// Nenhum outro módulo deve conhecer o formato bruto da API do Stripe.

import type {
  StripeAccount,
  StripeAccountStatus,
  StripeBalance,
  StripeCapabilities,
  StripeTransfer,
  StripeWebhookEvent,
} from "./types";

type Raw = Record<string, any>;

export const StripeMapper = {
  account(raw: Raw, restaurantId: string): StripeAccount {
    return {
      id: String(raw.id),
      restaurantId,
      status: StripeMapper.status(raw),
      country: String(raw.country ?? "BR"),
      defaultCurrency: String(raw.default_currency ?? "brl"),
      detailsSubmitted: !!raw.details_submitted,
      chargesEnabled: !!raw.charges_enabled,
      payoutsEnabled: !!raw.payouts_enabled,
      createdAt: raw.created
        ? new Date(Number(raw.created) * 1000).toISOString()
        : new Date().toISOString(),
    };
  },

  status(raw: Raw): StripeAccountStatus {
    if (raw?.requirements?.disabled_reason === "rejected.fraud") return "rejected";
    if (raw?.requirements?.disabled_reason) return "disabled";
    if (!raw?.details_submitted) return "onboarding_pending";
    if (Array.isArray(raw?.requirements?.currently_due) && raw.requirements.currently_due.length > 0)
      return "onboarding_incomplete";
    if (raw?.charges_enabled && raw?.payouts_enabled) return "active";
    if (raw?.requirements?.pending_verification?.length) return "restricted";
    return "onboarding_incomplete";
  },

  capabilities(raw: Raw): StripeCapabilities {
    const norm = (v?: string): "active" | "pending" | "inactive" =>
      v === "active" ? "active" : v === "pending" ? "pending" : "inactive";
    return {
      cardPayments: norm(raw?.card_payments),
      transfers: norm(raw?.transfers),
      boletoPayments: raw?.boleto_payments ? norm(raw.boleto_payments) : undefined,
      pixPayments: raw?.pix_payments ? norm(raw.pix_payments) : undefined,
    };
  },

  balance(raw: Raw): StripeBalance {
    const av = Array.isArray(raw?.available) ? raw.available[0] : {};
    const pd = Array.isArray(raw?.pending) ? raw.pending[0] : {};
    const rs = Array.isArray(raw?.connect_reserved) ? raw.connect_reserved[0] : {};
    return {
      available: Number(av?.amount ?? 0),
      pending: Number(pd?.amount ?? 0),
      reserved: Number(rs?.amount ?? 0),
      currency: String(av?.currency ?? pd?.currency ?? "brl"),
    };
  },

  transfer(raw: Raw): StripeTransfer {
    return {
      id: String(raw.id),
      amount: Number(raw.amount ?? 0),
      currency: String(raw.currency ?? "brl"),
      destination: String(raw.destination ?? ""),
      createdAt: raw.created
        ? new Date(Number(raw.created) * 1000).toISOString()
        : new Date().toISOString(),
      status: (raw.status as StripeTransfer["status"]) ?? "pending",
    };
  },

  webhookEvent(raw: Raw): StripeWebhookEvent {
    return {
      id: String(raw.id),
      type: String(raw.type),
      createdAt: raw.created
        ? new Date(Number(raw.created) * 1000).toISOString()
        : new Date().toISOString(),
      livemode: !!raw.livemode,
      data: (raw.data ?? {}) as Record<string, unknown>,
    };
  },
};

export default StripeMapper;
