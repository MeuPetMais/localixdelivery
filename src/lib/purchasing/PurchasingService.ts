import type {
  PurchasingRepository, PurchaseRequest, PurchaseRequestItem, Supplier, SupplierQuote,
} from "./types";
import { PurchaseEventBus } from "./PurchaseEventBus";

export class PurchasingService {
  constructor(private repo: PurchasingRepository) {}

  // -------- Suppliers
  listSuppliers(restaurantId: string) { return this.repo.listSuppliers(restaurantId); }
  getSupplier(id: string) { return this.repo.getSupplier(id); }
  async createSupplier(s: Partial<Supplier> & { name: string; restaurant_id?: string | null }) {
    const rec = await this.repo.upsertSupplier({ active: true, ...s });
    PurchaseEventBus.emit({ name: "SupplierCreated", supplierId: rec.id });
    return rec;
  }
  async updateSupplier(id: string, changes: Partial<Supplier>) {
    const rec = await this.repo.upsertSupplier({ id, name: changes.name ?? "" , ...changes });
    PurchaseEventBus.emit({ name: "SupplierChanged", supplierId: id, changes });
    return rec;
  }

  // -------- Requests
  async requestPurchase(input: {
    restaurant_id: string;
    items: PurchaseRequestItem[];
    reason?: string;
    requested_by?: string;
    notes?: string;
  }): Promise<PurchaseRequest> {
    if (!input.items?.length) throw new Error("Purchase request needs items");
    const req = await this.repo.createRequest({
      restaurant_id: input.restaurant_id,
      items: input.items,
      reason: input.reason,
      requested_by: input.requested_by,
      approved_by: null,
      notes: input.notes,
      status: "OPEN",
    });
    PurchaseEventBus.emit({ name: "PurchaseRequested", requestId: req.id, restaurantId: req.restaurant_id });
    return req;
  }

  async approveRequest(id: string, approvedBy?: string) {
    const rec = await this.repo.updateRequestStatus(id, "APPROVED", approvedBy);
    PurchaseEventBus.emit({ name: "PurchaseApproved", requestId: id, approvedBy });
    return rec;
  }
  rejectRequest(id: string, actor?: string) {
    return this.repo.updateRequestStatus(id, "REJECTED", actor);
  }
  markOrdered(id: string) { return this.repo.updateRequestStatus(id, "ORDERED"); }
  listRequests(restaurantId: string) { return this.repo.listRequests(restaurantId); }

  // -------- Quotes
  createQuote(q: Omit<SupplierQuote, "id">) { return this.repo.createQuote(q); }
  listQuotes(f: { restaurant_id: string; ingredient_id?: string }) { return this.repo.listQuotes(f); }
}
