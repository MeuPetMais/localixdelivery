import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomNavSpacer } from "@/components/BottomNav";

export const Route = createFileRoute("/favoritos")({
  head: () => ({ meta: [{ title: "Favoritos — Localix" }] }),
  component: FavoritosPage,
});

function FavoritosPage() {
  return (
    <div className="min-h-screen bg-muted/30">
      <main className="mx-auto grid min-h-[calc(100vh-64px)] max-w-lg place-items-center px-5 py-10">
        <div className="w-full text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="relative mx-auto mb-7 grid h-24 w-24 place-items-center">
            <div className="absolute inset-0 animate-pulse rounded-full bg-rose-500/10 blur-2xl" />
            <div className="relative grid h-24 w-24 place-items-center rounded-3xl bg-gradient-to-br from-rose-500/20 via-rose-500/10 to-transparent ring-1 ring-rose-500/20">
              <Heart className="h-10 w-10 text-rose-500" strokeWidth={1.8} />
            </div>
          </div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Seus favoritos</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Acesse a Área do Cliente para visualizar e gerenciar os estabelecimentos que você favoritou.
          </p>

          <div className="mt-7 flex flex-col gap-2">
            <Button asChild size="lg" className="rounded-full">
              <Link to="/cliente">Abrir Área do Cliente</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="rounded-full">
              <Link to="/">Voltar ao início</Link>
            </Button>
          </div>
        </div>
      </main>
      <BottomNavSpacer />
      
    </div>
  );
}
