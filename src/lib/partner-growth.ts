import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/hooks/use-role";
import { isOrderGrowthEligible } from "@/lib/orders/order-metrics-contract";
import {
  resolvePartnerGrowthAccess,
  type PartnerGrowthAccessState,
  type PartnerGrowthAssignment,
  type PartnerGrowthRestaurant,
} from "@/lib/partner-growth-access";

export type {
  PartnerGrowthAccessState,
  PartnerGrowthAssignment,
  PartnerGrowthRestaurant,
};

type AssignmentRow = {
  id: string;
  restaurant_id: string;
  active: boolean;
  restaurants?: { id: string; name: string } | { id: string; name: string }[] | null;
};

export type PartnerGrowthDashboardPeriod = {
  currentStart: string;
  currentEnd: string;
  previousStart: string;
  previousEnd: string;
};

export type PartnerGrowthDashboardSummary = {
  partnersCount: number;
  currentMonthOrders: number;
  previousPeriodOrders: number;
  variationPercent: number | null;
  partnersWithoutSale7d: number;
  customersWithRealizedSale: number;
  recurringCustomers: number;
  inactive30dCustomers: number;
};

export type PartnerGrowthRestaurantMetric = {
  restaurantId: string;
  name: string;
  currentPeriodOrders: number;
  previousPeriodOrders: number;
  variationPercent: number | null;
  lastRealizedSaleAt: string | null;
  uniqueCustomersWithRealizedSale: number;
  recurringCustomers: number;
  inactive30dCustomers: number;
};

export type PartnerGrowthDashboard = {
  period: PartnerGrowthDashboardPeriod;
  summary: PartnerGrowthDashboardSummary;
  restaurants: PartnerGrowthRestaurantMetric[];
};

export type PartnerGrowthPriorityAlertSignal =
  | "SEM_VENDA_7D"
  | "QUEDA_PEDIDOS"
  | "CLIENTES_INATIVOS_30D"
  | "BAIXA_RECORRENCIA"
  | "BOA_EVOLUCAO";

export type PartnerGrowthPriorityAlertType = "ALERTA" | "OPORTUNIDADE";

export type PartnerGrowthPriorityAlertPriority = "ALTA" | "MEDIA" | "BAIXA";

export type PartnerGrowthTaskPriority = "ALTA" | "MEDIA" | "BAIXA";

export type PartnerGrowthTaskStatus =
  | "PENDENTE"
  | "EM_ANDAMENTO"
  | "CONCLUIDA"
  | "DESCARTADA";

export type PartnerGrowthTaskSourceSignal =
  | "SEM_VENDA_7D"
  | "QUEDA_PEDIDOS"
  | "CLIENTES_INATIVOS_30D"
  | "BOA_EVOLUCAO";

export type PartnerGrowthPriorityAlert = {
  restaurantId: string;
  restaurantName: string;
  signal: PartnerGrowthPriorityAlertSignal;
  type: PartnerGrowthPriorityAlertType;
  priority: PartnerGrowthPriorityAlertPriority;
  reason: string;
  suggestedAction: string;
  metricValue: number | null;
};

export type PartnerGrowthTask = {
  id: string;
  restaurantId: string;
  restaurantName: string;
  assignedTo: string;
  createdBy: string;
  sourceSignal: PartnerGrowthTaskSourceSignal | null;
  title: string;
  notes: string | null;
  priority: PartnerGrowthTaskPriority;
  status: PartnerGrowthTaskStatus;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreatePartnerGrowthTaskInput = {
  restaurantId: string;
  sourceSignal: PartnerGrowthTaskSourceSignal | null;
  title: string;
  notes: string | null;
  priority: PartnerGrowthTaskPriority;
  dueAt: string | null;
};

type PartnerGrowthDashboardRpc = {
  period?: {
    current_start?: string;
    current_end?: string;
    previous_start?: string;
    previous_end?: string;
  };
  summary?: {
    partners_count?: number;
    current_month_orders?: number;
    previous_period_orders?: number;
    variation_percent?: number | null;
    partners_without_sale_7d?: number;
    customers_with_realized_sale?: number;
    recurring_customers?: number;
    inactive_30d_customers?: number;
  };
  restaurants?: Array<{
    restaurant_id?: string;
    name?: string;
    current_period_orders?: number;
    previous_period_orders?: number;
    variation_percent?: number | null;
    last_realized_sale_at?: string | null;
    unique_customers_with_realized_sale?: number;
    recurring_customers?: number;
    inactive_30d_customers?: number;
  }>;
};

type PartnerGrowthPriorityAlertsRpc = {
  alerts?: Array<{
    restaurantId?: string;
    restaurantName?: string;
    signal?: PartnerGrowthPriorityAlertSignal;
    type?: PartnerGrowthPriorityAlertType;
    priority?: PartnerGrowthPriorityAlertPriority;
    reason?: string;
    suggestedAction?: string;
    metricValue?: number | null;
  }>;
};

type PartnerGrowthTaskRow = {
  id: string;
  restaurant_id: string;
  assigned_to: string;
  created_by: string;
  source_signal: PartnerGrowthTaskSourceSignal | null;
  title: string;
  notes: string | null;
  priority: PartnerGrowthTaskPriority;
  status: PartnerGrowthTaskStatus;
  due_at: string | null;
  created_at: string;
  updated_at: string;
  restaurants?: { id: string; name: string } | { id: string; name: string }[] | null;
};

function normalizeRestaurant(
  restaurant: AssignmentRow["restaurants"],
): PartnerGrowthRestaurant | null {
  const value = Array.isArray(restaurant) ? restaurant[0] : restaurant;
  if (!value?.id) return null;
  return {
    id: value.id,
    name: value.name,
  };
}

function toNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function calculatePartnerGrowthVariation(
  currentPeriodOrders: number,
  previousPeriodOrders: number,
): number | null {
  if (previousPeriodOrders === 0 && currentPeriodOrders === 0) return 0;
  if (previousPeriodOrders === 0) return null;
  return Math.round(((currentPeriodOrders - previousPeriodOrders) / previousPeriodOrders) * 10000) / 100;
}

export function countsAsPartnerGrowthRealizedSale(status: unknown): boolean {
  return isOrderGrowthEligible(status);
}

export function normalizePartnerGrowthDashboard(
  payload: PartnerGrowthDashboardRpc,
): PartnerGrowthDashboard {
  const period = payload.period ?? {};
  const summary = payload.summary ?? {};

  return {
    period: {
      currentStart: period.current_start ?? "",
      currentEnd: period.current_end ?? "",
      previousStart: period.previous_start ?? "",
      previousEnd: period.previous_end ?? "",
    },
    summary: {
      partnersCount: toNumber(summary.partners_count),
      currentMonthOrders: toNumber(summary.current_month_orders),
      previousPeriodOrders: toNumber(summary.previous_period_orders),
      variationPercent: toNullableNumber(summary.variation_percent),
      partnersWithoutSale7d: toNumber(summary.partners_without_sale_7d),
      customersWithRealizedSale: toNumber(summary.customers_with_realized_sale),
      recurringCustomers: toNumber(summary.recurring_customers),
      inactive30dCustomers: toNumber(summary.inactive_30d_customers),
    },
    restaurants: (payload.restaurants ?? []).map((restaurant) => ({
      restaurantId: restaurant.restaurant_id ?? "",
      name: restaurant.name ?? "Restaurante indisponivel",
      currentPeriodOrders: toNumber(restaurant.current_period_orders),
      previousPeriodOrders: toNumber(restaurant.previous_period_orders),
      variationPercent: toNullableNumber(restaurant.variation_percent),
      lastRealizedSaleAt: restaurant.last_realized_sale_at ?? null,
      uniqueCustomersWithRealizedSale: toNumber(restaurant.unique_customers_with_realized_sale),
      recurringCustomers: toNumber(restaurant.recurring_customers),
      inactive30dCustomers: toNumber(restaurant.inactive_30d_customers),
    })),
  };
}

export function normalizePartnerGrowthPriorityAlerts(
  payload: PartnerGrowthPriorityAlertsRpc,
): PartnerGrowthPriorityAlert[] {
  return (payload.alerts ?? []).map((alert) => ({
    restaurantId: alert.restaurantId ?? "",
    restaurantName: alert.restaurantName ?? "Restaurante indisponivel",
    signal: alert.signal ?? "SEM_VENDA_7D",
    type: alert.type ?? "ALERTA",
    priority: alert.priority ?? "BAIXA",
    reason: alert.reason ?? "Sinal indisponivel",
    suggestedAction: alert.suggestedAction ?? "Revisar carteira",
    metricValue: toNullableNumber(alert.metricValue),
  }));
}

function normalizePartnerGrowthTask(row: PartnerGrowthTaskRow): PartnerGrowthTask {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    restaurantName: normalizeRestaurant(row.restaurants)?.name ?? "Restaurante indisponivel",
    assignedTo: row.assigned_to,
    createdBy: row.created_by,
    sourceSignal: row.source_signal,
    title: row.title,
    notes: row.notes,
    priority: row.priority,
    status: row.status,
    dueAt: row.due_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function priorityRank(priority: PartnerGrowthTaskPriority): number {
  return { ALTA: 1, MEDIA: 2, BAIXA: 3 }[priority];
}

function isOpenTask(status: PartnerGrowthTaskStatus): boolean {
  return status === "PENDENTE" || status === "EM_ANDAMENTO";
}

export function sortPartnerGrowthTasks(
  tasks: PartnerGrowthTask[],
  now: Date = new Date(),
): PartnerGrowthTask[] {
  const nowMs = now.getTime();

  return [...tasks].sort((a, b) => {
    const aOpen = isOpenTask(a.status);
    const bOpen = isOpenTask(b.status);
    if (aOpen !== bOpen) return aOpen ? -1 : 1;

    const aOverdue = aOpen && a.dueAt ? new Date(a.dueAt).getTime() < nowMs : false;
    const bOverdue = bOpen && b.dueAt ? new Date(b.dueAt).getTime() < nowMs : false;
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;

    const priorityDiff = priorityRank(a.priority) - priorityRank(b.priority);
    if (priorityDiff !== 0) return priorityDiff;

    const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY;
    const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY;
    if (aDue !== bDue) return aDue - bDue;

    return a.createdAt.localeCompare(b.createdAt);
  });
}

export async function loadPartnerGrowthDashboard(): Promise<PartnerGrowthDashboard> {
  const { data, error } = await (supabase.rpc("get_partner_growth_dashboard" as any) as any);
  if (error) throw error;
  return normalizePartnerGrowthDashboard((data ?? {}) as PartnerGrowthDashboardRpc);
}

export async function loadPartnerGrowthPriorityAlerts(): Promise<PartnerGrowthPriorityAlert[]> {
  const { data, error } = await (supabase.rpc("get_partner_growth_priority_alerts" as any) as any);
  if (error) throw error;
  return normalizePartnerGrowthPriorityAlerts((data ?? {}) as PartnerGrowthPriorityAlertsRpc);
}

export async function loadPartnerGrowthTasks(): Promise<PartnerGrowthTask[]> {
  const { data, error } = await (supabase.from("partner_growth_tasks" as any) as any)
    .select(
      "id, restaurant_id, assigned_to, created_by, source_signal, title, notes, priority, status, due_at, created_at, updated_at, restaurants(id, name)",
    );
  if (error) throw error;
  return sortPartnerGrowthTasks(((data ?? []) as PartnerGrowthTaskRow[]).map(normalizePartnerGrowthTask));
}

export async function createPartnerGrowthTask(
  input: CreatePartnerGrowthTaskInput,
  userId: string,
): Promise<PartnerGrowthTask> {
  const { data, error } = await (supabase.from("partner_growth_tasks" as any) as any)
    .insert({
      restaurant_id: input.restaurantId,
      assigned_to: userId,
      created_by: userId,
      source_signal: input.sourceSignal,
      title: input.title,
      notes: input.notes,
      priority: input.priority,
      status: "PENDENTE",
      due_at: input.dueAt,
    })
    .select(
      "id, restaurant_id, assigned_to, created_by, source_signal, title, notes, priority, status, due_at, created_at, updated_at, restaurants(id, name)",
    )
    .single();
  if (error) throw error;
  return normalizePartnerGrowthTask(data as PartnerGrowthTaskRow);
}

export async function updatePartnerGrowthTaskStatus(
  taskId: string,
  status: PartnerGrowthTaskStatus,
): Promise<PartnerGrowthTask> {
  const { data, error } = await (supabase.from("partner_growth_tasks" as any) as any)
    .update({ status })
    .eq("id", taskId)
    .select(
      "id, restaurant_id, assigned_to, created_by, source_signal, title, notes, priority, status, due_at, created_at, updated_at, restaurants(id, name)",
    )
    .single();
  if (error) throw error;
  return normalizePartnerGrowthTask(data as PartnerGrowthTaskRow);
}

export async function loadPartnerGrowthPortfolio(userId: string): Promise<{
  userId: string;
  roles: AppRole[];
  assignments: PartnerGrowthAssignment[];
  access: PartnerGrowthAccessState;
}> {
  const { data: rolesData, error: rolesError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (rolesError) throw rolesError;

  const roles = (rolesData ?? []).map((row) => row.role as AppRole);

  const { data: assignmentsData, error: assignmentsError } = await (
    supabase.from("partner_growth_assignments" as any) as any
  )
    .select("id, restaurant_id, active, restaurants(id, name)")
    .eq("user_id", userId)
    .order("active", { ascending: false })
    .order("assigned_at", { ascending: true });
  if (assignmentsError) throw assignmentsError;

  const assignments = ((assignmentsData ?? []) as AssignmentRow[]).map((assignment) => ({
    id: assignment.id,
    restaurantId: assignment.restaurant_id,
    active: assignment.active,
    restaurant: normalizeRestaurant(assignment.restaurants),
  }));

  return {
    userId,
    roles,
    assignments,
    access: resolvePartnerGrowthAccess({ userId, roles, assignments }),
  };
}
