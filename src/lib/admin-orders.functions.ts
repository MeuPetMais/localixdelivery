import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ORDER_STATUSES = [
  "novo",
  "aguardando_pagamento",
  "pago",
  "falha_pagamento",
  "aceito",
  "rejeitado",
  "em_preparo",
  "pronto",
  "saiu_para_entrega",
  "entregue",
  "concluido",
  "cancelado",
  "reembolsado",
  "chargeback",
] as const;

const PAYMENT_APPROVED = new Set(["APPROVED", "approved", "COMPLETED", "completed", "paid"]);
const PAYMENT_REQUIRED_ORDER_STATUSES = new Set([
  "pago",
  "aceito",
  "em_preparo",
  "pronto",
  "saiu_para_entrega",
  "entregue",
  "concluido",
]);
const DELIVERY_REQUIRED_ORDER_STATUSES = new Set(["saiu_para_entrega", "entregue", "concluido"]);

const listInputSchema = z.object({
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  status: z.string().optional(),
  restaurantId: z.string().uuid().optional(),
  paymentMethod: z.string().optional(),
  paymentStatus: z.string().optional(),
  search: z.string().optional(),
});

const detailInputSchema = z.object({
  orderId: z.string().uuid(),
});

export type AdminOrderAlertCode =
  | "MISSING_PRICING_SNAPSHOT"
  | "STATUS_HISTORY_MISMATCH"
  | "MISSING_APPROVED_PAYMENT"
  | "MISSING_DELIVERY_ASSIGNMENT";

export type AdminOrderAlert = {
  code: AdminOrderAlertCode;
  label: string;
  severity: "warning" | "error";
};

export type AdminOrderListItem = {
  id: string;
  order_number: number | null;
  created_at: string;
  restaurant: { id: string; name: string | null };
  customer: { name: string | null; phoneMasked: string | null };
  status: string;
  payment_method: string | null;
  payment_status: string | null;
  customer_total: number | null;
  financialSnapshotAvailable: boolean;
  alerts: AdminOrderAlert[];
};

export type AdminOrdersResult = {
  page: number;
  pageSize: number;
  total: number | null;
  rows: AdminOrderListItem[];
};

export type AdminOrderDetail = {
  id: string;
  order_number: number | null;
  created_at: string;
  status: string;
  items: unknown[];
  restaurant: { id: string; name: string | null };
  customer: {
    name: string | null;
    phone: string | null;
    address: string | null;
    notes: string | null;
  };
  payment_method: string | null;
  financialSnapshotAvailable: boolean;
  financial: {
    subtotal: number | null;
    delivery_fee: number | null;
    platform_fee: number | null;
    service_fee_payer: string | null;
    coupon_discount: number | null;
    cashback: number | null;
    loyalty_discount: number | null;
    customer_total: number | null;
    restaurant_gross: number | null;
    restaurant_net: number | null;
    platform_revenue: number | null;
    realized_platform_revenue: number | null;
    gateway_fee: number | null;
    provider: string | null;
    currency: string | null;
  } | null;
  payment: {
    method: string | null;
    provider: string | null;
    status: string | null;
    internal_payment_id: string | null;
    provider_reference: string | null;
    created_at: string | null;
    updated_at: string | null;
    paid_at: string | null;
  } | null;
  delivery: {
    status: string | null;
    driver: { id: string; name: string | null } | null;
    assigned_at: string | null;
    picked_up_at: string | null;
    departed_at: string | null;
    delivered_at: string | null;
    distance_km: number | null;
  } | null;
  timeline: Array<{
    id: string;
    previous_status: string | null;
    current_status: string;
    reason: string | null;
    actor_type: string | null;
    created_at: string;
  }>;
  alerts: AdminOrderAlert[];
};

type AdminOrderFilters = z.infer<typeof listInputSchema>;

type OrderRow = {
  id: string;
  order_number: number | null;
  created_at: string;
  restaurant_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  address: string | null;
  payment_method: string | null;
  status: string;
  items?: unknown;
};

type SnapshotRow = {
  order_id: string;
  subtotal?: number | string | null;
  delivery_fee?: number | string | null;
  platform_fee?: number | string | null;
  service_fee_payer?: string | null;
  coupon_discount?: number | string | null;
  cashback?: number | string | null;
  loyalty_discount?: number | string | null;
  customer_total?: number | string | null;
  restaurant_gross?: number | string | null;
  restaurant_net?: number | string | null;
  platform_revenue?: number | string | null;
  realized_platform_revenue?: number | string | null;
  gateway_fee?: number | string | null;
  provider?: string | null;
  currency?: string | null;
};

type PaymentRow = {
  order_id: string;
  id?: string | null;
  provider?: string | null;
  payment_method?: string | null;
  method?: string | null;
  status?: string | null;
  payment_id?: string | null;
  payment_intent?: string | null;
  external_reference?: string | null;
  external_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  paid_at?: string | null;
};

type HistoryRow = {
  id: string;
  order_id: string;
  previous_status: string | null;
  current_status: string;
  reason: string | null;
  performed_by_type: string | null;
  created_at: string;
};

type DeliveryRow = {
  order_id: string;
  driver_id: string | null;
  status: string | null;
  assigned_at: string | null;
  picked_up_at: string | null;
  departed_at: string | null;
  delivered_at: string | null;
  distance_km: number | string | null;
};

export function normalizeAdminOrderPagination(input: AdminOrderFilters) {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 25));
  const from = (page - 1) * pageSize;
  return { page, pageSize, from, to: from + pageSize - 1 };
}

export function maskAdminOrderPhone(phone: string | null | undefined) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const tail = digits.slice(-4).padStart(4, "*");
  return `(**) *****-${tail}`;
}

export function maskProviderReference(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (raw.length <= 6) return "***";
  return `${raw.slice(0, 3)}...${raw.slice(-3)}`;
}

export function buildAdminOrderAlerts(input: {
  status: string;
  hasSnapshot: boolean;
  latestHistoryStatus?: string | null;
  paymentStatus?: string | null;
  hasPaymentRecord: boolean;
  requiresDelivery: boolean;
  hasDeliveryAssignment: boolean;
}): AdminOrderAlert[] {
  const alerts: AdminOrderAlert[] = [];

  if (!input.hasSnapshot) {
    alerts.push({
      code: "MISSING_PRICING_SNAPSHOT",
      label: "Snapshot financeiro indisponivel",
      severity: "warning",
    });
  }

  if (input.latestHistoryStatus && input.latestHistoryStatus !== input.status) {
    alerts.push({
      code: "STATUS_HISTORY_MISMATCH",
      label: "Status difere do ultimo historico",
      severity: "error",
    });
  }

  if (
    PAYMENT_REQUIRED_ORDER_STATUSES.has(input.status) &&
    (!input.hasPaymentRecord || !PAYMENT_APPROVED.has(String(input.paymentStatus ?? "")))
  ) {
    alerts.push({
      code: "MISSING_APPROVED_PAYMENT",
      label: "Pagamento aprovado nao comprovado",
      severity: "error",
    });
  }

  if (input.requiresDelivery && !input.hasDeliveryAssignment) {
    alerts.push({
      code: "MISSING_DELIVERY_ASSIGNMENT",
      label: "Entrega sem assignment comprovado",
      severity: "warning",
    });
  }

  return alerts;
}

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
  return supabaseAdmin;
}

function money(value: number | string | null | undefined) {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isBlank(value: string | null | undefined) {
  return !String(value ?? "").trim();
}

function cleanFilter(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  return trimmed && trimmed !== "all" ? trimmed : undefined;
}

function escapePostgrestPattern(value: string) {
  return value.replace(/[%_,]/g, "\\$&");
}

async function findRestaurantIdsByName(supabaseAdmin: any, search: string) {
  const pattern = `%${escapePostgrestPattern(search)}%`;
  const { data, error } = await supabaseAdmin
    .from("restaurants")
    .select("id")
    .ilike("name", pattern)
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: { id: string }) => row.id);
}

async function findOrderIdsByPaymentStatus(supabaseAdmin: any, paymentStatus: string) {
  const { data, error } = await supabaseAdmin
    .from("order_payment")
    .select("order_id")
    .eq("status", paymentStatus)
    .limit(10000);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: { order_id: string }) => row.order_id);
}

function byOrderId<T extends { order_id: string }>(rows: T[] | null | undefined) {
  const map = new Map<string, T>();
  for (const row of rows ?? []) {
    if (!map.has(row.order_id)) map.set(row.order_id, row);
  }
  return map;
}

async function loadPageRelations(supabaseAdmin: any, orders: OrderRow[]) {
  const orderIds = orders.map((order) => order.id);
  const restaurantIds = Array.from(new Set(orders.map((order) => order.restaurant_id)));
  if (!orderIds.length) {
    return {
      restaurants: new Map<string, { id: string; name: string | null }>(),
      snapshots: new Map<string, SnapshotRow>(),
      orderPayments: new Map<string, PaymentRow>(),
      payments: new Map<string, PaymentRow>(),
      history: new Map<string, HistoryRow>(),
      delivery: new Map<string, DeliveryRow>(),
    };
  }

  const [restaurantsQ, snapshotsQ, orderPaymentsQ, paymentsQ, historyQ, deliveryQ] =
    await Promise.all([
      supabaseAdmin.from("restaurants").select("id, name").in("id", restaurantIds),
      supabaseAdmin.from("order_pricing_snapshot").select("*").in("order_id", orderIds),
      supabaseAdmin.from("order_payment").select(
        "order_id, provider, payment_method, status, payment_id, payment_intent, external_reference, created_at, updated_at",
      ).in("order_id", orderIds),
      supabaseAdmin.from("payments").select(
        "order_id, id, provider, method, status, external_id, created_at, updated_at, paid_at",
      ).in("order_id", orderIds),
      supabaseAdmin.from("order_status_history").select(
        "id, order_id, previous_status, current_status, reason, performed_by_type, created_at",
      ).in("order_id", orderIds).order("created_at", { ascending: false }).order("id", { ascending: false }),
      supabaseAdmin.from("delivery_assignments").select(
        "order_id, driver_id, status, assigned_at, picked_up_at, departed_at, delivered_at, distance_km",
      ).in("order_id", orderIds),
    ]);

  for (const result of [restaurantsQ, snapshotsQ, orderPaymentsQ, paymentsQ, historyQ, deliveryQ]) {
    if (result.error) throw new Error(result.error.message);
  }

  return {
    restaurants: new Map(
      ((restaurantsQ.data ?? []) as Array<{ id: string; name: string | null }>).map((row) => [
        row.id,
        row,
      ]),
    ),
    snapshots: byOrderId((snapshotsQ.data ?? []) as SnapshotRow[]),
    orderPayments: byOrderId((orderPaymentsQ.data ?? []) as PaymentRow[]),
    payments: byOrderId((paymentsQ.data ?? []) as PaymentRow[]),
    history: byOrderId((historyQ.data ?? []) as HistoryRow[]),
    delivery: byOrderId((deliveryQ.data ?? []) as DeliveryRow[]),
  };
}

function paymentForOrder(orderId: string, orderPayments: Map<string, PaymentRow>, payments: Map<string, PaymentRow>) {
  return orderPayments.get(orderId) ?? payments.get(orderId) ?? null;
}

export const getAdminOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => listInputSchema.parse(raw ?? {}))
  .handler(async ({ context, data }): Promise<AdminOrdersResult> => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const filters = data as AdminOrderFilters;
    const { page, pageSize, from, to } = normalizeAdminOrderPagination(filters);

    const paymentStatus = cleanFilter(filters.paymentStatus);
    let paymentOrderIds: string[] | null = null;
    if (paymentStatus) {
      paymentOrderIds = await findOrderIdsByPaymentStatus(supabaseAdmin, paymentStatus);
      if (paymentOrderIds.length === 0) return { page, pageSize, total: 0, rows: [] };
    }

    let query = supabaseAdmin
      .from("orders")
      .select(
        "id, order_number, created_at, restaurant_id, customer_name, customer_phone, address, payment_method, status",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(from, to);

    if (filters.from) query = query.gte("created_at", `${filters.from}T00:00:00.000Z`);
    if (filters.to) query = query.lte("created_at", `${filters.to}T23:59:59.999Z`);
    const status = cleanFilter(filters.status);
    if (status && (ORDER_STATUSES as readonly string[]).includes(status)) query = query.eq("status", status);
    if (filters.restaurantId) query = query.eq("restaurant_id", filters.restaurantId);
    const paymentMethod = cleanFilter(filters.paymentMethod);
    if (paymentMethod) query = query.eq("payment_method", paymentMethod);
    if (paymentOrderIds) query = query.in("id", paymentOrderIds);

    const search = cleanFilter(filters.search);
    if (search) {
      const clauses = [`customer_name.ilike.%${escapePostgrestPattern(search)}%`];
      const asNumber = Number(search.replace(/\D/g, ""));
      if (Number.isInteger(asNumber) && asNumber > 0) clauses.push(`order_number.eq.${asNumber}`);
      const restaurantIds = await findRestaurantIdsByName(supabaseAdmin, search);
      if (restaurantIds.length > 0) clauses.push(`restaurant_id.in.(${restaurantIds.join(",")})`);
      query = query.or(clauses.join(","));
    }

    const { data: orders, error, count } = await query;
    if (error) throw new Error(error.message);

    const rows = ((orders ?? []) as OrderRow[]);
    const relations = await loadPageRelations(supabaseAdmin, rows);

    return {
      page,
      pageSize,
      total: count ?? null,
      rows: rows.map((order) => {
        const snapshot = relations.snapshots.get(order.id) ?? null;
        const payment = paymentForOrder(order.id, relations.orderPayments, relations.payments);
        const latestHistory = relations.history.get(order.id) ?? null;
        const delivery = relations.delivery.get(order.id) ?? null;
        const requiresDelivery =
          DELIVERY_REQUIRED_ORDER_STATUSES.has(order.status) && !isBlank(order.address);

        return {
          id: order.id,
          order_number: order.order_number,
          created_at: order.created_at,
          restaurant: relations.restaurants.get(order.restaurant_id) ?? {
            id: order.restaurant_id,
            name: null,
          },
          customer: {
            name: order.customer_name,
            phoneMasked: maskAdminOrderPhone(order.customer_phone),
          },
          status: order.status,
          payment_method: payment?.payment_method ?? payment?.method ?? order.payment_method,
          payment_status: payment?.status ?? null,
          customer_total: snapshot ? money(snapshot.customer_total) : null,
          financialSnapshotAvailable: Boolean(snapshot),
          alerts: buildAdminOrderAlerts({
            status: order.status,
            hasSnapshot: Boolean(snapshot),
            latestHistoryStatus: latestHistory?.current_status ?? null,
            paymentStatus: payment?.status ?? null,
            hasPaymentRecord: Boolean(payment),
            requiresDelivery,
            hasDeliveryAssignment: Boolean(delivery),
          }),
        };
      }),
    };
  });

export const getAdminOrderDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => detailInputSchema.parse(raw))
  .handler(async ({ context, data }): Promise<AdminOrderDetail> => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const { orderId } = data;

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select(
        "id, order_number, created_at, restaurant_id, customer_name, customer_phone, address, payment_method, status, items",
      )
      .eq("id", orderId)
      .maybeSingle();
    if (orderError) throw new Error(orderError.message);
    if (!order) throw new Error("ORDER_NOT_FOUND");
    const orderRow = order as OrderRow;

    const [restaurantQ, snapshotQ, orderPaymentQ, paymentQ, timelineQ, deliveryQ] =
      await Promise.all([
        supabaseAdmin.from("restaurants").select("id, name").eq("id", orderRow.restaurant_id).maybeSingle(),
        supabaseAdmin.from("order_pricing_snapshot").select("*").eq("order_id", orderId).maybeSingle(),
        supabaseAdmin.from("order_payment").select(
          "order_id, provider, payment_method, status, payment_id, payment_intent, external_reference, created_at, updated_at",
        ).eq("order_id", orderId).maybeSingle(),
        supabaseAdmin.from("payments").select(
          "order_id, id, provider, method, status, external_id, created_at, updated_at, paid_at",
        ).eq("order_id", orderId).order("updated_at", { ascending: false }).limit(1),
        supabaseAdmin.from("order_status_history").select(
          "id, order_id, previous_status, current_status, reason, performed_by_type, created_at",
        ).eq("order_id", orderId).order("created_at", { ascending: true }).order("id", { ascending: true }),
        supabaseAdmin.from("delivery_assignments").select(
          "order_id, driver_id, status, assigned_at, picked_up_at, departed_at, delivered_at, distance_km",
        ).eq("order_id", orderId).maybeSingle(),
      ]);

    for (const result of [restaurantQ, snapshotQ, orderPaymentQ, paymentQ, timelineQ, deliveryQ]) {
      if (result.error) throw new Error(result.error.message);
    }

    const snapshot = snapshotQ.data as SnapshotRow | null;
    const orderPayment = orderPaymentQ.data as PaymentRow | null;
    const paymentFallback = ((paymentQ.data ?? []) as PaymentRow[])[0] ?? null;
    const payment = orderPayment ?? paymentFallback;
    const timeline = (timelineQ.data ?? []) as HistoryRow[];
    const delivery = deliveryQ.data as DeliveryRow | null;

    let driver: { id: string; name: string | null } | null = null;
    if (delivery?.driver_id) {
      const { data: driverRow, error: driverError } = await supabaseAdmin
        .from("delivery_drivers")
        .select("id, name")
        .eq("id", delivery.driver_id)
        .maybeSingle();
      if (driverError) throw new Error(driverError.message);
      driver = driverRow ? { id: driverRow.id, name: driverRow.name ?? null } : null;
    }

    const latestHistory = timeline[timeline.length - 1] ?? null;
    const requiresDelivery =
      DELIVERY_REQUIRED_ORDER_STATUSES.has(orderRow.status) && !isBlank(orderRow.address);
    const alerts = buildAdminOrderAlerts({
      status: orderRow.status,
      hasSnapshot: Boolean(snapshot),
      latestHistoryStatus: latestHistory?.current_status ?? null,
      paymentStatus: payment?.status ?? null,
      hasPaymentRecord: Boolean(payment),
      requiresDelivery,
      hasDeliveryAssignment: Boolean(delivery),
    });

    return {
      id: orderRow.id,
      order_number: orderRow.order_number,
      created_at: orderRow.created_at,
      status: orderRow.status,
      items: Array.isArray(orderRow.items) ? orderRow.items : [],
      restaurant: (restaurantQ.data as { id: string; name: string | null } | null) ?? {
        id: orderRow.restaurant_id,
        name: null,
      },
      customer: {
        name: orderRow.customer_name,
        phone: maskAdminOrderPhone(orderRow.customer_phone),
        address: orderRow.address,
        notes: null,
      },
      payment_method: payment?.payment_method ?? payment?.method ?? orderRow.payment_method,
      financialSnapshotAvailable: Boolean(snapshot),
      financial: snapshot
        ? {
            subtotal: money(snapshot.subtotal),
            delivery_fee: money(snapshot.delivery_fee),
            platform_fee: money(snapshot.platform_fee),
            service_fee_payer: snapshot.service_fee_payer ?? null,
            coupon_discount: money(snapshot.coupon_discount),
            cashback: money(snapshot.cashback),
            loyalty_discount: money(snapshot.loyalty_discount),
            customer_total: money(snapshot.customer_total),
            restaurant_gross: money(snapshot.restaurant_gross),
            restaurant_net: money(snapshot.restaurant_net),
            platform_revenue: money(snapshot.platform_revenue),
            realized_platform_revenue: money(snapshot.realized_platform_revenue),
            gateway_fee: money(snapshot.gateway_fee),
            provider: snapshot.provider ?? null,
            currency: snapshot.currency ?? null,
          }
        : null,
      payment: payment
        ? {
            method: payment.payment_method ?? payment.method ?? null,
            provider: payment.provider ?? null,
            status: payment.status ?? null,
            internal_payment_id: payment.id ?? null,
            provider_reference: maskProviderReference(
              payment.payment_id ?? payment.external_id ?? payment.payment_intent ?? payment.external_reference,
            ),
            created_at: payment.created_at ?? null,
            updated_at: payment.updated_at ?? null,
            paid_at: payment.paid_at ?? null,
          }
        : null,
      delivery: delivery
        ? {
            status: delivery.status,
            driver,
            assigned_at: delivery.assigned_at,
            picked_up_at: delivery.picked_up_at,
            departed_at: delivery.departed_at,
            delivered_at: delivery.delivered_at,
            distance_km: money(delivery.distance_km),
          }
        : null,
      timeline: timeline.map((entry) => ({
        id: entry.id,
        previous_status: entry.previous_status,
        current_status: entry.current_status,
        reason: entry.reason,
        actor_type: entry.performed_by_type,
        created_at: entry.created_at,
      })),
      alerts,
    };
  });

export const getAdminOrderRestaurants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Array<{ id: string; name: string | null }>> => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("restaurants")
      .select("id, name")
      .order("name", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{ id: string; name: string | null }>;
  });
