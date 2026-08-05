import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  FileText,
  MessageSquare,
  NotebookPen,
  RefreshCcw,
  Send,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  assignSupportTicket,
  getAdminSupportTicket,
  listSupportQuickReplies,
  listSupportTeam,
  sendSupportMessage,
  suggestSupportArticles,
  takeSupportTicket,
  updateSupportTicketMeta,
  updateSupportTicketStatus,
} from "@/lib/support-admin.functions";
import { CATEGORY_LABEL, PRIORITY_LABEL, STATUS_LABEL, SUPPORT_CATEGORIES, SUPPORT_PRIORITIES, type LegacySupportStatus, type SupportCategory, type SupportPriority } from "@/lib/support-admin";
import { renderQuickReply, sanitizeSupportText } from "@/lib/support-operations";
import type { ReactNode } from "react";

export const Route = createFileRoute("/admin/support/$ticketId")({
  head: () => ({ meta: [{ title: "Admin - Detalhe do suporte" }] }),
  component: SupportTicketDetailPage,
});

function SupportTicketDetailPage() {
  const { ticketId } = Route.useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const detailFn = useServerFn(getAdminSupportTicket);
  const teamFn = useServerFn(listSupportTeam);
  const quickRepliesFn = useServerFn(listSupportQuickReplies);
  const suggestArticlesFn = useServerFn(suggestSupportArticles);
  const takeFn = useServerFn(takeSupportTicket);
  const assignFn = useServerFn(assignSupportTicket);
  const metaFn = useServerFn(updateSupportTicketMeta);
  const statusFn = useServerFn(updateSupportTicketStatus);
  const sendFn = useServerFn(sendSupportMessage);
  const [reply, setReply] = useState("");
  const [note, setNote] = useState("");

  const detail = useQuery({
    queryKey: ["admin-support-ticket", ticketId],
    queryFn: () => detailFn({ data: { ticketId } }),
  });
  const team = useQuery({ queryKey: ["admin-support-team"], queryFn: () => teamFn(), retry: false });
  const quickReplies = useQuery({ queryKey: ["support-quick-replies"], queryFn: () => quickRepliesFn(), retry: false });

  useEffect(() => {
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ["admin-support-ticket", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["admin-support-queue"] });
    };
    const channel = supabase
      .channel(`admin-support-ticket-${ticketId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets", filter: `id=eq.${ticketId}` }, invalidate)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages", filter: `ticket_id=eq.${ticketId}` }, invalidate)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, ticketId]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-support-ticket", ticketId] });
    queryClient.invalidateQueries({ queryKey: ["admin-support-queue"] });
  };

  const take = useMutation({
    mutationFn: () => takeFn({ data: { ticketId } }),
    onSuccess: () => {
      toast.success("Chamado assumido");
      invalidate();
    },
    onError: (error: any) => toast.error(error?.message ?? "Falha ao assumir"),
  });
  const assign = useMutation({
    mutationFn: (assigneeId: string | null) => assignFn({ data: { ticketId, assigneeId } }),
    onSuccess: () => {
      toast.success("Responsavel atualizado");
      invalidate();
    },
    onError: (error: any) => toast.error(error?.message ?? "Falha ao atribuir"),
  });
  const updateMeta = useMutation({
    mutationFn: (data: { priority?: SupportPriority; category?: SupportCategory }) => metaFn({ data: { ticketId, ...data } }),
    onSuccess: invalidate,
    onError: (error: any) => toast.error(error?.message ?? "Falha ao atualizar"),
  });
  const updateStatus = useMutation({
    mutationFn: (status: LegacySupportStatus) => statusFn({ data: { ticketId, status } }),
    onSuccess: invalidate,
    onError: (error: any) => toast.error(error?.message ?? "Falha ao mudar status"),
  });
  const sendReply = useMutation({
    mutationFn: (body: string) => sendFn({ data: { ticketId, body } }),
    onSuccess: () => {
      setReply("");
      toast.success("Resposta enviada");
      invalidate();
    },
    onError: (error: any) => toast.error(error?.message ?? "Falha ao enviar resposta"),
  });
  const sendNote = useMutation({
    mutationFn: (body: string) => sendFn({ data: { ticketId, body, internalNote: true } }),
    onSuccess: () => {
      setNote("");
      toast.success("Nota interna registrada");
      invalidate();
    },
    onError: (error: any) => toast.error(error?.message ?? "Falha ao registrar nota"),
  });

  const ticket = detail.data?.ticket;
  const messages = detail.data?.messages ?? [];
  const articleQueryText = useMemo(
    () => [ticket?.subject, messages.filter((message) => !message.internal_note).at(-1)?.body].filter(Boolean).join(" "),
    [messages, ticket?.subject],
  );
  const articleSuggestions = useQuery({
    queryKey: ["admin-support-article-suggestions", ticketId, articleQueryText],
    enabled: Boolean(ticket && articleQueryText.trim().length >= 3),
    queryFn: () => suggestArticlesFn({ data: { query: articleQueryText, limit: 4 } }),
    retry: false,
  });
  const firstResponse = useMemo(() => durationLabel(ticket?.created_at, ticket?.first_response_at), [ticket]);
  const totalTime = useMemo(() => durationLabel(ticket?.created_at, ticket?.resolved_at ?? ticket?.closed_at ?? new Date().toISOString()), [ticket]);

  if (detail.isLoading || !ticket) {
    return <div className="p-8 text-center text-sm text-slate-400">Carregando chamado...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/admin/support" className="mb-2 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-100">
            <ArrowLeft className="h-4 w-4" />
            Voltar para fila
          </Link>
          <h1 className="text-2xl font-bold">
            #{ticket.ticket_number ?? "-"} {ticket.subject}
          </h1>
          <p className="text-sm text-slate-400">{ticket.restaurant_name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" className="gap-2" onClick={() => take.mutate()} disabled={take.isPending}>
            <UserPlus className="h-4 w-4" />
            Assumir
          </Button>
          <Button variant="outline" className="gap-2 border-slate-700 text-slate-200" onClick={() => updateStatus.mutate("respondido")}>
            <Clock className="h-4 w-4" />
            Aguardando cliente
          </Button>
          <Button variant="outline" className="gap-2 border-slate-700 text-slate-200" onClick={() => updateStatus.mutate("em_analise")}>
            <RefreshCcw className="h-4 w-4" />
            Aguardando suporte
          </Button>
          <Button className="gap-2" onClick={() => updateStatus.mutate("resolvido")}>
            <CheckCircle2 className="h-4 w-4" />
            Resolver
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Card className="border-slate-800 bg-slate-900 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-100">
              <MessageSquare className="h-4 w-4" />
              Conversa
            </div>
            <div className="max-h-[560px] space-y-3 overflow-y-auto pr-1">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.internal_note ? "justify-center" : message.author_type === "suporte" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[78%] rounded-lg border px-3 py-2 text-sm ${
                      message.internal_note
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
                        : message.author_type === "suporte"
                          ? "border-primary/30 bg-primary/20 text-slate-50"
                          : "border-slate-700 bg-slate-800 text-slate-100"
                    }`}
                  >
                    <div className="mb-1 text-xs font-medium text-slate-400">
                      {message.internal_note ? "Nota interna" : message.author_type === "suporte" ? "Equipe Localix" : "Estabelecimento"} -{" "}
                      {new Date(message.created_at).toLocaleString("pt-BR")}
                    </div>
                    <div className="whitespace-pre-wrap break-words">{message.body}</div>
                    {message.attachments.length > 0 && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-slate-400">
                        <FileText className="h-3 w-3" />
                        {message.attachments.length} anexo(s)
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="border-slate-800 bg-slate-900 p-4">
            <div className="mb-2 text-sm font-semibold text-slate-100">Responder ao estabelecimento</div>
            {(quickReplies.data ?? []).length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {(quickReplies.data ?? [])
                  .filter((item: any) => !item.category || item.category === ticket.category)
                  .map((item: any) => (
                    <Button
                      key={item.id}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-slate-700 text-slate-200"
                      onClick={() =>
                        setReply(
                          renderQuickReply(item.body, {
                            restaurantName: ticket.restaurant_name,
                            ticketNumber: ticket.ticket_number ?? "-",
                            agentName: ticket.assignee_label ?? user?.email ?? "Equipe Localix",
                          }),
                        )
                      }
                    >
                      {item.title}
                    </Button>
                  ))}
              </div>
            )}
            <div className="flex gap-2">
              <Textarea
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                rows={3}
                placeholder="Escreva a resposta..."
                className="border-slate-700 bg-slate-950 text-slate-100"
              />
              <Button size="icon" className="h-auto w-12" disabled={!reply.trim() || sendReply.isPending} onClick={() => sendReply.mutate(reply)}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </Card>

          <Card className="border-amber-500/30 bg-amber-500/10 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-100">
              <NotebookPen className="h-4 w-4" />
              Nota interna
            </div>
            <div className="flex gap-2">
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                placeholder="Visivel somente para equipe Localix"
                className="border-amber-500/30 bg-slate-950 text-slate-100"
              />
              <Button variant="secondary" size="icon" className="h-auto w-12" disabled={!note.trim() || sendNote.isPending} onClick={() => sendNote.mutate(note)}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="border-slate-800 bg-slate-900 p-4">
            <div className="mb-3 text-sm font-semibold text-slate-100">Resumo</div>
            <Info label="Status" value={STATUS_LABEL[ticket.status]} />
            <Info label="Prioridade" value={PRIORITY_LABEL[ticket.priority]} />
            <Info label="Categoria" value={CATEGORY_LABEL[ticket.category]} />
            <Info label="Responsavel" value={ticket.assignee_label ?? "Nao atribuido"} />
            <Info label="Abertura" value={new Date(ticket.created_at).toLocaleString("pt-BR")} />
            <Info label="Primeira resposta" value={firstResponse} />
            <Info label="Tempo total" value={totalTime} />
            <Info label="SLA" value={ticket.sla_due_at ? new Date(ticket.sla_due_at).toLocaleString("pt-BR") : "Sem SLA"} />
          </Card>

          <Card className="border-slate-800 bg-slate-900 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-100">
              <BookOpen className="h-4 w-4" />
              Artigos sugeridos
            </div>
            <div className="space-y-2">
              {(articleSuggestions.data ?? []).length === 0 ? (
                <div className="text-sm text-slate-400">Sem sugestoes publicadas para este assunto.</div>
              ) : (
                (articleSuggestions.data ?? []).map((article: any) => (
                  <div key={article.id} className="rounded-md border border-slate-800 bg-slate-950 p-3">
                    <div className="text-sm font-medium text-slate-100">{article.title}</div>
                    <div className="mt-1 line-clamp-2 text-xs text-slate-400">{sanitizeSupportText(article.content, 180)}</div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 border-slate-700 text-slate-200"
                      onClick={() => sendReply.mutate(`Artigo recomendado: ${article.title}\n\n${sanitizeSupportText(article.content, 700)}`)}
                    >
                      Compartilhar
                    </Button>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="border-slate-800 bg-slate-900 p-4">
            <div className="mb-3 text-sm font-semibold text-slate-100">Acoes</div>
            <div className="space-y-3">
              <Field label="Atribuir atendente">
                <Select value={ticket.assigned_to ?? "none"} onValueChange={(value) => assign.mutate(value === "none" ? null : value)}>
                  <SelectTrigger className="border-slate-700 bg-slate-950 text-slate-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nao atribuido</SelectItem>
                    {(team.data ?? []).map((member) => (
                      <SelectItem key={member.user_id} value={member.user_id}>
                        {member.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Prioridade">
                <Select value={ticket.priority} onValueChange={(value) => updateMeta.mutate({ priority: value as SupportPriority })}>
                  <SelectTrigger className="border-slate-700 bg-slate-950 text-slate-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORT_PRIORITIES.map((priority) => (
                      <SelectItem key={priority} value={priority}>{PRIORITY_LABEL[priority]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Categoria">
                <Select value={ticket.category} onValueChange={(value) => updateMeta.mutate({ category: value as SupportCategory })}>
                  <SelectTrigger className="border-slate-700 bg-slate-950 text-slate-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORT_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>{CATEGORY_LABEL[category]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="border-slate-700 text-slate-200" onClick={() => updateStatus.mutate("aberto")}>Reabrir</Button>
                <Button variant="outline" className="border-slate-700 text-slate-200" onClick={() => updateStatus.mutate("fechado")}>Fechar</Button>
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-800 py-2 text-sm last:border-0">
      <span className="text-slate-400">{label}</span>
      <span className="text-right text-slate-100">{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function durationLabel(from?: string | null, to?: string | null) {
  if (!from || !to) return "Pendente";
  const minutes = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}min` : `${hours}h`;
}
