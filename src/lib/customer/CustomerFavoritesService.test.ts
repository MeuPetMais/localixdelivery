import { describe, it, expect, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), publish: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
vi.mock("./CustomerEventBus", () => ({ CustomerEventBus: { publish: mocks.publish } }));
import { CustomerFavoritesService } from "./CustomerFavoritesService";
beforeEach(() => vi.clearAllMocks());
describe("favorite schema adapter", () => {
  it("inserts the actual item and tenant columns", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    mocks.from.mockImplementation((table) =>
      table === "menu_items"
        ? {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: { restaurant_id: "rest" }, error: null }),
              }),
            }),
          }
        : { insert },
    );
    await CustomerFavoritesService.add("customer", "product", "item");
    expect(insert).toHaveBeenCalledWith({
      customer_id: "customer",
      restaurant_id: "rest",
      item_kind: "menu_item",
      item_id: "item",
    });
    expect(mocks.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: "FavoriteAdded", targetType: "product", targetId: "item" }),
    );
  });
  it("rejects unsupported targets before writing", async () => {
    await expect(CustomerFavoritesService.add("customer", "category", "category")).rejects.toThrow(
      "Only product",
    );
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });
  it("lists products using schema columns without crossing customer boundaries", async () => {
    const result = {
      data: [
        {
          id: "fav",
          customer_id: "customer",
          item_id: "item",
          item_kind: "menu_item",
          created_at: "now",
        },
      ],
      error: null,
    };
    const eqKind = vi.fn().mockResolvedValue(result);
    const eqCustomer = vi.fn().mockReturnValue({ order: () => ({ eq: eqKind }) });
    mocks.from.mockReturnValue({ select: () => ({ eq: eqCustomer }) });
    expect(await CustomerFavoritesService.list("customer", "product")).toEqual([
      {
        id: "fav",
        customer_id: "customer",
        target_type: "product",
        target_id: "item",
        created_at: "now",
      },
    ]);
    expect(eqCustomer).toHaveBeenCalledWith("customer_id", "customer");
    expect(eqKind).toHaveBeenCalledWith("item_kind", "menu_item");
  });
  it("removes only the specified customer's product favorite", async () => {
    const item = vi.fn().mockResolvedValue({ error: null });
    const kind = vi.fn().mockReturnValue({ eq: item });
    const customer = vi.fn().mockReturnValue({ eq: kind });
    mocks.from.mockReturnValue({ delete: () => ({ eq: customer }) });
    await CustomerFavoritesService.remove("customer", "product", "item");
    expect(customer).toHaveBeenCalledWith("customer_id", "customer");
    expect(kind).toHaveBeenCalledWith("item_kind", "menu_item");
    expect(item).toHaveBeenCalledWith("item_id", "item");
  });
});
