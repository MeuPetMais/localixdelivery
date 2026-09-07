import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { brl } from "@/lib/format";
import { ConfigurationRuleEngine } from "@/lib/product/configuration/ConfigurationRuleEngine";
import { PriceCalculationStrategy } from "@/lib/product/configuration/PriceCalculationStrategy";
import type {
  ProductOption,
  ProductOptionGroup,
  SelectedOption,
} from "@/lib/product/configuration/types";

export type PublicProductDetailsItem = {
  id: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  price: number;
};

export function ProductDetailsDialog({
  open,
  onOpenChange,
  item,
  groups,
  options,
  onAdd,
  loading = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PublicProductDetailsItem | null;
  groups: ProductOptionGroup[];
  options: ProductOption[];
  onAdd: (input: {
    item: PublicProductDetailsItem;
    selections: SelectedOption[];
    finalPrice: number;
  }) => void;
  loading?: boolean;
}) {
  const [selections, setSelections] = useState<SelectedOption[]>([]);

  useEffect(() => {
    if (open) setSelections([]);
  }, [open, item?.id]);

  const productGroups = useMemo(
    () =>
      item
        ? groups
            .filter((group) => group.product_id === item.id)
            .sort((a, b) => a.display_order - b.display_order)
        : [],
    [groups, item],
  );

  const groupIds = useMemo(() => new Set(productGroups.map((group) => group.id)), [productGroups]);

  const productOptions = useMemo(
    () =>
      options
        .filter((option) => groupIds.has(option.group_id) && option.active)
        .sort((a, b) => a.display_order - b.display_order),
    [options, groupIds],
  );

  const visibleGroups = useMemo(
    () =>
      productGroups.filter((group) => {
        if (!group.depends_on_option_id) return true;
        return selections.some((selection) => selection.option_id === group.depends_on_option_id);
      }),
    [productGroups, selections],
  );

  const validation = useMemo(
    () => ConfigurationRuleEngine.validate(productGroups, productOptions, selections),
    [productGroups, productOptions, selections],
  );

  const finalPrice = useMemo(
    () =>
      item
        ? PriceCalculationStrategy.calculate(item.price, productGroups, productOptions, selections)
        : 0,
    [item, productGroups, productOptions, selections],
  );

  function selectedQuantity(groupId: string, optionId: string) {
    return (
      selections.find(
        (selection) => selection.group_id === groupId && selection.option_id === optionId,
      )?.quantity ?? 0
    );
  }

  function groupQuantity(groupId: string) {
    return selections
      .filter((selection) => selection.group_id === groupId)
      .reduce((sum, selection) => sum + selection.quantity, 0);
  }

  function selectSingle(group: ProductOptionGroup, option: ProductOption) {
    setSelections((current) => [
      ...current.filter((selection) => selection.group_id !== group.id),
      { group_id: group.id, option_id: option.id, quantity: 1 },
    ]);
  }

  function changeQuantity(group: ProductOptionGroup, option: ProductOption, delta: number) {
    setSelections((current) => {
      const existing = current.find(
        (selection) => selection.group_id === group.id && selection.option_id === option.id,
      );
      const currentQty = existing?.quantity ?? 0;
      const totalInGroup = current
        .filter((selection) => selection.group_id === group.id)
        .reduce((sum, selection) => sum + selection.quantity, 0);
      const nextQty = currentQty + delta;

      if (delta > 0) {
        if (currentQty >= option.max_quantity) return current;
        if (group.max_selection > 0 && totalInGroup >= group.max_selection) return current;
      }

      const without = current.filter(
        (selection) => !(selection.group_id === group.id && selection.option_id === option.id),
      );
      if (nextQty <= 0) return without;
      return [...without, { group_id: group.id, option_id: option.id, quantity: nextQty }];
    });
  }

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto rounded-2xl p-0">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onOpenChange(false)}
          className="absolute left-3 top-3 z-20 rounded-full bg-background/90 px-3 shadow-md backdrop-blur"
          aria-label="Voltar ao cardápio"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Voltar
        </Button>
        <div className="overflow-hidden rounded-t-2xl bg-muted">
          {item.image_url ? (
            <img src={item.image_url} alt={item.name} className="h-56 w-full object-cover" />
          ) : (
            <div className="grid h-40 place-items-center text-sm text-muted-foreground">
              Sem imagem
            </div>
          )}
        </div>

        <div className="space-y-5 px-5 pb-5">
          <DialogHeader className="text-left">
            <DialogTitle className="font-display text-2xl">{item.name}</DialogTitle>
            {item.description && (
              <DialogDescription className="whitespace-pre-line text-sm leading-relaxed">
                {item.description}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">A partir de</span>
            <span className="font-display text-xl font-extrabold text-primary">{brl(item.price)}</span>
          </div>

          {loading && (
            <p className="rounded-lg bg-muted px-3 py-3 text-sm text-muted-foreground">
              Carregando opções do produto...
            </p>
          )}

          {!loading && visibleGroups.map((group) => {
            const groupOptions = productOptions.filter((option) => option.group_id === group.id);
            const totalSelected = groupQuantity(group.id);
            const isSingle = group.type === "SINGLE" || group.type === "BOOLEAN";

            return (
              <section key={group.id} className="space-y-2 border-t pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{group.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {group.description?.trim() ||
                        (isSingle
                          ? "Escolha 1 opção"
                          : group.max_selection > 0
                            ? `Escolha até ${group.max_selection} opções`
                            : "Escolha as opções desejadas")}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[10px] font-bold uppercase">
                    {group.required ? "Obrigatório" : "Opcional"}
                  </span>
                </div>

                <div className="space-y-2">
                  {groupOptions.map((option) => {
                    const qty = selectedQuantity(group.id, option.id);
                    const selected = qty > 0;
                    const groupAtMax =
                      group.max_selection > 0 && totalSelected >= group.max_selection;
                    const optionAtMax = qty >= option.max_quantity;

                    return (
                      <div
                        key={option.id}
                        className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${
                          selected ? "border-primary bg-primary/5" : "bg-background"
                        }`}
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() =>
                            isSingle
                              ? selectSingle(group, option)
                              : changeQuantity(group, option, selected ? -qty : 1)
                          }
                        >
                          <p className="text-sm font-medium">{option.name}</p>
                          {option.description && (
                            <p className="text-xs text-muted-foreground">{option.description}</p>
                          )}
                          {option.price_adjustment > 0 && (
                            <p className="mt-1 text-xs font-semibold text-primary">
                              + {brl(option.price_adjustment)}
                            </p>
                          )}
                        </button>

                        {isSingle ? (
                          <button
                            type="button"
                            aria-label={`Selecionar ${option.name}`}
                            onClick={() => selectSingle(group, option)}
                            className={`h-5 w-5 rounded-full border-2 ${
                              selected ? "border-primary bg-primary shadow-[inset_0_0_0_4px_white]" : ""
                            }`}
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            {qty > 0 && (
                              <>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="outline"
                                  className="h-8 w-8 rounded-full"
                                  onClick={() => changeQuantity(group, option, -1)}
                                >
                                  <Minus className="h-3.5 w-3.5" />
                                </Button>
                                <span className="w-5 text-center text-sm font-semibold">{qty}</span>
                              </>
                            )}
                            <Button
                              type="button"
                              size="icon"
                              variant={qty > 0 ? "outline" : "default"}
                              className="h-8 w-8 rounded-full"
                              disabled={optionAtMax || (groupAtMax && qty === 0)}
                              onClick={() => changeQuantity(group, option, 1)}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {!loading && !validation.valid && productGroups.length > 0 && (
            <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              Complete as escolhas obrigatórias para adicionar este produto.
            </p>
          )}

          <Button
            type="button"
            className="h-12 w-full rounded-xl text-base font-bold"
            disabled={loading || !validation.valid}
            onClick={() => {
              onAdd({ item, selections, finalPrice });
              onOpenChange(false);
            }}
          >
            Adicionar ao carrinho · {brl(finalPrice)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
