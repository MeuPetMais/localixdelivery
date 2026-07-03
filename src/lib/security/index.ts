// Platform-wide security helpers. Pure functions only — no I/O, no side effects.
// Reused by logs, edge functions, EventBus consumers and AI/Analytics adapters.

const SENSITIVE_KEY = /(password|passwd|token|secret|api[_-]?key|authorization|cookie|session|cpf|cnpj|rg|card|cvv|cvc|pan|iban|ssn|pix[_-]?key|access[_-]?token|refresh[_-]?token|bearer)/i;

const CARD_LIKE = /\b(?:\d[ -]*?){13,19}\b/g;
const EMAIL = /([a-z0-9._%+-]{1,64})@([a-z0-9.-]+\.[a-z]{2,})/gi;
const JWT_LIKE = /\beyJ[A-Za-z0-9_-]+?\.[A-Za-z0-9_-]+?\.[A-Za-z0-9_-]+\b/g;
const BEARER = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;

/** Mask a string preserving only the first/last chars — for logs. */
export function maskString(value: string, keep = 2): string {
  if (!value) return value;
  if (value.length <= keep * 2) return "*".repeat(value.length);
  return `${value.slice(0, keep)}${"*".repeat(Math.max(4, value.length - keep * 2))}${value.slice(-keep)}`;
}

export function maskEmail(email: string): string {
  return email.replace(EMAIL, (_, u: string, d: string) => `${u.slice(0, 1)}***@${d}`);
}

export function maskCard(input: string): string {
  return input.replace(CARD_LIKE, (m) => {
    const digits = m.replace(/\D/g, "");
    if (digits.length < 13) return m;
    return `**** **** **** ${digits.slice(-4)}`;
  });
}

/** Redact tokens/secrets/PII from an arbitrary string safe for logs. */
export function sanitizeLogString(input: string): string {
  return input
    .replace(BEARER, "Bearer [redacted]")
    .replace(JWT_LIKE, "[jwt-redacted]")
    .replace(CARD_LIKE, (m) => maskCard(m))
    .replace(EMAIL, (m) => maskEmail(m));
}

/** Deep-sanitize an object for structured logs. Depth-limited, cycle-safe. */
export function sanitizeLogPayload(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (depth > 6) return "[max-depth]";
  if (value == null) return value;
  if (typeof value === "string") return sanitizeLogString(value.length > 2000 ? value.slice(0, 2000) + "…" : value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    if (seen.has(value)) return "[cycle]";
    seen.add(value);
    return value.slice(0, 50).map((v) => sanitizeLogPayload(v, depth + 1, seen));
  }
  if (typeof value === "object") {
    if (seen.has(value as object)) return "[cycle]";
    seen.add(value as object);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY.test(k)) { out[k] = "[redacted]"; continue; }
      out[k] = sanitizeLogPayload(v, depth + 1, seen);
    }
    return out;
  }
  return "[unserializable]";
}

/** Standard error envelope for APIs / server functions. Never leaks internals. */
export interface SafeErrorEnvelope {
  ok: false;
  code: string;
  message: string;
  request_id?: string;
}

export function toSafeError(err: unknown, request_id?: string): SafeErrorEnvelope {
  const known = err as { code?: string; message?: string } | null;
  const code = known?.code && /^[A-Z0-9_.-]{2,64}$/.test(known.code) ? known.code : "internal_error";
  const message = code === "internal_error" ? "Erro interno. Tente novamente." : (known?.message ?? "Erro");
  return { ok: false, code, message, request_id };
}

/** Constant-time string comparison — for webhook signatures / tokens. */
export function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
