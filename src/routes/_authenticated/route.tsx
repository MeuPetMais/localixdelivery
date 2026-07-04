import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
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

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
    return { user: data.user };
  },
  component: AuthLayout,
});

function AuthLayout() {
  const { user } = Route.useRouteContext() as { user: { id: string; email?: string } };
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

  const role: DashboardRole = isAdmin ? "ADMIN" : "MANAGER";
  const restaurantName = restaurant?.name ?? "Localix";

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
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
        branding={{
          logoUrl: restaurant?.logo_url ?? undefined,
          bannerUrl: restaurant?.banner_url ?? undefined,
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
