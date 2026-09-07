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
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

export function ProductOptionUpsellControls({
  option,
  saving,
  onSave,
  onToggleUpsell,
  onSetUpsellPriority,
  onCancel,
}: {
  option: ProductOption;
  saving: boolean;
  onSave: (option: ProductOption, patch: Partial<ProductOption>) => Promise<void>;
  onToggleUpsell: (option: ProductOption, enabled: boolean) => Promise<void>;
  onSetUpsellPriority: (option: ProductOption, value: string) => Promise<void>;
  onCancel?: () => void;
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
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Nome da opção</Label>
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Preço adicional (R$)</Label>
          <Input
            inputMode="decimal"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Máximo por pedido</Label>
          <Input
            type="number"
            min={1}
            value={maxQuantity}
            onChange={(event) => setMaxQuantity(event.target.value)}
          />
        </div>
      </div>

      <ToggleRow
        label="Opção ativa"
        checked={option.active}
        onChange={(value) => onSave(option, { active: value })}
      />

      <div className="rounded-lg border bg-background p-3">
        <ToggleRow
          label="Oferecer também no Turbine"
          checked={upsellEnabled}
          onChange={(value) => onToggleUpsell(option, value)}
        />
        {upsellEnabled && (
          <div className="mt-2 space-y-1.5">
            <Label>Ordem no Turbine</Label>
            <Input
              type="number"
              min={1}
              value={typeof priority === "number" ? priority : ""}
              onChange={(event) => onSetUpsellPriority(option, event.target.value)}
              placeholder="1"
            />
            <p className="text-xs text-muted-foreground">
              Prévia: {name || "Opção"} · + {formatBrl(previewPrice)}
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            onSave(option, {
              name: name.trim() || option.name,
              price_adjustment: previewPrice,
              max_quantity: Math.max(1, Number(maxQuantity) || 1),
            })
          }
          disabled={saving}
        >
          Salvar opção
        </Button>
      </div>

      {saving && <p className="text-xs text-muted-foreground">Salvando...</p>}
    </div>
  );
}
