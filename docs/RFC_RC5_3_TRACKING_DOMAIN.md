# RFC RC5.3 — Tracking Domain

**Status:** Proposta (documentação oficial)
**Modo:** Documentação — não implementar, não alterar código, não alterar banco.
**Autor:** Equipe Localix
**Data:** 2026-07-10
**Escopo:** RC5.3
**Depende de:** RC5.2.a (Delivery Queue), RC5.2.a.2 (Delivery Assignment), RC5.2.e (Driver Wallet), RC5.2.f (Driver Shift)

---

## 1. Objetivos

O **Tracking Domain** é responsável por acompanhar, em tempo real, toda a jornada operacional de uma entrega da Localix.

Este domínio **não é um domínio de GPS**. GPS é apenas uma das fontes que alimentam o Tracking. O objetivo real é **representar o estado operacional da entrega** para os quatro atores envolvidos:

- Cliente
- Restaurante
- Motoboy
- Central de Operações

### 1.1 Missão

Responder continuamente:

1. Onde está o pedido?
2. Quem está levando?
3. Quanto tempo falta?
4. O motoboy já retornou?
5. Qual a previsão da fila?

### 1.2 Princípios

- **Estado operacional > coordenadas cruas.** A UI consome estados semânticos ("Em rota", "Próximo ao cliente"), não latitude/longitude.
- **Fonte única da verdade** por entrega: `tracking_snapshot` derivado dos eventos do Delivery e do Driver.
- **Realtime primeiro:** todo consumidor lê o snapshot via canal Supabase Realtime dedicado.
- **Isolamento de domínio:** Tracking **consome** eventos, nunca muta Orders, Payments ou Delivery Assignment.

---

## 2. Responsabilidades

### 2.1 Dentro do domínio

- Localização do motoboy (última posição + histórico curto)
- ETA (inicial, atualizado, retorno)
- Geofencing (raio do restaurante e do cliente)
- Tracking do cliente (tela pública/autenticada do pedido)
- Tracking do restaurante (painel operacional)
- Tracking do retorno (motoboy voltando ao restaurante)
- Sincronização realtime (canais Supabase)
- Notificações operacionais derivadas de tracking

### 2.2 Fora do domínio

- Pedidos (Orders Domain)
- Pagamentos (Payment Domain)
- Assignment / fila de motoboys (Delivery Assignment)
- Wallet / financeiro do motoboy (Driver Wallet)

---

## 3. Limites do Domínio

```text
        ┌───────────────┐  ┌───────────────────┐  ┌────────────────┐
        │ Orders Domain │  │ Delivery Domain   │  │ Driver Domain  │
        └──────┬────────┘  └──────┬────────────┘  └───────┬────────┘
               │ events           │ events                │ location
               └──────────┬───────┴────────┬──────────────┘
                          ▼                ▼
                     ┌──────────────────────────┐
                     │     Tracking Domain      │
                     │  (snapshot + realtime)   │
                     └────────────┬─────────────┘
                                  │ realtime + notifications
        ┌──────────┬──────────────┼──────────────┬───────────────┐
        ▼          ▼              ▼              ▼               ▼
     Cliente   Restaurante    Motoboy     Operations         Notificações
```

Tracking **recebe** de: Driver Domain, Delivery Domain, Orders Domain.
Tracking **publica** para: Cliente, Restaurante, Central de Operações.

---

## 4. Subdomínios

| Subdomínio             | Responsabilidade                                                       |
| ---------------------- | ---------------------------------------------------------------------- |
| Driver Location        | Ingestão de posição do motoboy, deduplicação, buffer de histórico     |
| ETA Engine             | Cálculo de ETA inicial, atualizado e de retorno                        |
| Geofencing             | Detecção de entrada/saída de raio do restaurante e do cliente          |
| Customer Tracking      | Estado consumível pelo cliente final                                   |
| Restaurant Tracking    | Estado consumível pelo painel do restaurante                           |
| Return Tracking        | Rastreio do retorno do motoboy ao restaurante                          |
| Realtime               | Canais Supabase por ator                                               |
| Notifications          | Emissão de eventos de notificação (push / in-app)                      |

---

## 5. Modelo Conceitual

```text
Pedido
  │
  ▼
Assignment ── Driver
  │
  ▼
Tracking ── ETA ── Geofencing
  │
  ├──▶ Cliente
  ├──▶ Restaurante
  └──▶ Operations Center
```

Uma entrega tem exatamente **um Tracking Snapshot ativo** durante o ciclo de vida do assignment. O snapshot é reciclado quando o assignment fecha (entregue/cancelado) e a fase de retorno inicia.

---

## 6. Estados Operacionais

Estados semânticos expostos ao consumidor (independentes do state machine de Delivery Assignment):

| Estado                  | Origem                                    |
| ----------------------- | ----------------------------------------- |
| `AGUARDANDO_COLETA`     | assignment `ATRIBUIDO`                    |
| `COLETANDO`             | assignment `COLETANDO` + geofence restaurante |
| `EM_ROTA`               | assignment `EM_ROTA`                      |
| `PROXIMO_AO_DESTINO`    | geofence cliente ativado                  |
| `ENTREGUE`              | assignment `ENTREGUE`                     |
| `RETORNANDO`            | shift event `RETURN_STARTED`              |
| `NO_RESTAURANTE`        | geofence restaurante + shift `AGUARDANDO` |

---

## 7. Eventos

### 7.1 Consumidos

Do Delivery Assignment / Driver Shift EventBus:

- `DeliveryAssigned`
- `DeliveryCollected`
- `DeliveryDeparted`
- `DeliveryDelivered`
- `DriverReturned`
- `ShiftStarted`
- `ShiftFinished`

### 7.2 Publicados

Do Tracking EventBus:

- `TrackingUpdated` — snapshot mudou (qualquer campo)
- `EtaChanged` — apenas ETA foi recalculado
- `DriverArrived` — geofence do cliente disparou
- `DriverReturned` — geofence do restaurante disparou após entrega
- `CustomerNotified` — notificação disparada para cliente
- `RestaurantUpdated` — snapshot relevante para o painel do restaurante

---

## 8. Geofencing

Conceitos:

- **Raio do Restaurante:** raio configurável (default 80 m) em torno da coordenada do restaurante.
- **Raio do Cliente:** raio configurável (default 120 m) em torno do endereço de entrega.
- **Chegada ao Restaurante:** primeira entrada no raio do restaurante após `DeliveryAssigned`.
- **Chegada ao Cliente:** primeira entrada no raio do cliente após `DeliveryDeparted`.
- **Saída do Restaurante:** primeira saída do raio após `DeliveryCollected`.

Geofencing é **derivado**: calculado on-the-fly a partir da última posição ingerida, sem persistir polígonos.

---

## 9. ETA Engine

- **ETA inicial:** calculado no momento do `DeliveryAssigned`, baseado em distância haversine e velocidade média histórica do restaurante.
- **ETA atualizado:** recalculado a cada nova ingestão de localização (throttled a 30s).
- **ETA de retorno:** calculado após `DeliveryDelivered`, estima chegada de volta ao restaurante.
- **Tempo médio:** derivado do histórico de entregas concluídas por restaurante (janela móvel 30 dias).
- **Margem de erro:** apresentada como faixa (`± minutos`) na UI do cliente para reduzir frustração.

---

## 10. Realtime

Canais Supabase Realtime propostos:

| Ator            | Canal                                        | Filtro                       |
| --------------- | -------------------------------------------- | ---------------------------- |
| Cliente         | `tracking-order-{order_id}`                  | `order_id`                   |
| Motoboy         | `tracking-driver-{driver_id}`                | `driver_id`                  |
| Restaurante     | `tracking-restaurant-{restaurant_id}`        | `restaurant_id`              |
| Operations      | `tracking-ops`                               | global (RBAC admin)          |

Payload padrão: `{ snapshot, eta, state, driver_position, updated_at }`.

---

## 11. Experiências por Ator

### 11.1 Cliente

Tela responde apenas:

- Status atual (estado semântico)
- Tempo restante (ETA + faixa de erro)
- Motoboy (nome, foto, veículo)
- Pedido (número, itens resumidos)

Sem excesso de informações. Sem histórico bruto de coordenadas.

### 11.2 Restaurante

Painel responde:

- Quem está em entrega
- Quem está retornando
- ETA por entrega
- Fila prevista (integração com Queue Domain)

### 11.3 Central de Operações

- Pedidos em rota (mapa consolidado)
- Motoboys retornando
- ETA médio da operação
- Alertas (atraso, sem localização, geofence não disparado)

---

## 12. Notificações

### 12.1 Cliente

- "Seu pedido saiu para entrega."
- "O motoboy está próximo."
- "Pedido entregue."

### 12.2 Restaurante

- "Motoboy saiu com o pedido #X."
- "Motoboy retornando."
- "Motoboy chegou."

Notificações são publicadas via `CustomerNotified` / `RestaurantUpdated` e consumidas pela camada de Notifications já existente (`src/lib/notifications`).

---

## 13. RLS

| Ator         | Acesso                                                   |
| ------------ | -------------------------------------------------------- |
| Cliente      | Somente seus próprios pedidos (via `order_id` + owner)   |
| Motoboy      | Somente sua entrega ativa (via `driver_id = auth.uid()`) |
| Restaurante  | Somente sua operação (via `restaurant_id` + role)        |
| Admin        | Completo                                                 |

Toda tabela pública do domínio Tracking deverá seguir o padrão obrigatório da plataforma: `CREATE TABLE` → `GRANT` → `ENABLE RLS` → `CREATE POLICY`.

---

## 14. Observabilidade

- **Correlation ID:** propagado do Delivery Assignment (`correlation_id`) para todo evento de tracking.
- **Audit:** cada mudança de snapshot gera linha em `tracking_timeline` (evento, from_state, to_state, actor, metadata).
- **Timeline:** consumida por UI do cliente/restaurante e pela Central de Operações.
- **Logs:** eventos publicados replicados para `observability` domain.
- **Realtime:** métrica de latência ingestão → publicação exposta.

---

## 15. Dependências

- Orders Domain — origem do pedido e endereço.
- Delivery Domain — assignment, state machine, event bus.
- Driver Domain — presença, shift, wallet.
- Operations Center — consumidor consolidado.
- Notifications — canal de saída para push/in-app.

---

## 16. Fluxos Principais

### 16.1 Fluxo feliz

```text
DeliveryAssigned
  → cria tracking_snapshot (AGUARDANDO_COLETA, ETA inicial)
  → publica TrackingUpdated

DriverLocation ingerida
  → recalcula ETA (throttle 30s)
  → publica EtaChanged

Geofence restaurante (entrada)
  → estado COLETANDO
  → publica TrackingUpdated + RestaurantUpdated

DeliveryCollected + Geofence restaurante (saída)
  → estado EM_ROTA
  → publica TrackingUpdated

Geofence cliente (entrada)
  → estado PROXIMO_AO_DESTINO
  → publica DriverArrived + CustomerNotified

DeliveryDelivered
  → estado ENTREGUE
  → publica TrackingUpdated + CustomerNotified

Motoboy inicia retorno
  → estado RETORNANDO, ETA retorno calculado
  → publica TrackingUpdated

Geofence restaurante (entrada)
  → estado NO_RESTAURANTE
  → publica DriverReturned + RestaurantUpdated
```

### 16.2 Fluxos de exceção

- Sem localização por > 90s → alerta na Central de Operações.
- Geofence do cliente não dispara em 3× ETA → alerta + fallback para `PROXIMO_AO_DESTINO` manual.
- Motoboy encerra shift antes de retornar → tracking fecha com `RETORNO_NAO_CONFIRMADO`.

---

## 17. Arquitetura Proposta (referência)

```text
src/lib/tracking/
  ├── TrackingStateMachine.ts       # estados semânticos
  ├── TrackingSnapshotService.ts    # projeção do snapshot
  ├── TrackingEventBus.ts           # eventos publicados
  ├── GeofenceEngine.ts             # cálculo de raios
  ├── ETAEngine.ts                  # reuso do ETAEngine existente
  ├── DriverLocationIngest.ts       # ingestão + throttle
  ├── TrackingTimeline.ts           # audit
  ├── providers/                    # fontes de localização
  └── index.ts
src/lib/tracking.functions.ts       # server functions (RPC)
supabase/migrations/                # tracking_snapshots + tracking_timeline
```

Server functions consumidas pelas UIs de cliente, restaurante e operações são `createServerFn` — nunca consultam Supabase direto do componente.

---

## 18. Fora do escopo — RC5.3

- Roteirização inteligente
- Agrupamento automático de entregas
- IA operacional
- Otimização de rotas

Adiados para RC5.4+.

---

## 19. Roadmap Futuro

| Release | Escopo                                             |
| ------- | -------------------------------------------------- |
| RC5.4   | Roteirização inteligente e agrupamento             |
| RC5.5   | IA operacional (previsão de atrasos, sugestões)    |
| RC5.6   | Otimização multi-motoboy e reatribuição automática |

---

## 20. Checklist para Auditoria

- [ ] Tracking Domain isolado — não muta Orders/Payments/Assignment.
- [ ] Todos os estados operacionais mapeados a partir de eventos existentes.
- [ ] Cada evento consumido tem consumer documentado.
- [ ] Cada evento publicado tem consumidor previsto (UI ou Notifications).
- [ ] Canais Realtime definidos por ator, com filtro adequado.
- [ ] RLS documentado para cada ator.
- [ ] Geofencing definido como derivado, sem persistência de polígonos.
- [ ] ETA Engine reutiliza `src/lib/delivery/ETAEngine.ts`.
- [ ] Correlation ID propagado de Delivery para Tracking.
- [ ] Timeline auditável por entrega.
- [ ] UI do cliente com informação mínima.
- [ ] Painel do restaurante consome snapshot pronto (sem cálculo cliente).
- [ ] Central de Operações consome canal global com RBAC admin.
- [ ] Nenhum item fora de escopo (RC5.4+) foi incluído.
