import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, Check, Minus, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { brl } from "@/lib/format";
import type { Builder } from "@/components/BuilderConfigurator";

type Selection = Record<string, Record<string, number>>;

export const Route = createFileRoute("/r/$slug/montar")({
  head: () => ({ meta: [{ title: "Monte do Seu Jeito — Localix" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    builder: typeof s.builder === "string" ? s.builder : undefined,
  }),
  component: BuildYourOwnPage,
});

function BuildYourOwnPage() {
  const { slug } = Route.useParams();
  const { builder: builderId } = Route.useSearch();
  const navigate = useNavigate();
  const [selectedBuilderId, setSelectedBuilderId] = useState<string | undefined>(builderId);
  const [step, setStep] = useState(0);
  const [sel, setSel] = useState<Selection>({});
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setSelectedBuilderId(builderId);
  }, [builderId]);

  useEffect(() => {
    console.log("[Build] slug:", slug);
  }, [slug]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["build-your-own-page", slug],
    enabled: !!slug,
    retry: 1,
    queryFn: async () => {
      const { data: restaurant, error: restaurantError } = await (supabase as any)
        .from("restaurants_public")
        .select("id, name, slug, logo_url, is_open, builders_enabled")
        .eq("slug", slug)
        .maybeSingle();

      console.log("[Build] slug:", slug);
      console.log("[Build] restaurant:", restaurant);

      if (restaurantError) {
        console.error("[Build] restaurant error:", restaurantError);
        throw restaurantError;
      }

      if (!restaurant) {
        console.log("[Build] config:", []);
        return { restaurant: null, builders: [] as Builder[] };
      }

      if (!restaurant.builders_enabled) {
        console.log("[Build] config:", []);
        return { restaurant, builders: [] as Builder[] };
      }

      const { data: buildConfig, error: buildError } = await (supabase as any)
        .from("builders")
        .select("*, builder_groups(*, builder_options(*))")
        .eq("restaurant_id", restaurant.id)
        .eq("is_active", true)
        .order("position");

      console.log("[Build] config:", buildConfig ?? []);

      if (buildError) {
        console.error("[Build] config error:", buildError);
        throw buildError;
      }

      return { restaurant, builders: (buildConfig ?? []) as Builder[] };
    },
  });

  const builders = data?.builders ?? [];
  const activeBuilder = useMemo(() => {
    if (!builders.length) return null;
    return builders.find((b) => b.id === selectedBuilderId) ?? builders[0];
  }, [builders, selectedBuilderId]);

  const groups = useMemo(
    () => (activeBuilder?.builder_groups ?? []).slice().sort((a, b) => a.position - b.position),
    [activeBuilder],
  );
  const totalSteps = groups.length + 1;
  const currentGroup = groups[step];

  useEffect(() => {
    setStep(0);
    setSel({});
    setNotes("");
  }, [activeBuilder?.id]);

  const totalForGroup = (gid: string) => Object.values(sel[gid] ?? {}).reduce((s, n) => s + n, 0);

  const subtotal = useMemo(() => {
    let s = Number(activeBuilder?.base_price ?? 0) || 0;
    for (const g of groups) {
      const picks = sel[g.id] ?? {};
      for (const o of g.builder_options) s += (picks[o.id] ?? 0) * Number(o.price_delta);
    }
    return s;
  }, [activeBuilder?.base_price, groups, sel]);

  const updateQty = (groupId: string, optionId: string, qty: number) => {
    setSel((prev) => {
      const cur = { ...(prev[groupId] ?? {}) };
      if (qty <= 0) delete cur[optionId];
      else cur[optionId] = qty;
      return { ...prev, [groupId]: cur };
    });
  };

  const toggle = (g: Builder["builder_groups"][number], o: Builder["builder_groups"][number]["builder_options"][number]) => {
    const cur = sel[g.id] ?? {};
    const have = cur[o.id] ?? 0;
    if (g.max_select === 1) {
      setSel((prev) => ({ ...prev, [g.id]: have ? {} : { [o.id]: 1 } }));
      return;
    }
    const totalNow = Object.values(cur).reduce((s, n) => s + n, 0);
    if (!have && totalNow >= g.max_select) {
      toast.error(`Máx ${g.max_select} nesta etapa`);
      return;
    }
    updateQty(g.id, o.id, have ? 0 : 1);
  };

  const inc = (g: Builder["builder_groups"][number], o: Builder["builder_groups"][number]["builder_options"][number]) => {
    const cur = sel[g.id] ?? {};
    const have = cur[o.id] ?? 0;
    const totalNow = Object.values(cur).reduce((s, n) => s + n, 0);
    if (have >= o.max_qty) return;
    if (totalNow >= g.max_select) {
      toast.error(`Máx ${g.max_select} nesta etapa`);
      return;
    }
    updateQty(g.id, o.id, have + 1);
  };

  const dec = (g: Builder["builder_groups"][number], o: Builder["builder_groups"][number]["builder_options"][number]) => {
    const have = sel[g.id]?.[o.id] ?? 0;
    if (have <= 0) return;
    updateQty(g.id, o.id, have - 1);
  };

  function next() {
    if (currentGroup) {
      const t = totalForGroup(currentGroup.id);
      if (currentGroup.is_required && t < currentGroup.min_select) {
        toast.error(`Selecione ao menos ${currentGroup.min_select} em ${currentGroup.name}`);
        return;
      }
    }
    setStep((s) => Math.min(totalSteps - 1, s + 1));
  }

  function finish() {
    if (!activeBuilder) return;
    for (const g of groups) {
      const t = totalForGroup(g.id);
      if (g.is_required && t < g.min_select) {
        toast.error(`Falta preencher: ${g.name}`);
        setStep(groups.indexOf(g));
        return;
      }
    }

    const parts: string[] = [];
    for (const g of groups) {
      const picks = sel[g.id] ?? {};
      const names = g.builder_options
        .filter((o) => (picks[o.id] ?? 0) > 0)
        .map((o) => (picks[o.id] > 1 ? `${picks[o.id]}x ${o.name}` : o.name));
      if (names.length) parts.push(`${g.name}: ${names.join(", ")}`);
    }
    if (notes.trim()) parts.push(`Obs: ${notes.trim()}`);

    const item = {
      id: `builder:${activeBuilder.id}:${Date.now()}`,
      name: `${activeBuilder.emoji ?? ""} ${activeBuilder.name}${parts.length ? ` (${parts.join(" | ")})` : ""}`.trim(),
      price: subtotal,
    };

    try {
      sessionStorage.setItem(`builder:add:${slug}`, JSON.stringify(item));
    } catch {}
    toast.success("Adicionado ao carrinho");
    navigate({ to: "/r/$slug", params: { slug } });
  }

  if (isLoading) return <BuildSkeleton />;

  if (isError || !data?.restaurant) {
    return <BuildUnavailable slug={slug} title="Monte do seu jeito estará disponível em breve." description="Não conseguimos encontrar a configuração deste restaurante agora." />;
  }

  if (!data.restaurant.builders_enabled || !activeBuilder) {
    return <BuildUnavailable slug={slug} title="Monte do seu jeito estará disponível em breve." description="O restaurante ainda está preparando essa experiência personalizada." />;
  }

  return (
    <div className="min-h-screen bg-muted/30 pb-28">
      <div className="sticky top-0 z-30 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate({ to: "/r/$slug", params: { slug } })}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          {data.restaurant.logo_url && <img src={data.restaurant.logo_url} alt="" className="h-10 w-10 rounded-xl object-cover" />}
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-muted-foreground">{data.restaurant.name}</p>
            <h1 className="truncate font-display text-lg font-extrabold">Monte do Seu Jeito</h1>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-5">
        {builders.length > 1 && (
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {builders.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelectedBuilderId(b.id)}
                className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-bold transition ${activeBuilder.id === b.id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/40"}`}
              >
                {b.emoji ?? "✨"} {b.name}
              </button>
            ))}
          </div>
        )}

        <Card className="overflow-hidden rounded-3xl border bg-card shadow-premium">
          <div className="flex gap-4 p-4">
            <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-primary/10 text-4xl">
              {activeBuilder.image_url ? <img src={activeBuilder.image_url} alt="" className="h-full w-full object-cover" /> : (activeBuilder.emoji ?? "✨")}
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-1 text-primary">
                <Sparkles className="h-4 w-4" />
                <span className="text-xs font-extrabold uppercase tracking-wide">Personalizado</span>
              </div>
              <h2 className="font-display text-2xl font-extrabold leading-tight">{activeBuilder.name}</h2>
              {activeBuilder.description && <p className="mt-1 text-sm text-muted-foreground">{activeBuilder.description}</p>}
            </div>
          </div>
          <div className="border-t px-4 py-3">
            <Progress className="h-1.5" value={((step + 1) / totalSteps) * 100} />
            <p className="mt-1 text-xs font-semibold text-muted-foreground">Etapa {step + 1} de {totalSteps}</p>
          </div>
        </Card>

        <Card className="mt-4 rounded-3xl border bg-card p-4 shadow-sm">
          {currentGroup ? (
            <div>
              <h3 className="font-display text-xl font-extrabold">{currentGroup.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {currentGroup.is_required ? "Obrigatório · " : "Opcional · "}
                {currentGroup.min_select > 0 && `mín ${currentGroup.min_select} · `}
                máx {currentGroup.max_select}
              </p>
              <div className="mt-4 space-y-2">
                {currentGroup.builder_options.slice().sort((a, b) => a.position - b.position).map((o) => {
                  const qty = sel[currentGroup.id]?.[o.id] ?? 0;
                  const selected = qty > 0;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => currentGroup.max_select === 1 ? toggle(currentGroup, o) : (selected ? undefined : inc(currentGroup, o))}
                      className={`flex w-full items-center justify-between rounded-2xl border p-3 text-left transition ${selected ? "border-primary bg-primary/5" : "hover:border-primary/40"}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`grid h-6 w-6 place-items-center rounded-full border-2 ${selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"}`}>
                          {selected && <Check className="h-3.5 w-3.5" />}
                        </span>
                        <span className="font-semibold">{o.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {Number(o.price_delta) > 0 && <span className="text-sm font-bold text-primary">+ {brl(Number(o.price_delta))}</span>}
                        {currentGroup.max_select > 1 && o.max_qty > 1 && selected && (
                          <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <span onClick={() => dec(currentGroup, o)} className="grid h-8 w-8 cursor-pointer place-items-center rounded-full border"><Minus className="h-3.5 w-3.5" /></span>
                            <span className="w-6 text-center text-sm font-bold">{qty}</span>
                            <span onClick={() => inc(currentGroup, o)} className="grid h-8 w-8 cursor-pointer place-items-center rounded-full border"><Plus className="h-3.5 w-3.5" /></span>
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div>
              <h3 className="font-display text-xl font-extrabold">Observações</h3>
              <p className="mb-3 mt-1 text-sm text-muted-foreground">Algum detalhe especial? (opcional)</p>
              <Textarea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex: sem cebola, massa bem assada..." />
            </div>
          )}
        </Card>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 px-4 py-3 shadow-float backdrop-blur" style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}>
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground">Total</p>
            <p className="font-display text-xl font-extrabold text-primary">{brl(subtotal)}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>Voltar</Button>
            {step < totalSteps - 1 ? (
              <Button onClick={next}>Avançar <ChevronRight className="h-4 w-4" /></Button>
            ) : (
              <Button onClick={finish}>Adicionar</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BuildSkeleton() {
  return (
    <div className="min-h-screen bg-muted/30 px-4 py-5">
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-40 rounded-3xl" />
        <Skeleton className="h-80 rounded-3xl" />
      </div>
    </div>
  );
}

function BuildUnavailable({ slug, title, description }: { slug: string; title: string; description: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-muted/30 px-4 text-center">
      <Card className="max-w-sm rounded-3xl p-6 shadow-premium">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-2xl">✨</div>
        <h1 className="font-display text-2xl font-extrabold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <Link to="/r/$slug" params={{ slug }} className="mt-5 inline-flex w-full">
          <Button className="w-full">Voltar ao cardápio</Button>
        </Link>
      </Card>
    </div>
  );
}