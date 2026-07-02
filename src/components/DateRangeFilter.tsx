import { useMemo, useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type DateRange = { from: string; to: string; label: string };

const pad = (n: number) => String(n).padStart(2, "0");
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function computePreset(preset: string): DateRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const daysAgo = (n: number) => new Date(today.getTime() - n * 86400000);
  switch (preset) {
    case "hoje":
      return { from: toISO(today), to: toISO(today), label: "Hoje" };
    case "ontem":
      return { from: toISO(yesterday), to: toISO(yesterday), label: "Ontem" };
    case "7d":
      return { from: toISO(daysAgo(6)), to: toISO(today), label: "Últimos 7 dias" };
    case "30d":
      return { from: toISO(daysAgo(29)), to: toISO(today), label: "Últimos 30 dias" };
    case "mes": {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: toISO(first), to: toISO(today), label: "Este mês" };
    }
    case "mes_anterior": {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: toISO(first), to: toISO(last), label: "Mês anterior" };
    }
    default:
      return { from: toISO(daysAgo(29)), to: toISO(today), label: "Últimos 30 dias" };
  }
}

const PRESETS: { id: string; label: string }[] = [
  { id: "hoje", label: "Hoje" },
  { id: "ontem", label: "Ontem" },
  { id: "7d", label: "Últimos 7 dias" },
  { id: "30d", label: "Últimos 30 dias" },
  { id: "mes", label: "Este mês" },
  { id: "mes_anterior", label: "Mês anterior" },
];

export function DateRangeFilter({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (r: DateRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(value.from);
  const [customTo, setCustomTo] = useState(value.to);

  const activePreset = useMemo(() => {
    for (const p of PRESETS) {
      const r = computePreset(p.id);
      if (r.from === value.from && r.to === value.to) return p.id;
    }
    return "custom";
  }, [value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm font-medium shadow-sm transition hover:bg-accent"
        >
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          {value.label}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[300px] p-2">
        <div className="grid gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                onChange(computePreset(p.id));
                setOpen(false);
              }}
              className={`rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent ${
                activePreset === p.id ? "bg-accent font-medium" : ""
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="mt-2 rounded-md border p-2">
          <div className="mb-1 text-xs font-medium text-muted-foreground">Intervalo personalizado</div>
          <div className="flex items-center gap-1">
            <Input
              type="date"
              value={customFrom}
              max={customTo}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-8 text-xs"
            />
            <span className="text-xs text-muted-foreground">→</span>
            <Input
              type="date"
              value={customTo}
              min={customFrom}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <Button
            size="sm"
            className="mt-2 w-full"
            disabled={!customFrom || !customTo || customFrom > customTo}
            onClick={() => {
              onChange({
                from: customFrom,
                to: customTo,
                label: `${customFrom.split("-").reverse().join("/")} – ${customTo.split("-").reverse().join("/")}`,
              });
              setOpen(false);
            }}
          >
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
