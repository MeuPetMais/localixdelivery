# RFC RC5.3 — Tracking Domain (Revisão R1)

**Status:** Proposta revisada — pronta para certificação
**Modo:** Documentação — não implementar, não alterar código, não alterar banco.
**Autor:** Equipe Localix
**Data:** 2026-07-10
**Revisão:** R1 (incorpora auditoria RC5.3)
**Escopo:** RC5.3
**Depende de:** RC5.2.a (Delivery Queue), RC5.2.a.2 (Delivery Assignment), RC5.2.e (Driver Wallet), RC5.2.f (Driver Shift)

---

## 0. Mapa de Capítulos

| # | Capítulo | Novo em R1 |
| - | -------- | ---------- |
| 1 | Objetivos | — |
| 2 | Princípios Arquiteturais | ✅ novo |
| 3 | Responsabilidades | ajustado |
| 4 | Limites do Domínio | — |
| 5 | Subdomínios | — |
| 6 | Modelo Conceitual | — |
| 7 | Tracking Snapshot (oficial) | ✅ novo |
| 8 | Tracking Timeline (oficial) | ✅ novo |
| 9 | Estados Operacionais | ajustado |
| 10 | Eventos (renomeados) | ajustado |
| 11 | GPS Ingest | ✅ novo |
| 12 | Anti GPS Spoofing | ✅ novo |
| 13 | Geofencing | ajustado |
| 14 | ETA Engine (ownership) | ajustado |
| 15 | Tracking Confidence | ✅ novo |
| 16 | Realtime | ajustado |
| 17 | Payload por Ator (matriz) | ✅ novo |
| 18 | Notifications (delegação) | ajustado |
| 19 | Rate Limits | ✅ novo |
| 20 | Índices Recomendados | ✅ novo |
| 21 | Escalabilidade | ✅ novo |
| 22 | SLOs | ✅ novo |
| 23 | RLS | ajustado |
| 24 | Observabilidade | — |
| 25 | Migração do TrackingService atual | ✅ novo |
| 26 | Arquitetura Proposta | — |
| 27 | Fluxos | — |
| 28 | Fora do escopo — RC5.3 | — |
| 29 | Roadmap Futuro | — |
| 30 | ADR-017 (referência) | ✅ novo |
| 31 | Checklist Final de Certificação | ✅ novo |

---

## 1. Objetivos

Acompanhar em tempo real toda a jornada operacional de uma entrega da Localix.

**Não é** um domínio de GPS. GPS é apenas uma fonte de entrada. O objetivo é representar o **estado operacional** para os quatro atores: Cliente, Restaurante, Motoboy, Central de Operações.

Responder continuamente:

1. Onde está o pedido?
2. Quem está levando?
3. Quanto tempo falta?
4. O motoboy já retornou?
5. Qual a previsão da fila?

---

## 2. Princípios Arquiteturais

> **Princípio fundamental:** O Tracking Domain **nunca** altera estados de Orders, Delivery, Driver ou Payments.

Seu papel é exclusivamente:

- **Observar** eventos publicados por outros domínios.
- **Calcular** informações derivadas (estado semântico, ETA, geofence, confiança).
- **Publicar** informações consumíveis por UI e por Notifications.

**Nunca** controla, orquestra ou muta outros domínios. Não emite comandos. Não escreve em `orders`, `delivery_orders`, `delivery_assignments`, `drivers`, `driver_shifts`, `payments`, `wallets`.

Corolários:

- Se um cálculo do Tracking demanda mudança de estado em outro domínio, o Tracking emite um evento; o domínio proprietário decide.
- Se um dado precisa ser corrigido na origem, a correção acontece na origem, não no Tracking.
- Tracking é reprojetável a qualquer momento a partir do log de eventos consumidos — não é fonte da verdade de nada além do próprio snapshot/timeline.

---

## 3. Responsabilidades

### 3.1 Dentro do domínio

- Ingestão de localização do motoboy (GPS Ingest)
- Detecção de anomalias (Anti-Spoofing)
- Snapshot operacional por entrega
- Timeline auditável por entrega
- ETA pós-assignment
- Geofencing derivado
- Tracking do cliente, restaurante, retorno
- Canais Realtime dedicados
- Publicação de eventos de tracking

### 3.2 Fora do domínio

- Pedidos (Orders)
- Pagamentos (Payment)
- Assignment / fila (Delivery Assignment)
- Wallet / financeiro (Driver Wallet)
- **Envio de notificações** (Push/SMS/WhatsApp/Email) — pertence ao Notification Domain
- **ETA antes do assignment** — pertence ao Delivery Domain

---

## 4. Limites do Domínio

```text
        ┌───────────────┐  ┌───────────────────┐  ┌────────────────┐
        │ Orders Domain │  │ Delivery Domain   │  │ Driver Domain  │
        └──────┬────────┘  └──────┬────────────┘  └───────┬────────┘
               │ events           │ events                │ location
               └──────────┬───────┴────────┬──────────────┘
                          ▼                ▼
                     ┌──────────────────────────┐
                     │     Tracking Domain      │
                     │  (snapshot + timeline)   │
                     └────────────┬─────────────┘
                                  │ realtime + eventos
        ┌──────────┬──────────────┼──────────────┬───────────────┐
        ▼          ▼              ▼              ▼               ▼
     Cliente   Restaurante    Motoboy     Operations       Notification
                                                             Domain
```

Fluxo é sempre unidirecional. Não há callback de Tracking → Orders/Delivery/Driver.

---

## 5. Subdomínios

| Subdomínio             | Responsabilidade                                                       |
| ---------------------- | ---------------------------------------------------------------------- |
| GPS Ingest             | Recepção, throttle, dedup, cache offline, spoofing check              |
| Snapshot Projection    | Projeta estado atual da entrega                                        |
| Timeline               | Log auditável de transições                                            |
| ETA Engine             | Cálculo pós-assignment (reusa `src/lib/delivery/ETAEngine.ts`)         |
| Geofencing             | Raios com histerese e dwell time                                       |
| Confidence Engine      | Classifica confiança de cada informação derivada                       |
| Realtime               | Canais Supabase Realtime por ator                                      |
| Public API             | Server functions consumidas pelas UIs                                  |

---

## 6. Modelo Conceitual

```text
Pedido
  │
  ▼
Assignment ── Driver
  │
  ▼
Tracking Snapshot ── ETA ── Geofence ── Confidence
  │
  ├──▶ Cliente        (payload filtrado)
  ├──▶ Restaurante    (payload operacional)
  ├──▶ Motoboy        (payload próprio)
  └──▶ Operations     (payload consolidado)

Tracking Timeline  (append-only, imutável)
```

---

## 7. Tracking Snapshot (conceito oficial)

Snapshot é o **estado atual** de uma entrega. **Nunca histórico.**

Uma entrega tem exatamente **um** snapshot ativo entre `DeliveryAssigned` e o fechamento do assignment (entrega ou cancelamento) + fase de retorno.

Campos oficiais:

| Campo               | Descrição                                                        |
| ------------------- | ---------------------------------------------------------------- |
| `assignment_id`     | Referência ao assignment ativo                                   |
| `order_id`          | Referência ao pedido                                             |
| `driver_id`         | Motoboy atribuído                                                |
| `restaurant_id`     | Restaurante origem                                               |
| `state`             | Estado semântico (ver §9)                                        |
| `eta_minutes`       | ETA atual (pós-assignment)                                       |
| `eta_confidence`    | Alta / Média / Baixa (ver §15)                                   |
| `last_position`     | Última coordenada válida (ver §11)                               |
| `last_updated_at`   | Timestamp da última atualização                                  |
| `correlation_id`    | Propagado do Delivery Assignment                                 |

Snapshot **não** contém histórico de posições, lista de eventos, timeline, wallet, ranking, ganhos.

---

## 8. Tracking Timeline (conceito oficial)

Timeline é o **histórico auditável** de transições. **Nunca estado atual.**

Append-only. Imutável. Uma linha por transição relevante.

Campos oficiais:

| Campo             | Descrição                                                  |
| ----------------- | ---------------------------------------------------------- |
| `id`              | PK                                                         |
| `snapshot_id`     | Snapshot ao qual pertence                                  |
| `event`           | Nome canônico do evento                                    |
| `from_state`      | Estado semântico anterior                                  |
| `to_state`        | Estado semântico novo                                      |
| `actor`           | driver / restaurant / system                               |
| `metadata`        | JSON auxiliar (ex.: confiança, distância)                  |
| `correlation_id`  | Herdado do snapshot                                        |
| `created_at`      | Timestamp                                                  |

Separação estrita: consulta de UI sempre lê o snapshot; auditoria sempre lê a timeline. Nada mistura os dois.

---

## 9. Estados Operacionais

| Estado                        | Origem                                             |
| ----------------------------- | -------------------------------------------------- |
| `AGUARDANDO_COLETA`           | assignment `ATRIBUIDO`                             |
| `COLETANDO`                   | assignment `COLETANDO` + geofence restaurante      |
| `EM_ROTA`                     | assignment `EM_ROTA`                               |
| `PROXIMO_AO_DESTINO`          | geofence cliente + dwell time                      |
| `ENTREGUE`                    | assignment `ENTREGUE`                              |
| `RETORNANDO`                  | shift event `RETURN_STARTED`                       |
| `NO_RESTAURANTE`              | geofence restaurante + shift `AGUARDANDO`          |
| `RETORNO_NAO_CONFIRMADO`      | shift finalizado sem geofence restaurante          |
| `SEM_SINAL`                   | heartbeat ausente > threshold (ver §11)            |

---

## 10. Eventos

### 10.1 Consumidos (de outros domínios)

- `DeliveryAssigned`
- `DeliveryCollected`
- `DeliveryDeparted`
- `DeliveryDelivered`
- `DriverReturned` (Driver Domain)
- `ShiftStarted`
- `ShiftFinished`
- `DriverLocationReported` (GPS Ingest interno usa o mesmo canal)

### 10.2 Publicados (Tracking EventBus)

Nomes distintos dos consumidos, para eliminar risco de loops:

- `TrackingSnapshotUpdated` — qualquer campo do snapshot mudou
- `TrackingEtaChanged` — apenas ETA
- `TrackingCustomerArrived` — geofence do cliente (substitui antigo `DriverArrived`)
- `TrackingReturnConfirmed` — geofence do restaurante após entrega (substitui republicar `DriverReturned`)
- `TrackingAnomalyDetected` — spoofing / heartbeat perdido / geofence inconsistente

**Regra:** nenhum evento publicado pelo Tracking pode ter o mesmo nome de um evento consumido.

---

## 11. GPS Ingest

Capítulo dedicado. Fluxo canônico:

```text
GPS bruto → Tracking Ingest → (spoofing check + throttle) → Snapshot → Realtime
```

### 11.1 Heartbeat adaptativo

| Contexto                              | Intervalo recomendado |
| ------------------------------------- | --------------------- |
| Foreground + em rota                  | 5 s                   |
| Foreground + aguardando               | 15 s                  |
| Background                            | 30 s                  |
| Modo economia de bateria              | 60 s                  |
| Sem entrega ativa                     | 120 s ou desligado    |

### 11.2 Cache offline

- Buffer local circular (máx. 200 pontos).
- Envio em lote ao restabelecer conexão.
- Servidor aceita batch com timestamps originais; reordena por `captured_at`.

### 11.3 Reconexão e perda de sinal

- `SEM_SINAL` disparado após 90 s sem heartbeat.
- Reconexão restaura o snapshot antes de despublicar `SEM_SINAL`.
- Timeout de sessão de tracking = 5 min sem heartbeat → alerta na Central.

### 11.4 Sincronização

- `captured_at` é a fonte da verdade temporal; `received_at` apenas para observabilidade.
- Pontos com `captured_at` no futuro são descartados.
- Pontos com `captured_at` mais antigos que o último aceito em > 10 min são descartados.

---

## 12. Anti GPS Spoofing

Objetivo: **detectar e sinalizar**. Nunca bloquear automaticamente.

Regras de detecção:

| Regra                                     | Descrição                                                       |
| ----------------------------------------- | --------------------------------------------------------------- |
| Velocidade máxima plausível               | > 120 km/h em contexto urbano → suspeito                        |
| Teletransporte                            | Salto > 500 m em < 5 s                                          |
| Mudanças impossíveis                      | Heading invertido 180° com velocidade > 40 km/h                 |
| Distância incompatível                    | Distância percorrida ≠ integral de velocidades reportadas       |
| Turno longe do restaurante                | `SHIFT_STARTED` a > 5 km do restaurante ativo                   |
| Precisão degradada persistente            | `accuracy` > 100 m por > 10 pontos consecutivos                 |

Saída: cada snapshot recebe um **spoof_score** (0–100). Score alto:

- **Nunca** interrompe a entrega.
- Publica `TrackingAnomalyDetected` para Operations.
- Reduz `eta_confidence` para "Baixa".
- Marca a linha de timeline com `metadata.spoof_score`.

---

## 13. Geofencing

- **Raio restaurante:** default 80 m, configurável por unidade.
- **Raio cliente:** default 120 m, configurável.
- **Dwell time:** deve permanecer no raio ≥ 15 s antes de disparar transição.
- **Histerese:** para sair, precisa estar ≥ raio + 30 m por ≥ 20 s. Evita flapping.
- **Cooldown:** mesmo geofence não redispara antes de 60 s.
- **Raios adaptativos:** se `accuracy` GPS > raio configurado, raio efetivo = `max(raio, accuracy × 1.5)`.
- **Derivado:** nada é persistido como polígono.

---

## 14. ETA — Ownership Oficial

Declaração oficial:

- **Antes do assignment:** o **Delivery Domain** é a única fonte oficial do ETA (usado em cotação, checkout, fila).
- **A partir de `DeliveryAssigned`:** o **Tracking Domain** torna-se a única fonte oficial do ETA. Qualquer UI que exibir ETA pós-assignment lê do snapshot.

Regras:

- ETA inicial pós-assignment é calculado no consumo de `DeliveryAssigned`.
- Recalculado a cada ingest válido, throttled a 30 s.
- ETA de retorno calculado após `DeliveryDelivered`.
- Faixa de erro (± minutos) é exibida na UI do cliente.
- ETA sempre acompanhado de `eta_confidence` (§15).

Reusa `src/lib/delivery/ETAEngine.ts`. Não duplica lógica.

---

## 15. Tracking Confidence

Nova primitiva. Toda informação derivada carrega um nível de confiança:

| Nível  | Critério exemplo                                                         |
| ------ | ------------------------------------------------------------------------ |
| Alta   | Heartbeat < 15 s, accuracy < 20 m, spoof_score < 20                      |
| Média  | Heartbeat < 60 s, accuracy < 60 m, spoof_score < 50                      |
| Baixa  | Heartbeat ≥ 60 s ou accuracy ≥ 60 m ou spoof_score ≥ 50 ou reconexão   |

Aplicável a:

- ETA (`eta_confidence`)
- Última posição (`position_confidence`)
- Confirmação de retorno (`return_confidence`)
- Última atualização (`freshness_confidence`)

UI decide como comunicar (ex.: cliente vê apenas texto amigável; Ops vê o nível).

---

## 16. Realtime

Canais Supabase Realtime:

| Ator          | Canal                                     | Filtro          | Payload                          |
| ------------- | ----------------------------------------- | --------------- | -------------------------------- |
| Cliente       | `tracking-order-{order_id}`               | `order_id`      | payload cliente (§17)            |
| Motoboy       | `tracking-driver-{driver_id}`             | `driver_id`     | payload motoboy (§17)            |
| Restaurante   | `tracking-restaurant-{restaurant_id}`     | `restaurant_id` | payload restaurante (§17)        |
| Operations    | `tracking-ops-{region}`                   | região/shard    | payload consolidado (RBAC admin) |

Notas:

- `tracking-ops` é **sharded por região** para suportar 5k entregas/dia.
- Payload por canal segue estritamente a matriz do §17.
- Payload publicado sempre inclui `snapshot_version` monotônico para deduplicação no cliente.

---

## 17. Payload por Ator — Matriz Oficial

### Cliente — recebe:

- `state` (estado semântico traduzido)
- `eta_minutes` + faixa
- janela estimada de chegada
- mensagem amigável
- nome do motoboy, foto, veículo (opt-in do motoboy)

Cliente **nunca** recebe: coordenadas GPS, posição do motoboy, dados de fila, wallet, ranking, ganhos, turno, spoof_score.

### Motoboy — recebe:

- sua própria localização (eco)
- sua entrega ativa
- rota sugerida
- ETA atual

Motoboy **nunca** recebe: posição de colegas, snapshots alheios, ranking bruto.

### Restaurante — recebe:

- estado operacional da entrega
- ETA
- confirmação de retorno
- lista de entregas ativas
- posição operacional (mapa consolidado sem exibir precisão GPS bruta)

Restaurante **nunca** recebe: wallet do motoboy, ranking, dados privados do motoboy, dados de outros restaurantes.

### Operations — recebe:

- payload consolidado global (com shard)
- spoof_score, confidence, alertas
- coordenadas para mapa (uso restrito)

Acesso via RBAC admin.

---

## 18. Notifications (delegação)

Tracking **não envia** Push, SMS, WhatsApp ou Email.

Tracking apenas **publica eventos**:

- `TrackingCustomerArrived`
- `TrackingReturnConfirmed`
- `TrackingSnapshotUpdated` (com filtros)
- `TrackingAnomalyDetected`

O **Notification Domain** decide o canal, template e destinatário. Tracking não conhece o meio de comunicação.

Notifications é removido da lista de responsabilidades internas do Tracking (§3.1).

---

## 19. Rate Limits

| Fluxo                       | Limite                                              |
| --------------------------- | --------------------------------------------------- |
| Heartbeat por motoboy       | Mín. intervalo 3 s (server-side drop se abaixo)     |
| Ingest global               | 200 pontos/s por região (backpressure em fila)      |
| ETA recompute               | 1 recálculo / 30 s por snapshot                     |
| TrackingSnapshotUpdated     | Máx. 1 evento / 2 s por snapshot (coalescência)     |
| Payload Realtime            | Máx. 4 KB por mensagem                              |
| Anomaly events              | Máx. 1 / 30 s por driver                            |

---

## 20. Índices Recomendados

Especificação — **não** cria migration.

`tracking_snapshots`:

- PK `id`
- UNIQUE `(assignment_id)` — snapshot ativo por assignment
- INDEX `(order_id)`
- INDEX `(driver_id, state)`
- INDEX `(restaurant_id, state)`
- INDEX `(last_updated_at DESC)` para varreduras de `SEM_SINAL`

`tracking_timeline`:

- PK `id`
- INDEX `(snapshot_id, created_at)`
- INDEX `(correlation_id)`
- INDEX `(event, created_at)` para observabilidade
- Particionamento por mês (`created_at`) recomendado a partir de 5k entregas/dia.

`driver_locations` (ingest):

- Particionamento por dia
- INDEX `(driver_id, captured_at DESC)`
- Retenção quente 7 dias; frio 90 dias em cold storage.

---

## 21. Escalabilidade

Meta alvo:

- 100 restaurantes ativos
- 500 motoboys online simultâneos
- 5.000 entregas/dia
- 10.000 clientes simultâneos em telas de tracking

Arquitetura:

- **Snapshot** é a única entidade lida pelas UIs. Uma linha por entrega ativa. Cache in-memory por processo, invalidado por Realtime.
- **Pub/Sub** via Supabase Realtime + coalescência (§19). Um evento agregado a cada 2 s.
- **Particionamento lógico**:
  - `tracking-ops-{region}` divide Ops por região geográfica.
  - `driver_locations` particionada por dia.
  - `tracking_timeline` particionada por mês.
- **Backpressure**: fila interna de ingest com descarte controlado quando > 200 pts/s por região; drops registrados como observability.
- **Fanout de cliente**: 10k canais `tracking-order-{id}` é aceitável no Supabase Realtime; payload pequeno + coalescência de 2 s garante throughput.

---

## 22. SLOs

| SLO                                    | Meta                        |
| -------------------------------------- | --------------------------- |
| Latência ingest → snapshot             | p95 < 500 ms                |
| Latência snapshot → Realtime cliente   | p95 < 1500 ms               |
| Frescor de ETA pós-assignment          | ≤ 30 s                      |
| Heartbeat perdido → estado `SEM_SINAL` | ≤ 90 s                      |
| Disponibilidade do canal Realtime      | 99.9% mensal                |
| Precisão de geofence                   | ≥ 95% (dwell + histerese)   |

---

## 23. RLS

| Tabela                | Ator         | Regra                                                    |
| --------------------- | ------------ | -------------------------------------------------------- |
| `tracking_snapshots`  | Cliente      | `order_id` pertence ao usuário                           |
| `tracking_snapshots`  | Motoboy      | `driver_id = auth.uid()`                                 |
| `tracking_snapshots`  | Restaurante  | `restaurant_id` + `has_role(auth.uid(), 'restaurant')`   |
| `tracking_snapshots`  | Admin        | `has_role(auth.uid(), 'admin')`                          |
| `tracking_timeline`   | Cliente      | join via `snapshot_id` + owner do pedido                 |
| `tracking_timeline`   | Motoboy      | join via `snapshot_id` + `driver_id = auth.uid()`        |
| `tracking_timeline`   | Restaurante  | join via `snapshot_id` + restaurante                     |
| `tracking_timeline`   | Admin        | `has_role(auth.uid(), 'admin')`                          |
| `driver_locations`    | Motoboy      | próprios pontos                                          |
| `driver_locations`    | Admin        | leitura completa                                         |

Todas as tabelas seguem o padrão obrigatório: `CREATE TABLE` → `GRANT` → `ENABLE RLS` → `CREATE POLICY`.

Cliente **nunca** lê `driver_locations`. Payload de coordenadas ao cliente é sempre filtrado pelo backend antes do Realtime.

---

## 24. Observabilidade

- `correlation_id` propagado do Delivery Assignment em todos os eventos e linhas de timeline.
- Métricas: latência ingest→snapshot, latência snapshot→realtime, taxa de spoof detectado, taxa de `SEM_SINAL`, drift de ETA.
- Logs de anomalia replicados para `observability` domain.
- Cada `TrackingAnomalyDetected` gera dashboard alert na Central.

---

## 25. Migração — Substituição do `TrackingService` atual

Hoje existe `src/lib/delivery/TrackingService.ts` (in-memory, singleton). Ele **não** é fonte da verdade e será **substituído**, não coexistirá.

Plano:

1. Congelar novas features sobre o `TrackingService` atual.
2. Implementar Tracking Domain conforme esta RFC (snapshot + timeline persistidos).
3. Ligar consumidores existentes (painéis, motoboy) ao novo snapshot via server functions.
4. Remover `TrackingService.ts` e referências no mesmo release.
5. Sem período de coexistência: o novo domínio é o único ativo desde o merge.

Bridge temporário permitido: apenas leitura do snapshot para consumidores legados durante o mesmo PR, removido antes do release.

---

## 26. Arquitetura Proposta (referência)

```text
src/lib/tracking/
  ├── TrackingStateMachine.ts       # estados semânticos
  ├── TrackingSnapshotService.ts    # projeção do snapshot
  ├── TrackingTimeline.ts           # append-only
  ├── TrackingEventBus.ts           # eventos publicados
  ├── GeofenceEngine.ts             # dwell + histerese
  ├── ETAEngine.ts                  # reuso do existente em delivery/
  ├── ConfidenceEngine.ts           # níveis de confiança
  ├── GpsIngest.ts                  # heartbeat + batch + spoof check
  ├── AntiSpoofing.ts               # regras + score
  ├── providers/                    # fontes de localização
  └── index.ts
src/lib/tracking.functions.ts       # server functions (RPC)
supabase/migrations/                # tracking_snapshots + tracking_timeline
```

UIs consomem exclusivamente via `createServerFn` — nunca Supabase direto do componente.

---

## 27. Fluxos

### 27.1 Fluxo feliz

```text
DeliveryAssigned
  → cria snapshot (AGUARDANDO_COLETA, ETA inicial, confidence Alta)
  → publica TrackingSnapshotUpdated

GPS Ingest
  → spoof check + throttle
  → atualiza last_position + confidence
  → recalcula ETA (throttle 30s)
  → publica TrackingEtaChanged (se mudou)

Geofence restaurante (entrada + dwell)
  → estado COLETANDO
  → publica TrackingSnapshotUpdated

DeliveryCollected + saída do geofence
  → estado EM_ROTA
  → publica TrackingSnapshotUpdated

Geofence cliente (entrada + dwell)
  → estado PROXIMO_AO_DESTINO
  → publica TrackingCustomerArrived

DeliveryDelivered
  → estado ENTREGUE
  → publica TrackingSnapshotUpdated

Shift RETURN_STARTED
  → estado RETORNANDO, ETA retorno
  → publica TrackingSnapshotUpdated

Geofence restaurante (entrada + dwell)
  → estado NO_RESTAURANTE
  → publica TrackingReturnConfirmed
```

### 27.2 Exceções

- Sem heartbeat > 90 s → estado `SEM_SINAL` + `TrackingAnomalyDetected`.
- Geofence cliente não dispara em 3× ETA → `TrackingAnomalyDetected`, fallback manual pela Ops.
- Shift finalizado sem geofence restaurante → estado `RETORNO_NAO_CONFIRMADO`.
- Spoof score alto → `TrackingAnomalyDetected`, confidence rebaixado, entrega **não** interrompida.

---

## 28. Fora do escopo — RC5.3

- Roteirização inteligente
- Agrupamento automático de entregas
- IA operacional
- Otimização de rotas

Adiados para RC5.4+.

---

## 29. Roadmap Futuro

| Release | Escopo                                             |
| ------- | -------------------------------------------------- |
| RC5.4   | Roteirização inteligente e agrupamento             |
| RC5.5   | IA operacional (previsão de atrasos, sugestões)    |
| RC5.6   | Otimização multi-motoboy e reatribuição automática |

---

## 30. ADR-017 (referência)

Este RFC introduz a base para a futura **ADR-017 — Tracking Domain como Domínio Observador**, a ser criada em `docs/ARCHITECTURE_DECISIONS.md` no momento da implementação. A ADR formalizará:

- Princípio observador (§2)
- Ownership de ETA (§14)
- Delegação de Notifications (§18)
- Regra de eventos não-loopáveis (§10.2)
- Substituição definitiva do `TrackingService` atual (§25)

---

## 31. Checklist Final de Certificação

A RFC só é considerada pronta quando **todos** os itens abaixo forem verdadeiros:

- [x] Nenhum P0 pendente da auditoria RC5.3
- [x] Nenhum P1 pendente da auditoria RC5.3
- [x] Princípios Arquiteturais declarados (§2)
- [x] Tracking é estritamente observador — não muta outros domínios
- [x] GPS Ingest documentado (§11)
- [x] Anti-Spoofing documentado (§12)
- [x] Snapshot e Timeline separados como conceitos oficiais (§7, §8)
- [x] ETA ownership declarado antes/depois do assignment (§14)
- [x] Notifications delegado ao Notification Domain (§18)
- [x] Eventos consumidos e publicados com nomes distintos (§10)
- [x] Matriz de payload por ator (§17)
- [x] Geofencing com dwell + histerese + cooldown (§13)
- [x] Rate limits definidos (§19)
- [x] Índices recomendados especificados (§20)
- [x] Escalabilidade dimensionada para as metas (§21)
- [x] Tracking Confidence definido (§15)
- [x] SLOs definidos (§22)
- [x] RLS coberto para todas as tabelas (§23)
- [x] Plano de migração sem coexistência (§25)
- [x] Referência à ADR-017 (§30)
- [x] Contratos públicos (server functions + payloads) definidos
- [x] Sem dependências circulares
- [x] Fora de escopo (RC5.4+) preservado

---

## Resumo das Alterações (R1 vs R0)

- Adicionadas seções: Princípios Arquiteturais, GPS Ingest, Anti-Spoofing, Tracking Snapshot oficial, Tracking Timeline oficial, Tracking Confidence, Rate Limits, Índices, Escalabilidade, SLOs, Migração, ADR-017, Checklist final, Matriz de payload por ator, Mapa de capítulos.
- Renomeados eventos publicados para eliminar colisão com consumidos (`DriverArrived`→`TrackingCustomerArrived`, `DriverReturned`→`TrackingReturnConfirmed`, `TrackingUpdated`→`TrackingSnapshotUpdated`, `EtaChanged`→`TrackingEtaChanged`).
- Removida "Notifications" das responsabilidades internas.
- ETA ownership formalizado (Delivery antes / Tracking depois do assignment).
- Geofencing agora inclui dwell, histerese, cooldown e raio adaptativo.
- RLS reforçada em `tracking_timeline` e `driver_locations`; cliente proibido de receber coordenadas.
- Adicionados estados `RETORNO_NAO_CONFIRMADO` e `SEM_SINAL`.
- Canal `tracking-ops` agora sharded por região.
