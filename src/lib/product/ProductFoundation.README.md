# Product Domain — Foundation

Fundação do Product Domain do Localix. Camada independente, consumida por
Delivery / Cardápio / QR Code / Totem / Marketplace / Analytics / Marketing / IA.

## Arquitetura

```
src/lib/product/
├── types.ts                      # Contratos (ProductRecord, Lifecycle, Media, Audit)
├── ProductLifecycle.ts           # DRAFT → REVIEW → PUBLISHED → SCHEDULED → PAUSED → ARCHIVED → DISCONTINUED
├── ProductValidator.ts           # Regras de nome, preço, promo, publicabilidade
├── ProductAvailabilityService.ts # Lifecycle + canal + estoque (Inventory) + janela horária
├── ProductSearchService.ts       # Índice em memória (nome, tag, categoria) — full-text vem no 13.5.2
├── ProductEventBus.ts            # Pub/sub in-memory (mesmo padrão de CostEventBus)
├── ProductService.functions.ts   # createServerFn: create/update/transition/duplicate/list/health
└── index.ts                      # Barrel
```

## Persistência (novas tabelas)

| Tabela              | Papel                                                            | RLS |
|---------------------|------------------------------------------------------------------|-----|
| `product_versions`  | Histórico **imutável** de alterações (versão, status, changes)   | Owner read/insert; UPDATE/DELETE bloqueado por trigger |
| `product_media`     | Mídia estendida (image / video / model_3d) — complementa `menu_item_images` | Public SELECT + owner manage |
| `product_audit`     | Trilha de auditoria (quem fez o quê)                             | Owner read/insert |

**Reuso**: `menu_items`, `menu_categories`, `menu_item_images`, `builders*`,
`featured_sections`, `coupons`, `customer_favorites`, bucket `product-images`,
`image-upload.ts`, `ProductImageUploader.tsx`, `BuilderConfigurator.tsx`,
`public-restaurant.functions.ts` — nenhum foi alterado.

## Eventos publicados

`ProductCreated`, `ProductUpdated`, `ProductPublished`, `ProductArchived`,
`ProductDiscontinued`, `AvailabilityChanged`, `LifecycleChanged`.

## Integrações

- **Inventory Domain**: `ProductAvailabilityService.resolve(product, { stockAvailable })`. O Product Domain **não** consulta estoque diretamente — recebe o sinal do Inventory como *port*.
- **BusinessRulesEngine**: pode se inscrever em `ProductEventBus` para revalidar regras quando o produto muda.
- **TenantConfigurationService**: consumidores devem repassar preferências (ex.: canais habilitados) para `ProductAvailabilityService`.
- **Restaurant Dashboard**: consome `getProductHealth` para widgets.

## Regras invariantes

- Produtos nunca são deletados fisicamente — usar `ARCHIVED` / `DISCONTINUED`.
- `product_versions` é imutável (trigger `tg_block_product_versions_mutation`).
- Todas as escritas passam por `ProductService.functions.ts` sob `requireSupabaseAuth` + `assertOwner`.

## Testes

`ProductFoundation.test.ts` cobre Lifecycle, Validator, Availability, Search e EventBus.
Cobertura funcional das camadas puras: 100%. Camada de server functions é validada por integração.

## Pendências para o Prompt 13.5.2

- Busca full-text no banco (índice `tsvector` + `websearch_to_tsquery`).
- Tags como entidade relacional (`product_tags`).
- SEO por produto (head dinâmico + JSON-LD `Product`/`Offer`).
- QR Code de mesa/cardápio.
- Combos como entidade de primeira classe.
- Bind explícito com `ingredients` / `product_recipes` para bloquear venda sem estoque.
- Widgets de dashboard (consumindo `getProductHealth`).
