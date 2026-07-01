import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useCustomerAuth } from "@/hooks/use-customer-auth";

type Props = {
  orderId: string;
  restaurantId: string;
  customerName?: string | null;
  customerPhone?: string | null;
};

export function ReviewForm({ orderId, restaurantId, customerName, customerPhone }: Props) {
  const qc = useQueryClient();
  const { user, loading: authLoading } = useCustomerAuth();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [existing, setExisting] = useState<any>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await (supabase as any)
        .from("reviews")
        .select("id, rating, comment, owner_reply, created_at")
        .eq("order_id", orderId)
        .maybeSingle();
      if (!mounted) return;
      setExisting(data);
      setChecking(false);
    })();
    return () => {
      mounted = false;
    };
  }, [orderId]);

  async function submit() {
    if (!user) return toast.error("Entre na sua conta para avaliar");
    if (rating < 1) return toast.error("Selecione uma nota");
    if (comment.length > 500) return toast.error("Comentário muito longo (máx 500)");
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("reviews")
      .insert({
        order_id: orderId,
        restaurant_id: restaurantId,
        customer_name: customerName ?? user.user_metadata?.full_name ?? null,
        customer_phone: customerPhone ?? null,
        rating,
        comment: comment.trim() || null,
      })
      .select()
      .single();
    setLoading(false);
    if (error) {
      const msg = error.message?.includes("row-level security")
        ? "Só é possível avaliar seu próprio pedido após ser entregue."
        : error.message || "Erro ao enviar avaliação";
      return toast.error(msg, { description: error.details ?? error.hint ?? undefined });
    }
    setExisting(data);
    toast.success("Obrigado pela sua avaliação!");
    // Refresh public/dashboard aggregates
    qc.invalidateQueries({ queryKey: ["public-reviews", restaurantId] });
    qc.invalidateQueries({ queryKey: ["owner-reviews"] });
  }

  if (checking || authLoading) return null;

  if (existing) {
    return (
      <Card className="p-5">
        <div className="flex items-center gap-2 text-success">
          <CheckCircle2 className="h-5 w-5" />
          <h2 className="font-display text-lg font-bold">Avaliação enviada</h2>
        </div>
        <div className="mt-3 flex gap-0.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Star
              key={i}
              className={`h-5 w-5 ${i <= existing.rating ? "fill-warning text-warning" : "text-muted-foreground/30"}`}
            />
          ))}
        </div>
        {existing.comment && <p className="mt-2 text-sm">{existing.comment}</p>}
        {existing.owner_reply && (
          <div className="mt-3 rounded-xl border-l-4 border-primary bg-muted/40 p-3">
            <p className="text-xs font-bold text-primary">Resposta do estabelecimento</p>
            <p className="mt-1 text-sm">{existing.owner_reply}</p>
          </div>
        )}
      </Card>
    );
  }

  if (!user) {
    return (
      <Card className="p-4">
        <div className="flex items-start gap-2 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 text-warning" />
          <p>Entre na sua conta para avaliar este pedido.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <h2 className="font-display text-lg font-bold">Avalie seu pedido</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Sua opinião ajuda o restaurante a melhorar.
      </p>
      <div className="mt-3 flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(i)}
            className="transition hover:scale-110"
          >
            <Star
              className={`h-8 w-8 ${
                i <= (hover || rating) ? "fill-warning text-warning" : "text-muted-foreground/30"
              }`}
            />
          </button>
        ))}
      </div>
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Conte como foi a experiência (opcional)"
        maxLength={500}
        className="mt-3"
        rows={3}
      />
      <p className="mt-1 text-right text-xs text-muted-foreground">{comment.length}/500</p>
      <Button onClick={submit} disabled={loading || rating < 1} className="mt-2 w-full">
        {loading ? "Enviando..." : "Enviar avaliação"}
      </Button>
    </Card>
  );
}
