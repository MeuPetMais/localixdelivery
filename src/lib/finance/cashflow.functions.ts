// Cash Flow & Receivables — server functions.
// Thin, RLS-enforced accessors used by CashFlow/Receivables/Payables services.
// Never bypasses RLS; every reader is scoped by the signed-in owner.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ReceivableStatus = "PENDING" | "RECEIVED" | "FAILED" | "CANCELLED";
export type PayableStatus = "OPEN" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELLED";

export interface AccountReceivable {
  id: string;
  restaurant_id: string;
  order_id: string | null;
  payment_id: string | null;
  gateway: string | null;
  gross_amount: number;
  net_amount: number;
  currency: string;
  expected_date: string | null;
  received_date: string | null;
  status: ReceivableStatus;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface AccountPayable {
  id: string;
  restaurant_id: string;
  supplier_id: string | null;
  description: string;
  category: string | null;
  amount: number;
  paid_amount: number;
  currency: string;
  status: PayableStatus;
  due_date: string | null;
  paid_date: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

const dateFilter = z.object({
  restaurantId: z.string().uuid(),
  from: z.string().optional(),
  to: z.string().optional(),
  status: z.string().optional(),
  limit: z.number().int().min(1).max(500).default(200),
});

export const listReceivables = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => dateFilter.parse(d))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("accounts_receivable")
      .select("*")
      .eq("restaurant_id", data.restaurantId)
      .order("expected_date", { ascending: true, nullsFirst: false })
      .limit(data.limit);
    if (data.status) q = q.eq("status", data.status);
    if (data.from) q = q.gte("expected_date", data.from);
    if (data.to) q = q.lte("expected_date", data.to);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as AccountReceivable[];
  });

export const listPayables = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => dateFilter.parse(d))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("accounts_payable")
      .select("*")
      .eq("restaurant_id", data.restaurantId)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(data.limit);
    if (data.status) q = q.eq("status", data.status);
    if (data.from) q = q.gte("due_date", data.from);
    if (data.to) q = q.lte("due_date", data.to);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as AccountPayable[];
  });

const receivableInput = z.object({
  restaurantId: z.string().uuid(),
  orderId: z.string().uuid().optional().nullable(),
  paymentId: z.string().optional().nullable(),
  gateway: z.string().optional().nullable(),
  grossAmount: z.number().nonnegative(),
  netAmount: z.number().nonnegative(),
  currency: z.string().default("BRL"),
  expectedDate: z.string().optional().nullable(),
  status: z.enum(["PENDING", "RECEIVED", "FAILED", "CANCELLED"]).default("PENDING"),
  metadata: z.record(z.any()).optional(),
});

export const createReceivable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => receivableInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("accounts_receivable")
      .insert({
        restaurant_id: data.restaurantId,
        order_id: data.orderId ?? null,
        payment_id: data.paymentId ?? null,
        gateway: data.gateway ?? null,
        gross_amount: data.grossAmount,
        net_amount: data.netAmount,
        currency: data.currency,
        expected_date: data.expectedDate ?? null,
        status: data.status,
        metadata: data.metadata ?? {},
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as AccountReceivable;
  });

const payableInput = z.object({
  restaurantId: z.string().uuid(),
  supplierId: z.string().uuid().optional().nullable(),
  description: z.string().min(1),
  category: z.string().optional().nullable(),
  amount: z.number().nonnegative(),
  currency: z.string().default("BRL"),
  dueDate: z.string().optional().nullable(),
  status: z.enum(["OPEN", "PARTIAL", "PAID", "OVERDUE", "CANCELLED"]).default("OPEN"),
  metadata: z.record(z.any()).optional(),
});

export const createPayable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => payableInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("accounts_payable")
      .insert({
        restaurant_id: data.restaurantId,
        supplier_id: data.supplierId ?? null,
        description: data.description,
        category: data.category ?? null,
        amount: data.amount,
        currency: data.currency,
        due_date: data.dueDate ?? null,
        status: data.status,
        metadata: data.metadata ?? {},
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as AccountPayable;
  });

export const updatePayableStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["OPEN", "PARTIAL", "PAID", "OVERDUE", "CANCELLED"]),
      paidAmount: z.number().nonnegative().optional(),
      paidDate: z.string().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("accounts_payable")
      .update({
        status: data.status,
        ...(data.paidAmount !== undefined ? { paid_amount: data.paidAmount } : {}),
        ...(data.paidDate !== undefined ? { paid_date: data.paidDate } : {}),
      })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as AccountPayable;
  });

export const updateReceivableStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["PENDING", "RECEIVED", "FAILED", "CANCELLED"]),
      receivedDate: z.string().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("accounts_receivable")
      .update({
        status: data.status,
        ...(data.receivedDate !== undefined ? { received_date: data.receivedDate } : {}),
      })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as AccountReceivable;
  });
