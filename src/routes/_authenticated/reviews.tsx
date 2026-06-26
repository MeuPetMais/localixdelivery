import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Star, MessageSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reviews")({
  head: () => ({ meta: [{ title: "Avaliações — Localix" }] }),
  component: ReviewsPage,
});

type Review = {
  id: string;
  customer_name: string | null;
  rating: number;
  comment: string | null;
  owner_reply: string | null;
  owner_reply_at: string | null;
  created_at: string;
  order_id: string;
};

function ReviewsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [filter, setFilter] = useState<number | null>(null);

  const { data: restaurant } = useQuery({
    queryKey: ["my-restaurant", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (await supabase.from("restaurants").select("id, name").eq("owner_id", user!.id).maybeSingle()).data,
  });

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["owner-reviews", restaurant?.id],
    enabled: !!restaurant?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("reviews")
        .select("id, customer_name, rating, comment, owner_reply, owner_reply_at, created_at, order_id")
        .eq("restaurant_id", restaurant!.id)
        .order("created_at", { ascending: false });
      return (data ?? []) as Review[];
    },
  });

  async function sendReply(r: Review) {
    const text = (replies[r.id] ?? "").trim();
    if (!text) return toast.error("Escreva uma resposta");
    setSaving(r.id);
    const { error } = await (supabase as any)
      .from("reviews")
      .update({ owner_reply: text, owner_reply_at: new Date().toISOString() })
      .eq("id", r.id);
    setSaving(null);
    if (error) return toast.error(error.message);
    toast.success("Resposta publicada");
    setReplies((p) => ({ ...p, [r.id]: "" }));
    qc.invalidateQueries({ queryKey: ["owner-reviews", restaurant!.id] });
  }

  if (!restaurant) {
    return <Card className="p-8 text-center">Crie seu restaurante primeiro.</Card>;
  }

  const filtered = filter === null ? reviews : reviews.filter((r) => r.rating === filter);
  const total = reviews.length;
  const avg = total ? reviews.reduce((s, r) => s + r.rating, 0) / total : 0;
  const pending = reviews.filter((r) => !r.owner_reply).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Avaliações</h1>
        <p className="text-sm text-muted-foreground">Responda seus clientes e construa reputação.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Nota média</p>
          <div className="mt-1 flex items-end gap-2">
            <p className="font-display text-3xl font-extrabold text-primary">{avg.toFixed(1)}</p>
            <Star className="mb-1.5 h-5 w-5 fill-warning text-warning" />
          </div>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="mt-1 font-display text-3xl font-extrabold">{total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Aguardando resposta</p>
          <p className="mt-1 font-display text-3xl font-extrabold text-warning">{pending}</p>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={filter === null ? "default" : "outline"} onClick={() => setFilter(null)}>
          Todas
        </Button>
        {[5, 4, 3, 2, 1].map((n) => (
          <Button key={n} size="sm" variant={filter === n ? "default" : "outline"} onClick={() => setFilter(n)}>
            {n} <Star className="ml-1 h-3 w-3 fill-current" />
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-50" />
          Nenhuma avaliação ainda.
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const name = r.customer_name?.trim() || "Cliente";
            return (
              <Card key={r.id} className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 font-bold text-primary">
                      {name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${i <= r.rating ? "fill-warning text-warning" : "text-muted-foreground/30"}`}
                        />
                      ))}
                    </div>
                    {!r.owner_reply && <Badge variant="secondary">Nova</Badge>}
                  </div>
                </div>
                {r.comment && <p className="mt-3 text-sm">{r.comment}</p>}
                {r.owner_reply ? (
                  <div className="mt-3 rounded-xl border-l-4 border-primary bg-muted/40 p-3">
                    <p className="text-xs font-bold text-primary">Sua resposta</p>
                    <p className="mt-1 text-sm">{r.owner_reply}</p>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    <Textarea
                      placeholder="Responda ao cliente..."
                      value={replies[r.id] ?? ""}
                      onChange={(e) => setReplies((p) => ({ ...p, [r.id]: e.target.value }))}
                      maxLength={500}
                      rows={2}
                    />
                    <div className="flex justify-end">
                      <Button size="sm" onClick={() => sendReply(r)} disabled={saving === r.id}>
                        {saving === r.id ? "Enviando..." : "Responder"}
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
