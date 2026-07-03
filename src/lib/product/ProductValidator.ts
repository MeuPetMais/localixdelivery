import type { ProductRecord, ProductValidationIssue, ProductValidationResult } from "./types";

/**
 * ProductValidator — pure, side-effect free.
 * Ensures a product satisfies minimum publishable rules.
 */
export const ProductValidator = {
  validate(input: Partial<ProductRecord>, opts?: { requirePublishable?: boolean }): ProductValidationResult {
    const issues: ProductValidationIssue[] = [];
    const requirePublishable = opts?.requirePublishable ?? false;

    if (!input.name || String(input.name).trim().length < 2) {
      issues.push({ field: "name", message: "Nome do produto é obrigatório (mín. 2 caracteres)." });
    }
    if (input.price === undefined || input.price === null || Number.isNaN(Number(input.price))) {
      issues.push({ field: "price", message: "Preço é obrigatório." });
    } else if (Number(input.price) < 0) {
      issues.push({ field: "price", message: "Preço não pode ser negativo." });
    }
    if (input.promo_price !== null && input.promo_price !== undefined) {
      if (Number(input.promo_price) < 0) {
        issues.push({ field: "promo_price", message: "Preço promocional não pode ser negativo." });
      } else if (input.price !== undefined && Number(input.promo_price) >= Number(input.price)) {
        issues.push({ field: "promo_price", message: "Preço promocional deve ser menor que o preço regular." });
      }
    }
    if (input.promo_starts_at && input.promo_ends_at) {
      if (Date.parse(input.promo_ends_at) <= Date.parse(input.promo_starts_at)) {
        issues.push({ field: "promo_ends_at", message: "Fim da promoção deve ser após o início." });
      }
    }
    if (requirePublishable) {
      if (!input.category_id) {
        issues.push({ field: "category_id", message: "Categoria é obrigatória para publicar." });
      }
      if (!input.image_url) {
        issues.push({ field: "image_url", message: "Imagem é obrigatória para publicar." });
      }
      if (!input.description || String(input.description).trim().length < 4) {
        issues.push({ field: "description", message: "Descrição é obrigatória para publicar." });
      }
    }

    return { ok: issues.length === 0, issues };
  },
} as const;
