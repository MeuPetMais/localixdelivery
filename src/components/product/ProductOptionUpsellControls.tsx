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

  useEffect(() => {
    setName(option.name);
    setPrice(String(option.price_adjustment));
    setMaxQuantity(String(option.max_quantity));
  }, [option.id, option.name, option.price_adjustment, option.max_quantity]);

  return (
    <div className="grid gap-2 rounded-lg bg-muted/30 p-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_7rem_5rem_auto]">
        <Input value={name} onChange={(event) => setName(event.target.value)} />
        <Input
          inputMode="decimal"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
        />
        <Input
          type="number"
          min={1}
          value={maxQuantity}
          onChange={(event) => setMaxQuantity(event.target.value)}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            onSave(option, {
              name,
              price_adjustment: Number(price.replace(",", ".")) || 0,
              max_quantity: Math.max(1, Number(maxQuantity) || 1),
            })
          }
          disabled={saving}
        >
          Salvar
        </Button>
      </div>
      <ToggleRow
        label="Ativo"
        checked={option.active}
        onChange={(value) => onSave(option, { active: value })}
      />
      <ToggleRow
        label="Exibir em “Turbine seu lanche”"
        checked={upsellEnabled}
        onChange={(value) => onToggleUpsell(option, value)}
      />
      <p className="text-xs text-muted-foreground">
        Permite sugerir este adicional ao cliente logo após adicionar o produto ao carrinho.
      </p>
      {upsellEnabled && (
        <div className="space-y-1.5">
          <Label>Prioridade no Turbine</Label>
          <Input
            type="number"
            min={1}
            value={typeof priority === "number" ? priority : ""}
            onChange={(event) => onSetUpsellPriority(option, event.target.value)}
            placeholder="opcional"
          />
          <p className="text-xs text-muted-foreground">Números menores aparecem primeiro.</p>
        </div>
      )}
      {saving && <p className="text-xs text-muted-foreground">Salvando...</p>}
    </div>
  );
}
