/**
 * Smart ETA — estima o tempo até a entrega considerando:
 *  - pedidos na fila (aguardando confirmação);
 *  - pedidos em preparo;
 *  - número de cozinheiros (configurável);
 *  - tempo médio histórico de preparo (fallback);
 *  - simultaneidade (throughput).
 *
 * Retorna um bucket em minutos para exibir no cardápio: 30 / 45 / 60 / 75 / 90.
 */

export type EtaInputs = {
  queueCount: number;        // "novo" + "aguardando_confirmacao"
  preparingCount: number;    // "em_preparo"
  cooks: number;             // configurável no perfil (default 1)
  avgPrepMinutes: number;    // média histórica (default 20)
  deliveryMinutes: number;   // média de entrega (default 15)
};

export function computeEtaMinutes({
  queueCount,
  preparingCount,
  cooks,
  avgPrepMinutes,
  deliveryMinutes,
}: EtaInputs): number {
  const c = Math.max(1, cooks);
  const prep = Math.max(5, avgPrepMinutes);
  const delivery = Math.max(0, deliveryMinutes);

  // Um cozinheiro processa ~ (60/prep) pedidos por hora.
  // Fila efetiva por cozinheiro = (fila + em preparo) / c.
  const workload = (queueCount + preparingCount) / c;
  const prepWait = Math.ceil(workload * prep);

  const raw = prepWait + delivery;
  return bucket(raw);
}

export function computeEtaLabel(m: number): string {
  return `${m} min`;
}

function bucket(m: number): number {
  const steps = [30, 45, 60, 75, 90, 120];
  for (const s of steps) if (m <= s) return s;
  return 120;
}
