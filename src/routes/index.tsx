import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MessageCircle, Smartphone, Zap, Receipt, Store, Sparkles, ArrowRight, Check } from "lucide-react";
import heroFood from "@/assets/hero-food.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Localix Delivery — Delivery próprio para restaurantes" },
      { name: "description", content: "Receba pedidos pelo WhatsApp e por uma página própria de cardápio. Sem comissão de marketplaces. Setup em minutos." },
      { property: "og:title", content: "Localix Delivery — Delivery próprio sem marketplaces" },
      { property: "og:description", content: "Cardápio digital + pedidos pelo WhatsApp para pizzarias, hamburguerias e lanchonetes." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Hero />
      <Logos />
      <Features />
      <HowItWorks />
      <Pricing />
      <CTA />
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-extrabold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-warm text-primary-foreground shadow-glow">L</span>
          Localix
        </Link>
        <nav className="hidden gap-8 text-sm font-medium text-muted-foreground md:flex">
          <a href="#recursos" className="hover:text-foreground">Recursos</a>
          <a href="#como-funciona" className="hover:text-foreground">Como funciona</a>
          <a href="#precos" className="hover:text-foreground">Preços</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/auth"><Button variant="ghost" size="sm">Entrar</Button></Link>
          <Link to="/auth"><Button size="sm">Começar grátis</Button></Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-hero">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 md:grid-cols-2 md:py-28">
        <div className="flex flex-col justify-center">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Sem comissão de marketplace
          </span>
          <h1 className="mt-5 font-display text-5xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
            Seu delivery,<br/>
            <span className="bg-gradient-warm bg-clip-text text-transparent">no seu nome.</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg text-muted-foreground">
            Cardápio digital + pedidos direto no <strong className="text-foreground">WhatsApp</strong>. Para pizzarias, hamburguerias, restaurantes e lanchonetes que querem parar de pagar comissão.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/auth"><Button size="lg" className="shadow-glow">Criar meu cardápio grátis <ArrowRight className="ml-1 h-4 w-4" /></Button></Link>
            <a href="#como-funciona"><Button size="lg" variant="outline">Ver como funciona</Button></a>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {["Configure em 5 min", "Sem cartão", "0% comissão"].map((t) => (
              <li key={t} className="flex items-center gap-2"><Check className="h-4 w-4 text-success" /> {t}</li>
            ))}
          </ul>
        </div>
        <div className="relative">
          <div className="absolute -inset-6 rounded-3xl bg-gradient-warm opacity-20 blur-3xl" />
          <img
            src={heroFood}
            alt="Hambúrguer artesanal, pizza e batatas fritas"
            width={1600}
            height={1200}
            className="relative rounded-3xl object-cover shadow-glow"
          />
        </div>
      </div>
    </section>
  );
}

function Logos() {
  return (
    <div className="border-y bg-card/50 py-6">
      <p className="text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Feito para pizzarias · hamburguerias · restaurantes · lanchonetes · açaiterias
      </p>
    </div>
  );
}

function Features() {
  const items = [
    { icon: MessageCircle, title: "Pedidos no WhatsApp", desc: "Cliente finaliza o pedido e ele chega formatado direto no seu WhatsApp. Sem app, sem fricção." },
    { icon: Smartphone, title: "Cardápio mobile-first", desc: "Página linda em /seurestaurante. Compartilhe o link no Instagram, perfil do Google e no balcão." },
    { icon: Zap, title: "Setup em minutos", desc: "Cadastre seus produtos com foto e preço. Está pronto para vender hoje." },
    { icon: Receipt, title: "Taxa e mínimo de pedido", desc: "Defina taxa de entrega e valor mínimo para começar a preparar." },
    { icon: Store, title: "Abrir e fechar com 1 toque", desc: "Pausou o atendimento? Feche a loja e o cardápio mostra automaticamente." },
    { icon: Sparkles, title: "0% de comissão", desc: "Você paga uma mensalidade fixa. Todo o lucro do pedido fica com você." },
  ];
  return (
    <section id="recursos" className="mx-auto max-w-6xl px-4 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-4xl font-extrabold tracking-tight">Tudo que você precisa para vender direto.</h2>
        <p className="mt-3 text-muted-foreground">Sem depender de iFood, sem brigar por destaque, sem perder margem.</p>
      </div>
      <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map(({ icon: Icon, title, desc }) => (
          <Card key={title} className="group relative overflow-hidden border-border/60 p-6 transition hover:border-primary/40 hover:shadow-glow">
            <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-gradient-warm group-hover:text-primary-foreground">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "01", title: "Crie sua conta", desc: "Cadastre seu estabelecimento e escolha sua URL: localix.app/seurestaurante." },
    { n: "02", title: "Monte seu cardápio", desc: "Adicione categorias e produtos com foto, descrição e preço." },
    { n: "03", title: "Compartilhe o link", desc: "Cole no Instagram, status do WhatsApp, Google Meu Negócio e cardápio impresso." },
    { n: "04", title: "Receba no WhatsApp", desc: "O pedido chega completo e formatado, pronto para você confirmar." },
  ];
  return (
    <section id="como-funciona" className="bg-sidebar text-sidebar-foreground">
      <div className="mx-auto max-w-6xl px-4 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-4xl font-extrabold tracking-tight">Como funciona</h2>
          <p className="mt-3 text-sidebar-foreground/70">Do cadastro ao primeiro pedido em menos de 10 minutos.</p>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-4">
          {steps.map((s) => (
            <div key={s.n} className="relative rounded-2xl border border-sidebar-border bg-sidebar-accent/40 p-6">
              <div className="font-display text-3xl font-extrabold text-primary">{s.n}</div>
              <h3 className="mt-2 text-lg font-bold">{s.title}</h3>
              <p className="mt-1 text-sm text-sidebar-foreground/70">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="precos" className="mx-auto max-w-4xl px-4 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-4xl font-extrabold tracking-tight">Comece grátis. Cresça sem comissão.</h2>
        <p className="mt-3 text-muted-foreground">Mensalidade fixa, pedidos ilimitados. Sem letras miúdas.</p>
      </div>
      <div className="mt-12 grid gap-6 md:grid-cols-2">
        <Card className="border-border/60 p-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Free</p>
          <p className="mt-2 font-display text-4xl font-extrabold">R$ 0</p>
          <p className="text-sm text-muted-foreground">/ para sempre</p>
          <ul className="mt-6 space-y-2 text-sm">
            {["1 estabelecimento", "Cardápio digital ilimitado", "Pedidos via WhatsApp", "Sem cartão de crédito"].map(t => (
              <li key={t} className="flex gap-2"><Check className="h-4 w-4 text-success" /> {t}</li>
            ))}
          </ul>
          <Link to="/auth" className="block"><Button variant="outline" className="mt-8 w-full">Começar grátis</Button></Link>
        </Card>
        <Card className="relative border-primary/40 bg-gradient-warm p-8 text-primary-foreground shadow-glow">
          <span className="absolute right-4 top-4 rounded-full bg-background/20 px-2 py-0.5 text-[10px] font-bold uppercase backdrop-blur">Em breve</span>
          <p className="text-sm font-semibold uppercase tracking-wider opacity-80">Pro</p>
          <p className="mt-2 font-display text-4xl font-extrabold">R$ 79</p>
          <p className="text-sm opacity-80">/ mês</p>
          <ul className="mt-6 space-y-2 text-sm">
            {["Tudo do Free", "Múltiplas unidades", "Domínio personalizado", "Cupons e promoções", "Relatórios de vendas"].map(t => (
              <li key={t} className="flex gap-2"><Check className="h-4 w-4" /> {t}</li>
            ))}
          </ul>
          <Button disabled className="mt-8 w-full bg-background/15 text-primary-foreground hover:bg-background/25">Em breve</Button>
        </Card>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="mx-auto max-w-5xl px-4 pb-24">
      <div className="rounded-3xl bg-sidebar p-10 text-center text-sidebar-foreground shadow-glow md:p-16">
        <h2 className="font-display text-4xl font-extrabold md:text-5xl">Pronto para parar de pagar comissão?</h2>
        <p className="mx-auto mt-4 max-w-xl text-sidebar-foreground/70">Crie seu cardápio digital agora e comece a receber pedidos pelo WhatsApp hoje mesmo.</p>
        <Link to="/auth" className="inline-block"><Button size="lg" className="mt-8 shadow-glow">Quero meu Localix grátis <ArrowRight className="ml-1 h-4 w-4" /></Button></Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-8 text-sm text-muted-foreground md:flex-row">
        <p>© {new Date().getFullYear()} Localix Delivery. Todos os direitos reservados.</p>
        <p>Feito com 🔥 para quem ama a cozinha.</p>
      </div>
    </footer>
  );
}
