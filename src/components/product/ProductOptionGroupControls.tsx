import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProductOptionGroup } from "@/lib/product/configuration/types";

export function ProductOptionGroupControls({
  group,
  saving,
  onSave,
}: {
  group: ProductOptionGroup;
  saving: boolean;
  onSave: (group: ProductOptionGroup, patch: Partial<ProductOptionGroup>) => Promise<void>;
}) {
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? "");
  const [required, setRequired] = useState(group.required);
  const [type, setType] = useState<ProductOptionGroup["type"]>(
    group.type === "SINGLE" ? "SINGLE" : "MULTIPLE",
  );
  const [minSelection, setMinSelection] = useState(String(group.min_selection));
  const [maxSelection, setMaxSelection] = useState(String(group.max_selection));

  useEffect(() => {
    setName(group.name);
    setDescription(group.description ?? "");
    setRequired(group.required);
    setType(group.type === "SINGLE" ? "SINGLE" : "MULTIPLE");
    setMinSelection(String(group.min_selection));
    setMaxSelection(String(group.max_selection));
  }, [
    group.id,
    group.name,
    group.description,
    group.required,
    group.type,
    group.min_selection,
    group.max_selection,
  ]);

  const normalizedMin = required
    ? Math.max(1, Number(minSelection) || 1)
    : Math.max(0, Number(minSelection) || 0);

  const normalizedMax =
    type === "SINGLE"
      ? 1
      : Math.max(normalizedMin || 1, Number(maxSelection) || Math.max(normalizedMin, 1));

  const instruction =
    type === "SINGLE"
      ? "O cliente poderá escolher apenas 1 opção."
      : normalizedMin > 0
        ? `O cliente escolherá de ${normalizedMin} até ${normalizedMax} opções.`
        : `O cliente poderá escolher até ${normalizedMax} opções.`;

  return (
    <div className="space-y-3 rounded-lg bg-muted/30 p-3">
      <div>
        <p className="text-sm font-semibold">Condição do grupo</p>
        <p className="text-xs text-muted-foreground">
          Defina a pergunta que o cliente verá e quantas opções ele poderá escolher.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Pergunta para o cliente</Label>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ex.: Qual o ponto da carne?"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Texto de apoio</Label>
        <Input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Ex.: Escolha 1 opção"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Tipo de escolha</Label>
          <Select
            value={type}
            onValueChange={(value) => {
              const next = value as "SINGLE" | "MULTIPLE";
              setType(next);
              if (next === "SINGLE") {
                setMaxSelection("1");
                if (required) setMinSelection("1");
              }
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SINGLE">Escolher uma opção</SelectItem>
              <SelectItem value="MULTIPLE">Escolher várias opções</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end">
          <div className="flex w-full items-center justify-between rounded-md border px-3 py-2">
            <span className="text-sm">Obrigatório</span>
            <Switch
              checked={required}
              onCheckedChange={(value) => {
                setRequired(value);
                if (value && Number(minSelection) < 1) setMinSelection("1");
                if (!value && type === "SINGLE") setMinSelection("0");
              }}
            />
          </div>
        </div>
      </div>

      {type === "MULTIPLE" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Mínimo de escolhas</Label>
            <Input
              type="number"
              min={required ? 1 : 0}
              value={minSelection}
              onChange={(event) => setMinSelection(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Máximo de escolhas</Label>
            <Input
              type="number"
              min={1}
              value={maxSelection}
              onChange={(event) => setMaxSelection(event.target.value)}
            />
          </div>
        </div>
      )}

      <div className="rounded-md bg-background p-3">
        <p className="text-xs font-medium text-muted-foreground">Como o cliente verá</p>
        <p className="mt-1 text-sm font-semibold">{name || "Pergunta do grupo"}</p>
        <p className="text-xs text-muted-foreground">
          {description.trim() || instruction}
          {required ? " • Obrigatório" : " • Opcional"}
        </p>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={saving}
          onClick={() =>
            onSave(group, {
              name: name.trim() || group.name,
              description: description.trim() || null,
              type,
              required,
              min_selection: type === "SINGLE" ? (required ? 1 : 0) : normalizedMin,
              max_selection: normalizedMax,
            })
          }
        >
          Salvar condição
        </Button>
      </div>

      {saving && <p className="text-xs text-muted-foreground">Salvando condição...</p>}
    </div>
  );
}
