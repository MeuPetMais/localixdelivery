import { describe, it, expect } from "vitest";
import { maskString, maskEmail, maskCard, sanitizeLogString, sanitizeLogPayload, toSafeError, timingSafeEqualStr } from "./index";

describe("security helpers", () => {
  it("masks strings preserving edges", () => {
    expect(maskString("abcdefghij")).toBe("ab******ij");
    expect(maskString("ab")).toBe("**");
  });
  it("masks emails and cards", () => {
    expect(maskEmail("john.doe@acme.com")).toBe("j***@acme.com");
    expect(maskCard("4111 1111 1111 1234")).toContain("1234");
    expect(maskCard("4111 1111 1111 1234")).toContain("****");
  });
  it("redacts tokens and PII in strings", () => {
    const s = sanitizeLogString("token=eyJhbGciOi.aa.bb Bearer abcdef contact john@acme.com card 4111111111111234");
    expect(s).not.toContain("eyJhbGciOi.aa.bb");
    expect(s).toContain("[jwt-redacted]");
    expect(s).toContain("Bearer [redacted]");
    expect(s).toContain("j***@acme.com");
    expect(s).toContain("1234");
  });
  it("redacts sensitive keys deeply", () => {
    const out = sanitizeLogPayload({ user: { email: "a@b.co", password: "x", nested: { api_key: "k", cpf: "123" } } }) as any;
    expect(out.user.password).toBe("[redacted]");
    expect(out.user.nested.api_key).toBe("[redacted]");
    expect(out.user.nested.cpf).toBe("[redacted]");
  });
  it("survives cycles", () => {
    const a: any = { name: "x" }; a.self = a;
    expect(() => sanitizeLogPayload(a)).not.toThrow();
  });
  it("produces a safe error envelope", () => {
    const env = toSafeError(new Error("db exploded with secret=abc"));
    expect(env.ok).toBe(false);
    expect(env.code).toBe("internal_error");
    expect(env.message).not.toContain("secret");
  });
  it("timing-safe compare", () => {
    expect(timingSafeEqualStr("abc", "abc")).toBe(true);
    expect(timingSafeEqualStr("abc", "abd")).toBe(false);
    expect(timingSafeEqualStr("abc", "abcd")).toBe(false);
  });
});
