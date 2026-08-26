export const PARTNER_WHATSAPP_ENV = "VITE_LOCALIX_PARTNER_WHATSAPP";
export const PARTNER_WHATSAPP_MESSAGE =
  "Olá! Vim pelo site do Localix e quero saber mais sobre como cadastrar meu estabelecimento.";

export function normalizePartnerWhatsAppPhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D+/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

export function buildPartnerWhatsAppUrl(value: unknown): string | null {
  const phone = normalizePartnerWhatsAppPhone(value);
  if (!phone) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(PARTNER_WHATSAPP_MESSAGE)}`;
}

export function PartnerWhatsAppFloatingButton() {
  const href = buildPartnerWhatsAppUrl(import.meta.env[PARTNER_WHATSAPP_ENV]);

  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar com a Localix pelo WhatsApp"
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-[calc(env(safe-area-inset-right)+1rem)] z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:bg-[#1ebe5d] hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#128C7E] sm:bottom-6 sm:right-6 sm:h-12 sm:w-auto sm:px-5"
    >
      <WhatsAppIcon />
      <span className="hidden text-sm font-bold sm:ml-2 sm:inline">Fale com a Localix</span>
    </a>
  );
}

function WhatsAppIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-6 w-6 shrink-0 fill-current"
      focusable="false"
    >
      <path d="M12.04 2a9.9 9.9 0 0 0-8.55 14.86L2.2 21.8l5.05-1.25A9.93 9.93 0 1 0 12.04 2Zm0 1.8a8.13 8.13 0 0 1 6.91 12.42 8.18 8.18 0 0 1-10.96 2.5l-.35-.2-2.9.72.75-2.84-.23-.37A8.1 8.1 0 0 1 12.04 3.8Zm-3.2 3.7c-.18 0-.47.06-.72.33-.25.27-.95.93-.95 2.27s.98 2.64 1.12 2.82c.14.18 1.9 3.04 4.7 4.14 2.32.91 2.8.73 3.3.69.5-.05 1.62-.66 1.85-1.3.23-.64.23-1.19.16-1.3-.07-.12-.25-.19-.53-.33-.28-.14-1.62-.8-1.87-.89-.25-.09-.44-.14-.62.14-.18.27-.71.89-.87 1.07-.16.19-.32.21-.6.07-.28-.14-1.17-.43-2.23-1.38-.82-.73-1.38-1.64-1.54-1.92-.16-.27-.02-.42.12-.56.13-.13.28-.32.42-.48.14-.16.18-.27.28-.45.09-.18.05-.34-.02-.48-.07-.14-.62-1.49-.85-2.04-.22-.53-.45-.46-.62-.47h-.53Z" />
    </svg>
  );
}
