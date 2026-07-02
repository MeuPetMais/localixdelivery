import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/auditoria")({
  head: () => ({ meta: [{ title: "Admin — Auditoria" }] }),
  component: Page,
});

function Page() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Auditoria</h1>
        <p className="text-sm text-slate-400">Módulo em construção.</p>
      </div>
      <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900 p-10 text-center text-slate-400">
        Em breve.
      </div>
    </div>
  );
}
