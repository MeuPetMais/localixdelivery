// Rótulos legíveis para o `orders.payment_method` (cliente e restaurante).
const LABELS: Record<string, string> = {
  pix: "Pix",
  credit_card: "Cartão Online",
  card_on_delivery: "Cartão na entrega",
  cash: "Dinheiro",
  meal_voucher: "Vale Refeição/Alimentação",
  google_pay: "Google Pay",
  apple_pay: "Apple Pay",
};

export function paymentMethodLabel(method?: string | null): string {
  if (!method) return "—";
  return LABELS[String(method).toLowerCase()] ?? method;
}
