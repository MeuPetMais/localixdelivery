import type { ProductLifecycleStatus, ProductRecord } from "./types";

/**
 * ProductLifecycle
 * -----------------
 * Derives a canonical lifecycle status from the existing menu_items flags
 * without altering the underlying schema. Also defines the allowed
 * transitions between states so ProductService can enforce them.
 */

const TRANSITIONS: Record<ProductLifecycleStatus, ProductLifecycleStatus[]> = {
  DRAFT: ["REVIEW", "PUBLISHED", "ARCHIVED"],
  REVIEW: ["DRAFT", "PUBLISHED", "SCHEDULED", "ARCHIVED"],
  PUBLISHED: ["PAUSED", "SCHEDULED", "ARCHIVED", "DISCONTINUED"],
  SCHEDULED: ["PUBLISHED", "PAUSED", "ARCHIVED"],
  PAUSED: ["PUBLISHED", "ARCHIVED", "DISCONTINUED"],
  ARCHIVED: ["DRAFT"],
  DISCONTINUED: [],
};

export const ProductLifecycle = {
  /** Compute lifecycle status from the raw menu_items row flags. */
  fromRecord(p: Pick<ProductRecord, "is_active" | "is_paused" | "promo_starts_at" | "promo_ends_at">): ProductLifecycleStatus {
    if (!p.is_active) return "ARCHIVED";
    if (p.is_paused) return "PAUSED";
    const now = Date.now();
    const starts = p.promo_starts_at ? Date.parse(p.promo_starts_at) : null;
    if (starts && starts > now) return "SCHEDULED";
    return "PUBLISHED";
  },

  /** Convert a target status back into partial menu_items flags. */
  toFlags(status: ProductLifecycleStatus): Partial<Pick<ProductRecord, "is_active" | "is_paused">> {
    switch (status) {
      case "PUBLISHED":
      case "SCHEDULED":
      case "REVIEW":
      case "DRAFT":
        return { is_active: true, is_paused: false };
      case "PAUSED":
        return { is_active: true, is_paused: true };
      case "ARCHIVED":
      case "DISCONTINUED":
        return { is_active: false, is_paused: true };
      default:
        return {};
    }
  },

  canTransition(from: ProductLifecycleStatus, to: ProductLifecycleStatus): boolean {
    if (from === to) return true;
    return TRANSITIONS[from]?.includes(to) ?? false;
  },

  assertTransition(from: ProductLifecycleStatus, to: ProductLifecycleStatus): void {
    if (!ProductLifecycle.canTransition(from, to)) {
      throw new Error(`Invalid product lifecycle transition: ${from} → ${to}`);
    }
  },

  allowedNext(from: ProductLifecycleStatus): ProductLifecycleStatus[] {
    return TRANSITIONS[from] ?? [];
  },
} as const;
