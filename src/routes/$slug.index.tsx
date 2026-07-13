import { createFileRoute, notFound, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { brl } from "@/lib/format";
import { isPromoActiveNow } from "@/lib/promotions";
import { createCheckoutOrder, previewCheckoutPricing, type CheckoutMethod } from "@/lib/checkout/OrderService";
import { PaymentService } from "@/lib/payments/PaymentService";
import { PaymentsReadinessService } from "@/lib/billing/PaymentsReadinessService";
import { getGatewayDisplay } from "@/lib/payments/gatewayDisplay";
import { validateCoupon } from "@/lib/coupons.functions";
import { useServerFn } from "@tanstack/react-start";
import { ShoppingBag, Plus, Minus, Clock, Loader2, Ticket, Check, Star, ImageIcon, Sparkles, ChevronRight, Heart, Search, LayoutGrid, Menu, X, Gift, Cake, Flame, Trophy } from "lucide-react";
import { getFeaturedSections, type FeaturedItem, type FeaturedSection } from "@/lib/featured-sections.functions";
import { toast } from "sonner";
import type { Builder } from "@/components/BuilderConfigurator";
import { fetchFavoriteIdsForRestaurant, toggleFavorite as toggleFav } from "@/lib/favorites";
import { useCustomerAuth } from "@/hooks/use-customer-auth";
import { useCustomerNavigation } from "@/contexts/CustomerNavigationContext";
import { useRestaurantSession } from "@/contexts/RestaurantSessionContext";
import { getRestaurantStatus } from "@/lib/restaurant-status";
import { useRestaurantStatus } from "@/hooks/use-restaurant-status";
import { AddressPickerModal } from "@/components/AddressPickerModal";
import type { CustomerAddress } from "@/lib/customer-addresses";
import { AddressAutocomplete, formatFullAddress, type SelectedAddress } from "@/components/checkout/AddressAutocomplete";
import { AddedToCartSheet, type AddedItem } from "@/components/checkout/AddedToCartSheet";


export const Route = createFileRoute("/$slug/")({
  head: () => ({ meta: [{ title: "Cardápio — Localix" }] }),
  errorComponent: ({ error }) => {
    console.error("[r/$slug] error:", error);
    return <div className="grid min-h-screen place-items-center px-4 text-center">Não conseguimos carregar esta página.</div>;
  },
  notFoundComponent: () => <div className="grid min-h-screen place-items-center px-4 text-center">Restaurante não encontrado.</div>,
  component: PublicMenu,
});

type CartItem = { id: string; name: string; price: number; qty: number };

function PublicMenu() {
  const { slug } = Route.useParams();
  return <PublicMenuScreen slug={slug} />;
}

export function PublicMenuScreen({ slug }: { slug: string }) {
  const navigate = useNavigate();
  const { rememberRestaurantRoute, prepareLoginRedirect, restoreRestaurantScroll, setPendingCart } = useCustomerNavigation();
  const { setActiveRestaurant, markUnavailable } = useRestaurantSession();


  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["public-restaurant", slug],
    enabled: !!slug,
      retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
      refetchOnWindowFocus: "always",
    queryFn: async () => {
      const { data: rest, error } = await (supabase as any)
        .from("restaurants_public")
        .select("id, name, slug, description, logo_url, cover_url, delivery_fee, min_order, is_open, category, delivery_time, avg_delivery_minutes, avg_pickup_minutes, payment_methods, builders_enabled, opening_hours")
        .eq("slug", slug)
        .maybeSingle();
      if (error) {
        console.error("[r/$slug] supabase error:", error);
        throw error;
      }
      if (!rest) return { restaurant: null, categories: [], items: [], builders: [] };
      const [cats, items, builders] = await Promise.all([
        supabase.from("menu_categories").select("*").eq("restaurant_id", rest.id).order("position"),
        supabase.from("menu_items").select("*").eq("restaurant_id", rest.id).eq("is_available", true).order("position"),
        (supabase as any).from("builders").select("*, builder_groups(*, builder_options(*))").eq("restaurant_id", rest.id).eq("is_active", true).order("position"),
      ]);
      return { restaurant: rest as any, categories: cats.data ?? [], items: items.data ?? [], builders: builders.data ?? [] };
    },
  });

  useEffect(() => {
    if (isError) console.error("[r/$slug] query error:", error);
  }, [isError, error]);



  useEffect(() => {
    if (data?.restaurant?.slug) {
      restoreRestaurantScroll(data.restaurant.slug);
      rememberRestaurantRoute(data.restaurant.slug, { route: `/${data.restaurant.slug}` });
      // Salva o restaurante ativo na sessão (RestaurantSessionContext).
      setActiveRestaurant({
        restaurantId: data.restaurant.id,
        restaurantSlug: data.restaurant.slug,
        restaurantName: data.restaurant.name ?? "",
        restaurantLogo: data.restaurant.logo_url ?? null,
      });
    }
  }, [data?.restaurant?.slug, data?.restaurant?.id, rememberRestaurantRoute, restoreRestaurantScroll, setActiveRestaurant]);

  // Restaurante da sessão foi removido do banco → marca como indisponível.
  useEffect(() => {
    if (!isLoading && !isError && data && !data.restaurant) markUnavailable();
  }, [isLoading, isError, data, markUnavailable]);

  const qc = useQueryClient();
  useEffect(() => {
    const restaurantId = data?.restaurant?.id;
    if (!restaurantId) return;
    const invalidateAll = () => {
      qc.invalidateQueries({ queryKey: ["public-restaurant", slug] });
      qc.invalidateQueries({ queryKey: ["featured-sections", slug] });
    };
    const invalidateFeatured = () => qc.invalidateQueries({ queryKey: ["featured-sections", slug] });
    const invalidateReviews = () => {
      qc.invalidateQueries({ queryKey: ["featured-sections", slug] });
      qc.invalidateQueries({ queryKey: ["public-review-stats", restaurantId] });
    };
    const channel = supabase
      .channel(`public-menu:${restaurantId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "restaurants", filter: `id=eq.${restaurantId}` }, invalidateAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items", filter: `restaurant_id=eq.${restaurantId}` }, invalidateAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_categories", filter: `restaurant_id=eq.${restaurantId}` }, invalidateAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_item_images", filter: `restaurant_id=eq.${restaurantId}` }, invalidateAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "featured_sections", filter: `restaurant_id=eq.${restaurantId}` }, invalidateFeatured)
      .on("postgres_changes", { event: "*", schema: "public", table: "builders", filter: `restaurant_id=eq.${restaurantId}` }, invalidateFeatured)
      .on("postgres_changes", { event: "*", schema: "public", table: "customer_favorites", filter: `restaurant_id=eq.${restaurantId}` }, invalidateFeatured)
      .on("postgres_changes", { event: "*", schema: "public", table: "reviews", filter: `restaurant_id=eq.${restaurantId}` }, invalidateReviews)
      .subscribe();
    return () => { supabase.removeChannel(channel); };

  }, [data?.restaurant?.id, slug, qc]);

  const restaurantId = data?.restaurant?.id as string | undefined;

  const { data: reviewStats } = useQuery({
    queryKey: ["public-review-stats", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data: rows } = await (supabase as any)
        .from("reviews")
        .select("rating")
        .eq("restaurant_id", restaurantId);
      const list = (rows ?? []) as { rating: number }[];
      const count = list.length;
      const avg = count ? list.reduce((s, r) => s + Number(r.rating || 0), 0) / count : 0;
      return { count, avg };
    },
  });




  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = sessionStorage.getItem(`cart:${slug}`);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [openSheet, setOpenSheet] = useState(false);
  const [activeCat, setActiveCat] = useState<string | undefined>(undefined);
  const [builderUnavailableOpen, setBuilderUnavailableOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [catsSheetOpen, setCatsSheetOpen] = useState(false);
  const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const q = normalize(query.trim());
  const matchesQuery = (it: any) => {
    if (!q) return true;
    return normalize(String(it.name ?? "")).includes(q) || normalize(String(it.description ?? "")).includes(q);
  };

  useEffect(() => {
    if (!activeCat && data?.categories?.[0]?.id) setActiveCat(data.categories[0].id);
  }, [data, activeCat]);

  // Deep-link from Favoritos: /{slug}?add={menuItemId}
  const [addHandled, setAddHandled] = useState(false);
  useEffect(() => {
    if (addHandled || !data?.items?.length || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const addId = params.get("add");
    if (!addId) return;
    const item: any = (data.items as any[]).find((i) => i.id === addId);
    if (item) {
      const price = isPromoActiveNow(item) ? Number(item.promo_price) : Number(item.price);
      setCart((c) => {
        const found = c.find((x) => x.id === item.id);
        if (found) return c.map((x) => x.id === item.id ? { ...x, qty: x.qty + 1 } : x);
        return [...c, { id: item.id, name: item.name, price, qty: 1 }];
      });
      setOpenSheet(true);
      toast.success(`${item.name} adicionado`);
    } else {
      toast.error("Produto não está mais disponível");
    }
    params.delete("add");
    const q = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (q ? `?${q}` : ""));
    setAddHandled(true);
  }, [data, addHandled]);


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

  // Auto-redirect: se há pedido pendente para este restaurante, abre o
  // acompanhamento imediatamente (usuário voltou do gateway ou app).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const pending = sessionStorage.getItem(`pending-order:${slug}`);
      if (pending) {
        navigate({ to: "/pedido-sucesso/$id", params: { id: pending } });
      }
    } catch {}
  }, [slug, navigate]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`builder:add:${slug}`);
      if (!raw) return;
      const item = JSON.parse(raw) as { id: string; name: string; price: number };
      if (item?.id && item?.name && Number.isFinite(Number(item.price))) {
        setCart((c) => [...c, { ...item, price: Number(item.price), qty: 1 }]);
        setOpenSheet(true);
        toast.success("Item personalizado adicionado ao carrinho");
      }
      sessionStorage.removeItem(`builder:add:${slug}`);
    } catch {
      sessionStorage.removeItem(`builder:add:${slug}`);
    }
  }, [slug]);

  useEffect(() => {
    try {
      sessionStorage.setItem(`cart:${slug}`, JSON.stringify(cart));
    } catch {}
    setPendingCart(cart.length ? { slug, items: cart, updatedAt: new Date().toISOString() } : null);
    if (data?.restaurant?.slug) rememberRestaurantRoute(data.restaurant.slug, { pendingCart: cart.length ? { slug, items: cart, updatedAt: new Date().toISOString() } : null });
  }, [cart, slug, setPendingCart, data?.restaurant?.slug, rememberRestaurantRoute]);

  // Favorites state (per restaurant) for the current authenticated customer
  const { isAuthenticated, session } = useCustomerAuth();
  

  const [favItems, setFavItems] = useState<Set<string>>(new Set());
  const [favBuilders, setFavBuilders] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!isAuthenticated || !restaurantId) {
      setFavItems(new Set());
      setFavBuilders(new Set());
      return;
    }
    let active = true;
    fetchFavoriteIdsForRestaurant(restaurantId).then(({ items, builders }) => {
      if (!active) return;
      setFavItems(items);
      setFavBuilders(builders);
    });
    return () => { active = false; };
  }, [isAuthenticated, restaurantId]);

  const status = useRestaurantStatus({
    is_open: data?.restaurant?.is_open,
    opening_hours: data?.restaurant?.opening_hours,
  });

  async function handleToggleFavorite(kind: "menu_item" | "builder", itemId: string) {
    if (!isAuthenticated) {
      toast.info("Entre na sua conta para favoritar este produto.");
      const redirect = prepareLoginRedirect(slug);
      navigate({ to: "/entrar", search: { redirect } });
      return;
    }
    if (!restaurantId) return;
    const setter = kind === "menu_item" ? setFavItems : setFavBuilders;
    // optimistic
    setter((prev) => {
      const next = new Set(prev);
      next.has(itemId) ? next.delete(itemId) : next.add(itemId);
      return next;
    });
    try {
      await toggleFav({ restaurantId, kind, itemId });
    } catch (e: any) {
      // revert on error
      setter((prev) => {
        const next = new Set(prev);
        next.has(itemId) ? next.delete(itemId) : next.add(itemId);
        return next;
      });
      toast.error(e?.message ?? "Não foi possível atualizar favoritos");
    }
  }


  const add = (it: { id: string; name: string; price: number }) =>
    setCart((c) => {
      const found = c.find((x) => x.id === it.id);
      if (found) return c.map((x) => x.id === it.id ? { ...x, qty: x.qty + 1 } : x);
      return [...c, { ...it, qty: 1 }];
    });
  const dec = (id: string) => setCart((c) => c.flatMap((x) => x.id === id ? (x.qty <= 1 ? [] : [{ ...x, qty: x.qty - 1 }]) : [x]));

  const subtotal = useMemo(() => cart.reduce((s, x) => s + x.price * x.qty, 0), [cart]);
  const totalQty = cart.reduce((s, x) => s + x.qty, 0);

  const [addedSheet, setAddedSheet] = useState<AddedItem | null>(null);
  const addAndPrompt = (raw: { id: string; name: string; price: number; image_url?: string | null }) => {
    add({ id: raw.id, name: raw.name, price: raw.price });
    setAddedSheet({ id: raw.id, name: raw.name, price: raw.price, qty: 1, image_url: raw.image_url ?? null });
  };
  const suggestions = useMemo(() => {
    const items = (data?.items ?? []) as any[];
    const inCart = new Set(cart.map((c) => c.id));
    const lastId = addedSheet?.id;
    const available = items.filter((i) => i.is_available !== false && !inCart.has(i.id) && i.id !== lastId);
    const min = Number(data?.restaurant?.min_order ?? 0);
    const missing = Math.max(0, min - subtotal);
    const priceOf = (i: any) => Number(isPromoActiveNow(i) ? i.promo_price : i.price);
    const catName = (i: any) => {
      const cat = (data?.categories ?? []).find((c: any) => c.id === i.category_id);
      return (cat?.name ?? "").toLowerCase();
    };
    const scored = available.map((i) => {
      const p = priceOf(i);
      const isComplement = /bebida|sobremesa|acompanh|adicional|complement/i.test(catName(i)) ? -5 : 0;
      const distance = missing > 0 ? Math.abs(p - missing) : Math.abs(p - 15);
      return { item: i, score: distance + isComplement };
    }).sort((a, b) => a.score - b.score);
    return scored.slice(0, 6).map((s) => s.item);
  }, [data?.items, data?.categories, data?.restaurant?.min_order, cart, subtotal, addedSheet?.id]);


  const openBuilder = (builder: Builder) => {
    const builderStatus = getRestaurantStatus({
      is_open: data?.restaurant?.is_open,
      opening_hours: data?.restaurant?.opening_hours,
    });
    if (!builderStatus.isOpen) {
      toast.error("Restaurante fechado");
      return;
    }
    if (!data?.restaurant?.builders_enabled) {
      setBuilderUnavailableOpen(true);
      return;
    }
    navigate({ to: "/$slug/montar", params: { slug }, search: { builder: builder.id } as any });
  };


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

  if (!data || !data.restaurant || isError) {
    // Diagnostic logs — required for mobile troubleshooting
    if (typeof window !== "undefined") {
      console.log("[PUBLIC MENU]");
      console.log("pathname:", window.location.pathname);
      console.log("slug:", slug);
      console.log("session:", session?.user?.id ?? null);
      console.log("query error:", error);
      console.log("query data:", data);
      console.log("navigator.userAgent:", navigator.userAgent);
      console.log("online:", navigator.onLine);
    }

    // Scenario detection
    const emptySlug = !slug || !slug.trim();
    const offline = typeof navigator !== "undefined" && !navigator.onLine;
    const anyErr = error as any;
    const isNetworkError =
      offline ||
      (anyErr && (anyErr.message === "Failed to fetch" || /NetworkError|fetch/i.test(String(anyErr?.message ?? ""))));
    const isSupabaseError = !!anyErr && !isNetworkError;

    let title = "Restaurante não encontrado";
    let message = "Verifique o link e tente novamente.";
    let detail: string | null = null;

    if (emptySlug) {
      title = "Link inválido";
      message = "Nenhum identificador de restaurante foi informado na URL.";
    } else if (offline) {
      title = "Você está offline";
      message = "Verifique sua conexão com a internet e tente novamente.";
    } else if (isNetworkError) {
      title = "Falha de rede";
      message = "Não foi possível alcançar o servidor. Tente novamente em instantes.";
      detail = anyErr?.message ?? null;
    } else if (isSupabaseError) {
      title = "Erro ao carregar o cardápio";
      message = "Ocorreu um erro ao consultar o estabelecimento.";
      detail = anyErr?.message ?? String(anyErr);
    } else {
      // Restaurante realmente não existe mais no banco.
      title = "Este estabelecimento não está mais disponível.";
      message = "";
    }

    const isGone = !emptySlug && !offline && !isNetworkError && !isSupabaseError;

    return (
      <div className="grid min-h-screen place-items-center px-4 text-center">
        <div className="max-w-md">
          <h1 className="font-display text-3xl font-extrabold">{title}</h1>
          {message && <p className="mt-2 text-muted-foreground">{message}</p>}
          {detail && (
            <p className="mt-3 break-words rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              {detail}
            </p>
          )}
          {!isGone && (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => window.location.reload()}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                Tentar novamente
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }


  const { restaurant, categories, items, builders } = data as { restaurant: any; categories: any[]; items: any[]; builders: any[] };

  const effectiveOpen = status.isOpen;
  if (typeof window !== "undefined") {
    // eslint-disable-next-line no-console
    console.log("[status:public]", {
      manualStatus: status.manualStatus,
      isOpen: status.isOpen,
      todaySchedule: restaurant?.opening_hours ?? null,
      computedStatus: status.reason,
    });
  }


  return (
    <div className="min-h-screen bg-muted/30 pb-36">
      {/* cover */}
      <div className="relative h-[200px] w-full overflow-hidden rounded-b-2xl bg-gradient-warm" style={{ zIndex: 1 }}>
        {restaurant.cover_url && <img src={restaurant.cover_url} alt="" className="h-full w-full object-cover" />}
      </div>

      <div className="mx-auto max-w-3xl px-4">
        {/* premium store card */}
        <Card className="relative rounded-3xl border bg-card p-5 shadow-premium" style={{ marginTop: "-50px", zIndex: 5 }}>
          {/* logo absolute inside card */}
          <div className="absolute" style={{ top: "-45px", left: "24px", zIndex: 10 }}>
            {restaurant.logo_url ? (
              <img
                src={restaurant.logo_url}
                alt={restaurant.name}
                className="h-24 w-24 rounded-2xl border-4 border-card bg-white object-cover shadow-elegant"
              />
            ) : (
              <div className="grid h-24 w-24 place-items-center rounded-2xl border-4 border-card bg-gradient-warm text-3xl font-extrabold text-primary-foreground shadow-elegant">
                {restaurant.name[0]}
              </div>
            )}
          </div>

          {/* content shifted right of logo */}
          <div style={{ paddingLeft: "112px", minHeight: "80px" }}>
            <h1 className="truncate font-display text-xl font-extrabold leading-tight sm:text-2xl">{restaurant.name}</h1>
            <div className="flex flex-wrap items-center gap-2" style={{ marginTop: "8px" }}>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${effectiveOpen ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                {effectiveOpen ? "● Aberto" : "● Fechado"}
              </span>
              <span className="inline-flex items-center gap-1 text-sm">
                <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                {reviewStats && reviewStats.count > 0 ? (
                  <span className="font-semibold">
                    {reviewStats.avg.toFixed(1).replace(".", ",")}
                    <span className="ml-1 font-normal text-muted-foreground">
                      ({reviewStats.count} {reviewStats.count === 1 ? "avaliação" : "avaliações"})
                    </span>
                  </span>
                ) : (
                  <span className="font-semibold text-muted-foreground">Novo</span>
                )}
              </span>

              {restaurant.category && (
                <span className="text-xs text-muted-foreground">· {restaurant.category}</span>
              )}
            </div>
          </div>

          {restaurant.description && (
            <p className="line-clamp-2 text-sm text-muted-foreground" style={{ marginTop: "8px" }}>{restaurant.description}</p>
          )}

          {(() => {
            const PAYMENT_LABELS: Record<string, string> = {
              pix: "Pix", cash: "Dinheiro", credit: "Crédito", debit: "Débito",
              meal_voucher: "VR", food_voucher: "VA", ticket: "Ticket", alelo: "Alelo",
              sodexo: "Sodexo", vr: "VR", ben: "Ben",
              online_pix: "Pix online", online_credit: "Crédito online", online_debit: "Débito online", online_card: "Cartão online",
              apple_pay: "Apple Pay", google_pay: "Google Pay",
            };
            const pm = (restaurant.payment_methods ?? {}) as Record<string, boolean>;
            const enabled = Object.entries(pm).filter(([, v]) => v).map(([k]) => PAYMENT_LABELS[k] ?? k);
            const paymentsSummary = enabled.length === 0
              ? "—"
              : enabled.length <= 2
                ? enabled.join(" • ")
                : `${enabled.slice(0, 2).join(" • ")} +${enabled.length - 2}`;

            const avgDel = Number(restaurant.avg_delivery_minutes ?? 0);
            const avgPick = Number(restaurant.avg_pickup_minutes ?? 0);
            const timeLabel = restaurant.delivery_time?.trim()
              ? restaurant.delivery_time
              : avgDel > 0
                ? `${Math.max(10, avgDel - 10)}–${avgDel + 5} min`
                : "—";
            const modality = avgDel > 0 && avgPick > 0
              ? "Entrega e Retirada"
              : avgPick > 0
                ? "Retirada"
                : "Entrega";

            return (
              <div className="grid grid-cols-3 gap-2 sm:gap-3" style={{ marginTop: "20px" }}>
                <div className="rounded-2xl border bg-muted/40 px-2 py-3 text-center">
                  <div className="mb-1 text-lg leading-none">🕒</div>
                  <p className="text-xs font-bold text-foreground sm:text-sm">{timeLabel}</p>
                  <p className="text-[10px] text-muted-foreground sm:text-xs">Tempo</p>
                </div>
                <div className="rounded-2xl border bg-muted/40 px-2 py-3 text-center">
                  <div className="mb-1 text-lg leading-none">🚚</div>
                  <p className="text-xs font-bold leading-tight text-foreground sm:text-sm">{modality}</p>
                  <p className="text-[10px] text-muted-foreground sm:text-xs">Modalidade</p>
                </div>
                <div className="rounded-2xl border bg-muted/40 px-2 py-3 text-center">
                  <div className="mb-1 text-lg leading-none">💳</div>
                  <p className="line-clamp-1 text-xs font-bold text-foreground sm:text-sm">{paymentsSummary}</p>
                  <p className="text-[10px] text-muted-foreground sm:text-xs">Pagamentos</p>
                </div>
              </div>
            );
          })()}
        </Card>

        {/* quick access buttons */}
        <div className="mt-5 grid grid-cols-4 gap-2 sm:gap-3">
          {[
            { tab: "avaliacoes", icon: Star, label: "Avaliações" },
            { tab: "horarios", icon: Clock, label: "Horários" },
            { tab: "info", icon: ImageIcon, label: "Informações" },
            { tab: "pagamentos", icon: Ticket, label: "Pagamentos" },
          ].map((b) => (
            <Link
              key={b.tab}
              to="/$slug/sobre"
              params={{ slug }}
              search={{ tab: b.tab }}
              className="group flex flex-col items-center gap-1.5 rounded-2xl border bg-card p-3 shadow-elegant transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-premium"
            >
              <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                <b.icon className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-semibold sm:text-xs">{b.label}</span>
            </Link>
          ))}
        </div>


        {/* 🔥 Promoções do Dia */}
        {(() => {
          const promos = (items as any[])
            .filter((i) => isPromoActiveNow(i))
            .map((i) => ({ ...i, _pct: Math.round((1 - Number(i.promo_price) / Number(i.price)) * 100) }))
            .sort((a, b) =>
              b._pct - a._pct ||
              Number(!!b.is_featured) - Number(!!a.is_featured) ||
              Number(!!b.is_bestseller) - Number(!!a.is_bestseller) ||
              (a.position ?? 0) - (b.position ?? 0),
            );
          if (promos.length === 0) return null;
          return (
            <section id="sec-promos" className="mt-6 scroll-mt-24 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-xl font-extrabold tracking-tight">🔥 Promoções do Dia</h2>
                <span className="text-xs font-semibold text-muted-foreground">{promos.length} {promos.length === 1 ? "oferta" : "ofertas"}</span>
              </div>
              <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {promos.map((it: any) => (
                  <Card
                    key={`promo-${it.id}`}
                    className="group relative flex w-[200px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border-2 border-destructive/20 bg-card shadow-sm transition hover:shadow-elegant sm:w-[220px]"
                  >
                    <div className="absolute left-2 top-2 z-10 flex flex-col gap-1">
                      <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-destructive-foreground shadow">
                        Promoção
                      </span>
                      <span className="rounded-full bg-foreground px-2 py-0.5 text-center text-[10px] font-extrabold text-background shadow">
                        -{it._pct}%
                      </span>
                    </div>
                    <button
                      type="button"
                      aria-label="Favoritar"
                      onClick={(e) => { e.stopPropagation(); handleToggleFavorite("menu_item", it.id); }}
                      className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-background/90 text-foreground shadow-sm backdrop-blur transition hover:scale-105"
                    >
                      <Heart className={`h-4 w-4 ${favItems.has(it.id) ? "fill-rose-500 text-rose-500" : "text-muted-foreground"}`} />
                    </button>
                    <div className="relative h-32 w-full bg-muted">
                      {it.image_url ? (
                        <img src={it.image_url} alt={it.name} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-muted-foreground">
                          <ImageIcon className="h-6 w-6" />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col gap-1 p-3">
                      <h3 className="line-clamp-1 text-sm font-bold leading-snug">{it.name}</h3>
                      {it.description && <p className="line-clamp-2 text-xs text-muted-foreground">{it.description}</p>}
                      <div className="mt-auto flex items-baseline gap-2 pt-2">
                        <span className="font-display text-base font-extrabold text-primary">{brl(it.promo_price)}</span>
                        <span className="text-xs text-muted-foreground line-through">{brl(it.price)}</span>
                      </div>
                      <Button
                        size="sm"
                        className="mt-2 w-full rounded-xl"
                        disabled={!effectiveOpen}
                        onClick={() => addAndPrompt({ id: it.id, name: it.name, price: Number(it.promo_price), image_url: it.image_url })}
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          );
        })()}

        {/* 🍕 Monte do Seu Jeito */}
        {restaurant.builders_enabled && builders && builders.length > 0 && (
          <section id="sec-monte" className="mt-6 scroll-mt-24 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-xl font-extrabold tracking-tight">🍕 Monte do Seu Jeito</h2>
              <span className="text-xs font-semibold text-muted-foreground">{builders.length} {builders.length === 1 ? "opção" : "opções"}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {builders.map((b: any) => (
                <div
                  key={b.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openBuilder(b as Builder)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") openBuilder(b as Builder); }}
                  className="group relative flex cursor-pointer items-center gap-3 overflow-hidden rounded-2xl border-2 border-primary/15 bg-gradient-to-br from-primary/5 to-transparent p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elegant"
                >
                  <button
                    type="button"
                    aria-label="Favoritar"
                    onClick={(e) => { e.stopPropagation(); handleToggleFavorite("builder", b.id); }}
                    className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-background/90 text-foreground shadow-sm backdrop-blur transition hover:scale-105"
                  >
                    <Heart className={`h-4 w-4 ${favBuilders.has(b.id) ? "fill-rose-500 text-rose-500" : "text-muted-foreground"}`} />
                  </button>
                  <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-card text-3xl shadow-sm">
                    {b.image_url ? <img src={b.image_url} alt="" className="h-full w-full rounded-2xl object-cover" /> : (b.emoji ?? "✨")}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[10px] font-bold uppercase tracking-wide text-primary">Personalizado</span>
                    </div>
                    <h3 className="font-display text-base font-extrabold leading-tight">{b.name}</h3>
                    {b.description && <p className="line-clamp-1 text-xs text-muted-foreground">{b.description}</p>}
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
                      Começar <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              ))}

            </div>
          </section>
        )}

        <FeaturedSections
          slug={slug}
          effectiveOpen={effectiveOpen}
          onAdd={(it) => addAndPrompt({ id: it.id, name: it.name, price: Number(it.promo_price ?? it.price), image_url: (it as any).image_url })}
          onOpenBuilder={(builderId) => navigate({ to: "/$slug/montar", params: { slug }, search: { builder: builderId } as any })}
        />


        {/* smart sticky category menu */}
        <SmartCategoryMenu
          slug={slug}
          categories={categories}
          items={items}
          promoCount={(items as any[]).filter((i) => isPromoActiveNow(i) && matchesQuery(i)).length}
          builderCount={restaurant.builders_enabled && !q ? (builders?.length ?? 0) : 0}
          query={query}
          onQueryChange={setQuery}
          matchesQuery={matchesQuery}
        />

        <div className="mt-5 space-y-7">
          {(() => {
            const visibleCats = categories
              .map((cat) => ({ cat, catItems: items.filter((i) => i.category_id === cat.id && matchesQuery(i)) }))
              .filter(({ catItems }) => catItems.length > 0);
            const totalMatches = visibleCats.reduce((n, c) => n + c.catItems.length, 0);
            if (q && totalMatches === 0) {
              return (
                <Card className="flex flex-col items-center gap-3 rounded-2xl p-10 text-center text-muted-foreground">
                  <Search className="h-8 w-8 opacity-60" />
                  <div>
                    <p className="font-semibold text-foreground">Nenhum item encontrado para “{query}”.</p>
                    <p className="text-sm">Tente outro termo ou limpe a busca.</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setQuery("")}>Limpar busca</Button>
                </Card>
              );
            }
            return (
              <>
                {visibleCats.map(({ cat, catItems }) => (
                  <section key={cat.id} id={`cat-${cat.id}`} className="scroll-mt-20 animate-fade-in">
                    <h2 className="mb-3 font-display text-xl font-extrabold tracking-tight">{cat.name}</h2>
                    <div className="grid gap-3">
                      {catItems.map((it: any) => {
                        const hasPromo = isPromoActiveNow(it);
                        return (
                          <Card key={it.id} className="group relative flex items-stretch gap-3 overflow-hidden rounded-2xl border bg-card p-3 shadow-sm transition hover:shadow-elegant">
                            <button
                              type="button"
                              aria-label="Favoritar"
                              onClick={(e) => { e.stopPropagation(); handleToggleFavorite("menu_item", it.id); }}
                              className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-background/90 text-foreground shadow-sm backdrop-blur transition hover:scale-105"
                            >
                              <Heart className={`h-4 w-4 ${favItems.has(it.id) ? "fill-rose-500 text-rose-500" : "text-muted-foreground"}`} />
                            </button>

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
                                disabled={!effectiveOpen}
                                onClick={() => addAndPrompt({ id: it.id, name: it.name, price: Number(hasPromo ? it.promo_price : it.price), image_url: it.image_url })}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </section>
                ))}
                {items.length === 0 && (
                  <Card className="rounded-2xl p-12 text-center text-muted-foreground">Cardápio em montagem. Volte em breve!</Card>
                )}
              </>
            );
          })()}
        </div>

        {/* Floating "Categorias" button — primary nav aid on long menus */}
        {categories.length > 3 && (
          <Sheet open={catsSheetOpen} onOpenChange={setCatsSheetOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Ver categorias do cardápio"
                className="fixed right-4 z-30 inline-flex items-center gap-2 rounded-full bg-primary pl-4 pr-5 py-3 text-primary-foreground shadow-float transition hover:scale-105 active:scale-95"
                style={{ bottom: "calc(140px + env(safe-area-inset-bottom))" }}
              >
                <Menu className="h-5 w-5" />
                <span className="text-sm font-bold">Categorias</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[80vh] rounded-t-3xl">
              <SheetHeader>
                <SheetTitle className="font-display text-xl">Categorias</SheetTitle>
              </SheetHeader>
              <div className="mt-4 grid grid-cols-2 gap-2 overflow-y-auto pb-4">
                {categories
                  .map((c) => ({ c, count: items.filter((i) => i.category_id === c.id && matchesQuery(i)).length }))
                  .filter(({ count }) => count > 0)
                  .map(({ c, count }) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setCatsSheetOpen(false);
                        setTimeout(() => {
                          const el = document.getElementById(`cat-${c.id}`);
                          if (!el) return;
                          const top = el.getBoundingClientRect().top + window.scrollY - 80;
                          window.scrollTo({ top, behavior: "smooth" });
                        }, 150);
                      }}
                      className="flex items-center justify-between gap-2 rounded-2xl border bg-card px-4 py-3 text-left font-semibold transition hover:border-primary/40 hover:bg-primary/5"
                    >
                      <span className="truncate">{c.name}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{count}</span>
                    </button>
                  ))}
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>

      <Dialog open={builderUnavailableOpen} onOpenChange={setBuilderUnavailableOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Monte do seu jeito estará disponível em breve.</DialogTitle>
            <DialogDescription>
              O restaurante ainda está preparando essa experiência personalizada.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {/* floating cart — sits above the BottomNav */}
      {totalQty > 0 && (
        <div
          className="fixed inset-x-0 z-30 px-3 pt-2 animate-in slide-in-from-bottom-2 duration-300"
          style={{ bottom: "calc(64px + env(safe-area-inset-bottom))" }}
        >
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
              <CheckoutSheet restaurant={restaurant} cart={cart} subtotal={subtotal} dec={dec} add={add} onClose={() => setOpenSheet(false)} onCreated={(orderId) => {
                setCart([]);
                try {
                  sessionStorage.removeItem(`cart:${slug}`);
                  sessionStorage.removeItem(`repeat:${slug}`);
                  sessionStorage.removeItem(`builder:add:${slug}`);
                } catch {}
                setPendingCart(null);
                navigate({ to: "/pedido-sucesso/$id", params: { id: orderId } });
              }} />
            </Sheet>
          </div>
        </div>
      )}
      <AddedToCartSheet
        open={!!addedSheet}
        onOpenChange={(o) => { if (!o) setAddedSheet(null); }}
        lastAdded={addedSheet}
        subtotal={subtotal}
        minOrder={Number(restaurant.min_order ?? 0)}
        suggestions={suggestions}
        onAddSuggestion={(it: any) => {
          const price = Number(isPromoActiveNow(it) ? it.promo_price : it.price);
          add({ id: it.id, name: it.name, price });
          setAddedSheet({ id: it.id, name: it.name, price, qty: 1, image_url: it.image_url ?? null });
        }}
        onContinue={() => setAddedSheet(null)}
        onGoToCart={() => { setAddedSheet(null); setOpenSheet(true); }}
      />
    </div>
  );
}

function CheckoutSheet({ restaurant, cart, subtotal, dec, add, onClose, onCreated }: {
  restaurant: any; cart: CartItem[]; subtotal: number;
  dec: (id: string) => void; add: (it: { id: string; name: string; price: number }) => void;
  onClose: () => void;
  onCreated: (orderId: string) => void;
}) {
  const { user } = useCustomerAuth();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  type PayOption = { id: string; label: string; method: CheckoutMethod; online?: boolean };
  const BASE_METHODS: PayOption[] = [
    { id: "cash", label: "Dinheiro", method: "cash" },
    { id: "card_delivery", label: "Cartão na entrega", method: "credit_card" },
    { id: "meal_voucher", label: "Cartão Alimentação/Refeição", method: "meal_voucher" },
  ];
  const { data: readiness } = useQuery({
    queryKey: ["payments-readiness", restaurant.id],
    enabled: !!restaurant?.id,
    queryFn: () => PaymentsReadinessService.isReadyForPayments(restaurant.id),
    staleTime: 60_000,
  });
  const { data: primaryProviderId } = useQuery({
    queryKey: ["primary-provider", restaurant.id],
    enabled: !!restaurant?.id,
    queryFn: () => PaymentService.getPrimaryProvider(restaurant.id),
    staleTime: 60_000,
  });
  const gateway = getGatewayDisplay(primaryProviderId);
  const paymentOptions: PayOption[] = readiness?.ready
    ? [
        { id: "pix", label: gateway.pix, method: "pix", online: true },
        { id: "card_online", label: `${gateway.card} Online`, method: "credit_card", online: true },
        ...BASE_METHODS,
      ]
    : BASE_METHODS;

  const [paymentId, setPaymentId] = useState<string>("pix");
  const selectedPayment = paymentOptions.find((p) => p.id === paymentId) ?? paymentOptions[0];
  const [notes, setNotes] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<"list" | "form">("list");

  // Guest / manual fallback — endereço inteligente compartilhado com /$slug/checkout
  const [smartAddress, setSmartAddress] = useState<SelectedAddress | null>(null);


  const fee = Number(restaurant.delivery_fee ?? 0);
  const min = Number(restaurant.min_order ?? 0);
  const effectiveOpen = getRestaurantStatus({
    is_open: restaurant?.is_open,
    opening_hours: restaurant?.opening_hours,
  }).isOpen;

  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discountPercent: number } | null>(null);
  const [validating, setValidating] = useState(false);
  const checkCoupon = useServerFn(validateCoupon);

  // Load profile prefill (name, phone, last payment)
  const { data: profile } = useQuery({
    queryKey: ["customer-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("customer_profiles")
        .select("full_name, phone, whatsapp, last_payment_method")
        .eq("id", user!.id)
        .maybeSingle();
      return data as any;
    },
  });

  // Load saved addresses
  const { data: addresses = [] } = useQuery({
    queryKey: ["customer-addresses", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("customer_addresses")
        .select("*")
        .eq("customer_id", user!.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true });
      return (data ?? []) as any[];
    },
  });

  // Prefill name/phone from profile or auth metadata once
  useEffect(() => {
    if (!user) return;
    const meta = (user.user_metadata ?? {}) as Record<string, any>;
    if (!name) setName(profile?.full_name || meta.full_name || meta.name || "");
    if (!phone) setPhone(profile?.phone || profile?.whatsapp || "");
    if (profile?.last_payment_method) {
      const match = paymentOptions.find((p) => p.label === profile.last_payment_method || p.id === profile.last_payment_method);
      if (match) setPaymentId(match.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile]);

  // Auto-select default address
  useEffect(() => {
    if (!selectedAddressId && addresses.length > 0) {
      const def = addresses.find((a: any) => a.is_default) ?? addresses[0];
      setSelectedAddressId(def.id);
    }
  }, [addresses, selectedAddressId]);

  const selectedAddress = addresses.find((a: any) => a.id === selectedAddressId) ?? null;

  const discount = coupon ? +(subtotal * (coupon.discountPercent / 100)).toFixed(2) : 0;
  const belowMin = subtotal < min;

  const create = useServerFn(createCheckoutOrder);
  const preview = useServerFn(previewCheckoutPricing);
  const [pricing, setPricing] = useState<{
    subtotal: number; deliveryFee: number; platformFee: number; couponDiscount: number; customerTotal: number;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!subtotal) { setPricing(null); return; }
    preview({
      data: {
        subtotal,
        deliveryFee: fee,
        couponDiscount: discount,
        paymentMethod: selectedPayment.method,
      },
    })
      .then((r) => { if (!cancelled && r.ok) setPricing(r.pricing as any); })
      .catch(() => { /* silencioso — fallback para cálculo local */ });
    return () => { cancelled = true; };
  }, [subtotal, fee, discount, selectedPayment.method, preview]);

  const total = pricing?.customerTotal ?? Math.max(0, subtotal - discount) + fee;
  const platformFee = pricing?.platformFee ?? 0;

  async function applyCoupon() {
    if (!couponInput.trim()) return;
    setValidating(true);
    try {
      const res = await checkCoupon({ data: { slug: restaurant.slug, code: couponInput.trim() } });
      if (!res.valid) { setCoupon(null); toast.error(res.reason); return; }
      setCoupon({ code: couponInput.trim().toUpperCase(), discountPercent: res.discountPercent });
      toast.success(`Cupom aplicado: -${res.discountPercent}%`);
    } finally {
      setValidating(false);
    }
  }

  function buildAddressString(): string | null {
    if (selectedAddress) {
      const line = [selectedAddress.street, selectedAddress.number].filter(Boolean).join(", ");
      const parts = [line];
      if (selectedAddress.complement) parts.push(selectedAddress.complement);
      if (selectedAddress.neighborhood) parts.push(selectedAddress.neighborhood);
      if (selectedAddress.city) parts.push(`${selectedAddress.city}${selectedAddress.state ? "/" + selectedAddress.state : ""}`);
      return parts.filter(Boolean).join(" — ");
    }
    if (smartAddress && (smartAddress.number || smartAddress.numberOverride)) {
      return formatFullAddress(smartAddress);
    }
    return null;
  }

  async function confirmOrder() {
    if (!name.trim() || !phone.trim()) { toast.error("Preencha nome e telefone"); return; }
    const fullAddress = buildAddressString();
    if (!fullAddress) { toast.error("Selecione ou informe um endereço de entrega"); return; }
    if (belowMin) { toast.error(`Pedido mínimo de ${brl(min)}`); return; }
    if (!cart.length) { toast.error("Seu carrinho está vazio"); return; }

    setSubmitting(true);
    try {
      const res = await create({
        data: {
          restaurantSlug: restaurant.slug,
          customer: { name, phone, address: fullAddress, notes: notes || undefined },
          items: cart.map((c) => ({ id: c.id, name: c.name, price: c.price, qty: c.qty })),
          paymentMethod: selectedPayment.method,
          deliveryFee: fee,
          couponCode: coupon?.code ?? undefined,
          couponDiscount: discount,
        },
      });

      // Persist profile prefill for next orders (best-effort)
      if (user) {
        try {
          await (supabase as any)
            .from("customer_profiles")
            .upsert({
              id: user.id,
              full_name: name,
              phone,
              whatsapp: phone,
              last_payment_method: selectedPayment.label,
            }, { onConflict: "id" });
          qc.invalidateQueries({ queryKey: ["customer-profile", user.id] });
        } catch {}
      }

      // Cartão/Pix Online — via PaymentService (Provider Pattern).
      if (selectedPayment.online) {
        try {
          const email = user?.email;
          if (!email) {
            toast.error("Faça login com e-mail para pagar online");
            onClose();
            onCreated(res.orderId);
            return;
          }
          const origin = window.location.origin;

          const result = await PaymentService.createPayment({
            restaurantId: restaurant.id,
            orderId: res.orderId,
            method: selectedPayment.method === "pix" ? "pix" : "card",
            amount: Number(res.pricing?.customerTotal ?? 0),
            customerEmail: email,
            successUrl: `${origin}/pedido-sucesso/${res.orderId}`,
            cancelUrl: `${origin}/${restaurant.slug}`,
          });

          if (result.redirectUrl) {
            onClose();
            window.location.href = result.redirectUrl;
            return;
          }
          throw new Error("Gateway não retornou URL de pagamento");
        } catch (e: any) {
          toast.error(e?.message ?? "Não foi possível iniciar o pagamento");
          onClose();
          onCreated(res.orderId);
          return;
        }
      }

      toast.success(`Pedido #${res.orderNumber ?? ""} criado — aguardando pagamento`);
      onClose();
      onCreated(res.orderId);
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível criar o pedido");
    } finally {
      setSubmitting(false);
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
        <div className="space-y-1.5"><Label>Telefone / WhatsApp</Label><Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" /></div>

        {/* Endereço */}
        {user ? (
          <div className="space-y-2">
            <Label>Entregar em</Label>
            {selectedAddress ? (
              <Card className="border-primary/30 bg-primary/5 p-3">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                    📍
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      {selectedAddress.label}
                      {selectedAddress.is_default && (
                        <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">Principal</span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[selectedAddress.street, selectedAddress.number].filter(Boolean).join(", ")}
                      {selectedAddress.complement ? ` — ${selectedAddress.complement}` : ""}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{selectedAddress.neighborhood}</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => { setPickerMode("list"); setPickerOpen(true); }}>
                    Alterar endereço
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => { setPickerMode("form"); setPickerOpen(true); }}>
                    <Plus className="mr-1 h-3.5 w-3.5" /> Novo endereço
                  </Button>
                </div>
              </Card>
            ) : (
              <Button variant="outline" className="w-full" onClick={() => { setPickerMode("form"); setPickerOpen(true); }}>
                <Plus className="mr-1.5 h-4 w-4" /> Adicionar endereço de entrega
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Endereço de entrega</Label>
            <AddressAutocomplete
              value={smartAddress}
              onChange={setSmartAddress}
              restaurantSlug={restaurant.slug}
            />
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 space-y-5 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div className="flex-1 space-y-2">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">🚀 Compre mais rápido!</h3>
                    <p className="text-xs text-muted-foreground">Entre na sua conta e tenha vantagens:</p>
                  </div>
                  <ul className="grid gap-1 text-xs text-foreground/90 sm:grid-cols-2">
                    <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-primary" /> Endereços salvos</li>
                    <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-primary" /> Acompanhe seus pedidos</li>
                    <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-primary" /> Refaça pedidos em segundos</li>
                    <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-primary" /> Ofertas exclusivas</li>
                  </ul>
                </div>
              </div>

              <div className="rounded-xl border border-primary/15 bg-background/70 p-3 backdrop-blur-sm sm:p-4">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Gift className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Benefícios exclusivos</h4>
                    <p className="text-[11px] text-muted-foreground">Programa de Fidelidade Localix</p>
                  </div>
                </div>
                <ul className="grid gap-1.5 text-xs text-foreground/90 sm:grid-cols-2">
                  <li className="flex items-center gap-1.5"><Star className="h-3.5 w-3.5 text-amber-500" /> Acumule pontos a cada pedido</li>
                  <li className="flex items-center gap-1.5"><Ticket className="h-3.5 w-3.5 text-emerald-500" /> Troque pontos por descontos</li>
                  <li className="flex items-center gap-1.5"><Cake className="h-3.5 w-3.5 text-pink-500" /> Brindes em datas especiais</li>
                  <li className="flex items-center gap-1.5"><Flame className="h-3.5 w-3.5 text-orange-500" /> Promoções exclusivas</li>
                  <li className="flex items-center gap-1.5 sm:col-span-2"><Trophy className="h-3.5 w-3.5 text-yellow-500" /> Suba de nível e desbloqueie vantagens</li>
                </ul>
              </div>

              <p className="text-[11px] italic text-muted-foreground">
                Mais de 80% dos nossos clientes cadastrados aproveitam descontos e recompensas.
              </p>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button asChild size="sm" className="w-full transition-transform active:scale-[0.98] sm:w-auto sm:flex-1">
                  <Link to="/cliente">Entrar agora</Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="w-full transition-transform active:scale-[0.98] sm:w-auto sm:flex-1">
                  <Link to="/cliente">Criar conta gratuitamente</Link>
                </Button>
              </div>
              <p className="text-center text-[11px] text-muted-foreground">É rápido e gratuito.</p>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Forma de pagamento</Label>
          <div className="flex flex-wrap gap-2">
            {paymentOptions.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPaymentId(p.id)}
                className={`rounded-full border px-3 py-1.5 text-sm ${paymentId === p.id ? "border-primary bg-primary/10 text-primary" : ""}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {selectedPayment.online && (
            <p className="text-xs text-muted-foreground">Você será redirecionado para um ambiente seguro de pagamento.</p>
          )}
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
        <div className="flex justify-between"><span>Subtotal</span><span>{brl(pricing?.subtotal ?? subtotal)}</span></div>
        {discount > 0 && <div className="flex justify-between text-success"><span>Desconto ({coupon?.code})</span><span>-{brl(pricing?.couponDiscount ?? discount)}</span></div>}
        <div className="flex justify-between"><span>Entrega</span><span>{brl(pricing?.deliveryFee ?? fee)}</span></div>
        {platformFee > 0 && <div className="flex justify-between text-muted-foreground"><span>Taxa da plataforma</span><span>{brl(platformFee)}</span></div>}
        <div className="mt-1 flex justify-between border-t pt-2 font-display text-lg font-bold"><span>Total</span><span className="text-primary">{brl(total)}</span></div>
        {belowMin && <p className="mt-1 text-xs text-destructive">Pedido mínimo: {brl(min)}</p>}
      </div>

      <SheetFooter className="mt-5">
        <Button size="lg" className="w-full shadow-glow" onClick={confirmOrder} disabled={!effectiveOpen || belowMin || submitting}>
          {submitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
          {selectedPayment.online
            ? selectedPayment.method === "pix" ? "Pagar com Pix" : "Pagar com Cartão"
            : "Confirmar pedido"}

        </Button>
      </SheetFooter>

      {user && (
        <AddressPickerModal
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          userId={user.id}
          initialMode={pickerMode}
          onSelect={(a: CustomerAddress) => setSelectedAddressId(a.id)}
        />
      )}
    </SheetContent>
  );
}

function FeaturedSections({
  slug,
  effectiveOpen,
  onAdd,
  onOpenBuilder,
}: {
  slug: string;
  effectiveOpen: boolean;
  onAdd: (item: FeaturedItem) => void;
  onOpenBuilder: (builderId: string) => void;
}) {
  const fetchFeatured = useServerFn(getFeaturedSections);
  const { data } = useQuery({
    queryKey: ["featured-sections", slug],
    queryFn: () => fetchFeatured({ data: { slug } }),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });

  // Dedup: inline "🔥 Promoções do Dia" owns promotions; "🍕 Monte do Seu Jeito" owns builders.
  const sections = (data?.sections ?? []).filter(
    (s) => s.key !== "promotions" && s.key !== "half_half_pizza",
  );
  if (sections.length === 0) return null;

  return (
    <div className="mt-6 space-y-6">
      {sections.map((section: FeaturedSection) => {
        if (section.key === "half_half_pizza") {
          return (
            <button
              key={section.key}
              type="button"
              onClick={() => section.builderId && onOpenBuilder(section.builderId)}
              className="flex w-full items-center gap-3 rounded-2xl bg-gradient-warm p-4 text-left text-primary-foreground shadow-elegant transition hover:brightness-105"
            >
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary-foreground/15 text-2xl">
                {section.emoji}
              </div>
              <div className="flex-1">
                <p className="font-display text-base font-extrabold">{section.title}</p>
                <p className="text-xs opacity-90">{section.subtitle}</p>
              </div>
              <ChevronRight className="h-5 w-5" />
            </button>
          );
        }
        return (
          <section key={section.key} id={`feat-${section.key}`} className="scroll-mt-24">
            <div className="mb-2 flex items-end justify-between gap-2">
              <div>
                <h2 className="flex items-center gap-2 font-display text-lg font-extrabold">
                  <span>{section.emoji}</span> {section.title}
                </h2>
                <p className="text-xs text-muted-foreground">{section.subtitle}</p>
              </div>
            </div>
            <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {section.items.map((it) => {
                const price = it.promo_price ?? it.price;
                return (
                  <Card
                    key={`${section.key}-${it.id}`}
                    className="relative w-40 shrink-0 snap-start overflow-hidden rounded-2xl border shadow-sm"
                  >
                    <div className="relative h-28 w-full bg-muted">
                      {it.image_url ? (
                        <img src={it.image_url} alt={it.name} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-muted-foreground">
                          <ImageIcon className="h-6 w-6" />
                        </div>
                      )}
                      {it.promo_price != null && (
                        <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                          Oferta
                        </span>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="line-clamp-2 min-h-[2.4em] text-sm font-semibold leading-tight">{it.name}</p>
                      <div className="mt-2 flex items-baseline gap-1.5">
                        <span className="font-display text-base font-extrabold text-primary">{brl(price)}</span>
                        {it.promo_price != null && (
                          <span className="text-[10px] text-muted-foreground line-through">{brl(it.price)}</span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        className="mt-2 h-8 w-full rounded-full text-xs"
                        disabled={!effectiveOpen}
                        onClick={() => onAdd(it)}
                      >
                        <Plus className="mr-1 h-3 w-3" /> Adicionar
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function SmartCategoryMenu({
  slug,
  categories,
  items,
  promoCount,
  builderCount,
  query,
  onQueryChange,
  matchesQuery,
}: {
  slug: string;
  categories: any[];
  items: any[];
  promoCount: number;
  builderCount: number;
  query: string;
  onQueryChange: (v: string) => void;
  matchesQuery: (it: any) => boolean;
}) {
  const fetchFeatured = useServerFn(getFeaturedSections);
  const { data: featData } = useQuery({
    queryKey: ["featured-sections", slug],
    queryFn: () => fetchFeatured({ data: { slug } }),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });

  const hasQuery = query.trim().length > 0;

  const menuItems = useMemo(() => {
    const arr: { id: string; label: string; count: number }[] = [];
    if (!hasQuery && promoCount > 0) arr.push({ id: "sec-promos", label: "🔥 Promoções", count: promoCount });
    if (!hasQuery && builderCount > 0) arr.push({ id: "sec-monte", label: "🍕 Monte do Seu Jeito", count: builderCount });
    if (!hasQuery) {
      for (const s of (featData?.sections ?? []) as FeaturedSection[]) {
        if (s.key === "promotions" || s.key === "half_half_pizza") continue;
        if (!s.items?.length) continue;
        arr.push({ id: `feat-${s.key}`, label: `${s.emoji} ${s.title}`, count: s.items.length });
      }
    }
    for (const c of categories) {
      const count = items.filter((i) => i.category_id === c.id && matchesQuery(i)).length;
      if (count === 0) continue;
      arr.push({ id: `cat-${c.id}`, label: c.name, count });
    }
    return arr;
  }, [featData, categories, items, promoCount, builderCount, hasQuery, matchesQuery]);

  const [active, setActive] = useState<string | null>(null);
  const activePillRef = useRef<HTMLAnchorElement | null>(null);
  const pillsRowRef = useRef<HTMLDivElement | null>(null);
  const clickLockRef = useRef(0);

  useEffect(() => {
    if (menuItems.length === 0) return;
    const ids = menuItems.map((m) => m.id);
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (els.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (Date.now() < clickLockRef.current) return;
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -60% 0px", threshold: 0 },
    );
    for (const el of els) io.observe(el);
    return () => io.disconnect();
  }, [menuItems]);

  // Auto-highlight first matching category when searching
  useEffect(() => {
    if (!hasQuery) return;
    const first = menuItems.find((m) => m.id.startsWith("cat-"));
    if (first) setActive(first.id);
  }, [hasQuery, menuItems]);

  // Center the active pill by scrolling ONLY the horizontal pill row.
  // Never use scrollIntoView here: on mobile it also scrolls the page
  // vertically (all scrollable ancestors), fighting the user's touch
  // scroll and making the sticky menu "jump".
  useEffect(() => {
    if (!active) return;
    const raf = requestAnimationFrame(() => {
      const row = pillsRowRef.current;
      const pill = activePillRef.current;
      if (!row || !pill) return;
      const left = pill.offsetLeft - row.clientWidth / 2 + pill.offsetWidth / 2;
      row.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
    });
    return () => cancelAnimationFrame(raf);
  }, [active]);

  const go = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: "smooth" });
    setActive(id);
    clickLockRef.current = Date.now() + 1000;
    el.classList.add("ring-2", "ring-primary/60", "rounded-2xl");
    window.setTimeout(() => {
      el.classList.remove("ring-2", "ring-primary/60", "rounded-2xl");
    }, 1200);
  };

  return (
    <nav
      className="sticky top-0 z-30 -mx-4 mt-5 border-b bg-background/95 px-4 py-3 backdrop-blur"
      style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
    >
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Buscar no cardápio…"
          className="h-10 rounded-full border-muted bg-muted/40 pl-9 pr-9 text-sm"
          inputMode="search"
        />
        {query && (
          <button
            type="button"
            aria-label="Limpar"
            onClick={() => onQueryChange("")}
            className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {menuItems.length > 0 && (
        <div ref={pillsRowRef} className="flex gap-2 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {menuItems.map((m) => {
            const isActive = active === m.id;
            return (
              <a
                key={m.id}
                href={`#${m.id}`}
                ref={isActive ? activePillRef : undefined}
                onClick={(e) => go(e, m.id)}
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors duration-200 ${isActive ? "border-primary bg-primary text-primary-foreground shadow-elegant" : "bg-card text-foreground hover:border-primary/40"}`}
              >
                <span>{m.label}</span>
                <span className={`rounded-full px-1.5 text-[10px] font-bold ${isActive ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"}`}>
                  {m.count}
                </span>
              </a>
            );
          })}
        </div>
      )}
    </nav>
  );
}

