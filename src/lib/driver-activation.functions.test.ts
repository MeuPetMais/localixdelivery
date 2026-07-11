// RC5.4 — Testes de contrato de ativação do entregador.
import { describe, it, expect } from "vitest";
import { z } from "zod";

const digits = (s: string) => s.replace(/\D/g, "");

const validateSchema = z.object({
  cpf: z.string().trim().min(8).max(20),
  phone: z.string().trim().min(8).max(30),
});

const activateSchema = z.object({
  cpf: z.string().trim().min(8).max(20),
  phone: z.string().trim().min(8).max(30),
  email: z.string().trim().email().max(200).optional().nullable(),
  password: z.string().min(8).max(100),
});

describe("driver-activation input contracts", () => {
  it("rejects invalid CPF", () => {
    expect(() => validateSchema.parse({ cpf: "", phone: "11999998888" })).toThrow();
  });
  it("rejects invalid phone", () => {
    expect(() => validateSchema.parse({ cpf: "11122233344", phone: "" })).toThrow();
  });
  it("accepts masked CPF/phone", () => {
    const p = validateSchema.parse({ cpf: "111.222.333-44", phone: "(11) 99999-8888" });
    expect(digits(p.cpf)).toBe("11122233344");
    expect(digits(p.phone)).toBe("11999998888");
  });
  it("rejects weak password (<8)", () => {
    expect(() => activateSchema.parse({
      cpf: "11122233344", phone: "11999998888", password: "abc",
    })).toThrow();
  });
  it("email is optional", () => {
    const ok = activateSchema.parse({
      cpf: "11122233344", phone: "11999998888", password: "senha1234",
    });
    expect(ok.password.length).toBeGreaterThanOrEqual(8);
  });
  it("rejects invalid email when provided", () => {
    expect(() => activateSchema.parse({
      cpf: "11122233344", phone: "11999998888", password: "senha1234", email: "not-an-email",
    })).toThrow();
  });
});
