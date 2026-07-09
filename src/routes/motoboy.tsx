import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bike, Circle, MapPin, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  getMyDriverProfile, setMyPresence,
} from "@/lib/delivery-drivers.functions";

export const Route = createFileRoute("/motoboy")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Painel do Motoboy — Localix" },
    { name: "description", content: "Área exclusiva do entregador." },
  ] }),
  component: DriverPanel,
});

function DriverPanel() {
  const qc = useQueryClient();
  const getProfile = useServerFn(getMyDriverProfile);
  const setPresence = useServerFn(setMyPresence);
  const [session, setSession] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_, s) => setSession(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const { data: driver, isLoading } = useQuery({
    queryKey: ["me-driver"],
    queryFn: () => getProfile({}),
    enabled: session === true,
  });

  const presenceMut = useMutation({
    mutationFn: (v: { online: boolean; lat?: number; lng?: number }) => setPresence({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me-driver"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  // Heartbeat de localização enquanto online
  useEffect(() => {
    if (!driver?.online) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    const send = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => presenceMut.mutate({ online: true, lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, timeout: 8000 },
      );
    };
    send();
    const t = setInterval(send, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver?.online]);

  if (session === null) return <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>;

  if (!session) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-extrabold">Painel do Motoboy</h1>
        <p className="text-sm text-muted-foreground">
          Faça login com o e-mail cadastrado pelo restaurante.
        </p>
        <Button asChild><Link to="/auth">Entrar</Link></Button>
      </div>
    );
  }

  if (isLoading) return <div className="p-8 text-center text-sm text-muted-foreground">Carregando perfil…</div>;

  if (!driver) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-extrabold">Acesso não autorizado</h1>
        <p className="text-sm text-muted-foreground">
          Sua conta não está vinculada a nenhum restaurante como motoboy.
        </p>
        <Button variant="outline" onClick={() => supabase.auth.signOut()}>
          <LogOut className="mr-1 h-4 w-4" /> Sair
        </Button>
      </div>
    );
  }

  const online = driver.online;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 pb-24">
      <header className="flex items-center gap-4">
        <div className="relative h-16 w-16 overflow-hidden rounded-full bg-muted">
          {driver.photo_url ? (
            <img src={driver.photo_url} alt={driver.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-muted-foreground">
              {driver.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <Circle className={`absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-background ${online ? "fill-emerald-500 text-emerald-500" : "fill-muted-foreground/40 text-muted-foreground/40"}`} />
        </div>
        <div className="flex-1">
          <h1 className="font-display text-xl font-extrabold">{driver.name}</h1>
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <Bike className="h-3 w-3" />
            {driver.vehicle_type}{driver.vehicle_plate ? ` • ${driver.vehicle_plate}` : ""}
            <Badge variant="outline" className="ml-1 capitalize">{driver.status}</Badge>
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}>
          <LogOut className="h-4 w-4" />
        </Button>
      </header>

      <Card className="p-6 text-center">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
        <p className={`mt-1 font-display text-3xl font-extrabold ${online ? "text-emerald-600" : "text-muted-foreground"}`}>
          {online ? "Online" : "Offline"}
        </p>
        <Button
          className="mt-4 w-full"
          size="lg"
          variant={online ? "outline" : "default"}
          disabled={presenceMut.isPending || driver.status !== "ativo"}
          onClick={() => {
            if (!online && navigator.geolocation) {
              navigator.geolocation.getCurrentPosition(
                (pos) => presenceMut.mutate({ online: true, lat: pos.coords.latitude, lng: pos.coords.longitude }),
                () => presenceMut.mutate({ online: true }),
              );
            } else {
              presenceMut.mutate({ online: !online });
            }
          }}
        >
          {online ? "Sair (Offline)" : "Entrar Online"}
        </Button>
        {driver.status !== "ativo" && (
          <p className="mt-2 text-xs text-destructive">Cadastro {driver.status} — contate o restaurante.</p>
        )}
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <p className="text-2xl font-extrabold">0</p>
          <p className="text-xs text-muted-foreground">Pendentes</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-extrabold">0</p>
          <p className="text-xs text-muted-foreground">Em rota</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-extrabold">0</p>
          <p className="text-xs text-muted-foreground">Concluídos hoje</p>
        </Card>
      </div>

      {driver.last_lat != null && driver.last_lng != null && (
        <Card className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          Última localização: {driver.last_lat.toFixed(4)}, {driver.last_lng.toFixed(4)}
        </Card>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Atribuição de pedidos, tracking e mapa chegam no RC5.2.
      </p>
    </div>
  );
}
