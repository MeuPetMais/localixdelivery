import { Sparkles } from "lucide-react";

/**
 * Floating CTA used on the public demo storefront and inside the demo
 * dashboard. Drives visitors to the public sign-up flow.
 */
export function CreateLocalixCta() {
  return (
    <a
      href="/auth?mode=signup"
      target="_blank"
      rel="noreferrer"
      className="fixed bottom-20 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-gradient-warm px-4 py-3 text-sm font-semibold text-primary-foreground shadow-glow ring-1 ring-primary/30 transition hover:scale-105 sm:bottom-6 sm:right-6"
    >
      <Sparkles className="h-4 w-4" />
      Quero criar meu Localix gratuitamente
    </a>
  );
}
