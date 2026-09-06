import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Check,
  ImageIcon,
  Plus,
  Minus,
  ShoppingBag,
  ArrowLeft,
  Sparkles,
  AlertTriangle,
  Rocket,
} from "lucide-react";
import { brl } from "@/lib/format";
import { isPromoActiveNow } from "@/lib/promotions";
import type { TurbineCandidate } from "@/lib/cart/turbine-candidates";

export type AddedItem = {
  lineId: string;
  id: string;
  name: string;
  price: number;
  qty: number;
  image_url?: string | null;
};

type SuggestionItem = {
  id: string;
  name: string;
  price: number;
  promo_price?: number | null;
  image_url?: string | null;
  promo_active?: boolean | null;
  promo_starts_at?: string | null;
  promo_ends_at?: string | null;
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  lastAdded: AddedItem | null;
  subtotal: number;
  minOrder: number;
  turbineCandidates?: TurbineCandidate[];
  onAddTurbineCandidate?: (candidate: TurbineCandidate) => void;
  onRemoveTurbineCandidate?: (candidate: TurbineCandidate) => void;
  onIncrementTurbineCandidate?: (candidate: TurbineCandidate) => void;
  onDecrementTurbineCandidate?: (candidate: TurbineCandidate) => void;
  suggestions: SuggestionItem[];
  onAddSuggestion: (item: SuggestionItem) => void;
  onContinue: () => void;
  onGoToCart: () => void;
}

export function AddedToCartSheet({
  open,
  onOpenChange,
  lastAdded,
  subtotal,
  minOrder,
  turbineCandidates = [],
  onAddTurbineCandidate,
  onRemoveTurbineCandidate,
  onIncrementTurbineCandidate,
  onDecrementTurbineCandidate,
  suggestions,
  onAddSuggestion,
  onContinue,
  onGoToCart,
}: Props) {
  const missing = Math.max(0, minOrder - subtotal);
  const reached = minOrder <= 0 || subtotal >= minOrder;
  const pct = minOrder > 0 ? Math.min(100, Math.round((subtotal / minOrder) * 100)) : 100;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[92vh] overflow-y-auto rounded-t-3xl p-0 sm:max-w-xl sm:mx-auto sm:rounded-2xl"
      >
        <VisuallyHidden>
          <SheetTitle>Produto adicionado ao carrinho</SheetTitle>
        </VisuallyHidden>
        {/* Confirmação */}
        <div className="bg-gradient-to-b from-success/10 to-transparent px-5 pb-4 pt-6">
          <div className="mb-3 flex items-center gap-2 text-success animate-in fade-in slide-in-from-top-1">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-success text-success-foreground">
              <Check className="h-4 w-4" />
            </div>
            <p className="font-display text-base font-extrabold">Produto adicionado</p>
          </div>

          {lastAdded && (
            <div className="flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-sm">
              {lastAdded.image_url ? (
                <img
                  src={lastAdded.image_url}
                  alt={lastAdded.name}
                  className="h-14 w-14 rounded-xl object-cover"
                />
              ) : (
                <div className="grid h-14 w-14 place-items-center rounded-xl bg-muted text-muted-foreground">
                  <ImageIcon className="h-5 w-5" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-bold">{lastAdded.name}</p>
                <p className="text-xs text-muted-foreground">
                  {lastAdded.qty}× {brl(lastAdded.price)}
                </p>
              </div>
              <div key={subtotal} className="text-right animate-in fade-in zoom-in-95">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Subtotal
                </p>
                <p className="font-display text-base font-extrabold text-primary">
                  {brl(subtotal)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Pedido mínimo */}
        {minOrder > 0 && (
          <div className="px-5 pb-4">
            {reached ? (
              <div className="rounded-2xl border border-success/40 bg-success/10 p-4 animate-in fade-in">
                <div className="flex items-center gap-2 text-success">
                  <Check className="h-4 w-4" />
                  <p className="text-sm font-bold">Pedido mínimo atingido</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Agora você já pode finalizar sua compra.
                </p>
                <Button className="mt-3 w-full rounded-xl" onClick={onGoToCart}>
                  <ShoppingBag className="mr-2 h-4 w-4" /> Finalizar Pedido
                </Button>
              </div>
            ) : (
              <div className="rounded-2xl border border-amber-300/60 bg-amber-50 p-4 dark:bg-amber-950/20">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                  <p className="text-sm font-bold">Faltam {brl(missing)} para o pedido mínimo</p>
                </div>
                <div className="mt-3 flex items-baseline justify-between text-xs text-muted-foreground">
                  <span>{brl(subtotal)}</span>
                  <span>{brl(minOrder)}</span>
                </div>
                <Progress value={pct} className="mt-1 h-2" />
                <p className="mt-1 text-right text-[11px] font-semibold text-muted-foreground">
                  {pct}%
                </p>
              </div>
            )}
          </div>
        )}

        {/* Sugestões */}
        {lastAdded && turbineCandidates.length > 0 && (
          <div className="px-5 pb-4">
            <div className="mb-2 flex items-center gap-1.5">
              <Rocket className="h-4 w-4 text-primary" />
              <h3 className="font-display text-sm font-extrabold">Turbine seu {lastAdded.name}</h3>
            </div>
            <div className="space-y-2">
              {turbineCandidates.slice(0, 4).map((candidate) => {
                const selected = candidate.selectedQuantity > 0;
                return (
                  <div
                    key={candidate.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-3"
                  >
                    <div className="min-w-0">
                      <p className="line-clamp-1 text-sm font-bold">{candidate.name}</p>
                      <p className="text-xs text-muted-foreground">{candidate.groupName}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {candidate.price_adjustment > 0 && (
                        <span className="font-display text-sm font-extrabold text-primary">
                          +{brl(candidate.price_adjustment)}
                        </span>
                      )}
                      {selected ? (
                        candidate.maxQuantity > 1 ? (
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-8 w-8 rounded-lg"
                              onClick={() => onDecrementTurbineCandidate?.(candidate)}
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                            <span className="grid h-8 min-w-8 place-items-center rounded-lg border px-2 text-xs font-bold">
                              {candidate.selectedQuantity}
                            </span>
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-8 w-8 rounded-lg"
                              disabled={!candidate.canIncrement}
                              onClick={() => onIncrementTurbineCandidate?.(candidate)}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 rounded-lg text-xs"
                              disabled
                            >
                              <Check className="mr-1 h-3 w-3" /> Adicionado
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-8 rounded-lg text-xs"
                              onClick={() => onRemoveTurbineCandidate?.(candidate)}
                            >
                              Remover
                            </Button>
                          </div>
                        )
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-lg text-xs"
                          onClick={() => onAddTurbineCandidate?.(candidate)}
                        >
                          <Plus className="mr-1 h-3 w-3" /> Adicionar
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="px-5 pb-4">
            <div className="mb-2 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="font-display text-sm font-extrabold">Você também pode gostar</h3>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {suggestions.map((it) => {
                const promo = isPromoActiveNow(it);
                const price = Number(promo ? it.promo_price : it.price);
                return (
                  <div
                    key={it.id}
                    className="flex flex-col overflow-hidden rounded-2xl border bg-card"
                  >
                    <div className="aspect-square w-full bg-muted">
                      {it.image_url ? (
                        <img
                          src={it.image_url}
                          alt={it.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-muted-foreground">
                          <ImageIcon className="h-6 w-6" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-1 p-2">
                      <p className="line-clamp-2 text-xs font-semibold leading-tight">{it.name}</p>
                      <p className="mt-auto font-display text-sm font-extrabold text-primary">
                        {brl(price)}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg text-xs"
                        onClick={() => onAddSuggestion(it)}
                      >
                        <Plus className="mr-1 h-3 w-3" /> Adicionar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="sticky bottom-0 border-t bg-background/95 p-4 backdrop-blur">
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={onContinue}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Continuar comprando
            </Button>
            <Button className="flex-1 rounded-xl" onClick={onGoToCart}>
              <ShoppingBag className="mr-1 h-4 w-4" /> Ver carrinho
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
