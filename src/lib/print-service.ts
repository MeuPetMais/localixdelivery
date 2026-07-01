/**
 * Print service — arquitetura desacoplada para impressão de comandas.
 *
 * Suporta múltiplos adapters (browser, USB, Bluetooth, rede) — hoje apenas
 * o adapter `browser` está implementado. Basta registrar novos adapters
 * chamando `registerPrinterAdapter()` para adicionar suporte a novos
 * dispositivos sem alterar o restante do app.
 */

import { brl } from "@/lib/format";

export type PrintableOrder = {
  order_number: number | null;
  customer_name: string;
  customer_phone?: string | null;
  address?: string | null;
  items: Array<{ name: string; qty: number; price: number; notes?: string | null }>;
  notes?: string | null;
  payment_method?: string | null;
  delivery_fee?: number | null;
  total: number;
  created_at: string;
  restaurant_name?: string | null;
};

export interface PrinterAdapter {
  key: string;
  label: string;
  isAvailable(): boolean | Promise<boolean>;
  print(order: PrintableOrder): Promise<void>;
}

const adapters = new Map<string, PrinterAdapter>();

export function registerPrinterAdapter(a: PrinterAdapter) {
  adapters.set(a.key, a);
}

export function getPrinterAdapter(key?: string): PrinterAdapter | null {
  if (key && adapters.has(key)) return adapters.get(key)!;
  // Fallback: primeiro disponível.
  for (const a of adapters.values()) return a;
  return null;
}

export function listPrinterAdapters(): PrinterAdapter[] {
  return Array.from(adapters.values());
}

/* --------------------------- Renderização HTML --------------------------- */

export function renderReceiptHtml(order: PrintableOrder): string {
  const rows = order.items
    .map(
      (it) => `
        <tr>
          <td>${it.qty}x</td>
          <td>${escapeHtml(it.name)}${it.notes ? `<div class="obs">${escapeHtml(it.notes)}</div>` : ""}</td>
          <td class="r">${brl(it.qty * it.price)}</td>
        </tr>`,
    )
    .join("");
  const dt = new Date(order.created_at);
  return `<!doctype html><html><head><meta charset="utf-8"><title>Pedido #${order.order_number ?? ""}</title>
  <style>
    @page { size: 80mm auto; margin: 4mm; }
    body { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 12px; color:#000; }
    h1 { font-size: 16px; margin: 0 0 4px; text-align:center; }
    .muted { color:#333; }
    .row { display:flex; justify-content:space-between; gap:8px; }
    hr { border:none; border-top:1px dashed #000; margin:6px 0; }
    table { width:100%; border-collapse: collapse; }
    td { vertical-align: top; padding: 2px 0; }
    td.r { text-align:right; }
    .obs { font-size: 11px; color:#333; }
    .total { font-size: 14px; font-weight: 700; }
  </style></head><body onload="window.print();setTimeout(()=>window.close(),200)">
    <h1>${escapeHtml(order.restaurant_name || "Localix")}</h1>
    <div class="muted" style="text-align:center">${dt.toLocaleString("pt-BR")}</div>
    <hr/>
    <div><strong>Pedido #${order.order_number ?? "—"}</strong></div>
    <div>Cliente: ${escapeHtml(order.customer_name || "-")}</div>
    ${order.customer_phone ? `<div>Tel.: ${escapeHtml(order.customer_phone)}</div>` : ""}
    ${order.address ? `<div>End.: ${escapeHtml(order.address)}</div>` : ""}
    <hr/>
    <table>${rows}</table>
    <hr/>
    ${order.notes ? `<div>Obs.: ${escapeHtml(order.notes)}</div><hr/>` : ""}
    ${order.delivery_fee ? `<div class="row"><span>Taxa de entrega</span><span>${brl(order.delivery_fee)}</span></div>` : ""}
    <div class="row total"><span>Total</span><span>${brl(order.total)}</span></div>
    <div class="row"><span>Pagamento</span><span>${escapeHtml(order.payment_method || "-")}</span></div>
  </body></html>`;
}

function escapeHtml(v: string): string {
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* --------------------------- Adapter: Browser --------------------------- */

const browserAdapter: PrinterAdapter = {
  key: "browser",
  label: "Impressora do sistema (via navegador)",
  isAvailable() {
    return typeof window !== "undefined";
  },
  async print(order) {
    const html = renderReceiptHtml(order);
    const w = window.open("", "_blank", "width=380,height=640");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  },
};
registerPrinterAdapter(browserAdapter);

/* --------------------------- Stubs para futuro --------------------------- */
/**
 * TODO: registrar quando integrar drivers reais.
 *
 * registerPrinterAdapter({
 *   key: "webusb",
 *   label: "Impressora térmica USB (ESC/POS)",
 *   isAvailable: () => "usb" in navigator,
 *   print: async (order) => { ...ESC/POS bytes via WebUSB... },
 * });
 * registerPrinterAdapter({
 *   key: "bluetooth",
 *   label: "Impressora Bluetooth",
 *   isAvailable: () => "bluetooth" in navigator,
 *   print: async (order) => { ...via Web Bluetooth GATT... },
 * });
 * registerPrinterAdapter({
 *   key: "network",
 *   label: "Impressora em rede (IP)",
 *   isAvailable: () => true,
 *   print: async (order) => { ...POST para bridge local/edge fn... },
 * });
 */

/* ----------------------------- Configuração ----------------------------- */

const LS_ENABLED = "localix.print.autoOnNew";
const LS_ADAPTER = "localix.print.adapter";

export function isAutoPrintEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(LS_ENABLED) === "1";
}
export function setAutoPrintEnabled(v: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_ENABLED, v ? "1" : "0");
}
export function getPreferredAdapterKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LS_ADAPTER);
}
export function setPreferredAdapterKey(key: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_ADAPTER, key);
}

export async function printOrder(order: PrintableOrder, adapterKey?: string) {
  const adapter = getPrinterAdapter(adapterKey ?? getPreferredAdapterKey() ?? undefined);
  if (!adapter) return;
  const available = await Promise.resolve(adapter.isAvailable());
  if (!available) return;
  await adapter.print(order);
}
