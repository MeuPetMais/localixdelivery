import { createFileRoute } from "@tanstack/react-router";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { RestaurantFinancialCenter } from "@/components/finance/RestaurantFinancialCenter";

export const Route = createFileRoute("/_authenticated/financial-center")({
  head: () => ({ meta: [{ title: "Central Financeira — Localix" }] }),
  component: FinancialCenterPage,
});

function FinancialCenterPage() {
  const restaurant = useRestaurant();
  if (!restaurant?.id) {
    return <div className="p-8 text-sm text-muted-foreground">Selecione um restaurante para acessar a Central Financeira.</div>;
  }
  return <RestaurantFinancialCenter restaurantId={restaurant.id} role="ADMIN" />;
}
