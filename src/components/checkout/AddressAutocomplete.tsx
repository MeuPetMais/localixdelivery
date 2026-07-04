import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MapPin, Search, Star, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAddressService } from "@/lib/address/AddressService";
import type { AddressDetails, AddressSuggestion } from "@/lib/address/types";

const DEBOUNCE_MS = 300;

export type SelectedAddress = AddressDetails & {
  complement?: string;
  reference?: string;
  numberOverride?: string;
};

type Saved = { id: string; label: string; details: AddressDetails };

export function AddressAutocomplete({
  value,
  onChange,
  saved = [],
  restaurantSlug,
  autoFocus,
}: {
  value: SelectedAddress | null;
  onChange: (v: SelectedAddress | null) => void;
  saved?: Saved[];
  restaurantSlug?: string;
  autoFocus?: boolean;
}) {
  const service = useMemo(() => getAddressService(), []);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [areaError, setAreaError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<AddressDetails[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setRecent(service.getRecent()); }, [service]);
  useEffect(() => { if (autoFocus) inputRef.current?.focus(); }, [autoFocus]);

  // debounce search
  useEffect(() => {
    if (value) return; // já selecionado
    const q = query.trim();
    if (q.length < 3) { setItems([]); return; }
    const ctrl = new AbortController();
    setLoading(true); setError(null);
    const t = setTimeout(() => {
      service.search(q, { signal: ctrl.signal })
        .then((r) => { setItems(r); setActive(0); })
        .catch((e) => { if (e?.name !== "AbortError") setError(e?.message ?? "Falha na busca"); })
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query, service, value]);

  const select = useCallback(async (s: AddressSuggestion | AddressDetails) => {
    try {
      const details = "street" in s ? s : await service.details(s);
      const area = await service.validateDeliveryArea(details, { restaurantSlug });
      if (!area.ok) {
        setAreaError(area.reason ?? "Este endereço está fora da área de entrega.");
        onChange(null);
        return;
      }
      setAreaError(null);
      setOpen(false);
      setQuery("");
      onChange({ ...details });
      setRecent(service.getRecent());
    } catch (e: any) {
      setError(e?.message ?? "Não foi possível carregar o endereço");
    }
  }, [onChange, restaurantSlug, service]);

  const clear = useCallback(() => { onChange(null); setAreaError(null); setQuery(""); setTimeout(() => inputRef.current?.focus(), 0); }, [onChange]);

  const list = items;
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, list.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && list[active]) { e.preventDefault(); void select(list[active]); }
    else if (e.key === "Escape") { setOpen(false); }
  }

  if (value) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-semibold">{value.label}</p>
                <p className="text-xs text-muted-foreground">{value.secondary}</p>
                {value.cep && <p className="text-xs text-muted-foreground">CEP {value.cep}</p>}
              </div>
            </div>
            <button type="button" onClick={clear} className="text-xs text-muted-foreground hover:text-foreground" aria-label="Trocar endereço">
              <X className="h-4 w-4" />
            </button>
          </div>
          <MapPreview lat={value.lat} lng={value.lng} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {!value.number && (
            <div className="col-span-2 space-y-1.5">
              <Label>Número *</Label>
              <Input
                required
                inputMode="numeric"
                value={value.numberOverride ?? ""}
                onChange={(e) => onChange({ ...value, numberOverride: e.target.value })}
                placeholder="123"
              />
            </div>
          )}
          <div className="col-span-2 space-y-1.5">
            <Label>Complemento (opcional)</Label>
            <Input
              value={value.complement ?? ""}
              onChange={(e) => onChange({ ...value, complement: e.target.value })}
              placeholder="Apto 12, bloco B"
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Ponto de referência (opcional)</Label>
            <Input
              value={value.reference ?? ""}
              onChange={(e) => onChange({ ...value, reference: e.target.value })}
              placeholder="Ao lado da farmácia"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          className="pl-9"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Digite sua rua, avenida ou CEP"
          aria-autocomplete="list"
          aria-expanded={open}
        />
      </div>

      {areaError && <p className="text-xs text-destructive">{areaError}</p>}

      {open && (
        <div className="overflow-hidden rounded-lg border bg-popover shadow-sm">
          {saved.length > 0 && query.trim().length < 3 && (
            <div className="border-b p-2">
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase text-muted-foreground">Salvos</p>
              {saved.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                  onClick={() => void select(s.details)}
                >
                  <Star className="h-4 w-4 text-primary" />
                  <span className="font-medium">{s.label}</span>
                  <span className="truncate text-xs text-muted-foreground">{s.details.label}</span>
                </button>
              ))}
            </div>
          )}
          {recent.length > 0 && query.trim().length < 3 && (
            <div className="border-b p-2">
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase text-muted-foreground">Recentes</p>
              {recent.map((r) => (
                <button key={r.id} type="button"
                  className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                  onClick={() => void select(r)}>
                  <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate">{r.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.secondary}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          <div role="listbox" className="max-h-72 overflow-y-auto p-1">
            {loading && (
              <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Buscando…
              </div>
            )}
            {!loading && error && <p className="p-3 text-sm text-destructive">{error}</p>}
            {!loading && !error && query.trim().length >= 3 && list.length === 0 && (
              <p className="p-3 text-sm text-muted-foreground">Nenhum endereço encontrado.</p>
            )}
            {list.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => void select(s)}
                className={`flex min-h-14 w-full items-start gap-2 rounded-md p-2 text-left text-sm ${i === active ? "bg-muted" : "hover:bg-muted"}`}
              >
                <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{s.secondary}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MapPreview({ lat, lng }: { lat: number; lng: number }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const d = 0.004;
  const bbox = `${lng - d},${lat - d},${lng + d},${lat + d}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
  return (
    <div className="mt-3 overflow-hidden rounded-md border">
      <iframe title="Mapa do endereço" src={src} className="h-40 w-full" loading="lazy" />
    </div>
  );
}

export function formatFullAddress(a: SelectedAddress): string {
  const num = a.number ?? a.numberOverride ?? "";
  const line1 = [a.street, num].filter(Boolean).join(", ");
  const line2 = [a.neighborhood, [a.city, a.state].filter(Boolean).join("/")].filter(Boolean).join(" - ");
  const extra = [a.complement && `Compl.: ${a.complement}`, a.reference && `Ref.: ${a.reference}`, a.cep && `CEP ${a.cep}`].filter(Boolean).join(" · ");
  return [line1, line2, extra].filter(Boolean).join(" — ");
}
