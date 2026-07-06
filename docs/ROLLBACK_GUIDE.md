# ROLLBACK GUIDE — Localix v1.0

Procedimento para reverter uma release quando o deploy causa regressão.

## 1. Decisão

Iniciar rollback se **qualquer** critério ocorrer nos primeiros 30 min:

- Taxa de erro global > 2% (baseline: <0,3%).
- p95 `response_ms` > 3x baseline.
- Falha em fluxo crítico (login, checkout, pagamento aprovado, webhook MP).
- Incidente de segurança confirmado.

Decisão tomada pelo on-call em conjunto com engenharia responsável.

## 2. Rollback de Frontend + Server Functions

1. Abrir histórico de versões no editor Lovable.
2. Selecionar a última versão estável (anterior ao deploy problemático).
3. Restaurar essa versão.
4. Publish → Update.
5. Verificar `OperationsDashboard` até estabilizar (~5 min).

> Frontend e server functions vivem no mesmo bundle: rollback é atômico.

## 3. Rollback de Edge Functions

Edge functions são deployadas automaticamente com o commit. O rollback
da versão anterior no editor Lovable já reverte o código das functions.

Para desativar uma função sem reverter o código, use kill switch:

```ts
platformConfiguration.killSwitch.enable('mp.payment.intent', 'incident 2026-07-03');
```

## 4. Rollback de Migrations

Migrations são forward-only. Não existe `down migration` automática.

Se uma migration causou dano:

1. Escrever nova migration corretiva (drop coluna, restaurar tipo, etc.).
2. Aplicar imediatamente.
3. Se dados foram perdidos, iniciar `DISASTER_RECOVERY_PLAN.md`.

## 5. Rollback de Feature Flag

Alternativa preferencial a rollback de código quando a feature está
protegida por flag:

```ts
platformConfiguration.featureFlags.setRollout('feature.key', 0);
platformConfiguration.killSwitch.enable('feature.key', 'rollback');
```

## 6. Rollback de Secrets

Se um secret rotacionado quebrou a integração:

- `MP_*`: restaurar valor anterior via `update_secret`; reiniciar não é
  necessário (edge functions leem em runtime).
- `LOVABLE_API_KEY`: usar `lovable_api_key--rotate_lovable_api_key`
  novamente (nunca `set_secret`).

## 7. Rollback de Pagamentos em curso

- Pedidos com `payment.status = PROCESSING` no momento do rollback
  continuam válidos — webhook MP finaliza o fluxo.
- Pedidos com Pix `PENDING` não expirados permanecem ativos até
  `expiration_date`.
- Nenhuma reprocessamento manual é necessário; observability confirma.

## 8. Comunicação

- Registrar incidente em `IncidentCenter` (Open → Mitigated → Closed).
- Comunicar merchants afetados via `NotificationCenter` (canal operacional).
- Postmortem em até 72h para incidentes P1.

## 9. Verificação pós-rollback

- Smoke test completo (`GO_LIVE_CHECKLIST.md` §9).
- Confirmar zero alertas novos em 30 min.
- Fechar incidente após 1h de operação estável.

## 10. Referências

- `DEPLOYMENT_GUIDE.md`
- `DISASTER_RECOVERY_PLAN.md`
- `OPERATIONS_RUNBOOK.md`
