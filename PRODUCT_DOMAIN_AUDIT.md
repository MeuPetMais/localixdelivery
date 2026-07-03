# Product Domain — Read-Only Audit
Generated: 2026-07-03 · Scope: catalog / menu / promoções / cardápio público.
Source of truth cross-checked: `ARCHITECTURE_BASELINE.md` (287 linhas). Nenhum `DOMAIN_MANIFEST.md` de Product foi encontrado no repositório.

> ⚠️ Auditoria READ-ONLY. Nenhum arquivo foi criado ou alterado além deste relatório.

---

## 1. Inventário de assets existentes

### 1.1 Tabelas (schema `public`, confirmadas em `src/integrations/supabase/types.ts`)

| Tabela                | Papel no Product Domain                                         | RLS |
|-----------------------|-----------------------------------------------------------------|-----|
| `menu_categories`     | Categorias do cardápio (ordenadas por `position`)               | ✅ (2 policies) |
| `menu_items`          | Produtos: preço, promo (`promo_price`, `promo_starts_at/ends_at`, `promo_campaign`), `is_featured`, `is_bestseller`, `is_available`, `position`, imagens principais (26 colunas) | ✅ (2) |
| `menu_item_images`    | Galeria adicional por produto                                    | ✅ (2) |
| `builders`            | Monta-seu-produto (pizza/combo/kits)                             | ✅ (2) |
| `builder_groups`      | Grupos de escolha (`min_select`, `max_select`, `is_required`)    | ✅ (2) |
| `builder_options`     | Opções com `price_delta`, `max_qty`                              | ✅ (2) |
| `featured_sections`   | Sessões destacadas no cardápio (banners/coleções)                | ✅ (2) |
| `coupons`             | Cupons/percentuais aplicáveis no checkout                        | ✅ (1) |
| `customer_favorites`  | Favoritos do cliente por produto                                 | ✅ (3) |
| `reviews`             | Avaliações — usadas para social proof no card                    | ✅ (3) |

Todas as tabelas acima já existem no baseline atual e possuem `GRANT` + RLS ativos.

### 1.2 Services / camada de acesso (`src/lib/`)

| Arquivo                                | Função                                                         | Status |
|----------------------------------------|----------------------------------------------------------------|--------|
| `featured-sections.functions.ts` (260) | CRUD de sessões destacadas (server fns)                        | ✅ pronto |
| `favorites.ts` (170)                   | Toggle/list de favoritos                                       | ✅ pronto |
| `promotions.ts` (98)                   | Regras utilitárias de promoção (janela `promo_starts_at/ends_at`, cálculo do preço vigente) | ⚠️ parcial (só helpers, sem service dedicado) |
| `public-restaurant.functions.ts`       | Fetch público de restaurante + cardápio (usada pelo `/$slug`)  | ✅ pronto |
| `demo.functions.ts` / `reset_demo_environment` (RPC) | Seed completo de categorias/itens/builders/coupons | ✅ pronto |
| `ai.functions.ts`, `consultor.functions.ts`, `finance-ai.functions.ts` | Consultam `menu_items` para IA/relatórios | ✅ reutilizável |
| `image-upload.ts` + `ProductImageUploader.tsx` | Upload para bucket `product-images`                         | ✅ pronto |

**Não existe** um `ProductService` / `MenuService` / `CatalogDomain` consolidado — a lógica está espalhada nas rotas + server fns.

### 1.3 Components

| Component                                   | Papel                                       |
|---------------------------------------------|---------------------------------------------|
| `components/BuilderConfigurator.tsx` (265)  | UI do monte-seu-produto (usada em `$slug.montar` e checkout) |
| `components/ProductImageUploader.tsx` (208) | Upload/reorder de imagens                    |
| `components/DemoDashboardCards.tsx`         | Cards demo do cardápio                       |
| `components/BottomNav.tsx`                  | Nav do cliente (link p/ cardápio)            |

Nenhum diretório `src/components/menu/` ou `src/components/product/` existe. Os cards, listas e modais do cardápio estão inline em `src/routes/$slug.index.tsx` (**1460 linhas** — arquivo mais gordo do domínio).

### 1.4 Rotas

| Rota                                      | Papel                                                                 |
|-------------------------------------------|-----------------------------------------------------------------------|
| `src/routes/$slug.tsx` + `$slug.index.tsx`| Cardápio público do cliente (listagem, filtros, categorias, promoções, featured, favoritos, adicionar ao carrinho) — **monolítico, 1460 linhas** |
| `src/routes/$slug.montar.tsx` (410)       | Fluxo de builder no cardápio público                                  |
| `_authenticated/menu.tsx` (446)           | Admin: CRUD de categorias + `menu_items` + promo inline               |
| `_authenticated/builders.tsx` (645)       | Admin: CRUD de builders/groups/options                                |
| `_authenticated/promotions.tsx` (695)     | Admin: campanhas promocionais (usa `promo_*` de `menu_items` + `coupons`) |
| `_authenticated/featured.tsx` (308)       | Admin: sessões destacadas                                             |

### 1.5 Hooks / Contexts

- `contexts/CustomerNavigationContext.tsx` — navegação por categoria do cardápio.
- `contexts/RestaurantSessionContext` (referenciado em memória Core) — sessão do restaurante, atende regra multi-tenant.
- **Nenhum hook dedicado** `useMenu`, `useProduct`, `useCatalog`, `useBuilder`. Cada rota faz `useQuery` direto.

### 1.6 Edge Functions / Event Bus / Policies

- **Edge Functions**: nenhuma dedicada a Product. Toda escrita passa por `createServerFn` (TanStack) sob RLS.
- **EventBus dedicado**: **não existe** (`ProductEventBus`, `MenuEvent*`, `CatalogEvent*` inexistentes). Existem `CostEventBus`, `PurchaseEventBus`, `ReportEventBus` etc., mas Product não publica eventos.
- **Policies**: todas as tabelas listadas em 1.1 têm RLS habilitado. Padrão dominante = escopo por `restaurants.owner_id`; leituras públicas do cardápio via `active = true` na restaurante.

### 1.7 Storage

- Bucket `product-images` (privado) — imagens de produtos.
- Bucket `restaurant-assets` — logo/capa (não é Product estrito).

---

## 2. Estado por capacidade

| Capacidade                    | Estado                | Observações |
|-------------------------------|-----------------------|-------------|
| Produtos (CRUD admin)         | ✅ Pronto             | `menu.tsx`, mas monolítico |
| Categorias                    | ✅ Pronto             | ordenação por `position` |
| Menus (agrupamento visual)    | ⚠️ Parcial            | não há entidade `menu`; renderizado por category + `featured_sections` |
| Variações                     | ⚠️ Parcial            | modeladas via `builders/groups/options`; não há campo de "variação" nativo em `menu_items` (ex.: tamanho, sabor sem builder) |
| Complementos / Adicionais     | ✅ Pronto             | via `builder_options` (`price_delta`, `max_qty`) |
| Combos                        | ⚠️ Parcial            | usa `menu_categories` + item "Combo"; não há tabela dedicada de composição/regras |
| Disponibilidade               | ⚠️ Parcial            | flag `is_available`; sem janelas (dia/hora), sem estoque-driven (existe `Inventory Domain` mas sem bind com `menu_items`) |
| Preço                         | ✅ Pronto             | `price` + integração com `PricingEngine` |
| Promoções                     | ✅ Pronto             | `promo_price/starts_at/ends_at/campaign` + `coupons` + `promotions.ts` |
| Imagens                       | ✅ Pronto             | `menu_item_images` + `ProductImageUploader` + bucket |
| SEO por produto/cardápio      | ❌ Não existe         | rotas `$slug.*` não setam `head()` por produto; sem canonical/OG per item |
| Tags                          | ❌ Não existe         | sem coluna `tags`, sem tabela relacional |
| Filtros                       | ⚠️ Parcial            | filtro por categoria/busca implementado inline em `$slug.index.tsx`; sem "chips" reutilizáveis |
| Pesquisa                      | ⚠️ Parcial            | busca client-side no cardápio público; sem full-text no banco |
| Cardápio (público)            | ✅ Pronto             | mas 1 arquivo de 1460 linhas |
| QR Code                       | ❌ Não existe         | nenhuma rota/geração/tabela QR encontrada |
| Favoritos                     | ✅ Pronto             | `customer_favorites` + `favorites.ts` |
| Reviews acopladas ao produto  | ⚠️ Parcial            | `reviews` está por pedido, não por `menu_item_id` |
| Featured / destaques          | ✅ Pronto             | `featured_sections` |
| EventBus de produto           | ❌ Não existe         | |
| ProductService consolidado    | ❌ Não existe         | lógica dispersa |
| Testes automatizados          | ❌ Não existe         | nenhum `*.test.ts` em src/lib para produto/menu |
| Documentação (`README`)       | ❌ Não existe         | sem `ProductDomain.README.md` |

---

## 3. Duplicações, redundâncias e oportunidades de reuso

1. **Renderização de card de produto duplicada** entre `$slug.index.tsx`, `DemoDashboardCards.tsx` e `featured.tsx` — candidato a `components/product/ProductCard.tsx`.
2. **Cálculo de preço vigente com promo** aparece em: `promotions.ts`, `$slug.index.tsx` inline, `menu.tsx` inline, `PricingEngine`. Consolidar em `promotions.ts` e reusar.
3. **BuilderConfigurator** já existe e é reutilizável — nenhum wrapper novo é necessário; qualquer novo módulo (ex.: combos) deve consumi-lo.
4. **Server fns públicas** (`public-restaurant.functions.ts`) já retornam o cardápio completo — não recriar fetch de menu; usar como *port*.
5. **`featured-sections.functions.ts`** cobre CRUD de sessões — reutilizar para "coleções/menus" antes de criar entidade nova.
6. **Estrutura `builders/builder_groups/builder_options`** é suficiente para "variações" e "combos"; evitar tabela `product_variants` nova.
7. **`favorites.ts`, `image-upload.ts`, `ProductImageUploader.tsx`** são reutilizáveis integralmente.
8. **`$slug.index.tsx` (1460 linhas)** é o maior débito técnico do domínio — deveria ser quebrado em `MenuHeader`, `CategoryNav`, `ProductGrid`, `ProductCard`, `CartDrawer`, `SearchBar`.
9. **Falta ProductEventBus** — outros domínios (Cost, Purchase, Report) seguem o padrão de EventBus dedicado; Product foge do padrão.

---

## 4. Lacunas ("não existe")

- `ProductService` / `MenuService` / `CatalogDomain` unificados.
- `ProductEventBus` + eventos (`ProductCreated`, `PriceChanged`, `AvailabilityChanged`, `PromoStarted/Ended`).
- Tags & filtros server-side.
- SEO por produto (head dinâmico, JSON-LD `Product`, `Offer`).
- QR Code de mesa/cardápio.
- Janelas de disponibilidade (dia/hora) e bind com `Inventory Domain` (`ingredients`/`product_recipes` já existem, mas o cardápio não bloqueia venda por falta de estoque).
- Combos como entidade de primeira classe (regras de desconto, obrigatoriedade).
- Reviews vinculadas ao `menu_item_id`.
- Testes automatizados para o domínio.
- `ProductDomain.README.md` e `DOMAIN_MANIFEST.md`.

---

## 5. Score interno (para próximas etapas)

| Eixo             | Nota |
|------------------|------|
| Cobertura CRUD   | 85 / 100 |
| Consolidação de service | 25 / 100 |
| EventBus         | 0 / 100 |
| Reuso de UI      | 40 / 100 |
| SEO/Discovery    | 20 / 100 |
| Testes           | 0 / 100 |
| Documentação     | 15 / 100 |

---

Aguardando novos comandos.

---

## Update 2026-07-03 — Foundation aplicada

Incorporadas ao domínio:
- `src/lib/product/` (Lifecycle, Validator, EventBus, Availability, Search, ProductService).
- Tabelas `product_versions`, `product_media`, `product_audit` (RLS owner-scoped, versões imutáveis).
- `ProductFoundation.test.ts` — 11/11 testes passando (Lifecycle, Validator, Availability, Search, EventBus).
- `ProductFoundation.README.md`.

Lacunas ainda abertas (Prompt 13.5.2): full-text no banco, tags relacionais, SEO por produto, QR code, combos como entidade, bind explícito com Inventory, widgets de dashboard.
