// Retry exponencial + Dead Letter Queue.
export interface RetryDecision {
  next_status: "RETRY" | "DEAD_LETTER";
  next_attempt_at: string;
  attempts: number;
}

export function planRetry(currentAttempts: number, maxAttempts: number, base = new Date()): RetryDecision {
  const attempts = currentAttempts + 1;
  if (attempts >= maxAttempts) {
    return { next_status: "DEAD_LETTER", next_attempt_at: base.toISOString(), attempts };
  }
  // exponencial: 30s, 60s, 120s, 240s...
  const delayMs = 30_000 * Math.pow(2, attempts - 1);
  return {
    next_status: "RETRY",
    next_attempt_at: new Date(base.getTime() + delayMs).toISOString(),
    attempts,
  };
}
