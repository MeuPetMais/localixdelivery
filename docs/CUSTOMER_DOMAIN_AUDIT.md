# CUSTOMER_DOMAIN_AUDIT.md

> Auditoria **READ-ONLY** do Customer CRM Domain — snapshot 2026-07-03.
> Nenhum código foi criado, alterado ou removido.
> Base: `ARCHITECTURE_BASELINE.md`. **Não existe** `Customer DOMAIN_MANIFEST.md`.

---

## 1. Resumo Executivo

O Customer Domain **NÃO existe como domínio isolado** em `src/lib/customer/`. As responsabilidades estão espalhadas em ~6 tabelas, 3 arquivos soltos em `src/lib/`, 2 contexts, 1 hook, ~10 rotas e regras de negócio em `src/lib/business/rules/customer-rules.ts`. Há dois modelos paralelos de "cliente":

- **`customer_profiles`** — usuário autenticado (auth.users) com perfil global (`handle_new_customer` trigger).
- **`customers`** — cliente **por restaurante** (multi-tenant), populado a partir de pedidos (telefone como chave). Sem FK com `auth.users`.

Esta duplicidade é a maior dívida arquitetural do domínio.

---

## 2. Banco de Dados

### 2.1 Tabelas existentes (schema `public`)

| Tabela | Colunas | Policies | Papel |
|---|---|---|---|
| `customer_profiles` | 10 | 3 | Perfil global do usuário autenticado (nome, email, avatar, provider). Populado por `handle_new_customer()` trigger. |
| `customers` | 11 | 3 | Cliente **por restaurante** (name, phone, email, total_orders, total_spent, avg_ticket, last_order_at). |
| `customer_addresses` | 14 | 4 | Endereços do usuário (label, cep, street, number, complement, neighborhood, city, state, notes, is_default). RLS por `customer_id = auth.uid()`. Trigger `single_default`. |
| `customer_favorites` | 6 | 3 | Favoritos (usuário → menu_item / restaurante). |
| `customer_points` | 6 | 1 | Cashback/pontos (`balance`, `total_earned`) por `customer_id`. |
| `customer_notifications` | 10 | 2 | Feed in-app do cliente (order_received, order_preparing, order_out, order_delivered, order_canceled). Trigger `tg_order_notify_customer`. |
| `reviews` | 11 | 3 | Avaliação de pedido (rating, comment, owner_reply). |
| `coupons` | 9 | 1 | Cupons por restaurante (compartilhado com Product/Pricing). |

### 2.2 Policies / Grants — highlights

- `customer_addresses`: RLS completa (select/insert/update/delete por `auth.uid()`).
- `customer_favorites`: GRANT a `anon` + `authenticated`; policy "no direct access" (`USING(false)`) → **acesso só via server function**.
- `customer_notifications`: `GRANT SELECT, UPDATE TO authenticated`.
- `customer_profiles`: `GRANT SELECT, INSERT, UPDATE TO authenticated`.
- `customer_points`: `GRANT SELECT, INSERT, UPDATE, DELETE TO authenticated` (⚠ amplo, permite auto-crédito se policy for permissiva).
- `orders`: policy "Customers view own orders" (`customer_id = auth.uid()`).

### 2.3 Triggers

- `handle_new_customer()` → cria `customer_profiles` ao criar usuário.
- `tg_customer_addresses_single_default` / `tg_customer_addresses_updated_at`.
- `tg_order_notify_customer` → gera `customer_notifications` conforme mudança de status.

---

## 3. Código — Inventário

### 3.1 Services / libs (todos soltos em `src/lib/`, sem pasta `customer/`)

| Arquivo | Papel |
|---|---|
| `src/lib/customer-addresses.ts` | CRUD de endereços direto no client Supabase (browser). |
| `src/lib/customer-area.functions.ts` | `lookupCustomerArea` — server fn com `supabaseAdmin` que agrega dados por telefone (perfil, restaurantes, pedidos, pontos, cupons). |
| `src/lib/customer-notify.ts` | Helpers de notificação in-app do cliente. |
| `src/lib/favorites.ts` | CRUD de favoritos. |
| `src/lib/benefits.functions.ts` | Benefícios/cashback do cliente. |
| `src/lib/coupons.functions.ts` | Validação/aplicação de cupons (compartilhado com Product/Pricing). |
| `src/lib/profile-completion.ts` | Detecta perfis incompletos (usado no banner). |
| `src/lib/business/rules/customer-rules.ts` | Regras: `CUSTOMER_ACTIVE`, `CUSTOMER_PHONE_CONFIRMED`, `CUSTOMER_EMAIL_CONFIRMED`, `CUSTOMER_DAILY_LIMIT`. |
| `src/lib/business/rules/cashback-rules.ts` | Regras de cashback. |
| `src/lib/business/rules/coupon-rules.ts` | Regras de cupom. |

### 3.2 Hooks

- `src/hooks/use-customer-auth.ts` — sessão do cliente (source of truth, `onAuthStateChange` + `getSession`).
- `src/hooks/use-auth.ts` — sessão genérica (owner/admin). Duplicidade parcial com o anterior.

### 3.3 Contexts

- `src/contexts/CustomerNotificationsContext.tsx` — feed realtime de `customer_notifications`.
- `src/contexts/CustomerNavigationContext.tsx` — navegação do storefront.

### 3.4 Components

- `AddressPickerModal.tsx`, `ProfileCompletionBanner.tsx`, `ReviewForm.tsx`, `NotificationsBell.tsx`, `MerchantNotificationsBell.tsx`, `BottomNav.tsx`.

### 3.5 Rotas do cliente

| Rota | Função |
|---|---|
| `/cliente` | Área do cliente (login/perfil). |
| `/entrar`, `/auth` | Login. |
| `/esqueci-senha`, `/redefinir-senha` | Fluxo senha. |
| `/escolher-ambiente` | Seletor de ambiente. |
| `/home` | Home logada. |
| `/meus-enderecos` | Gestão de endereços. |
| `/meus-pedidos` | Histórico. |
| `/favoritos` | Favoritos. |
| `/beneficios` | Cashback/cupons. |
| `/pedido/$id`, `/pedido-sucesso/$id` | Detalhe do pedido. |
| `/_authenticated/customers` | **CRM do lojista** (view sobre `customers`). |
| `/_authenticated/loyalty` | Programa de pontos (lojista). |
| `/admin.clientes` | Superadmin. |

### 3.6 Edge Functions

**Nenhuma** edge function é do domínio Customer. As existentes (`mp-*`) são de pagamentos. Toda lógica server-side de cliente usa `createServerFn`.

### 3.7 Eventos

**Nenhum EventBus** dedicado (`CustomerEventBus` não existe). Notificações são geradas via trigger SQL. Não há eventos `CustomerCreated`, `CustomerUpdated`, `CustomerBlocked`, `CashbackEarned` etc. na camada de aplicação.

---

## 4. Status por Capacidade

| Capacidade | Status | Observação |
|---|---|---|
| Autenticação do cliente | ✅ Pronto | `use-customer-auth` + Supabase Auth. |
| Perfil global | ⚠ Parcial | `customer_profiles` existe, mas sem service dedicado; leitura ad-hoc. |
| Perfil por restaurante | ⚠ Parcial | `customers` sem FK com `auth.users`; chave é telefone. Duplicidade com `customer_profiles`. |
| Endereços | ✅ Pronto | Tabela + RLS + service + UI. |
| Favoritos | ✅ Pronto | Tabela + service + rota. |
| Histórico de pedidos | ✅ Pronto | Via `orders.customer_id`. |
| Avaliações | ✅ Pronto | `reviews` + `ReviewForm`. |
| Cupons | ✅ Pronto (compartilhado) | Domínio Pricing. |
| Cashback / Pontos | ⚠ Parcial | Tabela existe; UI `/beneficios` + `/loyalty`; **sem engine de acúmulo/resgate** dedicado. |
| Notificações do cliente | ✅ Pronto | Trigger + context realtime + bell. |
| Preferências (idioma, opt-in mkt, canais) | ❌ Não existe | Não há tabela `customer_preferences`. |
| Segmentação CRM (VIP/frequente/inativo) | ⚠ Parcial | Calculada em runtime em `_authenticated/customers.tsx`, não persistida. |
| Domínio isolado `src/lib/customer/` | ❌ Não existe | Sem Service/Validator/EventBus/Audit/README/test. |
| CustomerLifecycle events | ❌ Não existe | Nenhum event bus. |
| LGPD / anonimização / export | ❌ Não existe | Sem fluxo de exclusão/anonimização. |
| Merge de contas (`customers` ↔ `customer_profiles`) | ❌ Não existe | Sem reconciliação por telefone/email. |

---

## 5. Duplicações e Redundâncias

1. **`customers` vs `customer_profiles`** — dois modelos de cliente, sem link explícito. Fonte principal de dívida.
2. **`use-auth` vs `use-customer-auth`** — dois hooks de sessão com overlap.
3. **Segmentação VIP/Frequente/Inativo** recalculada em componentes (`_authenticated/customers.tsx`); deveria ser Service puro em `src/lib/customer/segmentation/`.
4. **Notificações do cliente** têm dois pontos de verdade: trigger SQL `tg_order_notify_customer` **e** `NotificationCenter` (`src/lib/notifications/`) — potencial disparo duplicado se NotificationCenter passar a assinar `order` events.
5. **`benefits.functions.ts` + `coupons.functions.ts` + `customer_points`** — regras de cashback dispersas; não há `LoyaltyEngine`.
6. **`lookupCustomerArea`** usa `supabaseAdmin` para leitura pública identificada por telefone — deveria passar por `requireSupabaseAuth` ou verificação de OTP.

---

## 6. Reutilização Recomendada (para os próximos prompts)

- Reaproveitar `use-customer-auth`, `CustomerNotificationsContext`, `customer-addresses.ts`, `favorites.ts`, `ReviewForm`, `AddressPickerModal`.
- Reaproveitar `business/rules/customer-rules.ts`, `cashback-rules.ts`, `coupon-rules.ts` dentro do futuro `CustomerService`.
- Reaproveitar `NotificationCenter` como transport único (parar de depender só do trigger SQL).
- Reaproveitar `ProfileCompletionBanner` + `profile-completion.ts` no `CustomerLifecycle`.

---

## 7. Pendências / Gaps para Próximos Prompts

1. Criar `src/lib/customer/` com `CustomerService`, `CustomerValidator`, `CustomerEventBus`, `CustomerAudit`, `types`, `README`, `test`.
2. Definir modelo canônico: promover `customer_profiles` a raiz global, transformar `customers` em `customer_restaurant_stats` (agregação por tenant), com FK a `customer_profiles.id` quando o telefone bater.
3. `LoyaltyEngine` (acúmulo, resgate, expiração de pontos) reutilizando `customer_points` + `coupons`.
4. `CustomerSegmentationService` (VIP/frequente/inativo/novo) persistido.
5. `customer_preferences` (idioma, opt-in marketing, canais push/email/whatsapp).
6. Eventos: `CustomerRegistered`, `CustomerBlocked`, `CashbackEarned`, `CashbackRedeemed`, `AddressAdded`, `ReviewSubmitted`.
7. Fluxo LGPD (export + anonimização).
8. Endurecer `lookupCustomerArea` (autenticação/OTP).

---

_Fim do relatório. Nenhuma alteração de código realizada._
