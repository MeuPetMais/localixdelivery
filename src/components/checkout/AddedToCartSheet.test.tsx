import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { AddedToCartSheet } from "./AddedToCartSheet";

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const lastAdded = {
  lineId: "line:burger",
  id: "burger",
  name: "Burger",
  price: 25,
  qty: 1,
  image_url: null,
};

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  lastAdded,
  subtotal: 25,
  minOrder: 0,
  suggestions: [
    {
      id: "fries",
      name: "Batata frita",
      price: 12,
      image_url: null,
    },
  ],
  onAddSuggestion: vi.fn(),
  onContinue: vi.fn(),
  onGoToCart: vi.fn(),
};

describe("AddedToCartSheet turbine section", () => {
  it("does not render Turbine when there are no candidates", () => {
    const html = renderToStaticMarkup(<AddedToCartSheet {...baseProps} turbineCandidates={[]} />);

    expect(html).not.toContain("Turbine seu Burger");
  });

  it("renders cross-sell below Turbine when candidates exist", () => {
    const html = renderToStaticMarkup(
      <AddedToCartSheet
        {...baseProps}
        turbineCandidates={[
          {
            id: "bacon",
            name: "Bacon",
            price_adjustment: 5,
            groupId: "extras",
            groupName: "Adicionais",
            selectedQuantity: 0,
            maxQuantity: 1,
            canIncrement: true,
          },
        ]}
      />,
    );

    const turbineIndex = html.indexOf("Turbine seu Burger");
    const crossSellIndex = html.indexOf("Batata frita");

    expect(turbineIndex).toBeGreaterThanOrEqual(0);
    expect(html).toContain("Bacon");
    expect(html).toContain("Adicionar");
    expect(crossSellIndex).toBeGreaterThan(turbineIndex);
  });

  it("renders added state and remove action for selected single-quantity candidates", () => {
    const html = renderToStaticMarkup(
      <AddedToCartSheet
        {...baseProps}
        turbineCandidates={[
          {
            id: "bacon",
            name: "Bacon",
            price_adjustment: 5,
            groupId: "extras",
            groupName: "Adicionais",
            selectedQuantity: 1,
            maxQuantity: 1,
            canIncrement: false,
          },
        ]}
      />,
    );

    expect(html).toContain("Adicionado");
    expect(html).toContain("Remover");
  });

  it("renders quantity controls for multi-quantity candidates", () => {
    const html = renderToStaticMarkup(
      <AddedToCartSheet
        {...baseProps}
        turbineCandidates={[
          {
            id: "bacon",
            name: "Bacon",
            price_adjustment: 5,
            groupId: "extras",
            groupName: "Adicionais",
            selectedQuantity: 2,
            maxQuantity: 3,
            canIncrement: true,
          },
        ]}
      />,
    );

    expect(html).toContain(">2<");
  });
});
