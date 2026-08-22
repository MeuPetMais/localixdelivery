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

export interface MercadoPagoTokenizationErrorDiagnostic {
  name?: string;
  message?: string;
  code?: string | number;
  type?: string;
  field?: string;
  cause?: Array<{
    code?: string | number;
    message?: string;
    description?: string;
    type?: string;
    field?: string;
  }>;
}

function redactSensitiveText(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  if (!text) return undefined;
  return text.replace(/\d{6,}/g, "[redacted-digits]");
}

function readDiagnosticField(
  source: Record<string, unknown>,
  key: string,
): string | number | undefined {
  const value = source[key];
  if (typeof value === "number") return value;
  return redactSensitiveText(value);
}

export function sanitizeMercadoPagoTokenizationError(
  error: unknown,
): MercadoPagoTokenizationErrorDiagnostic {
  if (!error || typeof error !== "object") {
    return { message: redactSensitiveText(error) };
  }

  const source = error as Record<string, unknown>;
  const diagnostic: MercadoPagoTokenizationErrorDiagnostic = {};
  const name = readDiagnosticField(source, "name");
  const message = readDiagnosticField(source, "message");
  const code = readDiagnosticField(source, "code");
  const type = readDiagnosticField(source, "type");
  const field = readDiagnosticField(source, "field");

  if (name) diagnostic.name = String(name);
  if (message) diagnostic.message = String(message);
  if (code) diagnostic.code = code;
  if (type) diagnostic.type = String(type);
  if (field) diagnostic.field = String(field);

  if (Array.isArray(source.cause)) {
    diagnostic.cause = source.cause
      .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
      .map((item) => {
        const cause: NonNullable<MercadoPagoTokenizationErrorDiagnostic["cause"]>[number] = {};
        const causeCode = readDiagnosticField(item, "code");
        const causeMessage = readDiagnosticField(item, "message");
        const causeDescription = readDiagnosticField(item, "description");
        const causeType = readDiagnosticField(item, "type");
        const causeField = readDiagnosticField(item, "field");
        if (causeCode) cause.code = causeCode;
        if (causeMessage) cause.message = String(causeMessage);
        if (causeDescription) cause.description = String(causeDescription);
        if (causeType) cause.type = String(causeType);
        if (causeField) cause.field = String(causeField);
        return cause;
      });
  }

  return diagnostic;
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

  const issuerId =
    data.issuerId === null || data.issuerId === undefined
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
