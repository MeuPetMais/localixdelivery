import type {
  ProductOptionGroup,
  ProductOption,
  SelectedOption,
  ValidationResult,
} from "./types";

export const ConfigurationRuleEngine = {
  validate(
    groups: ProductOptionGroup[],
    options: ProductOption[],
    selections: SelectedOption[],
  ): ValidationResult {
    const errors: string[] = [];
    const byGroup = new Map<string, SelectedOption[]>();
    for (const s of selections) {
      if (!byGroup.has(s.group_id)) byGroup.set(s.group_id, []);
      byGroup.get(s.group_id)!.push(s);
    }
    const optionsById = new Map(options.map((o) => [o.id, o]));

    for (const g of groups) {
      const sel = byGroup.get(g.id) ?? [];
      const totalQty = sel.reduce((a, s) => a + s.quantity, 0);

      // Dependency: skip if parent option not selected
      if (g.depends_on_option_id) {
        const parentSelected = selections.some(
          (s) => s.option_id === g.depends_on_option_id,
        );
        if (!parentSelected) {
          if (sel.length > 0) errors.push(`${g.name}: dependência não atendida`);
          continue;
        }
      }

      if (g.required && totalQty < Math.max(1, g.min_selection)) {
        errors.push(`${g.name}: seleção obrigatória`);
      }
      if (totalQty < g.min_selection) {
        errors.push(`${g.name}: mínimo ${g.min_selection}`);
      }
      if (g.max_selection > 0 && totalQty > g.max_selection) {
        errors.push(`${g.name}: máximo ${g.max_selection}`);
      }
      if (g.type === "SINGLE" && sel.length > 1) {
        errors.push(`${g.name}: apenas uma opção`);
      }
      if (g.type === "BOOLEAN" && sel.length > 1) {
        errors.push(`${g.name}: booleano`);
      }

      for (const s of sel) {
        const opt = optionsById.get(s.option_id);
        if (!opt) errors.push(`Opção inválida em ${g.name}`);
        else if (!opt.active) errors.push(`${opt.name}: indisponível`);
        else if (s.quantity > opt.max_quantity) {
          errors.push(`${opt.name}: quantidade máxima ${opt.max_quantity}`);
        }
      }
    }
    return { valid: errors.length === 0, errors };
  },
};
