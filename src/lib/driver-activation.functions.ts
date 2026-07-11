// RC5.4 — Driver Account Activation
// Server functions públicas (não exigem sessão) usadas pelo app do entregador
// para (1) validar cadastro pendente por CPF+telefone e (2) ativar a conta
// criando usuário no Auth, papel `delivery_driver` e vinculando o registro.
// Regras: nunca reativar conta já ativa; nunca cruzar CPF/telefone/restaurante.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

const VEHICLES = ["moto", "bicicleta", "carro", "a_pe"] as const;

/* ============================================================
 * OWNER-SIDE — cadastro pendente (sem criar login)
 * ============================================================ */
export const registerDriverPending = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      restaurantId: z.string().uuid(),
      name: z.string().trim().min(2).max(120),
      phone: z.string().trim().min(8).max(30),
      cpf: z.string().trim().min(8).max(20),
      vehicleType: z.enum(VEHICLES).default("moto"),
      vehiclePlate: z.string().trim().max(20).nullable().optional(),
      photoUrl: z.string().url().max(2048).nullable().optional(),
      documentUrl: z.string().url().max(2048).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // Autoriza o dono do restaurante
    const { data: rest } = await context.supabase
      .from("restaurants").select("id, owner_id").eq("id", data.restaurantId).maybeSingle();
    if (!rest || rest.owner_id !== context.userId) {
      throw new Error("Sem permissão para gerenciar este restaurante");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Evita duplicidade dentro do mesmo restaurante
    const cpfDigits = digits(data.cpf);
    const phoneDigits = digits(data.phone);
    const { data: dup } = await supabaseAdmin
      .from("delivery_drivers")
      .select("id, status, cpf, phone")
      .eq("restaurant_id", data.restaurantId);
    if ((dup ?? []).some((r: any) =>
      digits(r.cpf) === cpfDigits || digits(r.phone) === phoneDigits,
    )) {
      throw new Error("Já existe um entregador com esse CPF ou telefone neste restaurante.");
    }

    const { data: driver, error } = await supabaseAdmin
      .from("delivery_drivers")
      .insert({
        restaurant_id: data.restaurantId,
        owner_id: null,
        name: data.name,
        phone: data.phone,
        cpf: data.cpf,
        vehicle_type: data.vehicleType,
        vehicle_plate: data.vehiclePlate ?? null,
        photo_url: data.photoUrl ?? null,
        document_url: data.documentUrl ?? null,
        status: "aguardando_ativacao" as any,
      })
      .select().single();
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("delivery_driver_audit").insert({
      actor_id: context.userId,
      restaurant_id: data.restaurantId,
      driver_id: driver.id,
      action: "CREATE_PENDING",
      before: null,
      after: driver,
    });

    return driver;
  });

/* ============================================================
 * DRIVER-SIDE — validação pública (Tela 2 → Tela 3)
 * ============================================================ */
export const validateDriverActivation = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      cpf: z.string().trim().min(8).max(20),
      phone: z.string().trim().min(8).max(30),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const correlationId = crypto.randomUUID();
    const cpfD = digits(data.cpf);
    const phoneD = digits(data.phone);

    // Busca ampla + filtro em memória (regex neutraliza máscaras)
    const { data: rows } = await supabaseAdmin
      .from("delivery_drivers")
      .select("id, name, phone, cpf, status, owner_id, restaurant_id, vehicle_type, vehicle_plate")
      .eq("status", "aguardando_ativacao" as any)
      .is("owner_id", null);

    const match = (rows ?? []).find((r: any) =>
      digits(r.cpf) === cpfD && digits(r.phone) === phoneD,
    );

    if (!match) {
      // Auditoria de falha (sem PII no payload)
      await supabaseAdmin.from("delivery_driver_audit").insert({
        actor_id: null,
        restaurant_id: null,
        driver_id: null,
        action: "ACTIVATION_LOOKUP_MISS",
        before: null,
        after: { correlation_id: correlationId },
      });
      return { found: false as const, correlationId };
    }

    const { data: rest } = await supabaseAdmin
      .from("restaurants").select("name").eq("id", match.restaurant_id).maybeSingle();

    await supabaseAdmin.from("delivery_driver_audit").insert({
      actor_id: null,
      restaurant_id: match.restaurant_id,
      driver_id: match.id,
      action: "ACTIVATION_LOOKUP_HIT",
      before: null,
      after: { correlation_id: correlationId },
    });

    return {
      found: true as const,
      correlationId,
      driverId: match.id,
      name: match.name,
      restaurantName: rest?.name ?? "Restaurante",
      vehicleType: match.vehicle_type,
      vehiclePlate: match.vehicle_plate,
    };
  });

/* ============================================================
 * DRIVER-SIDE — ativação (Tela 4)
 * ============================================================ */
export const activateDriverAccount = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      cpf: z.string().trim().min(8).max(20),
      phone: z.string().trim().min(8).max(30),
      email: z.string().trim().email().max(200).optional().nullable(),
      password: z.string().min(8).max(100),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const correlationId = crypto.randomUUID();
    const cpfD = digits(data.cpf);
    const phoneD = digits(data.phone);

    const { data: rows } = await supabaseAdmin
      .from("delivery_drivers")
      .select("id, name, phone, cpf, status, owner_id, restaurant_id")
      .eq("status", "aguardando_ativacao" as any)
      .is("owner_id", null);

    const driver = (rows ?? []).find((r: any) =>
      digits(r.cpf) === cpfD && digits(r.phone) === phoneD,
    );

    if (!driver) {
      await supabaseAdmin.from("delivery_driver_audit").insert({
        actor_id: null, restaurant_id: null, driver_id: null,
        action: "ACTIVATION_FAIL_NOT_FOUND",
        before: null, after: { correlation_id: correlationId },
      });
      throw new Error("Cadastro não encontrado ou já ativado.");
    }

    // E-mail: usa fornecido ou gera determinístico (o entregador pode trocar depois)
    const email = data.email?.trim().toLowerCase()
      || `driver+${driver.id}@localix.app`;

    const { data: created, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: driver.name, kind: "delivery_driver" },
      app_metadata: { provider: "email" },
    });
    if (authErr || !created?.user) {
      await supabaseAdmin.from("delivery_driver_audit").insert({
        actor_id: null, restaurant_id: driver.restaurant_id, driver_id: driver.id,
        action: "ACTIVATION_FAIL_AUTH",
        before: null,
        after: { correlation_id: correlationId, error: authErr?.message ?? "unknown" },
      });
      throw new Error(authErr?.message ?? "Falha ao criar acesso do entregador");
    }
    const newUserId = created.user.id;

    // Papel
    await supabaseAdmin.from("user_roles").insert({
      user_id: newUserId, role: "delivery_driver" as any,
    });

    // Vincula driver
    const { data: updated, error: updErr } = await supabaseAdmin
      .from("delivery_drivers")
      .update({ owner_id: newUserId, status: "ativo" as any, email })
      .eq("id", driver.id)
      .eq("status", "aguardando_ativacao" as any)
      .is("owner_id", null)
      .select().single();

    if (updErr || !updated) {
      // rollback do auth user
      await supabaseAdmin.auth.admin.deleteUser(newUserId).catch(() => {});
      await supabaseAdmin.from("delivery_driver_audit").insert({
        actor_id: null, restaurant_id: driver.restaurant_id, driver_id: driver.id,
        action: "ACTIVATION_FAIL_LINK",
        before: null,
        after: { correlation_id: correlationId, error: updErr?.message ?? "race" },
      });
      throw new Error("Não foi possível concluir a ativação. Tente novamente.");
    }

    await supabaseAdmin.from("delivery_driver_audit").insert({
      actor_id: newUserId,
      restaurant_id: driver.restaurant_id,
      driver_id: driver.id,
      action: "ACTIVATION_SUCCESS",
      before: { status: "aguardando_ativacao" },
      after: { status: "ativo", correlation_id: correlationId },
    });

    return { ok: true as const, email, correlationId };
  });

/* ============================================================
 * DRIVER-SIDE — recuperação de senha (arquitetura placeholder)
 * ============================================================
 * Fluxo real (SMS/OTP) fica para versão futura. Aqui apenas registramos a
 * intenção em audit para uso operacional.
 */
export const requestDriverPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ phone: z.string().trim().min(8).max(30) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const phoneD = digits(data.phone);
    const { data: rows } = await supabaseAdmin
      .from("delivery_drivers").select("id, phone, restaurant_id, owner_id");
    const match = (rows ?? []).find((r: any) => digits(r.phone) === phoneD && r.owner_id);
    await supabaseAdmin.from("delivery_driver_audit").insert({
      actor_id: null,
      restaurant_id: match?.restaurant_id ?? null,
      driver_id: match?.id ?? null,
      action: "PASSWORD_RESET_REQUEST",
      before: null,
      after: { correlation_id: crypto.randomUUID(), matched: !!match },
    });
    // Sempre resposta neutra (não revelar existência)
    return { ok: true as const };
  });
