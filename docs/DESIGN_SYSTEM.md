# Localix Design System (RC-UX.0)

Sistema visual oficial da Localix. Toda tela nova ou refatorada deve seguir este documento.

Inspiração: Stripe Dashboard, Linear, Notion, Uber Driver, Square POS.
Princípios: minimalista, moderno, operacional, premium, rápido.

Regras invioláveis:
- Nunca usar classes de cor cruas (`text-white`, `bg-gray-500`, `bg-[#...]`). Sempre tokens semânticos.
- Nunca definir tokens em componentes; tokens vivem em `src/styles.css`.
- Nunca misturar bibliotecas de ícones. Padrão: **lucide-react**.
- Radius único por superfície: cards `rounded-2xl`, inputs/botões `rounded-lg`, chips `rounded-full`.

---

## 1. Tokens de cor (semânticos)

Definidos em `src/styles.css` (`:root` + `.dark`) e mapeados em `@theme inline`.

| Token | Utilitário Tailwind | Uso |
|---|---|---|
| `--primary` | `bg-primary` `text-primary` | Marca Localix (vermelho tomate) |
| `--secondary` | `bg-secondary` | Superfícies secundárias, chips neutros |
| `--background` | `bg-background` | Fundo global |
| `--card` | `bg-card` | Cartões, superfícies elevadas |
| `--muted` / `--muted-foreground` | `bg-muted` `text-muted-foreground` | Zonas neutras, legendas |
| `--border` | `border-border` | Bordas |
| `--ring` | `ring-ring` | Foco acessível |
| `--success` | `bg-success text-success-foreground` | Estados de sucesso, "Pago", "Online" |
| `--destructive` | `bg-destructive text-destructive-foreground` | Erros, "Cancelado", "Danger" |
| `--warning` | `bg-warning text-warning-foreground` | Alertas, "Pendente" |
| `--info` | `bg-info text-info-foreground` | Informativos |
| `--queue` | `bg-queue text-queue-foreground` | Amarelo — Fila |
| `--delivery` | `bg-delivery text-delivery-foreground` | Azul — Em entrega |
| `--returning` | `bg-returning text-returning-foreground` | Roxo — Em retorno |
| `--offline` | `bg-offline text-offline-foreground` | Cinza — Offline |

> Suporte a tema claro/escuro é automático via `.dark` no `<html>`.

## 2. Tipografia

Fontes: `--font-sans` (Inter) para corpo; `--font-display` (Plus Jakarta Sans) para títulos.

| Papel | Classe |
|---|---|
| H1 / página | `font-display text-3xl font-extrabold tracking-tight` |
| H2 / seção | `font-display text-2xl font-bold` |
| Card title | `font-display text-lg font-semibold` |
| Tabela header | `text-xs font-semibold uppercase tracking-wide text-muted-foreground` |
| Body | `text-sm text-foreground` |
| Legenda | `text-xs text-muted-foreground` |
| Botão | `text-sm font-medium` |

## 3. Bordas & Sombras

- Radius: `--radius: 0.875rem` (14px). Escala derivada `rounded-md/lg/xl/2xl/3xl`.
- Sombras: `shadow-elegant` (padrão de cards), `shadow-premium` (hover), `shadow-float` (modais/popovers), `shadow-glow` (destaque marca).

## 4. Botões (`@/components/ui/button`)

Variantes shadcn oficiais: `default` (primário), `secondary`, `outline`, `ghost`, `destructive` (danger), `link`. Tamanhos: `sm`, `default`, `lg`, `icon`.

Regras:
- Botão com ícone-only: sempre `aria-label`.
- Botão de perigo: `variant="destructive"`, nunca hex custom.

## 5. Formulários

- `label` sempre acima do campo.
- Inputs `h-11`, `rounded-lg`, `bg-background`.
- Mensagens de erro: `text-xs text-destructive mt-1`.
- Estados: focus (`ring-2 ring-ring`), erro (`border-destructive`), sucesso (`border-success`), loading (`disabled + spinner`).

## 6. Cards

Estrutura padrão (`@/components/ui/card`): `Card` → `CardHeader` + `CardTitle` + `CardDescription` → `CardContent` → `CardFooter?`.
Padding padrão `p-4` a `p-6`, radius `rounded-2xl`, border `border-border`, shadow `shadow-elegant`.

## 7. Tabelas

- Cabeçalho: `sticky top-0 bg-card/95 backdrop-blur`.
- Linhas: altura mínima `h-12`, hover `bg-muted/40`.
- Zebra opcional apenas em relatórios densos.

## 8. Badges de status (`@/components/ui/status-badge`)

```tsx
import { StatusBadge } from "@/components/ui/status-badge";

<StatusBadge tone="online">Online</StatusBadge>
<StatusBadge tone="queue">Fila</StatusBadge>
<StatusBadge tone="delivery">Em entrega</StatusBadge>
<StatusBadge tone="returning">Retornando</StatusBadge>
<StatusBadge tone="offline">Offline</StatusBadge>
<StatusBadge tone="paid">Pago</StatusBadge>
<StatusBadge tone="pending">Pendente</StatusBadge>
<StatusBadge tone="cancelled">Cancelado</StatusBadge>
```

Tons disponíveis: `online | offline | queue | delivery | returning | paid | pending | cancelled | info | warning | success | danger | neutral`.

## 9. Modais / Dialogs

Base: `@/components/ui/dialog` (Radix). Padding `p-6`, título `font-display text-xl font-semibold`, botões alinhados à direita no rodapé (`justify-end gap-2`). Fechamento com botão `X` (aria-label "Fechar") + Esc.

## 10. Ícones

Padrão único: **lucide-react**. Tamanhos `h-4 w-4` (inline), `h-5 w-5` (padrão), `h-6 w-6` (headers). Ícone dentro de "chip": utilitário `icon-chip` (`@utility` em `styles.css`).

## 11. Loading

- `Skeleton` (`@/components/ui/skeleton`) para listas e cards.
- `Spinner` (`Loader2` do lucide + `animate-spin`) para ações inline.
- Progress (`@/components/ui/progress`) para operações longas.

## 12. Empty States (`@/components/ui/empty-state`)

```tsx
<EmptyState
  icon={<Package />}
  title="Nenhum pedido ainda"
  description="Assim que chegar o primeiro pedido, ele aparece aqui."
  action={<Button>Criar pedido teste</Button>}
/>
```

## 13. Toasts

Padrão: `sonner`. `toast.success`, `toast.error`, `toast.warning`, `toast.info`. Nunca usar `alert()`.

## 14. Sidebar & Header

- Sidebar: `@/components/ui/sidebar`. Ícones alinhados, grupos separados com `SidebarGroupLabel`.
- Header: altura `h-14`, contém `SidebarTrigger`, busca global (`Cmd+K`), `NotificationsBell`, avatar/perfil.

## 15. Dashboards

- Cards de métricas iguais em altura (`min-h-[7rem]`).
- Layout: `grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4`.
- Charts (`recharts`) usam `--chart-1..5`.

## 16. Responsividade

Mobile-first. Breakpoints Tailwind (`sm 640`, `md 768`, `lg 1024`, `xl 1280`). Toda superfície de operação deve funcionar em 375px.

## 17. Microanimações

- Duração `220–280ms`, ease `--ease-premium`.
- Hover: `hover-lift` utility.
- Fade/slide de entrada: `tw-animate-css` (`animate-in fade-in slide-in-from-bottom-2`).

## 18. Acessibilidade

- Contraste mínimo AA (verifique combos de tokens antes de introduzir novos).
- `focus-visible:ring-2 ring-ring` em todo interativo.
- Navegação por teclado em modais, menus, tabelas.
- `aria-label` em botões-icone.
- Um único `<main>` por rota (no layout).

---

## Checklist de conformidade

Antes de fazer merge de uma tela:

- [ ] Zero classes de cor hardcoded.
- [ ] Radius consistente com a superfície.
- [ ] Badges usam `StatusBadge`.
- [ ] Empty states usam `EmptyState`.
- [ ] Loading via `Skeleton` / `Loader2`.
- [ ] Ícones apenas lucide-react.
- [ ] Toasts via `sonner`.
- [ ] Focus visível + `aria-label` em icon-only.
- [ ] Testado em 375, 768, 1280.
