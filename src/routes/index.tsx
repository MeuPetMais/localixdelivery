import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ArrowRight,
  Check,
  Sparkles,
  LayoutDashboard,
  ListOrdered,
  UtensilsCrossed,
  Tag,
  Wand2,
  Store,
  UserCircle,
  ImagePlus,
  LineChart,
  Gift,
  Wallet,
  Ticket,
  Heart,
  ShoppingBag,
  CircleCheck,
} from "lucide-react";
import heroFood from "@/assets/hero-food.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Localix — Cadastro gratuito durante o lançamento" },
      {
        name: "description",
        content:
          "Cadastre seu estabelecimento gratuitamente e receba pedidos pelo seu próprio cardápio digital. Gestão completa em um único painel, sem mensalidade no período de validação.",
      },
      { property: "og:title", content: "Localix — Seu delivery profissional, sem mensalidade no lançamento" },
      {
        property: "og:description",
        content:
          "Cardápio digital, gestão de pedidos em tempo real, promoções, produtos personalizados e muito mais. Cadastro 100% gratuito durante o período de validação.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Hero />
      <WhyLocalix />
      <ControlPanel />
      <ComingSoon />
      <Benefits />
      <FinalCTA />
      <Footer />
    </div>
  );
}

function FreeBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-semibold text-success ${className}`}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
      </span>
      Cadastro gratuito por tempo limitado
    </span>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-extrabold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-warm text-primary-foreground shadow-glow">
            L
          </span>
          Localix
        </Link>
        <nav className="hidden gap-8 text-sm font-medium text-muted-foreground md:flex">
          <a href="#plataforma" className="hover:text-foreground">Plataforma</a>
          <a href="#novidades" className="hover:text-foreground">Novidades</a>
          <a href="#beneficios" className="hover:text-foreground">Benefícios</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/auth">
            <Button variant="ghost" size="sm">Entrar</Button>
          </Link>
          <Link to="/auth">
            <Button size="sm">Cadastrar grátis</Button>
          </Link>
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
          <FreeBadge />
          <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
            Seu delivery profissional,
            <br />
            <span className="bg-gradient-warm bg-clip-text text-transparent">
              sem mensalidade no lançamento.
            </span>
          </h1>
          <p className="mt-5 max-w-lg text-lg text-muted-foreground">
            Receba pedidos pelo seu próprio cardápio digital, organize seu atendimento e tenha controle completo da
            operação em um único painel.
          </p>
          <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" /> Sem instalação complicada</li>
            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" /> Sem taxas de adesão durante o período de validação</li>
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/auth">
              <Button size="lg" className="shadow-glow">
                Cadastrar meu estabelecimento gratuitamente <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
            <a href="#plataforma">
              <Button size="lg" variant="outline">Conhecer a plataforma</Button>
            </a>
          </div>
        </div>
        <div className="relative">
          <div className="absolute -inset-6 rounded-3xl bg-gradient-warm opacity-20 blur-3xl" />
          <img
            src={heroFood}
            alt="Diversidade de estabelecimentos: pizzaria, hamburgueria, açaí e mais"
            width={1600}
            height={1200}
            className="relative rounded-3xl object-cover shadow-glow"
          />
          <div className="absolute -bottom-4 -left-4 hidden rounded-2xl border border-border/60 bg-card/90 px-4 py-3 shadow-elegant backdrop-blur md:block">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Para todo tipo de estabelecimento</p>
            <p className="mt-0.5 text-sm font-bold">Pizzaria · Hamburgueria · Cafeteria · Açaí · Marmitaria</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function WhyLocalix() {
  const items = [
    { icon: Sparkles, title: "Cadastro gratuito", desc: "Crie sua conta sem custo durante a fase de validação da plataforma." },
    { icon: UtensilsCrossed, title: "Seu cardápio digital", desc: "Organize categorias, produtos, adicionais e combos com facilidade." },
    { icon: ListOrdered, title: "Pedidos em tempo real", desc: "Receba, acompanhe e gerencie todos os pedidos em um único painel." },
    { icon: LayoutDashboard, title: "Controle completo", desc: "Administre preços, horários, promoções, formas de pagamento e muito mais." },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-4xl font-extrabold tracking-tight">Por que escolher a Localix?</h2>
        <p className="mt-3 text-muted-foreground">
          Uma plataforma pensada para o seu segmento — adapta-se ao seu estabelecimento, não o contrário.
        </p>
      </div>
      <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {items.map(({ icon: Icon, title, desc }) => (
          <Card
            key={title}
            className="group relative overflow-hidden border-border/60 p-6 transition hover:border-primary/40 hover:shadow-glow"
          >
            <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-success/10 text-success transition group-hover:bg-success group-hover:text-success-foreground">
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

function ControlPanel() {
  const features = [
    { icon: LayoutDashboard, title: "Dashboard", desc: "Indicadores claros da sua operação em tempo real." },
    { icon: ListOrdered, title: "Gestão de pedidos", desc: "Receba e acompanhe pedidos em tempo real, sem perder nenhum." },
    {
      icon: UtensilsCrossed,
      title: "Cardápio inteligente",
      desc: "Categorias, produtos, combos, adicionais, disponibilidade e fotos.",
    },
    { icon: Tag, title: "Promoções", desc: "Campanhas promocionais, produtos em destaque e ofertas do dia." },
    {
      icon: Wand2,
      title: "Monte do seu jeito",
      desc: "Clientes personalizam pizzas, hambúrgueres e pratos diretamente pelo cardápio.",
    },
    {
      icon: Store,
      title: "Perfil do estabelecimento",
      desc: "Horários, endereço, entrega, retirada, taxas, pedido mínimo, redes sociais e pagamentos.",
    },
    { icon: UserCircle, title: "Meu Perfil", desc: "Conta do proprietário com dados pessoais, segurança e senha." },
    { icon: ImagePlus, title: "Upload de imagens", desc: "Fotos de produtos, logo, banner e galeria do estabelecimento." },
    { icon: LineChart, title: "Área financeira", desc: "Relatórios, indicadores e histórico — em evolução constante." },
  ];
  return (
    <section id="plataforma" className="bg-sidebar text-sidebar-foreground">
      <div className="mx-auto max-w-6xl px-4 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <FreeBadge className="border-success/40 bg-success/15" />
          <h2 className="mt-4 font-display text-4xl font-extrabold tracking-tight">Conheça o painel de controle</h2>
          <p className="mt-3 text-sidebar-foreground/70">
            Tudo o que você precisa para gerenciar seu negócio — em um único lugar, com simplicidade.
          </p>
        </div>
        <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="group relative rounded-2xl border border-sidebar-border bg-sidebar-accent/40 p-6 transition hover:border-primary/40 hover:bg-sidebar-accent/60"
            >
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary transition group-hover:bg-gradient-warm group-hover:text-primary-foreground">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold">{title}</h3>
              <p className="mt-1 text-sm text-sidebar-foreground/70">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ComingSoon() {
  const items = [
    { icon: Gift, title: "Fidelidade", desc: "Programa de pontos para recompensar seus clientes mais fiéis." },
    { icon: Wallet, title: "Cashback", desc: "Campanhas de retorno automático para incentivar novas compras." },
    { icon: Ticket, title: "Cupons inteligentes", desc: "Descontos automáticos aplicados nas condições certas." },
    { icon: Heart, title: "Benefícios para clientes", desc: "Promoções exclusivas para a base de clientes do seu estabelecimento." },
    {
      icon: ShoppingBag,
      title: "Compras para parceiros",
      desc:
        "Marketplace exclusivo para adquirir embalagens, insumos, bebidas, equipamentos, uniformes e soluções para delivery.",
      featured: true,
    },
  ];
  return (
    <section id="novidades" className="mx-auto max-w-6xl px-4 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <Sparkles className="h-3.5 w-3.5" /> Em breve na Localix
        </span>
        <h2 className="mt-4 font-display text-4xl font-extrabold tracking-tight">Próximas novidades</h2>
        <p className="mt-3 text-muted-foreground">
          A plataforma continua evoluindo. Cadastre-se agora e tenha acesso antecipado às novas funcionalidades.
        </p>
      </div>
      <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map(({ icon: Icon, title, desc, featured }) => (
          <Card
            key={title}
            className={`group relative overflow-hidden p-6 transition hover:shadow-glow ${
              featured ? "border-primary/40 bg-gradient-warm text-primary-foreground lg:col-span-1" : "border-border/60"
            }`}
          >
            <span
              className={`absolute right-4 top-4 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase backdrop-blur ${
                featured ? "bg-background/20 text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              Em breve
            </span>
            <div
              className={`mb-4 grid h-11 w-11 place-items-center rounded-xl transition ${
                featured ? "bg-background/15 text-primary-foreground" : "bg-primary/10 text-primary group-hover:bg-gradient-warm group-hover:text-primary-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold">{title}</h3>
            <p className={`mt-1 text-sm ${featured ? "opacity-90" : "text-muted-foreground"}`}>{desc}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

function Benefits() {
  const items = [
    "Cadastro gratuito",
    "Cardápio digital",
    "Gestão de pedidos",
    "Promoções",
    "Produtos personalizados",
    "Upload de fotos",
    "Controle de horários",
    "Perfil do estabelecimento",
    "Área do proprietário",
    "Relatórios",
    "Atualizações constantes",
    "Suporte durante o lançamento",
  ];
  return (
    <section id="beneficios" className="bg-muted/40">
      <div className="mx-auto max-w-6xl px-4 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-4xl font-extrabold tracking-tight">Benefícios da plataforma</h2>
          <p className="mt-3 text-muted-foreground">Tudo isso incluso, gratuitamente, durante o período de validação.</p>
        </div>
        <div className="mx-auto mt-12 grid max-w-4xl gap-3 sm:grid-cols-2 md:grid-cols-3">
          {items.map((item) => (
            <div
              key={item}
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 shadow-elegant transition hover:border-success/40 hover:shadow-premium"
            >
              <CircleCheck className="h-5 w-5 shrink-0 text-success" />
              <span className="text-sm font-medium">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-24">
      <div className="relative overflow-hidden rounded-3xl bg-sidebar p-10 text-center text-sidebar-foreground shadow-glow md:p-16">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-warm opacity-20 blur-3xl" />
        <FreeBadge />
        <h2 className="mt-5 font-display text-4xl font-extrabold md:text-5xl">Comece gratuitamente hoje.</h2>
        <p className="mx-auto mt-4 max-w-xl text-sidebar-foreground/70">
          Cadastre seu estabelecimento em poucos minutos e utilize gratuitamente todas as funcionalidades disponíveis
          durante o período de validação da plataforma. Acompanhe a evolução da Localix e tenha acesso antecipado às
          próximas novidades.
        </p>
        <Link to="/auth" className="inline-block">
          <Button size="lg" className="mt-8 shadow-glow">
            Quero cadastrar meu estabelecimento gratuitamente <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-8 text-sm text-muted-foreground md:flex-row">
        <p>© {new Date().getFullYear()} Localix. Todos os direitos reservados.</p>
        <p>Feito com 🔥 para quem move a cozinha.</p>
      </div>
    </footer>
  );
}
