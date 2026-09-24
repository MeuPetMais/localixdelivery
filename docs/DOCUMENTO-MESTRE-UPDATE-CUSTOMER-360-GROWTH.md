# Atualização do Documento Mestre — Customer 360 / Growth

**Data:** 2026-09-24  
**Origem:** DEC-013 + DEC-014  
**Status:** Atualização estrutural obrigatória

## Trecho recomendado para incorporar ao Documento Mestre

### Customer 360 e Growth Engine

O Localix Growth passa a operar sobre um Customer 360 partner-scoped.

A identidade comportamental canônica é `public.customers`, associada ao `restaurant_id` e alimentada a partir de `orders`. Essa arquitetura inclui clientes guest e autenticados sem obrigar cadastro.

`orders` permanece a fonte transacional de verdade. Growth consome dados de pedidos, mas não possui autoridade sobre preço, taxa, desconto financeiro, pagamento, split, saldo, reembolso ou state machine.

O lifecycle oficial do Customer 360 é:

- NEW
- AWAITING_SECOND_PURCHASE
- RECURRING
- HIGH_VALUE
- LOYAL
- AT_RISK
- INACTIVE
- REACTIVATED

As regras de lifecycle devem permanecer centralizadas no domínio Customer 360 e não podem ser reimplementadas no frontend.

A camada Customer Intelligence deriva oportunidades do Customer 360, incluindo:
- segunda compra;
- recorrência;
- risco;
- inatividade;
- reativação;
- alto valor;
- fidelidade;
- produto favorito quando comprovável pelo histórico.

A mensuração de Growth usa `growth_measurement_events` para registrar:
- oportunidade visualizada;
- ação selecionada;
- ação executada;
- pedido atribuído.

Esse ledger é exclusivamente analítico.

As automações de campanha utilizam consentimento partner-scoped em `customer_growth_marketing_consents` e jobs em `growth_campaign_automation_jobs`.

Nenhuma campanha pode ser considerada elegível para envio sem:
1. consentimento explícito e vigente;
2. provider comprovado para o canal;
3. respeito ao limite de frequência;
4. idempotência;
5. rastreabilidade no ledger de Growth.

Na data desta atualização, a infraestrutura de automação está implantada, mas o envio real continua bloqueado até que um provider seja integrado e comprovado.

### KPIs adicionais de Growth

Adicionar aos KPIs oficiais:
- taxa de segunda compra;
- clientes recorrentes;
- clientes em risco;
- clientes inativos;
- clientes reativados;
- frequência por 30 dias;
- oportunidades visualizadas;
- ações executadas;
- pedidos atribuídos;
- receita de pedidos atribuídos;
- view-to-action;
- action-to-order;
- retenção por coorte.

### Próxima fase operacional

A prioridade deixa de ser ampliar a arquitetura do Customer 360 e passa a ser:
- captar consentimentos reais;
- provar provider de comunicação;
- executar campanhas controladas;
- medir efeito sobre recompra e recorrência;
- revisar regras apenas com dados observados.

### Limitações vigentes

- Não foi possível provar sender real de WhatsApp/e-mail/push.
- Não foi possível provar causalidade econômica absoluta entre ação e pedido atribuído.
- Não foi possível provar matriz E2E completa de todas as combinações RBAC em produção.
- Favorite category permanece fora da Fase 1 sem snapshot histórico confiável.
