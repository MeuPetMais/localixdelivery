export interface TransparentCardPayerInput {
  identificationType?: string | null;
  identificationNumber?: string | null;
}

export interface TransparentCardInput {
  token: string;
  paymentMethodId: string;
  issuerId?: string | null;
  installments: number;
  payer?: TransparentCardPayerInput;
}

export interface MercadoPagoCardFormData {
  token?: string | null;
  paymentMethodId?: string | null;
  issuerId?: string | number | null;
  installments?: string | number | null;
  cardholderEmail?: string | null;
  identificationType?: string | null;
  identificationNumber?: string | null;
}

export function sanitizeMercadoPagoCardFormData(
  data: MercadoPagoCardFormData,
): TransparentCardInput {
  const token = String(data.token ?? "").trim();
  const paymentMethodId = String(data.paymentMethodId ?? "").trim();
  const installments = Number(data.installments ?? 0);
  if (!token) throw new Error("card_token_required");
  if (!paymentMethodId) throw new Error("payment_method_required");
  if (!Number.isInteger(installments) || installments < 1) {
    throw new Error("installments_required");
  }

  const issuerId = data.issuerId === null || data.issuerId === undefined
    ? undefined
    : String(data.issuerId).trim() || undefined;
  const identificationType = String(data.identificationType ?? "").trim() || undefined;
  const identificationNumber =
    String(data.identificationNumber ?? "").replace(/\D/g, "") || undefined;

  return {
    token,
    paymentMethodId,
    issuerId,
    installments,
    payer:
      identificationType || identificationNumber
        ? { identificationType, identificationNumber }
        : undefined,
  };
}

export function assertTransparentCardReady(card: TransparentCardInput | undefined): void {
  if (!card?.token) throw new Error("card_token_required");
  if (!card.paymentMethodId) throw new Error("payment_method_required");
  if (!Number.isInteger(card.installments) || card.installments < 1) {
    throw new Error("installments_required");
  }
}
