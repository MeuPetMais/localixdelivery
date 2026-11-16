import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const home = readFileSync(new URL("../../routes/home.tsx", import.meta.url), "utf8");
const menu = readFileSync(new URL("../../components/BottomNav.tsx", import.meta.url), "utf8");

describe("Localix pilot — direct partner links, without public marketplace", () => {
  it("does not load or expose an establishment discovery list on /home", () => {
    expect(home).not.toContain("restaurants_public");
    expect(home).not.toContain('.from("restaurants');
    expect(home).not.toContain("Buscar restaurantes");
    expect(home).not.toContain("restaurantes próximos");
    expect(home).not.toContain("Cupons e ofertas dos restaurantes");
  });

  it("keeps customer orders and favorites accessible", () => {
    expect(home).toContain('to="/meus-pedidos"');
    expect(home).toContain('to="/favoritos"');
  });

  it("instructs visitors to open the establishment's own menu link", () => {
    expect(home).toContain("link de cardápio enviado pelo seu estabelecimento");
    expect(home).toContain('createFileRoute("/home")');
  });

  it("preserves restaurant-specific Home destination when a slug is active", () => {
    expect(menu).toContain('const homeTarget = activeSlug ? `/${activeSlug}` : "/home"');
    expect(menu).toContain('to: "/$slug"');
  });
});
