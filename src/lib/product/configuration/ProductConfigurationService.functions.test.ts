import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mergeExistingOptionMetadata } from "./ProductConfigurationService.functions";

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
