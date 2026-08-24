import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const enumMigration = "supabase/migrations/20260820190619_partner_growth_role_enum.sql";
const accessMigration = "supabase/migrations/20260820190702_partner_growth_access_foundation.sql";
const roleHook = "src/hooks/use-role.ts";

describe("partner growth access foundation migration", () => {
  const enumSql = readFileSync(enumMigration, "utf8");
  const accessSql = readFileSync(accessMigration, "utf8");
  const hookSource = readFileSync(roleHook, "utf8");
  const helperSql =
    accessSql.match(
      /CREATE OR REPLACE FUNCTION private\.has_partner_growth_restaurant\(_restaurant_id uuid\)[\s\S]*?\$\$;/,
    )?.[0] ?? "";

  it("adds partner_growth as an isolated app role", () => {
    expect(enumSql).toContain("ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'partner_growth'");
    expect(hookSource).toContain('| "partner_growth"');
  });

  it("creates the minimal assignment wallet with required constraints", () => {
    expect(accessSql).toContain("CREATE TABLE IF NOT EXISTS public.partner_growth_assignments");
    expect(accessSql).toContain("id uuid PRIMARY KEY DEFAULT gen_random_uuid()");
    expect(accessSql).toContain("user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE");
    expect(accessSql).toContain("restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE");
    expect(accessSql).toContain("assigned_at timestamptz NOT NULL DEFAULT now()");
    expect(accessSql).toContain("assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL");
    expect(accessSql).toContain("active boolean NOT NULL DEFAULT true");
    expect(accessSql).toContain("UNIQUE (user_id, restaurant_id)");
  });

  it("adds only portfolio lookup indexes needed by PG-1A", () => {
    expect(accessSql).toContain("partner_growth_assignments_user_active_idx");
    expect(accessSql).toContain("ON public.partner_growth_assignments (user_id, active)");
    expect(accessSql).toContain("partner_growth_assignments_restaurant_active_idx");
    expect(accessSql).toContain("ON public.partner_growth_assignments (restaurant_id, active)");
  });

  it("protects assignments with RLS and owner-only portfolio reads", () => {
    expect(accessSql).toContain("ALTER TABLE public.partner_growth_assignments ENABLE ROW LEVEL SECURITY");
    expect(accessSql).toContain('CREATE POLICY "partner growth assignments own select"');
    expect(accessSql).toContain("ON public.partner_growth_assignments FOR SELECT TO authenticated");
    expect(accessSql).toContain("USING (user_id = auth.uid())");
  });

  it("allows only admins to manage assignments through existing RBAC", () => {
    expect(accessSql).toContain('CREATE POLICY "partner growth assignments admin manage"');
    expect(accessSql).toContain("ON public.partner_growth_assignments FOR ALL TO authenticated");
    expect(accessSql).toContain("USING (public.has_role(auth.uid(), 'admin'::public.app_role))");
    expect(accessSql).toContain("WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role))");
  });

  it("creates a private helper that derives the user from auth.uid only", () => {
    expect(accessSql).toContain("DROP FUNCTION IF EXISTS private.has_partner_growth_restaurant(uuid, uuid)");
    expect(accessSql).toContain("CREATE OR REPLACE FUNCTION private.has_partner_growth_restaurant(_restaurant_id uuid)");
    expect(accessSql).not.toContain("CREATE OR REPLACE FUNCTION private.has_partner_growth_restaurant(\n  _user_id uuid");
    expect(helperSql).not.toContain("_user_id");
    expect(helperSql).toContain("FROM (SELECT auth.uid() AS user_id) current_user_context");
    expect(helperSql).toContain("current_user_context.user_id IS NOT NULL");
  });

  it("creates a private helper that requires role plus active restaurant assignment", () => {
    expect(helperSql).toContain("CREATE OR REPLACE FUNCTION private.has_partner_growth_restaurant(_restaurant_id uuid)");
    expect(accessSql).toContain("STABLE");
    expect(accessSql).toContain("SECURITY DEFINER");
    expect(helperSql).toContain("SET search_path TO 'pg_catalog'");
    expect(helperSql).toContain("private.has_role(current_user_context.user_id, 'partner_growth'::public.app_role)");
    expect(helperSql).toContain("pga.user_id = current_user_context.user_id");
    expect(helperSql).toContain("pga.restaurant_id = _restaurant_id");
    expect(helperSql).toContain("pga.active = true");
  });

  it("grants the private helper only for authenticated RLS policy execution", () => {
    expect(accessSql).toContain(
      "REVOKE ALL ON FUNCTION private.has_partner_growth_restaurant(uuid) FROM PUBLIC, anon, authenticated",
    );
    expect(accessSql).toContain("GRANT EXECUTE ON FUNCTION private.has_partner_growth_restaurant(uuid) TO authenticated");
    expect(accessSql).not.toContain("GRANT EXECUTE ON FUNCTION private.has_partner_growth_restaurant(uuid) TO anon");
    expect(accessSql).not.toContain("GRANT EXECUTE ON FUNCTION private.has_partner_growth_restaurant(uuid) TO service_role");
    expect(accessSql).not.toContain("GRANT EXECUTE ON FUNCTION private.has_partner_growth_restaurant(uuid, uuid)");
  });

  it("provides an admin-only role provisioning function without creating restaurant ownership", () => {
    expect(accessSql).toContain("CREATE OR REPLACE FUNCTION public.admin_assign_partner_growth_role");
    expect(accessSql).toContain("NOT private.has_role(auth.uid(), 'admin'::public.app_role)");
    expect(accessSql).toContain("DELETE FROM public.user_roles");
    expect(accessSql).toContain("AND role = 'partner'::public.app_role");
    expect(accessSql).toContain("VALUES (_target_user_id, 'partner_growth'::public.app_role)");
    expect(accessSql).not.toContain("INSERT INTO public.restaurants");
    expect(accessSql).not.toContain("INSERT INTO public.owner_profiles");
  });

  it("does not alter existing restaurant, order, finance, benefits, checkout, or partner panel policies", () => {
    expect(accessSql).not.toContain("ON public.restaurants ");
    expect(accessSql).not.toContain("ON public.orders ");
    expect(accessSql).not.toContain("mercado");
    expect(accessSql).not.toContain("benefit");
    expect(accessSql).not.toContain("checkout");
    expect(accessSql).not.toContain("payment");
    expect(accessSql).not.toContain("pricing");
  });
});
