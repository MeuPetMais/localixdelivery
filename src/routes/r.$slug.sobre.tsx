import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { getPublicRestaurantWhatsApp } from "@/lib/public-restaurant.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Star,
  Clock,
  MapPin,
  CreditCard,
  Phone,
  Mail,
  Instagram,
  Facebook,
  Globe,
  MessageCircle,
  ExternalLink,
  Search,
  CheckCircle2,
  Banknote,
  Smartphone,
  Wallet,
  Utensils,
} from "lucide-react";

const VALID_TABS = ["avaliacoes", "horarios", "info", "pagamentos"] as const;
type ProfileTab = (typeof VALID_TABS)[number];

export const Route = createFileRoute("/r/$slug/sobre")({
  head: () => ({ meta: [{ title: "Sobre o estabelecimento — Localix" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    tab: VALID_TABS.includes(s.tab as ProfileTab) ? (s.tab as ProfileTab) : "avaliacoes",
  }),
  component: SobrePage,
});

type Hours = Record<string, { open: string; close: string; enabled: boolean; open2?: string | null; close2?: string | null }>;
const DAYS = [
  { id: "sun", label: "Domingo", jsDay: 0 },
  { id: "mon", label: "Segunda", jsDay: 1 },
  { id: "tue", label: "Terça", jsDay: 2 },
  { id: "wed", label: "Quarta", jsDay: 3 },
  { id: "thu", label: "Quinta", jsDay: 4 },
  { id: "fri", label: "Sexta", jsDay: 5 },
  { id: "sat", label: "Sábado", jsDay: 6 },
];

type Review = {
  id: string;
  customer_name: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
};

type RestaurantBase = {
  id: string;
  name: string;
  slug: string;
};

type HoursData = RestaurantBase & {
  opening_hours: Hours | null;
};

type InfoData = RestaurantBase & {
  description: string | null;
  address: string | null;
  address_number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  landline_phone: string | null;
  instagram: string | null;
  facebook: string | null;
  website: string | null;
  email: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  google_maps_url: string | null;
};

type PaymentsData = RestaurantBase & {
  payment_methods: Record<string, boolean> | null;
};

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  const d = Math.floor(diff / 86400);
  if (d < 7) return `há ${d} ${d === 1 ? "dia" : "dias"}`;
  const w = Math.floor(d / 7);
  if (w < 5) return `há ${w} ${w === 1 ? "semana" : "semanas"}`;
  const m = Math.floor(d / 30);
  return `há ${m} ${m === 1 ? "mês" : "meses"}`;
}


function inShift(curr: number, open: string, close: string) {
  if (!open || !close) return false;
  const [oh, om] = open.split(":").map(Number);
  const [ch, cm] = close.split(":").map(Number);
  if ([oh, om, ch, cm].some((n) => Number.isNaN(n))) return false;
  const o = oh * 60 + om;
  const c = ch * 60 + cm;
  return c > o ? curr >= o && curr <= c : curr >= o || curr <= c;
}

function isOpenNow(hours: Hours | null | undefined): boolean {
  if (!hours) return false;
  const now = new Date();
  const day = DAYS.find((d) => d.jsDay === now.getDay());
  if (!day) return false;
  const h = hours[day.id];
  if (!h?.enabled) return false;
  const curr = now.getHours() * 60 + now.getMinutes();
  if (inShift(curr, h.open, h.close)) return true;
  if (h.open2 && h.close2 && inShift(curr, h.open2, h.close2)) return true;
  return false;
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

function isFilled(value: unknown): value is string | number {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

function SobrePage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { tab } = Route.useSearch();
  const [filter, setFilter] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const getWhatsApp = useServerFn(getPublicRestaurantWhatsApp);

  const { data: restaurant, isLoading: isRestaurantLoading } = useQuery({
    queryKey: ["public-restaurant-base", slug],
    enabled: !!slug,
    retry: 3,
    queryFn: async () => {
      const { data: rest, error } = await (supabase as any)
        .from("restaurants_public")
        .select("id, name, slug")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return rest as RestaurantBase | null;
    },
  });

  const restaurantId = restaurant?.id;

  const { data: reviews = [], isLoading: isReviewsLoading } = useQuery({
    queryKey: ["public-reviews", restaurantId],
    enabled: tab === "avaliacoes" && !!restaurantId,
    queryFn: async () => {
      const { data: rows, error } = await (supabase as any)
        .from("reviews")
        .select("id, customer_name, rating, comment, created_at")
        .eq("restaurant_id", restaurantId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (rows ?? []) as Review[];
    },
  });

  const { data: hoursData, isLoading: isHoursLoading } = useQuery({
    queryKey: ["public-restaurant-hours", slug],
    enabled: tab === "horarios" && !!slug,
    queryFn: async () => {
      const { data: rest, error } = await (supabase as any)
        .from("restaurants_public")
        .select("id, name, slug, opening_hours")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return rest as HoursData | null;
    },
  });

  const { data: infoData, isLoading: isInfoLoading } = useQuery({
    queryKey: ["public-restaurant-info", slug],
    enabled: tab === "info" && !!slug,
    queryFn: async () => {
      const { data: rest, error } = await (supabase as any)
        .from("restaurants_public")
        .select("id, name, slug, description, address, address_number, complement, neighborhood, city, state, zip_code, landline_phone, instagram, facebook, website, email, latitude, longitude, google_maps_url")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return rest as InfoData | null;
    },
  });

  const { data: whatsappData } = useQuery({
    queryKey: ["public-restaurant-whatsapp-contact", slug],
    enabled: tab === "info" && !!slug,
    queryFn: () => getWhatsApp({ data: { slug } }),
  });

  const { data: paymentsData, isLoading: isPaymentsLoading } = useQuery({
    queryKey: ["public-restaurant-payments", slug],
    enabled: tab === "pagamentos" && !!slug,
    queryFn: async () => {
      const { data: rest, error } = await (supabase as any)
        .from("restaurants_public")
        .select("id, name, slug, payment_methods")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return rest as PaymentsData | null;
    },
  });

  const stats = useMemo(() => {
    const total = reviews.length;
    const avg = total ? reviews.reduce((s, r) => s + r.rating, 0) / total : 0;
    const dist = [5, 4, 3, 2, 1].map((s) => ({
      stars: s,
      count: reviews.filter((r) => r.rating === s).length,
    }));
    return { total, avg, dist };
  }, [reviews]);

  const filteredReviews = reviews.filter(
    (r) =>
      (filter === null || r.rating === filter) &&
      (search === "" || (r.comment ?? "").toLowerCase().includes(search.toLowerCase())),
  );


  if (isRestaurantLoading) {
    return (
      <div className="min-h-screen bg-muted/30 p-4">
        <div className="mx-auto max-w-3xl space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-60 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="grid min-h-screen place-items-center px-4 text-center">
        <div>
          <h1 className="font-display text-3xl font-extrabold">Restaurante não encontrado</h1>
          <p className="mt-2 text-muted-foreground">Verifique o link e tente novamente.</p>
          <Link to="/" className="mt-4 inline-flex"><Button>Ir para o Localix</Button></Link>
        </div>
      </div>
    );
  }

  const hours = hoursData?.opening_hours ?? null;
  const hasHours = !!hours && Object.keys(hours).length > 0;
  const openNow = isOpenNow(hours);
  const addrLine1 = infoData ? [infoData.address, infoData.address_number].filter(isFilled).join(", ") : "";
  const addrLine2 = infoData ? [infoData.neighborhood, [infoData.city, infoData.state].filter(isFilled).join(" - ")].filter((v) => isFilled(v) && v !== "").join(" · ") : "";
  const fullAddress = [addrLine1, infoData?.complement, addrLine2, infoData?.zip_code].filter((v) => isFilled(v) && v !== "").join(" · ");
  const hasAddress = !!infoData && (isFilled(infoData.address) || isFilled(infoData.city) || isFilled(infoData.state) || isFilled(infoData.neighborhood) || isFilled(infoData.zip_code));
  const hasMap = !!infoData && (isFilled(infoData.google_maps_url) || (isFilled(infoData.latitude) && isFilled(infoData.longitude)) || hasAddress);
  const mapsQuery = infoData?.latitude && infoData?.longitude
    ? `${infoData.latitude},${infoData.longitude}`
    : encodeURIComponent(fullAddress || infoData?.name || restaurant.name);
  const mapsEmbed = `https://www.google.com/maps?q=${mapsQuery}&output=embed`;
  const mapsOpen = infoData?.google_maps_url || `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;
  const contactRows = infoData ? [
    { icon: Phone, label: "Telefone", value: infoData.landline_phone, href: `tel:${String(infoData.landline_phone ?? "").replace(/\D/g, "")}` },
    { icon: MessageCircle, label: "WhatsApp", value: whatsappData?.maskedPhone, href: `/r/${slug}` },
    { icon: Instagram, label: "Instagram", value: infoData.instagram ? `@${infoData.instagram.replace(/^@/, "")}` : null, href: infoData.instagram ? `https://instagram.com/${infoData.instagram.replace(/^@/, "")}` : "" },
    { icon: Facebook, label: "Facebook", value: infoData.facebook, href: infoData.facebook?.startsWith("http") ? infoData.facebook : `https://facebook.com/${infoData.facebook}` },
    { icon: Globe, label: "Site", value: infoData.website, href: infoData.website?.startsWith("http") ? infoData.website : `https://${infoData.website}` },
    { icon: Mail, label: "E-mail", value: infoData.email, href: `mailto:${infoData.email}` },
  ].filter((row) => isFilled(row.value)) : [];
  const hasAnyInfo = hasAddress || contactRows.length > 0 || isFilled(infoData?.description);


  const pm = paymentsData?.payment_methods ?? {};
  const paymentMethods = [
    { keys: ["pix"], label: "Pix", icon: Smartphone },
    { keys: ["cash"], label: "Dinheiro", icon: Banknote },
    { keys: ["credit"], label: "Cartão Crédito", icon: CreditCard },
    { keys: ["debit"], label: "Cartão Débito", icon: CreditCard },
    { keys: ["meal_voucher"], label: "Vale Refeição", icon: Utensils },
    { keys: ["food_voucher"], label: "Vale Alimentação", icon: Utensils },
    { keys: ["ticket"], label: "Ticket", icon: Utensils },
    { keys: ["alelo"], label: "Alelo", icon: Utensils },
    { keys: ["sodexo"], label: "Sodexo", icon: Utensils },
    { keys: ["vr"], label: "VR", icon: Utensils },
    { keys: ["ben"], label: "Ben", icon: Utensils },
    { keys: ["online_pix"], label: "Pix Online", icon: Smartphone },
    { keys: ["online_card", "online_credit", "online_debit"], label: "Cartão Online", icon: Wallet },
  ];
  const activePaymentMethods = paymentMethods.filter((method) => method.keys.some((key) => !!pm[key]));

  return (
    <div className="min-h-screen bg-muted/30 pb-12 animate-in fade-in duration-300">
      {/* header */}
      <div className="sticky top-0 z-30 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Link to="/r/$slug" params={{ slug }}>
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="truncate font-display text-lg font-extrabold">{restaurant.name}</h1>
            <p className="text-xs text-muted-foreground">Sobre o estabelecimento</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 pt-4">
        <Tabs value={tab} onValueChange={(v) => navigate({ to: "/r/$slug/sobre", params: { slug }, search: { tab: v as ProfileTab } })} className="w-full">
          <TabsList className="grid h-12 w-full grid-cols-4 rounded-2xl bg-card p-1 shadow-elegant">
            <TabsTrigger value="avaliacoes" className="rounded-xl text-xs sm:text-sm">
              <Star className="mr-1 h-3.5 w-3.5" /> Avaliações
            </TabsTrigger>
            <TabsTrigger value="horarios" className="rounded-xl text-xs sm:text-sm">
              <Clock className="mr-1 h-3.5 w-3.5" /> Horários
            </TabsTrigger>
            <TabsTrigger value="info" className="rounded-xl text-xs sm:text-sm">
              <MapPin className="mr-1 h-3.5 w-3.5" /> Info
            </TabsTrigger>
            <TabsTrigger value="pagamentos" className="rounded-xl text-xs sm:text-sm">
              <CreditCard className="mr-1 h-3.5 w-3.5" /> Pagto
            </TabsTrigger>
          </TabsList>

          {/* AVALIAÇÕES */}
          <TabsContent value="avaliacoes" className="space-y-4 pt-4 animate-in fade-in slide-in-from-bottom-2">
            {isReviewsLoading ? (
              <TabSkeleton />
            ) : (
              <>
                <Card className="rounded-2xl p-6 shadow-elegant">
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <p className="font-display text-5xl font-extrabold text-primary">{stats.avg.toFixed(1)}</p>
                      <div className="mt-1 flex justify-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star key={i} className={`h-4 w-4 ${i <= Math.round(stats.avg) ? "fill-warning text-warning" : "text-muted-foreground/40"}`} />
                        ))}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{stats.total} avaliações</p>
                    </div>
                    <div className="flex-1 space-y-1.5">
                      {stats.dist.map((d) => {
                        const pct = stats.total ? (d.count / stats.total) * 100 : 0;
                        return (
                          <button
                            key={d.stars}
                            onClick={() => setFilter(filter === d.stars ? null : d.stars)}
                            className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-xs transition hover:bg-muted ${filter === d.stars ? "bg-muted" : ""}`}
                          >
                            <span className="w-3 font-semibold">{d.stars}</span>
                            <Star className="h-3 w-3 fill-warning text-warning" />
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                              <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="w-6 text-right text-muted-foreground">{d.count}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </Card>

                {reviews.length > 0 && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Buscar nas avaliações..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="rounded-2xl pl-9"
                    />
                  </div>
                )}

                <div className="space-y-3">
                  {filteredReviews.map((r) => {
                    const displayName = r.customer_name?.trim() || "Cliente";
                    return (
                      <Card key={r.id} className="rounded-2xl p-4 shadow-elegant">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 font-bold text-primary">
                              {displayName[0]?.toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{displayName}</p>
                              <p className="text-xs text-muted-foreground">{formatDate(r.created_at)} · {timeAgo(r.created_at)}</p>
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-0.5" aria-label={`Nota ${r.rating} de 5`}>
                            {[1, 2, 3, 4, 5].map((i) => (
                              <Star key={i} className={`h-3.5 w-3.5 ${i <= r.rating ? "fill-warning text-warning" : "text-muted-foreground/30"}`} />
                            ))}
                          </div>
                        </div>
                        {r.comment && <p className="mt-3 text-sm">{r.comment}</p>}
                      </Card>
                    );
                  })}
                  {reviews.length === 0 && (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Este estabelecimento ainda não possui avaliações.
                    </p>
                  )}
                  {reviews.length > 0 && filteredReviews.length === 0 && (
                    <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma avaliação encontrada</p>
                  )}
                </div>
              </>
            )}
          </TabsContent>

          {/* HORÁRIOS */}
          <TabsContent value="horarios" className="space-y-4 pt-4 animate-in fade-in slide-in-from-bottom-2">
            {isHoursLoading ? (
              <TabSkeleton />
            ) : (
              <Card className="rounded-2xl p-6 shadow-elegant">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="font-display text-lg font-bold">Horário de Funcionamento</h2>
                  {hasHours && (
                    <Badge variant={openNow ? "default" : "secondary"} className={openNow ? "bg-success text-success-foreground" : "bg-destructive/15 text-destructive"}>
                      {openNow ? "🟢 Aberto agora" : "🔴 Fechado agora"}
                    </Badge>
                  )}
                </div>
                {!hasHours ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Horários ainda não configurados.</p>
                ) : (
                  <div className="space-y-2">
                    {DAYS.map((d) => {
                      const h = hours?.[d.id];
                      const isToday = new Date().getDay() === d.jsDay;
                      return (
                        <div
                          key={d.id}
                          className={`flex items-center justify-between rounded-xl border px-4 py-3 ${isToday ? "border-primary bg-primary/5" : ""}`}
                        >
                          <span className={`font-medium ${isToday ? "text-primary" : ""}`}>
                            {d.label} {isToday && <span className="ml-1 text-xs">(hoje)</span>}
                          </span>
                          {h?.enabled && h.open && h.close ? (
                            <div className="text-right text-sm font-mono">
                              <div>{h.open} — {h.close}</div>
                              {h.open2 && h.close2 && (
                                <div>{h.open2} — {h.close2}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">Fechado</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            )}
          </TabsContent>

          {/* INFORMAÇÕES */}
          <TabsContent value="info" className="space-y-4 pt-4 animate-in fade-in slide-in-from-bottom-2">
            {isInfoLoading ? (
              <TabSkeleton />
            ) : !hasAnyInfo ? (
              <Card className="rounded-2xl p-8 text-center shadow-elegant">
                <p className="text-sm text-muted-foreground">Nenhuma informação pública cadastrada ainda.</p>
              </Card>
            ) : (
              <>
                {hasMap && (
                  <Card className="overflow-hidden rounded-2xl shadow-elegant">
                    <div className="aspect-video w-full bg-muted">
                      <iframe
                        src={mapsEmbed}
                        className="h-full w-full border-0"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        title="Mapa"
                      />
                    </div>
                  </Card>
                )}

                {hasAddress && (
                  <Card className="rounded-2xl p-5 shadow-elegant">
                    <div className="flex items-start gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10">
                        <MapPin className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-base font-bold">Endereço</p>
                        <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                          {isFilled(addrLine1) && <p>{addrLine1}</p>}
                          {isFilled(infoData?.complement) && <p>{infoData!.complement}</p>}
                          {isFilled(infoData?.neighborhood) && <p>{infoData!.neighborhood}</p>}
                          {isFilled(addrLine2) && addrLine2 !== "" && !addrLine2.startsWith(" · ") && <p>{addrLine2}</p>}
                          {isFilled(infoData?.zip_code) && <p>CEP {infoData!.zip_code}</p>}
                        </div>
                        <Button asChild className="mt-3" variant="outline" size="sm">
                          <a href={mapsOpen} target="_blank" rel="noreferrer">
                            <ExternalLink className="mr-2 h-4 w-4" /> Abrir no Google Maps
                          </a>
                        </Button>
                      </div>
                    </div>
                  </Card>
                )}

                {contactRows.length > 0 && (
                  <Card className="rounded-2xl p-5 shadow-elegant">
                    <h3 className="mb-3 font-display text-base font-bold">Contato & Redes</h3>
                    <div className="space-y-2">
                      {contactRows.map((row) => (
                        <InfoRow key={row.label} icon={row.icon} label={row.label} value={String(row.value)} href={row.href} />
                      ))}
                    </div>
                  </Card>
                )}

                {isFilled(infoData?.description) && (
                  <Card className="rounded-2xl p-5 shadow-elegant">
                    <h3 className="mb-2 font-display text-base font-bold">Sobre</h3>
                    <p className="text-sm text-muted-foreground">{infoData!.description}</p>
                  </Card>
                )}
              </>
            )}
          </TabsContent>




          {/* PAGAMENTOS */}
          <TabsContent value="pagamentos" className="space-y-4 pt-4 animate-in fade-in slide-in-from-bottom-2">
            {isPaymentsLoading ? (
              <TabSkeleton />
            ) : (
              <Card className="rounded-2xl p-5 shadow-elegant">
                <div className="mb-4 flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <h3 className="font-display text-base font-bold">Formas de Pagamento</h3>
                </div>
                {activePaymentMethods.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma forma de pagamento cadastrada.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {activePaymentMethods.map((method) => (
                      <PaymentMethod key={method.label} icon={method.icon} label={method.label} />
                    ))}
                  </div>
                )}
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, href }: { icon: any; label: string; value: string; href: string }) {
  const isExternal = href.startsWith("http");
  const isActionable = href.length > 0 && !href.endsWith("undefined") && !href.endsWith("null") && href !== "mailto:null" && href !== "tel:";
  if (!isActionable) {
    return (
      <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-sm font-medium">{value}</p>
        </div>
      </div>
    );
  }

  return (
    <a href={href} target={isExternal ? "_blank" : undefined} rel="noreferrer" className="flex items-center gap-3 rounded-xl border bg-card p-3 transition hover:border-primary/40 hover:bg-muted/40">
      <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
      <ExternalLink className="h-4 w-4 text-muted-foreground" />
    </a>
  );
}

function PaymentMethod({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/5 p-3">
      <Icon className="h-5 w-5 shrink-0 text-success" />
      <p className="flex-1 text-sm font-medium">{label}</p>
      <CheckCircle2 className="h-4 w-4 text-success" />
    </div>
  );
}

function TabSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-16 w-full rounded-2xl" />
      <Skeleton className="h-16 w-full rounded-2xl" />
    </div>
  );
}
