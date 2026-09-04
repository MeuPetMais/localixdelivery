import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ProductOption } from "@/lib/product/configuration/types";
import { ProductOptionUpsellControls } from "@/components/product/ProductOptionUpsellControls";

const option = (overrides: Partial<ProductOption> = {}): ProductOption => ({
  id: "bacon",
  group_id: "extras",
  name: "Bacon",
  description: null,
  price_adjustment: 5,
  max_quantity: 1,
  display_order: 0,
  active: true,
  metadata: { upsell_enabled: true, upsell_priority: 1 },
  ...overrides,
});

describe("menu product option Turbine controls", () => {
  it("renders partner-facing upsell controls without technical metadata copy", () => {
    const html = renderToStaticMarkup(
      <ProductOptionUpsellControls
        option={option()}
        saving={false}
        onSave={vi.fn()}
        onToggleUpsell={vi.fn()}
        onSetUpsellPriority={vi.fn()}
      />,
    );

    expect(html).toContain("Exibir em");
    expect(html).toContain("Turbine seu lanche");
    expect(html).toContain("Prioridade no Turbine");
    expect(html).toContain("Números menores aparecem primeiro.");
    expect(html).not.toContain("metadata");
  });

  it("hides priority input until Turbine is enabled", () => {
    const html = renderToStaticMarkup(
      <ProductOptionUpsellControls
        option={option({ metadata: {} })}
        saving={false}
        onSave={vi.fn()}
        onToggleUpsell={vi.fn()}
        onSetUpsellPriority={vi.fn()}
      />,
    );

    expect(html).toContain("Turbine seu lanche");
    expect(html).not.toContain("Prioridade no Turbine");
  });
});
