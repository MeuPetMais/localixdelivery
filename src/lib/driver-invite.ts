// RC-UX.3 - Constantes e utilidades para convite/ativacao do entregador.
// Sem regras de negocio: apenas formatacao, validacao leve e montagem
// de mensagens/links. Nenhuma dependencia de rede ou banco.

/** URL oficial de ativacao (landing publicada dentro do app principal). */
export const APP_BASE_URL = "https://localixdelivery.rngdigital.com.br";
export const DRIVER_ACTIVATION_URL = `${APP_BASE_URL}/entregador`;
/** Caminho relativo dentro do proprio app (fallback web). */
export const DRIVER_ACTIVATION_APP_URL = "/entregador";
export const DRIVER_PASSWORD_RESET_APP_URL = "/entregador/redefinir-senha";

/* -------------------- Mascaras -------------------- */

export function onlyDigits(v: string | null | undefined): string {
  return (v ?? "").replace(/\D/g, "");
}

/** Mascara BR: (11) 90000-0000 / (11) 3000-0000 */
export function maskPhoneBR(v: string): string {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Mascara CPF: 000.000.000-00 */
export function maskCPF(v: string): string {
  const d = onlyDigits(v).slice(0, 11);
  const p1 = d.slice(0, 3);
  const p2 = d.slice(3, 6);
  const p3 = d.slice(6, 9);
  const p4 = d.slice(9, 11);
  let out = p1;
  if (p2) out += `.${p2}`;
  if (p3) out += `.${p3}`;
  if (p4) out += `-${p4}`;
  return out;
}

/* -------------------- Validacoes -------------------- */

export function isValidPhoneBR(v: string): boolean {
  const d = onlyDigits(v);
  return d.length === 10 || d.length === 11;
}

/** Validacao oficial do CPF (digitos verificadores). */
export function isValidCPF(v: string): boolean {
  const d = onlyDigits(v);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  const calc = (base: string, factor: number) => {
    let sum = 0;
    for (const ch of base) sum += parseInt(ch, 10) * factor--;
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const dv1 = calc(d.slice(0, 9), 10);
  const dv2 = calc(d.slice(0, 10), 11);
  return dv1 === parseInt(d[9], 10) && dv2 === parseInt(d[10], 10);
}

/* -------------------- Mensagem / Links -------------------- */

export function buildInviteMessage(opts: {
  driverName: string;
  restaurantName: string;
  activationUrl?: string;
}): string {
  const url = opts.activationUrl ?? DRIVER_ACTIVATION_URL;
  const firstName = opts.driverName.trim().split(/\s+/)[0] || "olá";
  return [
    `Olá, ${firstName}!`,
    "",
    `Você foi cadastrado como entregador da ${opts.restaurantName}.`,
    "Agora basta ativar sua conta:",
    "",
    "1. Instale o aplicativo Localix Entregador.",
    "2. Abra o aplicativo.",
    "3. Informe seu CPF e telefone.",
    "4. Crie sua senha.",
    "",
    `Link: ${url}`,
    "",
    "Se precisar de ajuda, entre em contato com o restaurante.",
  ].join("\n");
}

export function buildWhatsAppUrl(opts: {
  phone: string;
  driverName: string;
  restaurantName: string;
  activationUrl?: string;
}): string {
  return buildWhatsAppMessageUrl(opts.phone, buildInviteMessage(opts));
}

export function buildDriverAppAccessMessage(opts: {
  driverName: string;
  restaurantName: string;
  appUrl?: string;
}): string {
  const url = opts.appUrl ?? DRIVER_ACTIVATION_URL;
  const firstName = opts.driverName.trim().split(/\s+/)[0] || "olá";
  return [
    `Olá, ${firstName}!`,
    "",
    `Aqui é da ${opts.restaurantName}.`,
    "Para acessar o app Localix Entregador, use este link:",
    "",
    `Link: ${url}`,
    "",
    "Entre com seu CPF ou telefone e sua senha.",
  ].join("\n");
}

export function buildDriverRecoveryMessage(opts: {
  driverName: string;
  restaurantName: string;
  recoveryUrl: string;
}): string {
  const firstName = opts.driverName.trim().split(/\s+/)[0] || "olá";
  return [
    `Olá, ${firstName}!`,
    "",
    `Aqui é da ${opts.restaurantName}.`,
    "Use este link seguro para redefinir sua senha do app Localix Entregador:",
    "",
    opts.recoveryUrl,
    "",
    "Se você não solicitou essa alteração, ignore esta mensagem e fale com o restaurante.",
  ].join("\n");
}

export function buildDriverAppAccessWhatsAppUrl(opts: {
  phone: string;
  driverName: string;
  restaurantName: string;
  appUrl?: string;
}): string {
  return buildWhatsAppMessageUrl(opts.phone, buildDriverAppAccessMessage(opts));
}

export function buildDriverRecoveryWhatsAppUrl(opts: {
  phone: string;
  driverName: string;
  restaurantName: string;
  recoveryUrl: string;
}): string {
  return buildWhatsAppMessageUrl(opts.phone, buildDriverRecoveryMessage(opts));
}

function buildWhatsAppMessageUrl(phoneValue: string, message: string): string {
  const phone = onlyDigits(phoneValue);
  const normalizedPhone = phone.startsWith("55") ? phone : `55${phone}`;
  const target = phone ? `https://wa.me/${normalizedPhone}` : "https://wa.me/";
  return `${target}?text=${encodeURIComponent(message)}`;
}
