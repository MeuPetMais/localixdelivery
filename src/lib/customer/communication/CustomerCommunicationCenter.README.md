# Customer Communication Center

Módulo do Customer Domain responsável por **gerenciar** (não enviar) comunicações com clientes.

## Escopo
- Preferências por canal (email, push, SMS, WhatsApp, in-app, marketing).
- Consentimentos LGPD (reutiliza `CustomerService.recordConsent` / `customer_consents`).
- Histórico de comunicações (`customer_communication_history`).
- Audiência e preview de campanhas (reutiliza `customer_segments`).
- Eventos para NotificationCenter e outras integrações.

## Não faz
- Não envia mensagens. O envio é delegado ao `NotificationCenter`.
- Não duplica preferências: `customer_preferences` continua servindo o app do cliente; este módulo agrega opt-in granular para o motor de campanhas.

## Facade
`CustomerCommunicationService` expõe:
- `preferences` → `CommunicationPreferenceService`
- `history` → `CommunicationHistoryService`
- `consent` → `ConsentService`
- `audience` → `CampaignAudienceService`
- `preview` → `CampaignPreview`
- `optIn(customerId, channel)` / `optOut(...)`
- `canReach(customerId, channel, { marketing })`

## Eventos (`CommunicationEventBus`)
- `CommunicationPreferenceChanged`
- `CustomerOptedIn`
- `CustomerOptedOut`
- `CampaignAudienceGenerated`
- `CommunicationLogged`

Consumidores previstos:
- `NotificationCenter` — respeita opt-out antes de enfileirar.
- `Loyalty Engine` — dispara campanhas via `CampaignAudienceService`.
- `Customer Intelligence` — fornece segmentos.
- `BusinessRulesEngine` — valida consentimento em regras de marketing.

## Tabelas
- `customer_communication_preferences` (1 linha por cliente, RLS `auth.uid()=customer_id`).
- `customer_communication_history` (append-only, RLS por cliente).

## Segurança
- RLS habilitado em ambas as tabelas.
- Comunicações de marketing só devem ser enfileiradas se `canReach(..., { marketing: true })` retornar `true`.
- Consentimentos LGPD ficam em `customer_consents` (fonte de verdade legal).

## Pendências (Prompt 13.6.5)
- Widget no Restaurant Dashboard (Opt-ins/outs, histórico, campanhas).
- Assinatura efetiva dos eventos no `NotificationCenter`.
- Persistência de campanhas (tabela `campaigns` + execução assíncrona).
- Métricas de leitura/entrega vindas dos provedores.
