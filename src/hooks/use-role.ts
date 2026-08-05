import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole =
  | "admin"
  | "partner"
  | "customer"
  | "financeiro"
  | "comercial"
  | "atendimento"
  | "marketing"
  | "analista"
  | "delivery_driver"
  | "support_manager"
  | "support_agent";

export function useRoles(userId: string | undefined) {
  return useQuery({
    enabled: !!userId,
    queryKey: ["user-roles", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as AppRole);
    },
  });
}

export function useIsAdmin(userId: string | undefined) {
  const { data, isLoading } = useRoles(userId);
  return { isAdmin: (data ?? []).includes("admin"), isLoading };
}

export function useCanAccessAdminSupport(userId: string | undefined) {
  return useQuery({
    enabled: !!userId,
    queryKey: ["admin-support-access", userId],
    queryFn: async (): Promise<{
      canAccess: boolean;
      role: "admin" | "support_manager" | "support_agent" | null;
    }> => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!);
      if (error) throw error;
      const roles = (data ?? []).map((row) => row.role as AppRole);

      if (roles.includes("admin")) return { canAccess: true, role: "admin" };

      const supportRole = roles.includes("support_manager")
        ? "support_manager"
        : roles.includes("support_agent")
          ? "support_agent"
          : null;
      if (!supportRole) return { canAccess: false, role: null };

      const { data: member, error: memberError } = await (supabase.from("support_team_members" as any) as any)
        .select("active, role")
        .eq("user_id", userId!)
        .maybeSingle();
      if (memberError) throw memberError;
      const active = Boolean(member?.active) && member.role === supportRole;
      return { canAccess: active, role: active ? supportRole : null };
    },
  });
}

export function useCanAccessAdminSupportLegacy(userId: string | undefined) {
  const { data, isLoading } = useCanAccessAdminSupport(userId);
  const role = data?.role ?? null;
  return {
    canAccessSupport: Boolean(data?.canAccess),
    roles: role ? [role] : [],
    isLoading,
  };
}
