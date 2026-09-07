import { useEffect, useMemo, useState } from "react";
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
import { Plus, Trash2 } from "lucide-react";
import { brl } from "@/lib/format";
import type { ProductOption, ProductOptionGroup } from "@/lib/product/configuration/types";
import { ProductOptionUpsellControls } from "@/components/product/ProductOptionUpsellControls";

type WizardStep = 1 | 2 | 3;

export function ProductOptionGroupWizard({
  group,
  options,
  savingId,
  editingOptionId,
  onSetEditingOptionId,
  onSaveGroup,
  onAddOption,
  onSaveOption,
  onDeleteOption,
  onClose,
}: {
  group: ProductOptionGroup;
  options: ProductOption[];
  savingId: string | null;
  editingOptionId: string | null;
  onSetEditingOptionId: (id: string | null) => void;
  onSaveGroup: (group: ProductOptionGroup, patch: Partial<ProductOptionGroup>) => Promise<void>;
  onAddOption: (group: ProductOptionGroup) => Promise<void>;
  onSaveOption: (option: ProductOption, patch: Partial<ProductOption>) => Promise<void>;
  onDeleteOption: (option: ProductOption) => Promise<void>;
  onClose: () => void;
}) {
  const [step, setStep] = useState<WizardStep>(1);
  const [name, setName] = useState(group.name === "Novo grupo" ? "" : group.name);
  const [type, setType] = useState<"SINGLE" | "MULTIPLE">(
    group.type === "SINGLE" ? "SINGLE" : "MULTIPLE",
  );
  const [required, setRequired] = useState(group.required);
  const [description, setDescription] = useState(group.description ?? "");
  const [minSelection, setMinSelection] = useState(String(group.min_selection));
  const [maxSelection, setMaxSelection] = useState(String(group.max_selection));

  useEffect(() => {
    setDescription(group.description ?? "");
    setMinSelection(String(group.min_selection));
    setMaxSelection(String(group.max_selection));
  }, [group.description, group.min_selection, group.max_selection]);

  const stepTitle = useMemo(
    () => ({
      1: "Pergunta",
      2: "Opções",
      3: "Regras",
    })[step],
    [step],
  );

  async function saveBasics() {
    const cleanName = name.trim();
    if (!cleanName) return;
    const min = type === "SINGLE" ? (required ? 1 : 0) : required ? Math.max(1, group.min_selection) : group.min_selection;
    const max = type === "SINGLE" ? 1 : Math.max(min || 1, group.max_selection || 4);
    await onSaveGroup(group, {
      name: cleanName,
      type,
      required,
      min_selection: min,
      max_selection: max,
    });
    setStep(2);
  }

  async function finish() {
    const normalizedMin =
      type === "SINGLE"
        ? required
          ? 1
          : 0
        : required
          ? Math.max(1, Number(minSelection) || 1)
          : Math.max(0, Number(minSelection) || 0);
    const normalizedMax =
      type === "SINGLE"
        ? 1
        : Math.max(normalizedMin || 1, Number(maxSelection) || Math.max(normalizedMin, 1));

    await onSaveGroup(group, {
      description: description.trim() || null,
      min_selection: normalizedMin,
      max_selection: normalizedMax,
    });
    onClose();
  }

  return (
    <div className="space-y-4 rounded-lg bg-background p-3">
      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">Configurar grupo</p>
          <span className="text-xs font-medium text-muted-foreground">Etapa {step} de 3</span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1">
          {[1, 2, 3].map((value) => (
            <div
              key={value}
              className={`h-1.5 rounded-full ${value <= step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{stepTitle}</p>
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <p className="text-base font-semibold">O que você quer perguntar ao cliente?</p>
            <p className="text-xs text-muted-foreground">
              Ex.: “Qual o ponto da carne?” ou “Deseja adicionar molhos?”
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Pergunta</Label>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Qual o ponto da carne?"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Como o cliente poderá responder?</Label>
            <Select value={type} onValueChange={(value) => setType(value as "SINGLE" | "MULTIPLE")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SINGLE">Apenas 1 opção</SelectItem>
                <SelectItem value="MULTIPLE">Várias opções</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <div>
              <p className="text-sm font-medium">Resposta obrigatória</p>
              <p className="text-xs text-muted-foreground">
                O cliente precisa responder antes de adicionar o produto.
              </p>
            </div>
            <Switch checked={required} onCheckedChange={setRequired} />
          </div>

          <div className="flex justify-between gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" onClick={saveBasics} disabled={!name.trim() || savingId === group.id}>
              Continuar
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <div>
            <p className="text-base font-semibold">Quais opções o cliente poderá escolher?</p>
            <p className="text-xs text-muted-foreground">
              Cadastre as respostas deste grupo. O Turbine será configurado depois, fora desta etapa.
            </p>
          </div>

          <div className="space-y-2">
            {options.map((option) => (
              <div key={option.id} className="rounded-lg border">
                <div className="flex items-center gap-2 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{option.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {option.price_adjustment > 0 ? `+ ${brl(option.price_adjustment)}` : "Sem acréscimo"}
                      {" · "}Máx. {option.max_quantity}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      onSetEditingOptionId(editingOptionId === option.id ? null : option.id)
                    }
                  >
                    {editingOptionId === option.id ? "Fechar" : "Editar"}
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Excluir opção ${option.name}`}
                    onClick={() => onDeleteOption(option)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>

                {editingOptionId === option.id && (
                  <div className="border-t p-3">
                    <ProductOptionUpsellControls
                      option={option}
                      saving={savingId === option.id}
                      onSave={onSaveOption}
                      onCancel={() => onSetEditingOptionId(null)}
                      showUpsell={false}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => onAddOption(group)}
            disabled={savingId === `new-option:${group.id}`}
          >
            <Plus className="mr-2 h-4 w-4" /> Adicionar opção
          </Button>

          {options.length === 0 && (
            <p className="text-center text-xs text-muted-foreground">
              Adicione pelo menos uma opção para continuar.
            </p>
          )}

          <div className="flex justify-between gap-2">
            <Button type="button" variant="ghost" onClick={() => setStep(1)}>
              Voltar
            </Button>
            <Button type="button" onClick={() => setStep(3)} disabled={options.length === 0}>
              Continuar
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div>
            <p className="text-base font-semibold">Revise as regras do grupo</p>
            <p className="text-xs text-muted-foreground">
              Os valores recomendados já estão preenchidos. Altere somente se precisar.
            </p>
          </div>

          <div className="rounded-md bg-muted/40 p-3 text-sm">
            <p className="font-medium">{name || group.name}</p>
            <p className="text-xs text-muted-foreground">
              {type === "SINGLE"
                ? "O cliente escolhe 1 opção."
                : required
                  ? "O cliente deve respeitar o mínimo e o máximo."
                  : "O cliente pode escolher dentro do limite máximo."}
              {" · "}
              {required ? "Obrigatório" : "Opcional"}
            </p>
          </div>

          {type === "MULTIPLE" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Mínimo</Label>
                <Input
                  type="number"
                  min={required ? 1 : 0}
                  value={minSelection}
                  onChange={(event) => setMinSelection(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Máximo</Label>
                <Input
                  type="number"
                  min={1}
                  value={maxSelection}
                  onChange={(event) => setMaxSelection(event.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Texto de apoio (opcional)</Label>
            <Input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Ex.: Escolha 1 opção"
            />
            <p className="text-xs text-muted-foreground">
              Use apenas para orientar o cliente. As respostas ficam na etapa anterior.
            </p>
          </div>

          <div className="flex justify-between gap-2">
            <Button type="button" variant="ghost" onClick={() => setStep(2)}>
              Voltar
            </Button>
            <Button type="button" onClick={finish} disabled={savingId === group.id}>
              Concluir
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
