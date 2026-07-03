import type { CatalogSearchDoc, CatalogSearchQuery } from "./types";

function norm(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * CatalogSearchService — in-memory indexed search.
 * Prepared for future server-side FTS (tsvector) but works today client-side.
 */
export class CatalogSearchService {
  private readonly docs: CatalogSearchDoc[];
  constructor(docs: CatalogSearchDoc[]) { this.docs = docs; }

  query(q: CatalogSearchQuery): CatalogSearchDoc[] {
    const text = norm(q.text);
    return this.docs.filter((d) => {
      if (q.categoryId && d.categoryId !== q.categoryId) return false;
      if (q.tag && !(d.tags ?? []).map(norm).includes(norm(q.tag))) return false;
      if (q.ingredient && !(d.ingredients ?? []).map(norm).includes(norm(q.ingredient))) return false;
      if (q.sku && norm(d.sku) !== norm(q.sku)) return false;
      if (text) {
        const hay = [d.name, d.categoryName, d.sku, ...(d.tags ?? []), ...(d.ingredients ?? [])]
          .map(norm).join(" ");
        if (!hay.includes(text)) return false;
      }
      return true;
    });
  }
}
