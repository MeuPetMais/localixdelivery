import type { Ingredient } from "./types";

export interface IngredientRepository {
  list(restaurantId: string): Promise<Ingredient[]>;
  get(id: string): Promise<Ingredient | null>;
  create(i: Omit<Ingredient, "id">): Promise<Ingredient>;
  update(id: string, patch: Partial<Ingredient>): Promise<Ingredient>;
  remove(id: string): Promise<void>;
}

export function createIngredientService(repo: IngredientRepository) {
  return {
    list(restaurantId: string) { return repo.list(restaurantId); },
    get(id: string) { return repo.get(id); },
    create(i: Omit<Ingredient, "id">) { return repo.create(i); },
    update(id: string, patch: Partial<Ingredient>) { return repo.update(id, patch); },
    remove(id: string) { return repo.remove(id); },
  };
}

export type IngredientService = ReturnType<typeof createIngredientService>;
