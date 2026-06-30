import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { QrCode, Copy, ExternalLink, Download, Zap, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { createDemoOrder, resetDemoEnvironment } from "@/lib/demo.functions";


// Free QR code endpoint (server-side rendering, no extra deps)
function qrUrl(data: string, size = 240) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=0&data=${encodeURIComponent(data)}`;
}

// Tiny built-in "new order" chime (base64 mp3-like beep via WebAudio)
function playChime() {
  try {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = "sine"; o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
    o.start(); o.stop(ctx.currentTime + 0.5);
    setTimeout(() => ctx.close(), 600);
  } catch {}
}

export function DemoDashboardCards({ publicUrl, restaurantId }: { publicUrl: string; restaurantId: string }) {
  const qc = useQueryClient();
  const runCreate = useServerFn(createDemoOrder);
  const [creating, setCreating] = useState(false);

  async function downloadPng() {
    try {
      const res = await fetch(qrUrl(publicUrl, 512));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "cardapio-qrcode.png";
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Não foi possível baixar o QR Code.");
    }
  }

  async function generateOrder() {
    setCreating(true);
    try {
      const order = await runCreate();
      playChime();
      toast.success(`Novo pedido demo #${order.order_number ?? ""} — ${order.customer_name}`);
      qc.invalidateQueries({ queryKey: ["dashboard", restaurantId] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar pedido demonstrativo.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <QrCode className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-base font-bold">Seu Cardápio Público</h3>
            <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{publicUrl}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="rounded-xl border bg-white p-2">
            <img
              src={qrUrl(publicUrl)}
              alt="QR Code do cardápio público"
              width={180}
              height={180}
              className="block h-[180px] w-[180px]"
            />
          </div>
          <div className="flex flex-1 flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(publicUrl);
                toast.success("Link copiado!");
              }}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar link
            </Button>
            <a href={publicUrl} target="_blank" rel="noreferrer">
              <Button size="sm">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Abrir Cardápio
              </Button>
            </a>
            <Button size="sm" variant="outline" onClick={downloadPng}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Baixar QR Code PNG
            </Button>
          </div>
        </div>
      </Card>

      <Card className="relative overflow-hidden border-primary/20 p-5">
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
        <div className="relative">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-warm text-primary-foreground">
              <Zap className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-base font-bold">Simulador de Pedidos</h3>
              <p className="text-sm text-muted-foreground">
                Gere um pedido fictício completo para ver o fluxo em tempo real no Painel e na lista de Pedidos.
              </p>
            </div>
          </div>
          <Button onClick={generateOrder} disabled={creating} className="mt-4 w-full sm:w-auto">
            {creating ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando…</>
            ) : (
              <><Zap className="mr-2 h-4 w-4" /> Gerar Pedido Demonstrativo</>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}

const DEMO_KPIS = {
  ordersToday: 32,
  revenueToday: 1487.9,
  productsActive: 24,
  activeCustomers: 87,
  ordersDelta: 14,
  revenueDelta: 22,
  productsDelta: 4,
  activeDelta: 12,
} as const;

export function getDemoKpisOverride(real: any) {
  return { ...(real ?? {}), ...DEMO_KPIS };
}

export function DemoExtraMetrics() {
  const items = [
    { label: "Ticket Médio", value: "R$ 46,50" },
    { label: "Clientes Recorrentes", value: "61%" },
    { label: "Tempo Médio de Preparo", value: "21 min" },
    { label: "Avaliação Média", value: "4,9 ⭐" },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((it) => (
        <Card key={it.label} className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{it.label}</p>
          <p className="mt-1 font-display text-2xl font-extrabold">{it.value}</p>
        </Card>
      ))}
    </div>
  );
}
