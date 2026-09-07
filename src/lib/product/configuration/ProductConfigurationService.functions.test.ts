import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  mergeExistingOptionMetadata,
  normalizeGroupName,
  validateCloneDependencies,
} from "./ProductConfigurationService.functions";

describe("ProductConfigurationService option metadata", () => {
  it("merges partial metadata instead of replacing existing keys", () => {
    expect(
      mergeExistingOptionMetadata({ foo: "bar", upsell_priority: 5 }, { upsell_enabled: true }),
    ).toEqual({ foo: "bar", upsell_priority: 5, upsell_enabled: true });
  });

  it("preserves partial priority updates", () => {
    expect(
      mergeExistingOptionMetadata({ foo: "bar", upsell_enabled: true }, { upsell_priority: 1 }),
    ).toEqual({ foo: "bar", upsell_enabled: true, upsell_priority: 1 });
  });

  it("keeps public reads and owner-scoped writes for product options", () => {
    const sql = readFileSync(
      "supabase/migrations/20260703162528_b32a24a3-38c3-4a38-82e9-092540939924.sql",
      "utf8",
    );

    expect(sql).toContain("GRANT SELECT ON public.product_options TO anon");
    expect(sql).not.toContain("GRANT INSERT, UPDATE, DELETE ON public.product_options TO anon");
    expect(sql).toContain('CREATE POLICY "po_public_read" ON public.product_options FOR SELECT');
    expect(sql).toContain('CREATE POLICY "po_owner_all" ON public.product_options FOR ALL');
    expect(sql).toContain("r.owner_id=auth.uid()");
  });
});


describe("ProductConfigurationService clone helpers", () => {
  it("normalizes group names for duplicate protection", () => {
    expect(normalizeGroupName("  Qual Ponto da Carne? ")).toBe("qual ponto da carne?");
  });

  it("rejects a copied group when its dependency is outside the selection", () => {
    const groups = [
      {
        id: "dependent",
        product_id: "source",
        name: "Molhos",
        type: "MULTIPLE",
        min_selection: 0,
        max_selection: 2,
        required: false,
        price_strategy: "SUM",
        display_order: 1,
        depends_on_group_id: "base",
        depends_on_option_id: null,
      },
    ] as any;

    expect(validateCloneDependencies(groups, [])).toEqual([
      'O grupo "Molhos" depende de outro grupo que também precisa ser selecionado.',
    ]);
  });

  it("accepts dependencies when the referenced group and option are selected", () => {
    const groups = [
      {
        id: "base",
        product_id: "source",
        name: "Base",
        type: "SINGLE",
        min_selection: 1,
        max_selection: 1,
        required: true,
        price_strategy: "SUM",
        display_order: 0,
      },
      {
        id: "dependent",
        product_id: "source",
        name: "Molhos",
        type: "MULTIPLE",
        min_selection: 0,
        max_selection: 2,
        required: false,
        price_strategy: "SUM",
        display_order: 1,
        depends_on_group_id: "base",
        depends_on_option_id: "base-option",
      },
    ] as any;

    const options = [
      {
        id: "base-option",
        group_id: "base",
        name: "Tradicional",
        price_adjustment: 0,
        max_quantity: 1,
        display_order: 0,
        active: true,
      },
    ] as any;

    expect(validateCloneDependencies(groups, options)).toEqual([]);
  });
});
