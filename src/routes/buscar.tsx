import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, Sparkles, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomNavSpacer } from "@/components/BottomNav";

export const Route = createFileRoute("/buscar")({
  head: () => ({ meta: [{ title: "Buscar — Localix" }] }),
  component: BuscarPage,
});

function BuscarPage() {
  return (
    <div className="min-h-screen bg-muted/30">
      <main className="mx-auto grid min-h-[calc(100vh-64px)] max-w-lg place-items-center px-5 py-10">
        <div className="w-full text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="relative mx-auto mb-7 grid h-24 w-24 place-items-center">
            <div className="absolute inset-0 animate-pulse rounded-full bg-primary/10 blur-2xl" />
            <div className="relative grid h-24 w-24 place-items-center rounded-3xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent ring-1 ring-primary/20">
              <Search className="h-10 w-10 text-primary" strokeWidth={1.6} />
              <Sparkles className="absolute -right-1 -top-1 h-4 w-4 text-amber-500" />
            </div>
          </div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Busca em construção</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Estamos preparando a descoberta de restaurantes, pizzarias e hamburguerias próximas de você.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Por enquanto, acesse seus estabelecimentos favoritos pelo link compartilhado ou QR Code.
          </p>

          <div className="mt-7 flex flex-col gap-2">
            <Button asChild size="lg" className="rounded-full">
              <Link to="/meus-pedidos"><Link2 className="mr-2 h-4 w-4" /> Buscar meus pedidos</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="rounded-full">
              <Link to="/">Voltar ao início</Link>
            </Button>
          </div>
        </div>
      </main>
      <BottomNavSpacer />
      <BottomNav />
    </div>
  );
}
