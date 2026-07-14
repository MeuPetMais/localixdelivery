import { paymentMethodLabel } from "@/lib/checkout/paymentMethodLabel";
/**
 * Print service — Localix.
 *
 * Sistema modular para impressão de pedidos com suporte a:
 *  - Papel térmico 58 mm, 80 mm e A4
 *  - Dois modelos: `kitchen` (comanda da cozinha, sem preços) e
 *    `customer` (cupom para acompanhar o pedido / entrega)
 *  - Impressão automática ao chegar novo pedido (opt-in)
 *  - Múltiplas vias configuráveis (cozinha, entrega, cliente)
 *  - Arquitetura de adapters para integração futura com WebUSB,
 *    Web Bluetooth, PrintNode, QZ Tray, etc.
 *
 * Layout otimizado para papel térmico: fonte monoespaçada, alto
 * contraste, sem sombras, gradientes ou bordas arredondadas.
 */

import { brl } from "@/lib/format";
import QRCode from "qrcode";

/* ------------------------------- Tipos --------------------------------- */

export type PaperSize = "58mm" | "80mm" | "a4";
export type PrintTemplate = "kitchen" | "customer";
export type OrderType = "delivery" | "pickup" | "table";

export type PrintableItem = {
  name: string;
  qty: number;
  price: number;
  notes?: string | null;
  /** Ingredientes/opções escolhidas em builders (Monte do Seu Jeito) */
  options?: string[] | null;
  /** Ingredientes removidos pelo cliente */
  removed?: string[] | null;
  /** Grupos de builder no formato { "Pão": ["Brioche"], "Carne": ["Artesanal 180g"] } */
  builderGroups?: Record<string, string[]> | null;
  /** Categoria para agrupamento na impressão (ex.: "Bebidas", "Sobremesas") */
  category?: string | null;
  /** Marca item de builder (Monte do Seu Jeito) */
  isBuilder?: boolean | null;
};

export type PrintableOrder = {
  order_number: number | null;
  customer_name: string;
  customer_phone?: string | null;
  address?: string | null;
  address_complement?: string | null;
  address_neighborhood?: string | null;
  items: PrintableItem[];
  notes?: string | null;
  payment_method?: string | null;
  change_for?: number | null;
  delivery_fee?: number | null;
  coupon_code?: string | null;
  coupon_discount?: number | null;
  total: number;
  created_at: string;
  restaurant_name?: string | null;
  restaurant_logo?: string | null;
  order_type?: OrderType | null;
  priority?: string | null;
  table_number?: string | number | null;
  /** URL de acompanhamento — vira QR Code no rodapé da comanda */
  tracking_url?: string | null;
  /** ID interno do pedido (usado no QR quando não há tracking_url) */
  order_id?: string | null;
};

export interface PrinterAdapter {
  key: string;
  label: string;
  isAvailable(): boolean | Promise<boolean>;
  print(html: string): Promise<void>;
}

/* ----------------------------- Adapters ------------------------------- */

const adapters = new Map<string, PrinterAdapter>();

export function registerPrinterAdapter(a: PrinterAdapter) {
  adapters.set(a.key, a);
}
export function getPrinterAdapter(key?: string): PrinterAdapter | null {
  if (key && adapters.has(key)) return adapters.get(key)!;
  for (const a of adapters.values()) return a;
  return null;
}
export function listPrinterAdapters(): PrinterAdapter[] {
  return Array.from(adapters.values());
}

const browserAdapter: PrinterAdapter = {
  key: "browser",
  label: "Impressora do sistema (via navegador)",
  isAvailable() {
    return typeof window !== "undefined";
  },
  async print(html) {
    // iframe silencioso — não abre nova janela nem exige popup permitido
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(html);
    doc.close();
    // aguarda layout e dispara impressão
    await new Promise((r) => setTimeout(r, 80));
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => iframe.remove(), 1500);
    }
  },
};
registerPrinterAdapter(browserAdapter);

/* --------------------------- Configuração ----------------------------- */

const LS_AUTO = "localix.print.autoOnNew";
const LS_PAPER = "localix.print.paper";
const LS_ADAPTER = "localix.print.adapter";
const LS_COPIES = "localix.print.copies"; // JSON: {kitchen,delivery,customer}

export type AutoCopies = { kitchen: boolean; delivery: boolean; customer: boolean };

export function isAutoPrintEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(LS_AUTO) === "1";
}
export function setAutoPrintEnabled(v: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_AUTO, v ? "1" : "0");
}
export function getPaperSize(): PaperSize {
  if (typeof window === "undefined") return "80mm";
  const v = localStorage.getItem(LS_PAPER) as PaperSize | null;
  return v === "58mm" || v === "80mm" || v === "a4" ? v : "80mm";
}
export function setPaperSize(v: PaperSize) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_PAPER, v);
}
export function getPreferredAdapterKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LS_ADAPTER);
}
export function setPreferredAdapterKey(key: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_ADAPTER, key);
}
export function getAutoCopies(): AutoCopies {
  const fallback: AutoCopies = { kitchen: true, delivery: false, customer: false };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(LS_COPIES);
    if (!raw) return fallback;
    const p = JSON.parse(raw);
    return {
      kitchen: !!p.kitchen,
      delivery: !!p.delivery,
      customer: !!p.customer,
    };
  } catch {
    return fallback;
  }
}
export function setAutoCopies(c: AutoCopies) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_COPIES, JSON.stringify(c));
}

/* ------------------------- Renderização HTML -------------------------- */

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function paperCss(paper: PaperSize): string {
  if (paper === "a4") {
    return `@page { size: A4; margin: 12mm; }
      body { max-width: 180mm; margin: 0 auto; font-size: 13px; }`;
  }
  const width = paper === "58mm" ? "58mm" : "80mm";
  const inner = paper === "58mm" ? "54mm" : "76mm";
  return `@page { size: ${width} auto; margin: 2mm; }
    body { width: ${inner}; font-size: ${paper === "58mm" ? "11px" : "12px"}; }`;
}

function baseCss(paper: PaperSize): string {
  return `
    * { box-sizing: border-box; }
    ${paperCss(paper)}
    html, body { background: #fff; color: #000; }
    body {
      font-family: "Courier New", ui-monospace, "SF Mono", Menlo, monospace;
      margin: 0; padding: 0;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
      line-height: 1.25;
    }
    h1, h2, h3, .center { text-align: center; margin: 0; }
    h1 { font-size: 1.25em; font-weight: 900; letter-spacing: 0.02em; }
    h2 { font-size: 1.1em; font-weight: 800; }
    .big { font-size: 1.8em; font-weight: 900; letter-spacing: 0.05em; }
    .huge { font-size: 2.2em; font-weight: 900; letter-spacing: 0.06em; }
    .sep { border: 0; border-top: 1px dashed #000; margin: 4px 0; }
    .thick { border: 0; border-top: 2px solid #000; margin: 4px 0; }
    .row { display: flex; justify-content: space-between; gap: 6px; }
    .b { font-weight: 800; }
    .u { text-transform: uppercase; }
    .mt { margin-top: 4px; }
    .item { margin: 4px 0; page-break-inside: avoid; }
    .opts { padding-left: 10px; }
    .obs { font-weight: 800; text-transform: uppercase; margin-top: 2px; }
    .total { font-size: 1.15em; font-weight: 900; }
    .group-title { font-weight: 900; text-transform: uppercase; margin-top: 6px; border-bottom: 1px solid #000; }
    .builder-title { font-weight: 900; text-transform: uppercase; margin-top: 2px; }
    .builder-group { margin-top: 2px; }
    .builder-group .gname { font-weight: 800; text-transform: uppercase; }
    .qr { text-align: center; margin-top: 6px; }
    .qr img { image-rendering: pixelated; max-width: 40mm; }
    ul { margin: 2px 0 2px 14px; padding: 0; }
    /* Quebra automática — impede corte em termina de 58/80mm */
    body, div, span, li { word-break: break-word; overflow-wrap: anywhere; }
  `;
}

function headerBlock(o: PrintableOrder): string {
  const dt = new Date(o.created_at).toLocaleString("pt-BR");
  const consumo =
    o.order_type === "delivery" ? "ENTREGA" :
    o.order_type === "pickup" ? "RETIRADA" :
    o.order_type === "table" ? `MESA${o.table_number ? " " + o.table_number : ""}` :
    o.address ? "ENTREGA" : "RETIRADA";
  return `
    ${o.restaurant_logo ? `<div class="center"><img src="${esc(o.restaurant_logo)}" alt="" style="max-width:60%;max-height:60px;filter:grayscale(1) contrast(2)"/></div>` : ""}
    <h1>${esc(o.restaurant_name || "Localix")}</h1>
    <div class="center">${esc(dt)}</div>
    <hr class="thick"/>
    <div class="center huge">PEDIDO #${o.order_number ?? "—"}</div>
    <hr class="sep"/>
    <div><span class="b">Cliente:</span> ${esc(o.customer_name || "-")}</div>
    <div><span class="b">Consumo:</span> ${esc(consumo)}</div>
    ${o.priority ? `<div class="b u">★ ${esc(o.priority)}</div>` : ""}
  `;
}

/** Categorias de agrupamento na impressão. */
const GROUP_ORDER = ["Itens", "Bebidas", "Sobremesas", "Outros"] as const;
type GroupKey = (typeof GROUP_ORDER)[number];

function categorize(it: PrintableItem): GroupKey {
  const c = (it.category ?? "").toLowerCase();
  if (/bebid|drink|refri|suco|cerv|água|agua/.test(c)) return "Bebidas";
  if (/sobrem|dessert|doce|sorvete/.test(c)) return "Sobremesas";
  if (c) return "Outros";
  return "Itens";
}

function groupItems(items: PrintableItem[]): Array<[GroupKey, PrintableItem[]]> {
  const buckets = new Map<GroupKey, PrintableItem[]>();
  items.forEach((it) => {
    const g = categorize(it);
    if (!buckets.has(g)) buckets.set(g, []);
    buckets.get(g)!.push(it);
  });
  return GROUP_ORDER.filter((g) => buckets.has(g)).map((g) => [g, buckets.get(g)!]);
}

function renderBuilderGroups(groups?: Record<string, string[]> | null): string {
  if (!groups) return "";
  const entries = Object.entries(groups).filter(([, v]) => (v ?? []).length);
  if (!entries.length) return "";
  return `<div class="opts">${entries
    .map(
      ([g, vals]) =>
        `<div class="builder-group"><span class="gname">${esc(g)}:</span> ${vals
          .map((v) => `✓ ${esc(v)}`)
          .join("  ")}</div>`,
    )
    .join("")}</div>`;
}

function itemLineKitchen(it: PrintableItem): string {
  const opts = (it.options ?? []).filter(Boolean);
  const removed = (it.removed ?? []).filter(Boolean);
  const builder = renderBuilderGroups(it.builderGroups ?? null);
  const flatOpts =
    !builder && opts.length
      ? `<ul class="opts">${opts.map((o) => `<li>✓ ${esc(o)}</li>`).join("")}</ul>`
      : "";
  return `
    <div class="item">
      <div class="b">${it.qty}x ${esc(it.name)}${it.isBuilder ? " ★" : ""}</div>
      ${builder}
      ${flatOpts}
      ${removed.length ? `<div class="opts b">SEM: ${removed.map((r) => `✗ ${esc(r)}`).join("  ")}</div>` : ""}
      ${it.notes ? `<div class="obs">OBS: ${esc(it.notes)}</div>` : ""}
    </div>`;
}

function itemLineCustomer(it: PrintableItem): string {
  const line = brl(Number(it.price) * Number(it.qty));
  const opts = (it.options ?? []).filter(Boolean);
  const removed = (it.removed ?? []).filter(Boolean);
  const builder = renderBuilderGroups(it.builderGroups ?? null);
  return `
    <div class="item">
      <div class="row"><span class="b">${it.qty}x ${esc(it.name)}</span><span class="b">${line}</span></div>
      ${builder}
      ${!builder && opts.length ? `<div class="opts">${opts.map((o) => `✓ ${esc(o)}`).join("  ")}</div>` : ""}
      ${removed.length ? `<div class="opts">Sem: ${removed.map((r) => `✗ ${esc(r)}`).join("  ")}</div>` : ""}
      ${it.notes ? `<div class="opts">Obs: ${esc(it.notes)}</div>` : ""}
    </div>`;
}

function groupedBlock(items: PrintableItem[], lineFn: (it: PrintableItem) => string): string {
  const groups = groupItems(items);
  return groups
    .map(
      ([g, list]) =>
        `<div class="group-title">${esc(g)}</div>${list.map(lineFn).join("")}`,
    )
    .join("");
}

async function qrBlock(o: PrintableOrder): Promise<string> {
  const payload = o.tracking_url
    ? o.tracking_url
    : JSON.stringify({ order: o.order_number, id: o.order_id ?? null });
  try {
    const dataUrl = await QRCode.toDataURL(payload, {
      errorCorrectionLevel: "M",
      margin: 1,
      scale: 4,
      color: { dark: "#000000", light: "#ffffff" },
    });
    return `<div class="qr">
      <img src="${dataUrl}" alt="QR pedido"/>
      <div class="b">#${o.order_number ?? ""}</div>
      ${o.tracking_url ? `<div style="font-size:0.85em">Acompanhe seu pedido</div>` : ""}
    </div>`;
  } catch {
    return "";
  }
}

export async function renderKitchenReceipt(o: PrintableOrder, paper: PaperSize): Promise<string> {
  const qr = await qrBlock(o);
  return `<!doctype html><html><head><meta charset="utf-8"><title>Comanda #${o.order_number ?? ""}</title>
    <style>${baseCss(paper)}</style></head><body>
    <h2 class="u">-- Comanda Cozinha --</h2>
    ${headerBlock(o)}
    <hr class="thick"/>
    ${groupedBlock(o.items, itemLineKitchen)}
    <hr class="sep"/>
    ${o.notes ? `<div class="obs">OBS GERAL: ${esc(o.notes)}</div><hr class="sep"/>` : ""}
    <div class="center b u">${o.items.reduce((s, i) => s + Number(i.qty), 0)} item(ns)</div>
    ${qr}
    <div style="height:24px"></div>
  </body></html>`;
}

export async function renderCustomerReceipt(o: PrintableOrder, paper: PaperSize): Promise<string> {
  const subtotal = o.items.reduce((s, i) => s + Number(i.price) * Number(i.qty), 0);
  const fee = Number(o.delivery_fee ?? 0);
  const disc = Number(o.coupon_discount ?? 0);
  const changeLine =
    o.change_for && /dinheiro|cash|especie/i.test(o.payment_method ?? "")
      ? `<div class="row"><span>Troco para</span><span>${brl(Number(o.change_for))}</span></div>
         <div class="row"><span>Troco</span><span>${brl(Math.max(0, Number(o.change_for) - o.total))}</span></div>`
      : "";
  const qr = await qrBlock(o);
  return `<!doctype html><html><head><meta charset="utf-8"><title>Pedido #${o.order_number ?? ""}</title>
    <style>${baseCss(paper)}</style></head><body>
    <h2 class="u">-- Cupom do Pedido --</h2>
    ${headerBlock(o)}
    ${o.customer_phone ? `<div><span class="b">Tel:</span> ${esc(o.customer_phone)}</div>` : ""}
    ${o.address ? `<div><span class="b">End:</span> ${esc(o.address)}</div>` : ""}
    ${o.address_complement ? `<div><span class="b">Compl:</span> ${esc(o.address_complement)}</div>` : ""}
    ${o.address_neighborhood ? `<div><span class="b">Bairro:</span> ${esc(o.address_neighborhood)}</div>` : ""}
    <hr class="sep"/>
    ${groupedBlock(o.items, itemLineCustomer)}
    <hr class="sep"/>
    <div class="row"><span>Subtotal</span><span>${brl(subtotal)}</span></div>
    ${fee ? `<div class="row"><span>Taxa de entrega</span><span>${brl(fee)}</span></div>` : ""}
    ${disc ? `<div class="row"><span>Cupom ${o.coupon_code ? esc(o.coupon_code) : ""}</span><span>- ${brl(disc)}</span></div>` : ""}
    <hr class="thick"/>
    <div class="row total"><span>TOTAL</span><span>${brl(o.total)}</span></div>
    <div class="row"><span>Pagamento</span><span class="b">${esc(paymentMethodLabel(o.payment_method))}</span></div>
    ${changeLine}
    <hr class="sep"/>
    ${o.notes ? `<div class="b">Obs: ${esc(o.notes)}</div><hr class="sep"/>` : ""}
    ${qr}
    <div class="center mt">Obrigado pela preferência!</div>
    <div style="height:24px"></div>
  </body></html>`;
}

export async function renderReceiptHtml(
  order: PrintableOrder,
  opts: { template: PrintTemplate; paper?: PaperSize } = { template: "customer" },
): Promise<string> {
  const paper = opts.paper ?? getPaperSize();
  return opts.template === "kitchen"
    ? renderKitchenReceipt(order, paper)
    : renderCustomerReceipt(order, paper);
}

/* ------------------------------ API ----------------------------------- */

export type PrintOptions = {
  template?: PrintTemplate;
  paper?: PaperSize;
  adapterKey?: string;
};

export async function printOrder(order: PrintableOrder, opts: PrintOptions = {}) {
  const adapter = getPrinterAdapter(opts.adapterKey ?? getPreferredAdapterKey() ?? undefined);
  if (!adapter) return;
  const available = await Promise.resolve(adapter.isAvailable());
  if (!available) return;
  const html = await renderReceiptHtml(order, {
    template: opts.template ?? "customer",
    paper: opts.paper ?? getPaperSize(),
  });
  await adapter.print(html);
}

/**
 * Imprime automaticamente todas as vias configuradas em
 * `getAutoCopies()`. Cada via é enviada sequencialmente com um pequeno
 * intervalo para não empilhar diálogos de impressão.
 */
export async function printAutoCopies(order: PrintableOrder) {
  const copies = getAutoCopies();
  const paper = getPaperSize();
  const jobs: PrintTemplate[] = [];
  if (copies.kitchen) jobs.push("kitchen");
  if (copies.delivery) jobs.push("customer");
  if (copies.customer) jobs.push("customer");
  for (const t of jobs) {
    // eslint-disable-next-line no-await-in-loop
    await printOrder(order, { template: t, paper });
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 400));
  }
}
