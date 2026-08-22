// Contrato genérico para gateways de pagamento.
// Novos providers implementam a mesma interface e são registrados em
// `providers/index.ts` — o restante do app usa apenas PaymentService.

import type { TransparentCardInput } from "../transparent-card";

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

export interface CreateCheckoutInput {
  orderId: string;
  restaurantId: string;
  method: "pix" | "card";
  amount: number;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
  card?: TransparentCardInput;
}

export interface CreateCheckoutResult {
  provider: string;
  /** URL para redirecionar o cliente (Stripe Checkout / ticket_url MP). */
  redirectUrl: string | null;
  /** Identificador do pagamento no provider (session_id / payment_id). */
  externalId: string | null;
  /** Dados de PIX quando aplicável. */
  pix?: {
    qrCode: string | null;
    qrCodeBase64: string | null;
    expirationDate: string | null;
  };
  status: "PENDING" | "PROCESSING";
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

  /** Cria uma cobrança / checkout no gateway. */
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
}
