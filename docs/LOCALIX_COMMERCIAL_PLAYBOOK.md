# LOCALIX COMMERCIAL PLAYBOOK — v1.0 RC2

Manual oficial da equipe comercial. Reflete exclusivamente o modelo
comercial vigente (`docs/LOCALIX_BUSINESS_MODEL_V1.md`). Itens ausentes
estão marcados como **"Não implementado na v1.0"**.

Data: 2026-07-06 · Status: Feature Freeze

---

## Capítulo 1 — Objetivo

- **Finalidade.** Padronizar a abordagem comercial, qualificação e
  conversão de novos parceiros da Localix.
- **Escopo.** Do primeiro contato à ativação do restaurante em
  produção. Pós-implantação limitado ao previsto no Cap. 8.
- **Responsáveis.** Equipe Comercial (Nível 1: prospecção; Nível 2:
  fechamento). Handoff para Onboarding descrito no Cap. 7.
- **Quando utilizar.** Em toda interação com lead, prospect ou parceiro
  em processo de contratação.

---

## Capítulo 2 — Perfil do parceiro ideal

Critérios já formalizados em `LOCALIX_BUSINESS_MODEL_V1.md` §1 e §4:

- **Segmentos atendidos.** Restaurantes, pizzarias, hamburguerias,
  açaiterias, esfiharias, cafeterias e operações de delivery com
  volume operacional consistente.
- **Operação de delivery** ativa.
- **Volume operacional mínimo:** 600 pedidos/mês (média — meta de
  referência durante implantação).
- **Ticket mínimo:** pedido mínimo de R$ 20,00.
- **Aceite do modelo:** taxa única de R$ 0,99 por pedido, sem
  mensalidade e sem comissão sobre faturamento.
- **Independência:** parceiro que quer sair da dependência de
  marketplaces e operar com marca, cliente e dados próprios.

Nenhum outro critério de segmento existe na v1.0.

---

## Capítulo 3 — Critérios de qualificação

Aplicar sempre antes de avançar para cadastro:

- **Documentação.** Dados básicos do estabelecimento (razão social /
  CNPJ ou MEI) para conclusão de KYC/KYB no Stripe.
- **Operação.** Delivery ativo com projeção de volume compatível
  (Cap. 2).
- **Stripe Connect.** Disponibilidade para criar/conectar conta e
  concluir onboarding KYC/KYB assistido.
- **Checkout Localix.** Aceite obrigatório do uso do checkout oficial.
- **Ticket mínimo:** R$ 20,00.
- **Elegibilidade final:** avaliada por aderência ao modelo,
  qualidade operacional e projeção de volume durante a implantação.

---

## Capítulo 4 — Fluxo comercial

Etapas efetivamente executadas hoje:

```text
Lead
   ↓
Contato
   ↓
Apresentação
   ↓
Demonstração
   ↓
Cadastro (/auth — e-mail/senha)
   ↓
Onboarding (LOCALIX_ONBOARDING_PLAYBOOK.md)
   ↓
Homologação (/admin/aprovacoes + checklist)
   ↓
Ativação (publicação em /{slug})
```

CRM comercial dedicado / pipeline automatizado / integração com
ferramenta externa de vendas: **Não implementado na v1.0**.

---

## Capítulo 5 — Apresentação da plataforma

Diferenciais oficiais da v1.0 (`LOCALIX_BUSINESS_MODEL_V1.md` §7),
apresentar exclusivamente estes:

- **Sem mensalidade.**
- **Sem comissão sobre faturamento.**
- **Taxa única: R$ 0,99 por pedido**, transparente no checkout.
- **Cliente é do restaurante** — CRM próprio, sem dependência de
  marketplace.
- **Stripe Connect** com split automático (restaurante recebe direto).
- **Plataforma completa em v1.0:** pedidos, cozinha, entrega,
  financeiro, fidelidade, analytics, cardápio, estoque, promoções.
- **IA integrada** (Lovable AI Gateway) para consultor operacional.
- **Programa de Fidelidade** (pontos, resgate, cashback).
- **Dashboard financeiro** com ledger append-only.
- **Implantação assistida** pela equipe Localix.

Itens do roadmap (`LOCALIX_BUSINESS_MODEL_V1.md` §6 futuras e §9):
Marketplace de Insumos, BI avançado, Wallet do cliente, Publicidade
patrocinada, App nativo — **não apresentar como v1.0**. Se citados,
apresentar como roadmap.

---

## Capítulo 6 — Objeções

Argumentos apenas com base na v1.0:

- *"Já uso iFood/Rappi, por que trocar?"* → Sem comissão sobre
  faturamento, cliente pertence ao restaurante, dados próprios,
  R$ 0,99 fixo previsível.
- *"Tenho pouco volume."* → 600 pedidos/mês é meta de referência
  durante implantação, não critério de bloqueio; homologação avalia
  aderência.
- *"Não sei operar Stripe."* → Implantação assistida gratuita, inclui
  criação/conexão da conta, KYC/KYB e homologação.
- *"E a segurança dos pagamentos?"* → Stripe Connect Express: split
  automático, webhooks assinados, dedupe idempotente, ledger
  append-only.
- *"Posso usar outro gateway?"* → Stripe é o gateway oficial e único
  da plataforma (`LOCALIX_BUSINESS_MODEL_V1.md` §10). Outros gateways
  só via decisão estratégica formal futura.
- *"Preciso de app próprio para meu cliente."* → App nativo é
  roadmap; v1.0 entrega web/PWA em `/{slug}`.

---

## Capítulo 7 — Implantação comercial (handoff)

Passagem da equipe comercial para Onboarding:

1. Registro do lead qualificado com dados básicos.
2. Owner cria conta em `/auth` (e-mail/senha — obrigatório para
   parceiros).
3. Comercial notifica Onboarding para acompanhamento.
4. Onboarding executa o fluxo em `docs/LOCALIX_ONBOARDING_PLAYBOOK.md`.
5. Aprovação final em `/admin/aprovacoes` (quando aplicável).
6. Ativação → parceiro publicado em `/{slug}`.

Ferramenta de handoff automatizada entre times: **Não implementado na
v1.0**.

---

## Capítulo 8 — Pós-implantação

Acompanhamentos previstos hoje:

- **Homologação operacional** conduzida pela equipe Localix durante
  a fase inicial (`LOCALIX_BUSINESS_MODEL_V1.md` §4 e §5).
- **Suporte contínuo** conforme `docs/LOCALIX_SUPPORT_PLAYBOOK.md`.
- **Monitoramento operacional** via `OperationsDashboard` e
  `NotificationCenter` (scope operacional).

Programa formal de Customer Success comercial (health score,
QBR, upsell estruturado): **Não implementado na v1.0**.

---

## Capítulo 9 — Checklist comercial

- [ ] Lead qualificado conforme Cap. 2 e Cap. 3.
- [ ] Aceite do modelo (R$ 0,99 por pedido, checkout Localix, Stripe
      Connect).
- [ ] Documentação para KYC/KYB confirmada.
- [ ] Ticket mínimo R$ 20,00 acordado.
- [ ] Apresentação restrita aos diferenciais v1.0 (Cap. 5).
- [ ] Cadastro executado em `/auth` (e-mail/senha).
- [ ] Handoff formal para Onboarding registrado.
- [ ] Expectativa alinhada sobre roadmap (marketplace de insumos,
      wallet, BI avançado, app nativo — futuros).

---

## Capítulo 10 — FAQ Comercial

- *"Qual a taxa?"* → R$ 0,99 fixa por pedido. Sem mensalidade, sem
  comissão sobre faturamento, sem setup.
- *"Como o restaurante recebe?"* → Direto via Stripe Connect Express;
  a Localix recebe a taxa via split automático
  (`application_fee_amount` + `transfer_data.destination`).
- *"Qual gateway?"* → Stripe Connect (oficial e único).
- *"Cliente é de quem?"* → Do restaurante. CRM próprio integrado.
- *"Tem fidelidade?"* → Sim: pontos, resgate, expiração — pronto na
  v1.0.
- *"Tem IA?"* → Sim, consultor operacional via Lovable AI Gateway.
- *"Tem app?"* → Web/PWA em `/{slug}` na v1.0. App nativo é roadmap.
- *"Tem marketplace de insumos?"* → Roadmap (não v1.0).
- *"Aceita outros meios de pagamento?"* → Stripe (padrão); Mercado
  Pago permanece como integração legada; Dinheiro conforme
  configuração do restaurante.

---

## Capítulo 11 — Glossário

- **Lead / Prospect / Parceiro.** Etapas do funil comercial.
- **Owner.** Dono do restaurante.
- **Slug.** Identificador público em `/{slug}`.
- **Taxa de Serviço Localix.** R$ 0,99 fixa por pedido.
- **Stripe Connect Express.** Conta Stripe individual do restaurante.
- **KYC/KYB.** Verificação de identidade/empresa conduzida pelo
  Stripe.
- **Split.** Repartição automática Stripe → restaurante + Localix.
- **Homologação.** Aprovação operacional final do parceiro.
- **Checkout Localix.** Checkout oficial obrigatório.

---

## Validação

Consistência conferida contra:
- `docs/LOCALIX_BUSINESS_MODEL_V1.md`
- `docs/LOCALIX_OPERATIONS_MANUAL.md`
- `docs/LOCALIX_ONBOARDING_PLAYBOOK.md`
- `docs/LOCALIX_SUPPORT_PLAYBOOK.md`
- `docs/GO_LIVE_AUDIT.md`
- `docs/PRODUCTION_READINESS.md`

## Relatório final

**Estrutura.** 11 capítulos conforme escopo (o escopo previa 11 itens
numerados; ordem preservada).

**Fontes.** Docs listados acima.

**Inconsistências encontradas:** 0.

**Itens marcados como "Não implementado na v1.0":**
- CRM comercial dedicado / pipeline automatizado.
- Ferramenta de handoff automatizada entre Comercial e Onboarding.
- Programa formal de Customer Success comercial (health score, QBR).
- Marketplace de Insumos, Wallet do cliente, BI avançado, App nativo
  (mantidos como roadmap conforme `LOCALIX_BUSINESS_MODEL_V1.md` §9).

**Confirmação.** O documento representa fielmente o processo comercial
atualmente definido para a Localix v1.0 RC2. Nenhum código ou
documentação existente foi alterado.
