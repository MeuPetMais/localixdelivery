/**
 * Web Push scaffold.
 *
 * Preparado para VAPID + Edge Function futura.
 * - Registra o Service Worker dedicado (`/push-sw.js`) — separado do
 *   kill-switch de PWA em `/sw.js`.
 * - Solicita permissão SOMENTE quando `ensurePushPermission()` é chamado
 *   por um gesto do usuário (ex.: após finalizar pedido, aceitar CTA).
 * - Persiste a subscription em `push_subscriptions` (RLS por user_id).
 *
 * Uso mínimo:
 *   const ok = await enablePush({ role: "owner", restaurantId });
 */

import { supabase } from "@/integrations/supabase/client";

const SW_URL = "/push-sw.js";
const SW_SCOPE = "/push/";

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Chave pública VAPID — configurada em build/env quando disponível. */
function getVapidPublicKey(): string | null {
  return (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) || null;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}

export async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration(SW_SCOPE);
    if (existing) return existing;
    return await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
  } catch (err) {
    console.warn("[push] SW register failed", err);
    return null;
  }
}

export async function ensurePushPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) return "denied";
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export async function savePushSubscription(input: {
  subscription: PushSubscription;
  role?: "owner" | "customer" | string;
  restaurantId?: string | null;
}) {
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) return { ok: false, reason: "no_user" as const };

  const raw = input.subscription.toJSON();
  if (!raw.endpoint || !raw.keys?.p256dh || !raw.keys?.auth) {
    return { ok: false, reason: "invalid_subscription" as const };
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      restaurant_id: input.restaurantId ?? null,
      role: input.role ?? "customer",
      endpoint: raw.endpoint,
      p256dh: raw.keys.p256dh,
      auth: raw.keys.auth,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    },
    { onConflict: "user_id,endpoint" },
  );

  if (error) return { ok: false, reason: "db_error" as const, error };
  return { ok: true as const };
}

export async function removePushSubscription(endpoint: string) {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return;
  await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userRes.user.id)
    .eq("endpoint", endpoint);
}

/**
 * Fluxo completo: registra SW, pede permissão, cria/renova subscription
 * e persiste no banco. Retorna `false` se faltar VAPID ou permissão.
 */
export async function enablePush(opts: {
  role?: "owner" | "customer" | string;
  restaurantId?: string | null;
}): Promise<boolean> {
  if (!isPushSupported()) return false;
  const vapid = getVapidPublicKey();
  if (!vapid) {
    console.info("[push] VITE_VAPID_PUBLIC_KEY ausente — scaffold pronto, aguardando chaves.");
    return false;
  }
  const perm = await ensurePushPermission();
  if (perm !== "granted") return false;

  const reg = await registerPushServiceWorker();
  if (!reg) return false;

  try {
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid),
      });
    }
    const res = await savePushSubscription({
      subscription: sub,
      role: opts.role,
      restaurantId: opts.restaurantId ?? null,
    });
    return res.ok;
  } catch (err) {
    console.warn("[push] subscribe failed", err);
    return false;
  }
}

export async function disablePush(): Promise<boolean> {
  if (!isPushSupported()) return false;
  const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    try {
      await removePushSubscription(sub.endpoint);
    } catch {}
    await sub.unsubscribe().catch(() => {});
  }
  return true;
}
