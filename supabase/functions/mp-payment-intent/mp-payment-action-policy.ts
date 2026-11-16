/**
 * Payment action authorization. This function does not establish identity:
 * callerId MUST come from server-validated Supabase auth.getUser(JWT).
 * A service_role client never supplies proof of caller ownership.
 */
export function isAuthorizedPaymentAction(args: {
  action: string;
  callerId: string;
  ownerId: string | null;
  customerId: string | null;
}): boolean {
  const { action, callerId, ownerId, customerId } = args;
  if (!callerId) return false;
  const owner = ownerId !== null && ownerId === callerId;
  const customer = customerId !== null && customerId === callerId;
  if (action === "refund" || action === "cancel") return owner;
  if (action === "create" || action === "status") return owner || customer;
  return false;
}

/**
 * Preserve financial reversals. Refunded and charged-back payments
 * must NEVER be represented as approved or promoted back to paid.
 */
export function mapMpStatus(status: string | null | undefined): string {
  switch ((status ?? "").toLowerCase()) {
    case "approved":
      return "APPROVED";
    case "in_process":
      return "PROCESSING";
    case "rejected":
      return "REJECTED";
    case "cancelled":
      return "CANCELLED";
    case "refunded":
      return "REFUNDED";
    case "charged_back":
      return "CHARGEBACK";
    default: return "PENDING";
  }
}
