# Payment Sequence — Stripe Sandbox

```text
Cliente          Front-end            Edge:stripe-checkout      Stripe                Edge:stripe-webhook       DB
  |  click Pagar  |                          |                    |                          |                  |
  |-------------->|                          |                    |                          |                  |
  |               |  POST {orderId,...}      |                    |                          |                  |
  |               |------------------------->|                    |                          |                  |
  |               |                          |  SELECT orders     |                          |                  |
  |               |                          |------------------------------------------------------------------>|
  |               |                          |  POST /checkout/sessions                      |                  |
  |               |                          |------------------->|                          |                  |
  |               |                          |<--- session -------|                          |                  |
  |               |                          |  INSERT payments(pending, external_id=session.id)                 |
  |               |                          |------------------------------------------------------------------>|
  |               |<--- {url, sessionId} ----|                    |                          |                  |
  |  redirect     |                          |                    |                          |                  |
  |<--------------|                          |                    |                          |                  |
  |  pay          |                          |                    |                          |                  |
  |------------------------------------------------------------->|                          |                  |
  |                                                              |  POST /stripe-webhook    |                  |
  |                                                              |------------------------->|                  |
  |                                                              |                          | verify signature |
  |                                                              |                          | idempotency check|
  |                                                              |                          |----------------->|
  |                                                              |                          | UPDATE payments  |
  |                                                              |                          | INSERT ledger    |
  |                                                              |                          | UPDATE orders    |
  |                                                              |                          |----------------->|
  |  redirect successUrl                                          |                          |                  |
  |<-------------------------------------------------------------|                          |                  |
```
