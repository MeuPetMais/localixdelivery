import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { KnowledgeBase } from "@/components/support/KnowledgeBase";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  LifeBuoy,
  Plus,
  Loader2,
  Send,
  BookOpen,
  Search,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/support")({
  head: () => ({ meta: [{ title: "Central de Suporte — Localix" }] }),
  component: SupportPage,
});

type TicketStatus = "aberto" | "em_analise" | "respondido" | "resolvido" | "fechado";
type Priority = "baixa" | "media" | "alta" | "urgente";
type Category =
  | "problema_tecnico" | "pedido" | "pagamentos" | "cardapio" | "builder"
  | "impressao" | "financeiro" | "fidelidade" | "ia" | "sugestao" | "outro";

type Ticket = {
  id: string;
  ticket_number: number | null;
  subject: string;
  category: Category;
  priority: Priority;
  status: TicketStatus;
  description: string;
  last_message_at: string;
  created_at: string;
};

type Message = {
  id: string;
  ticket_id: string;
  author_id: string;
  author_type: "cliente" | "suporte";
  body: string | null;
  created_at: string;
};

type Article = {
  id: string;
  category: string;
  title: string;
  content: string;
  video_url: string | null;
};

const STATUS_LABEL: Record<TicketStatus, string> = {
  aberto: "Aberto",
  em_analise: "Em análise",
  respondido: "Respondido",
  resolvido: "Resolvido",
  fechado: "Fechado",
};

const STATUS_COLOR: Record<TicketStatus, string> = {
  aberto: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  em_analise: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  respondido: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  resolvido: "bg-muted text-muted-foreground",
  fechado: "bg-muted text-muted-foreground",
};

const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: "problema_tecnico", label: "Problema técnico" },
  { value: "pedido", label: "Pedidos" },
  { value: "pagamentos", label: "Pagamentos" },
  { value: "cardapio", label: "Cardápio" },
  { value: "builder", label: "Monte do Seu Jeito" },
  { value: "impressao", label: "Impressão" },
  { value: "financeiro", label: "Financeiro" },
  { value: "fidelidade", label: "Fidelidade / Cupons" },
  { value: "ia", label: "Central de IA" },
  { value: "sugestao", label: "Sugestão" },
  { value: "outro", label: "Outro" },
];

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
];

function collectDiagnostics(restaurantId?: string, restaurantSlug?: string) {
  if (typeof window === "undefined") return {};
  return {
    url: window.location.href,
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    online: navigator.onLine,
    timestamp: new Date().toISOString(),
    restaurantId,
    restaurantSlug,
  };
}

function SupportPage() {
  const { user } = useAuth();
  const restaurant = useRestaurant();
  const qc = useQueryClient();
  const [openNew, setOpenNew] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"todos" | TicketStatus>("todos");
  const [search, setSearch] = useState("");

  const ticketsQuery = useQuery({
    queryKey: ["support-tickets", restaurant?.id],
    enabled: !!restaurant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("restaurant_id", restaurant!.id)
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Ticket[];
    },
  });


  // Realtime: atualizar lista quando o suporte responder
  useEffect(() => {
    if (!restaurant?.id) return;
    const ch = supabase
      .channel(`support-tickets-${restaurant.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_tickets", filter: `restaurant_id=eq.${restaurant.id}` },
        () => qc.invalidateQueries({ queryKey: ["support-tickets", restaurant.id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [restaurant?.id, qc]);

  const tickets = ticketsQuery.data ?? [];
  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      if (statusFilter !== "todos" && t.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !t.subject.toLowerCase().includes(q) &&
          !String(t.ticket_number ?? "").includes(q)
        )
          return false;
      }
      return true;
    });
  }, [tickets, statusFilter, search]);

  const kpis = useMemo(() => {
    const abertos = tickets.filter((t) => ["aberto", "em_analise"].includes(t.status)).length;
    const respondidos = tickets.filter((t) => t.status === "respondido").length;
    const resolvidos = tickets.filter((t) => ["resolvido", "fechado"].includes(t.status)).length;
    return { abertos, respondidos, resolvidos, total: tickets.length };
  }, [tickets]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold flex items-center gap-2">
            <LifeBuoy className="h-6 w-6 text-primary" /> Central de Suporte
          </h1>
          <p className="text-sm text-muted-foreground">
            Abra chamados, acompanhe respostas e consulte a base de conhecimento.
          </p>
        </div>
        <Button onClick={() => setOpenNew(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Novo chamado
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Em andamento" value={kpis.abertos} tone="blue" />
        <KpiCard label="Aguardando você" value={kpis.respondidos} tone="emerald" />
        <KpiCard label="Resolvidos" value={kpis.resolvidos} tone="muted" />
        <KpiCard label="Total" value={kpis.total} tone="muted" />
      </div>

      {/* Filtros */}
      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por assunto ou #número"
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {(Object.keys(STATUS_LABEL) as TicketStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Lista */}
      <Card className="divide-y overflow-hidden">
        {ticketsQuery.isLoading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Carregando chamados…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <LifeBuoy className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nenhum chamado {statusFilter !== "todos" ? "com esse status" : "aberto ainda"}.
            </p>
            <Button variant="outline" className="mt-3" onClick={() => setOpenNew(true)}>
              Abrir meu primeiro chamado
            </Button>
          </div>
        ) : (
          filtered.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedId(t.id)}
              className="flex w-full items-start justify-between gap-3 p-4 text-left hover:bg-accent/50 transition"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">#{t.ticket_number ?? "—"}</span>
                  <span>·</span>
                  <span>{new Date(t.last_message_at).toLocaleString("pt-BR")}</span>
                </div>
                <p className="mt-0.5 truncate font-medium">{t.subject}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {CATEGORY_OPTIONS.find((c) => c.value === t.category)?.label} · Prioridade{" "}
                  {t.priority}
                </p>
              </div>
              <Badge className={STATUS_COLOR[t.status]}>{STATUS_LABEL[t.status]}</Badge>
            </button>
          ))
        )}
      </Card>

      <KnowledgeBase />

      <NewTicketDialog
        open={openNew}
        onOpenChange={setOpenNew}
        userId={user?.id ?? ""}
        restaurantId={restaurant?.id ?? ""}
        restaurantSlug={restaurant?.slug}
        onCreated={(id) => {
          qc.invalidateQueries({ queryKey: ["support-tickets", restaurant?.id] });
          setSelectedId(id);
        }}
      />

      <TicketDrawer
        ticketId={selectedId}
        userId={user?.id ?? ""}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "blue" | "emerald" | "muted";
}) {
  const toneClass =
    tone === "blue"
      ? "text-blue-600 dark:text-blue-400"
      : tone === "emerald"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-foreground";
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</div>
    </Card>
  );
}

function NewTicketDialog({
  open,
  onOpenChange,
  userId,
  restaurantId,
  restaurantSlug,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  restaurantId: string;
  restaurantSlug?: string;
  onCreated: (id: string) => void;
}) {
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<Category>("problema_tecnico");
  const [priority, setPriority] = useState<Priority>("media");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!subject.trim() || !description.trim()) {
      toast.error("Preencha assunto e descrição.");
      return;
    }
    if (!restaurantId || !userId) {
      toast.error("Sessão inválida.");
      return;
    }
    setSaving(true);
    const diagnostics = collectDiagnostics(restaurantId, restaurantSlug);
    const { data, error } = await supabase
      .from("support_tickets")
      .insert({
        restaurant_id: restaurantId,
        user_id: userId,
        subject: subject.trim(),
        category,
        priority,
        description: description.trim(),
        diagnostics,
      })
      .select("id")
      .single();
    setSaving(false);
    if (error) {
      toast.error("Não foi possível abrir o chamado.");
      return;
    }
    // primeira mensagem = descrição
    await supabase.from("support_messages").insert({
      ticket_id: data.id,
      author_id: userId,
      author_type: "cliente",
      body: description.trim(),
    });
    toast.success("Chamado aberto! Nossa equipe responderá em breve.");
    setSubject("");
    setDescription("");
    setCategory("problema_tecnico");
    setPriority("media");
    onOpenChange(false);
    onCreated(data.id);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Novo chamado
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium">Assunto</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex.: Impressora não imprime pedidos novos"
              maxLength={140}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium">Categoria</label>
              <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium">Prioridade</label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium">Descreva o problema</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="Conte com detalhes o que aconteceu, quando começou, quais telas etc."
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Enviaremos automaticamente informações técnicas do seu dispositivo (URL, navegador, tamanho da tela) para ajudar no diagnóstico.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Abrir chamado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TicketDrawer({
  ticketId,
  userId,
  onClose,
}: {
  ticketId: string | null;
  userId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const ticketQuery = useQuery({
    queryKey: ["support-ticket", ticketId],
    enabled: !!ticketId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("id", ticketId!)
        .single();
      if (error) throw error;
      return data as Ticket;
    },
  });

  const messagesQuery = useQuery({
    queryKey: ["support-messages", ticketId],
    enabled: !!ticketId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_messages")
        .select("*")
        .eq("ticket_id", ticketId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Message[];
    },
  });

  useEffect(() => {
    if (!ticketId) return;
    const ch = supabase
      .channel(`support-msgs-${ticketId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `ticket_id=eq.${ticketId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["support-messages", ticketId] });
          qc.invalidateQueries({ queryKey: ["support-ticket", ticketId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [ticketId, qc]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messagesQuery.data]);

  async function send() {
    if (!reply.trim() || !ticketId) return;
    setSending(true);
    const { error } = await supabase.from("support_messages").insert({
      ticket_id: ticketId,
      author_id: userId,
      author_type: "cliente",
      body: reply.trim(),
    });
    setSending(false);
    if (error) {
      toast.error("Falha ao enviar a mensagem.");
      return;
    }
    setReply("");
  }

  async function markResolved() {
    if (!ticketId) return;
    const { error } = await supabase
      .from("support_tickets")
      .update({ status: "resolvido" })
      .eq("id", ticketId);
    if (error) return toast.error("Não foi possível atualizar.");
    toast.success("Chamado marcado como resolvido.");
  }

  const t = ticketQuery.data;

  return (
    <Sheet open={!!ticketId} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="flex items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">
              #{t?.ticket_number ?? "—"}
            </span>
            <span className="truncate">{t?.subject ?? "Chamado"}</span>
          </SheetTitle>
          {t && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <Badge className={STATUS_COLOR[t.status]}>{STATUS_LABEL[t.status]}</Badge>
              <span className="text-muted-foreground">
                {CATEGORY_OPTIONS.find((c) => c.value === t.category)?.label}
              </span>
              <span className="text-muted-foreground">· Prioridade {t.priority}</span>
            </div>
          )}
        </SheetHeader>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
          {messagesQuery.isLoading ? (
            <div className="text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : (
            (messagesQuery.data ?? []).map((m) => (
              <div
                key={m.id}
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  m.author_type === "cliente"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                <div className="whitespace-pre-wrap break-words">{m.body}</div>
                <div className={`mt-1 text-[10px] ${m.author_type === "cliente" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {m.author_type === "cliente" ? "Você" : "Suporte Localix"} ·{" "}
                  {new Date(m.created_at).toLocaleString("pt-BR")}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t p-3 space-y-2">
          <div className="flex gap-2">
            <Textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Escreva uma mensagem…"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
              }}
            />
            <Button onClick={send} disabled={sending || !reply.trim()} size="icon" className="h-auto">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          {t && t.status !== "resolvido" && t.status !== "fechado" && (
            <Button variant="outline" size="sm" onClick={markResolved} className="w-full">
              Marcar como resolvido
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
