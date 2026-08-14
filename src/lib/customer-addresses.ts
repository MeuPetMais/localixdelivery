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

export type CheckoutAddressInput = {
  cep?: string | null;
  street?: string | null;
  number?: string | null;
  numberOverride?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  reference?: string | null;
};

const T = supabase.from("customer_addresses");

function normalizeText(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizeDigits(value?: string | null) {
  return (value ?? "").replace(/\D/g, "");
}

function normalizeNumber(value?: string | null) {
  return normalizeText(value).replace(/\s+/g, "");
}

function addressesMatch(a: CustomerAddress, input: CheckoutAddressInput) {
  const inputCep = normalizeDigits(input.cep);
  const inputNumber = normalizeNumber(input.number ?? input.numberOverride);
  return (
    normalizeDigits(a.cep) === inputCep &&
    normalizeText(a.street) === normalizeText(input.street) &&
    normalizeNumber(a.number) === inputNumber
  );
}

export async function listAddresses(userId: string): Promise<CustomerAddress[]> {
  const { data, error } = await T.select("*")
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

export async function persistCheckoutAddressForCustomer(
  userId: string,
  input: CheckoutAddressInput,
): Promise<CustomerAddress | null> {
  const street = input.street?.trim();
  const neighborhood = input.neighborhood?.trim();
  const number = (input.number ?? input.numberOverride)?.trim();

  if (!userId || !street || !neighborhood || !number) return null;

  const addresses = await listAddresses(userId);
  const existing = addresses.find((address) => addressesMatch(address, input));
  if (existing) return existing;

  return upsertAddress(userId, {
    label: "Casa",
    cep: input.cep ? normalizeDigits(input.cep) : null,
    street,
    number,
    complement: input.complement?.trim() || null,
    neighborhood,
    city: input.city?.trim() || null,
    state: input.state?.trim() || null,
    notes: input.reference?.trim() || null,
    is_default: addresses.length === 0,
  });
}

export async function setDefaultAddress(id: string) {
  const { error } = await T.update({ is_default: true }).eq("id", id);
  if (error) throw error;
}

export async function deleteAddress(id: string) {
  const { error } = await T.delete().eq("id", id);
  if (error) throw error;
}

export function formatAddressLine(
  a: Pick<CustomerAddress, "street" | "number" | "complement" | "neighborhood">,
) {
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
