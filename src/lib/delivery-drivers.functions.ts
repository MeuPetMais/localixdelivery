import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const VEHICLES = ["moto", "bicicleta", "carro", "a_pe"] as const;
const STATUSES = ["ativo", "inativo", "afastado"] as const;

async function assertOwner(supabase: any, userId: string, restaurantId: string) {
  const { data } = await supabase
    .from("restaurants")
    .select("id, owner_id")
    .eq("id", restaurantId)
    .maybeSingle();
  if (!data || data.owner_id !== userId) {
    throw new Error("Sem permissão para gerenciar este restaurante");
  }
}

async function audit(
  actorId: string,
  restaurantId: string,
  driverId: string | null,
  action: string,
  before: unknown,
  after: unknown,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("delivery_driver_audit").insert({
    actor_id: actorId,
    restaurant_id: restaurantId,
    driver_id: driverId,
    action,
    before: (before ?? null) as any,
    after: (after ?? null) as any,
  });
}

export const listDrivers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId, data.restaurantId);
    const { data: rows, error } = await context.supabase
      .from("delivery_drivers")
      .select("*")
      .eq("restaurant_id", data.restaurantId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      restaurantId: z.string().uuid(),
      name: z.string().trim().min(2).max(120),
      phone: z.string().trim().max(30).optional().nullable(),
      email: z.string().trim().email().max(200),
      password: z.string().min(6).max(100),
      cpf: z.string().trim().max(20).optional().nullable(),
      vehicleType: z.enum(VEHICLES).default("moto"),
      vehiclePlate: z.string().trim().max(20).optional().nullable(),
      photoUrl: z.string().url().max(500).optional().nullable(),
      documentUrl: z.string().url().max(500).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId, data.restaurantId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Cria usuário no Auth
    const { data: created, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.name, kind: "delivery_driver" },
      app_metadata: { provider: "email" },
    });
    if (authErr || !created?.user) throw new Error(authErr?.message ?? "Falha ao criar acesso do motoboy");
    const newUserId = created.user.id;

    // Concede role delivery_driver
    await supabaseAdmin.from("user_roles").insert({ user_id: newUserId, role: "delivery_driver" as any });

    // Insere driver
    const { data: driver, error } = await supabaseAdmin
      .from("delivery_drivers")
      .insert({
        restaurant_id: data.restaurantId,
        owner_id: newUserId,
        name: data.name,
        phone: data.phone ?? null,
        email: data.email,
        cpf: data.cpf ?? null,
        vehicle_type: data.vehicleType,
        vehicle_plate: data.vehiclePlate ?? null,
        photo_url: data.photoUrl ?? null,
        document_url: data.documentUrl ?? null,
        status: "ativo",
      })
      .select()
      .single();
    if (error) {
      // rollback auth user
      await supabaseAdmin.auth.admin.deleteUser(newUserId).catch(() => {});
      throw new Error(error.message);
    }
    await audit(context.userId, data.restaurantId, driver.id, "CREATE", null, driver);
    return driver;
  });

export const updateDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      restaurantId: z.string().uuid(),
      patch: z.object({
        name: z.string().trim().min(2).max(120).optional(),
        phone: z.string().trim().max(30).nullable().optional(),
        cpf: z.string().trim().max(20).nullable().optional(),
        vehicle_type: z.enum(VEHICLES).optional(),
        vehicle_plate: z.string().trim().max(20).nullable().optional(),
        photo_url: z.string().url().max(500).nullable().optional(),
        document_url: z.string().url().max(500).nullable().optional(),
        status: z.enum(STATUSES).optional(),
      }),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId, data.restaurantId);
    const { data: before } = await context.supabase
      .from("delivery_drivers").select("*").eq("id", data.id).maybeSingle();
    const { data: after, error } = await context.supabase
      .from("delivery_drivers")
      .update(data.patch)
      .eq("id", data.id)
      .eq("restaurant_id", data.restaurantId)
      .select().single();
    if (error) throw new Error(error.message);
    await audit(context.userId, data.restaurantId, data.id,
      data.patch.status ? "STATUS_CHANGE" : "UPDATE", before, after);
    return after;
  });

export const deleteDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), restaurantId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId, data.restaurantId);
    const { data: before } = await context.supabase
      .from("delivery_drivers").select("*").eq("id", data.id).maybeSingle();
    const { error } = await context.supabase
      .from("delivery_drivers")
      .delete()
      .eq("id", data.id)
      .eq("restaurant_id", data.restaurantId);
    if (error) throw new Error(error.message);

    if (before?.owner_id) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.auth.admin.deleteUser(before.owner_id).catch(() => {});
    }
    await audit(context.userId, data.restaurantId, data.id, "DELETE", before, null);
    return { ok: true };
  });

// --- Driver-facing functions ---

export const getMyDriverProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("delivery_drivers").select("*").eq("owner_id", context.userId).maybeSingle();
    return data ?? null;
  });

export const setMyPresence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      online: z.boolean(),
      lat: z.number().optional(),
      lng: z.number().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // Whitelist rígido: apenas presença/localização. Nada mais pode ser mutado por aqui.
    const patch: Record<string, unknown> = {
      online: data.online,
      last_seen_at: new Date().toISOString(),
    };
    if (data.online && typeof data.lat === "number" && typeof data.lng === "number") {
      patch.last_lat = data.lat;
      patch.last_lng = data.lng;
    }
    // O motoboy não possui mais permissão UPDATE via RLS (RC5.1.3).
    // Escopo garantido por owner_id = usuário autenticado no middleware.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("delivery_drivers")
      .update(patch as any)
      .eq("owner_id", context.userId)
      .select().maybeSingle();
    if (error) throw new Error(error.message);
    if (row) {
      await supabaseAdmin.from("delivery_driver_audit").insert({
        actor_id: context.userId,
        restaurant_id: row.restaurant_id,
        driver_id: row.id,
        action: "PRESENCE",
        before: null,
        after: { online: data.online, last_lat: (patch.last_lat as number | undefined) ?? null, last_lng: (patch.last_lng as number | undefined) ?? null },
      });
    }
    return row;
  });
