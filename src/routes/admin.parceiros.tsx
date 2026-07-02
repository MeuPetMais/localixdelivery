import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAdminPartners, setPartnerActive, deletePartner } from "@/lib/superadmin.functions";
import { brl } from "@/lib/format";
import { toast } from "sonner";
import { Ban, Eye, LogIn, Pause, Play, Trash2 } from "lucide-react";
import { setImpersonatedRestaurantId, setPreferredEnv } from "@/lib/admin-mode";


export const Route = createFileRoute("/admin/parceiros")({
  head: () => ({ meta: [{ title: "Admin — Parceiros" }] }),
  component: PartnersPage,
});

function PartnersPage() {
  const list = useServerFn(listAdminPartners);
  const toggle = useServerFn(setPartnerActive);
  const del = useServerFn(deletePartner);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  function enterAsPartner(id: string) {
    setImpersonatedRestaurantId(id);
    setPreferredEnv("partner");
    navigate({ to: "/dashboard" });
  }


  const { data, isLoading } = useQuery({ queryKey: ["admin-partners"], queryFn: () => list() });

  const mToggle = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => toggle({ data: v }),
    onSuccess: () => { toast.success("Status atualizado"); qc.invalidateQueries({ queryKey: ["admin-partners"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const mDelete = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Excluído"); qc.invalidateQueries({ queryKey: ["admin-partners"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const rows = (data ?? []).filter(r =>
    !q || r.name?.toLowerCase().includes(q.toLowerCase()) || r.city?.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Gestão de Parceiros</h1>
          <p className="text-sm text-slate-400">Todos os restaurantes cadastrados na plataforma.</p>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou cidade…"
          className="w-64 rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm" />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/50 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left">Nome</th>
              <th className="px-4 py-3 text-left">Categoria</th>
              <th className="px-4 py-3 text-left">Cidade</th>
              <th className="px-4 py-3 text-left">Telefone</th>
              <th className="px-4 py-3 text-right">Pedidos</th>
              <th className="px-4 py-3 text-right">Faturamento</th>
              <th className="px-4 py-3 text-right">Comissões</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={9} className="p-6 text-center text-slate-400">Carregando…</td></tr>}
            {!isLoading && rows.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-slate-400">Nenhum parceiro.</td></tr>}
            {rows.map(r => (
              <tr key={r.id} className="border-t border-slate-800 hover:bg-slate-800/30">
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3 text-slate-300">{r.category ?? "—"}</td>
                <td className="px-4 py-3 text-slate-300">{r.city ?? "—"}</td>
                <td className="px-4 py-3 text-slate-300">{r.whatsapp_phone ?? "—"}</td>
                <td className="px-4 py-3 text-right">{r.orders}</td>
                <td className="px-4 py-3 text-right">{brl(r.gross)}</td>
                <td className="px-4 py-3 text-right">{brl(r.commission)}</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex flex-col items-center gap-1 text-xs">
                    <span className={`rounded-full px-2 py-0.5 ${r.active ? "bg-green-500/20 text-green-300" : "bg-slate-700 text-slate-300"}`}>
                      {r.active ? "Ativo" : "Suspenso"}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 ${r.is_open ? "bg-blue-500/20 text-blue-300" : "bg-slate-700 text-slate-300"}`}>
                      {r.is_open ? "Aberto" : "Fechado"}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <a href={`/${r.id}`} title="Visualizar" className="rounded-md p-1.5 text-slate-300 hover:bg-slate-800"><Eye className="h-4 w-4" /></a>
                    <button title="Entrar como estabelecimento" onClick={() => enterAsPartner(r.id)}
                      className="rounded-md p-1.5 text-green-300 hover:bg-slate-800"><LogIn className="h-4 w-4" /></button>
                    <button title={r.active ? "Suspender" : "Reativar"} onClick={() => mToggle.mutate({ id: r.id, active: !r.active })}
                      className="rounded-md p-1.5 text-yellow-300 hover:bg-slate-800">
                      {r.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>

                    <button title="Bloquear" onClick={() => mToggle.mutate({ id: r.id, active: false })}
                      className="rounded-md p-1.5 text-red-300 hover:bg-slate-800"><Ban className="h-4 w-4" /></button>
                    <button title="Excluir" onClick={() => { if (confirm(`Excluir ${r.name}?`)) mDelete.mutate(r.id); }}
                      className="rounded-md p-1.5 text-red-400 hover:bg-slate-800"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
