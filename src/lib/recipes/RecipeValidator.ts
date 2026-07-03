import type { Ingredient } from "@/lib/inventory/types";
import type { RecipeItemInput } from "./types";

export interface ValidationIssue { code: string; message: string; }
export interface ValidationResult { valid: boolean; issues: ValidationIssue[]; }

export function validateRecipe(
  items: RecipeItemInput[],
  ingredients: Ingredient[],
): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!items || items.length === 0) issues.push({ code: "EMPTY", message: "Receita sem ingredientes." });

  const known = new Set(ingredients.map((i) => i.id));
  const seen = new Set<string>();
  for (const it of items ?? []) {
    if (it.substitute_of) continue; // substitutes may repeat ingredient
    if (seen.has(it.ingredient_id)) issues.push({ code: "DUP", message: `Ingrediente duplicado: ${it.ingredient_id}` });
    seen.add(it.ingredient_id);
    if (!known.has(it.ingredient_id)) issues.push({ code: "MISSING", message: `Ingrediente inexistente: ${it.ingredient_id}` });
    if (Number(it.quantity) < 0) issues.push({ code: "NEG", message: `Quantidade negativa em ${it.ingredient_id}` });
    if (it.loss_percentage != null && (it.loss_percentage < 0 || it.loss_percentage >= 100))
      issues.push({ code: "LOSS", message: `Perda inválida em ${it.ingredient_id}` });
  }
  return { valid: issues.length === 0, issues };
}
