// Server functions for financial_reports / scheduled_reports.
// RLS-scoped through requireSupabaseAuth.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import type { ExportFormat, ReportRecord, ReportStatus, ReportType, ScheduleFrequency, ScheduledReportRecord } from "./types";

export const listReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { restaurantId: string; limit?: number }) => d)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("financial_reports")
      .select("*")
      .eq("restaurant_id", data.restaurantId)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);
    if (error) throw error;
    return (rows ?? []) as unknown as ReportRecord[];
  });

export const saveReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    restaurantId: string; type: ReportType; title: string;
    filters: Json; format: ExportFormat; status?: ReportStatus;
    fileUrl?: string | null; expiresAt?: string | null;
  }) => d)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("financial_reports")
      .insert({
        restaurant_id: data.restaurantId,
        report_type: data.type,
        title: data.title,
        filters_json: data.filters,
        file_format: data.format,
        status: data.status ?? "READY",
        file_url: data.fileUrl ?? null,
        generated_by: context.userId,
        generated_at: new Date().toISOString(),
        expires_at: data.expiresAt ?? null,
      })
      .select("*").single();
    if (error) throw error;
    return row as unknown as ReportRecord;
  });

export const deleteReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("financial_reports").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const listSchedules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { restaurantId: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("scheduled_reports").select("*")
      .eq("restaurant_id", data.restaurantId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (rows ?? []) as unknown as ScheduledReportRecord[];
  });

export const upsertSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string; restaurantId: string; name: string; frequency: ScheduleFrequency;
    reportType: ReportType; filters: Json; exportFormat: ExportFormat;
    enabled?: boolean; nextExecution?: string | null;
  }) => d)
  .handler(async ({ data, context }) => {
    const payload = {
      restaurant_id: data.restaurantId,
      name: data.name,
      frequency: data.frequency,
      report_type: data.reportType,
      filters_json: data.filters,
      export_format: data.exportFormat,
      enabled: data.enabled ?? true,
      next_execution: data.nextExecution ?? null,
    };
    const q = data.id
      ? context.supabase.from("scheduled_reports").update(payload).eq("id", data.id).select("*").single()
      : context.supabase.from("scheduled_reports").insert(payload).select("*").single();
    const { data: row, error } = await q;
    if (error) throw error;
    return row as unknown as ScheduledReportRecord;
  });

export const deleteSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("scheduled_reports").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
