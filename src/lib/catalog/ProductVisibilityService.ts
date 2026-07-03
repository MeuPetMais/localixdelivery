import type { CatalogChannel } from "./types";

export interface VisibilityFlags {
  available_delivery?: boolean;
  available_pickup?: boolean;
  available_dine_in?: boolean;
  available_marketplace?: boolean;
  available_api?: boolean;
  is_available?: boolean;
}

/**
 * ProductVisibilityService — pure resolver.
 * Answers "is this product visible on channel X?".
 */
export const ProductVisibilityService = {
  isVisible(flags: VisibilityFlags, channel: CatalogChannel): boolean {
    if (flags.is_available === false) return false;
    switch (channel) {
      case "delivery":     return flags.available_delivery !== false;
      case "pickup":       return flags.available_pickup !== false;
      case "dine_in":      return flags.available_dine_in !== false;
      case "qr":           return flags.available_dine_in !== false;
      case "totem":        return flags.available_pickup !== false || flags.available_dine_in !== false;
      case "marketplace":  return flags.available_marketplace === true;
      case "api":          return flags.available_api === true;
      default:             return true;
    }
  },
} as const;
