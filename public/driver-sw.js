// Localix Entregador — Service Worker mínimo para satisfazer os requisitos
// de instalabilidade PWA (manifest + SW com fetch handler). Não faz cache
// de aplicação. Escopo restrito ao App do Entregador.
//
// Registrado apenas em produção pelo wrapper `src/lib/pwa-driver.ts`.
// Nunca registrado em preview do Lovable, iframe, dev ou quando `?sw=off`.

const SW_VERSION = "driver-sw-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Passthrough fetch handler — necessário para o Chrome oferecer
// `beforeinstallprompt`. Não intercepta nada; apenas segue a rede.
self.addEventListener("fetch", (event) => {
  // no-op: deixamos o navegador tratar a requisição normalmente.
  // A presença deste listener é o requisito de instalabilidade.
  void event;
});

self.addEventListener("message", (event) => {
  if (event.data === "SW_VERSION") {
    event.ports?.[0]?.postMessage(SW_VERSION);
  }
});
