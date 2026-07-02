import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Search,
  BookOpen,
  Rocket,
  Sandwich,
  Pizza,
  Flame,
  Package,
  Printer,
  Wallet,
  Star,
  Bot,
  Settings,
  Users,
  ThumbsUp,
  ThumbsDown,
  Clock,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

type CategoryId =
  | "primeiros-passos"
  | "cardapio"
  | "builder"
  | "promocoes"
  | "pedidos"
  | "impressao"
  | "financeiro"
  | "fidelidade"
  | "ia"
  | "configuracoes"
  | "clientes";

type Article = {
  id: string;
  category: CategoryId;
  title: string;
  summary: string;
  tags: string[];
  route?: { to: string; label: string };
  related?: string[];
  sections: { heading: string; items: string[] }[];
  tips?: string[];
  commonErrors?: string[];
};

const CATEGORIES: { id: CategoryId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "primeiros-passos", label: "🚀 Primeiros Passos", icon: Rocket },
  { id: "cardapio", label: "🍔 Cardápio", icon: Sandwich },
  { id: "builder", label: "🍕 Builder", icon: Pizza },
  { id: "promocoes", label: "🔥 Promoções", icon: Flame },
  { id: "pedidos", label: "📦 Pedidos", icon: Package },
  { id: "impressao", label: "🖨 Impressão", icon: Printer },
  { id: "financeiro", label: "💰 Financeiro", icon: Wallet },
  { id: "fidelidade", label: "⭐ Fidelidade", icon: Star },
  { id: "ia", label: "🤖 Inteligência Artificial", icon: Bot },
  { id: "configuracoes", label: "⚙ Configurações", icon: Settings },
  { id: "clientes", label: "👥 Clientes", icon: Users },
];

const ARTICLES: Article[] = [
  {
    id: "setup-restaurante",
    category: "primeiros-passos",
    title: "Configuração inicial do seu estabelecimento",
    summary: "Preencha os dados principais para publicar seu cardápio.",
    tags: ["setup", "onboarding", "perfil"],
    route: { to: "/settings", label: "Abrir Configurações" },
    related: ["setup-horarios", "cadastrar-produto"],
    sections: [
      {
        heading: "Passo a passo",
        items: [
          "Acesse Configurações > Perfil do estabelecimento.",
          "Preencha nome, WhatsApp, endereço e logo.",
          "Defina a URL pública (slug) — ela vira o link do seu cardápio.",
          "Configure horários de funcionamento (com opção 'Fechado' por dia).",
          "Salve e teste em uma aba anônima abrindo /seu-slug.",
        ],
      },
    ],
    tips: [
      "Use uma logo quadrada em PNG para ficar nítida no mobile.",
      "Complete o perfil 100% para melhorar sua conversão.",
    ],
    commonErrors: [
      "Slug com espaços ou acentos — use apenas letras, números e hífen.",
      "Esquecer de marcar dias como 'Fechado' — pedidos entram fora do horário.",
    ],
  },
  {
    id: "setup-horarios",
    category: "primeiros-passos",
    title: "Como configurar horários de funcionamento",
    summary: "Dois turnos por dia e fechamento por dia da semana.",
    tags: ["horario", "abertura"],
    route: { to: "/settings", label: "Abrir Configurações" },
    sections: [
      {
        heading: "Regras",
        items: [
          "Cada dia aceita até 2 turnos (ex: 11:00–14:00 e 18:00–23:00).",
          "Marque 'Fechado' para desativar o dia inteiro.",
          "O status abre/fecha automaticamente no fuso America/Sao_Paulo.",
        ],
      },
    ],
  },
  {
    id: "cadastrar-produto",
    category: "cardapio",
    title: "Como cadastrar produtos no cardápio",
    summary: "Fotos otimizadas, preço, categoria e disponibilidade.",
    tags: ["produto", "cardapio", "imagem"],
    route: { to: "/menu", label: "Abrir Cardápio" },
    related: ["categorias-destaque", "builder-criar"],
    sections: [
      {
        heading: "Passo a passo",
        items: [
          "Vá em Cardápio > Novo produto.",
          "Escolha uma categoria (ou crie uma nova).",
          "Preencha nome, descrição curta e preço.",
          "Envie até 5 imagens — geramos WebP otimizado automaticamente.",
          "Marque 'Disponível' e salve.",
        ],
      },
    ],
    tips: [
      "Fotos com fundo neutro convertem mais.",
      "Descrição de 1 linha destacando ingredientes principais.",
    ],
    commonErrors: [
      "Produto sem categoria não aparece no cardápio público.",
      "Preço em formato incorreto — use ponto ou vírgula, sem R$.",
    ],
  },
  {
    id: "categorias-destaque",
    category: "cardapio",
    title: "Categorias em Destaque na página pública",
    summary: "Coleções inteligentes que organizam o cardápio automaticamente.",
    tags: ["destaque", "colecao"],
    route: { to: "/featured", label: "Abrir Categorias em Destaque" },
    sections: [
      {
        heading: "Ordem de exibição",
        items: [
          "⭐ Promoções",
          "🔥 Queridinhos da Semana",
          "🏆 Mais Bem Avaliados",
          "🆕 Novidades",
          "❤️ Favoritos dos Clientes",
          "🍕 Pizza Meio a Meio",
        ],
      },
      {
        heading: "Como funciona",
        items: [
          "Seções vazias são ocultadas automaticamente.",
          "Atualiza em tempo real quando você muda promoções ou produtos.",
        ],
      },
    ],
  },
  {
    id: "builder-criar",
    category: "builder",
    title: "Monte do Seu Jeito — como criar um builder",
    summary: "Grupos obrigatórios, opcionais, adicionais e precificação.",
    tags: ["builder", "montar", "personalizar"],
    route: { to: "/builders", label: "Abrir Builders" },
    related: ["cadastrar-produto"],
    sections: [
      {
        heading: "Estrutura",
        items: [
          "Grupos: cada etapa do configurador (ex: Massa, Sabores, Bordas, Adicionais).",
          "Obrigatórios: o cliente precisa escolher para avançar.",
          "Opcionais: pode pular sem selecionar nada.",
          "Quantidade mínima/máxima por grupo: controla quantas opções pode escolher.",
          "Ordem dos grupos: definida pelo campo 'posição' (arrasta na tela).",
        ],
      },
      {
        heading: "Precificação",
        items: [
          "Preço base: definido no builder.",
          "Cada opção pode ter preço adicional (soma ao total).",
          "Meio a meio: usa o maior valor entre os sabores escolhidos.",
        ],
      },
    ],
    tips: [
      "Coloque adicionais como grupo opcional no final.",
      "Use no máximo 5 grupos para não cansar o cliente.",
    ],
    commonErrors: [
      "Mínimo = 0 em grupo obrigatório — deixe mínimo ≥ 1.",
      "Máximo menor que mínimo — o builder não abre.",
    ],
  },
  {
    id: "promocao-criar",
    category: "promocoes",
    title: "Como criar uma promoção",
    summary: "Descontos, período, recorrência e Happy Hour.",
    tags: ["promocao", "desconto", "happy-hour"],
    route: { to: "/promotions", label: "Abrir Promoções" },
    sections: [
      {
        heading: "Tipos",
        items: [
          "Percentual (ex: 20% OFF).",
          "Valor fixo (ex: R$ 5 OFF).",
          "Preço promocional direto no produto.",
        ],
      },
      {
        heading: "Período e recorrência",
        items: [
          "Data de início e fim.",
          "Recorrência semanal (ex: toda terça 18h–20h — Happy Hour).",
          "Pausar/Retomar/Encerrar/Duplicar em 1 clique.",
        ],
      },
      {
        heading: "Boas práticas",
        items: [
          "Combos de 2 itens convertem mais que descontos pequenos.",
          "Happy Hour em horário fraco ajuda a distribuir a operação.",
          "Anuncie no WhatsApp no início da recorrência.",
        ],
      },
    ],
  },
  {
    id: "pedidos-fluxo",
    category: "pedidos",
    title: "Fluxo de pedidos — do novo ao entregue",
    summary: "Kanban, atalhos, urgência e notificações.",
    tags: ["pedidos", "kanban", "operacao"],
    route: { to: "/orders", label: "Abrir Pedidos" },
    related: ["impressao-configurar", "kds-cozinha"],
    sections: [
      {
        heading: "Colunas",
        items: [
          "Novo pedido → precisa aceitar (atalho: A).",
          "Preparo → cozinha executando (atalho: P).",
          "Saiu para entrega → motoboy a caminho (atalho: S).",
          "Entregue → finalizado (atalho: F).",
          "Cancelado → não conta no faturamento.",
        ],
      },
      {
        heading: "Urgência",
        items: [
          "Até 5 min: verde. 5–10: amarelo. 10–15: laranja. 15+: vermelho piscando.",
          "Timer em cada card, atualizado a cada 30s.",
        ],
      },
      {
        heading: "Notificações",
        items: [
          "Som distinto para novo pedido e cancelamento.",
          "Vibração e badge no título da aba do navegador.",
          "Alerta persistente até você aceitar o pedido.",
        ],
      },
    ],
  },
  {
    id: "kds-cozinha",
    category: "pedidos",
    title: "Painel da Cozinha (KDS) e Modo TV",
    summary: "Tela dedicada para a cozinha com Modo TV.",
    tags: ["kds", "cozinha", "tv"],
    route: { to: "/kitchen", label: "Abrir Painel da Cozinha" },
    sections: [
      {
        heading: "Recursos",
        items: [
          "Cards grandes com contador de tempo.",
          "Modo TV / Tela cheia para monitor da cozinha.",
          "Chamada por voz automática dos novos pedidos.",
        ],
      },
    ],
  },
  {
    id: "impressao-configurar",
    category: "impressao",
    title: "Impressão — 58mm, 80mm e A4",
    summary: "Como configurar impressão automática e modelos.",
    tags: ["impressao", "termica", "comanda"],
    route: { to: "/print-settings", label: "Abrir Configurações de Impressão" },
    sections: [
      {
        heading: "Tipos de papel",
        items: [
          "58 mm — impressoras pequenas de balcão.",
          "80 mm — impressoras térmicas padrão de restaurante.",
          "A4 — impressora comum de escritório.",
        ],
      },
      {
        heading: "Modelos",
        items: [
          "Comanda da Cozinha: agrupa Itens, Builder, Bebidas, Sobremesas e Observações.",
          "Cupom de Entrega: dados do cliente, endereço, forma de pagamento e QR Code.",
        ],
      },
      {
        heading: "Automática",
        items: [
          "Ao aceitar o pedido: imprime automaticamente (configurável).",
          "Quantas cópias por modelo (ex: 1 cozinha + 1 entrega).",
          "Rotas separadas: cozinha imprime na 80mm, entrega na 58mm.",
        ],
      },
    ],
    tips: [
      "Habilite popups no navegador para impressão silenciosa via iframe.",
      "Teste com o botão 'Imprimir teste' antes do horário de pico.",
    ],
  },
  {
    id: "financeiro-visao",
    category: "financeiro",
    title: "Visão geral do Financeiro",
    summary: "Entradas, saídas, DRE e categorização.",
    tags: ["financeiro", "dre"],
    route: { to: "/finance", label: "Abrir Financeiro" },
    sections: [
      {
        heading: "O que registrar",
        items: [
          "Entradas: pedidos entregues entram automaticamente.",
          "Saídas: fornecedores, folha, aluguel — registre manualmente.",
          "Categorias personalizáveis por tipo de despesa.",
        ],
      },
    ],
  },
  {
    id: "fidelidade-cupons",
    category: "fidelidade",
    title: "Fidelidade e Cupons",
    summary: "Pontos por pedido, cashback e cupons de desconto.",
    tags: ["fidelidade", "cupom", "cashback"],
    route: { to: "/loyalty", label: "Abrir Fidelidade" },
    sections: [
      {
        heading: "Como funciona",
        items: [
          "Cliente ganha pontos a cada pedido pago.",
          "Cupons: código, desconto, validade e limite de uso.",
          "Cashback aparece na Central de Benefícios do cliente.",
        ],
      },
    ],
  },
  {
    id: "ia-consultor",
    category: "ia",
    title: "Consultor IA e Central de IA",
    summary: "Analisa seu restaurante e responde perguntas em linguagem natural.",
    tags: ["ia", "consultor", "gemini"],
    route: { to: "/consultor", label: "Abrir Consultor IA" },
    sections: [
      {
        heading: "Consultor IA",
        items: [
          "Faça perguntas sobre operação, cardápio ou finanças.",
          "Ex: 'Qual meu produto mais vendido nas últimas 4 semanas?'",
          "Ex: 'Sugira 3 combos com base no meu cardápio atual.'",
          "Ex: 'Como aumentar ticket médio no almoço?'",
        ],
      },
      {
        heading: "Central de IA",
        items: [
          "Gera descrições de produtos e campanhas.",
          "Detecta clientes inativos e sugere reengajamento.",
        ],
      },
    ],
  },
  {
    id: "clientes-crm",
    category: "clientes",
    title: "CRM — sua base de clientes",
    summary: "Histórico de pedidos, endereços e segmentação.",
    tags: ["clientes", "crm"],
    route: { to: "/customers", label: "Abrir Clientes" },
    sections: [
      {
        heading: "O que você vê",
        items: [
          "Histórico completo de cada cliente.",
          "Endereços cadastrados e endereço principal.",
          "Valor total gasto, ticket médio e último pedido.",
        ],
      },
    ],
  },
];

const READ_WPM = 220;

function estimateReadMinutes(a: Article) {
  const text = [
    a.summary,
    ...a.sections.flatMap((s) => [s.heading, ...s.items]),
    ...(a.tips ?? []),
    ...(a.commonErrors ?? []),
  ].join(" ");
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / READ_WPM));
}

export function KnowledgeBase() {
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<CategoryId | "todos">("todos");
  const [feedback, setFeedback] = useState<Record<string, "yes" | "no">>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ARTICLES.filter((a) => {
      if (activeCat !== "todos" && a.category !== activeCat) return false;
      if (!q) return true;
      const hay = [
        a.title,
        a.summary,
        ...a.tags,
        ...a.sections.flatMap((s) => [s.heading, ...s.items]),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [query, activeCat]);

  function rate(id: string, v: "yes" | "no") {
    setFeedback((f) => ({ ...f, [id]: v }));
    toast.success(
      v === "yes" ? "Que bom! Obrigado pelo retorno." : "Obrigado — vamos melhorar este artigo.",
    );
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-primary" />
        <h2 className="font-semibold">Base de Conhecimento</h2>
        <Badge variant="secondary" className="ml-auto">{ARTICLES.length} artigos</Badge>
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar artigos, ex: 'promoção', 'impressão 80mm', 'builder'"
          className="pl-9"
        />
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        <CategoryChip
          label="Todos"
          active={activeCat === "todos"}
          onClick={() => setActiveCat("todos")}
        />
        {CATEGORIES.map((c) => (
          <CategoryChip
            key={c.id}
            label={c.label}
            active={activeCat === c.id}
            onClick={() => setActiveCat(c.id)}
          />
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nenhum artigo encontrado. Tente outra busca ou abra um chamado.
        </div>
      ) : (
        <Accordion type="multiple" className="w-full">
          {filtered.map((a) => {
            const cat = CATEGORIES.find((c) => c.id === a.category);
            const mins = estimateReadMinutes(a);
            return (
              <AccordionItem key={a.id} value={a.id}>
                <AccordionTrigger className="text-left">
                  <div className="flex-1 pr-3">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{cat?.label}</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {mins} min de leitura
                      </span>
                    </div>
                    <div className="mt-0.5 font-medium">{a.title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{a.summary}</div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-1">
                    {a.sections.map((s, i) => (
                      <div key={i}>
                        <div className="text-xs font-semibold uppercase tracking-wide text-primary">
                          {s.heading}
                        </div>
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                          {s.items.map((it, j) => <li key={j}>{it}</li>)}
                        </ul>
                      </div>
                    ))}

                    {a.tips && a.tips.length > 0 && (
                      <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
                        <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                          💡 Dicas importantes
                        </div>
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                          {a.tips.map((t, i) => <li key={i}>{t}</li>)}
                        </ul>
                      </div>
                    )}

                    {a.commonErrors && a.commonErrors.length > 0 && (
                      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                        <div className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                          ⚠️ Erros comuns
                        </div>
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                          {a.commonErrors.map((t, i) => <li key={i}>{t}</li>)}
                        </ul>
                      </div>
                    )}

                    {a.related && a.related.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Artigos relacionados
                        </div>
                        <ul className="mt-1 space-y-1 text-sm">
                          {a.related.map((rid) => {
                            const r = ARTICLES.find((x) => x.id === rid);
                            if (!r) return null;
                            return (
                              <li key={rid}>
                                <span className="text-primary">→</span> {r.title}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                      {a.route ? (
                        <Button asChild size="sm" variant="outline" className="gap-1">
                          <Link to={a.route.to}>
                            <ExternalLink className="h-3.5 w-3.5" />
                            {a.route.label}
                          </Link>
                        </Button>
                      ) : <span />}

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Este artigo resolveu?</span>
                        <Button
                          size="sm"
                          variant={feedback[a.id] === "yes" ? "default" : "outline"}
                          onClick={() => rate(a.id, "yes")}
                          className="h-7 gap-1 px-2"
                        >
                          <ThumbsUp className="h-3.5 w-3.5" /> Sim
                        </Button>
                        <Button
                          size="sm"
                          variant={feedback[a.id] === "no" ? "default" : "outline"}
                          onClick={() => rate(a.id, "no")}
                          className="h-7 gap-1 px-2"
                        >
                          <ThumbsDown className="h-3.5 w-3.5" /> Não
                        </Button>
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </Card>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background hover:bg-accent"
      }`}
    >
      {label}
    </button>
  );
}
