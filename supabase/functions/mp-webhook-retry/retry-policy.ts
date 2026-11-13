/** Pure, bounded retry policy for payment webhook recovery. */
export const MAX_WEBHOOK_RETRIES = 6;

export function nextWebhookRetry(
  retryCount: number,
  now: Date,
): {
  attempts: number;
  status: "pending" | "failed";
  nextRetry: string;
} {
  const attempts = retryCount + 1;
  const minutes = Math.min(60, 2 ** Math.max(0, attempts - 1));
  return {
    attempts,
    status: attempts >= MAX_WEBHOOK_RETRIES ? "failed" : "pending",
    nextRetry: new Date(now.getTime() + minutes * 60_000).toISOString(),
  };
}

export function isClaimableEvent(
  processed: boolean | null | undefined,
  updatedAt: string,
  now: Date,
): boolean {
  if (processed !== false) return false;
  const updatedTime = Date.parse(updatedAt);
  return Number.isFinite(updatedTime) && updatedTime < now.getTime() - 3 * 60_000;
}
