# Fase B — Plano de Piloto Controlado

## Objetivo

Transformar a autorização concedida pela DEC-012 em uma execução controlada, mensurável e reversível.

O piloto não tem como objetivo maximizar cadastros. O objetivo é provar que parceiros elegíveis conseguem ser ativados, gerar pedidos reais e iniciar recorrência sem comprometer segurança, integridade financeira ou capacidade operacional.

## Fonte de verdade

Este plano segue:

- Documento Mestre do Localix Delivery;
- DEC-010 — Gate C / integridade financeira;
- DEC-011 — Gate D / RLS e RBAC;
- DEC-012 — encerramento da Fase A e liberação da Fase B.

Quando houver conflito com documentação operacional antiga, prevalecem o Documento Mestre, as decisões DEC-010/011/012 e o estado técnico atual da plataforma.

Alguns documentos históricos ainda citam Lovable Publish e Stripe. Esses trechos não representam o baseline operacional atual do piloto, que utiliza Vercel, Supabase e Mercado Pago.

## Escopo do piloto

- duração: 30 dias;
- composição-alvo: 5 pizzarias + 5 hamburguerias;
- mensalidade: R$ 0,00 durante o piloto;
- comissão sobre venda: 0%;
- taxa de serviço: conforme regra financeira vigente;
- critério-base de entrada: histórico mínimo de 200 pedidos/mês nos últimos 3 meses;
- operação: controlada, acompanhada e com capacidade de intervenção manual.

## Estratégia de entrada

O piloto deve ser ativado em ondas.

### Onda 0 — Validação interna

Antes do primeiro parceiro real:

- confirmar que produção está no commit esperado;
- confirmar saúde do Vercel e Supabase;
- executar smoke test do storefront;
- executar criação de pedido;
- confirmar persistência de `orders`, `order_pricing_snapshot` e `order_payment`;
- confirmar leitura do pedido no painel do parceiro;
- confirmar fluxo operacional até conclusão;
- confirmar que incidentes podem ser identificados e escalados.

Nenhuma mudança financeira ou de arquitetura deve ser introduzida apenas para executar a Onda 0.

### Onda 1 — 2 parceiros

Entrar primeiro com:

- 1 pizzaria;
- 1 hamburgueria.

Objetivo:

- provar onboarding;
- medir tempo até ativação;
- acompanhar os primeiros pedidos com baixa exposição;
- validar suporte e monitoramento.

Critério para avançar:

- nenhum incidente financeiro crítico;
- nenhum acesso cruzado entre tenants;
- nenhum bloqueio recorrente de checkout;
- pedidos reais conseguindo atingir conclusão;
- métricas básicas sendo capturadas.

### Onda 2 — 4 parceiros adicionais

Total acumulado: 6 parceiros.

Somente iniciar se a Onda 1 estiver operacionalmente estável.

Objetivo:

- testar concorrência operacional maior;
- observar diferenças de catálogo e operação;
- validar onboarding repetível;
- medir necessidade real de suporte humano.

### Onda 3 — 4 parceiros adicionais

Total acumulado: 10 parceiros.

Objetivo:

- completar a composição prevista do piloto;
- operar por período suficiente para medir recorrência;
- gerar base real para revisão do Documento Mestre v1.1.

## Critérios de elegibilidade do parceiro

### Obrigatórios

O parceiro precisa:

- ser pizzaria ou hamburgueria nesta primeira composição;
- comprovar aproximadamente 200 pedidos/mês nos últimos 3 meses;
- possuir operação de delivery ativa;
- ter capacidade operacional para receber pedidos digitais;
- fornecer cardápio, preços, horários, área de entrega e meios de pagamento corretamente;
- indicar uma pessoa responsável pelo piloto;
- aceitar acompanhamento durante os 30 dias.

### Desejáveis

Priorizar parceiros que:

- já recebem pedidos por WhatsApp;
- possuem base recorrente de clientes;
- têm Instagram ativo;
- conseguem divulgar QR Code/link próprio;
- têm cardápio organizado;
- respondem rapidamente ao atendimento;
- conseguem operar o piloto sem depender de alterações profundas no produto.

### Não entrar no piloto

Adiar parceiros que:

- exigem customização estrutural antes de operar;
- não conseguem confirmar preços/cardápio;
- não possuem responsável operacional;
- apresentam volume insuficiente para gerar aprendizado;
- dependem de funcionalidade ainda não homologada;
- exigem mudança financeira específica para aderir.

## Checklist de onboarding

O parceiro só passa para **ATIVADO** quando:

- cadastro e tenant estão corretos;
- owner consegue autenticar;
- slug público funciona;
- identidade visual mínima foi configurada;
- categorias e produtos principais estão publicados;
- preços e adicionais foram conferidos;
- horários estão corretos;
- taxa de entrega e pedido mínimo foram validados;
- métodos de pagamento foram conferidos;
- Mercado Pago está conectado quando aplicável;
- configuração do pagador da taxa de serviço foi validada;
- entregadores/operação de entrega foram configurados quando aplicável;
- pedido de teste foi concluído;
- painel do parceiro recebeu o pedido;
- responsável do estabelecimento sabe aceitar, preparar e concluir pedidos;
- canal de suporte foi informado.

## Estados do funil de parceiro

Usar os seguintes estados operacionais:

1. `prospect`
2. `qualified`
3. `onboarding`
4. `activated`
5. `first_order`
6. `recurring`
7. `at_risk`
8. `inactive`

Definições:

- **qualified**: atende aos critérios mínimos;
- **activated**: onboarding concluído e estabelecimento apto a receber pedido real;
- **first_order**: primeiro pedido real concluído;
- **recurring**: voltou a receber pedidos após o primeiro ciclo;
- **at_risk**: queda relevante ou ausência de pedidos dentro da janela operacional definida;
- **inactive**: operação interrompida ou parceiro sem atividade por período prolongado.

## KPIs obrigatórios

### Parceiro

- parceiros qualificados;
- parceiros em onboarding;
- parceiros ativados;
- taxa de ativação;
- tempo entre adesão e ativação;
- tempo entre ativação e primeiro pedido;
- parceiros com primeiro pedido;
- parceiros recorrentes;
- pedidos por parceiro/dia;
- pedidos por parceiro/mês.

### Consumidor

- visitantes;
- carrinhos iniciados;
- pedidos criados;
- pedidos concluídos;
- conversão visita → carrinho;
- conversão carrinho → pedido;
- clientes novos;
- clientes recorrentes;
- segunda compra;
- frequência de compra.

### Financeiro

- GMV;
- receita Localix;
- receita Localix por pedido;
- taxa de serviço média;
- divergência entre snapshot e pagamento;
- refunds;
- chargebacks;
- falhas de pagamento;
- subsídio de benefícios por pedido, quando houver.

### Operação

- cancelamentos;
- taxa de cancelamento;
- pedidos atrasados;
- tempo médio de preparação;
- tempo médio até conclusão;
- incidentes P1/P2/P3;
- contatos de suporte por parceiro;
- contatos de suporte por 100 pedidos.

## Eventos mínimos do funil

O piloto precisa conseguir identificar, por evento ou dado derivável:

### Parceiro

- parceiro criado;
- parceiro qualificado;
- onboarding iniciado;
- onboarding concluído;
- parceiro ativado;
- primeiro pedido recebido;
- primeiro pedido concluído.

### Consumidor

- visita ao cardápio;
- item adicionado ao carrinho;
- checkout iniciado;
- pedido criado;
- pagamento iniciado;
- pagamento aprovado;
- pedido concluído;
- segunda compra.

Não criar nova infraestrutura de eventos apenas por preferência arquitetural se os indicadores puderem ser derivados com segurança das tabelas e logs existentes.

## Monitoramento financeiro crítico

Durante o piloto, revisar diariamente:

- pedido sem pagamento quando deveria ser online;
- pagamento sem pedido;
- pagamento duplicado;
- divergência entre `order_pricing_snapshot` e valor do gateway;
- `application_fee` divergente;
- webhook não processado recente;
- refund divergente;
- ledger duplicado novo;
- transição financeira incompatível com a state machine.

Qualquer ocorrência comprovada desses itens deve ser tratada como incidente de alta prioridade.

## Critérios de pausa imediata

Pausar expansão do piloto se ocorrer:

- cobrança duplicada nova;
- pagamento aprovado sem pedido íntegro;
- split divergente do snapshot;
- bypass de RLS/RBAC;
- acesso cruzado entre restaurantes;
- regressão de status causada por webhook;
- indisponibilidade recorrente de checkout;
- perda ou corrupção de pedido;
- incidente que exija rollback estrutural.

A pausa de expansão não significa necessariamente desligar todos os parceiros já ativos. A resposta deve ser proporcional ao incidente e baseada no domínio afetado.

## Rotina diária do piloto

Revisar:

- erros recentes de runtime;
- saúde do Vercel;
- saúde do Supabase;
- falhas de Edge Functions;
- pedidos criados, pagos e concluídos;
- pagamentos pendentes/rejeitados;
- webhooks com falha;
- cancelamentos;
- incidentes abertos;
- parceiros ainda sem primeiro pedido.

## Rotina semanal

Consolidar:

- parceiros ativados;
- parceiros que chegaram ao primeiro pedido;
- parceiros recorrentes;
- pedidos por parceiro;
- GMV;
- receita Localix;
- receita/pedido;
- CAC parceiro, quando houver mídia/prospecção paga mensurável;
- clientes novos e recorrentes;
- segunda compra;
- cancelamentos;
- atrasos;
- incidentes;
- custo de suporte;
- subsídios;
- top 3 fricções do piloto;
- top 3 prioridades da semana seguinte.

## Critérios de sucesso do piloto

O piloto deve produzir evidência suficiente para responder:

1. parceiros elegíveis conseguem ser ativados sem esforço operacional excessivo?
2. conseguem chegar ao primeiro pedido em tempo aceitável?
3. os pedidos continuam após o primeiro ciclo?
4. clientes conseguem concluir a jornada com baixa fricção?
5. a plataforma suporta os pedidos sem incidentes financeiros críticos?
6. o parceiro percebe valor suficiente para continuar?
7. o custo operacional e de suporte é compatível com o modelo?
8. a receita por pedido e o volume observado sustentam a hipótese econômica?

Não definir metas artificiais retroativas apenas para declarar sucesso.

## Critérios para avanço à Fase C

A Fase B pode ser considerada concluída quando houver dados reais suficientes para iniciar decisões de retenção sobre:

- recompra;
- fidelidade;
- benefícios;
- reativação;
- redução de cancelamento;
- redução de atraso;
- redução de suporte manual.

A transição deve gerar nova decisão formal.

## Dívidas que não bloqueiam o piloto por si só

Desde que não provoquem incidente real:

- dívida global de lint/Prettier;
- documentação histórica desatualizada;
- observabilidade financeira administrativa incompleta;
- ausência de matriz E2E exaustiva;
- refatorações arquiteturais sem impacto funcional imediato.

Essas dívidas devem continuar rastreadas, mas não devem deslocar o foco do aprendizado real do piloto.

## Entregáveis do primeiro ciclo

Ao final da primeira semana de operação real, produzir:

- relatório de ativação dos parceiros;
- relatório dos primeiros pedidos;
- incidentes e causas;
- métricas do funil;
- comparação entre esperado e observado;
- decisões de correção;
- backlog prioritário baseado em evidência.

## Governança

Nenhuma mudança de preço, split, taxa, benefício, crédito, refund, saldo ou regra financeira deve ser feita durante o piloto sem análise e decisão explícita.

Correções críticas devem seguir:

**causa raiz → correção mínima → testes → build → diff → commit → deploy controlado → validação → rollback disponível**

