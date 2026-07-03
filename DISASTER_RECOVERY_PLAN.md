# DISASTER RECOVERY PLAN — Localix v1.0

Procedimento para cenários catastróficos: perda de dados, indisponibilidade
prolongada, corrupção de estado.

## 1. Objetivos

- **RPO (Recovery Point Objective):** ≤ 24h (backup diário automático).
- **RTO (Recovery Time Objective):** ≤ 4h para cenários P1.

## 2. Backup

- **Banco de dados:** snapshot diário automático (Supabase managed),
  retenção mínima de 7 dias no plano atual.
- **Storage buckets:** replicação regional pelo provedor.
- **Segredos:** armazenados em Lovable Cloud (não em `.env`); exportar
  manualmente para cofre externo mensalmente.
- **Código-fonte:** histórico completo de versões no editor Lovable.
- **Migrations:** versionadas em `supabase/migrations/`.

## 3. Restauração parcial (uma tabela)

1. Identificar a última linha íntegra via `AuditCenter` / logs de aplicação.
2. Solicitar ao suporte Lovable Cloud a extração do snapshot mais recente.
3. Restaurar em tabela temporária.
4. Reconciliar via SQL controlado.
5. Registrar operação em `AuditCenter` categoria `admin`.

## 4. Restauração total (banco inteiro)

1. Declarar incidente P1 e ativar comunicação.
2. Colocar plataforma em modo somente-leitura (kill switch em escritas
   sensíveis: `orders.create`, `payments.intent.create`).
3. Solicitar restore completo do snapshot ao suporte.
4. Após restore, executar migrations mais recentes (se posteriores).
5. Smoke test completo antes de reabrir escritas.
6. Publicar postmortem em 72h.

## 5. Perda de Edge Function / Server Function

- Restaurar versão anterior via histórico do editor (ver `ROLLBACK_GUIDE.md`).
- Não há estado persistente próprio nas functions — restauração é imediata.

## 6. Compromisso de segredo

Cenário: `MP_ACCESS_TOKEN` ou `MP_WEBHOOK_SECRET` vazado.

1. Ativar kill switch de pagamentos.
2. Rotacionar segredo no painel Mercado Pago.
3. Atualizar em Lovable Cloud via `update_secret`.
4. Reativar pagamentos.
5. Auditar transações do período de exposição.
6. Comunicar merchants se PII foi acessada.

## 7. Corrupção de EventBus / fila

- EventBus é in-process; reinício limpa o buffer.
- Consumidores são idempotentes (contrato do domínio).
- Nenhuma ação especial necessária além de reiniciar workers.
- v1.1 introduzirá fila durável — atualizar este plano.

## 8. Falha total do provedor (Lovable/Supabase)

- Comunicar merchants sobre indisponibilidade.
- Monitorar status page do provedor.
- Não iniciar migração de emergência — o custo excede o RTO alvo em v1.0.
- v1.1 avaliará estratégia multi-região.

## 9. Testes de recuperação (drills)

Executar mensalmente em staging:

- [ ] Restore de tabela isolada
- [ ] Rollback de release
- [ ] Rotação de segredo com kill switch
- [ ] Simulação de webhook MP com assinatura inválida

Registrar resultados em `TECHNICAL_HEALTH_REPORT.md`.

## 10. Contatos

- Suporte Lovable Cloud (canal oficial da workspace)
- Suporte Mercado Pago (portal do desenvolvedor)
- On-call interno (rodízio semanal)
