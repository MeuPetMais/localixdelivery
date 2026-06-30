import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, ShieldAlert, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];

export type RestaurantFetchStatus =
  | "loading"
  | "found"
  | "missing"
  | "permission_error"
  | "connection_error";

type RestaurantContextValue = {
  restaurant: Restaurant | null;
  isLoading: boolean;
  error: unknown;
  status: RestaurantFetchStatus;
  refetch: () => Promise<unknown>;
  invalidate: () => Promise<void>;
};

const RestaurantContext = createContext<RestaurantContextValue | undefined>(undefined);

export const MY_RESTAURANT_QUERY_KEY = (userId: string) => ["my-restaurant", userId] as const;

type FetchResult =
  | { kind: "found"; restaurant: Restaurant }
  | { kind: "missing" }
  | { kind: "permission_error"; error: unknown }
  | { kind: "connection_error"; error: unknown };

function classifyError(error: { code?: string; message?: string; status?: number } | null): FetchResult["kind"] {
  if (!error) return "connection_error";
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();
  if (
    code === "42501" ||
    code === "PGRST301" ||
    error.status === 401 ||
    error.status === 403 ||
    msg.includes("permission denied") ||
    msg.includes("rls") ||
    msg.includes("row-level security")
  ) {
    return "permission_error";
  }
  return "connection_error";
}

async function fetchMyRestaurant(userId: string): Promise<FetchResult> {
  const { data, error } = await supabase
    .from("restaurants")
    .select("*")
    .eq("owner_id", userId)
    .maybeSingle();

  if (error) {
    const kind = classifyError(error as any);
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error("[RestaurantContext] fetch error", { kind, error });
    }
    return { kind, error } as FetchResult;
  }
  if (!data) return { kind: "missing" };
  return { kind: "found", restaurant: data };
}

/**
 * Centralized hook to access the current owner's restaurant resolution.
 * Use this anywhere in the dashboard to make decisions without re-querying.
 */
export function useCurrentRestaurant(userId: string) {
  const query = useQuery({
    queryKey: MY_RESTAURANT_QUERY_KEY(userId),
    queryFn: () => fetchMyRestaurant(userId),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: (failureCount, err: any) => {
      // Never retry permission errors
      const kind = classifyError(err);
      if (kind === "permission_error") return false;
      return failureCount < 2;
    },
  });

  const status: RestaurantFetchStatus = query.isLoading
    ? "loading"
    : query.data?.kind === "found"
      ? "found"
      : query.data?.kind === "missing"
        ? "missing"
        : query.data?.kind === "permission_error"
          ? "permission_error"
          : "connection_error";

  return {
    status,
    restaurant: query.data?.kind === "found" ? query.data.restaurant : null,
    error: query.data && query.data.kind !== "found" && query.data.kind !== "missing" ? query.data.error : query.error,
    refetch: query.refetch,
  };
}

function ErrorState({
  icon: Icon,
  title,
  description,
  onRetry,
}: {
  icon: typeof AlertTriangle;
  title: string;
  description: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <Icon className="h-7 w-7 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
        <Button onClick={onRetry} variant="outline">
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}

export function RestaurantProvider({
  userId,
  children,
  fallbackWhenMissing,
}: {
  userId: string;
  children: ReactNode;
  /** Rendered ONLY when authenticated user truly has no restaurant yet (onboarding gate). */
  fallbackWhenMissing: (refetch: () => Promise<unknown>) => ReactNode;
}) {
  const qc = useQueryClient();
  const { status, restaurant, error, refetch } = useCurrentRestaurant(userId);

  // Realtime: if the restaurant row changes (e.g. settings save) refresh context.
  useEffect(() => {
    if (!restaurant?.id) return;
    const ch = supabase
      .channel(`my-restaurant-${restaurant.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "restaurants", filter: `id=eq.${restaurant.id}` },
        (payload) => {
          qc.setQueryData(MY_RESTAURANT_QUERY_KEY(userId), {
            kind: "found",
            restaurant: payload.new as Restaurant,
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [restaurant?.id, qc, userId]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (status === "permission_error") {
    return (
      <ErrorState
        icon={ShieldAlert}
        title="Erro de permissão"
        description="Não foi possível acessar os dados do seu estabelecimento por restrições de permissão. Contate o suporte para regularizar o acesso."
        onRetry={() => refetch()}
      />
    );
  }

  if (status === "connection_error") {
    return (
      <ErrorState
        icon={WifiOff}
        title="Serviço indisponível"
        description="Não conseguimos carregar seu estabelecimento agora. Verifique sua conexão e tente novamente em instantes."
        onRetry={() => refetch()}
      />
    );
  }

  if (status === "missing") {
    return <>{fallbackWhenMissing(refetch)}</>;
  }

  const value: RestaurantContextValue = {
    restaurant,
    isLoading: false,
    error,
    status,
    refetch,
    invalidate: async () => {
      await qc.invalidateQueries({ queryKey: MY_RESTAURANT_QUERY_KEY(userId) });
    },
  };

  return <RestaurantContext.Provider value={value}>{children}</RestaurantContext.Provider>;
}

export function useRestaurant(): Restaurant {
  const ctx = useContext(RestaurantContext);
  if (!ctx) {
    throw new Error("useRestaurant must be used inside RestaurantProvider (authenticated layout).");
  }
  return ctx.restaurant as Restaurant;
}

export function useRestaurantContext(): RestaurantContextValue {
  const ctx = useContext(RestaurantContext);
  if (!ctx) {
    throw new Error("useRestaurantContext must be used inside RestaurantProvider.");
  }
  return ctx;
}
