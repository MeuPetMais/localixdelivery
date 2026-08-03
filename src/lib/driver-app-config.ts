// RC-UX.3.1 — Configuração única do download do app Localix Entregador.
// Fonte da verdade para URLs; NÃO hardcodar em componentes.
//
// Durante o piloto, apontar para o APK oficial.
// Após publicação na Play Store, apontar para a URL da loja.

/** URL de download do app (APK durante piloto; Play Store após publicação). */
export const APP_DOWNLOAD_URL: string =
  (import.meta.env.VITE_DRIVER_APP_DOWNLOAD_URL as string | undefined) ??
  "https://localixdelivery.rngdigital.com.br/downloads/localix-entregador.apk";

/** Deep link para abrir o app instalado (Android intent scheme opcional). */
export const APP_OPEN_URL: string =
  (import.meta.env.VITE_DRIVER_APP_OPEN_URL as string | undefined) ??
  "localixentregador://open";

/** Indica se o download aponta para a Play Store (afeta o texto do botão). */
export const IS_PLAY_STORE = APP_DOWNLOAD_URL.includes("play.google.com");
