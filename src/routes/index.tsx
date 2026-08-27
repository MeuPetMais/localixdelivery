import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PartnerWhatsAppFloatingButton } from "@/components/landing/PartnerWhatsAppFloatingButton";
import {
  ArrowRight,
  BarChart3,
  Bike,
  Check,
  CircleCheck,
  Clock,
  Gift,
  Headphones,
  ImagePlus,
  LayoutDashboard,
  LineChart,
  ListOrdered,
  Megaphone,
  Navigation,
  PackageCheck,
  Repeat,
  Route as RouteIcon,
  Sparkles,
  Store,
  Tag,
  Target,
  UserCircle,
  Users,
  UtensilsCrossed,
  Wand2,
} from "lucide-react";
import heroFood from "@/assets/hero-food.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Localix Delivery | Delivery e gestão para restaurantes" },
      {
        name: "description",
        content:
          "Crie seu cardápio digital, receba pedidos, gerencie seu delivery e desenvolva estratégias para aumentar a recorrência dos seus clientes com o Localix.",
      },
      {
        property: "og:title",
        content: "Localix Delivery | Delivery e gestão para restaurantes",
      },
      {
        property: "og:description",
        content:
          "Uma plataforma para vender, gerenciar a operação e desenvolver relacionamento com seus clientes.",
      },
    ],
  }),
  component: Landing,
});

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

function buildSignupHref(search = "") {
  const params = new URLSearchParams({ mode: "signup" });
  const current = new URLSearchParams(search);
  for (const key of UTM_KEYS) {
    const value = current.get(key);
    if (value) params.set(key, value);
  }
  return `/auth?${params.toString()}`;
}

function Landing() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <Header />
      <Hero />
      <ComplementaryChannel />
      <Pillars />
      <Growth />
      <HowItWorks />
      <DeliveryOperation />
      <ControlPanel />
      <Benefits />
      <Evolution />
      <FAQ />
      <FinalCTA />
      <Footer />
      <PartnerWhatsAppFloatingButton />
    </div>
  );
}

function SignupButton({
  children,
  mobileLabel,
  size = "lg",
  className = "",
}: {
  children: React.ReactNode;
  mobileLabel?: string;
  size?: "sm" | "lg";
  className?: string;
}) {
  const [href, setHref] = useState(() => buildSignupHref());

  useEffect(() => {
    setHref(buildSignupHref(window.location.search));
  }, []);

  return (
    <a href={href} className={className.includes("w-full") ? "w-full sm:w-auto" : undefined}>
      <Button
        size={size}
        className={`max-w-full whitespace-normal text-center leading-tight ${className}`}
      >
        {mobileLabel ? (
          <>
            <span className="hidden sm:inline">{children}</span>
            <span className="sm:hidden">{mobileLabel}</span>
          </>
        ) : (
          children
        )}
        <ArrowRight className="ml-1 h-4 w-4 shrink-0" />
      </Button>
    </a>
  );
}

function FreeBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-left text-xs font-semibold leading-snug text-success ${className}`}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
      </span>
      Cadastro gratuito durante o período de validação
    </span>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-3 sm:px-4">
        <Link to="/" className="flex min-w-0 items-center gap-2 font-display text-lg font-extrabold sm:text-xl">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-warm text-primary-foreground shadow-glow">
            L
          </span>
          <span className="truncate">Localix</span>
        </Link>
        <nav className="hidden gap-8 text-sm font-medium text-muted-foreground md:flex">
          <a href="#plataforma" className="hover:text-foreground">Plataforma</a>
          <a href="#growth" className="hover:text-foreground">Crescimento</a>
          <a href="#entregas" className="hover:text-foreground">Entregas</a>
          <a href="#beneficios" className="hover:text-foreground">Benefícios</a>
          <a href="#duvidas" className="hover:text-foreground">Dúvidas</a>
        </nav>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Link to="/auth" search={{ mode: undefined } as { mode: string | undefined }}>
            <Button variant="ghost" size="sm" className="px-2 sm:px-3">Entrar</Button>
          </Link>
          <SignupButton size="sm" className="px-2 sm:px-3">Cadastrar</SignupButton>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-hero">
      <div className="mx-auto grid max-w-6xl gap-10 px-3 py-14 sm:px-4 sm:py-16 md:grid-cols-2 md:py-24">
        <div className="flex flex-col justify-center">
          <FreeBadge />
          <h1 className="mt-5 max-w-full font-display text-[2rem] font-extrabold leading-[1.08] tracking-tight sm:text-4xl md:text-6xl">
            Tenha seu próprio canal de delivery. E trabalhe para o cliente voltar.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Receba pedidos pelo seu cardápio digital, gerencie sua operação e conte com o Time de Crescimento Localix para desenvolver relacionamento e recorrência com seus clientes.
          </p>
          <ul className="mt-5 space-y-2 text-sm leading-snug text-muted-foreground">
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              Cadastro gratuito durante o período de validação
            </li>
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              Tenha seu próprio canal digital de pedidos
            </li>
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              Use o Localix junto com os canais que você já utiliza
            </li>
          </ul>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <SignupButton className="h-auto min-h-10 w-full px-4 py-2 shadow-glow sm:w-auto sm:px-8" mobileLabel="Cadastrar estabelecimento">
              Cadastrar meu estabelecimento gratuitamente
            </SignupButton>
            <a href="#plataforma" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="h-auto min-h-10 w-full whitespace-normal px-4 py-2 leading-tight sm:w-auto sm:px-8">
                Conhecer a plataforma
              </Button>
            </a>
          </div>
        </div>
        <div className="relative">
          <img
            src={heroFood}
            alt="Pratos variados para delivery exibidos em uma mesa"
            width={1600}
            height={1200}
            className="relative aspect-[4/3] w-full max-w-full rounded-lg object-cover shadow-glow"
          />
          <div className="absolute -bottom-4 left-4 right-4 hidden rounded-lg border border-border/60 bg-card/95 px-4 py-3 shadow-elegant backdrop-blur md:block">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Para vender, gerenciar e aumentar recorrência</p>
            <p className="mt-0.5 text-sm font-bold">Cardápio digital · Pedidos · Operação · Relacionamento</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function ComplementaryChannel() {
  const items = [
    {
      icon: Store,
      title: "Seu canal",
      desc: "Tenha um cardápio digital próprio para receber pedidos dos seus clientes.",
    },
    {
      icon: LayoutDashboard,
      title: "Mais controle",
      desc: "Gerencie cardápio, pedidos, promoções e operação em um único ambiente.",
    },
    {
      icon: Repeat,
      title: "Mais relacionamento",
      desc: "Crie estratégias para incentivar seus clientes a voltarem a comprar.",
    },
  ];

  return (
    <section className="mx-auto max-w-6xl px-3 py-16 sm:px-4 sm:py-20">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
        <div>
          <h2 className="font-display text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
            Você não precisa depender de um único canal para vender.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Continue utilizando os canais que já funcionam para o seu negócio e construa também seu próprio canal de pedidos e relacionamento com seus clientes.
          </p>
          <p className="mt-3 text-muted-foreground">
            O Localix foi desenvolvido para complementar sua operação e dar mais controle ao estabelecimento sobre seu delivery.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {items.map(({ icon: Icon, title, desc }) => (
            <Card key={title} className="rounded-lg border-border/60 p-5 shadow-sm">
              <Icon className="h-5 w-5 text-primary" />
              <h3 className="mt-4 font-bold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pillars() {
  const items = [
    {
      number: "1",
      title: "Venda",
      headline: "Transforme seu cardápio em um canal de pedidos.",
      desc: "Cardápio digital, produtos personalizados, checkout e gestão de pedidos em uma experiência integrada.",
    },
    {
      number: "2",
      title: "Gerencie",
      headline: "Tenha sua operação em um único lugar.",
      desc: "Acompanhe pedidos, produtos, promoções, horários e indicadores pelo painel do estabelecimento.",
    },
    {
      number: "3",
      title: "Faça o cliente voltar",
      headline: "Transforme pedidos em relacionamento.",
      desc: "Use dados de clientes, recorrência e recursos de fidelização conforme a evolução da plataforma.",
    },
  ];

  return (
    <section className="bg-sidebar text-sidebar-foreground">
      <div className="mx-auto max-w-6xl px-3 py-16 sm:px-4 sm:py-24">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            Muito mais do que receber pedidos.
          </h2>
          <p className="mt-3 text-sidebar-foreground/70">
            O Localix conecta três etapas importantes do seu delivery: vender, gerenciar e aumentar recorrência.
          </p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {items.map((item) => (
            <div key={item.title} className="rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-5 sm:p-6">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground text-sm font-extrabold">
                {item.number}
              </span>
              <p className="mt-5 text-xs font-bold uppercase text-primary">{item.title}</p>
              <h3 className="mt-2 text-xl font-extrabold leading-tight">{item.headline}</h3>
              <p className="mt-3 text-sm text-sidebar-foreground/70">{item.desc}</p>
            </div>
          ))}
        </div>
        <a href="#plataforma" className="mt-10 block sm:inline-block">
          <Button size="lg" variant="secondary" className="h-auto min-h-10 w-full whitespace-normal px-4 py-2 leading-tight sm:w-auto sm:px-8">
            Quero conhecer o Localix
          </Button>
        </a>
      </div>
    </section>
  );
}

function Growth() {
  const items = [
    {
      icon: Repeat,
      title: "Segmentação básica de clientes",
      status: "Disponível agora",
      desc: "Organize a leitura da sua base com clientes novos, frequentes, VIP e inativos.",
    },
    {
      icon: Users,
      title: "Indicadores de recorrência",
      status: "Disponível agora",
      desc: "Acompanhe sinais de recompra, clientes recorrentes e clientes sem compra recente.",
    },
    {
      icon: Megaphone,
      title: "Priorização de ações",
      status: "Disponível agora",
      desc: "Identifique oportunidades e organize tarefas operacionais para acompanhar parceiros e clientes.",
    },
    {
      icon: Gift,
      title: "Campanhas avançadas",
      status: "Em evolução",
      desc: "Novos recursos para apoiar ações comerciais mais completas seguem em desenvolvimento.",
    },
    {
      icon: BarChart3,
      title: "Recursos inteligentes",
      status: "Em evolução",
      desc: "Recomendações e fidelização avançada seguem na evolução da plataforma.",
    },
    {
      icon: Target,
      title: "Benefícios e cashback",
      status: "Em evolução",
      desc: "Benefícios, cashback e mecanismos avançados de fidelização serão apresentados conforme disponibilidade.",
    },
  ];

  return (
    <section id="growth" className="mx-auto max-w-6xl px-3 py-16 sm:px-4 sm:py-24">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-left text-xs font-semibold leading-snug text-primary">
            <Target className="h-3.5 w-3.5 shrink-0" />
            Conheça o Time de Crescimento Localix
          </span>
          <h2 className="mt-4 font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            Seu cliente comprou. Nosso trabalho não precisa terminar no pedido.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            O Time de Crescimento Localix ajuda seu estabelecimento a conhecer melhor sua base de clientes, identificar oportunidades de recompra e desenvolver ações de relacionamento e recorrência.
          </p>
          <p className="mt-3 text-sm font-semibold text-primary">
            O Localix prospera quando o seu negócio prospera.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map(({ icon: Icon, title, status, desc }) => (
            <Card key={title} className="rounded-lg border-border/60 p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <Icon className="h-5 w-5 shrink-0 text-primary" />
                <span className="max-w-full rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                  {status}
                </span>
              </div>
              <h3 className="mt-4 font-bold leading-tight">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      title: "Cadastre seu estabelecimento",
      desc: "Crie sua conta e configure as informações principais do seu negócio.",
    },
    {
      title: "Monte seu cardápio",
      desc: "Cadastre categorias, produtos, preços, adicionais, imagens e informações de atendimento.",
    },
    {
      title: "Divulgue e receba pedidos",
      desc: "Compartilhe seu canal Localix com seus clientes e acompanhe os pedidos pelo painel.",
    },
  ];

  return (
    <section className="bg-muted/40">
      <div className="mx-auto max-w-6xl px-3 py-16 sm:px-4 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">Começar é simples.</h2>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
            <Card key={step.title} className="rounded-lg border-border/60 p-5 shadow-sm sm:p-6">
              <span className="text-sm font-extrabold text-primary">{index + 1}</span>
              <h3 className="mt-3 text-lg font-bold">{step.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{step.desc}</p>
            </Card>
          ))}
        </div>
        <div className="mt-10 text-center">
          <SignupButton className="h-auto min-h-10 w-full px-4 py-2 sm:w-auto sm:px-8">Criar meu estabelecimento</SignupButton>
        </div>
      </div>
    </section>
  );
}

function DeliveryOperation() {
  const partnerBenefits = [
    {
      icon: LayoutDashboard,
      title: "Painel operacional dedicado",
      desc: "Acompanhe pedidos e o andamento das entregas em um só lugar.",
    },
    {
      icon: RouteIcon,
      title: "Mais controle da operação",
      desc: "Tenha visibilidade do fluxo do pedido até a conclusão da entrega.",
    },
    {
      icon: Store,
      title: "Independência operacional",
      desc: "Organize sua operação de entrega sem depender exclusivamente de marketplaces.",
    },
    {
      icon: PackageCheck,
      title: "Operação integrada",
      desc: "Pedidos e entregas conectados ao mesmo fluxo do estabelecimento.",
    },
    {
      icon: Clock,
      title: "Histórico e acompanhamento",
      desc: "Use dados operacionais para identificar atrasos e gargalos.",
    },
  ];

  const driverBenefits = [
    {
      icon: Bike,
      title: "Área própria do entregador",
      desc: "Acesso separado da área do parceiro e do cliente.",
    },
    {
      icon: ListOrdered,
      title: "Entregas organizadas",
      desc: "Visualize as entregas atribuídas de forma simples.",
    },
    {
      icon: Navigation,
      title: "Atualização de status",
      desc: "Acompanhe e atualize as etapas da entrega dentro do fluxo operacional.",
    },
    {
      icon: UserCircle,
      title: "Perfil do entregador",
      desc: "Gerencie suas informações dentro da própria área.",
    },
    {
      icon: Headphones,
      title: "Ajuda e suporte",
      desc: "Conte com uma central própria para dúvidas e suporte durante a operação.",
    },
  ];

  const timeline = ["Pedido recebido", "Em preparação", "Entregador", "Em rota", "Entregue"];

  return (
    <section id="entregas" className="mx-auto max-w-6xl px-3 py-16 sm:px-4 sm:py-24">
      <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div>
          <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-left text-xs font-semibold leading-snug text-primary">
            <Bike className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Operação de entrega conectada
          </span>
          <h2 className="mt-4 font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            Sua operação de entrega, conectada ao Localix
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Do pedido à entrega, o Localix ajuda o estabelecimento a organizar a operação e dá ao entregador uma experiência própria para acompanhar suas entregas.
          </p>
          <p className="mt-3 text-sm font-semibold text-primary">
            Mais controle para o restaurante. Mais organização para quem entrega.
          </p>
          <div className="mt-8">
            <SignupButton className="h-auto min-h-10 w-full px-4 py-2 sm:w-auto sm:px-8" mobileLabel="Quero ser parceiro">
              Quero ser parceiro
            </SignupButton>
          </div>
        </div>

        <div className="rounded-lg border border-border/60 bg-card p-4 shadow-sm sm:p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <RouteIcon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-muted-foreground">Fluxo visual</p>
              <h3 className="font-display text-xl font-extrabold">Do pedido até a entrega</h3>
            </div>
          </div>
          <ol className="mt-6 grid gap-3 sm:grid-cols-5">
            {timeline.map((step, index) => (
              <li key={step} className="relative flex min-w-0 items-center gap-3 sm:flex-col sm:items-start">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-extrabold text-primary-foreground">
                  {index + 1}
                </span>
                <span className="min-w-0 text-sm font-bold leading-snug">{step}</span>
                {index < timeline.length - 1 && (
                  <span
                    className="absolute left-4 top-10 h-3 w-px bg-border sm:left-10 sm:top-4 sm:h-px sm:w-[calc(100%-2.5rem)]"
                    aria-hidden="true"
                  />
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <DeliveryBenefitCard title="Para o parceiro" items={partnerBenefits} />
        <DeliveryBenefitCard title="Para o entregador" items={driverBenefits} />
      </div>
    </section>
  );
}

function DeliveryBenefitCard({
  title,
  items,
}: {
  title: string;
  items: Array<{ icon: typeof LayoutDashboard; title: string; desc: string }>;
}) {
  return (
    <Card className="rounded-lg border-border/60 p-5 shadow-sm sm:p-6">
      <h3 className="font-display text-xl font-extrabold">{title}</h3>
      <div className="mt-5 grid gap-3">
        {items.map(({ icon: Icon, title: itemTitle, desc }) => (
          <div key={itemTitle} className="flex min-w-0 items-start gap-3 rounded-lg border border-border/60 bg-background px-3 py-3 sm:px-4">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0">
              <h4 className="text-sm font-bold leading-snug">{itemTitle}</h4>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ControlPanel() {
  const features = [
    { icon: LayoutDashboard, title: "Dashboard", desc: "Indicadores da operação, pedidos e clientes." },
    { icon: ListOrdered, title: "Gestão de pedidos", desc: "Receba e acompanhe pedidos pelo painel." },
    {
      icon: UtensilsCrossed,
      title: "Cardápio digital",
      desc: "Categorias, produtos, adicionais, disponibilidade e fotos.",
    },
    { icon: Tag, title: "Promoções", desc: "Ofertas, preços promocionais, agendamento e recorrência." },
    {
      icon: Wand2,
      title: "Monte do seu jeito",
      desc: "Produtos configuráveis e adicionais para pedidos personalizados.",
    },
    {
      icon: Store,
      title: "Perfil do estabelecimento",
      desc: "Horários, endereço, entrega, retirada, taxas, pedido mínimo e redes sociais.",
    },
    { icon: UserCircle, title: "Área do proprietário", desc: "Conta, dados do responsável e segurança." },
    { icon: ImagePlus, title: "Upload de imagens", desc: "Fotos de produtos, logo, banner e galeria." },
    { icon: LineChart, title: "Financeiro e relatórios", desc: "Indicadores, movimentações e análises em evolução." },
  ];
  return (
    <section id="plataforma" className="bg-sidebar text-sidebar-foreground">
      <div className="mx-auto max-w-6xl px-3 py-16 sm:px-4 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <FreeBadge className="border-success/40 bg-success/15" />
          <h2 className="mt-4 font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">Conheça o painel de controle</h2>
          <p className="mt-3 text-sidebar-foreground/70">
            Ferramentas comprovadas para vender e operar melhor, reunidas em um único ambiente.
          </p>
        </div>
        <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="group relative rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-5 transition hover:border-primary/40 hover:bg-sidebar-accent/60 sm:p-6"
            >
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-lg bg-primary/15 text-primary transition group-hover:bg-gradient-warm group-hover:text-primary-foreground">
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

function Benefits() {
  const available = [
    "Cadastro de estabelecimento",
    "Cardápio digital",
    "Gestão de pedidos",
    "Checkout integrado",
    "Pagamentos online via Mercado Pago conforme configuração",
    "Promoções",
    "Produtos personalizados",
    "Fotos",
    "Controle de horários",
    "Perfil do estabelecimento",
    "Base de clientes",
    "Segmentação básica",
    "Indicadores do painel",
  ];
  const evolving = [
    "Fidelidade avançada",
    "Cashback",
    "Campanhas avançadas",
    "Automações",
    "Fidelização avançada",
  ];
  return (
    <section id="beneficios" className="bg-muted/40">
      <div className="mx-auto max-w-6xl px-3 py-16 sm:px-4 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            Tudo o que você precisa para começar seu delivery no Localix.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Os recursos disponíveis ajudam seu estabelecimento a começar agora, enquanto novas frentes continuam evoluindo para fortalecer operação, relacionamento e recorrência.
          </p>
        </div>
        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          <FeatureList title="Disponível agora" items={available} icon={CircleCheck} tone="success" />
          <FeatureList title="Em evolução" items={evolving} icon={Sparkles} tone="primary" />
        </div>
      </div>
    </section>
  );
}

function FeatureList({
  title,
  items,
  icon: Icon,
  tone,
}: {
  title: string;
  items: string[];
  icon: typeof CircleCheck;
  tone: "success" | "primary";
}) {
  const color = tone === "success" ? "text-success" : "text-primary";
  return (
    <Card className="rounded-lg border-border/60 p-5 shadow-sm sm:p-6">
      <h3 className="font-display text-xl font-extrabold">{title}</h3>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item} className="flex min-w-0 items-start gap-3 rounded-lg border border-border/60 bg-background px-3 py-3 sm:px-4">
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} />
            <span className="min-w-0 text-sm font-medium leading-snug">{item}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Evolution() {
  return (
    <section className="mx-auto max-w-6xl px-3 py-16 sm:px-4 sm:py-20">
      <div className="mx-auto max-w-3xl rounded-lg border border-border/60 bg-card p-6 text-center shadow-sm sm:p-8">
        <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-left text-xs font-semibold leading-snug text-primary">
          <Sparkles className="h-3.5 w-3.5 shrink-0" /> Em breve na Localix
        </span>
        <h2 className="mt-4 font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">O Localix continua evoluindo.</h2>
        <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Novos recursos de fidelização, benefícios, campanhas e automação estão sendo desenvolvidos para ampliar as ferramentas disponíveis aos parceiros.
        </p>
      </div>
    </section>
  );
}

function FAQ() {
  const items = [
    {
      q: "Preciso deixar de usar outras plataformas?",
      a: "Não. O Localix pode funcionar como um canal complementar ao delivery que seu estabelecimento já utiliza.",
    },
    {
      q: "O cadastro é gratuito?",
      a: "Durante o período de validação, o cadastro do estabelecimento é gratuito. Essa condição pode ser revisada conforme a política comercial vigente do Localix.",
    },
    {
      q: "Existe mensalidade?",
      a: "A comunicação atual considera o período de validação. Caso exista uma condição comercial futura, ela deve ser apresentada de forma clara antes da contratação.",
    },
    {
      q: "Existe comissão sobre minhas vendas?",
      a: "A regra comprovada no código trabalha com taxa de serviço por pedido, não com uma promessa pública de comissão percentual fixa.",
    },
    {
      q: "Existe alguma taxa no pedido?",
      a: "Pode existir taxa de serviço por pedido. A configuração atual permite que ela seja considerada no total do cliente ou na composição financeira do restaurante, conforme regra vigente.",
    },
    {
      q: "Como recebo os pedidos?",
      a: "Os pedidos feitos pelo cardápio digital aparecem no painel do estabelecimento para acompanhamento e atualização de status.",
    },
    {
      q: "Como funcionam os pagamentos?",
      a: "O fluxo atual suporta pagamentos online via Mercado Pago conforme gateway configurado, além de formas de pagamento registradas no pedido.",
    },
    {
      q: "Preciso instalar algum programa?",
      a: "Não. O Localix funciona pela aplicação web e pode ser acessado pelo navegador.",
    },
    {
      q: "Posso continuar usando meu delivery atual?",
      a: "Sim. O Localix pode ser utilizado como um canal adicional.",
    },
    {
      q: "O que é o Time de Crescimento Localix?",
      a: "É a frente dedicada a ajudar parceiros a conhecer melhor a base de clientes, identificar oportunidades de recompra e desenvolver ações de relacionamento e recorrência. Segmentação básica e indicadores já existem; campanhas avançadas, automações e benefícios seguem em evolução.",
    },
  ];

  return (
    <section id="duvidas" className="bg-muted/40">
      <div className="mx-auto max-w-3xl px-3 py-16 sm:px-4 sm:py-24">
        <h2 className="text-center font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">Dúvidas frequentes</h2>
        <Accordion type="single" collapsible className="mt-10 w-full rounded-lg border bg-background px-3 sm:px-4">
          {items.map((item) => (
            <AccordionItem key={item.q} value={item.q}>
              <AccordionTrigger className="text-left text-sm leading-snug sm:text-base">{item.q}</AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground sm:text-base">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="mx-auto max-w-5xl px-3 py-16 sm:px-4 sm:py-24">
      <div className="overflow-hidden rounded-lg bg-sidebar p-5 text-center text-sidebar-foreground shadow-glow sm:p-10 md:p-16">
        <FreeBadge />
        <h2 className="mt-5 font-display text-3xl font-extrabold leading-tight sm:text-4xl md:text-5xl">
          Comece a construir seu próprio canal de delivery.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-sidebar-foreground/70">
          Cadastre seu estabelecimento, configure seu cardápio e conheça as ferramentas que o Localix está desenvolvendo para ajudar parceiros a vender, gerenciar e fortalecer o relacionamento com seus clientes.
        </p>
        <SignupButton className="mt-8 h-auto min-h-10 w-full px-4 py-2 shadow-glow sm:w-auto sm:px-8" mobileLabel="Cadastrar estabelecimento">
          Cadastrar meu estabelecimento gratuitamente
        </SignupButton>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-3 py-8 text-center text-sm leading-snug text-muted-foreground sm:px-4 md:flex-row md:text-left">
        <p>© {new Date().getFullYear()} Localix. Todos os direitos reservados.</p>
        <p>Delivery, gestão e recorrência para estabelecimentos.</p>
      </div>
    </footer>
  );
}
