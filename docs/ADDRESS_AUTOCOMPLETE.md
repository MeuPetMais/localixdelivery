# Address Autocomplete

Busca inteligente de endereço no checkout. Substitui o campo livre por uma
experiência com sugestões em tempo real, seleção guiada, mapa e validação de
área de entrega — sem alterar Checkout, Payment, Order ou Delivery domains.

## Arquitetura

```
Checkout ─▶ AddressAutocomplete ─▶ AddressService ─▶ AddressProvider
                                                     ├─ NominatimProvider (default)
                                                     ├─ (Google Places)
                                                     ├─ (Mapbox)
                                                     ├─ (HERE)
                                                     └─ (TomTom)
```

- **`src/lib/address/types.ts`** — `AddressProvider`, `AddressSuggestion`,
  `AddressDetails`, `DeliveryAreaCheck`.
- **`src/lib/address/providers/NominatimProvider.ts`** — implementação
  OpenStreetMap/Nominatim (sem chave). Trocar por outro provedor não exige
  mudanças no Checkout.
- **`src/lib/address/AddressService.ts`** — fachada única exposta ao
  Checkout. API:
  - `search(query, { signal })`
  - `details(suggestion, { signal })`
  - `validateDeliveryArea(details, { restaurantSlug })` — extension point
  - `getRecent()` — cache local (localStorage, últimos 5)
- **`src/components/checkout/AddressAutocomplete.tsx`** — UI: debounce
  300 ms, teclado (↑ ↓ Enter Esc), endereços salvos e recentes primeiro,
  preview em mapa (OSM embed), campos condicionais (Número obrigatório
  quando o provider não retorna), Complemento e Ponto de referência
  opcionais.

## Contrato do provedor

```ts
interface AddressProvider {
  id: string;
  search(query: string, opts?: { signal?: AbortSignal }): Promise<AddressSuggestion[]>;
  details(suggestion: AddressSuggestion, opts?: { signal?: AbortSignal }): Promise<AddressDetails>;
}
```

Para adicionar Google Places / Mapbox / HERE / TomTom, criar novo arquivo em
`src/lib/address/providers/` implementando `AddressProvider` e passar para
`createAddressService(newProvider)` ou trocar o default em
`getAddressService()`. Nenhuma alteração no Checkout.

## Validação de área

`AddressService.validateDeliveryArea` é o único ponto de plugagem com o
Delivery Domain. Hoje valida coordenadas; ao habilitar cobertura real,
chamar aqui o DeliveryService — o Checkout continua desacoplado.

## Cache

- Recentes: `localStorage["localix:address:recent"]` (últimos 5).
- Sugestões: `AbortController` cancela consultas obsoletas.

## Acessibilidade

- Foco automático em mobile (`autoFocus`).
- Navegação por teclado (setas, Enter, Esc).
- `role="listbox"` / `role="option"` / `aria-selected` / `aria-expanded`.

## Testes

`src/lib/address/AddressService.test.ts` cobre: consulta curta ignorada,
busca via provider, cache de recentes, aceite/rejeição da validação de área.
