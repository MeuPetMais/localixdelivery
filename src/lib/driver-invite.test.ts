// RC-UX.3 - Testes de utilitarios do convite/ativacao do entregador.
import { describe, it, expect } from "vitest";
import {
  maskPhoneBR,
  maskCPF,
  isValidPhoneBR,
  isValidCPF,
  buildDriverAppAccessMessage,
  buildDriverAppAccessWhatsAppUrl,
  buildDriverRecoveryMessage,
  buildDriverRecoveryWhatsAppUrl,
  buildInviteMessage,
  buildWhatsAppUrl,
  DRIVER_ACTIVATION_URL,
} from "./driver-invite";

describe("driver-invite masks", () => {
  it("mascara telefone movel", () => {
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
  it("telefone: aceita 10/11 digitos", () => {
    expect(isValidPhoneBR("(11) 99999-8888")).toBe(true);
    expect(isValidPhoneBR("(11) 3000-1234")).toBe(true);
    expect(isValidPhoneBR("123")).toBe(false);
  });
  it("CPF: rejeita invalido e repetido", () => {
    expect(isValidCPF("111.111.111-11")).toBe(false);
    expect(isValidCPF("123.456.789-00")).toBe(false);
  });
  it("CPF: aceita valido", () => {
    // 529.982.247-25 e um CPF de exemplo valido.
    expect(isValidCPF("529.982.247-25")).toBe(true);
  });
});

describe("driver-invite messaging", () => {
  it("monta mensagem com nome, restaurante e link oficial", () => {
    const msg = buildInviteMessage({
      driverName: "João da Silva",
      restaurantName: "Hamburgueria Sanliver",
    });
    expect(msg).toContain("Olá, João!");
    expect(msg).toContain("Você foi cadastrado");
    expect(msg).toContain("Hamburgueria Sanliver");
    expect(msg).toContain(DRIVER_ACTIVATION_URL);
  });
  it("monta URL do WhatsApp com telefone e mensagem codificada", () => {
    const url = buildWhatsAppUrl({
      phone: "(11) 99999-8888",
      driverName: "João",
      restaurantName: "Sanliver",
    });
    expect(url.startsWith("https://wa.me/5511999998888?text=")).toBe(true);
    expect(url).toContain(encodeURIComponent("Sanliver"));
    expect(decodeURIComponent(url.split("text=")[1])).toContain("Olá, João!");
  });
  it("monta mensagem de acesso ao app sem fluxo de ativacao", () => {
    const msg = buildDriverAppAccessMessage({
      driverName: "Joao da Silva",
      restaurantName: "Sanliver",
      appUrl: "https://app.example.com/entregador",
    });
    expect(msg).toContain("Localix Entregador");
    expect(msg).toContain("CPF ou telefone");
    expect(msg).toContain("https://app.example.com/entregador");
    expect(msg).not.toContain("Crie sua senha");
  });
  it("monta WhatsApp de acesso sem duplicar DDI 55", () => {
    const url = buildDriverAppAccessWhatsAppUrl({
      phone: "+55 (11) 99999-8888",
      driverName: "Joao",
      restaurantName: "Sanliver",
    });
    expect(url.startsWith("https://wa.me/5511999998888?text=")).toBe(true);
  });
  it("monta mensagem e WhatsApp de recuperacao com link seguro em UTF-8", () => {
    const recoveryUrl =
      "https://localixdelivery.rngdigital.com.br/entregador/redefinir-senha?token_hash=abc&type=recovery";
    const msg = buildDriverRecoveryMessage({
      driverName: "João",
      restaurantName: "São Bento",
      recoveryUrl,
    });
    expect(msg).toContain("Olá, João!");
    expect(msg).toContain("Aqui é da São Bento.");
    expect(msg).toContain("redefinir sua senha");
    expect(msg).toContain("Se você não solicitou essa alteração");
    expect(msg).toContain(recoveryUrl);

    const url = buildDriverRecoveryWhatsAppUrl({
      phone: "11999998888",
      driverName: "João",
      restaurantName: "São Bento",
      recoveryUrl,
    });
    const decodedMessage = decodeURIComponent(url.split("text=")[1]);
    expect(url).toContain(encodeURIComponent(recoveryUrl));
    expect(decodedMessage).toContain("Olá, João!");
    expect(decodedMessage).toContain("Aqui é da São Bento.");
    expect(decodedMessage).toContain("alteração");
  });
});
