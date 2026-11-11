/**
 * Financial summaries must never silently aggregate a UI-sized statement page.
 *
 * The caller supplies an authenticated, tenant-scoped and deterministically
 * ordered page fetcher. No database access or business math lives here.
 */
export async function collectFinancialStatement<T>(
  fetchPage: (start: number, end: number) => Promise<T[]>,
  options: { pageSize?: number; maxRows?: number } = {},
): Promise<T[]> {
  const pageSize = options.pageSize ?? 500;
  const maxRows = options.maxRows ?? 10_000;

  if (!Number.isInteger(pageSize) || pageSize < 1 || !Number.isInteger(maxRows) || maxRows < 1) {
    throw new Error("Configuração inválida da paginação financeira.");
  }

  const rows: T[] = [];
  while (true) {
    // Fetch up to the configured boundary plus one page to distinguish a
    // complete statement from a truncated one, even at exactly maxRows.
    const page = await fetchPage(rows.length, rows.length + pageSize - 1);
    if (page.length > pageSize) {
      throw new Error("Extrato financeiro retornou uma página maior que o esperado.");
    }
    if (rows.length + page.length > maxRows) {
      throw new Error(
        "Indicadores financeiros indisponíveis: extrato excede o limite seguro de processamento.",
      );
    }
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}
