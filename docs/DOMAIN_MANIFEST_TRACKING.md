# Tracking Domain Manifest

- **Versão:** 1.0.0
- **Status:** Approved
- **Escopo:** Localix Platform — Tracking Domain
- **Última revisão:** 2026-07-10

> Este manifesto é a referência permanente do Tracking Domain.
> Nenhuma implementação, refatoração ou nova feature pode violar este documento.
> Alterações exigem nova versão do manifesto + aprovação arquitetural.

---

## 1. Objetivo

Definir oficialmente o Tracking Domain da Localix, seus limites, responsabilidades,
contratos e regras de operação. Serve como contrato imutável entre domínios.

## 2. Missão

O Tracking Domain existe para **observar** a operação.

- Nunca controla a operação.
- Nunca altera estados de outros domínios.
- Transforma eventos em informação operacional consumível por Cliente, Motoboy,
  Restaurante e Operations Center.

## 3. Princípios

1. Tracking **informa**. Nunca decide.
2. Tracking **observa**. Nunca controla.
3. Tracking **calcula**. Nunca altera Orders.
4. Tracking **calcula**. Nunca altera Delivery.
5. Tracking **publica**. Nunca envia notificações diretamente.
6. Tracking mantém **Snapshot**. Timeline mantém **Histórico**. Nunca misturar.

## 4. Responsabilidades

- Driver Location
- ETA (pós `DeliveryAssigned`)
- Geofencing
- Snapshot (estado atual)
- Timeline (histórico append-only)
- Tracking Confidence (HIGH / MEDIUM / LOW)
- Realtime (fanout observacional)
- Customer Tracking
- Restaurant Tracking
- Return Tracking

## 5. Não é responsabilidade

- Orders
- Payments
- Wallet
- Assignment
- Kitchen
- Driver Shift
- Notifications (push, email, WhatsApp, SMS)

## 6. Subdomínios

- Tracking Core
- Driver Location
- ETA Engine
- Realtime
- Tracking Snapshot
- Tracking Timeline
- Restaurant Tracking
- Customer Tracking
- Geofencing

## 7. Estrutura

```text
Tracking Domain
│
├── Tracking Core
├── Tracking Snapshot
├── Tracking Timeline
├── Driver Location
├── ETA Engine
├── Geofencing
├── Customer Tracking
├── Restaurant Tracking
└── Realtime
```

## 8. Dependências

**Consome:**
- Orders
- Delivery
- Driver

**Publica para:**
- Operations
- Customer
- Restaurant

Nunca dependência circular. Nenhum domínio consumidor pode ser chamado de volta
pelo Tracking através de mutação de estado.

## 9. Eventos consumidos

- `DeliveryAssigned`
- `DeliveryCollected`
- `DeliveryDeparted`
- `DeliveryDelivered`
- `DriverReturned`
- `ShiftStarted`
- `ShiftFinished`

## 10. Eventos publicados

- `TrackingUpdated`
- `TrackingSnapshotUpdated`
- `TrackingEtaUpdated`
- `TrackingReturnConfirmed`
- `TrackingDriverArrived`
- `TrackingCustomerViewUpdated`
- `TrackingRestaurantViewUpdated`

## 11. Snapshot

- Representa **apenas o estado atual**.
- Uma única linha por entrega ativa.
- Nunca contém histórico.
- Fonte oficial para leituras "agora".

## 12. Timeline

- Representa **histórico completo** append-only.
- Nunca representa estado atual.
- Base para auditoria, replays e análises.

## 13. ETA

- Antes de `DeliveryAssigned`: ETA pertence ao **Delivery Domain**.
- A partir de `DeliveryAssigned`: ETA pertence exclusivamente ao **Tracking Domain**.
- Nenhum outro domínio recalcula ETA após atribuição.

## 14. Tracking Confidence

Toda informação derivada carrega nível de confiança:

- `HIGH`
- `MEDIUM`
- `LOW`

Aplicável a:
- ETA
- GPS
- Retorno
- Última atualização (freshness)

## 15. Realtime

Canais:
- **Cliente** — `tracking-order-{order_id}`
- **Motoboy** — `tracking-driver-{driver_id}`
- **Restaurante** — `tracking-restaurant-{restaurant_id}`
- **Operations Center** — `tracking-ops-{region}`

Nunca compartilhar dados entre restaurantes.

## 16. Visões

**Cliente**
- Status
- ETA
- Mensagem

**Motoboy**
- Entrega
- Rota
- ETA

**Restaurante**
- Posição operacional
- ETA
- Retorno

**Operations Center**
- Operação completa

## 17. RLS

- **Cliente**: somente o próprio pedido.
- **Driver**: somente a própria entrega.
- **Restaurant**: somente a própria operação.
- **Admin**: acesso completo.

## 18. Observabilidade

- Correlation ID obrigatório em todos os eventos.
- Timeline obrigatória.
- Audit obrigatório.
- Logs estruturados.
- Tracing distribuído ponta-a-ponta.

## 19. Escalabilidade

Projetado sem alteração arquitetural para:

- 100 restaurantes
- 500 motoboys
- 5.000 entregas por dia
- 10.000 clientes simultâneos

## 20. Regras invioláveis

- Nunca realizar `UPDATE` em Orders.
- Nunca realizar `UPDATE` em Delivery.
- Nunca controlar Queue.
- Nunca controlar Wallet.
- Nunca enviar Push.
- Nunca calcular pagamentos.

## 21. Certificação

Checklist obrigatório para qualquer release do domínio:

- [ ] Responsabilidades respeitadas
- [ ] Sem dependência circular
- [ ] Snapshot separado da Timeline
- [ ] ETA oficial definido
- [ ] Tracking Confidence implementado
- [ ] Realtime desacoplado
- [ ] Correlation ID propagado
- [ ] Audit completo
- [ ] RLS completo
- [ ] Escalabilidade validada

## 22. Roadmap

- **RC5.3.a** — Tracking Core
- **RC5.3.b** — Driver Location
- **RC5.3.c** — ETA Engine
- **RC5.3.d** — Customer Tracking
- **RC5.3.e** — Operations Tracking

---

**Fim do manifesto.** Este documento é normativo. Divergências entre código e
manifesto são bugs no código, não no manifesto.
