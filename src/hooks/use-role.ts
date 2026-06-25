import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "partner" | "customer";

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
