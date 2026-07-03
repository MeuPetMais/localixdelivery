import type { Ingredient, MovementType } from "./types";

export interface ValidationIssue { field: string; message: string; }
export interface ValidationResult { valid: boolean; issues: ValidationIssue[]; }

export function validateMovement(
  ingredient: Ingredient | null | undefined,
  type: MovementType,
  quantity: number,
): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!ingredient) issues.push({ field: "ingredient", message: "Ingrediente não encontrado" });
  else if (!ingredient.active) issues.push({ field: "ingredient", message: "Ingrediente inativo" });
  if (!Number.isFinite(quantity)) issues.push({ field: "quantity", message: "Quantidade inválida" });
  if (quantity <= 0 && type !== "ADJUSTMENT")
    issues.push({ field: "quantity", message: "Quantidade deve ser positiva" });

  if (ingredient && (type === "EXIT" || type === "SALE" || type === "PRODUCTION" || type === "LOSS")) {
    const available = Number(ingredient.stock) - Number(ingredient.reserved_stock ?? 0);
    if (quantity > available)
      issues.push({ field: "stock", message: `Estoque insuficiente (disponível: ${available})` });
  }
  if (ingredient && type === "RESERVE") {
    const available = Number(ingredient.stock) - Number(ingredient.reserved_stock ?? 0);
    if (quantity > available)
      issues.push({ field: "stock", message: `Sem estoque para reservar (disponível: ${available})` });
  }
  if (ingredient && type === "RELEASE") {
    if (quantity > Number(ingredient.reserved_stock ?? 0))
      issues.push({ field: "reserved_stock", message: "Reserva insuficiente para liberar" });
  }
  return { valid: issues.length === 0, issues };
}
