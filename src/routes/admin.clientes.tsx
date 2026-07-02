import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAdminCustomers } from "@/lib/superadmin.functions";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/admin/clientes")({
  head: () => ({ meta: [{ title: "Admin — Clientes" }] }),
  component: CustomersPage,
});

function CustomersPage() {
  const fn = useServerFn(listAdminCustomers);
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["admin-customers"], queryFn: () => fn() });

  const rows = (data ?? []).filter(c => !q ||
    c.full_name?.toLowerCase().includes(q.toLowerCase()) ||
    c.email?.toLowerCase().includes(q.toLowerCase()) ||
    c.phone?.includes(q));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Gestão de Clientes</h1>
          <p className="text-sm text-slate-400">Todos os clientes cadastrados na plataforma.</p>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, e-mail ou telefone…"
          className="w-72 rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm" />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/50 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left">Nome</th>
              <th className="px-4 py-3 text-left">E-mail</th>
              <th className="px-4 py-3 text-left">Telefone</th>
              <th className="px-4 py-3 text-right">Pedidos</th>
              <th className="px-4 py-3 text-right">Valor gasto</th>
              <th className="px-4 py-3 text-left">Último pedido</th>
              <th className="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="p-6 text-center text-slate-400">Carregando…</td></tr>}
            {!isLoading && rows.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-slate-400">Sem clientes.</td></tr>}
            {rows.map(c => (
              <tr key={c.id} className="border-t border-slate-800 hover:bg-slate-800/30">
                <td className="px-4 py-3 font-medium">{c.full_name ?? "—"}</td>
                <td className="px-4 py-3 text-slate-300">{c.email ?? "—"}</td>
                <td className="px-4 py-3 text-slate-300">{c.phone ?? "—"}</td>
                <td className="px-4 py-3 text-right">{c.orders}</td>
                <td className="px-4 py-3 text-right">{brl(c.spent)}</td>
                <td className="px-4 py-3 text-slate-300">{c.last_order_at ? new Date(c.last_order_at).toLocaleDateString("pt-BR") : "—"}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${c.orders > 0 ? "bg-green-500/20 text-green-300" : "bg-slate-700 text-slate-300"}`}>
                    {c.orders > 0 ? "Ativo" : "Novo"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
