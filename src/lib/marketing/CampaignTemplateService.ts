import type { CampaignTemplate, CampaignType } from "./types";
import type { CommunicationChannel } from "@/lib/customer/communication/types";

const BUILTIN: CampaignTemplate[] = [
  { id: "tpl_welcome", name: "Boas-vindas", type: "FIRST_PURCHASE", channels: ["PUSH", "EMAIL"], body: "Bem-vindo! Aproveite {{coupon}}", metadata: {} },
  { id: "tpl_vip", name: "VIP", type: "VIP", channels: ["EMAIL", "WHATSAPP"], body: "Cliente VIP, cashback exclusivo!", metadata: {} },
  { id: "tpl_inactive", name: "Reativação", type: "INACTIVE", channels: ["PUSH", "EMAIL"], body: "Sentimos sua falta! {{coupon}}", metadata: {} },
  { id: "tpl_birthday", name: "Aniversário", type: "BIRTHDAY", channels: ["PUSH", "WHATSAPP"], body: "Parabéns! Presente especial.", metadata: {} },
  { id: "tpl_cashback", name: "Cashback disponível", type: "CASHBACK", channels: ["PUSH"], body: "Você tem {{cashback}} de cashback.", metadata: {} },
  { id: "tpl_coupon", name: "Cupom disponível", type: "COUPON", channels: ["PUSH", "EMAIL"], body: "Use {{coupon}} agora.", metadata: {} },
  { id: "tpl_repurchase", name: "Recompra", type: "REPURCHASE", channels: ["PUSH"], body: "Peça de novo o que você ama.", metadata: {} },
];

const store = new Map<string, CampaignTemplate>();
let seq = 0;

export const CampaignTemplateService = {
  builtins(): CampaignTemplate[] { return [...BUILTIN]; },
  register(input: Omit<CampaignTemplate, "id">): CampaignTemplate {
    const t: CampaignTemplate = { ...input, id: `tpl_${++seq}` };
    store.set(t.id, t);
    return t;
  },
  get(id: string): CampaignTemplate | null {
    return store.get(id) ?? BUILTIN.find((t) => t.id === id) ?? null;
  },
  listByType(type: CampaignType): CampaignTemplate[] {
    return [...BUILTIN, ...store.values()].filter((t) => t.type === type);
  },
  listByChannel(channel: CommunicationChannel): CampaignTemplate[] {
    return [...BUILTIN, ...store.values()].filter((t) => t.channels.includes(channel));
  },
  clear(): void { store.clear(); seq = 0; },
} as const;
