export type DriverOperationalStatus =
  | "offline"
  | "disponivel"
  | "na_fila"
  | "em_entrega"
  | "retornando"
  | "pausa";

export type DriverOperationalStatusInput = {
  driverStatus?: string | null;
  online?: boolean | null;
  shiftStatus?: string | null;
  shiftCurrentState?: string | null;
  queueStatus?: string | null;
  hasActiveAssignment?: boolean | null;
};

export const DRIVER_OPERATIONAL_STATUS_LABEL: Record<DriverOperationalStatus, string> = {
  offline: "Offline",
  disponivel: "Disponível",
  na_fila: "Na fila",
  em_entrega: "Em entrega",
  retornando: "Retornando",
  pausa: "Pausa",
};

export function getDriverOperationalStatus(
  input: DriverOperationalStatusInput,
): DriverOperationalStatus {
  if (input.hasActiveAssignment) return "em_entrega";
  if (input.queueStatus === "EM_ENTREGA") return "em_entrega";
  if (input.shiftCurrentState === "EM_ENTREGA") return "em_entrega";

  if (input.driverStatus === "afastado") return "pausa";
  if (input.shiftStatus === "PAUSADO") return "pausa";
  if (input.shiftCurrentState === "PAUSA") return "pausa";

  if (input.queueStatus === "RETORNANDO") return "retornando";
  if (input.shiftCurrentState === "RETORNANDO") return "retornando";

  if (!input.online) return "offline";
  if (input.driverStatus && input.driverStatus !== "ativo") return "offline";
  if (input.shiftStatus === "FINALIZADO") return "offline";
  if (input.shiftCurrentState === "OFFLINE") return "offline";

  if (input.queueStatus === "AGUARDANDO") return "na_fila";
  if (input.shiftCurrentState === "AGUARDANDO") return "na_fila";

  return "disponivel";
}
