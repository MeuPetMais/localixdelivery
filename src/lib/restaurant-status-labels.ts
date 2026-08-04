import type { RestaurantStatus } from "@/lib/restaurant-status";

export function getDashboardStatusLabel(status?: Pick<RestaurantStatus, "isOpen" | "reason"> | null): string {
  if (status?.reason === "manual_closed") return "Fechado manualmente";
  if (status?.reason === "off_schedule") return "Fechado pelo horário";
  if (status?.isOpen) return "Aberto agora";
  return "Fechado";
}

export function getScheduleDayBadgeLabel(enabled: boolean): string {
  return enabled ? "🟢 Dia ativo" : "🔴 Dia desativado";
}

export function getScheduleDaySwitchLabel(enabled: boolean): string {
  return enabled ? "Dia ativo" : "Dia desativado";
}

export function getRestaurantClosedMessage(reason: RestaurantStatus["reason"]): string {
  if (reason === "manual_closed") return "O estabelecimento foi fechado manualmente.";
  if (reason === "off_schedule") return "O estabelecimento está fora do horário de funcionamento.";
  return "O estabelecimento está fechado no momento.";
}
