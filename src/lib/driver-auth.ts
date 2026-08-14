export type DriverLoginCandidate = {
  email: string | null;
  cpf: string | null;
  phone: string | null;
  status: string | null;
  owner_id: string | null;
};

export const DRIVER_PASSWORD_RESET_CONFIRMATION = `Solicitacao registrada.

Se existir uma conta ativa vinculada aos dados informados, enviaremos as instrucoes para o e-mail cadastrado.

Se voce nao receber o e-mail, peca ao restaurante para gerar um link de recuperacao no painel.`;

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
    (candidate) =>
      isActiveDriverLoginCandidate(candidate) && matchesDriverIdentifier(candidate, identifier),
  );

  return match?.email ?? null;
}

export function isGeneratedDriverEmail(email: string | null | undefined, driverId: string) {
  return (email ?? "").trim().toLowerCase() === `driver+${driverId}@localix.app`;
}
