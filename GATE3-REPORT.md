# Localix Delivery - Gate 3: correcoes finais

Execucao em 11/11/2026, exclusivamente em Localix-Codex-Gate3, branch codex/gate3-lint-fix. HEAD preservado: 0ad4fd3adf9512744911ecf71a2cf0decd18e31e. Issue #88; PR #87 em draft, sem alteracao remota.

## Parecer

**PASS para preparar o commit local das correcoes do Gate 3.** Os cinco bloqueios foram tratados e os checks finais passaram. O saldo com bases mistas permanece indisponivel por protecao deliberada ate a definicao da semantica contabil. Nenhum commit, push, merge, deploy, migration ou escrita remota foi executado. Este parecer substitui o relatorio anterior aos cinco bloqueios.

## Correcoes implementadas

1. Fidelidade: benefit-config.ts valida sem remover campos adicionais na raiz, trigger e reward. Quantidades e recompensas numericas armazenadas como strings permanecem strings. O payload de edicao preserva active, priority e rule_type legado quando o tipo visual nao mudou. Configuracoes incompativeis com o editor bloqueiam o salvamento antes da consulta, evitando substituir dados por defaults. Quatro testes de persistencia.
2. Historico de pedidos: builderId nullable e aceito; adaptador compartilhado de repeticao usado nas duas rotas. Teste integrado verifica item visivel no modelo, subtotal de R$ 50,00, serializacao/reidratacao no carrinho e renderizacao real de cupons cozinha/cliente.
3. Dashboard/Ledger: reproduzido 50 + 48,51 - 1,49 = 97,02. A formula preexistente nao foi alterada: nao existe evidencia suficiente para considerar recebivel bruto ou liquido em todos os produtores. O resumo sinaliza bases mistas de lancamentos COMPLETED no mesmo restaurante; o adaptador recusa sua exposicao ao dashboard/status/fluxo de caixa/relatorios. O widget apresenta indisponibilidade, sem exibir saldo duplicado. Quatro testes integrados comprovam o bloqueio, isolamento por restaurante/status e R$ 48,51 no fluxo pagamento bruto menos taxa.
4. Horarios: dias falsy legados (null/false) nao sao convertidos em horarios vazios. Oito casos de teste cobrem horarios ausentes, desabilitados, invalidos, turnos noturnos, fechamento manual e consistencia WhatsApp/vitrine.
5. Stripe: amount_total e currency aceitam null no validador e no contrato da Edge Function. Mantida a rejeicao de IDs, totais e moedas com tipos invalidos. Teste do mapeamento de checkout com campos nullable e quatro payloads invalidos. Contrato oficial: https://docs.stripe.com/api/checkout/sessions/object (amount_total integer nullable; currency nullable).

## Contratos Supabase: evidencia somente de leitura

Foram consultadas apenas colunas do catalogo information_schema.columns, sem registros de clientes ou pagamentos e sem DDL/DML. Projetos identificados pela conexao Supabase: Localix Delivery - Staging (dnotmvbhuqujvqdtgzav) e Localix Production (mvkfrwxgneqzvoabkaws). Resultado identico em ambos:

| Tabela/campo                                     | Tipo    | Nulabilidade | Default          |
| ------------------------------------------------ | ------- | ------------ | ---------------- |
| order_pricing_snapshot.service_fee_payer         | text    | NOT NULL     | 'customer'::text |
| order_pricing_snapshot.realized_platform_revenue | numeric | NOT NULL     | 0                |

Row usa string/number; Insert/Update opcionais sem null, alinhados a existencia de defaults. A migration 20260914174138_atomic_checkout_order_creation.sql declara parametros text/numeric e usa esses campos no INSERT (linhas 35,42,123,130). As migrations locais posteriores tambem usam realized_platform_revenue. A declaracao ADD COLUMN desses dois campos nao foi encontrada na cadeia local: a existencia e nulabilidade foram comprovadas diretamente no catalogo, nao inferidas apenas dos consumidores SQL. Nenhuma migration foi criada ou executada.

Favoritos: customer_favorites possui customer_id, restaurant_id, item_kind e item_id obrigatorios; nao possui target_type/target_id. O adaptador CRM suporta produtos/menu_item e recusa restaurant/category, sem inventar contrato. A tela publica continua usando seu servico separado, que suporta produtos e builders. Quatro testes verificam insercao, listagem/remocao por cliente e alvos nao suportados.

Perfis: customer_profiles possui full_name/email/avatar_url/provider/phone/whatsapp/last_payment_method, sem status/notes. Tres testes verificam patch nullable valido e rejeicao dos dois campos ausentes antes da escrita.

Promocoes: rules/targets sao relacoes separadas, ausentes em promotions. promotionColumnPatch preserva JSON e campos conhecidos; recusa alteracoes relacionais, que possuem operacoes dedicadas. Quatro testes cobrem os contratos. Nenhuma formula de desconto foi alterada.

## Arquivos e linhas de atencao

| Risco residual      | Arquivo/linha                                                               | Condicao e evidencia                                                                                                                                                             |
| ------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Medio               | src/lib/ledger/LedgerService.ts:122; src/lib/finance/dashboard-balance.ts:6 | Bases mistas bloqueiam exposicao; dashboard-ledger.integration.test.ts reproduz 97,02 e confirma rejeicao. Remover a protecao exige testes de semantica contabil dos produtores. |
| Medio               | src/lib/customer/loyalty/benefit-config.ts:55                               | Legado incompativel bloqueia escrita; teste confirma preservacao. Dados validos e strings numericas fazem round trip.                                                            |
| Medio, preexistente | supabase/migrations/20260914174138_atomic_checkout_order_creation.sql:123   | DDL original dos dois campos nao localizado na cadeia local; tipos comprovados em staging/producao. Replay completo em banco novo requer validacao separada.                     |
| Baixo               | src/components/finance/widgets/ExecutiveKpisWidget.tsx:34                   | Erro de conciliacao apresenta indisponibilidade e impede mostrar cache financeiro incorreto.                                                                                     |
| Baixo               | src/lib/stripe/StripePaymentEventMapper.ts:52                               | Contrato nullable aceito e tipos invalidos rejeitados por regressao.                                                                                                             |

## Revisao final e riscos

- Criticos/altos: nenhum bloqueio novo identificado no delta final. Os cinco bloqueios anteriores possuem correcao ou protecao de exposicao com regressao automatizada.
- Medio: restaurantes com as duas bases de lancamentos terao o resumo financeiro indisponivel, inclusive quando os lancamentos pertencem a pedidos distintos. E uma protecao conservadora deliberada. Para remover a protecao, definir semantica contabil dos produtores e testar pagamento/taxas/recebivel/reembolso/payout; nao simplesmente somar as duas bases. O calculo bruto existente do Ledger continua podendo resultar em 97,02; seus consumidores visuais passam pelo adaptador protegido.
- Medio: configuracoes antigas sem contrato visual valido nao podem ser regravadas pelo wizard; o dado armazenado permanece preservado. Sua migracao deve ter regra especifica e testes.
- Baixo: warnings preexistentes de hooks/Fast Refresh; teste preexistente de driver-wallet depende de window; a suite Node o ignora. Build usa chaves publicas ficticias e nao comprova transacoes com gateways reais. O tsconfig nao verifica todas as Edge Functions Deno.
- Revisadas as alteracoes locais completas em relacao ao HEAD do PR #87, incluindo arquivos novos e rotas geradas. Comparacao com origin/main distingue as alteracoes ja existentes no PR das correcoes locais do Gate 3; nao atribuir todo o historico do PR a este delta.
- routeTree.gen.ts inclui /comercial e /growth preexistentes no codigo-fonte. /comercial consulta auth.getUser e user_roles e aceita apenas comercial/admin. /growth herda autenticacao do layout e getGrowthDashboardData exige middleware e canReadCustomer360Restaurant (owner/admin ou partner_growth com atribuicao ativa). Matriz de autorizacao existente reexecutada. Nenhum guard removido.
- Sem diff local nas migrations, CI, regras ESLint ou lockfiles. OAuth/state, assinaturas de webhook, chaves de idempotencia, ordem das transicoes e formulas de split permanecem preservados. Nenhum any, ts-ignore ou eslint-disable novo no codigo manual para corrigir os bloqueios; routeTree.gen.ts conserva os casts e marcadores proprios do gerador TanStack.

## Validacao

Baseline: 448 erros ESLint de codigo/formatacao, 67 warnings. O checkout CRLF inicialmente produziu tambem 138.505 erros de finais de linha, normalizados por .gitattributes.

| Verificacao      | Resultado final                                           |
| ---------------- | --------------------------------------------------------- |
| ESLint           | 0 erros, 53 warnings; saida 0                             |
| TypeScript       | Aprovado; saida 0                                         |
| Vitest completo  | 151 arquivos; 1290 aprovados, 1 ignorado; saida 0         |
| Prettier         | Todos os arquivos alterados suportados aprovados; saida 0 |
| Build Vite/Nitro | Aprovado; saida real 0                                    |
| git diff --check | Aprovado; saida 0                                         |

ESLint: **448 -> 0 erros**, warnings **67 -> 53**; regras rigorosas preservadas. Foram acrescentados 31 testes aprovados em relacao a rodada anterior de 1259. O unico skip e src/lib/driver-wallet.test.ts:40, condicionado a window, anterior a esta correcao. Vitest completo final: 300,22 segundos, 1291 casos no total. Uma primeira rodada completa encontrou tres falhas apenas no mock de server functions do novo teste de promocoes; o adaptador foi extraido e testado sem o mock incompativel, e toda a suite foi reexecutada com sucesso. Nenhuma assercao foi removida para obter aprovacao.

Ferramentas: Node 22.16.0 isolado em node_modules/.cache/gate3; Bun 1.3.14. Comandos usados: eslint . --format json; tsc --noEmit --incremental com cache local; prettier --write/--check nos arquivos alterados; vitest run --passWithNoTests --maxWorkers 1 --testTimeout 30000 (TZ=UTC); vite build com VITE_SUPABASE_URL/PUBLISHABLE_KEY/PROJECT_ID ficticios. Os codigos de saida de Vitest e build sao capturados do processo filho, sem confundir avisos stderr com falha. Logs em node_modules/.cache/gate3, ignorados pelo Git.

## Integracao segura ao PR #87

Nenhum commit foi criado. Apos autorizacao, revisar e incluir tambem todos os arquivos novos listados abaixo no futuro commit de Gate 3. Integrar esse commit sobre audit/pre-sale-ci-independent-checks, verificando antes se o head remoto ainda corresponde a 0ad4fd3a e tratando eventual divergencia em branch isolada. Manter o PR #87 em draft, executar os checks do PR e preservar revisao financeira da protecao de bases mistas. Nao integrar diretamente em main, reescrever historico publicado ou publicar deploy a partir deste parecer.

## Arquivos com diff local ou novos (135)

- .gitattributes
- GATE3-REPORT.md
- src/components/BottomNav.tsx
- src/components/DemoDashboardCards.tsx
- src/components/ProfileCompletionBanner.tsx
- src/components/ReviewForm.tsx
- src/components/driver/DriverShiftCard.tsx
- src/components/finance/widgets/ExecutiveKpisWidget.tsx
- src/components/payments/MercadoPagoCard.tsx
- src/contexts/OrdersRealtimeContext.tsx
- src/contexts/RestaurantContext.tsx
- src/contexts/RestaurantSessionContext.tsx
- src/hooks/use-role.ts
- src/integrations/supabase/types.ts
- src/lib/address/AddressService.test.ts
- src/lib/admin-orders.functions.ts
- src/lib/benefits.functions.ts
- src/lib/catalog/CatalogService.functions.ts
- src/lib/consultor.functions.ts
- src/lib/customer-area.functions.ts
- src/lib/customer-notify.ts
- src/lib/customer/CustomerFavoritesService.test.ts
- src/lib/customer/CustomerFavoritesService.ts
- src/lib/customer/CustomerPreferencesService.ts
- src/lib/customer/CustomerService.profile.test.ts
- src/lib/customer/CustomerService.ts
- src/lib/customer/CustomerTimeline.ts
- src/lib/customer/communication/CampaignAudienceService.ts
- src/lib/customer/communication/CommunicationHistoryService.ts
- src/lib/customer/communication/CommunicationPreferenceService.ts
- src/lib/customer/intelligence/CustomerAnalyticsService.ts
- src/lib/customer/intelligence/CustomerIntelligenceService.ts
- src/lib/customer/loyalty/LoyaltyService.ts
- src/lib/customer/loyalty/benefit-config.test.ts
- src/lib/customer/loyalty/benefit-config.ts
- src/lib/customer/loyalty/loyalty-server.ts
- src/lib/customer360-campaign-automation.functions.ts
- src/lib/customer360-measurement.functions.ts
- src/lib/customer360-measurement.ts
- src/lib/customer360.functions.ts
- src/lib/customer360.ts
- src/lib/delivery-assignment.functions.ts
- src/lib/delivery-drivers.functions.ts
- src/lib/delivery-queue.functions.ts
- src/lib/driver-dashboard.functions.ts
- src/lib/driver-shift.functions.ts
- src/lib/finance/FinanceDomain.ts
- src/lib/finance/cashflow.functions.ts
- src/lib/finance/dashboard-balance.test.ts
- src/lib/finance/dashboard-balance.ts
- src/lib/finance/dashboard-ledger.integration.test.ts
- src/lib/financial-closing.functions.ts
- src/lib/growth-dashboard.functions.ts
- src/lib/json.test.ts
- src/lib/json.ts
- src/lib/ledger/LedgerService.ts
- src/lib/loyalty.functions.ts
- src/lib/opening-hours.test.ts
- src/lib/opening-hours.ts
- src/lib/operations-central.functions.ts
- src/lib/order-sounds.ts
- src/lib/orders/stored-order-items.test.ts
- src/lib/orders/stored-order-items.ts
- src/lib/partner-growth.test.ts
- src/lib/partner-growth.ts
- src/lib/payments/PaymentService.test.ts
- src/lib/payments/PaymentService.ts
- src/lib/payments/WebhookService.test.ts
- src/lib/payments/WebhookService.ts
- src/lib/payments/mercado-pago-provider-source.test.ts
- src/lib/payments/providers/MercadoPagoProvider.ts
- src/lib/payments/providers/StripeProvider.ts
- src/lib/payments/reconciliation-gateway.test.ts
- src/lib/payments/reconciliation-gateway.ts
- src/lib/payments/reconciliation.functions.ts
- src/lib/payments/repositories.ts
- src/lib/payments/split.functions.ts
- src/lib/payments/types.ts
- src/lib/payments/webhooks.functions.ts
- src/lib/platform-revenue/RevenueAnalyticsService.ts
- src/lib/platform-revenue/RevenueSettingsService.ts
- src/lib/platform-settings.functions.ts
- src/lib/platform/PlatformEventBus.ts
- src/lib/print-service.ts
- src/lib/product/ProductService.functions.ts
- src/lib/product/configuration/ProductConfigurationService.functions.test.ts
- src/lib/product/intelligence/ProductIntelligence.functions.ts
- src/lib/product/pricing/PromotionService.functions.test.ts
- src/lib/product/pricing/PromotionService.functions.ts
- src/lib/product/pricing/promotion-patch.ts
- src/lib/stripe/StripeConnect.test.ts
- src/lib/stripe/StripeConnectService.ts
- src/lib/stripe/StripeMapper.ts
- src/lib/stripe/StripePaymentEventMapper.ts
- src/lib/stripe/StripeWebhookService.ts
- src/lib/stripe/stripe-event-object.test.ts
- src/lib/supabase-admin-diagnostic.functions.ts
- src/lib/superadmin.functions.ts
- src/lib/support-admin.functions.ts
- src/lib/tenant/TenantConfigurationService.test.ts
- src/lib/tenant/TenantConfigurationValidator.ts
- src/lib/tracking/customer/customer-tracking.functions.ts
- src/lib/tracking/operations/operations-tracking.functions.ts
- src/lib/tracking/retention/retention.service.ts
- src/lib/tracking/tracking.mapper.ts
- src/lib/tracking/tracking.snapshot.ts
- src/lib/tracking/tracking.timeline.ts
- src/lib/tracking/tracking.types.ts
- src/lib/whatsapp.functions.ts
- src/routeTree.gen.ts
- src/routes/$slug.sobre.tsx
- src/routes/\_\_root.tsx
- src/routes/\_authenticated/customers.tsx
- src/routes/\_authenticated/dashboard.tsx
- src/routes/\_authenticated/entregas.tsx
- src/routes/\_authenticated/featured.tsx
- src/routes/\_authenticated/growth.tsx
- src/routes/\_authenticated/inventory.tsx
- src/routes/\_authenticated/loyalty.tsx
- src/routes/\_authenticated/programa-fidelidade.tsx
- src/routes/\_authenticated/promotions.tsx
- src/routes/\_authenticated/reviews.tsx
- src/routes/\_authenticated/route.tsx
- src/routes/comercial.tsx
- src/routes/favoritos.tsx
- src/routes/home.tsx
- src/routes/meus-pedidos.tsx
- src/routes/motoboy.tsx
- src/routes/pedido-sucesso.$id.tsx
- src/routes/pedido.$id.tsx
- supabase/functions/mp-oauth-callback/index.ts
- supabase/functions/mp-oauth/index.ts
- supabase/functions/stripe-checkout/index.ts
- supabase/functions/stripe-connect-refresh/index.ts
- supabase/functions/stripe-webhook/index.ts
