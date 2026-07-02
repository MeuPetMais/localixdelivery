// Client-side helpers for the admin "dual mode" experience.
// The user's real session is never replaced — we only store a UX preference
// and, optionally, an impersonated restaurant id for administrative viewing.

import { supabase } from "@/integrations/supabase/client";

const LS_ENV = "localix:admin_env"; // "admin" | "partner"
const LS_IMPERSONATE = "localix:impersonate_restaurant_id";

export type AdminEnv = "admin" | "partner";

export function getPreferredEnv(): AdminEnv | null {
  try {
    const v = localStorage.getItem(LS_ENV);
    return v === "admin" || v === "partner" ? v : null;
  } catch {
    return null;
  }
}

export function setPreferredEnv(v: AdminEnv) {
  try { localStorage.setItem(LS_ENV, v); } catch {}
}

export function getImpersonatedRestaurantId(): string | null {
  try { return localStorage.getItem(LS_IMPERSONATE); } catch { return null; }
}

export function setImpersonatedRestaurantId(id: string) {
  try { localStorage.setItem(LS_IMPERSONATE, id); } catch {}
}

export function clearImpersonation() {
  try { localStorage.removeItem(LS_IMPERSONATE); } catch {}
}

export async function isCurrentUserAdmin(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

/**
 * Decides where to send an authenticated user right after login.
 * - Admin + has a partner restaurant → /escolher-ambiente (unless they already
 *   picked a preferred env this browser).
 * - Admin only → /admin.
 * - Everyone else → /dashboard.
 */
export async function resolvePostLoginRedirect(userId: string): Promise<string> {
  const admin = await isCurrentUserAdmin(userId);
  if (!admin) return "/dashboard";

  const { data: restaurants } = await supabase
    .from("restaurants")
    .select("id")
    .eq("owner_id", userId)
    .limit(1);
  const hasPartner = (restaurants?.length ?? 0) > 0;

  const preferred = getPreferredEnv();
  if (preferred === "admin") return "/admin";
  if (preferred === "partner" && hasPartner) return "/dashboard";
  return hasPartner ? "/escolher-ambiente" : "/admin";
}
