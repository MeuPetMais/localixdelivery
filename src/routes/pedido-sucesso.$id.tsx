import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getPublicOrderById, cancelOrderByCustomer } from "@/lib/public-orders.functions";
import { getPaymentIntentStatus } from "@/lib/payments/PaymentIntentService";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getMyLoyaltyHistory, getMyLoyaltyForRestaurant } from "@/lib/loyalty.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/format";
import {
  CheckCircle2, Clock, CreditCard, Loader2, MapPin, Store, Gift,
  MessageCircle, Share2, ChefHat, Bike, PackageCheck, Copy, Star, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useCustomerAuth } from "@/hooks/use-customer-auth";
import { useCustomerNavigation } from "@/contexts/CustomerNavigationContext";
import { ReviewForm } from "@/components/ReviewForm";

export const Route = createFileRoute("/pedido-sucesso/$id")({
  head: () => ({ meta: [{ title: "Pedido recebido — Localix" }] }),
  component: SuccessPage,
});

const STEPS = [
  { key: "novo", label: "Pedido recebido", Icon: CheckCircle2 },
  { key: "em_preparo", label: "Em preparo", Icon: ChefHat },
  { key: "saiu_para_entrega", label: "Saiu para entrega", Icon: Bike },
  { key: "entregue", label: "Entregue", Icon: PackageCheck },
];

function statusIndex(status: string) {
  const i = STEPS.findIndex((s) => s.key === status);
  return i === -1 ? 0 : i;
}

type OrderItem = { id?: string; name: string; qty: number; price: number; notes?: string; addons?: Array<{ name: string }> };

function SuccessPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const fetchOrder = useServerFn(getPublicOrderById);
  const syncPaymentStatus = useServerFn(getPaymentIntentStatus);
  const cancelOrderFn = useServerFn(cancelOrderByCustomer);
  const [order, setOrder] = useState<any>(null);
  const [restaurant, setRestaurant] = useState<any>(null);
  const { user } = useCustomerAuth();
  const { rememberRestaurantRoute, prepareLoginRedirect } = useCustomerNavigation();
  const [waUrl, setWaUrl] = useState<string | null>(null);
  const [showPaidOverlay, setShowPaidOverlay] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try { setWaUrl(window.sessionStorage.getItem(`wa-url:${id}`)); } catch {}
    // Limpa marcadores de pedido pendente — usuário chegou ao tracking.
    try {
      for (let i = window.sessionStorage.length - 1; i >= 0; i--) {
        const k = window.sessionStorage.key(i);
        if (k && k.startsWith("pending-order:")) window.sessionStorage.removeItem(k);
      }
    } catch {}
    // Detecta retorno do Mercado Pago (?paid=1) e mostra overlay de confirmação.
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("paid") === "1") setShowPaidOverlay(true);
    } catch {}
  }, [id]);

  // Countdown do overlay de retorno do pagamento.
  useEffect(() => {
    if (!showPaidOverlay) return;
    if (countdown <= 0) {
      setShowPaidOverlay(false);
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("paid");
        window.history.replaceState({}, "", url.toString());
      } catch {}
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [showPaidOverlay, countdown]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const res = await fetchOrder({ data: { id } });
      const data = res?.order;
      if (!mounted || !data) return;
      setOrder(data);
      const { data: r } = await (supabase as any)
        .from("restaurants_public")
        .select("id, name, slug, logo_url, delivery_time, avg_delivery_minutes")
        .eq("id", data.restaurant_id)
        .maybeSingle();
      if (!mounted) return;
      setRestaurant(r);
      if (r?.slug) rememberRestaurantRoute(r.slug, { route: `/${r.slug}` });
    }
    load();

    // Realtime status updates
    const channel = supabase
      .channel(`order-success-${id}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` },
        (payload) => { if (mounted) setOrder((prev: any) => ({ ...prev, ...payload.new })); },
      )
      .subscribe();

    return () => { mounted = false; supabase.removeChannel(channel); };
  }, [id, fetchOrder, rememberRestaurantRoute]);

  useEffect(() => {
    const paymentMethod = String(order?.payment_method ?? "").toLowerCase();
    const waitingPayment = order?.status === "aguardando_pagamento";
    const canSync = order?.id && waitingPayment && (paymentMethod === "pix" || paymentMethod === "credit_card");
    if (!canSync) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 12;

    async function pollPaymentApproval() {
      while (!cancelled && attempts < maxAttempts) {
        attempts += 1;
        try {
          const payment = await syncPaymentStatus({ data: { orderId: id } });
          const refreshed = await fetchOrder({ data: { id } });
          if (cancelled) return;
          if (refreshed?.order) setOrder(refreshed.order);
          if (payment?.status === "APPROVED" || refreshed?.order?.status !== "aguardando_pagamento") return;
        } catch {
          // Webhook/realtime seguem como fonte principal; este polling é fallback de retorno.
        }
        if (!cancelled && attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 2500));
        }
      }
    }

    pollPaymentApproval();
    return () => { cancelled = true; };
  }, [order?.id, order?.status, order?.payment_method, id, fetchOrder, syncPaymentStatus]);

  const { subtotal, delivery, items } = useMemo(() => {
    const its: OrderItem[] = Array.isArray(order?.items) ? order.items : [];
    const sub = its.reduce((s, it) => s + Number(it.price ?? 0) * Number(it.qty ?? 0), 0);
    const total = Number(order?.total ?? 0);
    const discount = Number(order?.discount ?? 0);
    const del = Math.max(0, +(total + discount - sub).toFixed(2));
    return { subtotal: sub, delivery: del, items: its };
  }, [order]);

  const etaLabel = useMemo(() => {
    const base = Number(order?.estimated_delivery_time ?? restaurant?.avg_delivery_minutes ?? 35) || 35;
    const min = Math.max(10, base - 10);
    const max = base + 5;
    return `${min}–${max} min`;
  }, [order, restaurant]);

  const currentStep = statusIndex(order?.status ?? "novo");
  const isDelivered = order?.status === "entregue";

  // Ganho de fidelidade — reaproveita LoyaltyService (leitura), sem duplicar regra.
  const historyFn = useServerFn(getMyLoyaltyHistory);
  const summaryFn = useServerFn(getMyLoyaltyForRestaurant);
  const slug = restaurant?.slug ?? "";
  const loyaltySummaryQ = useQuery({
    queryKey: ["loyalty", "summary", slug, user?.id ?? "anon"],
    queryFn: () => summaryFn({ data: { slug } }),
    enabled: !!user && !!slug,
  });
  const loyaltyHistoryQ = useQuery({
    queryKey: ["loyalty", "history", slug, "earn", user?.id ?? "anon"],
    queryFn: () => historyFn({ data: { slug, filter: "earn" } }),
    enabled: !!user && !!slug && isDelivered,
  });
  const creditedForOrder =
    (loyaltyHistoryQ.data ?? []).find(
      (tx) => tx.reference_id === order?.id && tx.type === "EARN",
    )?.points ?? 0;
  const pointsPerReal = loyaltySummaryQ.data?.settings.points_per_real ?? 0;
  const earnOn = loyaltySummaryQ.data?.settings.earn_on ?? "delivered";
  const loyaltyActive = loyaltySummaryQ.data?.active ?? false;
  const estimatedEarn = Math.floor(subtotal * pointsPerReal);


  async function shareOrder() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const text = `Pedido #${order?.order_number} em ${restaurant?.name} — acompanhe: ${url}`;
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try { await (navigator as any).share({ title: `Pedido #${order?.order_number}`, text, url }); return; } catch {}
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível compartilhar");
    }
  }

  if (!order) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-gradient-to-b from-success/5 via-background to-muted/30">
      {showPaidOverlay && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/95 backdrop-blur-sm px-4 animate-in fade-in">
          <Card className="w-full max-w-sm p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full bg-success/15 text-success animate-in zoom-in">
              <CheckCircle2 className="h-14 w-14" />
            </div>
            <h2 className="font-display text-2xl font-extrabold">Pagamento confirmado com sucesso!</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Recebemos seu pagamento. Seu pedido já foi enviado ao restaurante e está aguardando confirmação.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Caso o aplicativo não seja aberto automaticamente, toque no botão abaixo.
            </p>
            <Button
              size="lg"
              className="mt-5 w-full bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                setShowPaidOverlay(false);
                navigate({ to: "/meus-pedidos" });
              }}
            >
              Voltar para o Localix
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">
              Você será redirecionado automaticamente em {countdown} segundo{countdown === 1 ? "" : "s"}...
            </p>
          </Card>
        </div>
      )}
      <main className="mx-auto max-w-md px-4 py-8 pb-24">
        <div className="text-center">
          <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full bg-success/15 text-success animate-in zoom-in">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h1 className="font-display text-2xl font-extrabold">🎉 Pedido recebido</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{restaurant?.name ?? "Estabelecimento"}</p>
        </div>

        {!user && (
          <Card className="mt-5 border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 p-5">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                <Gift className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-display text-base font-bold">🎁 Salve seus pedidos e ganhe benefícios!</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Crie sua conta gratuitamente para acompanhar seus pedidos, salvar endereços, receber cupons e participar do programa de fidelidade.
                </p>
                <Button
                  size="sm"
                  className="mt-3 w-full sm:w-auto"
                  onClick={() => navigate({ to: "/entrar", search: { redirect: prepareLoginRedirect(restaurant?.slug) } })}
                >
                  Criar conta grátis
                </Button>
              </div>
            </div>
          </Card>
        )}

        <Card className="mt-5 p-5 text-center shadow-md">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Número do pedido</p>
          <p className="font-display text-4xl font-extrabold text-primary">#{order.order_number}</p>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Clock className="h-3 w-3" /> Previsão: {etaLabel}
          </div>
        </Card>

        {/* Fidelidade: crédito real quando entregue, senão estimativa */}
        {user && loyaltyActive && isDelivered && creditedForOrder > 0 && (
          <Card className="mt-4 border-emerald-300/60 bg-emerald-50/60 p-4 dark:bg-emerald-950/20 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="text-sm">
                <p className="font-semibold text-emerald-900 dark:text-emerald-200">
                  🎉 Parabéns! +{creditedForOrder} pontos foram creditados.
                </p>
                <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80">
                  <Link to="/fidelidade" className="underline">Ver na Minha Carteira</Link>
                </p>
              </div>
            </div>
          </Card>
        )}
        {user && loyaltyActive && !isDelivered && estimatedEarn > 0 && (
          <Card className="mt-4 border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <p className="text-sm">
                Você ganhará <b className="text-primary">+{estimatedEarn} pontos</b>{" "}
                {earnOn === "delivered"
                  ? "quando este pedido for entregue."
                  : "após a confirmação do pagamento."}
              </p>
            </div>
          </Card>
        )}



        {/* Status tracker */}
        <Card className="mt-4 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acompanhamento</p>
          <ol className="space-y-3">
            {STEPS.map((s, i) => {
              const done = i <= currentStep;
              const active = i === currentStep;
              return (
                <li key={s.key} className="flex items-center gap-3">
                  <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border transition ${
                    done ? "border-primary bg-primary text-primary-foreground" : "border-muted bg-muted text-muted-foreground"
                  } ${active ? "ring-2 ring-primary/30" : ""}`}>
                    <s.Icon className="h-4 w-4" />
                  </div>
                  <span className={`text-sm ${active ? "font-bold text-primary" : done ? "font-semibold" : "text-muted-foreground"}`}>
                    {s.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </Card>

        {/* Order summary */}
        <Card className="mt-4 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resumo do pedido</p>
          <ul className="space-y-2 text-sm">
            {items.map((it, idx) => (
              <li key={idx} className="flex justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{it.qty}x {it.name}</p>
                  {Array.isArray(it.addons) && it.addons.length > 0 && (
                    <ul className="mt-0.5 pl-3 text-xs text-muted-foreground">
                      {it.addons.map((a, i) => <li key={i}>• {a.name}</li>)}
                    </ul>
                  )}
                  {it.notes && <p className="mt-0.5 text-xs italic text-muted-foreground">Obs: {it.notes}</p>}
                </div>
                <span className="shrink-0 font-semibold">{brl(Number(it.price) * Number(it.qty))}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 space-y-1 border-t pt-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{brl(subtotal)}</span></div>
            {Number(order.discount) > 0 && (
              <div className="flex justify-between text-success"><span>Desconto</span><span>-{brl(Number(order.discount))}</span></div>
            )}
            <div className="flex justify-between"><span className="text-muted-foreground">Entrega</span><span>{brl(delivery)}</span></div>
            <div className="mt-1 flex justify-between border-t pt-2 font-display text-base font-bold">
              <span>Total</span><span className="text-primary">{brl(Number(order.total))}</span>
            </div>
          </div>
          <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
            <p className="flex items-start gap-1.5"><MapPin className="mt-0.5 h-3 w-3" /> {order.address}</p>
            <p className="flex items-center gap-1.5"><CreditCard className="h-3 w-3" /> {order.payment_method}</p>
          </div>
        </Card>

        {/* Actions */}
        <div className="mt-4 grid gap-2">
          {waUrl && (
            <Button size="lg" className="w-full bg-[#25D366] hover:bg-[#1ebe5d]" onClick={() => window.open(waUrl, "_blank")}>
              <MessageCircle className="mr-1.5 h-4 w-4" /> Enviar pedido pelo WhatsApp
            </Button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => navigate({ to: "/meus-pedidos" })}>
              Acompanhar pedido
            </Button>
            {restaurant?.slug && (
              <Button variant="outline" onClick={() => navigate({ to: "/$slug", params: { slug: restaurant.slug } })}>
                <Store className="mr-1.5 h-4 w-4" /> Novo pedido
              </Button>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={shareOrder}>
            <Share2 className="mr-1.5 h-4 w-4" /> Compartilhar pedido
          </Button>
        </div>

        {/* Post-delivery review */}
        {isDelivered && restaurant && (
          <div className="mt-4">
            <ReviewForm restaurantId={restaurant.id} orderId={order.id} />
          </div>
        )}

        {user && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            <Link to="/meus-pedidos" className="hover:underline">Ver meus pedidos</Link>
          </p>
        )}

      </main>
    </div>
  );
}
