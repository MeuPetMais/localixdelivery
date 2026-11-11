import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), publish: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
vi.mock("./CustomerEventBus", () => ({ CustomerEventBus: { publish: mocks.publish } }));
import { CustomerService } from "./CustomerService";
beforeEach(() => vi.clearAllMocks());
it("updates supported nullable profile fields while scoping the customer", async () => {
  const patch = { full_name: "Customer", phone: null, avatar_url: null };
  const maybeSingle = vi
    .fn()
    .mockResolvedValue({ data: { id: "customer", ...patch }, error: null });
  const eq = vi.fn().mockReturnValue({ select: () => ({ maybeSingle }) });
  const update = vi.fn().mockReturnValue({ eq });
  mocks.from.mockReturnValue({ update });
  expect(await CustomerService.updateProfile("customer", patch)).toMatchObject(patch);
  expect(update).toHaveBeenCalledWith(patch);
  expect(eq).toHaveBeenCalledWith("id", "customer");
  expect(mocks.publish).toHaveBeenCalledWith(
    expect.objectContaining({ type: "CustomerUpdated", changes: patch }),
  );
});
it.each([{ status: "BLOCKED" as const }, { notes: null }])(
  "rejects fields absent from customer_profiles before writing %j",
  async (patch) => {
    await expect(CustomerService.updateProfile("customer", patch)).rejects.toThrow(
      "current schema",
    );
    expect(mocks.from).not.toHaveBeenCalled();
  },
);
