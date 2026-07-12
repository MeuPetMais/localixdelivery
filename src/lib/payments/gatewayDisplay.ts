// Helper centralizado para labels de gateway no checkout do cliente.
// Novos gateways: adicionar aqui e em nenhum outro lugar da UI.

export interface GatewayDisplay {
  name: string;
  pix: string;
  card: string;
  description: string;
}

export function getGatewayDisplay(providerId?: string | null): GatewayDisplay {
  switch (providerId) {
    case "stripe":
      return {
        name: "Stripe",
        pix: "Pix",
        card: "Cartão",
        description: "Pagamento seguro via Stripe.",
      };
    case "mercado_pago":
      return {
        name: "Mercado Pago",
        pix: "Pix",
        card: "Cartão",
        description: "Pagamento seguro via Mercado Pago.",
      };
    default:
      return {
        name: "Gateway",
        pix: "Pix",
        card: "Cartão",
        description: "Pagamento seguro.",
      };
  }
}
