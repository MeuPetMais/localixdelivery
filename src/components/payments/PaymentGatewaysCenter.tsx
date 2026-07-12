import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { PaymentService } from "@/lib/payments/PaymentService";
import { StripeConnectCard } from "./StripeConnectCard";
import { MercadoPagoCard } from "./MercadoPagoCard";

interface Props {
  restaurantId: string | null;
  stripeParam?: string | null;
}

export function PaymentGatewaysCenter({ restaurantId, stripeParam }: Props) {
  const qc = useQueryClient();
  const primaryKey = ["primary-provider", restaurantId];

  const primaryQuery = useQuery({
    queryKey: primaryKey,
    enabled: !!restaurantId,
    queryFn: () => PaymentService.getPrimaryProvider(restaurantId!),
    refetchOnWindowFocus: false,
  });

  const [pending, setPending] = useState<string | null>(null);

  const setPrimary = useMutation({
    mutationFn: async (providerId: string) => {
      if (!restaurantId) throw new Error("Restaurante não carregado");
      setPending(providerId);
      await PaymentService.setPrimaryProvider(restaurantId, providerId);
      return providerId;
    },
    onSuccess: (p) => {
      toast.success(`Gateway principal: ${p === "stripe" ? "Stripe" : "Mercado Pago"}`);
      qc.invalidateQueries({ queryKey: primaryKey });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao definir gateway"),
    onSettled: () => setPending(null),
  });

  const primary = primaryQuery.data ?? "stripe";

  useEffect(() => {
    qc.invalidateQueries({ queryKey: primaryKey });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  return (
    <div className="space-y-6">
      <StripeConnectCard restaurantId={restaurantId} urlParam={stripeParam} />
      <MercadoPagoCard
        restaurantId={restaurantId}
        isPrimary={primary === "mercado_pago"}
        onSetPrimary={() => setPrimary.mutate("mercado_pago")}
        settingPrimary={pending === "mercado_pago"}
      />

      <Card className="p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Gateway principal</h3>
          <p className="text-sm text-muted-foreground">
            Escolha qual gateway será utilizado no checkout. A alteração é salva automaticamente.
          </p>
        </div>
        <RadioGroup
          value={primary}
          onValueChange={(v) => setPrimary.mutate(v)}
          className="grid gap-2"
        >
          <div className="flex items-center gap-2 rounded border p-3">
            <RadioGroupItem value="stripe" id="pp-stripe" />
            <Label htmlFor="pp-stripe" className="cursor-pointer flex-1">Stripe Connect</Label>
          </div>
          <div className="flex items-center gap-2 rounded border p-3">
            <RadioGroupItem value="mercado_pago" id="pp-mp" />
            <Label htmlFor="pp-mp" className="cursor-pointer flex-1">Mercado Pago</Label>
          </div>
        </RadioGroup>
      </Card>
    </div>
  );
}
