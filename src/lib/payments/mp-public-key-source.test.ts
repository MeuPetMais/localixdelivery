import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const publicKeySource = readFileSync(
  resolve(process.cwd(), "supabase/functions/mp-public-key/index.ts"),
  "utf8",
);

describe("mp-public-key sanitization", () => {
  it("resolve public key somente pelo restaurant_id informado", () => {
    expect(publicKeySource).toContain("payload?.restaurant_id");
    expect(publicKeySource).toContain('.from("mercado_pago_accounts")');
    expect(publicKeySource).toContain('.select("connected, public_key")');
    expect(publicKeySource).toContain('.eq("restaurant_id", restaurantId)');
  });

  it("exige conta conectada e retorna somente public_key/connected", () => {
    expect(publicKeySource).toContain("!data?.connected || !data.public_key");
    expect(publicKeySource).toContain("return json({ public_key: null, connected: false })");
    expect(publicKeySource).toContain("public_key: await decryptToken(data.public_key)");
    expect(publicKeySource).toContain("connected: true");
  });

  it("nao seleciona nem retorna secrets Mercado Pago", () => {
    expect(publicKeySource).not.toContain("access_token");
    expect(publicKeySource).not.toContain("refresh_token");
    expect(publicKeySource).not.toContain("client_secret");
    expect(publicKeySource).not.toMatch(/select\([^)]*token/i);
  });

  it("erro/log permanecem sanitizados", () => {
    expect(publicKeySource).toContain('console.error("[mp-public-key]", error)');
    expect(publicKeySource).toContain('return json({ error: "mp_public_key_unavailable" }');
    expect(publicKeySource).not.toContain("error.message");
  });
});
