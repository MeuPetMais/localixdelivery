import type { Json } from "@/integrations/supabase/types";
export type JsonObject = { [key: string]: Json | undefined };
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}
export function jsonObject(value: Json | undefined): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
}

/** Match the JSON serialization used by the database transport. */
export function toJson(value: unknown): Json {
  const serialized = JSON.stringify(value);
  return serialized === undefined ? null : (JSON.parse(serialized) as Json);
}
