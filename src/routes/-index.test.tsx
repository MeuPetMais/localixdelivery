import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const landingSource = readFileSync("src/routes/index.tsx", "utf8");

function routeFiles(dir = "src/routes"): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return routeFiles(path);
    return path.endsWith(".tsx") && !path.endsWith(".test.tsx") ? [path] : [];
  });
}

describe("public landing delivery operation section", () => {
  it("renders the delivery operation section title on the landing page", () => {
    expect(landingSource).toContain("<DeliveryOperation />");
    expect(landingSource).toContain('id="entregas"');
    expect(landingSource).toContain("Sua operação de entrega, conectada ao Localix");
  });

  it("includes partner and driver benefit blocks", () => {
    expect(landingSource).toContain("Para o parceiro");
    expect(landingSource).toContain("Painel operacional dedicado");
    expect(landingSource).toContain("Mais autonomia na entrega");
    expect(landingSource).not.toContain("Independência operacional");
    expect(landingSource).toContain("Para o entregador");
    expect(landingSource).toContain("Área própria do entregador");
    expect(landingSource).toContain("Ajuda e suporte");
  });

  it("shows the expected delivery timeline steps", () => {
    for (const step of [
      "Pedido recebido",
      "Em preparação",
      "Entregador",
      "Em rota",
      "Entregue",
    ]) {
      expect(landingSource).toContain(step);
    }
  });

  it("keeps the CTA focused on the existing partner signup flow", () => {
    expect(landingSource).toContain("Quero ser parceiro");
    expect(landingSource).toContain("buildSignupHref");
    expect(landingSource).not.toContain("Quero ser entregador");
  });

  it("does not wire the delivery operation section into internal routes", () => {
    const unexpectedRoutes = routeFiles()
      .filter((file) => file.replace(/\\/g, "/") !== "src/routes/index.tsx")
      .filter((file) => readFileSync(file, "utf8").includes("DeliveryOperation"));

    expect(unexpectedRoutes).toEqual([]);
  });

  it("keeps the partner WhatsApp floating button on the public landing", () => {
    expect(landingSource).toContain("PartnerWhatsAppFloatingButton");
    expect(landingSource).toContain("<PartnerWhatsAppFloatingButton />");
  });
});
