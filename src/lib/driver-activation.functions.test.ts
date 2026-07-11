// RC5.4 — Testes de contrato de ativação do entregador.
import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  DRIVER_PASSWORD_RESET_CONFIRMATION,
  resolveDriverLoginEmail,
} from "./driver-auth";
import {
  getPasswordVisibilityConfig,
  togglePasswordVisibility,
} from "./password-visibility";

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

describe("driver login resolver", () => {
  const rows = [
    {
      email: "driver@example.com",
      cpf: "111.222.333-44",
      phone: "(11) 99999-8888",
      status: "ativo",
      owner_id: "user-1",
    },
    {
      email: "inactive@example.com",
      cpf: "55566677788",
      phone: "11911112222",
      status: "aguardando_ativacao",
      owner_id: null,
    },
  ];

  it("resolves active driver login with valid CPF credentials", () => {
    expect(resolveDriverLoginEmail(rows, "11122233344")).toBe("driver@example.com");
  });

  it("resolves active driver login with phone even when typed with country code", () => {
    expect(resolveDriverLoginEmail(rows, "+55 (11) 99999-8888")).toBe("driver@example.com");
  });

  it("does not resolve invalid or inactive driver credentials", () => {
    expect(resolveDriverLoginEmail(rows, "00000000000")).toBeNull();
    expect(resolveDriverLoginEmail(rows, "55566677788")).toBeNull();
  });
});

describe("driver password UX", () => {
  it("toggles password visibility type and accessible label", () => {
    const visible = togglePasswordVisibility(false);
    expect(visible).toBe(true);
    expect(getPasswordVisibilityConfig(false)).toEqual({ type: "password", ariaLabel: "Mostrar senha" });
    expect(getPasswordVisibilityConfig(visible)).toEqual({ type: "text", ariaLabel: "Ocultar senha" });
  });

  it("uses the neutral pilot password recovery confirmation", () => {
    expect(DRIVER_PASSWORD_RESET_CONFIRMATION).toContain("Se existir uma conta vinculada a este telefone");
    expect(DRIVER_PASSWORD_RESET_CONFIRMATION).toContain("SMS ou WhatsApp");
    expect(DRIVER_PASSWORD_RESET_CONFIRMATION).toContain("suporte da Localix");
  });
});
