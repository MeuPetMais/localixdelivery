# RBAC v2 — Separação Plataforma × Restaurante

Data: 2026-07-04

Este documento descreve a nova matriz de permissões (RBAC v2) que separa
**completamente** dois contextos que antes se sobrepunham:

1. **Administração da Plataforma** (`/admin/*`)
2. **Administração do Restaurante** (`/dashboard`, `/orders`, `/settings`, ...)

---

## 1. Roles da Plataforma

Escopo: apenas rotas administrativas globais (`/admin/*`).
Nunca controlam menus do painel do restaurante.

| Role V2               | Legacy interno   | Acesso resumido                                   |
| --------------------- | ---------------- | ------------------------------------------------- |
| `PLATFORM_OWNER`      | `super_admin`    | Tudo (equivalente a "root" da plataforma)         |
| `PLATFORM_ADMIN`      | `platform_admin` | Tenants, planos, cupons, feature flags, notificações |
| `PLATFORM_SUPPORT`    | `support_admin`  | Tickets, moderação, notificações                  |
| `PLATFORM_FINANCE`    | `finance_admin`  | Financeiro global, comissões, assinaturas         |
| `PLATFORM_READONLY`   | `read_only`      | Leitura de tudo, sem escrita                      |

Enforcement:
- Autorização: `PlatformPermissionRegistry.can(role, permission)`.
- Matriz completa: `src/lib/platform/PlatformPermissionRegistry.ts`.
- Aliases V2 (uppercase): `src/lib/platform/roles-v2.ts`.

---

## 2. Roles do Restaurante

Escopo: painel do estabelecimento (`/dashboard`, `/orders`, `/menu`,
`/settings`, `/financial-center`, ...).
Nunca aparecem em `/admin/*`.

| Role V2     | Legacy alias (aceito para compat) | Acesso                                     |
| ----------- | --------------------------------- | ------------------------------------------ |
| `OWNER`     | `ADMIN`                           | **Full access** ao painel do restaurante   |
| `MANAGER`   | —                                 | Operação, catálogo, financeiro (sem settings sensíveis) |
| `CASHIER`   | —                                 | Financeiro e pedidos                       |
| `KITCHEN`   | —                                 | Painel da cozinha                          |
| `DELIVERY`  | `DRIVER`                          | Entregas                                   |
| `STAFF`     | `ATTENDANT`                       | Pedidos, atendimento, avaliações           |

Enforcement:
- Tipagem: `DashboardRole` em `src/lib/dashboard/types.ts` aceita canônicos + aliases legados.
- Normalização: `normalizeRestaurantRole()` converte `ADMIN→OWNER`,
  `ATTENDANT→STAFF`, `DRIVER→DELIVERY`.
- `canAccess()` em `src/lib/dashboard/permissions.ts` normaliza role e required
  antes de comparar, e **sempre libera OWNER**.

### Regra de negócio: criação de restaurante
O usuário que **cria** um restaurante recebe automaticamente `OWNER` daquele
restaurante — implementado em `src/routes/_authenticated/route.tsx`:

```ts
const role: DashboardRole =
  restaurant?.owner_id === userId || isAdmin ? "OWNER" : "STAFF";
```

`OWNER` possui acesso completo a:
Dashboard, Pedidos, Produtos, Categorias, Promoções, Estoque, Clientes,
Financeiro, Pagamentos, Central Financeira, Configurações (`/settings`),
Impressão, Relatórios, Analytics, IA, Marketing, Perfil da Loja.

---

## 3. Rotas afetadas

| Rota                      | Escopo       | Roles permitidas                        |
| ------------------------- | ------------ | --------------------------------------- |
| `/admin/*`                | Plataforma   | `PLATFORM_*` (via `PlatformPermissionRegistry`) |
| `/dashboard`, `/orders`   | Restaurante  | Todas as roles de restaurante           |
| `/menu`, `/inventory`, `/promotions`, `/featured`, `/builders`, `/suppliers` | Restaurante | `OWNER`, `MANAGER` |
| `/kitchen`                | Restaurante  | `OWNER`, `MANAGER`, `KITCHEN`           |
| `/financial-center`, `/finance` | Restaurante | `OWNER`, `MANAGER`, `CASHIER`     |
| `/pagamentos`, `/finance-ai` | Restaurante | `OWNER`, `MANAGER`                   |
| `/settings`, `/units`     | Restaurante  | `OWNER`                                 |
| `/print-settings`         | Restaurante  | `OWNER`, `MANAGER`                      |
| `/perfil`, `/support`     | Restaurante  | Todas                                   |
| `/reviews`, `/customers`  | Restaurante  | `OWNER`, `MANAGER`, `STAFF`             |
| `/loyalty`                | Restaurante  | `OWNER`, `MANAGER`                      |

---

## 4. Roles criadas / removidas

**Criadas (canônicas V2):**
- Plataforma: `PLATFORM_OWNER`, `PLATFORM_ADMIN`, `PLATFORM_SUPPORT`, `PLATFORM_FINANCE`, `PLATFORM_READONLY`.
- Restaurante: `OWNER`, `DELIVERY`, `STAFF` (novos nomes canônicos).

**Removidas:** nenhuma role foi removida em runtime.
Legacy (`ADMIN`, `ATTENDANT`, `DRIVER`, e enum `app_role` do Postgres) permanece
como **alias aceito**, sem quebrar dados existentes.

---

## 5. Compatibilidade com usuários existentes

- Enum `public.app_role` (`admin | partner | customer`) e função
  `public.has_role()` permanecem intactos — nenhuma migração destrutiva.
- Usuários com `user_roles.role = 'admin'` continuam funcionando: são tratados
  como Platform admin no `/admin/*` e, se forem `owner_id` de algum restaurante,
  como `OWNER` no painel daquele restaurante.
- `requiredRoles: ["ADMIN"]` continuam válidos — resolvidos via
  `normalizeRestaurantRole` para `OWNER`.
- Nenhuma mudança em RLS, Services ou rotas.
