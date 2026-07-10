// RC5.2.f — Widget de turnos ativos para o painel do restaurante.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { listActiveShifts } from "@/lib/driver-shift.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtMinutes } from "@/lib/delivery/DriverShiftService";

export function ActiveShiftsPanel() {
  const qc = useQueryClient();
  const run = useServerFn(listActiveShifts);
  const { data } = useQuery({
    queryKey: ["restaurant-active-shifts"],
    queryFn: () => run(),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const ch = supabase
      .channel("restaurant-shifts")
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_shifts" }, () => {
        qc.invalidateQueries({ queryKey: ["restaurant-active-shifts"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const shifts = data ?? [];
  return (
    <Card className="rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">Turnos Ativos</h3>
        <Badge variant="secondary">{shifts.length}</Badge>
      </div>
      {shifts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum motoboy em turno.</p>
      ) : (
        <ul className="space-y-2">
          {shifts.map((s: any) => {
            const online =
              (s.online_minutes ?? 0) +
              (s.waiting_minutes ?? 0) +
              (s.delivery_minutes ?? 0) +
              (s.return_minutes ?? 0);
            return (
              <li key={s.id} className="flex items-center justify-between rounded-xl border p-3">
                <div className="flex items-center gap-3">
                  {s.delivery_drivers?.photo_url ? (
                    <img src={s.delivery_drivers.photo_url} className="h-10 w-10 rounded-full object-cover" alt="" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-muted" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{s.delivery_drivers?.name ?? "Motoboy"}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(s.started_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · {fmtMinutes(online)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Badge>{s.current_state}</Badge>
                  {s.status === "PAUSADO" ? <Badge variant="outline">Pausado</Badge> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
