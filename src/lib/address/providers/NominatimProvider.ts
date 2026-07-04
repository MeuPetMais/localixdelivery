import type { AddressDetails, AddressProvider, AddressSuggestion } from "../types";

type NominatimHit = {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    road?: string; pedestrian?: string; footway?: string; cycleway?: string;
    house_number?: string;
    suburb?: string; neighbourhood?: string; city_district?: string;
    city?: string; town?: string; village?: string; municipality?: string;
    state?: string; "ISO3166-2-lvl4"?: string;
    postcode?: string;
    country_code?: string;
  };
};

const BASE = "https://nominatim.openstreetmap.org";
const COUNTRY = "br";

function pickStreet(a: NominatimHit["address"]) {
  return a?.road ?? a?.pedestrian ?? a?.footway ?? a?.cycleway ?? "";
}
function pickNeighborhood(a: NominatimHit["address"]) {
  return a?.suburb ?? a?.neighbourhood ?? a?.city_district ?? "";
}
function pickCity(a: NominatimHit["address"]) {
  return a?.city ?? a?.town ?? a?.village ?? a?.municipality ?? "";
}
function pickState(a: NominatimHit["address"]) {
  const iso = a?.["ISO3166-2-lvl4"];
  if (iso && iso.startsWith("BR-")) return iso.slice(3);
  return a?.state ?? "";
}

function toSuggestion(hit: NominatimHit): AddressSuggestion {
  const street = pickStreet(hit.address);
  const number = hit.address?.house_number ?? "";
  const primary = [street, number].filter(Boolean).join(", ") || hit.display_name.split(",")[0];
  const secondary = [
    pickNeighborhood(hit.address),
    [pickCity(hit.address), pickState(hit.address)].filter(Boolean).join("/"),
  ].filter(Boolean).join(" — ");
  return { id: String(hit.place_id), label: primary, secondary, raw: hit };
}

function toDetails(hit: NominatimHit): AddressDetails {
  const s = toSuggestion(hit);
  return {
    id: s.id,
    street: pickStreet(hit.address),
    number: hit.address?.house_number ?? null,
    neighborhood: pickNeighborhood(hit.address),
    city: pickCity(hit.address),
    state: pickState(hit.address),
    cep: (hit.address?.postcode ?? "").replace(/\D/g, ""),
    lat: Number(hit.lat),
    lng: Number(hit.lon),
    label: s.label,
    secondary: s.secondary,
  };
}

export const NominatimProvider: AddressProvider = {
  id: "nominatim",
  async search(query, opts) {
    const q = query.trim();
    if (q.length < 3) return [];
    const url = `${BASE}/search?format=jsonv2&addressdetails=1&limit=6&countrycodes=${COUNTRY}&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { signal: opts?.signal, headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Falha na busca (${res.status})`);
    const hits = (await res.json()) as NominatimHit[];
    return hits.map(toSuggestion);
  },
  async details(suggestion) {
    const raw = suggestion.raw as NominatimHit | undefined;
    if (raw) return toDetails(raw);
    throw new Error("Detalhes indisponíveis para esta sugestão");
  },
};
