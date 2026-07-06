# LOCALIX ONBOARDING PLAYBOOK — v1.0 RC2

Manual operacional de implantação de novos estabelecimentos na Localix.
Reflete exclusivamente o comportamento implementado. Itens ausentes
estão marcados como **"Não implementado na v1.0"**.

Data: 2026-07-06 · Status: Feature Freeze

---

## Capítulo 1 — Objetivo do onboarding

- **Finalidade.** Levar um estabelecimento do cadastro à publicação
  operacional em `/{slug}`.
- **Responsáveis.** Equipe de Onboarding (Localix) + owner do
  restaurante. Aprovação final: Administrador (`/admin/aprovacoes`).
- **Início.** No cadastro do owner em `/auth` (e-mail/senha).
- **Encerramento.** Quando o restaurante está publicado, com Stripe
  Connect ativo e ao menos um produto disponível no catálogo.

---

## Capítulo 2 — Pré-requisitos

Requisitos que existem na implementação atual:

- **Conta owner** criada via `/auth` com **e-mail/senha** (OAuth
  bloqueado por trigger `enforce_partner_email_only` + guard
  `_authenticated/route.tsx`).
- **Dados obrigatórios do restaurante** coletados por `OwnerOnboarding`
  e `_authenticated/perfil` / `settings` (nome, slug, contato,
  endereço).
- **Stripe Connect Express** conectado em `_authenticated/pagamentos`
  para habilitar recebimentos.
- **Ao menos um produto** publicado em `_authenticated/menu`.

Documentação legal formal / KYC gerenciado pela Localix fora do Stripe:
**Não implementado na v1.0** (KYC delegado ao Stripe Connect).

---

## Capítulo 3 — Fluxo de implantação

Fluxo exatamente conforme implementação:

```text
Cadastro (/auth)
   ↓
OwnerOnboarding cria registro em `restaurants`
   ↓
Configuração inicial (_authenticated/settings, perfil)
   ↓
Stripe Connect (_authenticated/pagamentos → stripe-connect-create)
   ↓
Sync de status (stripe-connect-refresh)
   ↓
Cardápio (_authenticated/menu, units, inventory)
   ↓
Horários / Entrega / Retirada (_authenticated/settings)
   ↓
Teste do fluxo (/{slug} → checkout com valor mínimo)
   ↓
Aprovação em /admin/aprovacoes (quando aplicável)
   ↓
Publicação (restaurante visível em /{slug})
```

---

## Capítulo 4 — Configuração do estabelecimento

Configurações disponíveis (todas em `_authenticated/*`):

- **Perfil** (`perfil`): dados públicos, logo, capa.
- **Settings** (`settings`): horários, endereço, entrega, retirada,
  áreas atendidas, pedido mínimo, taxas.
- **Impressão** (`print-settings`).
- **Employees / permissões** via `RestaurantSettingsService`
  (`src/lib/restaurant-settings/*`).
- **Feature flags** por tenant via `FeatureFlagService`.

Nenhuma outra opção existe na v1.0.

---

## Capítulo 5 — Configuração de pagamentos

Apenas Stripe é o meio oficial de recebimento na v1.0 (Mercado Pago
permanece como integração legada — ver `docs/PAYMENT_DOMAIN_FINAL_REPORT.md`).

- **Stripe Checkout.** Automático para pedidos via `stripe-checkout`.
- **Stripe Connect Express.** Conectado em `_authenticated/pagamentos`
  via `StripeConnectCard` → Edge Function `stripe-connect-create`.
- **Status da conta.** Sincronizado por `stripe-connect-refresh`
  (`charges_enabled`, `payouts_enabled`, `details_submitted`).
- **Recebimentos.** Split automático via `application_fee_amount` +
  `transfer_data.destination` (`StripeSplitService`); valores derivam de
  `PlatformRevenueService`.
- **Payouts programados / customização de agenda de repasse pela
  Localix:** **Não implementado na v1.0** (usa agenda padrão Stripe).

---

## Capítulo 6 — Configuração do cardápio

Em `_authenticated/menu` e telas relacionadas:

- **Categorias.**
- **Produtos** (nome, descrição, preço, SKU).
- **Imagens** via `ProductImageUploader` (bucket `product-images`).
- **Preços** (custo/venda; margens em `src/lib/cost/*`).
- **Disponibilidade** (ativo/inativo, estoque via `inventory`).
- **Destaques** (`featured`), **promoções** (`promotions`).

Sem opções adicionais.

---

## Capítulo 7 — Configuração operacional

Em `_authenticated/settings`:

- **Horários** de funcionamento.
- **Pedido mínimo.**
- **Entrega** (taxa, raio, áreas atendidas).
- **Retirada** (habilitar/desabilitar).
- **Áreas atendidas** (região/CEP conforme configuração).

Roteamento de entregadores próprios / integração com apps de entrega:
**Não implementado na v1.0**.

---

## Capítulo 8 — Validação antes da publicação

Checklist:

- [ ] Owner autenticado com e-mail/senha.
- [ ] Registro em `restaurants` com `slug` único.
- [ ] Perfil preenchido (nome, contato, endereço).
- [ ] Horários e áreas de atendimento configurados.
- [ ] Stripe Connect: `charges_enabled = true` e `payouts_enabled = true`.
- [ ] Ao menos 1 categoria + 1 produto publicado com imagem e preço.
- [ ] Teste E2E: pedido no `/{slug}` → checkout → webhook Stripe
      confirma → aparece em `_authenticated/orders` como `pago`.
- [ ] Notificação recebida em `MerchantNotificationsBell`.

---

## Capítulo 9 — Publicação

Um estabelecimento é considerado apto para produção quando:

1. Stripe Connect ativo (charges + payouts habilitados).
2. Ao menos um produto disponível.
3. Aprovação em `/admin/aprovacoes` (quando exigida pelo fluxo de
   aprovação administrativa).
4. Teste E2E validado.

A partir daí, `/{slug}` fica acessível ao público via
`RestaurantSessionContext` (aba Início sempre por contexto, nunca por
slug fixo — ver memória de projeto).

---

## Capítulo 10 — Problemas conhecidos (RC1/RC2)

Itens 🟡 herdados de `docs/GO_LIVE_AUDIT.md` e `docs/GO_LIVE_SCORE.md`:

- UI de refund parcial (back-end operacional).
- Responsividade admin em mobile.
- Alertas proativos externos ausentes.
- Rate limit generalizado ausente (existe apenas em Edge Functions
  críticas).
- Conciliação financeira automatizada ausente.

Nenhum bloqueador 🔴.

---

## Capítulo 11 — Checklist de homologação

Uso interno da equipe antes de liberar o restaurante:

- [ ] Identidade do owner conferida.
- [ ] Slug definitivo revisado (sem colisão, sem caracteres inválidos).
- [ ] Dados fiscais informados ao Stripe Connect (KYC concluído).
- [ ] Cardápio revisado (preços, imagens, disponibilidade).
- [ ] Horários coerentes com a operação real.
- [ ] Área de entrega coerente com endereço.
- [ ] Teste de pedido pago concluído com sucesso.
- [ ] Ledger registra o teste corretamente.
- [ ] Notificações operacionais chegando ao merchant.
- [ ] Owner treinado nas telas: `dashboard`, `orders`, `kitchen`,
      `finance`, `menu`, `pagamentos`.

---

## Capítulo 12 — Glossário

- **Owner / Parceiro.** Dono do restaurante.
- **Slug.** Identificador público do restaurante em `/{slug}`.
- **Tenant.** Restaurante (unidade multi-tenant).
- **OwnerOnboarding.** Componente que cria o registro do restaurante.
- **Stripe Connect Express.** Conta Stripe individual do restaurante.
- **`charges_enabled` / `payouts_enabled`.** Flags de status Stripe.
- **Split.** Repartição automática Stripe → restaurante + Localix.
- **PlatformRevenue.** Domínio único de receita da plataforma.
- **RestaurantSessionContext.** Contexto de sessão do estabelecimento no
  cliente.

---

## Validação

Consistência conferida contra:
- `docs/LOCALIX_OPERATIONS_MANUAL.md`
- `docs/ARCHITECTURE_BASELINE.md`
- `docs/LOCALIX_BUSINESS_MODEL_V1.md`
- `docs/GO_LIVE_AUDIT.md`
- `docs/RELEASE_CANDIDATE_RC1.md`
- Código: `src/routes/**`, `src/components/OwnerOnboarding.tsx`,
  `src/lib/billing/**`, `src/lib/stripe/**`, `src/lib/payments/**`,
  `supabase/functions/stripe-*`, migrations recentes.

Nenhum processo especulativo incluído.

## Relatório final

**Estrutura.** 12 capítulos conforme escopo.

**Fontes.** Docs listados acima + código-fonte diretamente inspecionado.

**Inconsistências encontradas:** 0.

**Itens marcados como "Não implementado na v1.0":**
- KYC próprio Localix fora do Stripe.
- Payouts customizados / agenda de repasse gerida pela Localix.
- Roteamento de entregadores / integração com apps de entrega.

**Confirmação.** O documento representa fielmente o onboarding
atualmente implementado na Localix v1.0 RC2. Nenhum código ou
documentação existente foi alterado.
