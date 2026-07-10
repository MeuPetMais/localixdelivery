// RC5.2.f — Card do turno para a Home do motoboy.
// Componente autônomo: pode ser plugado em qualquer tela do Driver Wallet.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getCurrentShift,
  startShift,
  pauseShift,
  resumeShift,
  finishShift,
} from "@/lib/driver-shift.functions";
import { fmtMinutes } from "@/lib/delivery/DriverShiftService";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Play, Pause, Square, Clock } from "lucide-react";
import { toast } from "sonner";

export function DriverShiftCard() {
  const qc = useQueryClient();
  const runGet = useServerFn(getCurrentShift);
  const { data: shift } = useQuery({
    queryKey: ["driver-shift"],
    queryFn: () => runGet(),
    refetchInterval: 30_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["driver-shift"] });
    qc.invalidateQueries({ queryKey: ["driver-dashboard"] });
  };

  const start = useMutation({
    mutationFn: useServerFn(startShift),
    onSuccess: () => { toast.success("Turno iniciado"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao iniciar turno"),
  });
  const pause = useMutation({
    mutationFn: useServerFn(pauseShift),
    onSuccess: () => { toast.success("Turno pausado"); invalidate(); },
  });
  const resume = useMutation({
    mutationFn: useServerFn(resumeShift),
    onSuccess: () => { toast.success("Turno retomado"); invalidate(); },
  });
  const finish = useMutation({
    mutationFn: useServerFn(finishShift),
    onSuccess: () => {
      const s = shift;
      if (s) {
        toast.success(
          `Turno encerrado — ${s.deliveries_count} entregas • ${fmtMinutes(
            s.online_minutes + s.waiting_minutes + s.delivery_minutes + s.return_minutes,
          )}`,
        );
      }
      invalidate();
    },
  });

  if (!shift) {
    return (
      <Card className="rounded-3xl p-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Turno</p>
          <p className="text-lg font-semibold">Você está fora de turno</p>
        </div>
        <Button size="lg" onClick={() => start.mutate({} as any)} disabled={start.isPending}>
          <Play className="mr-2 h-4 w-4" /> Iniciar turno
        </Button>
      </Card>
    );
  }

  return (
    <Card className="rounded-3xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> Turno atual • {shift.status}
          </p>
          <p className="text-lg font-semibold">
            Início {new Date(shift.started_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <div className="flex gap-2">
          {shift.status === "ATIVO" ? (
            <Button variant="outline" size="sm" onClick={() => pause.mutate({} as any)}>
              <Pause className="h-4 w-4" />
            </Button>
          ) : shift.status === "PAUSADO" ? (
            <Button variant="outline" size="sm" onClick={() => resume.mutate({} as any)}>
              <Play className="h-4 w-4" />
            </Button>
          ) : null}
          <Button variant="destructive" size="sm" onClick={() => finish.mutate({} as any)}>
            <Square className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3 text-center">
        <ShiftStat label="Online" value={fmtMinutes(shift.online_minutes)} />
        <ShiftStat label="Aguard." value={fmtMinutes(shift.waiting_minutes)} />
        <ShiftStat label="Entrega" value={fmtMinutes(shift.delivery_minutes)} />
        <ShiftStat label="Retorno" value={fmtMinutes(shift.return_minutes)} />
      </div>
    </Card>
  );
}

function ShiftStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-muted/50 p-3">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}
