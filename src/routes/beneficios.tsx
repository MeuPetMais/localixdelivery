import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Gift, Sparkles, Ticket, Star, Cake, Percent, LogIn, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BottomNavSpacer } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/beneficios")({
  head: () => ({ meta: [{ title: "Benefícios — Localix" }] }),
  component: BeneficiosPage,
});

const LAST_SLUG_KEY = "localix:last-restaurant-slug";

function BeneficiosPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [lastSlug, setLastSlug] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
    let cancelled = false;

    async function loadLastRestaurant() {
      let saved: string | null = null;
      try {
        saved = sessionStorage.getItem(LAST_SLUG_KEY);
      } catch {
        saved = null;
      }

      if (!saved) {
        if (!cancelled) setLastSlug(null);
        return;
      }

      const { data, error } = await (supabase as any)
        .from("restaurants_public")
        .select("slug")
        .eq("slug", saved)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data?.slug) {
        try { sessionStorage.removeItem(LAST_SLUG_KEY); } catch {}
        setLastSlug(null);
        return;
      }

      setLastSlug(data.slug);
    }

    loadLastRestaurant();
    return () => { cancelled = true; };
  }, []);

  const benefits = [
    { icon: Ticket, title: "Cupons disponíveis", desc: "Descontos especiais para você usar no próximo pedido." },
    { icon: Percent, title: "Promoções ativas", desc: "Ofertas do dia direto do seu restaurante favorito." },
    { icon: Star, title: "Programa de fidelidade", desc: "Acumule pontos a cada compra e troque por recompensas." },
    { icon: Trophy, title: "Pontos acumulados", desc: "Acompanhe seu saldo e veja o quanto falta para o próximo prêmio." },
    { icon: Sparkles, title: "Cashback", desc: "Receba parte do valor de volta em compras selecionadas." },
    { icon: Cake, title: "Benefícios de aniversário", desc: "Presentes e descontos especiais no seu mês." },
  ];

  return (
    <div className="min-h-screen bg-muted/30">
      <main className="mx-auto max-w-2xl px-5 py-8">
        <header className="mb-6 text-center animate-in fade-in slide-in-from-top-2 duration-500">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent ring-1 ring-primary/20">
            <Gift className="h-7 w-7 text-primary" strokeWidth={1.8} />
          </div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Seus benefícios</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Vantagens exclusivas para clientes do {lastSlug ? "seu restaurante" : "Localix"}.
          </p>
        </header>

        {authed === false && (
          <Card className="mb-6 border-primary/30 bg-primary/5 p-5 animate-in fade-in duration-500">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                <LogIn className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold">Crie sua conta e ganhe mais</h2>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <li>• Participe do programa de fidelidade</li>
                  <li>• Receba promoções exclusivas</li>
                  <li>• Acumule pontos e resgate cupons</li>
                  <li>• Acompanhe seu histórico de pedidos</li>
                </ul>
                <div className="mt-4 flex gap-2">
                  <Button asChild size="sm" className="rounded-full">
                    <Link to="/entrar">Criar conta</Link>
                  </Button>
                  <Button asChild size="sm" variant="ghost" className="rounded-full">
                    <Link to="/entrar">Entrar</Link>
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {benefits.map(({ icon: Icon, title, desc }) => (
            <Card key={title} className="p-4 transition hover:shadow-md">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">{title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Os benefícios variam conforme o estabelecimento. Visite a página do restaurante para ver as ofertas ativas.
        </p>

        {lastSlug && (
          <div className="mt-5 text-center">
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/r/$slug" params={{ slug: lastSlug }}>Voltar ao restaurante</Link>
            </Button>
          </div>
        )}
      </main>
      <BottomNavSpacer />
    </div>
  );
}
