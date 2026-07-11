export type DriverLoginCandidate = {
  email: string | null;
  cpf: string | null;
  phone: string | null;
  status: string | null;
  owner_id: string | null;
};

export const DRIVER_PASSWORD_RESET_CONFIRMATION = `Solicitação registrada.

Se existir uma conta vinculada a este telefone, sua solicitação foi registrada.

Em breve a recuperação automática por SMS ou WhatsApp estará disponível.

Enquanto isso, entre em contato com o restaurante ou com o suporte da Localix.`;

export const digits = (value: string | null | undefined) => (value ?? "").replace(/\D/g, "");

function normalizeBrazilPhone(value: string | null | undefined) {
  const onlyDigits = digits(value);
  if (onlyDigits.length >= 12 && onlyDigits.startsWith("55")) return onlyDigits.slice(2);
  return onlyDigits;
}

export function isActiveDriverLoginCandidate(candidate: DriverLoginCandidate) {
  return candidate.status === "ativo" && !!candidate.owner_id && !!candidate.email;
}

export function matchesDriverIdentifier(candidate: DriverLoginCandidate, identifier: string) {
  const normalized = identifier.trim().toLowerCase();
  const normalizedDigits = digits(identifier);
  const isDocumentOrPhone = normalizedDigits.length >= 8;

  if (isDocumentOrPhone) {
    const cpfDigits = digits(candidate.cpf);
    const candidatePhone = normalizeBrazilPhone(candidate.phone);
    const inputPhone = normalizeBrazilPhone(identifier);

    return cpfDigits === normalizedDigits || candidatePhone === inputPhone;
  }

  return (candidate.email ?? "").toLowerCase() === normalized;
}

export function resolveDriverLoginEmail(candidates: DriverLoginCandidate[], identifier: string) {
  const match = candidates.find(
    (candidate) => isActiveDriverLoginCandidate(candidate) && matchesDriverIdentifier(candidate, identifier),
  );

  return match?.email ?? null;
}