// CustomerAddressService — thin domain wrapper reusing existing customer-addresses.ts.
import {
  listAddresses,
  upsertAddress,
  setDefaultAddress,
  deleteAddress,
  formatAddressLine,
  formatFullAddress,
  type CustomerAddress,
  type AddressInput,
} from "@/lib/customer-addresses";
import { CustomerEventBus } from "./CustomerEventBus";
import { CustomerValidator } from "./CustomerValidator";

export type { CustomerAddress, AddressInput };

export const CustomerAddressService = {
  list: listAddresses,
  format: formatAddressLine,
  formatFull: formatFullAddress,

  async save(userId: string, input: AddressInput & { id?: string }): Promise<CustomerAddress> {
    const v = CustomerValidator.validateAddress(input);
    if (!v.ok) throw new Error(v.issues.map((i) => i.message).join("; "));
    const isUpdate = !!input.id;
    const saved = await upsertAddress(userId, input);
    await CustomerEventBus.publish({
      type: isUpdate ? "AddressChanged" : "AddressAdded",
      customerId: userId,
      addressId: saved.id,
      at: new Date().toISOString(),
    });
    return saved;
  },

  async setDefault(userId: string, id: string): Promise<void> {
    await setDefaultAddress(id);
    await CustomerEventBus.publish({
      type: "AddressChanged",
      customerId: userId,
      addressId: id,
      at: new Date().toISOString(),
    });
  },

  async remove(userId: string, id: string): Promise<void> {
    await deleteAddress(id);
    await CustomerEventBus.publish({
      type: "AddressChanged",
      customerId: userId,
      addressId: id,
      at: new Date().toISOString(),
    });
  },
} as const;
