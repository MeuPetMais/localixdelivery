# Platform Revenue — Eventos

Bus in-process (`RevenueEvents`) — assinatura via `RevenueEvents.on(fn)`.

| Evento                 | Payload                                   | Quando |
|------------------------|-------------------------------------------|--------|
| `RevenuePolicyChanged` | `{ policy, at }`                          | Admin altera política |
| `ServiceFeeCalculated` | `{ result: {amount,type,currency}, at }`  | Toda vez que `PlatformRevenueService.calculate/getCurrentServiceFee` roda |
| `ServiceFeeApplied`    | `{ result, orderId?, at }`                | Após snapshot financeiro do pedido |
| `ServiceFeeDisabled`   | `{ at }`                                  | Política inativa/fora de vigência |
