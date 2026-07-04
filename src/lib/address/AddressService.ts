import type { AddressDetails, AddressProvider, AddressSuggestion, DeliveryAreaCheck } from "./types";
import { NominatimProvider } from "./providers/NominatimProvider";

const RECENT_KEY = "localix:address:recent";
const RECENT_MAX = 5;

/**
 * AddressService — fachada única consumida pelo Checkout.
 * Desacopla o Checkout do provedor (Nominatim, Google Places, Mapbox, HERE…).
 * Troque o provider passando outra implementação para `create`.
 */
export class AddressService {
  constructor(private readonly provider: AddressProvider) {}

  get providerId() {
    return this.provider.id;
  }

  async search(query: string, opts?: { signal?: AbortSignal }): Promise<AddressSuggestion[]> {
    if (!query || query.trim().length < 3) return [];
    return this.provider.search(query, opts);
  }

  async details(suggestion: AddressSuggestion, opts?: { signal?: AbortSignal }): Promise<AddressDetails> {
    const d = await this.provider.details(suggestion, opts);
    this.pushRecent(d);
    return d;
  }

  /**
   * Extension point — hoje aceita todos os endereços válidos.
   * Ao ligar o DeliveryService de fato, plugar aqui sem tocar no Checkout.
   */
  async validateDeliveryArea(_details: AddressDetails, _ctx?: { restaurantSlug?: string }): Promise<DeliveryAreaCheck> {
    if (!Number.isFinite(_details.lat) || !Number.isFinite(_details.lng)) {
      return { ok: false, reason: "Coordenadas inválidas" };
    }
    return { ok: true };
  }

  getRecent(): AddressDetails[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      return raw ? (JSON.parse(raw) as AddressDetails[]) : [];
    } catch { return []; }
  }

  private pushRecent(d: AddressDetails) {
    if (typeof window === "undefined") return;
    try {
      const list = this.getRecent().filter((x) => x.id !== d.id);
      list.unshift(d);
      localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
    } catch {}
  }
}

let singleton: AddressService | null = null;
export function getAddressService(): AddressService {
  if (!singleton) singleton = new AddressService(NominatimProvider);
  return singleton;
}

/** Para testes / troca de provedor. */
export function createAddressService(provider: AddressProvider) {
  return new AddressService(provider);
}
