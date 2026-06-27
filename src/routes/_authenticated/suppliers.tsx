import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Package, FlaskConical, Printer, Briefcase, Truck, LayoutDashboard,
  Handshake, Flame, GraduationCap, Star, BellRing, CheckCircle2, Sparkles,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/suppliers")({
  head: () => ({ meta: [{ title: "Central de Negócios — Localix" }] }),
  component: BusinessHub,
});

const CATEGORIES = [
  { icon: Package, title: "Embalagens", desc: "Caixas de pizza, hambúrguer, sacolas, copos, talheres, guardanapos.", tint: "from-amber-500/20 to-amber-500/5", fg: "text-amber-600" },
  { icon: FlaskConical, title: "Insumos", desc: "Molhos, temperos, ingredientes, bebidas e descartáveis.", tint: "from-emerald-500/20 to-emerald-500/5", fg: "text-emerald-600" },
  { icon: Printer, title: "Equipamentos", desc: "Impressoras térmicas, tablets, leitores e máquinas de cartão.", tint: "from-sky-500/20 to-sky-500/5", fg: "text-sky-600" },
  { icon: Briefcase, title: "Serviços", desc: "Contabilidade, marketing, redes sociais, fotografia e cardápios.", tint: "from-violet-500/20 to-violet-500/5", fg: "text-violet-600" },
  { icon: Truck, title: "Delivery", desc: "Mochilas térmicas, bags, suportes e rastreadores.", tint: "from-orange-500/20 to-orange-500/5", fg: "text-orange-600" },
  { icon: LayoutDashboard, title: "Gestão", desc: "ERP, financeiro, emissão fiscal, automação e CRM.", tint: "from-indigo-500/20 to-indigo-500/5", fg: "text-indigo-600" },
  { icon: Handshake, title: "Parceiros Localix", desc: "Empresas homologadas com benefícios exclusivos para parceiros.", tint: "from-rose-500/20 to-rose-500/5", fg: "text-rose-600" },
];

const TIPS = [
  "Como vender mais pelo delivery",
  "Como melhorar seu ticket médio",
  "Como aumentar avaliações",
  "Como fidelizar clientes",
  "Como reduzir custos operacionais",
];

const BENEFITS = [
  { title: "Descontos exclusivos", desc: "Condições especiais negociadas para parceiros Localix." },
  { title: "Cashback", desc: "Receba de volta em compras recorrentes." },
  { title: "Convênios", desc: "Acordos com bancos, operadoras e serviços." },
  { title: "Cupons", desc: "Ofertas mensais para sua operação." },
  { title: "Campanhas especiais", desc: "Datas comemorativas com vantagens dedicadas." },
];

function BusinessHub() {
  const [notified, setNotified] = useState(false);

  function notifyMe() {
    setNotified(true);
    toast.success("Tudo certo! Avisaremos assim que a Central de Negócios estiver disponível.");
  }

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-6 pb-24">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-8 md:p-12">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <Badge variant="secondary" className="mb-4 rounded-full">
          <Sparkles className="mr-1 h-3 w-3" /> Em preparação
        </Badge>
        <h1 className="font-display text-3xl font-extrabold tracking-tight md:text-5xl">
          Central de Negócios
        </h1>
        <p className="mt-3 max-w-2xl text-base text-muted-foreground md:text-lg">
          Tudo o que seu estabelecimento precisa para crescer — embalagens, insumos, equipamentos, serviços e soluções de gestão, em um só lugar.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {notified ? (
            <Button size="lg" disabled className="rounded-full">
              <CheckCircle2 className="mr-2 h-4 w-4" /> Interesse registrado
            </Button>
          ) : (
            <Button size="lg" onClick={notifyMe} className="rounded-full">
              <BellRing className="mr-2 h-4 w-4" /> Quero ser avisado
            </Button>
          )}
        </div>
      </section>

      {/* Coming soon notice */}
      <Card className="border-dashed bg-muted/30 p-6">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Estamos firmando parcerias com fornecedores e prestadores de serviço para oferecer condições exclusivas aos estabelecimentos parceiros. Em breve você poderá adquirir tudo diretamente pela plataforma.
        </p>
      </Card>

      {/* Categorias */}
      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-display text-2xl font-bold">Categorias</h2>
          <span className="text-xs text-muted-foreground">7 áreas</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((c) => (
            <Card key={c.title} className={`group relative overflow-hidden border-0 bg-gradient-to-br ${c.tint} p-5 transition hover:scale-[1.02]`}>
              <div className={`mb-3 grid h-11 w-11 place-items-center rounded-xl bg-background/80 ${c.fg} shadow-sm`}>
                <c.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">{c.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.desc}</p>
              <Badge variant="outline" className="mt-3 rounded-full text-[10px]">Em breve</Badge>
            </Card>
          ))}
        </div>
      </section>

      {/* Ofertas */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 font-display text-2xl font-bold">
          <Flame className="h-5 w-5 text-orange-500" /> Ofertas Exclusivas
        </h2>
        <Card className="grid place-items-center border-dashed bg-muted/20 py-12 text-center">
          <Flame className="mb-3 h-8 w-8 text-orange-500/60" />
          <p className="text-sm text-muted-foreground">
            Em breve, ofertas selecionadas para parceiros Localix.
          </p>
        </Card>
      </section>

      {/* Educativa */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 font-display text-2xl font-bold">
          <GraduationCap className="h-5 w-5 text-primary" /> Dicas para aumentar suas vendas
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {TIPS.map((t, i) => (
            <Card key={t} className="flex items-center gap-3 p-4">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                {String(i + 1).padStart(2, "0")}
              </div>
              <p className="text-sm font-medium">{t}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Benefícios */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 font-display text-2xl font-bold">
          <Star className="h-5 w-5 text-amber-500" /> Benefícios para Parceiros
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b) => (
            <Card key={b.title} className="p-4">
              <div className="mb-2 flex items-center gap-2">
                <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                <h3 className="font-semibold">{b.title}</h3>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">{b.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <Card className="flex flex-col items-center gap-4 bg-gradient-to-br from-primary/10 to-transparent p-8 text-center md:flex-row md:justify-between md:text-left">
        <div>
          <h3 className="font-display text-xl font-bold">Seja avisado no lançamento</h3>
          <p className="text-sm text-muted-foreground">
            Você receberá acesso prioritário às primeiras ofertas.
          </p>
        </div>
        {notified ? (
          <Button disabled className="rounded-full">
            <CheckCircle2 className="mr-2 h-4 w-4" /> Inscrito
          </Button>
        ) : (
          <Button onClick={notifyMe} className="rounded-full">
            <BellRing className="mr-2 h-4 w-4" /> Quero ser avisado
          </Button>
        )}
      </Card>
    </div>
  );
}
