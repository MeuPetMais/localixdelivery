import { supabase } from "@/integrations/supabase/client";

export type CustomerAddress = {
  id: string;
  customer_id: string;
  label: string;
  cep: string | null;
  street: string;
  number: string | null;
  complement: string | null;
  neighborhood: string;
  city: string | null;
  state: string | null;
  notes: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type AddressInput = Omit<
  Partial<CustomerAddress>,
  "id" | "customer_id" | "created_at" | "updated_at"
> & { street: string; neighborhood: string; label: string };

const T = (supabase as any).from("customer_addresses");

export async function listAddresses(userId: string): Promise<CustomerAddress[]> {
  const { data, error } = await T
    .select("*")
    .eq("customer_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CustomerAddress[];
}

export async function upsertAddress(userId: string, input: AddressInput & { id?: string }) {
  const payload = { ...input, customer_id: userId };
  if (input.id) {
    const { data, error } = await T.update(payload).eq("id", input.id).select().maybeSingle();
    if (error) throw error;
    return data as CustomerAddress;
  }
  const { data, error } = await T.insert(payload).select().maybeSingle();
  if (error) throw error;
  return data as CustomerAddress;
}

export async function setDefaultAddress(id: string) {
  const { error } = await T.update({ is_default: true }).eq("id", id);
  if (error) throw error;
}

export async function deleteAddress(id: string) {
  const { error } = await T.delete().eq("id", id);
  if (error) throw error;
}

export function formatAddressLine(a: Pick<CustomerAddress, "street" | "number" | "complement" | "neighborhood">) {
  const streetLine = [a.street, a.number].filter(Boolean).join(", ");
  const parts = [streetLine];
  if (a.complement) parts.push(a.complement);
  if (a.neighborhood) parts.push(a.neighborhood);
  return parts.filter(Boolean).join(" — ");
}

export function formatFullAddress(a: CustomerAddress) {
  const base = formatAddressLine(a);
  const cityState = [a.city, a.state].filter(Boolean).join("/");
  return [base, cityState].filter(Boolean).join(" · ");
}
