import { describe, expect, it } from "vitest";
import {
  DRIVER_FAQ_SECTIONS,
  DRIVER_HELP_ROUTE,
  DRIVER_SUPPORT_WHATSAPP_ENV,
  buildDriverSupportMessage,
  buildDriverSupportWhatsAppUrl,
  filterDriverFaqSections,
  getConfiguredDriverSupportWhatsApp,
  normalizeWhatsAppPhone,
} from "./driver-support";

describe("driver support", () => {
  it("uses an internal FAQ route for the driver app", () => {
    expect(DRIVER_HELP_ROUTE).toBe("/entregador/ajuda");
  });

  it("does not keep the broken external FAQ URL in FAQ content", () => {
    expect(JSON.stringify(DRIVER_FAQ_SECTIONS)).not.toContain("ajuda.localix.app");
  });

  it("rejects the old placeholder WhatsApp number", () => {
    expect(normalizeWhatsAppPhone("+55 11 99999-9999")).toBeNull();
    expect(normalizeWhatsAppPhone("5511999999999")).toBeNull();
  });

  it("uses the configured valid WhatsApp number", () => {
    expect(
      getConfiguredDriverSupportWhatsApp({ [DRIVER_SUPPORT_WHATSAPP_ENV]: "+55 (16) 98888-7777" }),
    ).toBe("5516988887777");
  });

  it("builds a UTF-8 encoded WhatsApp URL with a single encoded message", () => {
    const url = buildDriverSupportWhatsAppUrl("5516988887777", { name: "João Entregador" });

    expect(url).toBe(
      "https://wa.me/5516988887777?text=Ol%C3%A1!%20Sou%20entregador%20do%20Localix%20e%20preciso%20de%20ajuda.%0ANome%3A%20Jo%C3%A3o%20Entregador",
    );
  });

  it("returns a safe fallback when support phone is not configured", () => {
    expect(buildDriverSupportWhatsAppUrl(null, { name: "Ana" })).toBeNull();
    expect(getConfiguredDriverSupportWhatsApp({})).toBeNull();
  });

  it("keeps sensitive driver fields out of the automatic message", () => {
    const message = buildDriverSupportMessage({ name: "Ana Entregadora" });

    expect(message).not.toContain("CPF");
    expect(message).not.toContain("document");
    expect(message).not.toContain("endereço");
    expect(message).not.toContain("financeiro");
    expect(message).not.toContain("user_id");
    expect(message).not.toContain("token");
  });

  it("filters FAQ locally for mobile help search", () => {
    const result = filterDriverFaqSections("documentos");

    expect(result.length).toBeGreaterThan(0);
    expect(result.some((section) => section.title === "Documentos")).toBe(true);
  });
});
