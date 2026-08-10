export function parseBuilderCurrencyInput(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value == null) return 0;

  const raw = String(value).trim();
  if (!raw) return 0;

  const cleaned = raw.replace(/\s/g, "").replace(/[^\d,.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === ",") return 0;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  const decimalSeparator = lastComma > lastDot ? "," : ".";

  let normalized = cleaned;
  if (lastComma >= 0 && lastDot >= 0) {
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    normalized = cleaned.replaceAll(thousandsSeparator, "").replace(decimalSeparator, ".");
  } else if (lastComma >= 0) {
    normalized = cleaned.replace(",", ".");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildBuilderMetaPayload(form: {
  name: string;
  emoji: string;
  description: string;
  image_url: string;
  base_price: unknown;
}) {
  return {
    name: form.name,
    emoji: form.emoji,
    description: form.description,
    image_url: form.image_url || null,
    base_price: parseBuilderCurrencyInput(form.base_price),
  };
}
