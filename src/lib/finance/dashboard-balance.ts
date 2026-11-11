import type { BalanceSummary } from "../ledger/LedgerService";
export function dashboardBalance(
  summary: Pick<BalanceSummary, "netBalance" | "currency"> &
    Partial<Pick<BalanceSummary, "ambiguousPostingBasis">>,
) {
  if (summary.ambiguousPostingBasis)
    throw new Error(
      "Saldo indisponível: lançamentos de pagamento e recebível precisam de conciliação contábil.",
    );
  return { balance: summary.netBalance, currency: summary.currency };
}
