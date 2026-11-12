# Gate 4 — H-02/H-03: conferência de fronteiras e pagador da taxa

**Data:** 12/11/2026  
**Ambiente:** Supabase Staging `dnotmvbhuqujvqdtgzav`  
**Modo:** consultas SQL somente leitura e revisão estática de código; sem criação de pedidos, cobranças ou migrations.  
**Status:** PASS para configuração e simulação SQL; BLOCK para checkout real, snapshot persistido e integração E2E.

## Fontes observadas

- `public.platform_settings`: `platform_fee_until_30=0.99`, `platform_fee_above_30=1.49`, `minimum_order=20.00`.
- `public.platform_fees`: `fee_up_to_30=0.99`, `fee_above_30=1.49`, `min_order=20.00`.
- `PricingEngine.ts`: usa `platform_settings`, escolhe taxa com `subtotal <= 30`, calcula `customerTotal` segundo `serviceFeePayer` e reduz `restaurantNet` quando pagador é restaurante.
- `PaymentService.ts`: `calcFees` usa `platform_fees` e também escolhe `subtotal <= 30`.
- `service-fee-settings.test.ts`: inclui testes existentes para pagador consumidor/restaurante e preservação do pagador em snapshot após mudança de configuração.

## Simulação SQL dos seis cenários

Os valores abaixo assumem exclusivamente subtotal e taxa Localix; **não incluem entrega, descontos, benefícios, tarifas do gateway, split ou liquidação**. São oráculos simplificados, não valores finais de pedidos reais.

| Subtotal | Pagador | Taxa PricingEngine | Taxa PaymentService | Total consumidor simplificado | Parcela restaurante antes de outros custos |
|---:|---|---:|---:|---:|---:|
| R$ 29,99 | consumidor | R$ 0,99 | R$ 0,99 | R$ 30,98 | R$ 29,99 |
| R$ 30,00 | consumidor | R$ 0,99 | R$ 0,99 | R$ 30,99 | R$ 30,00 |
| R$ 30,01 | consumidor | R$ 1,49 | R$ 1,49 | R$ 31,50 | R$ 30,01 |
| R$ 29,99 | restaurante | R$ 0,99 | R$ 0,99 | R$ 29,99 | R$ 29,00 |
| R$ 30,00 | restaurante | R$ 0,99 | R$ 0,99 | R$ 30,00 | R$ 29,01 |
| R$ 30,01 | restaurante | R$ 1,49 | R$ 1,49 | R$ 30,01 | R$ 28,52 |

## Classificação

- **H-02 PASS restrito:** os limites e as duas configurações de Staging coincidem com DEC-015, inclusive R$ 30,00.
- **H-03 PASS restrito:** os seis resultados da simulação SQL respeitam a distribuição simplificada por pagador.
- **H-02/H-03 BLOCK E2E:** não foram executados `computePricing()` no runtime do checkout, criação de snapshot, `PaymentService` real, PIX/cartão ou liquidação; não se pode promover estes cenários a homologação integral.
- **Risco:** `platform_settings` e `platform_fees` são duas fontes persistidas. Igualdade atual não prova sincronização futura; revisar origem autoritativa, cache e falhas de loader antes de qualquer mudança.
- **Risco:** confirmação de `service_fee_payer` por tenant e snapshot real permanece pendente.

**Decisão:** não alterar código, banco, produção, merge ou deploy. Manter DEC-021 com princípio aprovado parcialmente e contrato integral pendente; Issue #90 aberta; Gate Financeiro NO-GO.

**Esta decisão deve atualizar o Documento Mestre** após reconciliação documental e aceite formal.
