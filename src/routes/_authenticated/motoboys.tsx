import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bike, Car, Footprints, Search, Plus, Trash2, Pencil, MapPin, Users,
  Wifi, Package, Clock, ArrowLeft, ArrowRight, Check, Upload, X, Eye,
  UserPlus, ShieldCheck, IdCard, Camera, Loader2, Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  listDrivers, updateDriver, deleteDriver,
} from "@/lib/delivery-drivers.functions";
import { registerDriverPending } from "@/lib/driver-activation.functions";
import { uploadDriverAsset } from "@/lib/driver-upload";

export const Route = createFileRoute("/_authenticated/motoboys")({
  head: () => ({ meta: [
    { title: "Motoboys — Localix" },
    { name: "description", content: "Gerencie sua equipe de entregadores própria: cadastros, status, veículos e documentos." },
  ] }),
  component: DriversPage,
});

type Vehicle = "moto" | "bicicleta" | "carro" | "a_pe";
type DriverStatus = "ativo" | "inativo" | "afastado";

type Driver = {
  id: string; name: string; phone: string | null; email: string | null;
  cpf: string | null; photo_url: string | null;
  vehicle_type: Vehicle;
  vehicle_plate: string | null;
  status: DriverStatus;
  online: boolean;
  last_lat: number | null; last_lng: number | null; last_seen_at: string | null;
  created_at?: string;
};

const VEHICLE_LABEL: Record<Vehicle, string> = {
  moto: "Moto", bicicleta: "Bicicleta", carro: "Carro", a_pe: "A pé",
};

function VehicleIcon({ v, className }: { v: Vehicle; className?: string }) {
  const Icon = v === "bicicleta" ? Bike : v === "carro" ? Car : v === "a_pe" ? Footprints : Bike;
  return <Icon className={className ?? "h-4 w-4"} />;
}

/* ============ STATUS =============
 * 🟢 Online 🔵 Em entrega 🟡 Retornando 🟠 Pausa ⚪ Offline 🔴 Inativo
 * Baseado em: driver.status + driver.online (dados disponíveis atualmente).
 */
type PresenceState = "online" | "delivering" | "returning" | "paused" | "offline" | "inactive";

function derivePresence(d: Driver): PresenceState {
  if (d.status === "inativo") return "inactive";
  if (d.status === "afastado") return "paused";
  if (d.online) return "online";
  return "offline";
}

const PRESENCE_META: Record<PresenceState, { label: string; dot: string; text: string; bg: string; ring: string }> = {
  online:     { label: "Online",      dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-500/10", ring: "ring-emerald-500/30" },
  delivering: { label: "Em entrega",  dot: "bg-sky-500",     text: "text-sky-700 dark:text-sky-400",         bg: "bg-sky-500/10",     ring: "ring-sky-500/30" },
  returning:  { label: "Retornando",  dot: "bg-amber-400",   text: "text-amber-700 dark:text-amber-400",     bg: "bg-amber-400/10",   ring: "ring-amber-400/30" },
  paused:     { label: "Pausa",       dot: "bg-orange-500",  text: "text-orange-700 dark:text-orange-400",   bg: "bg-orange-500/10",  ring: "ring-orange-500/30" },
  offline:    { label: "Offline",     dot: "bg-muted-foreground/50", text: "text-muted-foreground",          bg: "bg-muted",          ring: "ring-border" },
  inactive:   { label: "Inativo",     dot: "bg-red-500",     text: "text-red-700 dark:text-red-400",         bg: "bg-red-500/10",     ring: "ring-red-500/30" },
};

function StatusPill({ state }: { state: PresenceState }) {
  const m = PRESENCE_META[state];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1", m.bg, m.text, m.ring)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", m.dot)} />
      {m.label}
    </span>
  );
}

/* ============ DASHBOARD ============ */

function DriversPage() {
  const restaurant = useRestaurant();
  const qc = useQueryClient();
  const list = useServerFn(listDrivers);
  const create = useServerFn(registerDriverPending);
  const update = useServerFn(updateDriver);
  const remove = useServerFn(deleteDriver);

  const queryKey = ["delivery-drivers", restaurant.id] as const;
  const { data: drivers = [], isLoading, error: listError } = useQuery({
    queryKey,
    queryFn: () => list({ data: { restaurantId: restaurant.id } }),
    enabled: !!restaurant.id,
    staleTime: 0,
    refetchOnMount: "always",
    retry: 1,
  });
  useEffect(() => {
    if (listError) {
      console.error("[motoboys] listDrivers error", listError);
      toast.error("Falha ao carregar motoboys: " + (listError as Error).message);
    }
  }, [listError]);

  useEffect(() => {
    const ch = supabase
      .channel(`drivers-${restaurant.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "delivery_drivers", filter: `restaurant_id=eq.${restaurant.id}` },
        () => qc.invalidateQueries({ queryKey }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restaurant.id, qc]);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | PresenceState>("all");
  const [editing, setEditing] = useState<Driver | null>(null);
  const [viewing, setViewing] = useState<Driver | null>(null);
  const [creating, setCreating] = useState(false);

  const enriched = useMemo(
    () => (drivers as Driver[]).map((d) => ({ ...d, _presence: derivePresence(d) as PresenceState })),
    [drivers],
  );

  const filtered = enriched.filter((d) => {
    const q = query.trim().toLowerCase();
    const matchesQ = !q ||
      d.name.toLowerCase().includes(q) ||
      (d.phone ?? "").toLowerCase().includes(q) ||
      (d.vehicle_plate ?? "").toLowerCase().includes(q);
    const matchesF = filter === "all" || d._presence === filter;
    return matchesQ && matchesF;
  });

  const stats = useMemo(() => {
    const total = enriched.length;
    const online = enriched.filter((d) => d._presence === "online").length;
    const delivering = enriched.filter((d) => d._presence === "delivering").length;
    const returning = enriched.filter((d) => d._presence === "returning").length;
    const paused = enriched.filter((d) => d._presence === "paused").length;
    const offline = enriched.filter((d) => d._presence === "offline" || d._presence === "inactive").length;
    return { total, online, delivering, returning, paused, offline };
  }, [enriched]);

  const createMut = useMutation({
    mutationFn: (data: any) => create({ data }),
    onSuccess: async () => {
      toast.success("Motoboy cadastrado com sucesso");
      await qc.invalidateQueries({ queryKey });
      await qc.refetchQueries({ queryKey });
    },
    onError: (e: Error) => {
      console.error("[motoboys] createDriver error", e);
      toast.error(e.message);
    },
  });
  const updateMut = useMutation({
    mutationFn: (data: any) => update({ data }),
    onSuccess: async () => {
      toast.success("Motoboy atualizado");
      setEditing(null);
      await qc.invalidateQueries({ queryKey });
      await qc.refetchQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id, restaurantId: restaurant.id } }),
    onSuccess: async () => {
      toast.success("Motoboy removido");
      await qc.invalidateQueries({ queryKey });
      await qc.refetchQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 pb-24 animate-in fade-in duration-300">
      {/* HEADER */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Motoboys</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie sua equipe de entregas própria.
          </p>
        </div>
        <Button size="lg" onClick={() => setCreating(true)} className="shrink-0 shadow-sm">
          <UserPlus className="mr-2 h-4 w-4" /> Novo motoboy
        </Button>
      </header>

      {/* STATS */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard icon={Users} label="Cadastrados" value={stats.total} />
        <StatCard icon={Wifi} label="Online" value={stats.online} tone="emerald" />
        <StatCard icon={Package} label="Em entrega" value={stats.delivering} tone="sky" />
        <StatCard icon={ArrowLeft} label="Retornando" value={stats.returning} tone="amber" />
        <StatCard icon={Clock} label="Em pausa" value={stats.paused} tone="orange" />
        <StatCard icon={ShieldCheck} label="Offline" value={stats.offline} tone="muted" />
      </section>

      {/* SEARCH + FILTERS */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, telefone ou placa"
            className="pl-9"
          />
        </div>
        <div className="-mx-1 flex gap-1 overflow-x-auto pb-1 sm:mx-0">
          {([
            ["all", "Todos"],
            ["online", "Online"],
            ["delivering", "Em entrega"],
            ["returning", "Retornando"],
            ["paused", "Pausa"],
            ["offline", "Offline"],
          ] as const).map(([id, label]) => (
            <Button
              key={id}
              variant={filter === id ? "default" : "outline"}
              size="sm"
              className="shrink-0"
              onClick={() => setFilter(id as typeof filter)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* LIST */}
      {isLoading ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
          Carregando equipe…
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState hasAny={enriched.length > 0} onCreate={() => setCreating(true)} />
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((d) => (
            <DriverCard
              key={d.id}
              driver={d}
              presence={d._presence}
              onView={() => setViewing(d)}
              onEdit={() => setEditing(d)}
              onToggle={() =>
                updateMut.mutate({
                  id: d.id, restaurantId: restaurant.id,
                  patch: { status: d.status === "ativo" ? "inativo" : "ativo" },
                })
              }
              onDelete={() => {
                if (confirm(`Remover ${d.name}?`)) removeMut.mutate(d.id);
              }}
            />
          ))}
        </section>
      )}

      {/* MODALS */}
      {creating && (
        <WizardDialog
          open
          onClose={() => setCreating(false)}
          restaurantId={restaurant.id}
          onSubmit={async (form) => {
            await createMut.mutateAsync({ ...form, restaurantId: restaurant.id });
          }}
        />
      )}
      {editing && (
        <EditDialog
          open
          driver={editing}
          restaurantId={restaurant.id}
          loading={updateMut.isPending}
          onClose={() => setEditing(null)}
          onSubmit={(patch) => updateMut.mutate({ id: editing.id, restaurantId: restaurant.id, patch })}
        />
      )}
      {viewing && (
        <DetailsDialog
          open
          driver={viewing}
          presence={derivePresence(viewing)}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}

/* ============ COMPONENTS ============ */

function StatCard({
  icon: Icon, label, value, tone = "primary",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: number | string;
  tone?: "primary" | "emerald" | "sky" | "amber" | "orange" | "muted";
}) {
  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    sky:     "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    amber:   "bg-amber-400/15 text-amber-700 dark:text-amber-400",
    orange:  "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    muted:   "bg-muted text-muted-foreground",
  };
  return (
    <Card className="flex items-center gap-3 p-4 transition-shadow hover:shadow-md">
      <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", tones[tone])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="font-display text-xl font-extrabold leading-none">{value}</p>
      </div>
    </Card>
  );
}

function DriverCard({
  driver, presence, onView, onEdit, onToggle, onDelete,
}: {
  driver: Driver; presence: PresenceState;
  onView: () => void; onEdit: () => void; onToggle: () => void; onDelete: () => void;
}) {
  const meta = PRESENCE_META[presence];
  const online = presence === "online" || presence === "delivering" || presence === "returning";
  const initials = driver.name.split(" ").slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "?";
  const lastSeen = driver.last_seen_at ? relativeTime(driver.last_seen_at) : "—";

  return (
    <Card className="group relative overflow-hidden p-0 transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <div className={cn("h-1 w-full", meta.dot)} />
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="relative">
            <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-muted to-muted/50 text-lg font-bold text-muted-foreground ring-1 ring-border">
              {driver.photo_url ? (
                <img src={driver.photo_url} alt={driver.name} className="h-full w-full object-cover" />
              ) : initials}
            </div>
            <span className={cn(
              "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-background",
              meta.dot,
            )} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate font-semibold">{driver.name}</p>
            </div>
            <div className="mt-1"><StatusPill state={presence} /></div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <VehicleIcon v={driver.vehicle_type} className="h-3.5 w-3.5" />
                {VEHICLE_LABEL[driver.vehicle_type]}
                {driver.vehicle_plate ? ` • ${driver.vehicle_plate}` : ""}
              </span>
              {driver.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> {driver.phone}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <MiniStat label="Entrega atual" value="—" />
          <MiniStat label={online ? "Online há" : "Visto"} value={lastSeen} />
          <MiniStat label="Posição fila" value="—" />
        </div>

        {driver.last_lat != null && driver.last_lng != null && (
          <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <MapPin className="h-3 w-3" /> {driver.last_lat.toFixed(3)}, {driver.last_lng.toFixed(3)}
          </p>
        )}

        <div className="mt-4 flex items-center justify-between gap-2">
          <Button size="sm" variant="outline" onClick={onView} className="flex-1">
            <Eye className="mr-1 h-4 w-4" /> Detalhes
          </Button>
          <Button size="sm" variant="outline" onClick={onEdit} className="flex-1">
            <Pencil className="mr-1 h-4 w-4" /> Editar
          </Button>
          <Button size="sm" variant="ghost" onClick={onToggle} title={driver.status === "ativo" ? "Inativar" : "Ativar"}>
            {driver.status === "ativo" ? "Inativar" : "Ativar"}
          </Button>
          <Button size="icon" variant="ghost" onClick={onDelete} aria-label="Remover">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-muted/50 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function EmptyState({ hasAny, onCreate }: { hasAny: boolean; onCreate: () => void }) {
  return (
    <Card className="flex flex-col items-center gap-4 p-12 text-center">
      <div className="relative">
        <div className="grid h-24 w-24 place-items-center rounded-full bg-primary/10">
          <Bike className="h-12 w-12 text-primary" />
        </div>
        <span className="absolute -right-1 -top-1 grid h-8 w-8 place-items-center rounded-full bg-background ring-2 ring-primary">
          <Plus className="h-4 w-4 text-primary" />
        </span>
      </div>
      <div className="max-w-md">
        <h3 className="text-lg font-bold">
          {hasAny ? "Nenhum motoboy neste filtro" : "Você ainda não possui motoboys cadastrados"}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasAny
            ? "Ajuste os filtros ou pesquise por outro termo."
            : "Cadastre seu primeiro entregador para iniciar sua operação de entrega própria."}
        </p>
      </div>
      {!hasAny && (
        <Button size="lg" onClick={onCreate}>
          <UserPlus className="mr-2 h-4 w-4" /> Cadastrar primeiro motoboy
        </Button>
      )}
    </Card>
  );
}

/* ============ WIZARD ============
 *
 * NOTA DE ARQUITETURA — Ativação de conta do entregador
 * ------------------------------------------------------
 * O restaurante NÃO cria credenciais de acesso. Ele apenas cadastra o
 * colaborador. A ativação da conta (validação de CPF/telefone, criação
 * de e-mail opcional, criação de senha e login) é responsabilidade do
 * aplicativo "Localix Motoboy", em RC futuro.
 *
 * Como a server function `createDriver` (contrato imutável neste RC)
 * ainda exige e-mail + senha para provisionar o usuário no Auth, geramos
 * um placeholder determinístico aqui no cliente — o entregador troca
 * essas credenciais pelo app quando ativar a própria conta.
 *
 * Pontos de extensão previstos (não implementados agora):
 *   - fluxo de ativação por CPF+telefone no app do entregador
 *   - envio de código OTP para o telefone cadastrado
 *   - opção de definir e-mail real durante a ativação
 *   - reset seguro de senha placeholder no primeiro login
 * ==================================================== */

type WizardForm = {
  name: string; phone: string; cpf: string;
  vehicleType: Vehicle; vehiclePlate: string; vehicleModel: string; vehicleColor: string;
  photoUrl: string; cnhUrl: string; addressProofUrl: string;
};

const emptyForm: WizardForm = {
  name: "", phone: "", cpf: "",
  vehicleType: "moto", vehiclePlate: "", vehicleModel: "", vehicleColor: "",
  photoUrl: "", cnhUrl: "", addressProofUrl: "",
};

function WizardDialog({
  open, onClose, restaurantId, onSubmit,
}: {
  open: boolean; onClose: () => void; restaurantId: string;
  onSubmit: (data: {
    name: string; phone: string; cpf: string;
    vehicleType: Vehicle; vehiclePlate: string | null;
    photoUrl: string | null; documentUrl: string | null;
  }) => Promise<void>;
}) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [f, setF] = useState<WizardForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const reset = () => { setF(emptyForm); setStep(1); };

  const validateStep = (): string | null => {
    if (step === 1) {
      if (f.name.trim().length < 2) return "Informe o nome completo do entregador";
      if (f.cpf.replace(/\D/g, "").length < 11) return "Informe um CPF válido";
      if (f.phone.replace(/\D/g, "").length < 10) return "Informe um telefone válido";
    }
    if (step === 2) {
      if (!f.vehicleType) return "Selecione o tipo de veículo";
    }
    return null;
  };

  const next = () => {
    const err = validateStep();
    if (err) { toast.error(err); return; }
    setStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s));
  };

  const submit = async () => {
    setSaving(true);
    try {
      // RC5.4 — Restaurante NÃO cria login/senha. A conta é ativada pelo
      // próprio entregador em /entregador/ativar (app Localix Entregador).
      await onSubmit({
        name: f.name.trim(),
        phone: f.phone.trim(),
        cpf: f.cpf.trim(),
        vehicleType: f.vehicleType,
        vehiclePlate: f.vehiclePlate.trim() || null,
        photoUrl: f.photoUrl || null,
        documentUrl: f.cnhUrl || f.addressProofUrl || null,
      });
      setStep(4);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };


  const progress = step === 4 ? 100 : (step / 3) * 100;
  const stepLabel = step === 1 ? "Dados pessoais" : step === 2 ? "Veículo" : "Documentação";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl p-0">
        <DialogHeader className="border-b p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg">Cadastrar entregador</DialogTitle>
              {step < 4 && (
                <p className="text-xs text-muted-foreground">
                  Etapa {step} de 3 • {stepLabel}
                </p>
              )}
            </div>
          </div>
          {step < 4 && <Progress value={progress} className="mt-4 h-1.5" />}
        </DialogHeader>

        <div className="max-h-[65vh] overflow-y-auto p-6">
          {step === 1 && <StepPersonal f={f} setF={setF} />}
          {step === 2 && <StepVehicle f={f} setF={setF} />}
          {step === 3 && <StepDocuments f={f} setF={setF} restaurantId={restaurantId} />}
          {step === 4 && <StepSuccess />}
        </div>

        <div className="flex items-center justify-between gap-2 border-t p-4">
          {step === 4 ? (
            <>
              <Button variant="outline" onClick={reset}>
                <Plus className="mr-1 h-4 w-4" /> Cadastrar outro entregador
              </Button>
              <Button onClick={onClose}>
                <Check className="mr-1 h-4 w-4" /> Voltar para lista
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={() => (step === 1 ? onClose() : setStep((s) => ((s - 1) as 1 | 2 | 3)))}
                disabled={saving}
              >
                {step === 1 ? "Cancelar" : (<><ArrowLeft className="mr-1 h-4 w-4" /> Voltar</>)}
              </Button>
              {step < 3 ? (
                <Button onClick={next}>Próximo <ArrowRight className="ml-1 h-4 w-4" /></Button>
              ) : (
                <Button onClick={submit} disabled={saving}>
                  {saving ? (<><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Salvando…</>) : (<><Check className="mr-1 h-4 w-4" /> Cadastrar entregador</>)}
                </Button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StepPersonal({ f, setF }: { f: WizardForm; setF: (v: WizardForm) => void }) {
  return (
    <div className="grid gap-4 animate-in fade-in slide-in-from-right-2 duration-200">
      <div className="grid gap-1.5">
        <Label>Nome completo *</Label>
        <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="João da Silva" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>Telefone</Label>
          <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="(11) 90000-0000" />
        </div>
        <div className="grid gap-1.5">
          <Label>CPF</Label>
          <Input value={f.cpf} onChange={(e) => setF({ ...f, cpf: e.target.value })} placeholder="000.000.000-00" />
        </div>
      </div>
      <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-xs text-muted-foreground">
        As credenciais de acesso serão criadas pelo próprio entregador no
        aplicativo <span className="font-semibold text-foreground">Localix Motoboy</span> após
        o cadastro ser concluído.
      </div>
    </div>
  );
}

function StepVehicle({ f, setF }: { f: WizardForm; setF: (v: WizardForm) => void }) {
  const opts: Array<{ v: Vehicle; label: string; Icon: React.ComponentType<{ className?: string }> }> = [
    { v: "moto", label: "Moto", Icon: Bike },
    { v: "bicicleta", label: "Bicicleta", Icon: Bike },
    { v: "carro", label: "Carro", Icon: Car },
    { v: "a_pe", label: "A pé", Icon: Footprints },
  ];
  return (
    <div className="grid gap-5 animate-in fade-in slide-in-from-right-2 duration-200">
      <div className="grid gap-2">
        <Label>Tipo de veículo *</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {opts.map(({ v, label, Icon }) => (
            <button
              key={v}
              type="button"
              onClick={() => setF({ ...f, vehicleType: v })}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border p-4 text-sm transition-all",
                f.vehicleType === v
                  ? "border-primary bg-primary/5 ring-2 ring-primary"
                  : "hover:border-primary/50 hover:bg-muted",
              )}
            >
              <Icon className="h-6 w-6" />
              <span className="font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label>Placa</Label>
          <Input value={f.vehiclePlate} onChange={(e) => setF({ ...f, vehiclePlate: e.target.value.toUpperCase() })} placeholder="ABC-1D23" />
        </div>
        <div className="grid gap-1.5">
          <Label>Modelo <span className="text-muted-foreground">(opcional)</span></Label>
          <Input value={f.vehicleModel} onChange={(e) => setF({ ...f, vehicleModel: e.target.value })} placeholder="Honda Biz" />
        </div>
        <div className="grid gap-1.5">
          <Label>Cor <span className="text-muted-foreground">(opcional)</span></Label>
          <Input value={f.vehicleColor} onChange={(e) => setF({ ...f, vehicleColor: e.target.value })} placeholder="Vermelha" />
        </div>
      </div>
    </div>
  );
}

function StepDocuments({
  f, setF, restaurantId,
}: { f: WizardForm; setF: (v: WizardForm) => void; restaurantId: string }) {
  return (
    <div className="grid gap-5 animate-in fade-in slide-in-from-right-2 duration-200">
      <div className="grid gap-4 sm:grid-cols-3">
        <UploadTile
          label="Foto do Entregador"
          description="Envie uma foto para identificação do entregador."
          icon={Camera} kind="photo"
          value={f.photoUrl} onChange={(url) => setF({ ...f, photoUrl: url })}
          restaurantId={restaurantId}
        />
        <UploadTile
          label="CNH"
          description="Envie a frente da Carteira Nacional de Habilitação."
          icon={IdCard} kind="cnh"
          value={f.cnhUrl} onChange={(url) => setF({ ...f, cnhUrl: url })}
          restaurantId={restaurantId}
        />
        <UploadTile
          label="Comprovante de Endereço"
          description="Conta de água, energia, telefone ou outro comprovante recente."
          icon={ShieldCheck} kind="document"
          value={f.addressProofUrl} onChange={(url) => setF({ ...f, addressProofUrl: url })}
          restaurantId={restaurantId}
        />
      </div>
      <p className="rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
        Os documentos enviados são utilizados exclusivamente para validação do
        cadastro e permanecem protegidos conforme a política de privacidade da
        Localix.
      </p>
    </div>
  );
}

function UploadTile({
  label, description, icon: Icon, value, onChange, restaurantId, kind,
}: {
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  value: string; onChange: (url: string) => void;
  restaurantId: string;
  kind: "photo" | "cnh" | "document";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [fileMeta, setFileMeta] = useState<{ name: string; size: number } | null>(null);

  const pick = () => inputRef.current?.click();
  const onFile = async (file?: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadDriverAsset(file, restaurantId, kind);
      onChange(url);
      setFileMeta({ name: file.name, size: file.size });
      toast.success(`${label} enviado`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = () => { onChange(""); setFileMeta(null); };

  const humanSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="grid gap-2">
      <div>
        <Label className="text-sm font-semibold">{label}</Label>
        {description && (
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={pick}
        aria-label={value ? `Trocar ${label}` : `Enviar ${label}`}
        className={cn(
          "group relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          value ? "border-transparent" : "hover:border-primary hover:bg-primary/5",
        )}
      >
        {value ? (
          <>
            <img src={value} alt={label} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              <div className="flex h-full items-center justify-center gap-2 text-white">
                <Upload className="h-4 w-4" /> Trocar
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Icon className="h-6 w-6" />}
            <span className="text-xs">{busy ? "Enviando…" : "Selecionar arquivo"}</span>
          </div>
        )}
      </button>
      {value && (
        <div className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5 text-xs">
          <div className="min-w-0">
            <p className="truncate font-medium">{fileMeta?.name ?? "Arquivo enviado"}</p>
            {fileMeta && <p className="text-muted-foreground">{humanSize(fileMeta.size)}</p>}
          </div>
          <Button size="sm" variant="ghost" onClick={remove} className="h-7 px-2">
            <X className="mr-1 h-3.5 w-3.5" /> Remover
          </Button>
        </div>
      )}
      <input
        ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
    </div>
  );
}

function StepSuccess() {
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center animate-in fade-in zoom-in-95 duration-300">
      <div className="grid h-20 w-20 place-items-center rounded-full bg-emerald-500/15 text-emerald-600">
        <Check className="h-10 w-10" />
      </div>
      <div className="max-w-md space-y-3">
        <h3 className="text-xl font-bold">Entregador cadastrado com sucesso.</h3>
        <div className="rounded-lg border bg-muted/30 p-4 text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Próximo passo
          </p>
          <p className="mt-1.5 text-sm leading-relaxed">
            Solicite que o entregador instale o aplicativo{" "}
            <span className="font-semibold">Localix Motoboy</span> para ativar
            sua conta e criar suas credenciais de acesso.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
          <Clock className="h-3.5 w-3.5" /> Status: Aguardando Ativação
        </div>
      </div>
    </div>
  );
}

/* ============ EDIT / DETAILS ============ */

function EditDialog({
  open, driver, restaurantId, loading, onClose, onSubmit,
}: {
  open: boolean; driver: Driver; restaurantId: string; loading?: boolean;
  onClose: () => void;
  onSubmit: (patch: {
    name?: string; phone?: string | null; cpf?: string | null;
    vehicle_type?: Vehicle; vehicle_plate?: string | null;
    photo_url?: string | null;
  }) => void;
}) {
  const [name, setName] = useState(driver.name);
  const [phone, setPhone] = useState(driver.phone ?? "");
  const [cpf, setCpf] = useState(driver.cpf ?? "");
  const [vt, setVt] = useState<Vehicle>(driver.vehicle_type);
  const [plate, setPlate] = useState(driver.vehicle_plate ?? "");
  const [photoUrl, setPhotoUrl] = useState(driver.photo_url ?? "");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Editar motoboy</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-muted">
              {photoUrl ? <img src={photoUrl} alt="" className="h-full w-full object-cover" /> : null}
            </div>
            <div className="flex-1">
              <UploadTile
                label="Trocar foto" icon={Camera} kind="photo"
                value={photoUrl} onChange={setPhotoUrl} restaurantId={restaurantId}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Telefone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div className="grid gap-1.5"><Label>CPF</Label>
              <Input value={cpf} onChange={(e) => setCpf(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Veículo</Label>
              <Select value={vt} onValueChange={(v) => setVt(v as Vehicle)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="moto">Moto</SelectItem>
                  <SelectItem value="bicicleta">Bicicleta</SelectItem>
                  <SelectItem value="carro">Carro</SelectItem>
                  <SelectItem value="a_pe">A pé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5"><Label>Placa</Label>
              <Input value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} /></div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={loading}
            onClick={() =>
              onSubmit({
                name, phone: phone || null, cpf: cpf || null,
                vehicle_type: vt, vehicle_plate: plate || null,
                photo_url: photoUrl || null,
              })
            }
          >
            {loading ? "Salvando…" : "Salvar alterações"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailsDialog({
  open, driver, presence, onClose,
}: { open: boolean; driver: Driver; presence: PresenceState; onClose: () => void }) {
  const initials = driver.name.split(" ").slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Detalhes do motoboy</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="flex items-center gap-4">
            <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-2xl bg-muted text-xl font-bold text-muted-foreground">
              {driver.photo_url ? (
                <img src={driver.photo_url} alt={driver.name} className="h-full w-full object-cover" />
              ) : initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold">{driver.name}</p>
              <div className="mt-1"><StatusPill state={presence} /></div>
              <p className="mt-1 text-xs text-muted-foreground">{driver.email ?? "—"}</p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Info k="Telefone" v={driver.phone ?? "—"} />
            <Info k="CPF" v={driver.cpf ?? "—"} />
            <Info k="Veículo" v={`${VEHICLE_LABEL[driver.vehicle_type]}${driver.vehicle_plate ? ` • ${driver.vehicle_plate}` : ""}`} />
            <Info k="Última atividade" v={driver.last_seen_at ? relativeTime(driver.last_seen_at) : "—"} />
          </dl>
          {driver.last_lat != null && driver.last_lng != null && (
            <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
              <MapPin className="mr-1 inline h-3.5 w-3.5" />
              Última posição: {driver.last_lat.toFixed(5)}, {driver.last_lng.toFixed(5)}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg border p-3">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</dt>
      <dd className="mt-0.5 font-medium">{v}</dd>
    </div>
  );
}

/* ============ UTILS ============ */

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.round(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return `${d}d`;
}
