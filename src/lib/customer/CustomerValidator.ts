import type {
  CustomerProfile,
  CustomerPreferences,
  CustomerValidationIssue,
  CustomerValidationResult,
} from "./types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?\d{8,15}$/;

/**
 * CustomerValidator — pure, side-effect free.
 * Reused by CustomerService, CustomerAddressService and PreferencesService.
 */
export const CustomerValidator = {
  validateProfile(input: Partial<CustomerProfile>, opts?: { requireContact?: boolean }): CustomerValidationResult {
    const issues: CustomerValidationIssue[] = [];
    const requireContact = opts?.requireContact ?? false;

    if (input.full_name !== undefined && input.full_name !== null && String(input.full_name).trim().length < 2) {
      issues.push({ field: "full_name", message: "Nome deve ter ao menos 2 caracteres." });
    }
    if (input.email) {
      if (!EMAIL_RE.test(String(input.email))) {
        issues.push({ field: "email", message: "Email inválido." });
      }
    }
    if (input.phone) {
      const cleaned = String(input.phone).replace(/[\s()\-.]/g, "");
      if (!PHONE_RE.test(cleaned)) {
        issues.push({ field: "phone", message: "Telefone inválido." });
      }
    }
    if (requireContact && !input.email && !input.phone) {
      issues.push({ field: "contact", message: "Informe email ou telefone." });
    }
    return { ok: issues.length === 0, issues };
  },

  validateAddress(input: {
    label?: string; street?: string; neighborhood?: string; cep?: string | null;
  }): CustomerValidationResult {
    const issues: CustomerValidationIssue[] = [];
    if (!input.label || input.label.trim().length < 1) issues.push({ field: "label", message: "Rótulo é obrigatório." });
    if (!input.street || input.street.trim().length < 2) issues.push({ field: "street", message: "Rua é obrigatória." });
    if (!input.neighborhood || input.neighborhood.trim().length < 2) {
      issues.push({ field: "neighborhood", message: "Bairro é obrigatório." });
    }
    if (input.cep && !/^\d{5}-?\d{3}$/.test(input.cep)) {
      issues.push({ field: "cep", message: "CEP inválido (use 00000-000)." });
    }
    return { ok: issues.length === 0, issues };
  },

  validatePreferences(input: Partial<CustomerPreferences>): CustomerValidationResult {
    const issues: CustomerValidationIssue[] = [];
    if (input.language && !/^[a-z]{2}(-[A-Z]{2})?$/.test(input.language)) {
      issues.push({ field: "language", message: "Idioma inválido (ex.: pt-BR)." });
    }
    if (input.dietary_restrictions && !Array.isArray(input.dietary_restrictions)) {
      issues.push({ field: "dietary_restrictions", message: "Formato inválido." });
    }
    return { ok: issues.length === 0, issues };
  },
} as const;
