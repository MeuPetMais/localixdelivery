import type { ProductRecord } from "./types";

/**
 * ProductSearchService — client-safe indexer.
 * Builds a searchable projection over products; database full-text will be
 * added in Prompt 13.5.2. This foundation is pure and testable.
 */
export interface ProductSearchDoc {
  id: string;
  restaurant_id: string;
  category_id: string | null;
  name: string;
  tags: string[];
  haystack: string;
}

export interface ProductSearchQuery {
  q?: string;
  categoryId?: string;
  tag?: string;
  status?: string;
}

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export const ProductSearchService = {
  index(products: ProductRecord[], tagsByProduct: Record<string, string[]> = {}): ProductSearchDoc[] {
    return products.map((p) => {
      const tags = tagsByProduct[p.id] ?? [];
      const haystack = normalize([p.name, p.description ?? "", ...tags].join(" "));
      return {
        id: p.id,
        restaurant_id: p.restaurant_id,
        category_id: p.category_id,
        name: p.name,
        tags,
        haystack,
      };
    });
  },

  search(docs: ProductSearchDoc[], query: ProductSearchQuery): ProductSearchDoc[] {
    const q = query.q ? normalize(query.q) : null;
    return docs.filter((d) => {
      if (query.categoryId && d.category_id !== query.categoryId) return false;
      if (query.tag && !d.tags.includes(query.tag)) return false;
      if (q && !d.haystack.includes(q)) return false;
      return true;
    });
  },
} as const;
