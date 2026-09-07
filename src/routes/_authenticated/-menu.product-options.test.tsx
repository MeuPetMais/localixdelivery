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
  it("renders clear partner-facing labels and a customer preview", () => {
    const html = renderToStaticMarkup(
      <ProductOptionUpsellControls
        option={option()}
        saving={false}
        onSave={vi.fn()}
        onToggleUpsell={vi.fn()}
        onSetUpsellPriority={vi.fn()}
      />,
    );

    expect(html).toContain("Nome do adicional");
    expect(html).toContain("Preço adicional (R$)");
    expect(html).toContain("Quantidade máxima");
    expect(html).toContain("Oferecer este adicional no Turbine");
    expect(html).toContain("Ordem de exibição");
    expect(html).toContain("1 aparece primeiro, 2 aparece depois");
    expect(html).toContain("Como o cliente verá");
    expect(html).toContain("Bacon");
    expect(html).not.toContain("metadata");
  });

  it("hides priority and preview until Turbine is enabled", () => {
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
    expect(html).toContain("Oferecer este adicional no Turbine");
    expect(html).not.toContain("Ordem de exibição");
    expect(html).not.toContain("Como o cliente verá");
  });
});
