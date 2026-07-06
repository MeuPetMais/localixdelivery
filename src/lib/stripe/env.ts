// Stripe Domain — Configuração de ambiente.
// Regras:
//  - Sandbox por padrão neste milestone. Produção só é habilitada quando
//    STRIPE_MODE=live for definido explicitamente em variáveis de ambiente
//    do servidor (Edge Function). Nunca no cliente.
//  - Este módulo NÃO lê `process.env` no escopo de importação — tudo é
//    resolvido dentro de funções para não vazar no bundle do navegador.

export type StripeEnvironment = "sandbox" | "live";

export interface StripeEnvConfig {
  mode: StripeEnvironment;
  publishableKey: string | null;
  /** Segredo — só existe no servidor. Nunca retornar ao cliente. */
  secretKey: string | null;
  webhookSecret: string | null;
  allowLive: boolean;
}

/**
 * Lê variáveis de ambiente do Stripe.
 * Chamar APENAS dentro de Edge Functions / server functions.
 */
export function readStripeEnv(env: Record<string, string | undefined> = {}): StripeEnvConfig {
  const requestedMode = (env.STRIPE_MODE ?? "sandbox").toLowerCase();
  const allowLive = env.STRIPE_ALLOW_LIVE === "true";
  const mode: StripeEnvironment = requestedMode === "live" && allowLive ? "live" : "sandbox";

  const secretKey =
    mode === "live" ? env.STRIPE_SECRET_KEY_LIVE ?? null : env.STRIPE_SECRET_KEY_TEST ?? null;
  const publishableKey =
    mode === "live"
      ? env.STRIPE_PUBLISHABLE_KEY_LIVE ?? null
      : env.STRIPE_PUBLISHABLE_KEY_TEST ?? null;
  const webhookSecret =
    mode === "live"
      ? env.STRIPE_WEBHOOK_SECRET_LIVE ?? null
      : env.STRIPE_WEBHOOK_SECRET_TEST ?? null;

  return { mode, publishableKey, secretKey, webhookSecret, allowLive };
}

/**
 * Valida o prefixo da chave secreta contra o modo pedido. Chamar somente
 * do servidor.
 */
export function assertKeyMatchesMode(cfg: StripeEnvConfig): void {
  if (!cfg.secretKey) throw new Error(`Stripe secret key ausente para modo=${cfg.mode}.`);
  const isTest = cfg.secretKey.startsWith("sk_test_");
  const isLive = cfg.secretKey.startsWith("sk_live_");
  if (cfg.mode === "live" && !isLive) throw new Error("Modo live exige chave sk_live_.");
  if (cfg.mode === "sandbox" && !isTest) throw new Error("Modo sandbox exige chave sk_test_.");
}

/**
 * Trava de segurança: nesta etapa, PROIBIDO usar produção — a infra
 * ainda está sendo preparada e não deve processar pagamentos reais.
 */
export function assertSandboxOnly(cfg: StripeEnvConfig): void {
  if (cfg.mode !== "sandbox") {
    throw new Error(
      "Stripe: modo live bloqueado neste milestone. Toda a infra opera apenas em sandbox.",
    );
  }
}
