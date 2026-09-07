import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  cloneConfigurationGroups,
  listConfiguration,
} from "@/lib/product/configuration/ProductConfigurationService.functions";
import type { ProductOptionGroup } from "@/lib/product/configuration/types";
import { toast } from "sonner";

type SourceProduct = {
  id: string;
  name: string;
};

function normalizeName(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

export function ProductOptionsCopyDialog({
  restaurantId,
  targetProductId,
  targetGroups,
}: {
  restaurantId: string;
  targetProductId: string;
  targetGroups: ProductOptionGroup[];
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [sourceProductId, setSourceProductId] = useState("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [copying, setCopying] = useState(false);

  const { data: products = [], isLoading: loadingProducts } = useQuery<SourceProduct[]>({
    queryKey: ["product-options-copy-sources", restaurantId, targetProductId],
    enabled: open && !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("id, name")
        .eq("restaurant_id", restaurantId)
        .neq("id", targetProductId)
        .order("name");
      if (error) throw error;
      return (data ?? []) as SourceProduct[];
    },
  });

  const { data: sourceConfig, isLoading: loadingConfig } = useQuery({
    queryKey: ["product-options-copy-config", sourceProductId],
    enabled: open && !!sourceProductId,
    queryFn: () => listConfiguration({ data: { product_id: sourceProductId } }),
  });

  const existingNames = useMemo(
    () => new Set(targetGroups.map((group) => normalizeName(group.name))),
    [targetGroups],
  );

  const sourceGroups = sourceConfig?.groups ?? [];
  const sourceOptions = sourceConfig?.options ?? [];

  function optionCount(groupId: string) {
    return sourceOptions.filter((option) => option.group_id === groupId).length;
  }

  function toggleGroup(groupId: string, checked: boolean) {
    setSelectedGroupIds((current) =>
      checked
        ? Array.from(new Set([...current, groupId]))
        : current.filter((id) => id !== groupId),
    );
  }

  async function copySelected() {
    if (!sourceProductId || selectedGroupIds.length === 0) return;

    setCopying(true);
    try {
      const result = await cloneConfigurationGroups({
        data: {
          source_product_id: sourceProductId,
          target_product_id: targetProductId,
          group_ids: selectedGroupIds,
        },
      });

      await qc.invalidateQueries({ queryKey: ["product-configuration", targetProductId] });
      toast.success(
        `${result.copied_groups} grupo(s) e ${result.copied_options} opção(ões) copiados de ${result.source_product_name}.`,
      );
      setOpen(false);
      setSourceProductId("");
      setSelectedGroupIds([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível copiar as opções.");
    } finally {
      setCopying(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setSourceProductId("");
          setSelectedGroupIds([]);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          <Copy className="mr-2 h-3.5 w-3.5" />
          Copiar de outro produto
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Copiar opções de outro produto</DialogTitle>
          <DialogDescription>
            Escolha um produto já configurado e copie somente os grupos que deseja. As cópias ficam
            independentes e podem ser editadas depois sem alterar o produto de origem.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Produto de origem</label>
            <Select
              value={sourceProductId}
              onValueChange={(value) => {
                setSourceProductId(value);
                setSelectedGroupIds([]);
              }}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={loadingProducts ? "Carregando produtos..." : "Selecione um produto"}
                />
              </SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {sourceProductId && loadingConfig && (
            <div className="flex items-center gap-2 rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando grupos...
            </div>
          )}

          {sourceProductId && !loadingConfig && sourceGroups.length === 0 && (
            <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
              Este produto ainda não possui grupos de opções.
            </p>
          )}

          {sourceGroups.length > 0 && (
            <div className="space-y-2">
              <div>
                <p className="text-sm font-semibold">O que deseja copiar?</p>
                <p className="text-xs text-muted-foreground">
                  Preços, limites, obrigatoriedade e configuração do Turbine serão preservados.
                </p>
              </div>

              {sourceGroups.map((group) => {
                const alreadyExists = existingNames.has(normalizeName(group.name));
                const checked = selectedGroupIds.includes(group.id);

                return (
                  <label
                    key={group.id}
                    className={`flex items-start gap-3 rounded-lg border p-3 ${
                      alreadyExists ? "opacity-55" : "cursor-pointer"
                    }`}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={alreadyExists}
                      onCheckedChange={(value) => toggleGroup(group.id, value === true)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{group.name}</span>
                        {group.required && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">
                            Obrigatório
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {optionCount(group.id)} opção(ões)
                        {group.type === "SINGLE"
                          ? " · Escolha 1"
                          : ` · Até ${group.max_selection} escolhas`}
                      </p>
                      {alreadyExists && (
                        <p className="mt-1 text-xs font-medium text-amber-700">
                          Já existe um grupo com este nome no produto atual.
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={copying}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={copySelected}
            disabled={copying || selectedGroupIds.length === 0}
          >
            {copying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Copiar selecionados
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
