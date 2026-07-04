import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import {
  createCheckoutOrder,
  previewCheckoutPricing,
  type CheckoutMethod,
} from "@/lib/checkout/OrderService";
import { applyLoyaltyReserveForOrder } from "@/lib/loyalty.functions";
import { AddressAutocomplete, formatFullAddress, type SelectedAddress } from "@/components/checkout/AddressAutocomplete";
import { LoyaltyRedeemBlock } from "@/components/checkout/LoyaltyRedeemBlock";
import { LoyaltyBenefitsBlock } from "@/components/checkout/LoyaltyBenefitsBlock";
import { useCustomerAuth } from "@/hooks/use-customer-auth";

export const Route = createFileRoute("/$slug/checkout")({
  ssr: false,
  component: CheckoutPage,
});

type CartItem = { id: string; name: string; price: number; qty: number };

const METHODS: { id: CheckoutMethod; label: string }[] = [
  { id: "pix", label: "Pix" },
  { id: "credit_card", label: "Cartão de Crédito" },
  { id: "cash", label: "Dinheiro" },
  { id: "meal_voucher", label: "Vale Refeição" },
  { id: "google_pay", label: "Google Pay" },
  { id: "apple_pay", label: "Apple Pay" },
];

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function CheckoutPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const preview = useServerFn(previewCheckoutPricing);
  const create = useServerFn(createCheckoutOrder);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState<SelectedAddress | null>(null);
  const [notes, setNotes] = useState("");
  const [method, setMethod] = useState<CheckoutMethod>("pix");
  const [deliveryFee] = useState(0);
  const [couponDiscount] = useState(0);
  const [loyalty, setLoyalty] = useState<{ points: number; discount: number }>({ points: 0, discount: 0 });
  const { user } = useCustomerAuth();
  const applyLoyalty = useServerFn(applyLoyaltyReserveForOrder);
  const [pricing, setPricing] = useState<{
    subtotal: number;
    deliveryFee: number;
    platformFee: number;
    couponDiscount: number;
    customerTotal: number;
    currency: string;
    loyaltyDiscount?: number;
  } | null>(null);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`cart:${slug}`);
      if (raw) setCart(JSON.parse(raw));
    } catch {}
  }, [slug]);

  const subtotal = useMemo(
    () => cart.reduce((s, i) => s + i.price * i.qty, 0),
    [cart],
  );

  useEffect(() => {
    let cancelled = false;
    if (!subtotal) {
      setPricing(null);
      setPricingError(null);
      return;
    }
    setLoading(true);
    preview({
      data: { subtotal, deliveryFee, couponDiscount, loyaltyDiscount: loyalty.discount, paymentMethod: method },
    })
      .then((r) => {
        if (cancelled) return;
        if (r.ok) {
          setPricing(r.pricing as any);
          setPricingError(null);
        } else {
          setPricing(null);
          setPricingError(r.message);
        }
      })
      .catch((e) => !cancelled && setPricingError(e?.message ?? "Erro"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [subtotal, deliveryFee, couponDiscount, loyalty.discount, method, preview]);

  const addressComplete = !!address && !!(address.number || address.numberOverride);
  const canSubmit =
    !!pricing &&
    !pricingError &&
    cart.length > 0 &&
    name.trim() &&
    phone.trim() &&
    addressComplete;

  async function confirm() {
    if (!canSubmit) {
      if (!cart.length) toast.error("Seu carrinho está vazio");
      else if (pricingError) toast.error(pricingError);
      else if (!address) toast.error("Selecione um endereço");
      else if (!addressComplete) toast.error("Informe o número do endereço");
      else toast.error("Preencha nome e telefone");
      return;
    }
    setSubmitting(true);
    try {
      const res = await create({
        data: {
          restaurantSlug: slug,
          customer: { name, phone, address: formatFullAddress(address!), notes },
          items: cart,
          paymentMethod: method,
          deliveryFee,
          couponDiscount,
          loyaltyDiscount: loyalty.discount,
          loyaltyPoints: loyalty.points,
        },
      });
      // Reserva de pontos (só se logado e escolheu resgatar)
      if (loyalty.points > 0 && user) {
        try {
          await applyLoyalty({ data: { orderId: res.orderId, points: loyalty.points } });
        } catch (e: any) {
          console.warn("[loyalty] reserva falhou:", e?.message);
        }
      }
      sessionStorage.removeItem(`cart:${slug}`);
      toast.success(
        loyalty.discount > 0
          ? `Pedido #${res.orderNumber ?? ""} criado — você economizou ${brl(loyalty.discount)} com pontos!`
          : `Pedido #${res.orderNumber ?? ""} criado — aguardando pagamento`,
      );
      navigate({ to: "/pedido-sucesso/$id", params: { id: res.orderId } });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível criar o pedido");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 pb-32">
      <h1 className="font-display text-2xl">Checkout</h1>

      {/* Carrinho */}
      <Card>
        <CardContent className="space-y-2 p-4">
          <h2 className="font-semibold">Seu carrinho</h2>
          {cart.length === 0 ? (
            <p className="text-sm text-muted-foreground">Carrinho vazio.</p>
          ) : (
            cart.map((i) => (
              <div key={i.id} className="flex justify-between text-sm">
                <span>
                  {i.qty}× {i.name}
                </span>
                <span>{brl(i.price * i.qty)}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Cliente */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <h2 className="font-semibold">Seus dados</h2>
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Telefone / WhatsApp</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Endereço de entrega</Label>
            <AddressAutocomplete value={address} onChange={setAddress} restaurantSlug={slug} autoFocus={!address} />
          </div>
          <div className="space-y-1.5">
            <Label>Observações (opcional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Benefícios do programa (informativo — reutiliza loyalty_rules) */}
      <LoyaltyBenefitsBlock slug={slug} authenticated={!!user} />

      {/* Fidelidade — antes da forma de pagamento */}
      <LoyaltyRedeemBlock
        slug={slug}
        subtotal={subtotal}
        authenticated={!!user}
        onChange={setLoyalty}
      />

      {/* Forma de pagamento */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <h2 className="font-semibold">Forma de pagamento</h2>
          <RadioGroup value={method} onValueChange={(v) => setMethod(v as CheckoutMethod)}>
            {METHODS.map((m) => (
              <label key={m.id} className="flex cursor-pointer items-center gap-2 rounded-md border p-2">
                <RadioGroupItem value={m.id} id={`m-${m.id}`} />
                <span>{m.label}</span>
              </label>
            ))}
          </RadioGroup>
          <p className="text-xs text-muted-foreground">
            Pagamento online será processado após confirmação. Este pedido ficará com status
            <em> aguardando pagamento</em>.
          </p>
        </CardContent>
      </Card>


      {/* Resumo */}
      <Card>
        <CardContent className="space-y-2 p-4">
          <h2 className="font-semibold">Resumo</h2>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {pricingError && (
            <p className="text-sm text-destructive">{pricingError}</p>
          )}
          {pricing && (
            <div className="space-y-1 text-sm">
              <Row label="Subtotal" value={brl(pricing.subtotal)} />
              <Row label="Entrega" value={brl(pricing.deliveryFee)} />
              {pricing.couponDiscount > 0 && (
                <Row label="Cupom" value={`- ${brl(pricing.couponDiscount)}`} />
              )}
              {loyalty.discount > 0 && (
                <Row label="🎁 Pontos" value={`- ${brl(loyalty.discount)}`} />
              )}
              <Row label="Taxa da plataforma" value={brl(pricing.platformFee)} />
              <Separator className="my-2" />
              <Row label="Total" value={brl(pricing.customerTotal)} bold />
              {loyalty.discount > 0 && (
                <p className="text-xs text-primary text-right font-medium">
                  Você economizou {brl(loyalty.discount)} usando pontos.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Button
        size="lg"
        className="w-full"
        onClick={confirm}
        disabled={!canSubmit || submitting}
      >
        {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Confirmar pedido
      </Button>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
