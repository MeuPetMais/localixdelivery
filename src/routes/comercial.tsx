import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, LogOut, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setError(null);

    // partner_leads is a new Staging table and is not in the generated client types yet.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const leadsTable = supabase.from("partner_leads" as any);
    const { data, error: queryError } = await leadsTable
      .select(
        "id,business_name,contact_name,phone,segment,city,neighborhood,source,utm_campaign,creative_code,status",
      )
      .eq("assigned_to", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (queryError) {
      setError("Nao foi possivel carregar sua carteira de leads.");
    } else {
      setLeads((data ?? []) as Lead[]);
    }
    setLoading(false);
  }, [user.id]);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  const totals = useMemo(
    () => ({
      all: leads.length,
      qualified: leads.filter((lead) => lead.status === "qualified").length,
      demos: leads.filter(
        (lead) => lead.status === "demo_scheduled" || lead.status === "demo_completed",
      ).length,
    }),
    [leads],
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
    const externalRef = `manual-${user.id}-${crypto.randomUUID()}`;
    const { data, error: invokeError } = await supabase.functions.invoke("partner-lead-capture", {
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
      toast.error("Nao foi possivel cadastrar o lead.");
      return;
    }

    toast.success("Lead cadastrado.");
    setDraft(emptyDraft);
    await loadLeads();
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
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Minha carteira" value={totals.all} />
          <Metric label="Qualificados" value={totals.qualified} />
          <Metric label="Demos" value={totals.demos} />
        </div>

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
              {!loading && !error && leads.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Nenhum lead na sua carteira.
                </div>
              )}
              {!loading && leads.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-y bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Estabelecimento</th>
                        <th className="px-4 py-3">Contato</th>
                        <th className="px-4 py-3">Origem</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leads.map((lead) => (
                        <tr key={lead.id} className="border-b last:border-0">
                          <td className="px-4 py-3">
                            <div className="font-medium">{lead.business_name}</div>
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
                            <span className="rounded-full bg-muted px-2 py-1 text-xs">
                              {statusLabel(lead.status)}
                            </span>
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
