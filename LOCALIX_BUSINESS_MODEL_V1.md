# LOCALIX — Business Model V1

> Documento oficial de negócio da plataforma Localix.
> Referência única e definitiva do projeto.
> Versão: 1.0 — Aprovado.

---

## 1. Visão

**Missão.** Tornar cada restaurante independente, rentável e competitivo,
oferecendo uma plataforma completa de delivery, gestão, fidelização e
inteligência de dados — sem mensalidade e sem comissão sobre faturamento.

**Posicionamento.** Localix é a alternativa direta aos marketplaces
tradicionais (iFood, Rappi, Uber Eats). Enquanto eles cobram comissões
altas sobre cada pedido e centralizam o cliente na própria marca, a
Localix devolve o cliente, os dados e a margem para o restaurante.

**Proposta de valor.**
- Sem mensalidade.
- Sem comissão sobre faturamento.
- Taxa única, fixa e transparente por pedido.
- Cliente é do restaurante — não do marketplace.
- Plataforma completa: pedidos, cozinha, entrega, financeiro,
  fidelidade, CRM, marketing, IA e analytics em um único lugar.
- Implantação assistida e acompanhada pela equipe Localix.

**Público-alvo.**
- Restaurantes, pizzarias, hamburguerias, açaiterias, esfiharias,
  cafeterias e operações de delivery com volume operacional consistente.
- Perfil mínimo: 600 pedidos/mês (média operacional).
- Estabelecimentos que querem sair da dependência de marketplaces e
  operar com marca, cliente e dados próprios.

---

## 2. Modelo Comercial

**A plataforma NÃO cobra:**
- Mensalidade.
- Comissão sobre faturamento.
- Taxa de setup.
- Taxa de manutenção.

**A plataforma cobra:**
- **Taxa de Serviço Localix — R$ 0,99 fixa por pedido.**

**Transparência.**
A Taxa de Serviço Localix aparece de forma explícita no checkout,
identificada como linha própria no resumo do pedido, para o cliente
final e para o estabelecimento.

**Racional.**
Modelo previsível: quanto mais o restaurante vende, mais ele ganha —
o custo por pedido não sobe proporcionalmente à receita.

---

## 3. Gateway Oficial

**Gateway único: Stripe Connect.**

Todo estabelecimento parceiro deverá:
- Criar ou conectar uma conta Stripe.
- Concluir o onboarding KYC/KYB da Stripe.
- Autorizar a integração Stripe Connect com a Localix.

**Suporte.**
A equipe Localix auxiliará gratuitamente durante toda a implantação —
criação da conta, envio de documentação, verificação, testes e
homologação.

**Racional.**
- Padrão global, auditável e compliance-first.
- Split de pagamento nativo (restaurante recebe direto; Localix
  recebe a taxa de serviço).
- Reduz risco financeiro e regulatório para todos os lados.

---

## 4. Elegibilidade

Para utilizar a plataforma, o estabelecimento deverá atender:

- **Volume mínimo:** 600 pedidos por mês (média operacional).
- **Ticket mínimo:** pedido mínimo de R$ 20,00.
- **Checkout oficial:** utilização obrigatória do checkout Localix.
- **Pagamentos:** conta Stripe Connect ativa e conectada.

**Observação — Período de implantação.**
O período inicial de implantação poderá ser acompanhado pela equipe
Localix para validação operacional antes da homologação definitiva.
Durante essa fase, o volume mínimo é uma meta de referência, não um
critério de bloqueio — a homologação considera aderência ao modelo,
qualidade operacional e projeção de volume.

---

## 5. Processo de Implantação

Fluxo oficial, sequencial:

```text
Cadastro
   ↓
Validação
   ↓
Onboarding Stripe
   ↓
Configuração
   ↓
Treinamento
   ↓
Publicação
   ↓
Homologação
```

**Cadastro.** Restaurante cria conta e informa dados básicos do
estabelecimento.

**Validação.** Equipe Localix confere dados, perfil operacional e
elegibilidade.

**Onboarding Stripe.** Criação/conexão da conta Stripe Connect e
conclusão de KYC/KYB, com suporte da equipe.

**Configuração.** Cardápio, categorias, horários, áreas de entrega,
taxas, integrações de impressão, fidelidade e cupons.

**Treinamento.** Capacitação da equipe do restaurante em pedidos,
cozinha, entrega, financeiro e atendimento.

**Publicação.** Ativação da loja e liberação do link público
(`localix.app/{slug}`).

**Homologação.** Avaliação operacional final e reconhecimento como
parceiro homologado Localix.

---

## 6. Fontes de Receita

**Principal (V1).**
- Taxa de Serviço Localix — R$ 0,99 por pedido.

**Futuras (roadmap comercial).**
- Marketplace de Insumos (compra centralizada para restaurantes).
- Serviços Premium (BI avançado, IA aplicada, consultoria).
- Publicidade patrocinada dentro da rede Localix.
- Parcerias (bandeiras, adquirentes, distribuidores, fintechs).
- Integrações certificadas (ERPs, PDVs, contabilidade, logística).
- Novos módulos verticais (produção, custos, compras avançadas).

Nenhuma dessas fontes futuras substitui ou altera o modelo principal
sem decisão estratégica formal.

---

## 7. Diferenciais Competitivos

- **IA integrada** — assistente operacional, financeiro e de marketing.
- **Programa de Fidelidade** — pontos, níveis, cupons, cashback,
  produto grátis, frete grátis, carteira digital do cliente.
- **Marketplace** — futura camada de insumos e serviços.
- **CRM próprio** — cliente pertence ao restaurante.
- **Analytics** — indicadores operacionais e financeiros em tempo real.
- **Dashboard Financeiro** — receitas, custos, DRE, fluxo de caixa.
- **Marketing** — cupons, campanhas, segmentação, engajamento.
- **Delivery** — orquestração de pedidos, cozinha e entrega.
- **Gestão** — cardápio, estoque, receitas, produção, custos, compras.
- **Sem mensalidade.**
- **Sem comissão sobre faturamento.**
- **Implantação assistida** — equipe Localix acompanha o parceiro.

---

## 8. Princípios

Toda nova funcionalidade deverá responder positivamente a pelo menos
uma das perguntas abaixo:

1. Ela **aumenta vendas** do restaurante?
2. Ela **reduz custos** do restaurante?
3. Ela **melhora a operação** do restaurante?
4. Ela **aumenta fidelização** do cliente final?
5. Ela **melhora a experiência** do cliente final?
6. Ela **fortalece o modelo Localix** (marca, retenção, rede)?

Se a resposta for "não" para todas, a funcionalidade deverá ser
reavaliada, adiada ou descartada.

---

## 9. Roadmap

Sequência oficial de evolução da plataforma:

1. **Billing Domain** — cobrança da Taxa de Serviço, faturamento,
   conciliação.
2. **Stripe Connect** — onboarding, split, payouts, webhooks.
3. **Wallet** — carteira digital do cliente (pontos, cupons,
   cashback, benefícios).
4. **Marketplace** — insumos e serviços entre restaurantes e
   fornecedores.
5. **BI** — analytics avançado, indicadores executivos, benchmarks.
6. **IA** — assistentes operacionais, financeiros e de marketing
   aplicados ao dia a dia.
7. **Aplicativo** — apps nativos para cliente final e operação.

---

## 10. Restrições

- **Não** criar novos planos de assinatura.
- **Não** criar cobrança de mensalidade.
- **Não** criar comissão sobre faturamento.
- **Não** adicionar novos gateways como padrão.
- **Stripe Connect** é o gateway oficial e único da plataforma.
- Outros gateways poderão ser considerados **apenas** no futuro,
  mediante decisão estratégica formal e documentada.

---

**Este documento é a referência oficial do projeto Localix.**
Qualquer decisão que conflite com este documento deverá,
obrigatoriamente, ser registrada em `BUSINESS_DECISIONS.md` e aprovada
formalmente antes de ser implementada.
