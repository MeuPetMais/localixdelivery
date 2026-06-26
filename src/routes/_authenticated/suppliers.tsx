import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Store, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/suppliers")({
  head: () => ({ meta: [{ title: "Marketplace em construção — Localix" }] }),
  component: MarketplaceComingSoon,
});

function MarketplaceComingSoon() {
  return (
    <div className="grid min-h-[calc(100vh-8rem)] place-items-center px-4">
      <div className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-700 text-center">
        <div className="relative mx-auto mb-8 grid h-28 w-28 place-items-center">
          <div className="absolute inset-0 animate-pulse rounded-full bg-primary/10 blur-2xl" />
          <div className="relative grid h-28 w-28 place-items-center rounded-3xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent ring-1 ring-primary/20">
            <Store className="h-12 w-12 text-primary" strokeWidth={1.5} />
            <Sparkles className="absolute -right-1 -top-1 h-5 w-5 text-amber-500" />
          </div>
        </div>

        <h1 className="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
          Marketplace em construção
        </h1>

        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Estamos validando a plataforma junto aos nossos estabelecimentos parceiros.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Em breve você poderá descobrir restaurantes, pizzarias, hamburguerias e muito mais próximos de você, tudo em um só lugar.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Enquanto isso, continue acessando seus estabelecimentos favoritos pelos links compartilhados ou QR Codes.
        </p>

        <div className="mt-8">
          <Button asChild size="lg" className="rounded-full px-8">
            <Link to="/dashboard">Voltar para o início</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
