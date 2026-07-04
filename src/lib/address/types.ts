export type AddressSuggestion = {
  id: string;
  label: string;      // linha principal ex.: "Avenida Paulista, 1578"
  secondary: string;  // "Bela Vista - São Paulo/SP"
  raw?: unknown;
};

export type AddressDetails = {
  id: string;
  street: string;
  number: string | null;
  neighborhood: string;
  city: string;
  state: string;
  cep: string;
  lat: number;
  lng: number;
  label: string;
  secondary: string;
};

export type DeliveryAreaCheck = {
  ok: boolean;
  reason?: string;
};

export interface AddressProvider {
  readonly id: string;
  search(query: string, opts?: { signal?: AbortSignal }): Promise<AddressSuggestion[]>;
  details(suggestion: AddressSuggestion, opts?: { signal?: AbortSignal }): Promise<AddressDetails>;
}
