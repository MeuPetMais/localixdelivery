import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { RestaurantProvider, useCurrentRestaurant } from "@/contexts/RestaurantContext";
import { OwnerOnboarding } from "@/components/OwnerOnboarding";
import { DemoExperience } from "@/components/DemoExperience";
import { OrdersRealtimeProvider } from "@/contexts/OrdersRealtimeContext";
import { PendingOrdersBanner } from "@/components/PendingOrdersBanner";
import { HelpFab } from "@/components/HelpFab";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { EnvSwitcherButton } from "@/components/EnvSwitcherButton";
import { useIsAdmin } from "@/hooks/use-role";
import { RestaurantDashboardLayout } from "@/components/dashboard/RestaurantDashboardLayout";
import type { DashboardRole } from "@/lib/dashboard";
import { useRestaurantStatus } from "@/hooks/use-restaurant-status";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { mode: undefined } as { mode: string | undefined } });
    }
    // RC2-SEC-001: parceiros/admins só podem acessar via e-mail/senha.
    // Usuários autenticados por Google/Apple (área do cliente) são bloqueados
    // no painel do parceiro e devolvidos à área do cliente.
    const provider =
      (data.user.app_metadata?.provider as string | undefined) ?? "email";
    if (provider !== "email") {
      await supabase.auth.signOut();
      throw redirect({ to: "/entrar" });
    }
    return { user: data.user };
  },
  component: AuthLayout,
});

function AuthLayout() {
  const { user } = Route.useRouteContext();
  const { restaurant } = useCurrentRestaurant(user.id);

  useEffect(() => {
    const metadata = user.user_metadata ?? {};
    const attribution = metadata.acquisition_attribution as
      | Record<string, string | undefined>
      | undefined;

    if (
      metadata.kind !== "partner" ||
      !attribution?.external_ref ||
      attribution.lead_id ||
      !metadata.store_name ||
      !metadata.owner_name ||
      !metadata.whatsapp
    ) {
      return;
    }

    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase.functions.invoke("partner-lead-public-capture", {
        body: {
          business_name: metadata.store_name,
          contact_name: metadata.owner_name,
          phone: metadata.whatsapp,
          email: user.email,
          source: attribution.source ?? attribution.utm_source ?? "website_signup",
          medium: attribution.medium ?? attribution.utm_medium ?? "owned",
          utm_source: attribution.utm_source,
          utm_medium: attribution.utm_medium,
          utm_campaign: attribution.utm_campaign,
          utm_content: attribution.utm_content,
          utm_term: attribution.utm_term,
          meta_campaign_id: attribution.meta_campaign_id,
          meta_adset_id: attribution.meta_adset_id,
          meta_ad_id: attribution.meta_ad_id,
          creative_code: attribution.creative_code,
          external_ref: attribution.external_ref,
        },
      });

      if (cancelled) return;
      if (error || !data?.lead_id) {
        console.error("[acquisition-recovery] partner lead recovery failed", {
          message: error?.message,
        });
        return;
      }

      const recovered = { ...attribution, lead_id: data.lead_id };
      const { error: metadataError } = await supabase.auth.updateUser({
        data: { acquisition_attribution: recovered },
      });
      if (metadataError) {
        console.error("[acquisition-recovery] recovery marker update failed", {
          message: metadataError.message,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const { restaurant } = useCurrentRestaurant(user.id);
  return (
    <OrdersRealtimeProvider restaurantId={restaurant?.id ?? ""}>
      <AuthShell userId={user.id} userEmail={user.email} />
    </OrdersRealtimeProvider>
  );
}

function AuthShell({ userId, userEmail }: { userId: string; userEmail?: string }) {
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin(userId);
  const { restaurant } = useCurrentRestaurant(userId);

  // RBAC v2: the user who owns the restaurant is its OWNER (full access to the restaurant panel).
  // Platform-level admin (isAdmin) is scoped to /admin — it does not grant restaurant-panel roles.
  const role: DashboardRole = restaurant?.owner_id === userId || isAdmin ? "OWNER" : "STAFF";
  const restaurantName = restaurant?.name ?? "Localix";
  const restaurantStatus = useRestaurantStatus({
    is_open: restaurant?.is_open,
    opening_hours: (restaurant as any)?.opening_hours,
  });
  const dashboardStatus = restaurant
    ? {
        isOpen: restaurantStatus.isOpen,
        reason: restaurantStatus.reason,
        acceptingOrders: restaurantStatus.isOpen,
        vacationMode: false,
        maintenanceMode: false,
        deliveryMode: "OWN" as const,
      }
    : undefined;

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true, search: { mode: undefined } as { mode: string | undefined } });
  }

  return (
    <>
      <ImpersonationBanner />
      {isAdmin && (
        <div className="flex justify-end border-b bg-background/70 px-6 py-2">
          <EnvSwitcherButton />
        </div>
      )}
      <RestaurantDashboardLayout
        restaurantName={restaurantName}
        role={role}
        status={dashboardStatus}
        branding={{
          logoUrl: restaurant?.logo_url ?? undefined,
        }}
      >
        <RestaurantProvider
          userId={userId}
          fallbackWhenMissing={(refetch) => (
            <OwnerOnboarding ownerId={userId} onCreated={() => refetch()} />
          )}
        >
          <DemoExperience userEmail={userEmail} />
          <PendingOrdersBanner />
          <div className="mb-4 flex justify-end">
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </Button>
          </div>
          <Outlet />
        </RestaurantProvider>
      </RestaurantDashboardLayout>
      <HelpFab />
    </>
  );
}
