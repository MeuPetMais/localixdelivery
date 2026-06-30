/**
 * Single source of truth for "profile completion" of a restaurant.
 * Used by the Dashboard banner AND the Settings page so percentages
 * and pending lists never diverge.
 */

export type ProfileCheck = {
  key: string;
  label: string;
  emoji: string;
  done: boolean;
};

export type ProfileCompletion = {
  pct: number;
  completed: number;
  total: number;
  checks: ProfileCheck[];
  pending: ProfileCheck[];
  isComplete: boolean;
};

function hasAnyPayment(pm: unknown): boolean {
  if (!pm || typeof pm !== "object") return false;
  return Object.values(pm as Record<string, unknown>).some((v) => v === true);
}

function hasAnyEnabledHour(oh: unknown): boolean {
  if (!oh || typeof oh !== "object") return false;
  return Object.values(oh as Record<string, any>).some(
    (h) => h && typeof h === "object" && h.enabled === true,
  );
}

export function getProfileCompletion(restaurant: any | null | undefined): ProfileCompletion {
  const r = restaurant ?? {};

  const checks: ProfileCheck[] = [
    { key: "logo", emoji: "📷", label: "Logo", done: !!r.logo_url },
    { key: "cover", emoji: "🖼️", label: "Capa", done: !!r.cover_url },
    { key: "description", emoji: "📝", label: "Descrição", done: !!r.description },
    { key: "whatsapp", emoji: "📱", label: "WhatsApp", done: !!r.whatsapp_phone },
    {
      key: "address",
      emoji: "📍",
      label: "Endereço completo",
      done: !!(r.address && r.city && r.state),
    },
    { key: "delivery_time", emoji: "🚚", label: "Tempo de entrega", done: !!r.delivery_time },
    { key: "payments", emoji: "💳", label: "Pagamentos", done: hasAnyPayment(r.payment_methods) },
    { key: "hours", emoji: "🕒", label: "Horários", done: hasAnyEnabledHour(r.opening_hours) },
    {
      key: "social",
      emoji: "🌐",
      label: "Redes sociais",
      done: !!(r.instagram || r.facebook || r.website),
    },
  ];

  const completed = checks.filter((c) => c.done).length;
  const total = checks.length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  const pending = checks.filter((c) => !c.done);

  return { pct, completed, total, checks, pending, isComplete: completed === total };
}
