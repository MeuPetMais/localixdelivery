// Rótulos legíveis para o `orders.payment_method` (cliente e restaurante).
// Usados em: painel do restaurante, meus pedidos, detalhe do pedido,
// impressão/comanda e notificações.
const LABELS: Record<string, string> = {
  pix: "Pix",
  credit_card: "Cartão Online",
  credit: "Cartão Online",
  debit_card: "Cartão Online",
  debit: "Cartão Online",
  card_on_delivery: "💳 Cartão na entrega",
  "cartao na entrega": "💳 Cartão na entrega",
  "cartão na entrega": "💳 Cartão na entrega",
  cash: "💵 Dinheiro",
  dinheiro: "💵 Dinheiro",
  especie: "💵 Dinheiro",
  "espécie": "💵 Dinheiro",
  meal_voucher: "🍽️ Vale Alimentação / Refeição",
  food_voucher: "🍽️ Vale Alimentação / Refeição",
  vr: "🍽️ Vale Alimentação / Refeição",
  va: "🍽️ Vale Alimentação / Refeição",
  "vale refeicao": "🍽️ Vale Alimentação / Refeição",
  "vale refeição": "🍽️ Vale Alimentação / Refeição",
  "vale alimentacao": "🍽️ Vale Alimentação / Refeição",
  "vale alimentação": "🍽️ Vale Alimentação / Refeição",
  google_pay: "Google Pay",
  apple_pay: "Apple Pay",
};

function normalizeMethodKey(method: string): string {
  return String(method).trim().toLowerCase();
}

export function paymentMethodLabel(method?: string | null): string {
  if (!method) return "—";
  const key = normalizeMethodKey(method);
  return LABELS[key] ?? method;
}

// Métodos pagos fora do app (na entrega).
const OFFLINE_KEYS = new Set([
  "cash",
  "dinheiro",
  "especie",
  "espécie",
  "card_delivery",
  "card_on_delivery",
  "cartao na entrega",
  "cartão na entrega",
  "meal_voucher",
  "food_voucher",
  "vr",
  "va",
  "vale refeicao",
  "vale refeição",
  "vale alimentacao",
  "vale alimentação",
]);

export function isOfflinePaymentMethod(method?: string | null): boolean {
  if (!method) return false;
  return OFFLINE_KEYS.has(normalizeMethodKey(method));
}


/**
 * Mensagem de notificação exibida ao cliente quando o pedido entra em
 * "aguardando aceite do restaurante" (status `pago`).
 *
 * - Pagamentos online (PIX / Cartão Online): confirma o pagamento.
 * - Pagamentos na entrega: apenas informa que o pedido foi enviado.
 */
export function orderReceivedNotification(method?: string | null): {
  title: string;
  description: string;
} {
  const key = String(method ?? "").toLowerCase();
  switch (key) {
    case "pix":
    case "credit_card":
    case "google_pay":
    case "apple_pay":
      return {
        title: "💳 Pagamento aprovado",
        description:
          "Recebemos seu pagamento. Aguardando confirmação do restaurante.",
      };
    case "cash":
      return {
        title: "🧾 Pedido recebido",
        description:
          "Seu pedido foi enviado ao restaurante e aguarda confirmação.",
      };
    case "card_on_delivery":
      return {
        title: "💳 Pedido recebido",
        description:
          "Seu pedido foi enviado ao restaurante. O pagamento será realizado na entrega.",
      };
    case "meal_voucher":
      return {
        title: "🍽️ Pedido recebido",
        description:
          "Seu pedido foi enviado ao restaurante. O pagamento será realizado na entrega.",
      };
    default:
      return {
        title: "Pedido recebido",
        description:
          "Seu pedido foi enviado ao restaurante e aguarda confirmação.",
      };
  }
}
