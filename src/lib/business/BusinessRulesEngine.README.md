# Business Rules Engine (BRE)

Camada central que concentra todas as decisões de negócio do Localix.
Nenhum componente, edge function ou service deve embutir regras — todos
consultam o `BusinessRulesEngine`.

## Arquitetura

```
BusinessRulesEngine (facade)
  ├── BusinessRuleRegistry     -> catálogo de regras
  ├── BusinessRuleExecutor     -> executa regras (cache + eventos + logger)
  └── RuleEventBus             -> RuleExecuted / RulePassed / RuleRejected
```

Tabelas:
- `business_rules` — parametrização (código, categoria, prioridade, `enabled`, `configuration_json`).
- `business_rule_execution_log` — append-only (código, resultado, motivo, tempo, contexto).

## Categorias

`ORDER`, `PAYMENT`, `DELIVERY`, `COUPON`, `LOYALTY`, `RESTAURANT`,
`CUSTOMER`, `FINANCIAL`, `SYSTEM`.

## Fluxo

1. Consumidor monta `BusinessRuleContext`.
2. Chama `businessRulesEngine.evaluate(category, ctx)`.
3. Executor roda regras da categoria em ordem de prioridade.
4. Cache curto (2s) evita reavaliações idênticas.
5. Cada regra publica `RuleExecuted` + `RulePassed`/`RuleRejected`.
6. Consumidor recebe `EngineDecision { allowed, reason, rule_code, severity }`.

## Como adicionar uma nova regra

```ts
import { globalRuleRegistry } from "@/lib/business/BusinessRuleRegistry";
import type { BusinessRule } from "@/lib/business/types";

const RULE_EX: BusinessRule = {
  id: "ORDER_HOLIDAY_FEE",
  name: "Taxa de feriado",
  description: "…",
  priority: 70,
  enabled: true,
  category: "ORDER",
  evaluate(ctx) {
    return { allowed: true, rule_code: "ORDER_HOLIDAY_FEE", severity: "info" };
  },
};

globalRuleRegistry.register(RULE_EX);
```

## Como alterar / desabilitar regras

- Configuração dinâmica: alterar `business_rules.configuration_json` e
  `enabled` (painel Admin). Regras leem os overrides quando implementarem
  hidratação a partir da tabela.
- Runtime: `registry.setEnabled(id, false)`.

## Integração (pendências)

O BRE já está pronto para ser plugado. Para preservar módulos existentes,
os pontos de integração devem chamar `businessRulesEngine.evaluate` antes
das operações:

- `OrderOrchestrator.transition` → categoria `ORDER`
- `checkout/OrderService.createCheckoutOrder` → categorias `ORDER`, `COUPON`, `DELIVERY`
- `SplitService.startSplit` → categoria `FINANCIAL`
- `PaymentIntentService.create` → categoria `PAYMENT`

## Cobertura de testes

Suite `BusinessRulesEngine.test.ts` cobre os cenários exigidos
(pedido abaixo do mínimo, restaurante fechado, cupom expirado, cliente
bloqueado, pagamento expirado, área não atendida, token MP inválido e
pedido válido).

## Pendências para produção

- Hidratação de regras a partir da tabela `business_rules` (overrides de
  prioridade/enabled/configuração).
- Logger persistente em `business_rule_execution_log` (via server function
  administrativa).
- Painel Admin para editar/ativar/desativar regras.
- Integrações efetivas nos serviços citados acima (fora do escopo deste
  prompt para não alterar funcionalidades existentes).
