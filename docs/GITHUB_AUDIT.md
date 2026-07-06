# Auditoria pré-GitHub — Localix

## 1. Estrutura atual (raiz)

```
.env                    ⚠️ IGNORAR
.env.example            ✅ commitar
.gitignore
.github/workflows/ci.yml
.lovable/                (config Lovable — ok commitar)
.prettierrc, .prettierignore
README.md CONTRIBUTING.md CHANGELOG.md LICENSE ROADMAP.md
bunfig.toml components.json eslint.config.js
package.json tsconfig.json vite.config.ts
docs/                   (toda documentação técnica)
public/                 (assets estáticos)
src/                    (código-fonte)
supabase/               (config + migrations + edge functions)
```

## 2. Arquivos que NÃO vão ao GitHub (via .gitignore)

- `node_modules/`, `dist/`, `.output/`, `.vinxi/`, `.tanstack/`, `.nitro/`, `.wrangler/`, `.cache/`, `.turbo/`
- `.env`, `.env.*` (exceto `.env.example`)
- `*.log`, `logs/`
- `coverage/`, `.nyc_output/`
- `.DS_Store`, `Thumbs.db`, `.idea/`, `.vscode/*`
- `.workspace/`, `.lovable/cache/`
- `*.pem`, `*.key`, `*.p12`, `secrets.json`, `.dev.vars`

## 3. Arquivos sensíveis identificados

| Arquivo | Ação |
|---|---|
| `.env` | Ignorado. Valores públicos (VITE_*) já são anon key; ainda assim, não commitar. |
| `supabase/config.toml` | Ok commitar (sem secrets). |
| `.lovable/project.json` | Ok commitar. |

Nenhum secret privado (Stripe secret, service role, webhook secret) foi encontrado no repositório — todos vivem em Lovable Cloud > Secrets.

## 4. Secrets (Lovable Cloud, não commitados)

- `STRIPE_SECRET_KEY_TEST` / `STRIPE_SECRET_KEY_LIVE`
- `STRIPE_WEBHOOK_SECRET_TEST` / `STRIPE_WEBHOOK_SECRET_LIVE`
- `STRIPE_PUBLISHABLE_KEY_TEST` / `STRIPE_PUBLISHABLE_KEY_LIVE`
- `MP_CLIENT_ID`, `MP_CLIENT_SECRET`, `MP_WEBHOOK_SECRET`
- `LOVABLE_API_KEY` (gerenciado)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (gerenciados)

## 5. Variáveis de ambiente

Ver `.env.example`. Somente `VITE_SUPABASE_*` são públicas.

## 6. Arquivos grandes

Nenhum acima de 1 MB no repositório fonte. Documentação total ~600 KB.

## 7. Build

- `bun run build` → Vite/TanStack Start, saída em `.output/`.
- `bun run build:dev` → build de desenvolvimento (com prerender).

## 8. Dependências

- Bun como gerenciador (`bunfig.toml`).
- Sem `package-lock.json` / `pnpm-lock.yaml` — apenas `bun.lock`.
- Rodar `bun audit` (ou `code--dependency_scan`) antes de release.

---

## Checklist — publicação GitHub

- [x] `.gitignore` cobre secrets, build e caches
- [x] `.env` ignorado; `.env.example` presente
- [x] `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `LICENSE`, `ROADMAP.md`
- [x] Documentação em `docs/`
- [x] Workflow CI (`.github/workflows/ci.yml`)
- [ ] Criar repositório privado no GitHub
- [ ] Conectar via Lovable → GitHub
- [ ] Configurar secrets do Actions: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
- [ ] Proteger branch `main` (require PR + CI green)

## Checklist — deploy

- [ ] Todos os secrets configurados em Lovable Cloud (dev + prod)
- [ ] Stripe em modo `live` com chaves rotacionadas
- [ ] Migrations aplicadas (`supabase/migrations`)
- [ ] Webhook Stripe apontando para URL de produção
- [ ] Domínio custom conectado
- [ ] Testes E2E de checkout com Split verificados
- [ ] Monitoramento / alertas ativos
- [ ] Backup automático confirmado
