import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PARTNER_WHATSAPP_MESSAGE,
  PartnerWhatsAppFloatingButton,
  buildPartnerWhatsAppUrl,
  normalizePartnerWhatsAppPhone,
} from "./PartnerWhatsAppFloatingButton";

const componentSource = readFileSync(
  "src/components/landing/PartnerWhatsAppFloatingButton.tsx",
  "utf8",
);
const landingSource = readFileSync("src/routes/index.tsx", "utf8");
const envExample = readFileSync(".env.example", "utf8");

function routeFiles(dir = "src/routes"): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return routeFiles(path);
    return path.endsWith(".tsx") && !path.endsWith(".test.tsx") ? [path] : [];
  });
}

describe("PartnerWhatsAppFloatingButton", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders the floating button when the partner env is valid", () => {
    vi.stubEnv("VITE_LOCALIX_PARTNER_WHATSAPP", "+55 (11) 99999-9999");

    const html = renderToStaticMarkup(<PartnerWhatsAppFloatingButton />);

    expect(html).toContain("Fale com a Localix");
    expect(html).toContain("https://wa.me/5511999999999?text=");
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('aria-label="Falar com a Localix pelo WhatsApp"');
  });

  it("does not render when the partner env is missing or invalid", () => {
    vi.stubEnv("VITE_LOCALIX_PARTNER_WHATSAPP", "");
    expect(renderToStaticMarkup(<PartnerWhatsAppFloatingButton />)).toBe("");

    vi.stubEnv("VITE_LOCALIX_PARTNER_WHATSAPP", "abc");
    expect(renderToStaticMarkup(<PartnerWhatsAppFloatingButton />)).toBe("");
  });

  it("builds the configured commercial WhatsApp URL with the expected message", () => {
    const url = buildPartnerWhatsAppUrl("+55 (11) 99999-9999");

    expect(url).toBe(
      `https://wa.me/5511999999999?text=${encodeURIComponent(PARTNER_WHATSAPP_MESSAGE)}`,
    );
    expect(PARTNER_WHATSAPP_MESSAGE).toBe(
      "Olá! Vim pelo site do Localix e quero saber mais sobre como cadastrar meu estabelecimento.",
    );
  });

  it("normalizes only plausible international numbers and fails closed otherwise", () => {
    expect(normalizePartnerWhatsAppPhone("55 11 99999-9999")).toBe("5511999999999");
    expect(buildPartnerWhatsAppUrl("")).toBeNull();
    expect(buildPartnerWhatsAppUrl("abc")).toBeNull();
    expect(buildPartnerWhatsAppUrl("123")).toBeNull();
    expect(buildPartnerWhatsAppUrl("1234567890123456")).toBeNull();
  });

  it("uses the partner variable without falling back to driver support WhatsApp", () => {
    expect(envExample).toContain("VITE_LOCALIX_PARTNER_WHATSAPP=");
    expect(componentSource).toContain("VITE_LOCALIX_PARTNER_WHATSAPP");
    expect(componentSource).not.toContain("VITE_LOCALIX_SUPPORT_WHATSAPP");
  });

  it("opens outside the current page and exposes the required accessible name", () => {
    expect(componentSource).toContain('target="_blank"');
    expect(componentSource).toContain('rel="noopener noreferrer"');
    expect(componentSource).toContain('aria-label="Falar com a Localix pelo WhatsApp"');
  });

  it("is wired only in the public landing route", () => {
    expect(landingSource).toContain("PartnerWhatsAppFloatingButton");
    expect(landingSource).toContain("<PartnerWhatsAppFloatingButton />");
    expect(componentSource).not.toContain("createFileRoute");

    const unexpectedRoutes = routeFiles()
      .filter((file) => file.replace(/\\/g, "/") !== "src/routes/index.tsx")
      .filter((file) => readFileSync(file, "utf8").includes("PartnerWhatsAppFloatingButton"));

    expect(unexpectedRoutes).toEqual([]);
  });
});
