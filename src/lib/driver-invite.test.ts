// RC-UX.3 — Testes de utilitários do convite/ativação do entregador.
import { describe, it, expect } from "vitest";
import {
  maskPhoneBR, maskCPF, isValidPhoneBR, isValidCPF,
  buildInviteMessage, buildWhatsAppUrl, DRIVER_ACTIVATION_URL,
} from "./driver-invite";

describe("driver-invite masks", () => {
  it("mascara telefone móvel", () => {
    expect(maskPhoneBR("11999998888")).toBe("(11) 99999-8888");
  });
  it("mascara telefone fixo", () => {
    expect(maskPhoneBR("1130001234")).toBe("(11) 3000-1234");
  });
  it("mascara CPF parcial e completo", () => {
    expect(maskCPF("111222333")).toBe("111.222.333");
    expect(maskCPF("11122233344")).toBe("111.222.333-44");
  });
});

describe("driver-invite validators", () => {
  it("telefone: aceita 10/11 dígitos", () => {
    expect(isValidPhoneBR("(11) 99999-8888")).toBe(true);
    expect(isValidPhoneBR("(11) 3000-1234")).toBe(true);
    expect(isValidPhoneBR("123")).toBe(false);
  });
  it("CPF: rejeita inválido e repetido", () => {
    expect(isValidCPF("111.111.111-11")).toBe(false);
    expect(isValidCPF("123.456.789-00")).toBe(false);
  });
  it("CPF: aceita válido", () => {
    // 529.982.247-25 é um CPF de exemplo válido.
    expect(isValidCPF("529.982.247-25")).toBe(true);
  });
});

describe("driver-invite messaging", () => {
  it("monta mensagem com nome, restaurante e link oficial", () => {
    const msg = buildInviteMessage({
      driverName: "João da Silva", restaurantName: "Hamburgueria Sanliver",
    });
    expect(msg).toContain("Olá, João!");
    expect(msg).toContain("Hamburgueria Sanliver");
    expect(msg).toContain(DRIVER_ACTIVATION_URL);
  });
  it("monta URL do WhatsApp com telefone e mensagem codificada", () => {
    const url = buildWhatsAppUrl({
      phone: "(11) 99999-8888",
      driverName: "João", restaurantName: "Sanliver",
    });
    expect(url.startsWith("https://wa.me/5511999998888?text=")).toBe(true);
    expect(url).toContain(encodeURIComponent("Sanliver"));
  });
});
