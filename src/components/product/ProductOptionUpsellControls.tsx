import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ProductOption } from "@/lib/product/configuration/types";

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function formatBrl(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

export function ProductOptionUpsellControls({
  option,
  saving,
  onSave,
  onToggleUpsell,
  onSetUpsellPriority,
}: {
  option: ProductOption;
  saving: boolean;
  onSave: (option: ProductOption, patch: Partial<ProductOption>) => Promise<void>;
  onToggleUpsell: (option: ProductOption, enabled: boolean) => Promise<void>;
  onSetUpsellPriority: (option: ProductOption, value: string) => Promise<void>;
}) {
  const [name, setName] = useState(option.name);
  const [price, setPrice] = useState(String(option.price_adjustment));
  const [maxQuantity, setMaxQuantity] = useState(String(option.max_quantity));
  const upsellEnabled = option.metadata?.upsell_enabled === true;
  const priority = option.metadata?.upsell_priority;
  const previewPrice = Number(price.replace(",", ".")) || 0;

  useEffect(() => {
    setName(option.name);
    setPrice(String(option.price_adjustment));
    setMaxQuantity(String(option.max_quantity));
  }, [option.id, option.name, option.price_adjustment, option.max_quantity]);

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <div>
        <p className="text-sm font-semibold">Configuração do adicional</p>
        <p className="text-xs text-muted-foreground">
          Defina o nome, o preço extra e quantas unidades o cliente pode selecionar.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Nome do adicional</Label>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: Bacon extra"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Preço adicional (R$)</Label>
          <Input
            inputMode="decimal"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder="Ex.: 4,00"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Quantidade máxima</Label>
          <Input
            type="number"
            min={1}
            value={maxQuantity}
            onChange={(event) => setMaxQuantity(event.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <ToggleRow
          label="Adicional ativo"
          checked={option.active}
          onChange={(value) => onSave(option, { active: value })}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            onSave(option, {
              name,
              price_adjustment: previewPrice,
              max_quantity: Math.max(1, Number(maxQuantity) || 1),
            })
          }
          disabled={saving}
        >
          Salvar adicional
        </Button>
      </div>

      <div className="space-y-3 rounded-lg border bg-background p-3">
        <div>
          <p className="text-sm font-semibold">🚀 Turbine seu lanche</p>
          <p className="text-xs text-muted-foreground">
            Escolha se este adicional também será oferecido logo após o cliente adicionar o
            produto ao carrinho.
          </p>
        </div>

        <ToggleRow
          label="Oferecer este adicional no Turbine"
          checked={upsellEnabled}
          onChange={(value) => onToggleUpsell(option, value)}
        />

        {upsellEnabled && (
          <>
            <div className="space-y-1.5">
              <Label>Ordem de exibição</Label>
              <Input
                type="number"
                min={1}
                value={typeof priority === "number" ? priority : ""}
                onChange={(event) => onSetUpsellPriority(option, event.target.value)}
                placeholder="Ex.: 1"
              />
              <p className="text-xs text-muted-foreground">
                1 aparece primeiro, 2 aparece depois e assim por diante.
              </p>
            </div>

            <div className="rounded-md bg-muted/40 p-3">
              <p className="text-xs font-medium text-muted-foreground">Como o cliente verá</p>
              <div className="mt-1 flex items-center justify-between gap-3 text-sm">
                <span className="font-medium">{name || "Adicional"}</span>
                <span className="font-semibold text-primary">+ {formatBrl(previewPrice)}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {saving && <p className="text-xs text-muted-foreground">Salvando...</p>}
    </div>
  );
}
