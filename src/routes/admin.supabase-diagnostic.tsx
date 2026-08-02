import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { diagnoseSupabaseAdmin } from "@/lib/supabase-admin-diagnostic.functions";

export const Route = createFileRoute("/admin/supabase-diagnostic")({
  component: SupabaseDiagnosticPage,
});

function SupabaseDiagnosticPage() {
  const diagnose = useServerFn(diagnoseSupabaseAdmin);
  const { data, error, isLoading, isFetching } = useQuery({
    queryKey: ["supabase-admin-diagnostic"],
    queryFn: () => diagnose(),
    staleTime: 0,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false,
  });

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Supabase Diagnostic</h1>
        <p className="text-sm text-slate-600">
          Resultado mascarado da verificação do cliente admin.
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-slate-700">
            {isLoading || isFetching ? "Executando diagnóstico..." : "Resultado"}
          </span>
          {error ? <span className="text-sm font-medium text-red-600">Erro</span> : null}
        </div>

        <pre className="max-h-[70vh] overflow-auto rounded-md bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">
          {error
            ? JSON.stringify({ error: (error as Error).message }, null, 2)
            : JSON.stringify(data ?? null, null, 2)}
        </pre>
      </section>
    </main>
  );
}
