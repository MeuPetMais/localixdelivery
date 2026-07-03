import type { OrderState } from "@/lib/orders/OrderStateMachine";

export type OperationsColumnId =
  | "NEW"
  | "WAITING_PAYMENT"
  | "PAID"
  | "ACCEPTED"
  | "PREPARING"
  | "READY"
  | "DELIVERING"
  | "COMPLETED"
  | "CANCELLED";

export type OperationsRole =
  | "ADMIN" | "MANAGER" | "ATTENDANT" | "CASHIER" | "KITCHEN";

export type OperationsPriority = "URGENT" | "NORMAL" | "LOW";
export type DeliveryMode = "DELIVERY" | "PICKUP";

export interface OperationsOrderCard {
  id: string;
  number: string;
  customerName: string;
  customerPhone?: string;
  itemsSummary: string;
  itemsCount: number;
  total: number;
  paymentMethod: string;
  paymentApproved: boolean;
  createdAt: string;
  status: OrderState;
  etaMinutes?: number;
  deliveryMode: DeliveryMode;
  priority: OperationsPriority;
  driverName?: string;
  observations?: string;
  items?: Array<{ id: string; name: string; qty: number; note?: string }>;
}

export interface OperationsFilters {
  today?: boolean;
  pending?: boolean;
  delivery?: DeliveryMode;
  payment?: string;
  priority?: OperationsPriority;
  customer?: string;
  search?: string;
}

export interface OperationsAlert {
  id: string;
  type: "LATE_ORDER" | "PAYMENT_PENDING" | "DRIVER_LATE" | "TIME_EXCEEDED" | "RESTAURANT_CLOSED";
  message: string;
  severity: "info" | "warn" | "critical";
  orderId?: string;
  at: string;
}

export interface OperationsCounters {
  new: number;
  preparing: number;
  delivering: number;
  completedToday: number;
  averagePrepMinutes: number;
}

export interface OperationsMetrics {
  avgPrepMinutes: number;
  avgDeliveryMinutes: number;
  avgTotalMinutes: number;
  cancellations: number;
  ordersPerHour: number;
}
