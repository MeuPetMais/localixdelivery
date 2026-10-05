import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, LogOut, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

type Lead = {
  id: string;
  business_name: string;
  contact_name: string;
  phone: string;
  segment: string | null;
  city: string | null;
  neighborhood: string | null;
  source: string;
  utm_campaign: string | null;
  creative_code: string | null;
  status: string;
  assigned_to: string | null;
  fit_score: number | null;
  lead_class: string | null;
  estimated_monthly_orders: number | null;
  current_channels: string[] | null;
  is_decision_maker: boolean | null;
  has_own_customer_base: boolean | null;
  main_pain: string | null;
  next_action_at: string | null;
  loss_reason: string | null;
};

type Activity = {
  id: string;
  lead_id: string;
  activity_type: string;
  note: string;
  occurred_at: string;
  created_at: string;
};

type Draft = {
  businessName: string;
  contactName: string;
  phone: string;
  segment: string;
  city: string;
  neighborhood: string;
  estimatedMonthlyOrders: string;
  mainPain: string;
};

const emptyDraft: Draft = {
  businessName: "",
  contactName: "",
  phone: "",
  segment: "",
  city: "",
  neighborhood: "",
  estimatedMonthlyOrders: "",
  mainPain: "",
};

export const Route = createFileRoute("/comercial")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({
        to: "/auth",
        search: { mode: undefined } as { mode: string | undefined },
      });
    }

    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);

    if (rolesError) {
      throw redirect({
        to: "/auth",
        search: { mode: undefined } as { mode: string | undefined },
      });
    }

    const allowed = (roles ?? []).some((row) => row.role === "comercial" || row.role === "admin");
    if (!allowed) throw redirect({ to: "/dashboard" });

    return { user: data.user };
  },
  component: CommercialPage,
});

function CommercialPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activityNote, setActivityNote] = useState("");
  const [activityType, setActivityType] = useState("note");
  const [nextActionDraft, setNextActionDraft] = useState("");
  const [lossReasonDraft, setLossReasonDraft] = useState("");
  const [qualificationOrdersDraft, setQualificationOrdersDraft] = useState("");
  const [decisionMakerDraft, setDecisionMakerDraft] = useState("unknown");
  const [ownBaseDraft, setOwnBaseDraft] = useState("unknown");
  const [channelsDraft, setChannelsDraft] = useState("");

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setError(null);

    // partner_leads is a new Staging table and is not in the generated client types yet.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const leadsTable = supabase.from("partner_leads" as any);
    const { data, error: queryError } = await leadsTable
      .select(
        "id,business_name,contact_name,phone,segment,city,neighborhood,source,utm_campaign,creative_code,status,assigned_to,fit_score,lead_class,estimated_monthly_orders,current_channels,is_decision_maker,has_own_customer_base,main_pain,next_action_at,loss_reason",
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (queryError) {
      setError("Nao foi possivel carregar sua carteira de leads.");
    } else {
      setLeads((data ?? []) as Lead[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  const inboxLeads = useMemo(() => leads.filter((lead) => !lead.assigned_to), [leads]);
  const myLeads = useMemo(
    () => leads.filter((lead) => lead.assigned_to === user.id),
    [leads, user.id],
  );

  const agenda = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const terminalStatuses = new Set(["converted", "lost", "disqualified"]);

    const active = myLeads.filter((lead) => !terminalStatuses.has(lead.status));
    const overdue = active
      .filter((lead) => lead.next_action_at && new Date(lead.next_action_at) < now)
      .sort(compareNextAction);
    const today = active
      .filter((lead) => {
        if (!lead.next_action_at) return false;
        const actionAt = new Date(lead.next_action_at);
        return actionAt >= now && actionAt <= endOfToday;
      })
      .sort(compareNextAction);
    const upcoming = active
      .filter((lead) => lead.next_action_at && new Date(lead.next_action_at) > endOfToday)
      .sort(compareNextAction);
    const unscheduled = active.filter((lead) => !lead.next_action_at);

    return { overdue, today, upcoming, unscheduled };
  }, [myLeads]);

  const orderedMyLeads = useMemo(
    () => [
      ...agenda.overdue,
      ...agenda.today,
      ...agenda.upcoming,
      ...agenda.unscheduled,
      ...myLeads.filter((lead) => ["converted", "lost", "disqualified"].includes(lead.status)),
    ],
    [agenda, myLeads],
  );

  const totals = useMemo(
    () => ({
      all: myLeads.length,
      inbox: inboxLeads.length,
      qualified: myLeads.filter((lead) => lead.status === "qualified").length,
      demos: myLeads.filter(
        (lead) => lead.status === "demo_scheduled" || lead.status === "demo_completed",
      ).length,
    }),
    [myLeads, inboxLeads],
  );

  async function submitLead(event: React.FormEvent) {
    event.preventDefault();

    const businessName = draft.businessName.trim();
    const contactName = draft.contactName.trim();
    const phone = draft.phone.replace(/\D/g, "");

    if (
      businessName.length < 2 ||
      contactName.length < 2 ||
      phone.length < 10 ||
      phone.length > 15
    ) {
      toast.error("Revise nome do estabelecimento, contato e telefone.");
      return;
    }

    setSaving(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      setSaving(false);
      toast.error("Sua sessao expirou. Entre novamente.");
      return;
    }

    const externalRef = `manual-${user.id}-${crypto.randomUUID()}`;
    const { data, error: invokeError } = await supabase.functions.invoke("partner-lead-capture", {
      headers: { Authorization: `Bearer ${accessToken}` },
      body: {
        business_name: businessName,
        contact_name: contactName,
        phone,
        segment: draft.segment.trim() || null,
        city: draft.city.trim() || null,
        neighborhood: draft.neighborhood.trim() || null,
        estimated_monthly_orders: draft.estimatedMonthlyOrders
          ? Number(draft.estimatedMonthlyOrders)
          : null,
        main_pain: draft.mainPain.trim() || null,
        source: "manual",
        medium: "commercial_panel",
        external_ref: externalRef,
      },
    });
    setSaving(false);

    if (invokeError || !data?.ok) {
      const technicalMessage =
        invokeError?.message ||
        (typeof data?.error === "string" ? data.error : null) ||
        "Resposta invalida da funcao de captura.";
      void technicalMessage;
      toast.error("Nao foi possivel cadastrar o lead. Tente novamente.");
      return;
    }

    toast.success("Lead cadastrado.");
    setDraft(emptyDraft);
    await loadLeads();
  }

  async function claimLead(leadId: string) {
    setSaving(true);
    // RPC is versioned in the database but not yet in generated client types.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: claimError } = await (supabase.rpc as any)("claim_partner_lead", {
      _lead_id: leadId,
    });
    setSaving(false);
    if (claimError) {
      toast.error("Nao foi possivel assumir este lead.");
      return;
    }
    toast.success("Lead adicionado a sua carteira.");
    await loadLeads();
  }

  async function updateLead(
    leadId: string,
    patch: {
      status?: string;
      fit_score?: number | null;
      lead_class?: string | null;
      next_action_at?: string | null;
      loss_reason?: string | null;
      estimated_monthly_orders?: number | null;
      current_channels?: string[] | null;
      is_decision_maker?: boolean | null;
      has_own_customer_base?: boolean | null;
    },
  ) {
    setSaving(true);
    // partner_leads is not in generated client types yet.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const leadsTable = supabase.from("partner_leads" as any);
    const { error: updateError } = await leadsTable.eq("id", leadId).update(patch);
    setSaving(false);
    if (updateError) {
      toast.error("Nao foi possivel atualizar o lead.");
      return;
    }
    toast.success("Lead atualizado.");
    await loadLeads();
  }

  async function openLead(leadId: string) {
    const lead = leads.find((item) => item.id === leadId);
    setNextActionDraft(toDatetimeLocalValue(lead?.next_action_at ?? null));
    setLossReasonDraft(lead?.loss_reason ?? "");
    setQualificationOrdersDraft(
      lead?.estimated_monthly_orders == null ? "" : String(lead.estimated_monthly_orders),
    );
    setDecisionMakerDraft(
      lead?.is_decision_maker == null ? "unknown" : lead.is_decision_maker ? "yes" : "no",
    );
    setOwnBaseDraft(
      lead?.has_own_customer_base == null ? "unknown" : lead.has_own_customer_base ? "yes" : "no",
    );
    setChannelsDraft((lead?.current_channels ?? []).join(", "));
    setSelectedLeadId(leadId);
    // New CRM table is not in generated client types yet.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const activitiesTable = supabase.from("partner_lead_activities" as any);
    const { data, error: activitiesError } = await activitiesTable
      .select("id,lead_id,activity_type,note,occurred_at,created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (activitiesError) {
      toast.error("Nao foi possivel carregar o historico.");
      return;
    }
    setActivities((data ?? []) as Activity[]);
  }

  async function saveNextAction() {
    if (!selectedLeadId) return;
    const nextActionAt = nextActionDraft ? new Date(nextActionDraft).toISOString() : null;
    await updateLead(selectedLeadId, { next_action_at: nextActionAt });
  }

  async function saveQualification() {
    if (!selectedLeadId) return;
    const orders = qualificationOrdersDraft.trim() === "" ? null : Number(qualificationOrdersDraft);
    if (orders != null && (!Number.isInteger(orders) || orders < 0)) {
      toast.error("Informe uma estimativa valida de pedidos por mes.");
      return;
    }

    const channels = channelsDraft
      .split(",")
      .map((channel) => channel.trim())
      .filter(Boolean);

    await updateLead(selectedLeadId, {
      estimated_monthly_orders: orders,
      is_decision_maker: decisionMakerDraft === "unknown" ? null : decisionMakerDraft === "yes",
      has_own_customer_base: ownBaseDraft === "unknown" ? null : ownBaseDraft === "yes",
      current_channels: channels.length > 0 ? channels : null,
    });
  }

  async function saveLossReason() {
    if (!selectedLeadId) return;
    const lead = leads.find((item) => item.id === selectedLeadId);
    if (!lead || !["lost", "disqualified"].includes(lead.status)) return;
    const reason = lossReasonDraft.trim();
    if (!reason) {
      toast.error("Informe o motivo antes de salvar.");
      return;
    }
    await updateLead(selectedLeadId, { loss_reason: reason });
  }

  async function addActivity() {
    if (!selectedLeadId || !activityNote.trim()) return;
    setSaving(true);
    // New CRM table is not in generated client types yet.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const activitiesTable = supabase.from("partner_lead_activities" as any);
    const { error: activityError } = await activitiesTable.insert({
      lead_id: selectedLeadId,
      activity_type: activityType,
      note: activityNote.trim(),
      created_by: user.id,
    });
    setSaving(false);
    if (activityError) {
      toast.error("Nao foi possivel registrar a atividade.");
      return;
    }
    setActivityNote("");
    toast.success("Atividade registrada.");
    await openLead(selectedLeadId);
  }

  async function logout() {
    await supabase.auth.signOut();
    navigate({
      to: "/auth",
      replace: true,
      search: { mode: undefined } as { mode: string | undefined },
    });
  }

  return (
    <div className="min-h-screen bg-background">
      <style>{`nav[aria-label="Navegação principal"], button[aria-label="Notificações"] { display: none !important; }`}</style>
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Localix Delivery
            </p>
            <h1 className="text-xl font-bold">Painel Comercial</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <div className="grid gap-3 sm:grid-cols-4">
          <Metric label="Caixa de entrada" value={totals.inbox} />
          <Metric label="Minha carteira" value={totals.all} />
          <Metric label="Qualificados" value={totals.qualified} />
          <Metric label="Demos" value={totals.demos} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Agenda comercial</CardTitle>
            <p className="text-sm text-muted-foreground">
              Priorize primeiro as acoes vencidas e as previstas para hoje.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <AgendaMetric label="Vencidas" value={agenda.overdue.length} />
              <AgendaMetric label="Hoje" value={agenda.today.length} />
              <AgendaMetric label="Proximas" value={agenda.upcoming.length} />
            </div>
            {agenda.overdue.length === 0 && agenda.today.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma acao vencida ou prevista para hoje.
              </p>
            ) : (
              <div className="space-y-2">
                {[...agenda.overdue, ...agenda.today].slice(0, 6).map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-md border p-3 text-left hover:bg-muted/40"
                    onClick={() => openLead(lead.id)}
                  >
                    <div>
                      <div className="font-medium">{lead.business_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {lead.contact_name} · {statusLabel(lead.status)}
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      <div
                        className={
                          nextActionKind(lead.next_action_at) === "overdue"
                            ? "font-semibold text-destructive"
                            : "font-semibold"
                        }
                      >
                        {nextActionLabel(lead.next_action_at)}
                      </div>
                      <div className="text-muted-foreground">
                        {lead.next_action_at
                          ? new Date(lead.next_action_at).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Caixa de entrada</CardTitle>
            <p className="text-sm text-muted-foreground">
              Leads de campanhas e canais publicos ainda sem responsavel.
            </p>
          </CardHeader>
          <CardContent>
            {inboxLeads.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum lead aguardando atendimento.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {inboxLeads.map((lead) => (
                  <div key={lead.id} className="rounded-lg border p-4">
                    <div className="font-semibold">{lead.business_name}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {lead.contact_name} · {lead.phone}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {lead.source} · {lead.creative_code ?? lead.utm_campaign ?? "sem campanha"}
                    </div>
                    <Button
                      className="mt-3 w-full"
                      size="sm"
                      disabled={saving}
                      onClick={() => claimLead(lead.id)}
                    >
                      Assumir lead
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Novo lead
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitLead} className="space-y-3">
                <Field label="Estabelecimento *">
                  <Input
                    required
                    minLength={2}
                    value={draft.businessName}
                    onChange={(event) => setDraft({ ...draft, businessName: event.target.value })}
                  />
                </Field>
                <Field label="Contato *">
                  <Input
                    required
                    minLength={2}
                    value={draft.contactName}
                    onChange={(event) => setDraft({ ...draft, contactName: event.target.value })}
                  />
                </Field>
                <Field label="Telefone / WhatsApp *">
                  <Input
                    required
                    inputMode="tel"
                    value={draft.phone}
                    onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
                  />
                </Field>
                <Field label="Segmento">
                  <Input
                    placeholder="Pizzaria, hamburgueria..."
                    value={draft.segment}
                    onChange={(event) => setDraft({ ...draft, segment: event.target.value })}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Cidade">
                    <Input
                      value={draft.city}
                      onChange={(event) => setDraft({ ...draft, city: event.target.value })}
                    />
                  </Field>
                  <Field label="Bairro">
                    <Input
                      value={draft.neighborhood}
                      onChange={(event) => setDraft({ ...draft, neighborhood: event.target.value })}
                    />
                  </Field>
                </div>
                <Field label="Pedidos estimados / mes">
                  <Input
                    type="number"
                    min={0}
                    value={draft.estimatedMonthlyOrders}
                    onChange={(event) =>
                      setDraft({ ...draft, estimatedMonthlyOrders: event.target.value })
                    }
                  />
                </Field>
                <Field label="Principal dor">
                  <Textarea
                    value={draft.mainPain}
                    onChange={(event) => setDraft({ ...draft, mainPain: event.target.value })}
                  />
                </Field>
                <Button className="w-full" disabled={saving}>
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  {saving ? "Salvando..." : "Cadastrar lead"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Minha carteira</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Leads atribuidos ao seu usuario.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={loadLeads} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {error && <p className="px-6 pb-6 text-sm text-destructive">{error}</p>}
              {loading && (
                <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
              )}
              {!loading && !error && myLeads.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Nenhum lead na sua carteira.
                </div>
              )}
              {!loading && myLeads.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-y bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Estabelecimento</th>
                        <th className="px-4 py-3">Contato</th>
                        <th className="px-4 py-3">Origem</th>
                        <th className="px-4 py-3">Proxima acao</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Fit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderedMyLeads.map((lead) => (
                        <tr key={lead.id} className="border-b last:border-0">
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              className="font-medium underline-offset-4 hover:underline"
                              onClick={() => openLead(lead.id)}
                            >
                              {lead.business_name}
                            </button>
                            <div className="text-xs text-muted-foreground">
                              {[lead.segment, lead.neighborhood, lead.city]
                                .filter(Boolean)
                                .join(" · ") || "—"}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div>{lead.contact_name}</div>
                            <div className="text-xs text-muted-foreground">{lead.phone}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div>{lead.source}</div>
                            <div className="text-xs text-muted-foreground">
                              {lead.creative_code ?? lead.utm_campaign ?? "—"}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {lead.next_action_at ? (
                              <div>
                                <div
                                  className={
                                    nextActionKind(lead.next_action_at) === "overdue"
                                      ? "font-semibold text-destructive"
                                      : "font-medium"
                                  }
                                >
                                  {nextActionLabel(lead.next_action_at)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {new Date(lead.next_action_at).toLocaleString("pt-BR")}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Nao agendada</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <select
                              className="rounded-md border bg-background px-2 py-1 text-xs"
                              value={lead.status}
                              disabled={saving || lead.status === "converted"}
                              onChange={(event) =>
                                updateLead(lead.id, { status: event.target.value })
                              }
                            >
                              {[
                                "new",
                                "contacted",
                                "qualifying",
                                "qualified",
                                "demo_scheduled",
                                "demo_completed",
                                "negotiating",
                                "signed",
                                "onboarding",
                                "nurture",
                                "disqualified",
                                "lost",
                              ].map((status) => (
                                <option key={status} value={status}>
                                  {statusLabel(status)}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Input
                                className="h-8 w-20"
                                type="number"
                                min={0}
                                max={100}
                                value={lead.fit_score ?? ""}
                                disabled={saving || lead.status === "converted"}
                                onChange={(event) => {
                                  const score =
                                    event.target.value === "" ? null : Number(event.target.value);
                                  const leadClass =
                                    score == null
                                      ? null
                                      : score >= 70
                                        ? "A"
                                        : score >= 50
                                          ? "B"
                                          : "C";
                                  setLeads((current) =>
                                    current.map((item) =>
                                      item.id === lead.id
                                        ? { ...item, fit_score: score, lead_class: leadClass }
                                        : item,
                                    ),
                                  );
                                }}
                                onBlur={() =>
                                  updateLead(lead.id, {
                                    fit_score: lead.fit_score,
                                    lead_class: lead.lead_class,
                                  })
                                }
                              />
                              <span className="font-semibold">{lead.lead_class ?? "—"}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        {selectedLeadId &&
          (() => {
            const lead = myLeads.find((item) => item.id === selectedLeadId);
            if (!lead) return null;
            return (
              <Dialog open onOpenChange={(open) => !open && setSelectedLeadId(null)}>
                <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto p-0">
                  <Card className="border-0 shadow-none">
                    <CardHeader>
                      <CardTitle>Ficha comercial · {lead.business_name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {lead.contact_name} · {lead.phone} ·{" "}
                        {lead.segment ?? "Segmento nao informado"}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div>
                          <span className="text-xs text-muted-foreground">Pedidos estimados</span>
                          <p>{lead.estimated_monthly_orders ?? "—"}</p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Principal dor</span>
                          <p>{lead.main_pain ?? "—"}</p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Proxima acao</span>
                          <p>
                            {lead.next_action_at
                              ? new Date(lead.next_action_at).toLocaleString("pt-BR")
                              : "—"}
                          </p>
                        </div>
                      </div>
                      <div className="rounded-md border p-3">
                        <h3 className="mb-3 font-semibold">Qualificacao objetiva</h3>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <Field label="Pedidos estimados / mes">
                            <Input
                              type="number"
                              min={0}
                              value={qualificationOrdersDraft}
                              disabled={saving || lead.status === "converted"}
                              onChange={(event) => setQualificationOrdersDraft(event.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                              Pontuacao por volume:{" "}
                              <span className="font-semibold text-foreground">
                                {volumeFitPoints(
                                  qualificationOrdersDraft.trim() === ""
                                    ? null
                                    : Number(qualificationOrdersDraft),
                                )}
                                /25
                              </span>
                            </p>
                          </Field>
                          <Field label="Contato e decisor?">
                            <select
                              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                              value={decisionMakerDraft}
                              disabled={saving || lead.status === "converted"}
                              onChange={(event) => setDecisionMakerDraft(event.target.value)}
                            >
                              <option value="unknown">Nao confirmado</option>
                              <option value="yes">Sim</option>
                              <option value="no">Nao</option>
                            </select>
                            <p className="text-xs text-muted-foreground">
                              Pontuacao por decisor:{" "}
                              <span className="font-semibold text-foreground">
                                {decisionMakerFitPoints(decisionMakerDraft)}/15
                              </span>
                            </p>
                          </Field>
                          <Field label="Base propria / WhatsApp?">
                            <select
                              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                              value={ownBaseDraft}
                              disabled={saving || lead.status === "converted"}
                              onChange={(event) => setOwnBaseDraft(event.target.value)}
                            >
                              <option value="unknown">Nao confirmado</option>
                              <option value="yes">Sim</option>
                              <option value="no">Nao</option>
                            </select>
                            <p className="text-xs text-muted-foreground">
                              Pontuacao por base propria:{" "}
                              <span className="font-semibold text-foreground">
                                {ownBaseFitPoints(ownBaseDraft)}/15
                              </span>
                            </p>
                          </Field>
                          <Field label="Canais atuais">
                            <Input
                              value={channelsDraft}
                              disabled={saving || lead.status === "converted"}
                              onChange={(event) => setChannelsDraft(event.target.value)}
                              placeholder="WhatsApp, Instagram, iFood..."
                            />
                          </Field>
                        </div>
                        <div className="mt-3 flex justify-end">
                          <Button
                            disabled={saving || lead.status === "converted"}
                            onClick={saveQualification}
                          >
                            Salvar qualificacao
                          </Button>
                        </div>
                        <div className="mt-3 rounded-md bg-muted/40 p-3 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span>Pontuacao parcial formalizada</span>
                            <span className="font-semibold">
                              {volumeFitPoints(
                                qualificationOrdersDraft.trim() === ""
                                  ? null
                                  : Number(qualificationOrdersDraft),
                              ) +
                                decisionMakerFitPoints(decisionMakerDraft) +
                                ownBaseFitPoints(ownBaseDraft)}
                              /55
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Soma volume, decisor e base propria/WhatsApp. O Fit Score total
                            permanece manual ate os demais criterios serem formalizados.
                          </p>
                        </div>
                      </div>
                      <div className="rounded-md border p-3">
                        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                          <Field label="Agendar proxima acao">
                            <Input
                              type="datetime-local"
                              value={nextActionDraft}
                              disabled={saving || lead.status === "converted"}
                              onChange={(event) => setNextActionDraft(event.target.value)}
                            />
                          </Field>
                          <Button
                            disabled={saving || lead.status === "converted"}
                            onClick={saveNextAction}
                          >
                            Salvar agenda
                          </Button>
                          <Button
                            variant="outline"
                            disabled={saving || lead.status === "converted" || !lead.next_action_at}
                            onClick={() => {
                              setNextActionDraft("");
                              void updateLead(lead.id, { next_action_at: null });
                            }}
                          >
                            Limpar
                          </Button>
                        </div>
                      </div>
                      {["lost", "disqualified"].includes(lead.status) && (
                        <div className="rounded-md border p-3">
                          <Field
                            label={
                              lead.status === "lost"
                                ? "Motivo da perda"
                                : "Motivo da desqualificacao"
                            }
                          >
                            <Textarea
                              value={lossReasonDraft}
                              onChange={(event) => setLossReasonDraft(event.target.value)}
                              placeholder="Registre por que este lead foi encerrado..."
                              maxLength={1000}
                              disabled={saving}
                            />
                          </Field>
                          <div className="mt-3 flex justify-end">
                            <Button
                              disabled={saving || !lossReasonDraft.trim()}
                              onClick={saveLossReason}
                            >
                              Salvar motivo
                            </Button>
                          </div>
                        </div>
                      )}
                      <div className="grid gap-3 sm:grid-cols-[160px_1fr_auto]">
                        <select
                          className="rounded-md border bg-background px-3 py-2 text-sm"
                          value={activityType}
                          onChange={(event) => setActivityType(event.target.value)}
                        >
                          <option value="note">Observacao</option>
                          <option value="contact">Contato</option>
                          <option value="demo">Demonstracao</option>
                          <option value="follow_up">Follow-up</option>
                        </select>
                        <Input
                          value={activityNote}
                          onChange={(event) => setActivityNote(event.target.value)}
                          placeholder="Registre o que aconteceu e o proximo contexto..."
                          maxLength={2000}
                        />
                        <Button disabled={saving || !activityNote.trim()} onClick={addActivity}>
                          Registrar
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <h3 className="font-semibold">Historico</h3>
                        {activities.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            Nenhuma atividade registrada.
                          </p>
                        ) : (
                          activities.map((activity) => (
                            <div key={activity.id} className="rounded-md border p-3">
                              <div className="flex justify-between gap-3 text-xs text-muted-foreground">
                                <span>{activityTypeLabel(activity.activity_type)}</span>
                                <span>
                                  {new Date(activity.occurred_at).toLocaleString("pt-BR")}
                                </span>
                              </div>
                              <p className="mt-1 text-sm">{activity.note}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </DialogContent>
              </Dialog>
            );
          })()}
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function AgendaMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function statusLabel(status: string) {
  return (
    (
      {
        new: "Novo",
        contacted: "Contato iniciado",
        qualifying: "Em qualificacao",
        qualified: "Qualificado",
        demo_scheduled: "Demo agendada",
        demo_completed: "Demo realizada",
        negotiating: "Em negociacao",
        signed: "Adesao",
        onboarding: "Onboarding",
        converted: "Convertido",
        nurture: "Nutricao",
        disqualified: "Nao qualificado",
        lost: "Perdido",
      } as Record<string, string>
    )[status] ?? status
  );
}

function volumeFitPoints(orders: number | null) {
  if (orders == null || !Number.isFinite(orders) || orders < 150) return 0;
  if (orders < 250) return 5;
  if (orders < 350) return 10;
  if (orders < 450) return 15;
  if (orders < 600) return 20;
  return 25;
}

function decisionMakerFitPoints(value: string) {
  return value === "yes" ? 15 : 0;
}

function ownBaseFitPoints(value: string) {
  return value === "yes" ? 15 : 0;
}

function compareNextAction(a: Lead, b: Lead) {
  const aTime = a.next_action_at ? new Date(a.next_action_at).getTime() : Number.MAX_SAFE_INTEGER;
  const bTime = b.next_action_at ? new Date(b.next_action_at).getTime() : Number.MAX_SAFE_INTEGER;
  return aTime - bTime;
}

function nextActionKind(value: string | null) {
  if (!value) return "unscheduled";
  const now = new Date();
  const actionAt = new Date(value);
  if (actionAt < now) return "overdue";

  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  if (actionAt <= endOfToday) return "today";
  return "upcoming";
}

function nextActionLabel(value: string | null) {
  const kind = nextActionKind(value);
  if (kind === "overdue") return "Vencida";
  if (kind === "today") return "Hoje";
  if (kind === "upcoming") return "Futura";
  return "Sem agenda";
}

function toDatetimeLocalValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function activityTypeLabel(type: string) {
  return (
    (
      {
        note: "Observacao",
        contact: "Contato",
        demo: "Demonstracao",
        follow_up: "Follow-up",
      } as Record<string, string>
    )[type] ?? type
  );
}
