import type { Supplier } from "./types";

export interface SupplierRepository {
  list(restaurantId: string): Promise<Supplier[]>;
  create(s: Omit<Supplier, "id">): Promise<Supplier>;
  update(id: string, patch: Partial<Supplier>): Promise<Supplier>;
  deactivate(id: string): Promise<void>;
}

export function createSupplierService(repo: SupplierRepository) {
  return {
    list(restaurantId: string) { return repo.list(restaurantId); },
    create(s: Omit<Supplier, "id">) { return repo.create(s); },
    update(id: string, patch: Partial<Supplier>) { return repo.update(id, patch); },
    deactivate(id: string) { return repo.deactivate(id); },
  };
}

export type SupplierService = ReturnType<typeof createSupplierService>;
