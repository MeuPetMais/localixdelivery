# PWA — Localix Entregador

Instalação do App do Entregador como PWA (Progressive Web App).
Escopo: apenas o domínio `Driver`. Não afeta Restaurante, Cliente ou Admin.

## Fluxo

1. Entregador ativa a conta (`/entregador/ativar`) ou faz login (`/entregador/entrar`).
2. Ao entrar na Home (`/motoboy`):
   - Registramos o service worker `/driver-sw.js` (produção).
   - Se o navegador emitir `beforeinstallprompt`, abrimos o modal
     **Instalar Localix Entregador** automaticamente uma única vez
     (a preferência “Agora não” é persistida em `localStorage`).
3. Em **Perfil → Instalar aplicativo** o entregador pode instalar a
   qualquer momento. O botão some quando o app já está instalado ou
   quando o navegador não oferece suporte.

## Requisitos atendidos

| Requisito              | Status |
| ---------------------- | ------ |
| `manifest.webmanifest` | `public/manifest.webmanifest` |
| Service Worker         | `public/driver-sw.js` (fetch passthrough) |
| HTTPS                  | Domínio Lovable / custom domain com HTTPS |
| `display: standalone`  | Sim |
| `start_url` / `scope`  | `/entregador` / `/` |
| `theme_color`          | `#0f172a` |
| `background_color`     | `#0f172a` |
| Ícone 192×192          | `public/icons/icon-192.png` (`purpose: any maskable`) |
| Ícone 512×512          | `public/icons/icon-512.png` (`purpose: any maskable`) |
| Apple touch icon       | `public/icons/apple-touch-icon.png` |

## `beforeinstallprompt`

- Capturamos o evento em `useDriverPwaInstall()` (`src/lib/pwa-driver.ts`)
  chamando `e.preventDefault()` e armazenando a referência.
- Nunca chamamos `prompt()` automaticamente — só depois de ação do usuário
  (clique em **Instalar**).
- Quando o app é instalado (`appinstalled`) limpamos o flag de dismissal.

## Registro do Service Worker

`registerDriverServiceWorker()` **recusa** o registro em:

- Desenvolvimento (`!import.meta.env.PROD`).
- Preview do Lovable (`id-preview--*`, `preview--*`, `*.lovableproject.com`,
  `*.lovableproject-dev.com`, `*.beta.lovable.dev`).
- Iframe (`window.self !== window.top`).
- URL com `?sw=off` (kill switch de emergência).

Nesses contextos qualquer registro existente de `/driver-sw.js` é
desregistrado, para evitar cache preso durante desenvolvimento.

## Compatibilidade

| Navegador           | Comportamento |
| ------------------- | ------------- |
| Chrome Android      | Prompt nativo via `beforeinstallprompt` |
| Samsung Internet    | Prompt nativo (comportamento equivalente ao Chrome) |
| Edge Mobile/Desktop | Prompt nativo |
| Chrome Desktop      | Prompt nativo |
| Safari iOS          | Instruções manuais: Compartilhar → Adicionar à Tela Inicial |
| Firefox Desktop     | Sem suporte a instalação — botão “Instalar aplicativo” fica oculto e o modal exibe fallback |
| Outros              | Mensagem: “Seu navegador não suporta instalação do aplicativo.” |

## Fallback

Se `beforeinstallprompt` não disparar e o usuário **não** estiver em
Safari iOS, o modal mostra:

> Seu navegador não suporta instalação do aplicativo. Tente pelo Chrome,
> Edge ou Samsung Internet.

## Testes manuais recomendados

- **Android Chrome / Samsung Internet / Edge Mobile:** login →
  prompt automático → instalar → app abre em standalone.
- **Desktop Chrome / Edge:** login → prompt automático → instalar.
- **iOS Safari:** login → modal com instruções “Adicionar à Tela Inicial”.
- **Firefox / navegadores sem suporte:** botão “Instalar aplicativo”
  fica oculto; fallback aparece se o usuário forçar o modal.
- **App já instalado:** nenhum prompt aparece; botão fica oculto.
- **`?sw=off`:** service worker desregistra e não há prompt (kill switch).
