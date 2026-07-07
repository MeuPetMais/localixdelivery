import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { StripeConnectCard } from "@/components/payments/StripeConnectCard";

type Search = {
  stripe?: "success" | "refresh";
};

export const Route = createFileRoute("/_authenticated/pagamentos")({
  validateSearch: (s): Search => ({
    stripe: s.stripe === "success" || s.stripe === "refresh" ? s.stripe : undefined,
  }),
  component: PagamentosPage,
});

function PagamentosPage() {
  const restaurant = useRestaurant();
  const restaurantId = restaurant?.id ?? null;
  const search = useSearch({ from: Route.id }) as Search;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold">Pagamentos</h1>
        <p className="text-sm text-muted-foreground">
          Gateway de pagamentos oficial da Localix: Stripe Connect. Receba diretamente no CNPJ do seu estabelecimento.
        </p>
      </header>

      <StripeConnectCard restaurantId={restaurantId} urlParam={search.stripe} />
    </div>
  );
}
