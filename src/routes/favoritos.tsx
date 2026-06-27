import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, LogIn, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BottomNavSpacer } from "@/components/BottomNav";
import { useCustomerAuth } from "@/hooks/use-customer-auth";

export const Route = createFileRoute("/favoritos")({
  head: () => ({ meta: [{ title: "Favoritos — Localix" }] }),
  component: FavoritosPage,
});

function FavoritosPage() {
  const { loading, isAuthenticated, user } = useCustomerAuth();

  return (
    <div className="min-h-screen bg-muted/30">
      <main className="mx-auto max-w-lg px-5 py-10">
        {loading ? (
          <LoadingState />
        ) : isAuthenticated ? (
          <AuthenticatedState name={(user?.user_metadata?.full_name as string) || user?.email?.split("@")[0] || "Cliente"} />
        ) : (
          <LoginPrompt />
        )}
      </main>
      <BottomNavSpacer />
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <Skeleton className="mx-auto h-24 w-24 rounded-3xl" />
      <Skeleton className="mx-auto h-6 w-48" />
      <Skeleton className="mx-auto h-4 w-64" />
      <div className="mt-6 space-y-3">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
      </div>
    </div>
  );
}

function AuthenticatedState({ name }: { name: string }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <header className="text-center">
        <div className="relative mx-auto mb-6 grid h-20 w-20 place-items-center">
          <div className="absolute inset-0 animate-pulse rounded-full bg-rose-500/10 blur-2xl" />
          <div className="relative grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-rose-500/20 via-rose-500/10 to-transparent ring-1 ring-rose-500/20">
            <Heart className="h-9 w-9 text-rose-500" strokeWidth={1.8} />
          </div>
        </div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          <Sparkles className="mr-1 inline h-3 w-3 text-primary" /> Sua conta
        </p>
        <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">Olá, {name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Seus restaurantes favoritos aparecerão aqui assim que você marcar algum.
        </p>
      </header>

      <Card className="mt-6 rounded-2xl border-dashed p-8 text-center">
        <Heart className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">Nenhum favorito ainda</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Toque no coração na página de um restaurante para salvá-lo aqui.
        </p>
        <Button asChild className="mt-5 rounded-full" size="sm">
          <Link to="/home">Explorar restaurantes</Link>
        </Button>
      </Card>
    </div>
  );
}

function LoginPrompt() {
  return (
    <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="relative mx-auto mb-7 grid h-24 w-24 place-items-center">
        <div className="absolute inset-0 animate-pulse rounded-full bg-rose-500/10 blur-2xl" />
        <div className="relative grid h-24 w-24 place-items-center rounded-3xl bg-gradient-to-br from-rose-500/20 via-rose-500/10 to-transparent ring-1 ring-rose-500/20">
          <Heart className="h-10 w-10 text-rose-500" strokeWidth={1.8} />
        </div>
      </div>
      <h1 className="font-display text-2xl font-extrabold tracking-tight">Seus favoritos</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Entre na sua conta para salvar e gerenciar seus restaurantes favoritos.
      </p>
      <div className="mt-7 flex flex-col gap-2">
        <Button asChild size="lg" className="rounded-full">
          <Link to="/cliente">
            <LogIn className="mr-2 h-4 w-4" /> Entrar na minha conta
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm" className="rounded-full">
          <Link to="/home">Voltar ao início</Link>
        </Button>
      </div>
    </div>
  );
}
