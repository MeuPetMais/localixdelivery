import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Configurações — Localix" }] }),
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

type Hours = Record<string, { open: string; close: string; enabled: boolean }>;

const DEFAULT_HOURS: Hours = DAYS.reduce((acc, d) => {
  acc[d.id] = { open: "18:00", close: "23:00", enabled: true };
  return acc;
}, {} as Hours);

async function uploadAsset(file: File, folder: "logos" | "covers", userId: string) {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${folder}/${userId}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("restaurant-assets").upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (error) throw error;
  const { data } = await supabase.storage
    .from("restaurant-assets")
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
  return data?.signedUrl ?? null;
}

function SettingsPage() {
  const { user } = Route.useRouteContext() as { user: { id: string } };
  const { data: restaurant, refetch } = useQuery({
    queryKey: ["restaurant", user.id],
    queryFn: async () =>
      (await supabase.from("restaurants").select("*").eq("owner_id", user.id).maybeSingle()).data,
  });

  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    whatsapp_phone: "",
    logo_url: "",
    cover_url: "",
    delivery_fee: "0",
    min_order: "0",
    delivery_time: "",
    delivery_radius: "",
    primary_color: "orange",
    is_open: true,
    address: "",
    instagram: "",
    facebook: "",
    website: "",
    email: "",
    latitude: "",
    longitude: "",
  });
  const [payments, setPayments] = useState<Record<string, boolean>>({
    cash: true, pix: true, credit: true, debit: false,
    meal_voucher: false, food_voucher: false,
    online_pix: false, online_credit: false, online_debit: false,
    google_pay: false, apple_pay: false,
  });

  const [hours, setHours] = useState<Hours>(DEFAULT_HOURS);
  const [loading, setLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!restaurant) return;
    const r = restaurant as any;
    setForm({
      name: r.name,
      slug: r.slug,
      description: r.description ?? "",
      whatsapp_phone: r.whatsapp_phone,
      logo_url: r.logo_url ?? "",
      cover_url: r.cover_url ?? "",
      delivery_fee: String(r.delivery_fee ?? 0),
      min_order: String(r.min_order ?? 0),
      delivery_time: r.delivery_time ?? "",
      delivery_radius: String(r.delivery_radius ?? ""),
      primary_color: r.primary_color ?? "orange",
      is_open: r.is_open,
      address: r.address ?? "",
      instagram: r.instagram ?? "",
      facebook: r.facebook ?? "",
      website: r.website ?? "",
      email: r.email ?? "",
      latitude: r.latitude != null ? String(r.latitude) : "",
      longitude: r.longitude != null ? String(r.longitude) : "",
    });
    const h = r.opening_hours as Hours | null;
    if (h) setHours({ ...DEFAULT_HOURS, ...h });
    if (r.payment_methods) setPayments((p) => ({ ...p, ...r.payment_methods }));
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
      const url = await uploadAsset(file, kind === "logo" ? "logos" : "covers", user.id);
      if (!url) throw new Error("Falha no upload");
      const field = kind === "logo" ? "logo_url" : "cover_url";
      setForm((f) => ({ ...f, [field]: url }));
      await supabase
        .from("restaurants")
        .update(kind === "logo" ? { logo_url: url } : { cover_url: url })
        .eq("id", restaurant!.id);
      toast.success(kind === "logo" ? "Logo atualizada" : "Capa atualizada");
      refetch();
    } catch (e: any) {
      toast.error(e.message);
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
    const next = !form.is_open;
    setForm({ ...form, is_open: next });
    await supabase.from("restaurants").update({ is_open: next }).eq("id", restaurant!.id);
    toast.success(next ? "Loja aberta" : "Loja fechada");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await (supabase.from("restaurants") as any)
      .update({
        name: form.name,
        description: form.description || null,
        whatsapp_phone: form.whatsapp_phone,
        delivery_fee: Number(form.delivery_fee.replace(",", ".")) || 0,
        min_order: Number(form.min_order.replace(",", ".")) || 0,
        delivery_time: form.delivery_time || null,
        delivery_radius: form.delivery_radius
          ? Number(form.delivery_radius.replace(",", "."))
          : null,
        primary_color: form.primary_color,
        opening_hours: hours as any,
        address: form.address || null,
        instagram: form.instagram || null,
        facebook: form.facebook || null,
        website: form.website || null,
        email: form.email || null,
        latitude: form.latitude ? Number(form.latitude.replace(",", ".")) : null,
        longitude: form.longitude ? Number(form.longitude.replace(",", ".")) : null,
        payment_methods: payments,
        updated_at: new Date().toISOString(),
      })
      .eq("id", restaurant!.id);

    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Configurações salvas");
    refetch();
  }

  const publicUrl =
    typeof window !== "undefined" ? `${window.location.origin}/r/${form.slug}` : `/r/${form.slug}`;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 pb-12">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Personalize a identidade visual e as regras da sua loja.
        </p>
      </div>

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
                    className={`h-2 w-2 rounded-full ${form.is_open ? "bg-emerald-500" : "bg-rose-500"}`}
                  />
                  <span className="text-sm text-muted-foreground">
                    {form.is_open ? "Aberto agora" : "Fechado"}
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
              >
                <Power className="mr-2 h-4 w-4" /> {form.is_open ? "Aberto" : "Fechado"}
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
                <Clock className="h-3.5 w-3.5" /> Tempo médio de entrega
              </Label>
              <Input
                placeholder="30-45 min"
                value={form.delivery_time}
                onChange={(e) => setForm({ ...form, delivery_time: e.target.value })}
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

        {/* SEÇÃO 5 — Link Público */}
        <Card className="rounded-2xl border-border/60 p-6 shadow-elegant">
          <div className="mb-4 flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold">Link Público</h3>
          </div>
          <div className="rounded-xl border border-dashed bg-muted/40 p-4">
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
          <div className="space-y-2">
            {DAYS.map((d) => {
              const h = hours[d.id];
              return (
                <div
                  key={d.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border bg-card/50 p-3 sm:grid-cols-[140px_1fr_auto]"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={h.enabled}
                      onChange={(e) =>
                        setHours({ ...hours, [d.id]: { ...h, enabled: e.target.checked } })
                      }
                      className="h-4 w-4 accent-primary"
                    />
                    <span className="font-medium">{d.label}</span>
                  </div>
                  <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
                    <Input
                      type="time"
                      value={h.open}
                      disabled={!h.enabled}
                      onChange={(e) =>
                        setHours({ ...hours, [d.id]: { ...h, open: e.target.value } })
                      }
                      className="w-32"
                    />
                    <span className="text-muted-foreground">às</span>
                    <Input
                      type="time"
                      value={h.close}
                      disabled={!h.enabled}
                      onChange={(e) =>
                        setHours({ ...hours, [d.id]: { ...h, close: e.target.value } })
                      }
                      className="w-32"
                    />
                  </div>
                  <Badge variant={h.enabled ? "default" : "secondary"} className="justify-self-end">
                    {h.enabled ? "Aberto" : "Fechado"}
                  </Badge>
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
