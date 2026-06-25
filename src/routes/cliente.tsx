import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { lookupCustomerArea } from "@/lib/customer-area.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { brl, onlyDigits } from "@/lib/format";
import { Phone, Loader2, MapPin, ShoppingBag, LogOut, ArrowRight, Store } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/cliente")({
  head: () => ({ meta: [{ title: "Área do Cliente — Localix" }] }),
  component: ClienteArea,
});

type AreaData = Extract<Awaited<ReturnType<typeof lookupCustomerArea>>, { found: true }>;

function ClienteArea() {
  const lookup = useServerFn(lookupCustomerArea);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AreaData | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const p = onlyDigits(phone);
    if (p.length < 10) return toast.error("Digite um telefone válido com DDD");
    setLoading(true);
    try {
      const res = await lookup({ data: { phone: p } });
      if (!res.found) {
        toast.error("Não encontramos pedidos para este número");
        return;
      }
      setData(res);
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao acessar");
    } finally {
      setLoading(false);
    }
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/40">
        <div className="mx-auto grid min-h-screen max-w-md place-items-center px-4">
          <Card className="w-full p-6 shadow-lg">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-gradient-warm text-primary-foreground shadow-glow">
                <ShoppingBag className="h-6 w-6" />
              </div>
              <h1 className="font-display text-2xl font-extrabold">Minha conta</h1>
              <p className="text-sm text-muted-foreground">Acesse com seu WhatsApp para ver seus pedidos.</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-3">
              <label className="text-sm font-medium">WhatsApp</label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 91234-5678"
                  inputMode="tel"
                  className="pl-9"
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Entrar <ArrowRight className="ml-1 h-4 w-4" /></>}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    );
  }

  return <ClienteDashboard data={data} onExit={() => setData(null)} />;
}

function ClienteDashboard({ data, onExit }: { data: AreaData; onExit: () => void }) {
  const navigate = useNavigate();
  const restMap = new Map(data.restaurants.map((r) => [r.id, r]));

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs text-muted-foreground">Olá,</p>
            <h1 className="font-display text-xl font-extrabold">{data.profile.name}</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={onExit}>
            <LogOut className="mr-1.5 h-4 w-4" /> Sair
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Pedidos feitos</p>
            <p className="mt-1 font-display text-3xl font-extrabold">{data.profile.totalOrders}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Total gasto</p>
            <p className="mt-1 font-display text-3xl font-extrabold text-primary">{brl(data.profile.totalSpent)}</p>
          </Card>
        </div>

        {data.addresses.length > 0 && (
          <section>
            <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-bold"><MapPin className="h-4 w-4" /> Endereços salvos</h2>
            <div className="space-y-2">
              {data.addresses.map((a) => (
                <Card key={a} className="p-3 text-sm">{a}</Card>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-bold"><ShoppingBag className="h-4 w-4" /> Últimos pedidos</h2>
          {data.orders.length === 0 && (
            <Card className="p-6 text-center text-sm text-muted-foreground">Você ainda não tem pedidos.</Card>
          )}
          <div className="space-y-3">
            {data.orders.map((o: any) => {
              const r = restMap.get(o.restaurant_id);
              return (
                <Card key={o.id} className="p-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Store className="h-4 w-4 text-primary" />
                        <p className="font-semibold">{r?.name ?? "Restaurante"}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(o.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-display font-bold text-primary">{brl(Number(o.total))}</p>
                      <Badge variant="outline" className="text-[10px]">{String(o.status).replace(/_/g, " ")}</Badge>
                    </div>
                  </div>
                  <ul className="mb-3 space-y-0.5 text-xs text-muted-foreground">
                    {(Array.isArray(o.items) ? o.items : []).map((it: any, i: number) => (
                      <li key={i}>{it.qty}x {it.name}</li>
                    ))}
                  </ul>
                  {r?.slug && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => navigate({ to: "/r/$slug", params: { slug: r.slug } })}
                    >
                      Pedir novamente <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  )}
                </Card>
              );
            })}
          </div>
        </section>

        <p className="pt-4 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:underline">← Voltar para o início</Link>
        </p>
      </main>
    </div>
  );
}
