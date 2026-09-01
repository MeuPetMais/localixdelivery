import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CheckCircle2, Loader2, Store } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getMyDriverContexts, switchMyDriverContext } from "@/lib/driver-context.functions";

export const Route = createFileRoute("/motoboy-estabelecimentos")({
  ssr: false,
  head: () => ({ meta: [{ title: "Meus estabelecimentos — Localix" }] }),
  component: DriverRestaurantsPage,
});

function DriverRestaurantsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getContexts = useServerFn(getMyDriverContexts);
  const switchContext = useServerFn(switchMyDriverContext);

  const q = useQuery({
    queryKey: ["driver-contexts"],
    queryFn: () => getContexts({}),
  });

  const switchMut = useMutation({
    mutationFn: (driverId: string) => switchContext({ data: { driverId } }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["driver-contexts"] }),
        qc.invalidateQueries({ queryKey: ["driver-wallet"] }),
      ]);
      toast.success("Estabelecimento selecionado");
      navigate({ to: "/motoboy", replace: true });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const contexts = q.data?.contexts ?? [];

  useEffect(() => {
    if (q.isLoading || q.isError || contexts.length !== 1 || switchMut.isPending) return;
    const only = contexts[0];
    if (only.selected) {
      navigate({ to: "/motoboy", replace: true });
      return;
    }
    switchMut.mutate(only.driverId);
  }, [q.isLoading, q.isError, contexts, switchMut.isPending, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 px-4 py-6">
      <div className="mx-auto max-w-md">
        <div className="mb-5 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/motoboy" })}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-display text-xl font-extrabold">Meus estabelecimentos</h1>
            <p className="text-sm text-muted-foreground">Escolha onde você vai operar agora.</p>
          </div>
        </div>

        {q.isLoading && (
          <div className="grid min-h-48 place-items-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        {q.isError && (
          <Card className="p-4 text-sm text-destructive">Não foi possível carregar seus vínculos.</Card>
        )}

        {!q.isLoading && !q.isError && contexts.length === 0 && (
          <Card className="p-5 text-center">
            <Store className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-semibold">Nenhum estabelecimento vinculado</p>
            <p className="mt-1 text-sm text-muted-foreground">Peça ao parceiro para cadastrar seu CPF e telefone.</p>
          </Card>
        )}

        <div className="space-y-3">
          {contexts.map((ctx) => (
            <Card key={ctx.driverId} className="flex items-center gap-3 rounded-2xl p-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted">
                {ctx.restaurantLogoUrl ? (
                  <img src={ctx.restaurantLogoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Store className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{ctx.restaurantName}</p>
                <p className="text-xs text-muted-foreground">
                  {ctx.selected ? "Selecionado agora" : "Vínculo ativo"}
                </p>
              </div>
              {ctx.selected ? (
                <div className="flex items-center gap-1 text-sm font-semibold text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" /> Ativo
                </div>
              ) : (
                <Button
                  size="sm"
                  disabled={switchMut.isPending}
                  onClick={() => switchMut.mutate(ctx.driverId)}
                >
                  Selecionar
                </Button>
              )}
            </Card>
          ))}
        </div>

        {contexts.length > 1 && (
          <p className="mt-5 text-xs text-muted-foreground">
            Para trocar de estabelecimento, você precisa estar offline, fora da fila e sem entrega em andamento.
          </p>
        )}
      </div>
    </div>
  );
}
