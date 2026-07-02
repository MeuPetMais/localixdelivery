// Contrato genérico para gateways de pagamento.
// Novos providers (Pagar.me, Asaas, Stripe) implementam a mesma interface
// e são registrados em `providers/index.ts` — o resto do app não muda.

export interface OAuthStartResult {
  authorizeUrl: string;
}

export interface ConnectionStatus {
  provider: string;
  connected: boolean;
  accountId: string | null;
  liveMode: boolean;
  scope: string | null;
  connectedAt: string | null;
  disconnectedAt: string | null;
  expiresAt: string | null;
  /** Chave pública para SDKs client-side. Nunca contém segredos. */
  publicKey: string | null;
}

export interface PaymentProvider {
  readonly id: string;
  readonly label: string;
  supportsOAuth: boolean;

  /** Inicia o fluxo OAuth (retorna a URL de autorização). */
  startOAuth(restaurantId: string, redirectTo?: string): Promise<OAuthStartResult>;

  /** Estado atual da conexão do restaurante com o gateway. */
  getStatus(restaurantId: string): Promise<ConnectionStatus>;

  /** Desconecta o restaurante do gateway. */
  disconnect(restaurantId: string): Promise<void>;
}
