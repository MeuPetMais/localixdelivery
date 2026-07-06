# BUSINESS DECISIONS — Localix

> Registro oficial das decisões estratégicas de negócio aprovadas.
> Complementa `LOCALIX_BUSINESS_MODEL_V1.md`.
> Append-only: decisões antigas não são reescritas; novas decisões
> são adicionadas ao final e podem substituir decisões anteriores
> mediante nota explícita de revogação.

---

## Índice

- [BD-001](#bd-001) — Modelo comercial sem mensalidade e sem comissão
- [BD-002](#bd-002) — Taxa de Serviço Localix — R$ 0,99 por pedido
- [BD-003](#bd-003) — Transparência da taxa no checkout
- [BD-004](#bd-004) — Stripe Connect como gateway oficial e único
- [BD-005](#bd-005) — Suporte gratuito no onboarding Stripe
- [BD-006](#bd-006) — Elegibilidade mínima do parceiro
- [BD-007](#bd-007) — Pedido mínimo de R$ 20,00
- [BD-008](#bd-008) — Checkout oficial Localix obrigatório
- [BD-009](#bd-009) — Fluxo oficial de implantação
- [BD-010](#bd-010) — Período de implantação assistido
- [BD-011](#bd-011) — Cliente pertence ao restaurante
- [BD-012](#bd-012) — Fontes de receita — principal e futuras
- [BD-013](#bd-013) — Princípios de aprovação de novas funcionalidades
- [BD-014](#bd-014) — Roadmap oficial
- [BD-015](#bd-015) — Restrições comerciais permanentes

---

## BD-001
**Decisão:** A Localix opera sem mensalidade e sem comissão sobre
faturamento.
**Status:** Aprovado.
**Racional:** Diferencial competitivo central frente a marketplaces
tradicionais. Alinha incentivos entre plataforma e restaurante.
**Impacto:** Modelo de receita depende exclusivamente da Taxa de
Serviço por pedido (ver BD-002).

## BD-002
**Decisão:** Taxa de Serviço Localix de **R$ 0,99 fixa por pedido**.
**Status:** Aprovado.
**Racional:** Previsibilidade para o restaurante; custo marginal
decrescente conforme ticket médio cresce.
**Impacto:** Base do Billing Domain (roadmap #1). Substitui qualquer
faixa de taxa anteriormente considerada.

## BD-003
**Decisão:** A Taxa de Serviço deve aparecer de forma explícita e
identificada no checkout, para cliente final e para o estabelecimento.
**Status:** Aprovado.
**Racional:** Transparência é parte da proposta de valor.
**Impacto:** UI de checkout e resumos financeiros devem exibir a taxa
como linha própria.

## BD-004
**Decisão:** **Stripe Connect** é o gateway oficial e único da
plataforma.
**Status:** Aprovado.
**Racional:** Padrão global, split nativo, compliance e auditoria
maduros.
**Impacto:** Todo parceiro deve possuir conta Stripe conectada.
Outros gateways não são adicionados como padrão (ver BD-015).

## BD-005
**Decisão:** A equipe Localix presta suporte gratuito ao parceiro
durante todo o onboarding Stripe.
**Status:** Aprovado.
**Racional:** Reduz atrito na entrada; garante qualidade do KYC/KYB.
**Impacto:** Processo de implantação (ver BD-009) inclui etapa
dedicada de onboarding assistido.

## BD-006
**Decisão:** Elegibilidade mínima do parceiro: **600 pedidos/mês**
(média operacional).
**Status:** Aprovado.
**Racional:** Garante viabilidade operacional do modelo de taxa fixa
e qualidade de atendimento.
**Impacto:** Critério de homologação. Não bloqueia implantação
assistida (ver BD-010).

## BD-007
**Decisão:** **Pedido mínimo de R$ 20,00** no checkout.
**Status:** Aprovado.
**Racional:** Preserva economia unitária do pedido para restaurante
e plataforma.
**Impacto:** Regra já refletida no PricingEngine
(`minimum_order = 20`).

## BD-008
**Decisão:** Uso obrigatório do **checkout oficial Localix**.
**Status:** Aprovado.
**Racional:** Garante rastreabilidade, aplicação correta da taxa,
integração com fidelidade e experiência unificada.
**Impacto:** Não são suportados checkouts externos ou integrações
paralelas de pagamento.

## BD-009
**Decisão:** Fluxo oficial de implantação:
`Cadastro → Validação → Onboarding Stripe → Configuração →
Treinamento → Publicação → Homologação`.
**Status:** Aprovado.
**Racional:** Sequência padronizada garante qualidade e previsibilidade.
**Impacto:** Base para playbooks de onboarding e materiais de
treinamento.

## BD-010
**Decisão:** O período inicial de implantação pode ser acompanhado
pela equipe Localix para validação operacional antes da homologação
definitiva.
**Status:** Aprovado.
**Racional:** Permite validar aderência ao modelo mesmo quando o
volume ainda está em ramp-up.
**Impacto:** BD-006 é meta de referência durante a implantação
assistida, e critério firme na homologação.

## BD-011
**Decisão:** O cliente final pertence ao restaurante — não ao
marketplace.
**Status:** Aprovado.
**Racional:** Pilar de posicionamento e diferencial competitivo.
**Impacto:** CRM, dados, fidelidade e marketing são operados pelo
próprio estabelecimento; Localix é infraestrutura.

## BD-012
**Decisão:** Fontes de receita:
- Principal: Taxa de Serviço Localix.
- Futuras: Marketplace de Insumos, Serviços Premium, Publicidade,
  Parcerias, Integrações, Novos módulos.
**Status:** Aprovado.
**Racional:** Diversificação futura sem depender de mensalidade ou
comissão sobre faturamento.
**Impacto:** Nenhuma fonte futura substitui o modelo principal sem
nova decisão registrada aqui.

## BD-013
**Decisão:** Toda nova funcionalidade deve responder positivamente a
pelo menos uma das perguntas:
aumenta vendas? reduz custos? melhora a operação? aumenta
fidelização? melhora a experiência? fortalece o modelo Localix?
**Status:** Aprovado.
**Racional:** Filtro de priorização objetivo.
**Impacto:** Aplicável a todo backlog, prompts e planejamentos.

## BD-014
**Decisão:** Roadmap oficial: Billing Domain → Stripe Connect →
Wallet → Marketplace → BI → IA → Aplicativo.
**Status:** Aprovado.
**Racional:** Sequência que maximiza receita, retenção e valor
percebido, respeitando dependências técnicas.
**Impacto:** Base para planejamento de sprints e prompts subsequentes.

## BD-015
**Decisão:** Restrições comerciais permanentes:
- Não criar novos planos.
- Não criar cobrança de mensalidade.
- Não criar comissão sobre faturamento.
- Não adicionar novos gateways como padrão.
- Stripe Connect é o gateway oficial.
- Outros gateways somente com decisão estratégica formal futura.
**Status:** Aprovado.
**Racional:** Protege a identidade comercial da Localix contra
regressões de modelo.
**Impacto:** Qualquer proposta em conflito exige nova decisão
registrada neste documento antes da implementação.

---

**Governança.**
- Este arquivo é append-only.
- Alterações a decisões existentes exigem nova entrada `BD-###`
  indicando explicitamente qual decisão está sendo revogada ou
  ajustada.
- Conflitos entre código, prompts e este documento são resolvidos a
  favor deste documento até que uma nova decisão formal seja
  registrada.
