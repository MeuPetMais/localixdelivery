/** Decision-only helper: never acknowledge an unprocessed persisted webhook as completed.
 * Another worker may still own the event. This module does not reprocess or
 * mutate payment state; a future atomic queue/lease must handle recovery.
 */
export function existingWebhookDelivery(processed: boolean | null | undefined) {
  if (processed === true) {
    return { status: 200, body: { ok: true, duplicated: true } };
  }
  return {
    status: 503,
    body: { ok: false, error: "webhook_pending_recovery" },
  };
}
