import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ProductOption, ProductOptionGroup } from "./types";

type UpsertOptionData = Partial<ProductOption> & { group_id: string; name: string };

export function mergeExistingOptionMetadata(
  existing: ProductOption["metadata"] | null | undefined,
  incoming: ProductOption["metadata"] | null | undefined,
) {
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
    return incoming;
  }
  if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
    return incoming;
  }
  return { ...existing, ...incoming };
}

export const listConfiguration = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { product_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: groups, error: gErr } = await supabase
      .from("product_option_groups")
      .select("*")
      .eq("product_id", data.product_id)
      .order("display_order");
    if (gErr) throw gErr;
    const groupIds = ((groups ?? []) as Array<{ id: string }>).map((g) => g.id);
    let options: unknown[] = [];
    if (groupIds.length) {
      const { data: opts, error: oErr } = await supabase
        .from("product_options")
        .select("*")
        .in("group_id", groupIds)
        .order("display_order");
      if (oErr) throw oErr;
      options = opts ?? [];
    }
    return {
      groups: (groups ?? []) as unknown as ProductOptionGroup[],
      options: options as unknown as ProductOption[],
    } as { groups: ProductOptionGroup[]; options: ProductOption[] };
  });


type CloneConfigurationData = {
  source_product_id: string;
  target_product_id: string;
  group_ids: string[];
};

export function normalizeGroupName(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

export function validateCloneDependencies(
  groups: ProductOptionGroup[],
  options: ProductOption[],
) {
  const selectedGroupIds = new Set(groups.map((group) => group.id));
  const selectedOptionIds = new Set(options.map((option) => option.id));
  const errors: string[] = [];

  for (const group of groups) {
    if (group.depends_on_group_id && !selectedGroupIds.has(group.depends_on_group_id)) {
      errors.push(
        `O grupo "${group.name}" depende de outro grupo que também precisa ser selecionado.`,
      );
    }
    if (group.depends_on_option_id && !selectedOptionIds.has(group.depends_on_option_id)) {
      errors.push(
        `O grupo "${group.name}" depende de uma opção que também precisa ser copiada.`,
      );
    }
  }

  return errors;
}

export const cloneConfigurationGroups = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: CloneConfigurationData) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const groupIds = Array.from(new Set(data.group_ids.filter(Boolean)));

    if (!data.source_product_id || !data.target_product_id || groupIds.length === 0) {
      throw new Error("Selecione ao menos um grupo para copiar.");
    }
    if (data.source_product_id === data.target_product_id) {
      throw new Error("O produto de origem deve ser diferente do produto de destino.");
    }

    const { data: products, error: productsError } = await supabase
      .from("menu_items")
      .select("id, restaurant_id, name")
      .in("id", [data.source_product_id, data.target_product_id]);
    if (productsError) throw productsError;

    const rows = (products ?? []) as Array<{ id: string; restaurant_id: string; name: string }>;
    const sourceProduct = rows.find((row) => row.id === data.source_product_id);
    const targetProduct = rows.find((row) => row.id === data.target_product_id);

    if (!sourceProduct || !targetProduct) {
      throw new Error("Produto de origem ou destino não encontrado para esta conta.");
    }
    if (sourceProduct.restaurant_id !== targetProduct.restaurant_id) {
      throw new Error("Só é possível copiar opções entre produtos do mesmo restaurante.");
    }

    const { data: sourceGroupsRaw, error: sourceGroupsError } = await supabase
      .from("product_option_groups")
      .select("*")
      .eq("product_id", data.source_product_id)
      .in("id", groupIds)
      .order("display_order");
    if (sourceGroupsError) throw sourceGroupsError;

    const sourceGroups = (sourceGroupsRaw ?? []) as unknown as ProductOptionGroup[];
    if (sourceGroups.length !== groupIds.length) {
      throw new Error("Um ou mais grupos selecionados não pertencem ao produto de origem.");
    }

    const { data: sourceOptionsRaw, error: sourceOptionsError } = await supabase
      .from("product_options")
      .select("*")
      .in("group_id", groupIds)
      .order("display_order");
    if (sourceOptionsError) throw sourceOptionsError;
    const sourceOptions = (sourceOptionsRaw ?? []) as unknown as ProductOption[];

    const dependencyErrors = validateCloneDependencies(sourceGroups, sourceOptions);
    if (dependencyErrors.length > 0) {
      throw new Error(dependencyErrors[0]);
    }

    const { data: targetGroupsRaw, error: targetGroupsError } = await supabase
      .from("product_option_groups")
      .select("id, name, display_order")
      .eq("product_id", data.target_product_id)
      .order("display_order");
    if (targetGroupsError) throw targetGroupsError;

    const targetGroups = (targetGroupsRaw ?? []) as Array<{
      id: string;
      name: string;
      display_order: number;
    }>;
    const existingNames = new Set(targetGroups.map((group) => normalizeGroupName(group.name)));
    const duplicates = sourceGroups
      .filter((group) => existingNames.has(normalizeGroupName(group.name)))
      .map((group) => group.name);

    if (duplicates.length > 0) {
      throw new Error(
        `O produto de destino já possui: ${duplicates.join(", ")}. Remova da seleção ou edite o grupo existente.`,
      );
    }

    const insertedGroupIds: string[] = [];
    const insertedOptionIds: string[] = [];
    const groupIdMap = new Map<string, string>();
    const optionIdMap = new Map<string, string>();
    const baseOrder =
      targetGroups.length > 0
        ? Math.max(...targetGroups.map((group) => Number(group.display_order) || 0)) + 1
        : 0;

    try {
      for (let index = 0; index < sourceGroups.length; index += 1) {
        const group = sourceGroups[index];
        const { data: createdGroup, error: createGroupError } = await supabase
          .from("product_option_groups")
          .insert({
            product_id: data.target_product_id,
            name: group.name,
            description: group.description ?? null,
            type: group.type,
            min_selection: group.min_selection,
            max_selection: group.max_selection,
            required: group.required,
            price_strategy: group.price_strategy,
            display_order: baseOrder + index,
            depends_on_group_id: null,
            depends_on_option_id: null,
            metadata: group.metadata ?? {},
          } as never)
          .select("id")
          .single();
        if (createGroupError) throw createGroupError;

        const newGroupId = (createdGroup as { id: string }).id;
        insertedGroupIds.push(newGroupId);
        groupIdMap.set(group.id, newGroupId);
      }

      for (const sourceOption of sourceOptions) {
        const newGroupId = groupIdMap.get(sourceOption.group_id);
        if (!newGroupId) {
          throw new Error("Falha ao mapear grupo durante a cópia.");
        }

        const { data: createdOption, error: createOptionError } = await supabase
          .from("product_options")
          .insert({
            group_id: newGroupId,
            name: sourceOption.name,
            description: sourceOption.description ?? null,
            price_adjustment: sourceOption.price_adjustment,
            max_quantity: sourceOption.max_quantity,
            image_url: sourceOption.image_url ?? null,
            inventory_reference: sourceOption.inventory_reference ?? null,
            recipe_reference: sourceOption.recipe_reference ?? null,
            display_order: sourceOption.display_order,
            active: sourceOption.active,
            metadata: sourceOption.metadata ?? {},
          } as never)
          .select("id")
          .single();
        if (createOptionError) throw createOptionError;

        const newOptionId = (createdOption as { id: string }).id;
        insertedOptionIds.push(newOptionId);
        optionIdMap.set(sourceOption.id, newOptionId);
      }

      for (const sourceGroup of sourceGroups) {
        const newGroupId = groupIdMap.get(sourceGroup.id);
        if (!newGroupId) continue;

        const dependsOnGroupId = sourceGroup.depends_on_group_id
          ? groupIdMap.get(sourceGroup.depends_on_group_id) ?? null
          : null;
        const dependsOnOptionId = sourceGroup.depends_on_option_id
          ? optionIdMap.get(sourceGroup.depends_on_option_id) ?? null
          : null;

        if (dependsOnGroupId || dependsOnOptionId) {
          const { error: dependencyError } = await supabase
            .from("product_option_groups")
            .update({
              depends_on_group_id: dependsOnGroupId,
              depends_on_option_id: dependsOnOptionId,
            } as never)
            .eq("id", newGroupId);
          if (dependencyError) throw dependencyError;
        }
      }
    } catch (error) {
      if (insertedOptionIds.length > 0) {
        await supabase.from("product_options").delete().in("id", insertedOptionIds);
      }
      if (insertedGroupIds.length > 0) {
        await supabase.from("product_option_groups").delete().in("id", insertedGroupIds);
      }
      throw error;
    }

    return {
      ok: true,
      copied_groups: insertedGroupIds.length,
      copied_options: insertedOptionIds.length,
      source_product_name: sourceProduct.name,
      target_product_name: targetProduct.name,
    };
  });

export const upsertGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Partial<ProductOptionGroup> & { product_id: string; name: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("product_option_groups")
      .upsert(data as never)
      .select()
      .single();
    if (error) throw error;
    return { id: (row as { id: string }).id };
  });

export const upsertOption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: UpsertOptionData) => d)
  .handler(async ({ data, context }) => {
    const payload: UpsertOptionData = { ...data };
    if (payload.id && payload.metadata !== undefined) {
      const { data: existing, error: existingErr } = await context.supabase
        .from("product_options")
        .select("metadata")
        .eq("id", payload.id)
        .single();
      if (existingErr) throw existingErr;
      payload.metadata = mergeExistingOptionMetadata(
        (existing as { metadata?: ProductOption["metadata"] } | null)?.metadata,
        payload.metadata,
      );
    }

    const { data: row, error } = await context.supabase
      .from("product_options")
      .upsert(payload as never)
      .select()
      .single();
    if (error) throw error;
    return { id: (row as { id: string }).id };
  });

export const deleteGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("product_option_groups")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteOption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("product_options").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
