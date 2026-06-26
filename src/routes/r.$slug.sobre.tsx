import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  XCircle,
  Banknote,
  Smartphone,
  Wallet,
  Utensils,
} from "lucide-react";

export const Route = createFileRoute("/r/$slug/sobre")({
  head: () => ({ meta: [{ title: "Sobre o estabelecimento — Localix" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    tab: (s.tab as string) ?? "avaliacoes",
  }),
  component: SobrePage,
});

type Hours = Record<string, { open: string; close: string; enabled: boolean }>;
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
  owner_reply: string | null;
  created_at: string;
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


function isOpenNow(hours: Hours | null | undefined): boolean {
  if (!hours) return false;
  const now = new Date();
  const day = DAYS.find((d) => d.jsDay === now.getDay());
  if (!day) return false;
  const h = hours[day.id];
  if (!h?.enabled) return false;
  const [oh, om] = h.open.split(":").map(Number);
  const [ch, cm] = h.close.split(":").map(Number);
  const curr = now.getHours() * 60 + now.getMinutes();
  const open = oh * 60 + om;
  const close = ch * 60 + cm;
  return close > open ? curr >= open && curr <= close : curr >= open || curr <= close;
}

function SobrePage() {
  const { slug } = Route.useParams();
  const { tab } = Route.useSearch();
  const [filter, setFilter] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["public-restaurant-sobre", slug],
    enabled: !!slug,
    retry: 3,
    queryFn: async () => {
      const { data: rest } = await (supabase as any)
        .from("restaurants_public")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      return rest as any;
    },
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["public-reviews", data?.id],
    enabled: !!data?.id,
    queryFn: async () => {
      const { data: rows } = await (supabase as any)
        .from("reviews")
        .select("id, customer_name, rating, comment, owner_reply, created_at")
        .eq("restaurant_id", data!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      return (rows ?? []) as Review[];
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


  if (isLoading || !data) {
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

  const openNow = isOpenNow(data.opening_hours);
  const mapsQuery = data.latitude && data.longitude
    ? `${data.latitude},${data.longitude}`
    : encodeURIComponent(data.address ?? data.name);
  const mapsEmbed = `https://www.google.com/maps?q=${mapsQuery}&output=embed`;
  const mapsOpen = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

  const pm = data.payment_methods ?? {};

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
            <h1 className="truncate font-display text-lg font-extrabold">{data.name}</h1>
            <p className="text-xs text-muted-foreground">Sobre o estabelecimento</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 pt-4">
        <Tabs value={tab} onValueChange={(v) => navigate({ to: "/r/$slug/sobre", params: { slug }, search: { tab: v } })} className="w-full">
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
                    const pct = (d.count / stats.total) * 100;
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

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar nas avaliações..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-2xl pl-9"
              />
            </div>

            <div className="space-y-3">
              {filteredReviews.map((r) => {
                const displayName = r.customer_name?.trim() || "Cliente";
                return (
                  <Card key={r.id} className="rounded-2xl p-4 shadow-elegant">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 font-bold text-primary">
                          {displayName[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{displayName}</p>
                          <p className="text-xs text-muted-foreground">{timeAgo(r.created_at)}</p>
                        </div>
                      </div>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star key={i} className={`h-3.5 w-3.5 ${i <= r.rating ? "fill-warning text-warning" : "text-muted-foreground/30"}`} />
                        ))}
                      </div>
                    </div>
                    {r.comment && <p className="mt-3 text-sm">{r.comment}</p>}
                    {r.owner_reply && (
                      <div className="mt-3 rounded-xl border-l-4 border-primary bg-muted/40 p-3">
                        <p className="text-xs font-bold text-primary">Resposta do estabelecimento</p>
                        <p className="mt-1 text-sm">{r.owner_reply}</p>
                      </div>
                    )}
                  </Card>
                );
              })}
              {filteredReviews.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {reviews.length === 0 ? "Seja o primeiro a avaliar este estabelecimento!" : "Nenhuma avaliação encontrada"}
                </p>
              )}
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Apenas clientes que finalizaram pedido podem avaliar.
            </p>
          </TabsContent>

          {/* HORÁRIOS */}
          <TabsContent value="horarios" className="space-y-4 pt-4 animate-in fade-in slide-in-from-bottom-2">
            <Card className="rounded-2xl p-6 shadow-elegant">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-lg font-bold">Horário de Funcionamento</h2>
                <Badge variant={openNow ? "default" : "secondary"} className={openNow ? "bg-success text-success-foreground" : "bg-destructive/15 text-destructive"}>
                  {openNow ? "🟢 Aberto agora" : "🔴 Fechado agora"}
                </Badge>
              </div>
              <div className="space-y-2">
                {DAYS.map((d) => {
                  const h = (data.opening_hours as Hours | null)?.[d.id];
                  const isToday = new Date().getDay() === d.jsDay;
                  return (
                    <div
                      key={d.id}
                      className={`flex items-center justify-between rounded-xl border px-4 py-3 ${isToday ? "border-primary bg-primary/5" : ""}`}
                    >
                      <span className={`font-medium ${isToday ? "text-primary" : ""}`}>
                        {d.label} {isToday && <span className="ml-1 text-xs">(hoje)</span>}
                      </span>
                      {h?.enabled ? (
                        <span className="text-sm font-mono">{h.open} — {h.close}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Fechado</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </TabsContent>

          {/* INFORMAÇÕES */}
          <TabsContent value="info" className="space-y-4 pt-4 animate-in fade-in slide-in-from-bottom-2">
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
              <div className="p-5">
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">Endereço</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{data.address ?? "Endereço não informado"}</p>
                  </div>
                </div>
                <Button asChild className="mt-3 w-full" variant="outline">
                  <a href={mapsOpen} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" /> Abrir no Google Maps
                  </a>
                </Button>
              </div>
            </Card>

            <Card className="rounded-2xl p-5 shadow-elegant">
              <h3 className="mb-3 font-display text-base font-bold">Contato</h3>
              <div className="space-y-2">
                <InfoRow icon={MessageCircle} label="WhatsApp" value="Falar pelo WhatsApp" href={`/r/${slug}`} />
                {data.email && <InfoRow icon={Mail} label="E-mail" value={data.email} href={`mailto:${data.email}`} />}
                {data.instagram && <InfoRow icon={Instagram} label="Instagram" value={`@${data.instagram.replace(/^@/, "")}`} href={`https://instagram.com/${data.instagram.replace(/^@/, "")}`} />}
                {data.facebook && <InfoRow icon={Facebook} label="Facebook" value={data.facebook} href={data.facebook.startsWith("http") ? data.facebook : `https://facebook.com/${data.facebook}`} />}
                {data.website && <InfoRow icon={Globe} label="Site" value={data.website} href={data.website.startsWith("http") ? data.website : `https://${data.website}`} />}
                {!data.email && !data.instagram && !data.facebook && !data.website && (
                  <p className="py-3 text-center text-xs text-muted-foreground">Outros canais de contato em breve</p>
                )}
              </div>
            </Card>

            {data.description && (
              <Card className="rounded-2xl p-5 shadow-elegant">
                <h3 className="mb-2 font-display text-base font-bold">Sobre nós</h3>
                <p className="text-sm text-muted-foreground">{data.description}</p>
              </Card>
            )}
          </TabsContent>

          {/* PAGAMENTOS */}
          <TabsContent value="pagamentos" className="space-y-4 pt-4 animate-in fade-in slide-in-from-bottom-2">
            <PaymentGroup
              title="Pagamento na entrega"
              icon={Banknote}
              methods={[
                { key: "cash", label: "Dinheiro", note: "Aceita troco", icon: Banknote },
                { key: "pix", label: "Pix", icon: Smartphone },
                { key: "credit", label: "Cartão de Crédito", icon: CreditCard },
                { key: "debit", label: "Cartão de Débito", icon: CreditCard },
                { key: "meal_voucher", label: "Vale Refeição", icon: Utensils },
                { key: "food_voucher", label: "Vale Alimentação", icon: Utensils },
              ]}
              pm={pm}
            />
            <PaymentGroup
              title="Pagamento Online"
              icon={Wallet}
              methods={[
                { key: "online_pix", label: "Pix Online", icon: Smartphone },
                { key: "online_credit", label: "Cartão de Crédito Online", icon: CreditCard },
                { key: "online_debit", label: "Cartão de Débito Online", icon: CreditCard },
                { key: "google_pay", label: "Google Pay", icon: Wallet },
                { key: "apple_pay", label: "Apple Pay", icon: Wallet },
              ]}
              pm={pm}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, href }: { icon: any; label: string; value: string; href: string }) {
  return (
    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="flex items-center gap-3 rounded-xl border bg-card p-3 transition hover:border-primary/40 hover:bg-muted/40">
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

function PaymentGroup({
  title,
  icon: GroupIcon,
  methods,
  pm,
}: {
  title: string;
  icon: any;
  methods: { key: string; label: string; note?: string; icon: any }[];
  pm: Record<string, boolean>;
}) {
  const enabled = methods.filter((m) => pm[m.key]);
  return (
    <Card className="rounded-2xl p-5 shadow-elegant">
      <div className="mb-4 flex items-center gap-2">
        <GroupIcon className="h-5 w-5 text-primary" />
        <h3 className="font-display text-base font-bold">{title}</h3>
      </div>
      {enabled.length === 0 ? (
        <p className="py-3 text-center text-xs text-muted-foreground">Nenhuma forma habilitada</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {methods.map((m) => {
            const on = !!pm[m.key];
            return (
              <div
                key={m.key}
                className={`flex items-center gap-3 rounded-xl border p-3 transition ${on ? "border-success/30 bg-success/5" : "border-dashed opacity-50"}`}
              >
                <m.icon className={`h-5 w-5 shrink-0 ${on ? "text-success" : "text-muted-foreground"}`} />
                <div className="flex-1">
                  <p className="text-sm font-medium">{m.label}</p>
                  {m.note && on && <p className="text-[10px] text-muted-foreground">{m.note}</p>}
                </div>
                {on ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-muted-foreground/40" />}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
