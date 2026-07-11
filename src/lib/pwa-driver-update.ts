// RC6.8 — Verificação manual de atualização do Service Worker do entregador.
// Retorna:
//  - "updated"     : havia uma nova versão e foi ativada / disponível.
//  - "current"     : já está na versão mais recente.
//  - "unsupported" : SW indisponível (ex.: preview, iOS < 16, sw=off).

export type DriverUpdateResult = "updated" | "current" | "unsupported";

export async function checkForDriverAppUpdate(): Promise<DriverUpdateResult> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return "unsupported";
  }
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return "unsupported";
    const before = reg.waiting || reg.installing;
    await reg.update();
    const after = reg.waiting || reg.installing;
    if (after && after !== before) return "updated";
    return "current";
  } catch {
    return "unsupported";
  }
}
