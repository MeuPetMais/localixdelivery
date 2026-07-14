import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Printer, TestTube2 } from "lucide-react";
import { toast } from "sonner";
import {
  type PaperSize,
  type AutoCopies,
  getPaperSize,
  setPaperSize,
  isAutoPrintEnabled,
  setAutoPrintEnabled,
  getAutoCopies,
  setAutoCopies,
  printOrder,
  type PrintableOrder,
} from "@/lib/print-service";

export const Route = createFileRoute("/_authenticated/print-settings")({
  head: () => ({ meta: [{ title: "Impressão — Localix" }] }),
  component: PrintSettingsPage,
});

const PAPER_OPTIONS: Array<{ v: PaperSize; label: string; hint: string }> = [
  { v: "58mm", label: "Térmica 58 mm", hint: "Mini impressoras portáteis" },
  { v: "80mm", label: "Térmica 80 mm", hint: "Padrão para não-fiscal / cupom" },
  { v: "a4", label: "A4 (folha)", hint: "Impressora comum de escritório" },
];

function PrintSettingsPage() {
  const [paper, setPaper] = useState<PaperSize>("80mm");
  const [auto, setAuto] = useState(false);
  const [copies, setCopies] = useState<AutoCopies>({ kitchen: true, delivery: false, customer: false });

  useEffect(() => {
    setPaper(getPaperSize());
    setAuto(isAutoPrintEnabled());
    setCopies(getAutoCopies());
  }, []);

  function updatePaper(v: PaperSize) {
    setPaper(v);
    setPaperSize(v);
    toast.success(`Papel: ${v.toUpperCase()}`);
  }
  function updateAuto(v: boolean) {
    setAuto(v);
    setAutoPrintEnabled(v);
  }
  function updateCopy(k: keyof AutoCopies, v: boolean) {
    const next = { ...copies, [k]: v };
    setCopies(next);
    setAutoCopies(next);
  }

  async function testPrint(template: "kitchen" | "customer") {
    const sample: PrintableOrder = {
      order_number: 1019,
      customer_name: "João da Silva",
      customer_phone: "(11) 99999-0000",
      address: "Rua das Flores, 123",
      address_complement: "Ap 42",
      address_neighborhood: "Centro",
      order_type: "delivery",
      payment_method: "cash",
      change_for: 100,
      delivery_fee: 7,
      coupon_code: "BEMVINDO10",
      coupon_discount: 5,
      total: 62,
      created_at: new Date().toISOString(),
      restaurant_name: "Localix Burger (Teste)",
      items: [
        {
          name: "Monte seu Hambúrguer",
          qty: 1,
          price: 42,
          notes: "Bem passado",
          options: ["Pão Brioche", "Carne Artesanal", "Cheddar", "Bacon", "Cebola Caramelizada"],
          removed: ["Tomate"],
        },
        { name: "Batata Rústica", qty: 1, price: 18, options: ["Molho Cheddar"] },
      ],
    };
    await printOrder(sample, { template, paper });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold lg:text-3xl">Impressão</h1>
        <p className="text-sm text-muted-foreground">
          Configure o modelo de impressora, vias automáticas e teste seus templates.
        </p>
      </div>

      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Printer className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Modelo de papel</h2>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {PAPER_OPTIONS.map((opt) => {
            const active = paper === opt.v;
            return (
              <button
                key={opt.v}
                onClick={() => updatePaper(opt.v)}
                className={`rounded-lg border p-3 text-left transition ${
                  active ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-accent"
                }`}
              >
                <div className="font-semibold">{opt.label}</div>
                <div className="text-xs text-muted-foreground">{opt.hint}</div>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Impressão automática</h2>
            <p className="text-sm text-muted-foreground">
              Ao chegar um novo pedido, imprimir as vias marcadas abaixo automaticamente.
            </p>
          </div>
          <Switch checked={auto} onCheckedChange={updateAuto} />
        </div>

        <div className={`space-y-2 rounded-lg border p-3 ${!auto ? "opacity-60" : ""}`}>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={copies.kitchen}
              onChange={(e) => updateCopy("kitchen", e.target.checked)}
              disabled={!auto}
              className="h-4 w-4"
            />
            <div>
              <div className="font-medium">Cozinha</div>
              <div className="text-xs text-muted-foreground">Comanda sem preços, com opções e observações.</div>
            </div>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={copies.delivery}
              onChange={(e) => updateCopy("delivery", e.target.checked)}
              disabled={!auto}
              className="h-4 w-4"
            />
            <div>
              <div className="font-medium">Entrega</div>
              <div className="text-xs text-muted-foreground">Cupom completo para o entregador levar junto ao pedido.</div>
            </div>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={copies.customer}
              onChange={(e) => updateCopy("customer", e.target.checked)}
              disabled={!auto}
              className="h-4 w-4"
            />
            <div>
              <div className="font-medium">Cliente</div>
              <div className="text-xs text-muted-foreground">Via para o cliente acompanhar / conferir.</div>
            </div>
          </label>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <TestTube2 className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Teste de impressão</h2>
          <Badge variant="outline" className="ml-auto">{paper.toUpperCase()}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Imprima um pedido de exemplo para validar o layout no seu papel.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => testPrint("kitchen")}>
            🍳 Testar Comanda da Cozinha
          </Button>
          <Button onClick={() => testPrint("customer")}>
            🧾 Testar Cupom do Cliente
          </Button>
        </div>
      </Card>

      <Card className="p-5 space-y-2">
        <h2 className="font-semibold">Compatibilidade futura</h2>
        <p className="text-sm text-muted-foreground">
          A arquitetura já está preparada para novos drivers de impressora (WebUSB, Web Bluetooth,
          impressoras em rede via PrintNode / QZ Tray). Assim que ativados aparecerão como opções
          adicionais nesta tela.
        </p>
      </Card>
    </div>
  );
}
