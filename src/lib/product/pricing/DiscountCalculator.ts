// Calcula o valor de desconto de uma promoção sobre o carrinho.
// Puro — sem IO. Não altera preços de forma final: apenas retorna o desconto.
import type { AppliedPromotion, CartLine, Promotion } from "./types";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function targetedLines(promotion: Promotion, lines: CartLine[]): CartLine[] {
  const targets = promotion.targets ?? [];
  if (targets.length === 0 || targets.some((t) => t.target_type === "all")) return lines;
  const productIds = new Set(
    targets.filter((t) => t.target_type === "product" && t.target_id).map((t) => t.target_id!),
  );
  const categoryIds = new Set(
    targets.filter((t) => t.target_type === "category" && t.target_id).map((t) => t.target_id!),
  );
  return lines.filter(
    (l) => productIds.has(l.product_id) || (l.category_id && categoryIds.has(l.category_id)),
  );
}

export const DiscountCalculator = {
  calculate(promotion: Promotion, lines: CartLine[], deliveryFee = 0): AppliedPromotion | null {
    const scope = targetedLines(promotion, lines);
    const scopeSubtotal = scope.reduce((s, l) => s + l.unit_price * l.quantity, 0);

    const base: AppliedPromotion = {
      promotion_id: promotion.id,
      name: promotion.name,
      discount_type: promotion.discount_type,
      discount_amount: 0,
      matched_lines: scope.map((l) => l.product_id),
    };

    switch (promotion.discount_type) {
      case "FIXED_AMOUNT":
        base.discount_amount = round2(Math.min(promotion.discount_value, scopeSubtotal));
        break;
      case "PERCENTAGE":
        base.discount_amount = round2(scopeSubtotal * (promotion.discount_value / 100));
        break;
      case "FIXED_PRICE": {
        // Cada linha alvo passa a custar discount_value por unidade (se menor).
        let discount = 0;
        for (const l of scope) {
          const newTotal = promotion.discount_value * l.quantity;
          const cur = l.unit_price * l.quantity;
          if (newTotal < cur) discount += cur - newTotal;
        }
        base.discount_amount = round2(discount);
        break;
      }
      case "BUY_X_GET_Y": {
        const buyX = Number(promotion.config?.buy_x ?? 1);
        const getY = Number(promotion.config?.get_y ?? 1);
        if (buyX <= 0 || getY <= 0 || scope.length === 0) return null;
        // Item mais barato dos alvos = grátis, respeitando proporção
        const sorted = [...scope].sort((a, b) => a.unit_price - b.unit_price);
        const totalQty = scope.reduce((s, l) => s + l.quantity, 0);
        const cycles = Math.floor(totalQty / (buyX + getY));
        const freeQty = cycles * getY;
        base.discount_amount = round2(freeQty * (sorted[0]?.unit_price ?? 0));
        base.free_items =
          freeQty > 0 ? [{ product_id: sorted[0].product_id, quantity: freeQty }] : [];
        break;
      }
      case "FREE_ITEM": {
        const productId = (promotion.config?.product_id as string) ?? scope[0]?.product_id;
        const qty = Number(promotion.config?.quantity ?? 1);
        const line = lines.find((l) => l.product_id === productId);
        if (!line) return null;
        base.discount_amount = round2(Math.min(qty, line.quantity) * line.unit_price);
        base.free_items = [{ product_id: productId, quantity: qty }];
        break;
      }
      case "FREE_DELIVERY":
        base.discount_amount = round2(deliveryFee);
        base.free_delivery = true;
        break;
    }

    if (base.discount_amount <= 0 && !base.free_delivery) return null;
    return base;
  },
};
