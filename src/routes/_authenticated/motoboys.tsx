import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bike, Car, Footprints, Search, Plus, Trash2, Pencil, Circle, MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { supabase } from "@/integrations/supabase/client";
import {
  listDrivers, createDriver, updateDriver, deleteDriver,
} from "@/lib/delivery-drivers.functions";

export const Route = createFileRoute("/_authenticated/motoboys")({
  head: () => ({ meta: [
    { title: "Motoboys — Localix" },
    { name: "description", content: "Gerencie a equipe de entregadores do seu restaurante." },
  ] }),
  component: DriversPage,
});

type Driver = {
  id: string; name: string; phone: string | null; email: string | null;
  cpf: string | null; photo_url: string | null;
  vehicle_type: "moto" | "bicicleta" | "carro" | "a_pe";
  vehicle_plate: string | null;
  status: "ativo" | "inativo" | "afastado";
  online: boolean;
  last_lat: number | null; last_lng: number | null; last_seen_at: string | null;
};

const VEHICLE_LABEL: Record<Driver["vehicle_type"], string> = {
  moto: "Moto", bicicleta: "Bicicleta", carro: "Carro", a_pe: "A pé",
};

function VehicleIcon({ v }: { v: Driver["vehicle_type"] }) {
  if (v === "bicicleta") return <Bike className="h-4 w-4" />;
  if (v === "carro") return <Car className="h-4 w-4" />;
  if (v === "a_pe") return <Footprints className="h-4 w-4" />;
  return <Bike className="h-4 w-4" />;
}

function DriversPage() {
  const restaurant = useRestaurant();
  const qc = useQueryClient();
  const list = useServerFn(listDrivers);
  const create = useServerFn(createDriver);
  const update = useServerFn(updateDriver);
  const remove = useServerFn(deleteDriver);

  const queryKey = ["delivery-drivers", restaurant.id] as const;
  const { data: drivers = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => list({ data: { restaurantId: restaurant.id } }),
  });

  // Realtime
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
  const [editing, setEditing] = useState<Driver | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = (drivers as Driver[]).filter((d) =>
    !query || d.name.toLowerCase().includes(query.toLowerCase()) ||
    (d.phone ?? "").includes(query) || (d.email ?? "").toLowerCase().includes(query.toLowerCase()),
  );

  const createMut = useMutation({
    mutationFn: (data: Parameters<typeof createDriver>[0]["data"]) => create({ data }),
    onSuccess: () => { toast.success("Motoboy cadastrado"); setCreating(false); qc.invalidateQueries({ queryKey }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateMut = useMutation({
    mutationFn: (data: Parameters<typeof updateDriver>[0]["data"]) => update({ data }),
    onSuccess: () => { toast.success("Atualizado"); setEditing(null); qc.invalidateQueries({ queryKey }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id, restaurantId: restaurant.id } }),
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const onlineCount = filtered.filter((d) => d.online).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Motoboys</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} cadastrado(s) • {onlineCount} online agora
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome, telefone…" className="w-64 pl-8" />
          </div>
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-1 h-4 w-4" /> Novo Motoboy
          </Button>
        </div>
      </header>

      {isLoading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Carregando…</Card>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-muted-foreground">Nenhum motoboy cadastrado ainda.</p>
          <Button className="mt-4" onClick={() => setCreating(true)}>
            <Plus className="mr-1 h-4 w-4" /> Cadastrar o primeiro
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((d) => (
            <Card key={d.id} className="flex items-center gap-4 p-4">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-muted">
                {d.photo_url ? (
                  <img src={d.photo_url} alt={d.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-muted-foreground">
                    {d.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <Circle className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-background ${d.online ? "fill-emerald-500 text-emerald-500" : "fill-muted-foreground/40 text-muted-foreground/40"}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold">{d.name}</p>
                  <Badge variant={d.status === "ativo" ? "secondary" : "outline"} className="capitalize">
                    {d.status}
                  </Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">{d.phone ?? d.email ?? "—"}</p>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><VehicleIcon v={d.vehicle_type} /> {VEHICLE_LABEL[d.vehicle_type]}{d.vehicle_plate ? ` • ${d.vehicle_plate}` : ""}</span>
                  {d.last_lat != null && d.last_lng != null && (
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {d.last_lat.toFixed(3)},{d.last_lng.toFixed(3)}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditing(d)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost"
                  onClick={() => updateMut.mutate({ id: d.id, restaurantId: restaurant.id, patch: { status: d.status === "ativo" ? "inativo" : "ativo" } })}>
                  {d.status === "ativo" ? "Desativar" : "Ativar"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => {
                  if (confirm(`Remover ${d.name}?`)) removeMut.mutate(d.id);
                }}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {creating && (
        <DriverFormDialog
          open onClose={() => setCreating(false)}
          onSubmit={(form) => createMut.mutate({ ...form, restaurantId: restaurant.id })}
          loading={createMut.isPending}
        />
      )}
      {editing && (
        <DriverFormDialog
          open onClose={() => setEditing(null)}
          driver={editing}
          onSubmit={(form) => updateMut.mutate({
            id: editing.id, restaurantId: restaurant.id,
            patch: {
              name: form.name, phone: form.phone ?? null, cpf: form.cpf ?? null,
              vehicle_type: form.vehicleType, vehicle_plate: form.vehiclePlate ?? null,
              photo_url: form.photoUrl ?? null, document_url: form.documentUrl ?? null,
            },
          })}
          loading={updateMut.isPending}
        />
      )}
    </div>
  );
}

type FormData = {
  name: string; email: string; password: string; phone?: string | null;
  cpf?: string | null; vehicleType: "moto" | "bicicleta" | "carro" | "a_pe";
  vehiclePlate?: string | null; photoUrl?: string | null; documentUrl?: string | null;
};

function DriverFormDialog(props: {
  open: boolean; onClose: () => void; driver?: Driver;
  onSubmit: (f: FormData) => void; loading?: boolean;
}) {
  const { driver } = props;
  const [f, setF] = useState<FormData>({
    name: driver?.name ?? "",
    email: driver?.email ?? "",
    password: "",
    phone: driver?.phone ?? "",
    cpf: driver?.cpf ?? "",
    vehicleType: driver?.vehicle_type ?? "moto",
    vehiclePlate: driver?.vehicle_plate ?? "",
    photoUrl: driver?.photo_url ?? "",
    documentUrl: "",
  });

  return (
    <Dialog open={props.open} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{driver ? "Editar motoboy" : "Novo motoboy"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1"><Label>Nome</Label>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1"><Label>Telefone</Label>
              <Input value={f.phone ?? ""} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
            <div className="grid gap-1"><Label>CPF</Label>
              <Input value={f.cpf ?? ""} onChange={(e) => setF({ ...f, cpf: e.target.value })} /></div>
          </div>
          {!driver && (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1"><Label>E-mail (login)</Label>
                <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
              <div className="grid gap-1"><Label>Senha</Label>
                <Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1"><Label>Veículo</Label>
              <Select value={f.vehicleType} onValueChange={(v) => setF({ ...f, vehicleType: v as FormData["vehicleType"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="moto">Moto</SelectItem>
                  <SelectItem value="bicicleta">Bicicleta</SelectItem>
                  <SelectItem value="carro">Carro</SelectItem>
                  <SelectItem value="a_pe">A pé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1"><Label>Placa</Label>
              <Input value={f.vehiclePlate ?? ""} onChange={(e) => setF({ ...f, vehiclePlate: e.target.value })} /></div>
          </div>
          <div className="grid gap-1"><Label>Foto (URL)</Label>
            <Input value={f.photoUrl ?? ""} onChange={(e) => setF({ ...f, photoUrl: e.target.value })} /></div>
          {!driver && (
            <div className="grid gap-1"><Label>Documento (URL)</Label>
              <Input value={f.documentUrl ?? ""} onChange={(e) => setF({ ...f, documentUrl: e.target.value })} /></div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={props.onClose}>Cancelar</Button>
          <Button disabled={props.loading} onClick={() => props.onSubmit(f)}>
            {props.loading ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
