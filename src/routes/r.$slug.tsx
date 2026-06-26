import { createFileRoute, notFound, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { brl } from "@/lib/format";
import { buildWhatsappOrderLink } from "@/lib/whatsapp.functions";
import { validateCoupon } from "@/lib/coupons.functions";
import { useServerFn } from "@tanstack/react-start";
import { ShoppingBag, Plus, Minus, MessageCircle, Clock, Bike, Loader2, Ticket, Check, Star, ImageIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/r/$slug")({
  head: () => ({ meta: [{ title: "Cardápio — Localix" }] }),
  component: PublicMenu,
});

type CartItem = { id: string; name: string; price: number; qty: number };

function PublicMenu() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();

  useEffect(() => {
    console.log("[r/$slug] Página iniciou. Slug recebido:", slug);
  }, [slug]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["public-restaurant", slug],
    enabled: !!slug,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
    staleTime: 60_000,
    queryFn: async () => {
      console.log("[r/$slug] Consulta iniciada para slug:", slug);
      const { data: rest, error } = await (supabase as any)
        .from("restaurants_public")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) {
        console.error("[r/$slug] Erro retornado pelo Supabase:", error);
        throw error;
      }
      if (!rest) {
        console.warn("[r/$slug] Consulta finalizada. Restaurante não existe para slug:", slug);
        return { restaurant: null, categories: [], items: [] };
      }
      console.log("[r/$slug] Restaurante encontrado:", rest.id, rest.name);
      const [cats, items] = await Promise.all([
        supabase.from("menu_categories").select("*").eq("restaurant_id", rest.id).order("position"),
        supabase.from("menu_items").select("*").eq("restaurant_id", rest.id).eq("is_available", true).order("position"),
      ]);
      console.log("[r/$slug] Consulta finalizada. Categorias:", cats.data?.length ?? 0, "Itens:", items.data?.length ?? 0);
      return { restaurant: rest as any, categories: cats.data ?? [], items: items.data ?? [] };
    },
  });

  useEffect(() => {
    if (isError) console.error("[r/$slug] Estado de erro após retries:", error);
  }, [isError, error]);


  const [cart, setCart] = useState<CartItem[]>([]);
  const [openSheet, setOpenSheet] = useState(false);
  const [activeCat, setActiveCat] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!activeCat && data?.categories?.[0]?.id) setActiveCat(data.categories[0].id);
  }, [data, activeCat]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`repeat:${slug}`);
      if (raw) {
        const items = JSON.parse(raw) as CartItem[];
        if (Array.isArray(items) && items.length) {
          setCart(items);
          setOpenSheet(true);
          toast.success("Carrinho preenchido com seu pedido anterior");
        }
        sessionStorage.removeItem(`repeat:${slug}`);
      }
    } catch {}
  }, [slug]);

  const add = (it: { id: string; name: string; price: number }) =>
    setCart((c) => {
      const found = c.find((x) => x.id === it.id);
      if (found) return c.map((x) => x.id === it.id ? { ...x, qty: x.qty + 1 } : x);
      return [...c, { ...it, qty: 1 }];
    });
  const dec = (id: string) => setCart((c) => c.flatMap((x) => x.id === id ? (x.qty <= 1 ? [] : [{ ...x, qty: x.qty - 1 }]) : [x]));

  const subtotal = useMemo(() => cart.reduce((s, x) => s + x.price * x.qty, 0), [cart]);
  const totalQty = cart.reduce((s, x) => s + x.qty, 0);

  if (isLoading || (!data && !isError)) {
    return (
      <div className="min-h-screen bg-muted/30">
        <div className="h-[180px] w-full animate-pulse bg-muted" />
        <div className="mx-auto max-w-3xl px-4">
          <div className="-mt-16 rounded-3xl border bg-card p-5 shadow-premium">
            <div className="flex items-start gap-4">
              <Skeleton className="h-24 w-24 rounded-2xl" />
              <div className="flex-1 space-y-2 pt-2">
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            </div>
            <Skeleton className="mt-4 h-16 w-full rounded-2xl" />
          </div>
          <div className="mt-6 space-y-3">
            {[0,1,2,3].map((i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!data || !data.restaurant) return (
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
    <div className="min-h-screen bg-muted/30 pb-36">
      {/* cover */}
      <div className="relative h-[180px] w-full overflow-hidden bg-gradient-warm">
        {restaurant.cover_url && <img src={restaurant.cover_url} alt="" className="h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
      </div>

      <div className="mx-auto max-w-3xl px-4">
        {/* premium store card */}
        <Card className="-mt-16 overflow-hidden rounded-3xl border bg-card p-5 shadow-premium">
          <div className="flex items-start gap-4">
            {restaurant.logo_url ? (
              <img src={restaurant.logo_url} alt={restaurant.name} className="h-24 w-24 shrink-0 rounded-2xl border-4 border-card bg-card object-cover shadow-elegant" />
            ) : (
              <div className="grid h-24 w-24 shrink-0 place-items-center rounded-2xl border-4 border-card bg-gradient-warm text-3xl font-extrabold text-primary-foreground shadow-elegant">
                {restaurant.name[0]}
              </div>
            )}
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate font-display text-2xl font-extrabold leading-tight">{restaurant.name}</h1>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${restaurant.is_open ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                  {restaurant.is_open ? "● Aberto" : "● Fechado"}
                </span>
              </div>
              {restaurant.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{restaurant.description}</p>}
              <div className="mt-2 flex items-center gap-1 text-sm">
                <Star className="h-4 w-4 fill-warning text-warning" />
                <span className="font-semibold">4.8</span>
                <span className="text-muted-foreground">· {restaurant.category ?? "Restaurante"}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 divide-x divide-border rounded-2xl border bg-muted/40 text-center text-xs">
            <div className="px-2 py-3">
              <Clock className="mx-auto mb-1 h-4 w-4 text-primary" />
              <p className="font-bold text-foreground">30–45 min</p>
              <p className="text-muted-foreground">Entrega</p>
            </div>
            <div className="px-2 py-3">
              <Bike className="mx-auto mb-1 h-4 w-4 text-primary" />
              <p className="font-bold text-foreground">{Number(restaurant.delivery_fee) === 0 ? "Grátis" : brl(restaurant.delivery_fee)}</p>
              <p className="text-muted-foreground">Taxa</p>
            </div>
            <div className="px-2 py-3">
              <ShoppingBag className="mx-auto mb-1 h-4 w-4 text-primary" />
              <p className="font-bold text-foreground">{brl(restaurant.min_order)}</p>
              <p className="text-muted-foreground">Mínimo</p>
            </div>
          </div>
        </Card>

        {/* category chips */}
        {categories.length > 0 && (
          <nav className="sticky top-0 z-20 -mx-4 mt-5 border-b bg-background/95 px-4 py-3 backdrop-blur">
            <div className="flex gap-2 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {categories.map((c) => {
                const isActive = activeCat === c.id;
                return (
                  <a
                    key={c.id}
                    href={`#cat-${c.id}`}
                    onClick={() => setActiveCat(c.id)}
                    className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-semibold transition ${isActive ? "border-primary bg-primary text-primary-foreground shadow-elegant" : "bg-card text-foreground hover:border-primary/40"}`}
                  >
                    {c.name}
                  </a>
                );
              })}
            </div>
          </nav>
        )}

        <div className="mt-5 space-y-7">
          {categories.map((cat) => {
            const catItems = items.filter((i) => i.category_id === cat.id);
            if (catItems.length === 0) return null;
            return (
              <section key={cat.id} id={`cat-${cat.id}`} className="scroll-mt-20">
                <h2 className="mb-3 font-display text-xl font-extrabold tracking-tight">{cat.name}</h2>
                <div className="grid gap-3">
                  {catItems.map((it: any) => {
                    const hasPromo = it.promo_price && Number(it.promo_price) > 0 && Number(it.promo_price) < Number(it.price);
                    return (
                      <Card key={it.id} className="group flex items-stretch gap-3 overflow-hidden rounded-2xl border bg-card p-3 shadow-sm transition hover:shadow-elegant">
                        <div className="flex min-w-0 flex-1 flex-col">
                          <h3 className="line-clamp-1 font-bold leading-snug">{it.name}</h3>
                          {it.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{it.description}</p>}
                          <div className="mt-auto flex items-baseline gap-2 pt-2">
                            {hasPromo ? (
                              <>
                                <span className="font-display text-lg font-extrabold text-primary">{brl(it.promo_price)}</span>
                                <span className="text-xs text-muted-foreground line-through">{brl(it.price)}</span>
                              </>
                            ) : (
                              <span className="font-display text-lg font-extrabold text-primary">{brl(it.price)}</span>
                            )}
                          </div>
                        </div>
                        <div className="relative shrink-0">
                          {it.image_url ? (
                            <img src={it.image_url} alt={it.name} className="h-24 w-24 rounded-xl object-cover sm:h-28 sm:w-28" loading="lazy" />
                          ) : (
                            <div className="grid h-24 w-24 place-items-center rounded-xl bg-muted text-muted-foreground sm:h-28 sm:w-28">
                              <ImageIcon className="h-6 w-6" />
                            </div>
                          )}
                          <Button
                            size="icon"
                            className="absolute -bottom-1 -right-1 h-9 w-9 rounded-full shadow-premium transition group-hover:scale-105"
                            disabled={!restaurant.is_open}
                            onClick={() => { add({ id: it.id, name: it.name, price: Number(hasPromo ? it.promo_price : it.price) }); toast.success(`${it.name} adicionado`); }}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </section>
            );
          })}
          {items.length === 0 && (
            <Card className="rounded-2xl p-12 text-center text-muted-foreground">Cardápio em montagem. Volte em breve!</Card>
          )}
        </div>
      </div>

      {/* floating cart */}
      {totalQty > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 px-3 pb-4 pt-2">
          <div className="mx-auto max-w-3xl">
            <Sheet open={openSheet} onOpenChange={setOpenSheet}>
              <SheetTrigger asChild>
                <button className="flex w-full items-center justify-between gap-3 rounded-2xl bg-primary px-5 py-3.5 text-primary-foreground shadow-float transition hover:brightness-105">
                  <span className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-primary-foreground/20 text-sm font-bold">{totalQty}</span>
                    <span className="text-left">
                      <span className="block text-xs opacity-90">Ver carrinho</span>
                      <span className="block font-display text-base font-extrabold leading-tight">{brl(subtotal)}</span>
                    </span>
                  </span>
                  <ShoppingBag className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <CheckoutSheet restaurant={restaurant} cart={cart} subtotal={subtotal} dec={dec} add={add} onClose={() => setOpenSheet(false)} onCreated={(orderId) => { setCart([]); navigate({ to: "/pedido-sucesso/$id", params: { id: orderId } }); }} />
            </Sheet>
          </div>
        </div>
      )}
    </div>
  );
}

function CheckoutSheet({ restaurant, cart, subtotal, dec, add, onClose, onCreated }: {
  restaurant: any; cart: CartItem[]; subtotal: number;
  dec: (id: string) => void; add: (it: { id: string; name: string; price: number }) => void;
  onClose: () => void;
  onCreated: (orderId: string) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [payment, setPayment] = useState("Pix");
  const [notes, setNotes] = useState("");
  const fee = Number(restaurant.delivery_fee ?? 0);
  const min = Number(restaurant.min_order ?? 0);

  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<{ id: string; code: string; discountPercent: number } | null>(null);
  const [validating, setValidating] = useState(false);
  const checkCoupon = useServerFn(validateCoupon);

  const discount = coupon ? +(subtotal * (coupon.discountPercent / 100)).toFixed(2) : 0;
  const total = Math.max(0, subtotal - discount) + fee;
  const belowMin = subtotal < min;

  const getOrderLink = useServerFn(buildWhatsappOrderLink);

  async function applyCoupon() {
    if (!couponInput.trim()) return;
    setValidating(true);
    try {
      const res = await checkCoupon({ data: { slug: restaurant.slug, code: couponInput.trim() } });
      if (!res.valid) { setCoupon(null); toast.error(res.reason); return; }
      setCoupon({ id: res.id, code: res.code, discountPercent: res.discountPercent });
      toast.success(`Cupom aplicado: -${res.discountPercent}%`);
    } finally {
      setValidating(false);
    }
  }

  async function sendWhatsApp() {
    if (!name.trim() || !phone.trim() || !address.trim() || !neighborhood.trim()) {
      toast.error("Preencha nome, telefone, endereço e bairro");
      return;
    }
    if (belowMin) { toast.error(`Pedido mínimo de ${brl(min)}`); return; }
    const fullAddress = complement.trim() ? `${address} — ${complement}, ${neighborhood}` : `${address}, ${neighborhood}`;
    const lines = [
      `Olá, gostaria de fazer o seguinte pedido:`,
      ``,
      ...cart.map((c) => `• ${c.qty}x ${c.name} — ${brl(c.price * c.qty)}`),
      ``,
      `Subtotal: ${brl(subtotal)}`,
      coupon ? `Cupom ${coupon.code}: -${brl(discount)}` : "",
      `Entrega: ${brl(fee)}`,
      `*Total: ${brl(total)}*`,
      ``,
      `Nome: ${name}`,
      `Telefone: ${phone}`,
      `Endereço: ${fullAddress}`,
      ``,
      `Forma de pagamento: ${payment}`,
      notes ? `\nObs: ${notes}` : "",
    ].filter(Boolean).join("\n");
    try {
      const { url, orderNumber, orderId } = await getOrderLink({
        data: {
          slug: restaurant.slug,
          message: lines,
          customer: { name, phone, address: fullAddress, payment },
          items: cart.map((c) => ({ id: c.id, name: c.name, price: c.price, qty: c.qty })),
          deliveryFee: fee,
          couponCode: coupon?.code ?? null,
        },
      });
      if (orderNumber) toast.success(`Pedido #${orderNumber} enviado!`);
      window.open(url, "_blank");
      onClose();
      if (orderId) onCreated(orderId);
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível enviar o pedido");
    }
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
        <div className="space-y-1.5"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="João Silva" /></div>
        <div className="space-y-1.5"><Label>Telefone</Label><Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" /></div>
        <div className="space-y-1.5"><Label>Endereço</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, número" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Complemento</Label><Input value={complement} onChange={(e) => setComplement(e.target.value)} placeholder="Apto 12" /></div>
          <div className="space-y-1.5"><Label>Bairro</Label><Input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} placeholder="Centro" /></div>
        </div>
        <div className="space-y-1.5">
          <Label>Forma de pagamento</Label>
          <div className="flex flex-wrap gap-2">
            {["Pix", "Dinheiro", "Cartão na entrega"].map((p) => (
              <button key={p} type="button" onClick={() => setPayment(p)} className={`rounded-full border px-3 py-1.5 text-sm ${payment === p ? "border-primary bg-primary/10 text-primary" : ""}`}>{p}</button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5"><Label>Observações (opcional)</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>

        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5"><Ticket className="h-4 w-4" /> Cupom de desconto</Label>
          <div className="flex gap-2">
            <Input value={couponInput} onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCoupon(null); }} placeholder="DIGITE O CÓDIGO" />
            <Button type="button" variant="outline" onClick={applyCoupon} disabled={validating || !couponInput.trim()}>
              {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : coupon ? <Check className="h-4 w-4 text-success" /> : "Aplicar"}
            </Button>
          </div>
          {coupon && <p className="text-xs text-success">Cupom {coupon.code} aplicado: -{coupon.discountPercent}%</p>}
        </div>
      </div>

      <div className="mt-5 space-y-1 rounded-xl bg-muted/50 p-4 text-sm">
        <div className="flex justify-between"><span>Subtotal</span><span>{brl(subtotal)}</span></div>
        {discount > 0 && <div className="flex justify-between text-success"><span>Desconto ({coupon?.code})</span><span>-{brl(discount)}</span></div>}
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
