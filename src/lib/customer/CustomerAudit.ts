// CustomerAudit — thin, side-effect logging surface for the Customer domain.
// Kept in-memory so tests can assert; persistence lives in customer_timeline / customer_consents.

export type CustomerAuditEntry = {
  customerId: string;
  action: string;
  data?: Record<string, unknown>;
  at: string;
};

const buffer: CustomerAuditEntry[] = [];
const MAX = 500;

export const CustomerAudit = {
  record(entry: Omit<CustomerAuditEntry, "at">): void {
    buffer.push({ ...entry, at: new Date().toISOString() });
    if (buffer.length > MAX) buffer.splice(0, buffer.length - MAX);
  },
  list(customerId?: string): CustomerAuditEntry[] {
    return customerId ? buffer.filter((e) => e.customerId === customerId) : [...buffer];
  },
  clear(): void {
    buffer.length = 0;
  },
} as const;
