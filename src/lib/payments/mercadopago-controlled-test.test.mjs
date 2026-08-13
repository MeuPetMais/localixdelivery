import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  evaluatePostflight,
  evaluatePreflight,
  formatReport,
  PILOT_EXPECTED,
  shouldQueryMercadoPagoReadOnly,
} from "../../../scripts/mercadopago-controlled-test.mjs";

const productionEnv = {
  LOCALIX_ENV: "production",
  LOCALIX_SUPABASE_ENVIRONMENT: "production",
  MP_ENVIRONMENT: "production",
  SUPABASE_URL: "https://prod-ref.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-present",
  APP_BASE_URL: "https://localixdelivery.example.com",
  MP_TOKEN_ENC_KEY: "token-encryption-key-present",
  MP_WEBHOOK_SECRET: "webhook-secret-present",
};

const restaurant = {
  id: "restaurant-1",
  slug: "controlled-seller",
  name: "Controlled Seller",
  active: true,
};

const account = {
  connected: true,
  mp_user_id: "seller-123",
  access_token: "encrypted-token",
  expires_at: new Date(Date.now() + 60_000).toISOString(),
};

const settings = {
  platform_fee_until_30: 0.99,
  platform_fee_above_30: 1.49,
};

function preflight(overrides = {}) {
  return evaluatePreflight({
    env: productionEnv,
    restaurant,
    account,
    settings,
    serviceFeePayer: "customer",
    expectedSellerId: "seller-123",
    expectedRestaurantId: "restaurant-1",
    expected: PILOT_EXPECTED,
    ...overrides,
  });
}

function approvedPostflight(overrides = {}) {
  return evaluatePostflight({
    environment: {
      localix: "production",
      supabase: "production",
      mercadoPago: "production",
    },
    order: {
      id: "order-1",
      order_number: 1001,
      status: "pago",
      total: 9.49,
      payment_method: "pix_online",
      restaurant_id: "restaurant-1",
    },
    snapshot: {
      subtotal: 3.5,
      delivery_fee: 5,
      platform_fee: 0.99,
      customer_total: 9.49,
      restaurant_net: 3.5,
      service_fee_payer: "customer",
      realized_platform_revenue: 0.99,
    },
    orderPayment: {
      provider: "mercado_pago",
      payment_method: "pix",
      payment_id: "mp-payment-1",
      status: "APPROVED",
      transaction_amount: 9.49,
      last_error: null,
    },
    paymentSplitRows: [{
      provider: "mercadopago",
      payment_id: "mp-payment-1",
      status: "COMPLETED",
      platform_amount: 0.99,
      restaurant_amount: 3.5,
      gateway_fee: 0,
      split_reference: "mp_payment:mp-payment-1",
      error_message: null,
    }],
    webhookEvents: [{
      event_id: "evt-1",
      processed: true,
      resource_id: "mp-payment-1",
      external_reference: "order-1",
      error_message: null,
    }],
    mpPayment: {
      id: "mp-payment-1",
      status: "approved",
      transaction_amount: 9.49,
      application_fee: 0.99,
    },
    ...overrides,
  });
}

describe("Mercado Pago controlled test report", () => {
  it("CLI real sempre imprime relatorio explicito mesmo com erro de configuracao", () => {
    const result = spawnSync(process.execPath, [
      "scripts/mercadopago-controlled-test.mjs",
      "preflight",
      "--restaurant-id=restaurant-1",
      "--expected-seller-id=seller-123",
      "--customer-total=9.49",
      "--platform-fee=0.99",
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        Path: process.env.Path,
        SystemRoot: process.env.SystemRoot,
        ComSpec: process.env.ComSpec,
      },
    });

    expect(result.status).toBe(1);
    expect(result.stdout.trim()).not.toBe("");
    expect(result.stdout).toContain("MERCADO PAGO CONTROLLED TEST - ERROR");
    expect(result.stdout).toContain("FINAL RESULT: FAIL");
    expect(result.stdout).toContain("DO NOT RUN PAYMENT");
    expect(result.stdout).not.toContain("service-role");
    expect(result.stderr.trim()).toBe("");
  });

  it("pre-flight PASS valida ambiente, seller, pricing e idempotencia", () => {
    const report = preflight();

    expect(report.final).toBe("PASS");
    expect(formatReport(report)).toContain("FINAL RESULT: PASS");
    expect(formatReport(report)).not.toContain("service-role-present");
    expect(formatReport(report)).not.toContain("webhook-secret-present");
    expect(formatReport(report)).not.toContain("token-encryption-key-present");
  });

  it("pre-flight sem MP_TOKEN_ENC_KEY local marca NOT_VERIFIABLE_LOCALLY", () => {
    const report = preflight({
      env: { ...productionEnv, MP_TOKEN_ENC_KEY: undefined },
    });
    const output = formatReport(report);

    expect(report.final).toBe("MANUAL_REVIEW");
    expect(report.checks.find((check) => check.name === "MP_TOKEN_ENC_KEY remote presence")?.status).toBe("NOT_VERIFIABLE_LOCALLY");
    expect(output).toContain("MP_TOKEN_ENC_KEY remote presence: NOT_VERIFIABLE_LOCALLY");
    expect(output).toContain("REMOTE RUNTIME CHECKS REQUIRED BEFORE PAYMENT");
    expect(output).not.toContain("DO NOT RUN PAYMENT");
  });

  it("pre-flight sem MP_WEBHOOK_SECRET local marca NOT_VERIFIABLE_LOCALLY", () => {
    const report = preflight({
      env: { ...productionEnv, MP_WEBHOOK_SECRET: undefined },
    });
    const output = formatReport(report);

    expect(report.final).toBe("MANUAL_REVIEW");
    expect(report.checks.find((check) => check.name === "MP_WEBHOOK_SECRET remote presence")?.status).toBe("NOT_VERIFIABLE_LOCALLY");
    expect(output).toContain("MP_WEBHOOK_SECRET remote presence: NOT_VERIFIABLE_LOCALLY");
    expect(output).toContain("REMOTE RUNTIME CHECKS REQUIRED BEFORE PAYMENT");
    expect(output).not.toContain("DO NOT RUN PAYMENT");
  });

  it("pre-flight com secrets remotos ausentes localmente fica em MANUAL_REVIEW sem bloquear pagamento por si so", () => {
    const report = preflight({
      env: { ...productionEnv, MP_TOKEN_ENC_KEY: undefined, MP_WEBHOOK_SECRET: undefined },
    });
    const output = formatReport(report);

    expect(report.final).toBe("MANUAL_REVIEW");
    expect(output).toContain("FINAL RESULT: MANUAL_REVIEW");
    expect(output).toContain("REMOTE RUNTIME CHECKS REQUIRED BEFORE PAYMENT");
    expect(output).not.toContain("DO NOT RUN PAYMENT");
  });

  it("pre-flight com FAIL critico e NOT_VERIFIABLE_LOCALLY continua bloqueando pagamento", () => {
    const report = preflight({
      env: {
        ...productionEnv,
        LOCALIX_ENV: "staging",
        MP_TOKEN_ENC_KEY: undefined,
        MP_WEBHOOK_SECRET: undefined,
      },
    });
    const output = formatReport(report);

    expect(report.final).toBe("FAIL");
    expect(output).toContain("FINAL RESULT: FAIL");
    expect(output).toContain("DO NOT RUN PAYMENT");
    expect(output).toContain("REMOTE RUNTIME CHECKS REQUIRED BEFORE PAYMENT");
  });

  it("pre-flight falha em ambiente errado", () => {
    const report = preflight({
      env: { ...productionEnv, LOCALIX_ENV: "staging", MP_ENVIRONMENT: "sandbox" },
    });

    expect(report.final).toBe("FAIL");
    expect(report.checks.some((check) => !check.ok && check.name === "LOCALIX_ENV production")).toBe(true);
  });

  it("pre-flight falha se MP_TEST_ACCESS_TOKEN existir em production", () => {
    const report = preflight({
      env: { ...productionEnv, MP_TEST_ACCESS_TOKEN: "test-token-present" },
    });

    expect(report.final).toBe("FAIL");
    expect(report.checks.some((check) => !check.ok && check.name === "MP_TEST_ACCESS_TOKEN absent in production")).toBe(true);
    expect(formatReport(report)).not.toContain("test-token-present");
  });

  it("pre-flight falha com seller divergente", () => {
    const report = preflight({ expectedSellerId: "seller-expected" });

    expect(report.final).toBe("FAIL");
    expect(report.checks.some((check) => !check.ok && check.name === "seller expected")).toBe(true);
  });

  it("post-flight PASS para pagamento aprovado e reconciliado", () => {
    const report = approvedPostflight();

    expect(report.final).toBe("PASS");
    expect(formatReport(report)).toContain("PAYMENT: PASS");
    expect(formatReport(report)).toContain("SPLIT: PASS");
    expect(formatReport(report)).toContain("REVENUE RECOGNITION: PASS");
  });

  it("post-flight sem encryption key local nao tenta GET Mercado Pago", () => {
    const canQuery = shouldQueryMercadoPagoReadOnly({
      env: { ...productionEnv, MP_TOKEN_ENC_KEY: undefined },
      paymentId: "mp-payment-1",
      account,
    });
    const report = approvedPostflight({
      mpPayment: null,
      mpGetNotVerifiable: true,
    });
    const output = formatReport(report);

    expect(canQuery).toBe(false);
    expect(report.final).toBe("MANUAL_REVIEW");
    expect(report.checks.find((check) => check.name === "Mercado Pago GET")?.status).toBe("NOT_VERIFIABLE_LOCALLY");
    expect(output).toContain("Mercado Pago GET");
    expect(output).toContain("REMOTE RUNTIME CHECKS REQUIRED BEFORE PAYMENT");
  });

  it("post-flight FAIL quando payment continua pending", () => {
    const report = approvedPostflight({
      order: {
        id: "order-1",
        status: "aguardando_pagamento",
        total: 9.49,
        payment_method: "pix_online",
        restaurant_id: "restaurant-1",
      },
      orderPayment: {
        provider: "mercado_pago",
        payment_method: "pix",
        payment_id: "mp-payment-1",
        status: "PENDING",
        transaction_amount: 9.49,
        last_error: null,
      },
      paymentSplitRows: [{
        payment_id: "mp-payment-1",
        status: "PROCESSING",
        platform_amount: 0.99,
        restaurant_amount: 3.5,
        error_message: null,
      }],
      mpPayment: { id: "mp-payment-1", status: "pending", transaction_amount: 9.49, application_fee: 0.99 },
    });

    expect(report.final).toBe("FAIL");
    expect(report.checks.some((check) => !check.ok && check.name === "order_payment APPROVED")).toBe(true);
  });

  it("post-flight FAIL quando split esta ausente", () => {
    const report = approvedPostflight({ paymentSplitRows: [] });

    expect(report.final).toBe("FAIL");
    expect(report.checks.some((check) => !check.ok && check.name === "payment_split exists")).toBe(true);
  });

  it("post-flight FAIL quando webhook esta ausente", () => {
    const report = approvedPostflight({ webhookEvents: [] });

    expect(report.final).toBe("FAIL");
    expect(report.checks.some((check) => !check.ok && check.name === "webhook received")).toBe(true);
  });

  it("post-flight MANUAL_REVIEW quando fee diverge", () => {
    const report = approvedPostflight({
      paymentSplitRows: [{
        payment_id: "mp-payment-1",
        status: "MANUAL_REVIEW",
        platform_amount: 0.98,
        restaurant_amount: 3.5,
        error_message: "marketplace_fee_divergent",
      }],
      mpPayment: { id: "mp-payment-1", status: "approved", transaction_amount: 9.49, application_fee: 0.98 },
    });

    expect(report.final).toBe("MANUAL_REVIEW");
    expect(report.checks.some((check) => !check.ok && check.severity === "manual_review")).toBe(true);
  });

  it("post-flight MANUAL_REVIEW quando realized revenue diverge", () => {
    const report = approvedPostflight({
      snapshot: {
        subtotal: 3.5,
        delivery_fee: 5,
        platform_fee: 0.99,
        customer_total: 9.49,
        restaurant_net: 3.5,
        service_fee_payer: "customer",
        realized_platform_revenue: 0,
      },
    });

    expect(report.final).toBe("MANUAL_REVIEW");
    expect(report.checks.some((check) => !check.ok && check.name === "realized_platform_revenue expected")).toBe(true);
  });

  it("script permanece read-only e sem operacoes mutaveis", () => {
    const source = readFileSync("scripts/mercadopago-controlled-test.mjs", "utf8");

    expect(source).not.toMatch(/\.insert\s*\(/);
    expect(source).not.toMatch(/\.update\s*\(/);
    expect(source).not.toMatch(/\.delete\s*\(/);
    expect(source).not.toMatch(/\.upsert\s*\(/);
    expect(source).not.toMatch(/\.rpc\s*\(/);
    expect(source).not.toMatch(/\/refunds\b/);
    expect(source).not.toMatch(/method:\s*["']POST["']/);
  });
});
