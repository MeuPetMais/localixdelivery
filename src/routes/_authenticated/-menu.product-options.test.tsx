import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ProductOption, ProductOptionGroup } from "@/lib/product/configuration/types";
import { ProductOptionUpsellControls } from "@/components/product/ProductOptionUpsellControls";
import { ProductOptionGroupWizard } from "@/components/product/ProductOptionGroupWizard";

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

const group: ProductOptionGroup = {
  id: "meat-point",
  product_id: "burger",
  name: "Qual o ponto da carne?",
  description: null,
  type: "SINGLE",
  min_selection: 1,
  max_selection: 1,
  required: true,
  price_strategy: "SUM",
  display_order: 0,
};

describe("menu product option Turbine controls", () => {
  it("renders Turbine controls in normal option editing", () => {
    const html = renderToStaticMarkup(
      <ProductOptionUpsellControls
        option={option()}
        saving={false}
        onSave={vi.fn()}
        onToggleUpsell={vi.fn()}
        onSetUpsellPriority={vi.fn()}
      />,
    );

    expect(html).toContain("Nome da opção");
    expect(html).toContain("Preço adicional (R$)");
    expect(html).toContain("Máximo por pedido");
    expect(html).toContain("Oferecer também no Turbine");
    expect(html).toContain("Ordem no Turbine");
    expect(html).toContain("Bacon");
  });

  it("hides Turbine inside the guided option step", () => {
    const html = renderToStaticMarkup(
      <ProductOptionUpsellControls
        option={option()}
        saving={false}
        onSave={vi.fn()}
        showUpsell={false}
      />,
    );

    expect(html).toContain("Nome da opção");
    expect(html).not.toContain("Oferecer também no Turbine");
    expect(html).not.toContain("Ordem no Turbine");
  });
});

describe("product option group wizard", () => {
  it("starts with a simple first step", () => {
    const html = renderToStaticMarkup(
      <ProductOptionGroupWizard
        group={group}
        options={[]}
        savingId={null}
        editingOptionId={null}
        onSetEditingOptionId={vi.fn()}
        onSaveGroup={vi.fn()}
        onAddOption={vi.fn()}
        onSaveOption={vi.fn()}
        onDeleteOption={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(html).toContain("Etapa 1 de 3");
    expect(html).toContain("O que você quer perguntar ao cliente?");
    expect(html).toContain("Como o cliente poderá responder?");
    expect(html).toContain("Resposta obrigatória");
    expect(html).toContain("Continuar");
    expect(html).not.toContain("Mínimo");
    expect(html).not.toContain("Máximo");
    expect(html).not.toContain("Turbine");
  });
});
