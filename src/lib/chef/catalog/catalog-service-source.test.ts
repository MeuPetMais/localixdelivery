import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sourcePath = new URL("./catalog-service.ts", import.meta.url);
const source = readFileSync(sourcePath, "utf8");

describe("Chef Catalog Service source contract", () => {
  it("filtra as consultas principais por restaurantId", () => {
    const occurrences = source.match(/\.eq\("restaurant_id", restaurantId\)/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(3);
    expect(source).toContain('.from("menu_items")');
    expect(source).toContain('.from("menu_categories")');
    expect(source).toContain('.from("product_option_groups")');
  });

  it("usa a regra compartilhada de promoção para formar o preço efetivo", () => {
    expect(source).toContain('import { isPromoActiveNow } from "@/lib/promotions"');
    expect(source).toContain("const promotionActive = isPromoActiveNow(item, now)");
    expect(source).toContain(
      "effectivePrice: promotionActive ? Number(item.promo_price) : Number(item.price)",
    );
  });

  it("mantém o serviço somente leitura", () => {
    expect(source).not.toMatch(/\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.rpc\(/);
  });
});
