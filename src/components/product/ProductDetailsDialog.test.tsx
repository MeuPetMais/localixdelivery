import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ProductDetailsDialog } from "@/components/product/ProductDetailsDialog";
import type { ProductOption, ProductOptionGroup } from "@/lib/product/configuration/types";

const group: ProductOptionGroup = {
  id: "point",
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

const options: ProductOption[] = [
  {
    id: "rare",
    group_id: "point",
    name: "Mal passada",
    price_adjustment: 0,
    max_quantity: 1,
    display_order: 0,
    active: true,
  },
  {
    id: "medium",
    group_id: "point",
    name: "Ao ponto",
    price_adjustment: 0,
    max_quantity: 1,
    display_order: 1,
    active: true,
  },
];

describe("ProductDetailsDialog", () => {
  it("shows full product details and required options", () => {
    const html = renderToStaticMarkup(
      <ProductDetailsDialog
        open
        onOpenChange={vi.fn()}
        item={{
          id: "burger",
          name: "Sanliver Clássico",
          description: "Pão brioche, hambúrguer artesanal 150g e queijo cheddar.",
          image_url: null,
          price: 26.9,
        }}
        groups={[group]}
        options={options}
        onAdd={vi.fn()}
      />,
    );

    expect(html).toContain("Sanliver Clássico");
    expect(html).toContain("Pão brioche");
    expect(html).toContain("Qual o ponto da carne?");
    expect(html).toContain("Obrigatório");
    expect(html).toContain("Mal passada");
    expect(html).toContain("Ao ponto");
    expect(html).toContain("Complete as escolhas obrigatórias");
    expect(html).toContain("disabled");
  });

  it("fails closed while configuration is loading", () => {
    const html = renderToStaticMarkup(
      <ProductDetailsDialog
        open
        loading
        onOpenChange={vi.fn()}
        item={{
          id: "burger",
          name: "Sanliver Clássico",
          price: 26.9,
        }}
        groups={[]}
        options={[]}
        onAdd={vi.fn()}
      />,
    );

    expect(html).toContain("Carregando opções do produto");
    expect(html).toContain("disabled");
  });
});
