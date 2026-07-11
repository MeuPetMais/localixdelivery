// RC-UX.3 — Constantes e utilidades para convite/ativação do entregador.
// Sem regras de negócio: apenas formatação, validação leve e montagem
// de mensagens/links. Nenhuma dependência de rede ou banco.

/** URL oficial de ativação (landing publicada dentro do app principal).
 *  Enquanto `motoboy.localix.com.br` não estiver conectado à Lovable
 *  (DNS apontando para 185.158.133.1), usamos o custom domain já ativo. */
export const DRIVER_ACTIVATION_URL = "https://app.rngdigital.com.br/entregador";
/** Caminho relativo dentro do próprio app (fallback web). */
export const DRIVER_ACTIVATION_APP_URL = "/entregador";

/* -------------------- Máscaras -------------------- */

export function onlyDigits(v: string | null | undefined): string {
  return (v ?? "").replace(/\D/g, "");
}

/** Máscara BR: (11) 90000-0000 / (11) 3000-0000 */
export function maskPhoneBR(v: string): string {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Máscara CPF: 000.000.000-00 */
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

/* -------------------- Validações -------------------- */

export function isValidPhoneBR(v: string): boolean {
  const d = onlyDigits(v);
  return d.length === 10 || d.length === 11;
}

/** Validação oficial do CPF (dígitos verificadores). */
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
    "1️⃣ Instale o aplicativo Localix Entregador.",
    "2️⃣ Abra o aplicativo.",
    "3️⃣ Informe seu CPF e telefone.",
    "4️⃣ Crie sua senha.",
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
  const phone = onlyDigits(opts.phone);
  const msg = buildInviteMessage(opts);
  const target = phone ? `https://wa.me/55${phone}` : "https://wa.me/";
  return `${target}?text=${encodeURIComponent(msg)}`;
}
