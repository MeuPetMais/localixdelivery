# Billing — Relatório de Auditoria (Etapa 1)

Escopo: localizar todas as lógicas hoje existentes relacionadas a
plano, assinatura, gateway, implantação, onboarding, cobrança, Stripe,
Mercado Pago, restaurante ativo/homologado e taxa de serviço.

## Achados

### Gateway / Pagamento (Payment Domain — **mantido intacto**)
- `src/lib/payments/*` — PaymentService, providers (Mercado Pago),
  PricingEngine, ReconciliationService, SplitService, WebhookService,
  orderPayment.server, repositories.
- `src/lib/payments/providers/MercadoPagoProvider.ts` — único provider hoje.
- `src/routes/_authenticated/pagamentos.tsx` — UI oficial de conexão OAuth.
- `src/routes/api/public/mp.callback.ts`, `mp.webhook.ts` — endpoints MP.
- `src/components/finance/PaymentGatewayCard.tsx` — card no financeiro.

### Onboarding do parceiro
- `src/components/OwnerOnboarding.tsx` — onboarding visual atual.
- `src/routes/auth.tsx` — cadastro/login do dono.

### Restaurante ativo / status
- `src/contexts/RestaurantContext.tsx` — carrega restaurante ativo.
- `src/hooks/use-restaurant-status.ts` — status operacional (aberto/fechado).
- `src/lib/restaurant-status.ts` — regras de horário.

### Taxa de serviço / plataforma
- `src/lib/payments/PricingEngine.ts` — cobra fee via `platform_fees`.
- `src/lib/platform-settings.functions.ts` — configuração admin (commission,
  fixed_fee, min_order etc.).

### Configuração comercial (documentação)
- `LOCALIX_BUSINESS_MODEL_V1.md`, `BUSINESS_DECISIONS.md` — decisões oficiais.

## Conclusão

Não existe hoje um domínio dedicado a **inteligência comercial**
(elegibilidade, lifecycle do restaurante, política de taxa de serviço,
onboarding oficial, eventos comerciais). Toda a lógica de gateway está
corretamente encapsulada no Payment Domain — o novo Billing Domain
**não a substitui nem depende dela**.

## Desacoplamento confirmado

- Billing NÃO importa `@/lib/payments`, `@/lib/checkout`, `@/lib/loyalty`.
- Billing NÃO acessa Supabase.
- Billing NÃO conhece Stripe nem Mercado Pago.
- Payment Domain permanece a única porta para gateways.
