export const ACTIVE_DELIVERY_ASSIGNMENT_STATUSES = [
  "ATRIBUIDO",
  "COLETANDO",
  "EM_ROTA",
] as const;

export const DELIVERY_DISPATCH_REQUIRED_MESSAGE =
  "Este pedido ainda não possui motoboy designado. Faça o despacho na Central de Entregas.";

export const DELIVERY_ASSIGNMENT_FLOW_REQUIRED_MESSAGE =
  "Pedidos delivery devem sair para entrega e ser concluídos pelo fluxo de delivery_assignments.";

export type DeliveryGuardOrder = {
  address?: string | null;
};

export type DeliveryGuardAssignment = {
  status?: string | null;
} | null;

export function isDeliveryOrder(order: DeliveryGuardOrder): boolean {
  return !!order.address?.trim();
}

export function isActiveDeliveryAssignment(assignment: DeliveryGuardAssignment): boolean {
  return !!assignment?.status && ACTIVE_DELIVERY_ASSIGNMENT_STATUSES.includes(
    assignment.status as (typeof ACTIVE_DELIVERY_ASSIGNMENT_STATUSES)[number],
  );
}

export function validateDirectDeliveryStatusTransition(input: {
  order: DeliveryGuardOrder;
  nextStatus: string;
  assignment: DeliveryGuardAssignment;
}): { ok: true } | { ok: false; message: string; code: string } {
  if (!isDeliveryOrder(input.order)) return { ok: true };
  if (input.nextStatus !== "saiu_para_entrega" && input.nextStatus !== "entregue") {
    return { ok: true };
  }
  if (!isActiveDeliveryAssignment(input.assignment)) {
    return {
      ok: false,
      code: "DELIVERY_ASSIGNMENT_REQUIRED",
      message: DELIVERY_DISPATCH_REQUIRED_MESSAGE,
    };
  }
  return {
    ok: false,
    code: "DELIVERY_ASSIGNMENT_FLOW_REQUIRED",
    message: DELIVERY_ASSIGNMENT_FLOW_REQUIRED_MESSAGE,
  };
}
