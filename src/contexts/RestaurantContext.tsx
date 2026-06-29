import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];

type RestaurantContextValue = {
  restaurant: Restaurant | null;
  isLoading: boolean;
  error: unknown;
  refetch: () => Promise<unknown>;
  invalidate: () => Promise<void>;
};

const RestaurantContext = createContext<RestaurantContextValue | undefined>(undefined);

export const MY_RESTAURANT_QUERY_KEY = (userId: string) => ["my-restaurant", userId] as const;

/**
 * Single source of truth for the authenticated owner's restaurant.
 * Standard relationship: restaurants.owner_id = auth.uid()
 */
async function fetchMyRestaurant(userId: string): Promise<Restaurant | null> {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[RestaurantContext] fetch start", { authUid: userId, source: "RestaurantProvider" });
  }
  const { data, error } = await supabase
    .from("restaurants")
    .select("*")
    .eq("owner_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[RestaurantContext] fetch result", {
      authUid: userId,
      restaurantId: data?.id ?? null,
      ownerId: data?.owner_id ?? null,
      slug: data?.slug ?? null,
    });
  }
  return data ?? null;
}

export function RestaurantProvider({
  userId,
  children,
  fallbackWhenMissing,
}: {
  userId: string;
  children: ReactNode;
  /** Rendered when authenticated user has no restaurant yet (onboarding gate). */
  fallbackWhenMissing: (refetch: () => Promise<unknown>) => ReactNode;
}) {
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: MY_RESTAURANT_QUERY_KEY(userId),
    queryFn: () => fetchMyRestaurant(userId),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Realtime: if the restaurant row changes (e.g. settings save) refresh context.
  useEffect(() => {
    if (!data?.id) return;
    const ch = supabase
      .channel(`my-restaurant-${data.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "restaurants", filter: `id=eq.${data.id}` },
        (payload) => {
          qc.setQueryData(MY_RESTAURANT_QUERY_KEY(userId), payload.new as Restaurant);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [data?.id, qc, userId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return <>{fallbackWhenMissing(refetch)}</>;
  }

  const value: RestaurantContextValue = {
    restaurant: data,
    isLoading: false,
    error,
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
  // Inside the provider tree restaurant is always defined (fallback handles null).
  return ctx.restaurant as Restaurant;
}

export function useRestaurantContext(): RestaurantContextValue {
  const ctx = useContext(RestaurantContext);
  if (!ctx) {
    throw new Error("useRestaurantContext must be used inside RestaurantProvider.");
  }
  return ctx;
}
