import type { PaymentProvider } from "./PaymentProvider";
import { MercadoPagoProvider } from "./MercadoPagoProvider";

// Registro central de providers. Novos gateways são adicionados aqui.
export const paymentProviders: Record<string, PaymentProvider> = {
  mercado_pago: MercadoPagoProvider,
  // pagarme: PagarmeProvider,   // Prompt futuro
  // asaas:   AsaasProvider,     // Prompt futuro
  // stripe:  StripeProvider,    // Prompt futuro
};

export function getProvider(id: string): PaymentProvider {
  const p = paymentProviders[id];
  if (!p) throw new Error(`Provider desconhecido: ${id}`);
  return p;
}

export type { PaymentProvider } from "./PaymentProvider";
