# Localix

Plataforma multi-tenant de pedidos, delivery e monetização para restaurantes.

Frontend em **TanStack Start v1** (React 19 + Vite 7 + Tailwind v4) e backend
em **Lovable Cloud** (Supabase gerenciado + Edge Functions em Cloudflare
Workers). Pagamentos via **Stripe Connect Express** com split automático.

## Stack

| Camada | Tecnologia |
|---|---|
| UI | React 19, TanStack Router/Query, Tailwind v4, shadcn/ui |
| Server | TanStack Start server functions (Cloudflare Workers) |
| Backend | Lovable Cloud (Postgres + Auth + Storage + Edge Functions) |
| Pagamentos | Stripe Connect Express (split), Mercado Pago (legado) |
| IA | Lovable AI Gateway |

## Como rodar

```bash
bun install
bun run dev            # http://localhost:8080
bun run build          # build de produção
bun run lint           # ESLint
```

## Ambientes

Ver [`docs/DEPLOYMENT_GUIDE.md`](docs/DEPLOYMENT_GUIDE.md) e
[`docs/OPERATIONS_MANUAL.md`](docs/OPERATIONS_MANUAL.md).

| Ambiente | URL |
|---|---|
| DEV | preview Lovable (`id-preview--*.lovable.app`) |
| STAGING | `project--<id>-dev.lovable.app` |
| PROD | `localixdelivery.lovable.app` (+ domínio custom) |

## Documentação

Toda a documentação técnica vive em [`docs/`](docs/). Destaques:

- Arquitetura → [`docs/ARCHITECTURE_BASELINE.md`](docs/ARCHITECTURE_BASELINE.md)
- Modelo de negócio → [`docs/LOCALIX_BUSINESS_MODEL_V1.md`](docs/LOCALIX_BUSINESS_MODEL_V1.md)
- Pagamentos / Split → [`docs/STRIPE_SPLIT.md`](docs/STRIPE_SPLIT.md)
- Segurança → [`docs/SECURITY_GUIDE.md`](docs/SECURITY_GUIDE.md)
- Go Live → [`docs/GO_LIVE_CHECKLIST.md`](docs/GO_LIVE_CHECKLIST.md)
- Operações → [`docs/OPERATIONS_RUNBOOK.md`](docs/OPERATIONS_RUNBOOK.md)

## Contribuindo

Leia [`CONTRIBUTING.md`](CONTRIBUTING.md) antes de abrir um PR.

## Licença

Proprietária — ver [`LICENSE`](LICENSE).
