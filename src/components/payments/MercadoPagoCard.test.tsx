import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  disconnectMercadoPagoConnection,
  MercadoPagoCard,
  startMercadoPagoConnection,
} from "./MercadoPagoCard";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

function renderCard(status?: Record<string, unknown>) {
  const restaurantId = "restaurant-1";
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  if (status) {
    queryClient.setQueryData(["mp-status", restaurantId], status);
  }

  return renderToString(
    <QueryClientProvider client={queryClient}>
      <MercadoPagoCard
        restaurantId={restaurantId}
        isPrimary={false}
        onSetPrimary={() => undefined}
      />
    </QueryClientProvider>,
  );
}

describe("MercadoPagoCard", () => {
  it("renderiza estado desconectado", () => {
    const html = renderCard({ connected: false });

    expect(html).toContain("Mercado Pago");
    expect(html).toContain("Não conectado");
    expect(html).toContain("Conectar Mercado Pago");
    expect(html).toContain("Conecte sua conta Mercado Pago para receber pagamentos");
  });

  it("clicar conectar usa startOAuth com restaurantId e redireciona para authorizeUrl", async () => {
    const startOAuth = vi.fn(async () => ({ authorizeUrl: "https://mercadopago.test/oauth" }));
    const redirect = vi.fn();

    await startMercadoPagoConnection("restaurant-1", "https://app.localix.test", redirect, startOAuth);

    expect(startOAuth).toHaveBeenCalledWith(
      "mercado_pago",
      "restaurant-1",
      "https://app.localix.test/pagamentos",
    );
    expect(redirect).toHaveBeenCalledWith("https://mercadopago.test/oauth");
  });

  it("renderiza estado conectado sem expor tokens ou secrets", () => {
    const html = renderCard({
      connected: true,
      accountId: "mp-user-123",
      liveMode: false,
      connectedAt: "2026-08-11T12:00:00.000Z",
      access_token: "APP_USR-secret-access-token",
      refresh_token: "APP_USR-secret-refresh-token",
      client_secret: "client-secret-value",
      authorization_code: "authorization-code-value",
    });

    expect(html).toContain("Conectado");
    expect(html).toContain("Ambiente de teste");
    expect(html).toContain("mp-user-123");
    expect(html).toContain("Teste");
    expect(html).toContain("Sua conta Mercado Pago está conectada");
    expect(html).not.toContain("APP_USR-secret-access-token");
    expect(html).not.toContain("APP_USR-secret-refresh-token");
    expect(html).not.toContain("client-secret-value");
    expect(html).not.toContain("authorization-code-value");
  });

  it("desconectar pede confirmacao e chama provider/service", async () => {
    const confirmDisconnect = vi.fn(() => true);
    const disconnect = vi.fn(async () => undefined);

    const result = await disconnectMercadoPagoConnection("restaurant-1", confirmDisconnect, disconnect);

    expect(result).toBe(true);
    expect(confirmDisconnect).toHaveBeenCalledWith("Desconectar Mercado Pago deste restaurante?");
    expect(disconnect).toHaveBeenCalledWith("mercado_pago", "restaurant-1");
  });

  it("cancelar desconexao nao chama provider/service", async () => {
    const confirmDisconnect = vi.fn(() => false);
    const disconnect = vi.fn(async () => undefined);

    const result = await disconnectMercadoPagoConnection("restaurant-1", confirmDisconnect, disconnect);

    expect(result).toBe(false);
    expect(disconnect).not.toHaveBeenCalled();
  });

  it("erro de OAuth nao expoe dados sensiveis", async () => {
    const redirect = vi.fn();
    const startOAuth = vi.fn(async () => {
      throw new Error("Não foi possível iniciar a conexão Mercado Pago");
    });

    await expect(
      startMercadoPagoConnection("restaurant-1", "https://app.localix.test", redirect, startOAuth),
    ).rejects.toThrow("Não foi possível iniciar a conexão Mercado Pago");
    expect(redirect).not.toHaveBeenCalled();
  });
});
