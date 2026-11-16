import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, Receipt, Store } from "lucide-react";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "Minha conta — Localix Delivery" },
      {
        name: "description",
        content:
          "Acesse seus pedidos e favoritos. Para comprar, utilize o link do estabelecimento.",
      },
    ],
  }),
  component: CustomerHome,
});

/**
 * O piloto do Localix utiliza cardápios acessados por links individuais.
 * /home é apenas um ponto de apoio ao consumidor: não descobre nem anuncia
 * estabelecimentos de outros parceiros.
 */
function CustomerHome() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl space-y-6 px-4 py-8 pb-24">
      <section className="space-y-2">
        <h1 className="font-display text-2xl font-extrabold">Seu Localix</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe seus pedidos e consulte seus favoritos em um só lugar.
        </p>
      </section>

      <Card className="space-y-3 p-5">
        <div className="flex items-start gap-3">
          <Store className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="space-y-1">
            <h2 className="font-semibold">Quer fazer um pedido?</h2>
            <p className="text-sm text-muted-foreground">
              Abra o link de cardápio enviado pelo seu estabelecimento. Assim você compra
              diretamente na loja que escolheu.
            </p>
          </div>
        </div>
      </Card>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label="Sua conta">
        <Link
          to="/meus-pedidos"
          className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4 transition hover:border-primary/40"
        >
          <Receipt className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <span className="font-semibold">Meus pedidos</span>
        </Link>
        <Link
          to="/favoritos"
          className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4 transition hover:border-primary/40"
        >
          <Heart className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <span className="font-semibold">Favoritos</span>
        </Link>
      </section>
    </main>
  );
}
