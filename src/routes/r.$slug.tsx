import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { brl } from "@/lib/format";
import { buildWhatsappOrderLink } from "@/lib/whatsapp.functions";
import { useServerFn } from "@tanstack/react-start";
import { ShoppingBag, Plus, Minus, MessageCircle, Clock, MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/r/$slug")({
  head: () => ({ meta: [{ title: "Cardápio — Localix" }] }),
  component: PublicMenu,
});

type CartItem = { id: string; name: string; price: number; qty: number };

function PublicMenu() {
  const { slug } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["public-restaurant", slug],
    queryFn: async () => {
      const { data: rest } = await (supabase as any)
        .from("restaurants_public")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (!rest) return null;
      const [cats, items] = await Promise.all([
        supabase.from("menu_categories").select("*").eq("restaurant_id", rest.id).order("position"),
        supabase.from("menu_items").select("*").eq("restaurant_id", rest.id).eq("is_available", true).order("position"),
      ]);
      return { restaurant: rest as any, categories: cats.data ?? [], items: items.data ?? [] };
    },
  });

  const [cart, setCart] = useState<CartItem[]>([]);
  const [openSheet, setOpenSheet] = useState(false);

  const add = (it: { id: string; name: string; price: number }) =>
    setCart((c) => {
      const found = c.find((x) => x.id === it.id);
      if (found) return c.map((x) => x.id === it.id ? { ...x, qty: x.qty + 1 } : x);
      return [...c, { ...it, qty: 1 }];
    });
  const dec = (id: string) => setCart((c) => c.flatMap((x) => x.id === id ? (x.qty <= 1 ? [] : [{ ...x, qty: x.qty - 1 }]) : [x]));

  const subtotal = useMemo(() => cart.reduce((s, x) => s + x.price * x.qty, 0), [cart]);
  const totalQty = cart.reduce((s, x) => s + x.qty, 0);

  if (isLoading) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!data) return (
    <div className="grid min-h-screen place-items-center px-4 text-center">
      <div>
        <h1 className="font-display text-3xl font-extrabold">Restaurante não encontrado</h1>
        <p className="mt-2 text-muted-foreground">Verifique o link e tente novamente.</p>
        <Link to="/" className="mt-4 inline-flex"><Button>Ir para o Localix</Button></Link>
      </div>
    </div>
  );

  const { restaurant, categories, items } = data;

  return (
    <div className="min-h-screen bg-muted/30 pb-32">
      {/* cover */}
      <div className="relative h-44 bg-gradient-warm md:h-56">
        {restaurant.cover_url && <img src={restaurant.cover_url} alt="" className="h-full w-full object-cover opacity-80" />}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
      </div>

      <div className="mx-auto -mt-12 max-w-3xl px-4">
        <Card className="overflow-hidden p-5 shadow-glow">
          <div className="flex items-start gap-4">
            {restaurant.logo_url ? (
              <img src={restaurant.logo_url} alt={restaurant.name} className="h-20 w-20 rounded-2xl border bg-card object-cover" />
            ) : (
              <div className="grid h-20 w-20 place-items-center rounded-2xl bg-gradient-warm text-2xl font-extrabold text-primary-foreground">
                {restaurant.name[0]}
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="font-display text-2xl font-extrabold">{restaurant.name}</h1>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${restaurant.is_open ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                  {restaurant.is_open ? "Aberto" : "Fechado"}
                </span>
              </div>
              {restaurant.description && <p className="mt-1 text-sm text-muted-foreground">{restaurant.description}</p>}
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> Entrega: {brl(restaurant.delivery_fee)}</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Mínimo: {brl(restaurant.min_order)}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* category nav */}
        {categories.length > 0 && (
          <nav className="sticky top-0 z-20 -mx-4 mt-6 flex gap-2 overflow-x-auto border-y bg-background/90 px-4 py-3 backdrop-blur">
            {categories.map((c) => (
              <a key={c.id} href={`#cat-${c.id}`} className="whitespace-nowrap rounded-full border bg-card px-3 py-1 text-sm font-medium hover:bg-accent">
                {c.name}
              </a>
            ))}
          </nav>
        )}

        <div className="mt-6 space-y-8">
          {categories.map((cat) => {
            const catItems = items.filter((i) => i.category_id === cat.id);
            if (catItems.length === 0) return null;
            return (
              <section key={cat.id} id={`cat-${cat.id}`}>
                <h2 className="mb-3 font-display text-xl font-bold">{cat.name}</h2>
                <div className="space-y-2">
                  {catItems.map((it) => (
                    <Card key={it.id} className="flex gap-3 p-3 transition hover:border-primary/30">
                      <div className="flex-1">
                        <h3 className="font-semibold">{it.name}</h3>
                        {it.description && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{it.description}</p>}
                        <p className="mt-1 font-display font-bold text-primary">{brl(it.price)}</p>
                      </div>
                      {it.image_url && <img src={it.image_url} alt={it.name} className="h-20 w-20 rounded-lg object-cover" />}
                      <Button
                        size="icon"
                        className="self-center shadow-glow"
                        disabled={!restaurant.is_open}
                        onClick={() => { add({ id: it.id, name: it.name, price: Number(it.price) }); toast.success(`${it.name} adicionado`); }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </Card>
                  ))}
                </div>
              </section>
            );
          })}
          {items.length === 0 && (
            <Card className="p-12 text-center text-muted-foreground">Cardápio em montagem. Volte em breve!</Card>
          )}
        </div>
      </div>

      {/* sticky cart bar */}
      {totalQty > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <div className="text-sm">
              <p className="font-bold">{totalQty} {totalQty === 1 ? "item" : "itens"}</p>
              <p className="text-muted-foreground">Subtotal {brl(subtotal)}</p>
            </div>
            <Sheet open={openSheet} onOpenChange={setOpenSheet}>
              <SheetTrigger asChild>
                <Button size="lg" className="shadow-glow"><ShoppingBag className="mr-2 h-4 w-4" /> Ver carrinho</Button>
              </SheetTrigger>
              <CheckoutSheet restaurant={restaurant} cart={cart} subtotal={subtotal} dec={dec} add={add} onClose={() => setOpenSheet(false)} />
            </Sheet>
          </div>
        </div>
      )}
    </div>
  );
}

function CheckoutSheet({ restaurant, cart, subtotal, dec, add, onClose }: {
  restaurant: any; cart: CartItem[]; subtotal: number;
  dec: (id: string) => void; add: (it: { id: string; name: string; price: number }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [payment, setPayment] = useState("Pix");
  const [notes, setNotes] = useState("");
  const fee = Number(restaurant.delivery_fee ?? 0);
  const min = Number(restaurant.min_order ?? 0);
  const total = subtotal + fee;
  const belowMin = subtotal < min;

  function sendWhatsApp() {
    if (!name.trim() || !address.trim()) { toast.error("Preencha nome e endereço"); return; }
    if (belowMin) { toast.error(`Pedido mínimo de ${brl(min)}`); return; }
    const lines = [
      `*Novo pedido — ${restaurant.name}*`,
      ``,
      `*Cliente:* ${name}`,
      `*Endereço:* ${address}`,
      `*Pagamento:* ${payment}`,
      ``,
      `*Itens:*`,
      ...cart.map((c) => `• ${c.qty}x ${c.name} — ${brl(c.price * c.qty)}`),
      ``,
      `Subtotal: ${brl(subtotal)}`,
      `Entrega: ${brl(fee)}`,
      `*Total: ${brl(total)}*`,
      notes ? `\n*Obs:* ${notes}` : "",
    ].filter(Boolean).join("\n");
    const phone = onlyDigits(restaurant.whatsapp_phone);
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(lines)}`;
    window.open(url, "_blank");
    onClose();
  }

  return (
    <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-3xl">
      <SheetHeader><SheetTitle className="font-display text-2xl">Seu pedido</SheetTitle></SheetHeader>
      <div className="mt-4 space-y-2">
        {cart.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium">{c.name}</p>
              <p className="text-sm text-muted-foreground">{brl(c.price)}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => dec(c.id)}><Minus className="h-3 w-3" /></Button>
              <span className="w-6 text-center font-semibold">{c.qty}</span>
              <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => add({ id: c.id, name: c.name, price: c.price })}><Plus className="h-3 w-3" /></Button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-3">
        <div className="space-y-1.5"><Label>Seu nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="João Silva" /></div>
        <div className="space-y-1.5"><Label>Endereço de entrega</Label><Textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, número, bairro, ponto de referência" /></div>
        <div className="space-y-1.5">
          <Label>Forma de pagamento</Label>
          <div className="flex flex-wrap gap-2">
            {["Pix", "Dinheiro", "Cartão na entrega"].map((p) => (
              <button key={p} type="button" onClick={() => setPayment(p)} className={`rounded-full border px-3 py-1.5 text-sm ${payment === p ? "border-primary bg-primary/10 text-primary" : ""}`}>{p}</button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5"><Label>Observações (opcional)</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      </div>

      <div className="mt-5 space-y-1 rounded-xl bg-muted/50 p-4 text-sm">
        <div className="flex justify-between"><span>Subtotal</span><span>{brl(subtotal)}</span></div>
        <div className="flex justify-between"><span>Entrega</span><span>{brl(fee)}</span></div>
        <div className="mt-1 flex justify-between border-t pt-2 font-display text-lg font-bold"><span>Total</span><span className="text-primary">{brl(total)}</span></div>
        {belowMin && <p className="mt-1 text-xs text-destructive">Pedido mínimo: {brl(min)}</p>}
      </div>

      <SheetFooter className="mt-5">
        <Button size="lg" className="w-full bg-[#25D366] shadow-glow hover:bg-[#1ebe5d]" onClick={sendWhatsApp} disabled={!restaurant.is_open || belowMin}>
          <MessageCircle className="mr-2 h-5 w-5" /> Enviar pedido pelo WhatsApp
        </Button>
      </SheetFooter>
    </SheetContent>
  );
}
