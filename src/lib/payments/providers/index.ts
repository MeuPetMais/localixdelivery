import type { PaymentProvider } from "./PaymentProvider";
import { MercadoPagoProvider } from "./MercadoPagoProvider";
import { StripeProvider } from "./StripeProvider";

// Registro central de providers. Novos gateways são adicionados aqui.
export const paymentProviders: Record<string, PaymentProvider> = {
  stripe: StripeProvider,
  mercado_pago: MercadoPagoProvider,
};

export const DEFAULT_PROVIDER_ID = "stripe";

export function getProvider(id: string = DEFAULT_PROVIDER_ID): PaymentProvider {
  const p = paymentProviders[id];
  if (!p) throw new Error(`Provider desconhecido: ${id}`);
  return p;
}

export type { PaymentProvider } from "./PaymentProvider";
