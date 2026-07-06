# Contribuindo com a Localix

## Fluxo

1. Crie uma branch a partir de `main`: `feat/...`, `fix/...`, `chore/...`, `docs/...`.
2. Rode localmente antes de abrir PR:
   ```bash
   bun run lint
   bun run build
   ```
3. Abra o PR usando Conventional Commits no título (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`).
4. PRs precisam de:
   - CI verde (lint, typecheck, build).
   - Revisão de pelo menos 1 mantenedor.
   - Nenhum secret comitado.

## Regras de código

- **Nunca** commitar `.env`, `*.key`, `*.pem` ou qualquer secret.
- **Nunca** editar arquivos auto-gerados: `src/routeTree.gen.ts`, `src/integrations/supabase/{client,client.server,auth-middleware,auth-attacher,types}.ts`.
- **Nunca** alterar domínios sem passar pela fachada oficial (`StripeService`, `PaymentService`, `PlatformRevenueService`, etc.).
- Manter escopo do PR mínimo — features grandes viram vários PRs pequenos.

## Testes

```bash
bunx vitest run
```

Cobertura mínima para novos módulos de domínio: 80%.

## Segurança

Se encontrar vulnerabilidade, **não abra issue pública** — envie por e-mail ao mantenedor.
