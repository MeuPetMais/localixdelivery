import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant, useRestaurantContext } from "@/contexts/RestaurantContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Loader2,
  Camera,
  ImageIcon,
  Trash2,
  Store,
  Phone,
  FileText,
  Bike,
  ShoppingBag,
  Clock,
  MapPin,
  Link2,
  Copy,
  ExternalLink,
  Share2,
  Palette,
  CalendarDays,
  Power,
  Instagram,
  Facebook,
  Globe,
  Mail,
  CreditCard,
} from "lucide-react";

import { toast } from "sonner";
import { getProfileCompletion } from "@/lib/profile-completion";
import { useRestaurantStatus } from "@/hooks/use-restaurant-status";
import { slugify } from "@/lib/format";
import { getScheduleDayBadgeLabel, getScheduleDaySwitchLabel } from "@/lib/restaurant-status-labels";

async function findAvailableSlug(base: string, currentId: string): Promise<string> {
  const safeBase = slugify(base) || "loja";
  let candidate = safeBase;
  for (let n = 2; n <= 50; n++) {
    const { data } = await supabase
      .from("restaurants")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data || data.id === currentId) return candidate;
    candidate = `${safeBase}-${n}`;
  }
  return `${safeBase}-${Date.now()}`;
}



export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Perfil do Estabelecimento — Localix" }] }),
  component: SettingsPage,
});

const COLORS = [
  { id: "red", name: "Vermelho", hex: "#ef4444" },
  { id: "orange", name: "Laranja", hex: "#f97316" },
  { id: "green", name: "Verde", hex: "#10b981" },
  { id: "blue", name: "Azul", hex: "#3b82f6" },
  { id: "purple", name: "Roxo", hex: "#8b5cf6" },
];

const DAYS = [
  { id: "mon", label: "Segunda" },
  { id: "tue", label: "Terça" },
  { id: "wed", label: "Quarta" },
  { id: "thu", label: "Quinta" },
  { id: "fri", label: "Sexta" },
  { id: "sat", label: "Sábado" },
  { id: "sun", label: "Domingo" },
];

type Shift = { open: string; close: string };
type DayHours = { enabled: boolean; open: string; close: string; open2?: string | null; close2?: string | null };
type Hours = Record<string, DayHours>;

const DEFAULT_HOURS: Hours = DAYS.reduce((acc, d) => {
  acc[d.id] = { open: "18:00", close: "23:00", enabled: true, open2: null, close2: null };
  return acc;
}, {} as Hours);

async function uploadAsset(file: File, folder: "logos" | "covers", restaurantId: string) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  // RLS do bucket "restaurant-assets" exige que o 1º segmento da pasta == restaurant.id
  const path = `${restaurantId}/${folder}/${Date.now()}.${ext}`;

  // Sanity: confirma sessão e ownership antes de tentar o upload
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData?.user?.id ?? null;
  const { data: ownerCheck, error: ownerErr } = await supabase
    .from("restaurants")
    .select("id, owner_id")
    .eq("id", restaurantId)
    .maybeSingle();

  console.log("[upload] preflight", {
    path,
    uid,
    restaurantId,
    ownerCheck,
    ownerErr,
    file: { name: file.name, size: file.size, type: file.type },
  });

  if (!uid) throw new Error("Sessão expirada. Faça login novamente.");
  if (ownerErr) throw new Error(`Falha ao verificar restaurante: ${ownerErr.message}`);
  if (!ownerCheck) throw new Error("Restaurante não encontrado (RLS).");
  if (ownerCheck.owner_id !== uid)
    throw new Error(`auth.uid (${uid}) ≠ owner_id (${ownerCheck.owner_id}). RLS do Storage vai bloquear.`);

  const { data, error } = await supabase.storage.from("restaurant-assets").upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (error) {
    const full = {
      name: (error as any)?.name,
      message: error.message,
      statusCode: (error as any)?.statusCode,
      error: (error as any)?.error,
      details: (error as any)?.details,
      hint: (error as any)?.hint,
    };
    console.error("[upload] storage error:", full);
    throw new Error(`Storage: ${JSON.stringify(full)}`);
  }
  console.log("[upload] ok:", data);
  const { data: signed, error: sErr } = await supabase.storage
    .from("restaurant-assets")
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
  if (sErr) {
    console.error("[upload] signed url error:", sErr);
    throw new Error(`SignedUrl: ${sErr.message}`);
  }
  return signed?.signedUrl ?? null;
}


function SettingsPage() {
  const restaurant = useRestaurant();
  const { invalidate } = useRestaurantContext();
  const refetch = invalidate;


  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    whatsapp_phone: "",
    landline_phone: "",
    logo_url: "",
    cover_url: "",
    delivery_fee: "0",
    min_order: "0",
    delivery_time: "",
    delivery_radius: "",
    avg_delivery_minutes: "",
    avg_pickup_minutes: "",
    primary_color: "orange",
    is_open: true,
    address: "",
    address_number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    zip_code: "",
    instagram: "",
    facebook: "",
    website: "",
    email: "",
    latitude: "",
    longitude: "",
    google_maps_url: "",
  });
  const [payments, setPayments] = useState<Record<string, boolean>>({
    cash: true, pix: true, credit: true, debit: false,
    meal_voucher: false, food_voucher: false,
    ticket: false, alelo: false, sodexo: false, vr: false, ben: false,
    online_pix: false, online_card: false, online_credit: false, online_debit: false,
    google_pay: false, apple_pay: false,
  });

  const [hours, setHours] = useState<Hours>(DEFAULT_HOURS);
  const [loading, setLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [togglingOpen, setTogglingOpen] = useState(false);
  const [updatingSlug, setUpdatingSlug] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  // "Em operação" = já recebeu pelo menos 1 pedido. Enquanto isso, renomear = re-slug automático.
  const { data: hasOrders = false } = useQuery({
    queryKey: ["restaurant-has-orders", restaurant?.id],
    enabled: !!restaurant?.id,
    queryFn: async () => {
      const { count } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurant!.id);
      return (count ?? 0) > 0;
    },
    staleTime: 60_000,
  });


  useEffect(() => {
    if (!restaurant) return;
    const r = restaurant as any;
    setForm({
      name: r.name,
      slug: r.slug,
      description: r.description ?? "",
      whatsapp_phone: r.whatsapp_phone,
      landline_phone: r.landline_phone ?? "",
      logo_url: r.logo_url ?? "",
      cover_url: r.cover_url ?? "",
      delivery_fee: String(r.delivery_fee ?? 0),
      min_order: String(r.min_order ?? 0),
      delivery_time: r.delivery_time ?? "",
      delivery_radius: r.delivery_radius != null ? String(r.delivery_radius) : "",
      avg_delivery_minutes: r.avg_delivery_minutes != null ? String(r.avg_delivery_minutes) : "",
      avg_pickup_minutes: r.avg_pickup_minutes != null ? String(r.avg_pickup_minutes) : "",
      primary_color: r.primary_color ?? "orange",
      is_open: r.is_open,
      address: r.address ?? "",
      address_number: r.address_number ?? "",
      complement: r.complement ?? "",
      neighborhood: r.neighborhood ?? "",
      city: r.city ?? "",
      state: r.state ?? "",
      zip_code: r.zip_code ?? "",
      instagram: r.instagram ?? "",
      facebook: r.facebook ?? "",
      website: r.website ?? "",
      email: r.email ?? "",
      latitude: r.latitude != null ? String(r.latitude) : "",
      longitude: r.longitude != null ? String(r.longitude) : "",
      google_maps_url: r.google_maps_url ?? "",
    });
    const h = r.opening_hours as Hours | null;
    if (h) setHours({ ...DEFAULT_HOURS, ...h });
    if (r.payment_methods) {
      const saved = r.payment_methods as Record<string, boolean>;
      setPayments((p) => ({
        ...p,
        ...saved,
        online_card: !!(saved.online_card || saved.online_credit || saved.online_debit),
      }));
    }
  }, [restaurant]);


  if (!restaurant)
    return <Card className="p-8 text-center">Crie seu restaurante primeiro no painel.</Card>;

  async function handleUpload(file: File, kind: "logo" | "cover") {
    if (file.size > 5 * 1024 * 1024) return toast.error("Máximo 5MB");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
      return toast.error("Use PNG, JPG ou WEBP");
    const setUp = kind === "logo" ? setUploadingLogo : setUploadingCover;
    setUp(true);
    try {
      const url = await uploadAsset(file, kind === "logo" ? "logos" : "covers", restaurant.id);
      if (!url) throw new Error("Falha no upload");
      const field = kind === "logo" ? "logo_url" : "cover_url";
      setForm((f) => ({ ...f, [field]: url }));
      const { error: updErr } = await supabase
        .from("restaurants")
        .update(kind === "logo" ? { logo_url: url } : { cover_url: url })
        .eq("id", restaurant!.id);
      if (updErr) {
        console.error("[upload] update restaurants falhou:", updErr);
        throw updErr;
      }
      toast.success(kind === "logo" ? "Logo atualizada" : "Capa atualizada");
      refetch();
    } catch (e: any) {
      console.error("[upload] erro:", e);
      toast.error(e?.message ?? "Erro no upload");
    } finally {
      setUp(false);
    }
  }


  async function removeImage(kind: "logo" | "cover") {
    const field = kind === "logo" ? "logo_url" : "cover_url";
    setForm((f) => ({ ...f, [field]: "" }));
    await supabase
      .from("restaurants")
      .update(kind === "logo" ? { logo_url: null } : { cover_url: null })
      .eq("id", restaurant!.id);
    toast.success("Removido");
    refetch();
  }

  async function toggleOpen() {
    if (togglingOpen) return;
    const next = !form.is_open;
    setTogglingOpen(true);
    setForm((current) => ({ ...current, is_open: next }));
    const { data, error } = await supabase
      .from("restaurants")
      .update({ is_open: next, updated_at: new Date().toISOString() })
      .eq("id", restaurant!.id)
      .select("id, is_open")
      .maybeSingle();
    setTogglingOpen(false);
    if (error || !data) {
      setForm((current) => ({ ...current, is_open: !next }));
      return toast.error(error?.message ?? "Não foi possível atualizar o status.");
    }
    await refetch();
    toast.success(next ? "Loja aberta" : "Loja fechada");
  }

  async function updateSlug(desired: string) {
    if (updatingSlug) return;
    const base = slugify(desired);
    if (!base) return toast.error("URL inválida");
    if (base === restaurant.slug) return toast.info("A URL já é essa.");
    setUpdatingSlug(true);
    try {
      const finalSlug = await findAvailableSlug(base, restaurant.id);
      const { error } = await supabase
        .from("restaurants")
        .update({ slug: finalSlug, updated_at: new Date().toISOString() })
        .eq("id", restaurant.id);
      if (error) throw error;
      setForm((f) => ({ ...f, slug: finalSlug }));
      if (finalSlug !== base) {
        toast.info(`URL já usada — salvamos como "${finalSlug}".`, { duration: 6000 });
      } else {
        toast.success("URL pública atualizada");
      }
      await refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível atualizar a URL");
    } finally {
      setUpdatingSlug(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const toNum = (v: string) => (v ? Number(v.replace(",", ".")) : null);
    const toInt = (v: string) => (v ? parseInt(v, 10) || null : null);
    const normalizedPayments = {
      ...payments,
      online_credit: !!(payments.online_card || payments.online_credit),
      online_debit: !!(payments.online_card || payments.online_debit),
    };

    // Auto-sync do slug: só enquanto o estabelecimento ainda não recebeu pedidos.
    let nextSlug = restaurant.slug;
    let slugAutoAdjusted = false;
    if (!hasOrders) {
      const desired = slugify(form.name);
      if (desired && desired !== restaurant.slug) {
        nextSlug = await findAvailableSlug(desired, restaurant.id);
        slugAutoAdjusted = true;
      }
    }

    const { error } = await (supabase.from("restaurants") as any)
      .update({
        name: form.name,
        ...(slugAutoAdjusted ? { slug: nextSlug } : {}),
        description: form.description || null,
        whatsapp_phone: form.whatsapp_phone,
        landline_phone: form.landline_phone || null,
        delivery_fee: toNum(form.delivery_fee) ?? 0,
        min_order: toNum(form.min_order) ?? 0,
        delivery_time: form.delivery_time || null,
        delivery_radius: toNum(form.delivery_radius),
        avg_delivery_minutes: toInt(form.avg_delivery_minutes),
        avg_pickup_minutes: toInt(form.avg_pickup_minutes),
        primary_color: form.primary_color,
        opening_hours: hours as any,
        address: form.address || null,
        address_number: form.address_number || null,
        complement: form.complement || null,
        neighborhood: form.neighborhood || null,
        city: form.city || null,
        state: form.state || null,
        zip_code: form.zip_code || null,
        instagram: form.instagram || null,
        facebook: form.facebook || null,
        website: form.website || null,
        email: form.email || null,
        latitude: toNum(form.latitude),
        longitude: toNum(form.longitude),
        google_maps_url: form.google_maps_url || null,
        payment_methods: normalizedPayments,
        updated_at: new Date().toISOString(),
      })
      .eq("id", restaurant!.id);

    setLoading(false);
    if (error) return toast.error(error.message);
    if (slugAutoAdjusted) {
      setForm((f) => ({ ...f, slug: nextSlug }));
      toast.success(`Perfil atualizado. Nova URL: /${nextSlug}`);
    } else {
      toast.success("Perfil atualizado");
    }
    refetch();
  }


  const publicUrl =
    typeof window !== "undefined" ? `${window.location.origin}/${form.slug}` : `/${form.slug}`;
  const status = useRestaurantStatus({
    is_open: form.is_open,
    opening_hours: hours,
  });

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 pb-12">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Perfil do Estabelecimento</h1>
        <p className="text-sm text-muted-foreground">
          Todos os dados aqui aparecem automaticamente na sua página pública.
        </p>
      </div>

      {/* AUDITORIA DE COMPLETUDE — fonte única: getProfileCompletion(restaurant) */}
      {(() => {
        const { pct, completed, total, checks, isComplete } = getProfileCompletion(restaurant);
        return (
          <Card className="rounded-2xl border-border/60 p-5 shadow-elegant">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold">Perfil {pct}% completo</p>
                <p className="text-xs text-muted-foreground">
                  {completed} de {total} itens preenchidos
                </p>
              </div>
              <Badge variant={isComplete ? "default" : "secondary"}>
                {isComplete ? "Tudo pronto" : "Continue"}
              </Badge>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {checks.map((c) => (
                <span
                  key={c.key}
                  className={`rounded-full border px-2.5 py-1 text-xs ${
                    c.done
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {c.done ? "✓" : "○"} {c.label}
                </span>
              ))}
            </div>
            {!isComplete && (
              <p className="mt-3 text-xs text-muted-foreground">
                Salve as alterações para atualizar o progresso. O Dashboard reflete automaticamente.
              </p>
            )}
          </Card>
        );
      })()}


      {/* SEÇÃO 1 — Perfil da Loja */}
      <Card className="overflow-hidden rounded-2xl border-border/60 shadow-elegant">
        <div className="relative h-32 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent" />
        <div className="-mt-16 px-6 pb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <div className="relative">
                <div className="grid h-28 w-28 shrink-0 place-items-center overflow-hidden rounded-2xl border-4 border-background bg-muted shadow-elegant">
                  {form.logo_url ? (
                    <img src={form.logo_url} alt="Logo" className="h-full w-full object-cover" />
                  ) : (
                    <Store className="h-10 w-10 text-muted-foreground" />
                  )}
                </div>
                {uploadingLogo && (
                  <div className="absolute inset-0 grid place-items-center rounded-2xl bg-background/70">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                )}
              </div>
              <div className="min-w-0 pb-1">
                <h2 className="truncate text-xl font-bold">{form.name || "Sua loja"}</h2>
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${status.isOpen ? "bg-emerald-500" : "bg-rose-500"}`}
                  />
                  <span className="text-sm text-muted-foreground">
                    {status.isOpen ? "Aberto agora" : status.reason === "manual_closed" ? "Fechado manualmente" : "Fechado pelo horário"}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                ref={logoRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "logo")}
              />
              <Button type="button" variant="outline" onClick={() => logoRef.current?.click()}>
                <Camera className="mr-2 h-4 w-4" /> Fazer Upload da Logo
              </Button>
              {form.logo_url && (
                <Button type="button" variant="ghost" size="icon" onClick={() => removeImage("logo")}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button
                type="button"
                variant={form.is_open ? "default" : "secondary"}
                onClick={toggleOpen}
                disabled={togglingOpen}
              >
                {togglingOpen ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Power className="mr-2 h-4 w-4" />}
                {form.is_open ? "Fechar manualmente" : "Abrir loja"}
              </Button>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">PNG, JPG ou WEBP — máx. 5MB</p>
        </div>
      </Card>

      {/* SEÇÃO 2 — Capa */}
      <Card className="overflow-hidden rounded-2xl border-border/60 shadow-elegant">
        <div className="relative">
          <div className="relative h-44 w-full overflow-hidden bg-muted sm:h-52">
            {form.cover_url ? (
              <img src={form.cover_url} alt="Capa" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center bg-gradient-to-br from-muted to-muted/50">
                <ImageIcon className="h-10 w-10 text-muted-foreground" />
              </div>
            )}
            {uploadingCover && (
              <div className="absolute inset-0 grid place-items-center bg-background/60">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
            <div className="absolute bottom-3 right-3 flex gap-2">
              <input
                ref={coverRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "cover")}
              />
              <Button type="button" size="sm" onClick={() => coverRef.current?.click()}>
                <Camera className="mr-2 h-4 w-4" /> Alterar capa
              </Button>
              {form.cover_url && (
                <Button type="button" size="sm" variant="secondary" onClick={() => removeImage("cover")}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
        <div className="px-6 py-3 text-xs text-muted-foreground">
          Recomendado 1200x400px — PNG, JPG ou WEBP até 5MB
        </div>
      </Card>

      <form onSubmit={save} className="space-y-6">
        {/* SEÇÃO 3 — Informações */}
        <Card className="rounded-2xl border-border/60 p-6 shadow-elegant">
          <div className="mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold">Informações do Restaurante</h3>
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome do estabelecimento</Label>
              <Input
                required
                maxLength={60}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <p className="text-right text-xs text-muted-foreground">{form.name.length}/60</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" /> WhatsApp (com DDD)
                </Label>
                <Input
                  required
                  value={form.whatsapp_phone}
                  onChange={(e) => setForm({ ...form, whatsapp_phone: e.target.value })}
                  placeholder="+55 11 99999-9999"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" /> Telefone fixo
                </Label>
                <Input
                  value={form.landline_phone}
                  onChange={(e) => setForm({ ...form, landline_phone: e.target.value })}
                  placeholder="(11) 3000-0000"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea
                rows={3}
                maxLength={180}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Conte sobre sua loja..."
              />
              <p className="text-right text-xs text-muted-foreground">
                {form.description.length}/180
              </p>
            </div>
          </div>
        </Card>

        {/* SEÇÃO 4 — Entrega */}
        <Card className="rounded-2xl border-border/60 p-6 shadow-elegant">
          <div className="mb-4 flex items-center gap-2">
            <Bike className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold">Configurações de Entrega</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Bike className="h-3.5 w-3.5" /> Taxa de entrega (R$)
              </Label>
              <Input
                value={form.delivery_fee}
                onChange={(e) => setForm({ ...form, delivery_fee: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <ShoppingBag className="h-3.5 w-3.5" /> Pedido mínimo (R$)
              </Label>
              <Input
                value={form.min_order}
                onChange={(e) => setForm({ ...form, min_order: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Tempo médio de entrega (texto)
              </Label>
              <Input
                placeholder="30-45 min"
                value={form.delivery_time}
                onChange={(e) => setForm({ ...form, delivery_time: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Entrega (minutos, número)
              </Label>
              <Input
                type="number"
                min={0}
                placeholder="40"
                value={form.avg_delivery_minutes}
                onChange={(e) => setForm({ ...form, avg_delivery_minutes: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <ShoppingBag className="h-3.5 w-3.5" /> Retirada (minutos)
              </Label>
              <Input
                type="number"
                min={0}
                placeholder="15"
                value={form.avg_pickup_minutes}
                onChange={(e) => setForm({ ...form, avg_pickup_minutes: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> Raio de atendimento (km)
              </Label>
              <Input
                placeholder="5"
                value={form.delivery_radius}
                onChange={(e) => setForm({ ...form, delivery_radius: e.target.value })}
              />
            </div>
          </div>
        </Card>

        {/* SEÇÃO — Endereço & Localização */}
        <Card className="rounded-2xl border-border/60 p-6 shadow-elegant">
          <div className="mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold">Endereço & Localização</h3>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
              <div className="space-y-1.5">
                <Label>Rua / Logradouro</Label>
                <Input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Av. Paulista"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Número</Label>
                <Input
                  value={form.address_number}
                  onChange={(e) => setForm({ ...form, address_number: e.target.value })}
                  placeholder="1000"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Complemento</Label>
                <Input
                  value={form.complement}
                  onChange={(e) => setForm({ ...form, complement: e.target.value })}
                  placeholder="Loja 2"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Bairro</Label>
                <Input
                  value={form.neighborhood}
                  onChange={(e) => setForm({ ...form, neighborhood: e.target.value })}
                  placeholder="Centro"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_80px_140px]">
              <div className="space-y-1.5">
                <Label>Cidade</Label>
                <Input
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="São Paulo"
                />
              </div>
              <div className="space-y-1.5">
                <Label>UF</Label>
                <Input
                  maxLength={2}
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })}
                  placeholder="SP"
                />
              </div>
              <div className="space-y-1.5">
                <Label>CEP</Label>
                <Input
                  value={form.zip_code}
                  onChange={(e) => setForm({ ...form, zip_code: e.target.value })}
                  placeholder="01310-000"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Latitude</Label>
                <Input
                  value={form.latitude}
                  onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                  placeholder="-23.55052"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Longitude</Label>
                <Input
                  value={form.longitude}
                  onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                  placeholder="-46.633308"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" /> Link do Google Maps
              </Label>
              <Input
                value={form.google_maps_url}
                onChange={(e) => setForm({ ...form, google_maps_url: e.target.value })}
                placeholder="https://maps.app.goo.gl/..."
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Se preencher o link do Google Maps, ele será usado no botão "Abrir no Maps".
              Sem coordenadas nem link, o mapa usa o endereço informado.
            </p>
          </div>
        </Card>

        {/* SEÇÃO — Redes Sociais */}
        <Card className="rounded-2xl border-border/60 p-6 shadow-elegant">
          <div className="mb-4 flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold">Redes Sociais & Contato</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Instagram className="h-3.5 w-3.5" /> Instagram</Label>
              <Input value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} placeholder="@sualoja" />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Facebook className="h-3.5 w-3.5" /> Facebook</Label>
              <Input value={form.facebook} onChange={(e) => setForm({ ...form, facebook: e.target.value })} placeholder="sualoja" />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> Site</Label>
              <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://..." />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="contato@loja.com" />
            </div>
          </div>
        </Card>

        {/* SEÇÃO — Formas de Pagamento */}
        <Card className="rounded-2xl border-border/60 p-6 shadow-elegant">
          <div className="mb-4 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold">Formas de Pagamento</h3>
          </div>
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Na entrega</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  { k: "cash", l: "Dinheiro" },
                  { k: "pix", l: "Pix" },
                  { k: "credit", l: "Cartão Crédito" },
                  { k: "debit", l: "Cartão Débito" },
                  { k: "meal_voucher", l: "Vale Refeição" },
                  { k: "food_voucher", l: "Vale Alimentação" },
                  { k: "ticket", l: "Ticket" },
                  { k: "alelo", l: "Alelo" },
                  { k: "sodexo", l: "Sodexo" },
                  { k: "vr", l: "VR" },
                  { k: "ben", l: "Ben" },
                ].map((m) => (
                  <label key={m.k} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 transition ${payments[m.k] ? "border-primary bg-primary/5" : ""}`}>
                    <input
                      type="checkbox"
                      checked={!!payments[m.k]}
                      onChange={(e) => setPayments({ ...payments, [m.k]: e.target.checked })}
                      className="h-4 w-4 accent-primary"
                    />
                    <span className="text-sm font-medium">{m.l}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Online</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  { k: "online_pix", l: "Pix Online" },
                  { k: "online_card", l: "Cartão Online" },
                ].map((m) => (
                  <label key={m.k} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 transition ${payments[m.k] ? "border-primary bg-primary/5" : ""}`}>
                    <input
                      type="checkbox"
                      checked={!!payments[m.k]}
                      onChange={(e) => setPayments({ ...payments, [m.k]: e.target.checked })}
                      className="h-4 w-4 accent-primary"
                    />
                    <span className="text-sm font-medium">{m.l}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </Card>



        {/* SEÇÃO 5 — Link Público */}
        <Card className="rounded-2xl border-border/60 p-6 shadow-elegant">
          <div className="mb-4 flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold">Link Público</h3>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="slug-input">URL pública</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex flex-1 items-center rounded-md border bg-muted/40 px-3">
                <span className="text-sm text-muted-foreground">/</span>
                <Input
                  id="slug-input"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })}
                  className="border-0 bg-transparent focus-visible:ring-0"
                  placeholder="minha-loja"
                />
              </div>
              <Button
                type="button"
                onClick={() => updateSlug(form.slug)}
                disabled={updatingSlug || !form.slug || form.slug === restaurant.slug}
              >
                {updatingSlug ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Atualizar URL
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {hasOrders
                ? "Seu estabelecimento já recebeu pedidos — mudar a URL pode quebrar links compartilhados."
                : "Enquanto não houver pedidos, a URL é atualizada automaticamente ao renomear a loja."}
            </p>
          </div>
          <div className="mt-4 rounded-xl border border-dashed bg-muted/40 p-4">
            <p className="break-all font-mono text-sm">{publicUrl}</p>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(publicUrl);
                toast.success("Link copiado");
              }}
            >
              <Copy className="mr-2 h-4 w-4" /> Copiar
            </Button>
            <Button type="button" variant="outline" asChild>
              <a href={publicUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" /> Abrir Loja
              </a>
            </Button>
            <Button type="button" variant="outline" asChild>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Confira nosso cardápio: ${publicUrl}`)}`}
                target="_blank"
                rel="noreferrer"
              >
                <Share2 className="mr-2 h-4 w-4" /> Compartilhar WhatsApp
              </a>
            </Button>
          </div>
        </Card>

        {/* SEÇÃO 6 — Cor principal */}
        <Card className="rounded-2xl border-border/60 p-6 shadow-elegant">
          <div className="mb-4 flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold">Personalização</h3>
          </div>
          <Label className="text-sm">Cor principal da loja</Label>
          <div className="mt-3 flex flex-wrap gap-3">
            {COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setForm({ ...form, primary_color: c.id })}
                className={`group flex items-center gap-2 rounded-full border-2 px-3 py-1.5 transition ${
                  form.primary_color === c.id
                    ? "border-foreground"
                    : "border-transparent hover:border-border"
                }`}
              >
                <span
                  className="h-6 w-6 rounded-full ring-2 ring-background"
                  style={{ background: c.hex }}
                />
                <span className="text-sm font-medium">{c.name}</span>
              </button>
            ))}
          </div>
        </Card>

        {/* SEÇÃO 7 — Horário */}
        <Card className="rounded-2xl border-border/60 p-6 shadow-elegant">
          <div className="mb-4 flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold">Horário de Funcionamento</h3>
          </div>
          <div className="space-y-3">
            {DAYS.map((d) => {
              const h = hours[d.id];
              const hasShift2 = h.open2 != null && h.close2 != null;
              return (
                <div
                  key={d.id}
                  className={`rounded-xl border p-3 space-y-2 transition-colors ${h.enabled ? "bg-card/50" : "bg-muted/30 border-dashed"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium w-20">{d.label}</span>
                      <Badge
                        variant={h.enabled ? "default" : "secondary"}
                        className={h.enabled ? "bg-success/15 text-success border-success/30" : "bg-destructive/10 text-destructive border-destructive/30"}
                      >
                        {getScheduleDayBadgeLabel(h.enabled)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground hidden sm:inline">
                        {getScheduleDaySwitchLabel(h.enabled)}
                      </span>
                      <Switch
                        checked={h.enabled}
                        onCheckedChange={(checked) =>
                          setHours({ ...hours, [d.id]: { ...h, enabled: checked } })
                        }
                        aria-label={`${d.label} ${h.enabled ? "aberto" : "fechado"}`}
                      />
                    </div>
                  </div>

                  {h.enabled ? (
                    <>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground w-16">1º turno</span>
                        <Input
                          type="time"
                          value={h.open}
                          onChange={(e) =>
                            setHours({ ...hours, [d.id]: { ...h, open: e.target.value } })
                          }
                          className="w-32"
                        />
                        <span className="text-muted-foreground">às</span>
                        <Input
                          type="time"
                          value={h.close}
                          onChange={(e) =>
                            setHours({ ...hours, [d.id]: { ...h, close: e.target.value } })
                          }
                          className="w-32"
                        />
                      </div>

                      {hasShift2 ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-muted-foreground w-16">2º turno</span>
                          <Input
                            type="time"
                            value={h.open2 ?? ""}
                            onChange={(e) =>
                              setHours({ ...hours, [d.id]: { ...h, open2: e.target.value } })
                            }
                            className="w-32"
                          />
                          <span className="text-muted-foreground">às</span>
                          <Input
                            type="time"
                            value={h.close2 ?? ""}
                            onChange={(e) =>
                              setHours({ ...hours, [d.id]: { ...h, close2: e.target.value } })
                            }
                            className="w-32"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setHours({ ...hours, [d.id]: { ...h, open2: null, close2: null } })
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setHours({
                              ...hours,
                              [d.id]: { ...h, open2: "18:00", close2: "22:00" },
                            })
                          }
                        >
                          + Adicionar 2º turno (ex: almoço e jantar)
                        </Button>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground pl-1">
                      Fechado neste dia. Ative para configurar os horários.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <div className="sticky bottom-4 z-10 flex justify-end">
          <Button type="submit" disabled={loading} size="lg" className="shadow-premium">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar alterações
          </Button>
        </div>
      </form>
    </div>
  );
}
