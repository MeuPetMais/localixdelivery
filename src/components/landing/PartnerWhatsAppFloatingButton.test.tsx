import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PARTNER_WHATSAPP_MOBILE_QUERY,
  PARTNER_WHATSAPP_MESSAGE,
  PARTNER_WHATSAPP_SCROLL_IDLE_DELAY_MS,
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

  it("keeps desktop layout unchanged while using the compact mobile placement", () => {
    expect(componentSource).toContain(
      "bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] right-[calc(env(safe-area-inset-right)+1.25rem)]",
    );
    expect(componentSource).toContain("h-12 w-12");
    expect(componentSource).toContain("sm:bottom-6 sm:right-6 sm:h-12 sm:w-auto sm:px-5");
    expect(PARTNER_WHATSAPP_MOBILE_QUERY).toBe("(max-width: 639px)");
  });

  it("collapses on mobile scroll and restores after a controlled debounce", () => {
    expect(componentSource).toContain('window.addEventListener("scroll", handleScroll, { passive: true })');
    expect(componentSource).toContain("setIsHiddenOnMobileScroll(true)");
    expect(componentSource).toContain(
      "window.setTimeout(showButton, PARTNER_WHATSAPP_SCROLL_IDLE_DELAY_MS)",
    );
    expect(componentSource).toContain("setIsHiddenOnMobileScroll(false)");
    expect(PARTNER_WHATSAPP_SCROLL_IDLE_DELAY_MS).toBe(220);
  });

  it("limits the scroll behavior to mobile and cleans listeners and timers", () => {
    expect(componentSource).toContain("window.matchMedia(PARTNER_WHATSAPP_MOBILE_QUERY)");
    expect(componentSource).toContain("if (!mobileQuery.matches)");
    expect(componentSource).toContain('mobileQuery.addEventListener("change", handleMobileQueryChange)');
    expect(componentSource).toContain('window.removeEventListener("scroll", handleScroll)');
    expect(componentSource).toContain('mobileQuery.removeEventListener("change", handleMobileQueryChange)');
    expect(componentSource).toContain("window.clearTimeout(scrollIdleTimerRef.current)");
  });

  it("respects reduced motion without changing the WhatsApp link semantics", () => {
    expect(componentSource).toContain("motion-reduce:transition-none");
    expect(componentSource).not.toContain("VITE_LOCALIX_SUPPORT_WHATSAPP");
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
