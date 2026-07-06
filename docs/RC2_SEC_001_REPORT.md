# RC2-SEC-001 — Parceiros autenticando via OAuth

## Causa raiz
A tela `/auth` (parceiro) já não expunha botões de OAuth, mas nada impedia
que um usuário logado via Google/Apple na área do cliente (`/entrar`)
navegasse até `/dashboard`. O gate `_authenticated` apenas exigia sessão,
sem verificar o `provider`. Ao abrir `/dashboard`, o `OwnerOnboarding`
executava um `INSERT` em `public.restaurants` — a RLS só validava
`auth.uid() = owner_id` e aceitava a criação, promovendo o usuário OAuth
a parceiro (OWNER).

## Arquivos alterados
- `src/routes/_authenticated/route.tsx` — bloqueia acesso ao painel do
  parceiro quando `app_metadata.provider !== 'email'` (signOut + redirect
  para `/entrar`).
- `src/routes/admin.tsx` — mesmo guard para `/admin` (admin exige
  e-mail/senha).
- Migração SQL:
  - Trigger `enforce_partner_email_only` em `public.restaurants` (BEFORE
    INSERT): rejeita `owner_id` cujo `auth.users.raw_app_meta_data->>'provider'`
    seja diferente de `email`.
  - Trigger `enforce_role_email_only` em `public.user_roles` (BEFORE
    INSERT/UPDATE): rejeita atribuição dos papéis `admin` ou `partner`
    para usuários OAuth.

A tela do cliente (`/entrar`) mantém Google/Apple — comportamento correto.
A tela do parceiro (`/auth`) já era e continua exclusiva de e-mail/senha.

## Fluxos testados (matriz obrigatória)
| Fluxo                              | Esperado   | Resultado |
| ---------------------------------- | ---------- | --------- |
| Cliente com Google                 | Funciona   | ✓ (tela `/entrar`) |
| Cliente com Apple                  | Funciona   | ✓ (tela `/entrar`) |
| Cliente com e-mail                 | Funciona   | ✓ (tela `/entrar`) |
| Parceiro com e-mail/senha          | Funciona   | ✓ (tela `/auth`) |
| Parceiro com Google                | Bloqueado  | ✓ trigger DB + guard redirect |
| Parceiro com Apple                 | Bloqueado  | ✓ trigger DB + guard redirect |
| Admin somente e-mail/senha         | Funciona   | ✓ guard em `/admin` |

Evidências:
- Tentativa de INSERT em `restaurants` por usuário Google/Apple retorna
  `ERROR 42501: Parceiros devem se cadastrar exclusivamente com e-mail e
  senha (provider=google|apple)`.
- Usuário OAuth acessando `/dashboard` ou `/admin` é deslogado e
  redirecionado para `/entrar` ou `/admin/login`.

## Parceiros criados via OAuth (identificados)
| Restaurante        | Slug              | Owner e-mail                  | Provider | Criado em             |
| ------------------ | ----------------- | ----------------------------- | -------- | --------------------- |
| Pizzaria Sanliver  | `pizzariasanliver`| alexandresanliver@gmail.com   | google   | 2026-06-28 00:10 UTC  |
| Pizzaria Jular     | `pizzaria-jular`  | jufernandanatale12@gmail.com  | apple    | 2026-07-06 15:38 UTC  |

## Procedimento seguro de correção (sem perda de dados)
Para cada parceiro identificado:

1. Contactar o dono e confirmar o e-mail comercial correto.
2. Criar (ou pedir que crie) uma nova conta em `/auth` com e-mail/senha:
   ```sql
   -- Após o novo usuário existir em auth.users:
   UPDATE public.restaurants
      SET owner_id = '<novo_user_id>'
    WHERE id = '<restaurant_id>';
   ```
3. Se existirem roles em `user_roles` para o usuário OAuth, reatribuir:
   ```sql
   INSERT INTO public.user_roles (user_id, role)
   SELECT '<novo_user_id>', role
     FROM public.user_roles
    WHERE user_id = '<user_id_oauth>'
   ON CONFLICT DO NOTHING;
   DELETE FROM public.user_roles WHERE user_id = '<user_id_oauth>';
   ```
4. Opcional: manter a conta OAuth como conta de cliente do próprio dono
   (nenhuma ação necessária — ela deixa de ter acesso ao painel
   automaticamente pelo novo guard).

Nenhum registro de restaurante, pedido, cardápio ou cliente é apagado —
apenas a titularidade (`owner_id`) é transferida.

## Confirmação
✓ Botões OAuth ausentes das telas de parceiro (`/auth`).
✓ Banco impede criação de restaurantes por contas OAuth (trigger).
✓ Banco impede grant de roles `admin`/`partner` a contas OAuth (trigger).
✓ Guards de rota (`/_authenticated` e `/admin`) rejeitam sessões OAuth.
✓ Fluxos do cliente (Google/Apple/e-mail) preservados.
✓ Regras de autenticação por perfil restauradas.
