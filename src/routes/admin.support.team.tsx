import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Ban, BarChart3, MailPlus, ShieldCheck, Trash2, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  inviteSupportTeamMember,
  listSupportTeamManagement,
  removeSupportTeamAccess,
  setSupportTeamMemberActive,
  updateSupportTeamMemberRole,
} from "@/lib/support-admin.functions";
import {
  CATEGORY_LABEL,
  MANAGED_SUPPORT_ROLES,
  SUPPORT_CATEGORIES,
  type ManagedSupportRole,
  type SupportCategory,
} from "@/lib/support-admin";

export const Route = createFileRoute("/admin/support/team")({
  head: () => ({ meta: [{ title: "Admin - Equipe de suporte" }] }),
  component: SupportTeamPage,
});

function SupportTeamPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listSupportTeamManagement);
  const inviteFn = useServerFn(inviteSupportTeamMember);
  const roleFn = useServerFn(updateSupportTeamMemberRole);
  const activeFn = useServerFn(setSupportTeamMemberActive);
  const removeFn = useServerFn(removeSupportTeamAccess);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "support_agent" as ManagedSupportRole,
    category: "all",
  });

  const query = useQuery({
    queryKey: ["admin-support-team-management"],
    queryFn: () => listFn(),
    retry: false,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-support-team-management"] });

  const invite = useMutation({
    mutationFn: () =>
      inviteFn({
        data: {
          name: form.name,
          email: form.email,
          role: form.role,
          allowedCategories: form.category === "all" ? [] : [form.category as SupportCategory],
        },
      }),
    onSuccess: (result) => {
      setInviteUrl(result.inviteUrl);
      setForm({ name: "", email: "", role: "support_agent", category: "all" });
      toast.success("Convite criado");
      refresh();
    },
    onError: (error: any) => toast.error(error?.message ?? "Falha ao convidar"),
  });

  const updateRole = useMutation({
    mutationFn: (data: { userId: string; role: ManagedSupportRole }) => roleFn({ data }),
    onSuccess: () => {
      toast.success("Papel atualizado");
      refresh();
    },
    onError: (error: any) => toast.error(error?.message ?? "Falha ao alterar papel"),
  });

  const setActive = useMutation({
    mutationFn: (data: { userId: string; active: boolean }) => activeFn({ data }),
    onSuccess: () => {
      toast.success("Status atualizado");
      refresh();
    },
    onError: (error: any) => toast.error(error?.message ?? "Falha ao atualizar status"),
  });

  const removeAccess = useMutation({
    mutationFn: (userId: string) => removeFn({ data: { userId } }),
    onSuccess: () => {
      toast.success("Acesso removido");
      refresh();
    },
    onError: (error: any) => toast.error(error?.message ?? "Falha ao remover acesso"),
  });

  const members = query.data?.members ?? [];
  const invites = query.data?.invites ?? [];
  const totals = useMemo(
    () => ({
      active: members.filter((member) => member.active).length,
      inactive: members.filter((member) => !member.active).length,
      pending: invites.length,
    }),
    [members, invites],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/admin/support" className="mb-2 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-100">
            <ArrowLeft className="h-4 w-4" />
            Voltar para suporte
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Equipe de atendimento
          </h1>
          <p className="text-sm text-slate-400">Somente administradores gerenciam acesso interno ao suporte.</p>
        </div>
        <Button className="gap-2" onClick={() => setInviteOpen(true)}>
          <MailPlus className="h-4 w-4" />
          Convidar atendente
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Metric label="Ativos" value={totals.active} />
        <Metric label="Inativos" value={totals.inactive} />
        <Metric label="Convites pendentes" value={totals.pending} />
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
        <div className="grid grid-cols-[1.1fr_1.4fr_160px_110px_110px_110px_150px_190px] gap-3 border-b border-slate-800 bg-slate-800/50 px-4 py-3 text-xs font-semibold uppercase text-slate-400">
          <span>Nome</span>
          <span>E-mail</span>
          <span>Papel</span>
          <span>Status</span>
          <span>Ativos</span>
          <span>Resolvidos</span>
          <span>1a resposta</span>
          <span>Ações</span>
        </div>
        {query.isLoading ? (
          <div className="p-8 text-center text-sm text-slate-400">Carregando equipe...</div>
        ) : query.isError ? (
          <div className="p-8 text-center text-sm text-red-300">Acesso negado ou falha ao carregar equipe.</div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">Nenhum atendente cadastrado.</div>
        ) : (
          members.map((member) => (
            <div key={member.user_id} className="grid grid-cols-[1.1fr_1.4fr_160px_110px_110px_110px_150px_190px] gap-3 border-b border-slate-800 px-4 py-3 text-sm last:border-0">
              <div className="truncate font-medium text-slate-100">{member.name}</div>
              <div className="truncate text-slate-300">{member.email}</div>
              <Select value={member.role} onValueChange={(role) => updateRole.mutate({ userId: member.user_id, role: role as ManagedSupportRole })}>
                <SelectTrigger className="h-8 border-slate-700 bg-slate-950 text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MANAGED_SUPPORT_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>{roleLabel(role)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge className={member.active ? "bg-emerald-500/15 text-emerald-200" : "bg-slate-700 text-slate-300"}>
                {member.active ? "Ativo" : "Inativo"}
              </Badge>
              <span className="text-slate-300">{member.active_tickets}</span>
              <span className="text-slate-300">{member.resolved_tickets}</span>
              <span className="text-slate-300">{member.avg_first_response_minutes} min</span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-slate-200 hover:bg-slate-800"
                  title="Ver desempenho"
                  onClick={() => toast.info(`Ultima atividade: ${member.last_activity_at ? new Date(member.last_activity_at).toLocaleString("pt-BR") : "sem atividade"}`)}
                >
                  <BarChart3 className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-slate-200 hover:bg-slate-800"
                  onClick={() => setActive.mutate({ userId: member.user_id, active: !member.active })}
                  title={member.active ? "Inativar" : "Ativar"}
                >
                  {member.active ? <Ban className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-red-300 hover:bg-slate-800"
                  title="Remover acesso"
                  onClick={() => {
                    if (confirm(`Remover acesso ao suporte de ${member.name}?`)) removeAccess.mutate(member.user_id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {invites.length > 0 && (
        <Card className="border-slate-800 bg-slate-900 p-4">
          <div className="mb-3 text-sm font-semibold text-slate-100">Convites pendentes</div>
          <div className="space-y-2">
            {invites.map((invite) => (
              <div key={invite.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-800 px-3 py-2 text-sm">
                <div>
                  <div className="font-medium text-slate-100">{invite.name}</div>
                  <div className="text-xs text-slate-400">{invite.email} - {roleLabel(invite.role)} - expira {new Date(invite.expires_at).toLocaleDateString("pt-BR")}</div>
                </div>
                <Badge className="bg-amber-500/15 text-amber-200">Pendente</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="border-slate-800 bg-slate-900 text-slate-100">
          <DialogHeader>
            <DialogTitle>Convidar atendente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Nome">
              <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="border-slate-700 bg-slate-950" />
            </Field>
            <Field label="E-mail">
              <Input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className="border-slate-700 bg-slate-950" />
            </Field>
            <Field label="Papel">
              <Select value={form.role} onValueChange={(role) => setForm((current) => ({ ...current, role: role as ManagedSupportRole }))}>
                <SelectTrigger className="border-slate-700 bg-slate-950">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MANAGED_SUPPORT_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>{roleLabel(role)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Categoria permitida">
              <Select value={form.category} onValueChange={(category) => setForm((current) => ({ ...current, category }))}>
                <SelectTrigger className="border-slate-700 bg-slate-950">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {SUPPORT_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>{CATEGORY_LABEL[category]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {inviteUrl && (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-100">
                Link seguro gerado. O envio por e-mail foi solicitado ao Supabase Auth.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInviteOpen(false)}>Fechar</Button>
            <Button onClick={() => invite.mutate()} disabled={invite.isPending || !form.name.trim() || !form.email.trim()}>
              Enviar convite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card className="border-slate-800 bg-slate-900 p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-100">{value}</div>
    </Card>
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

function roleLabel(role: ManagedSupportRole) {
  return role === "support_manager" ? "Gerente de suporte" : "Atendente";
}
