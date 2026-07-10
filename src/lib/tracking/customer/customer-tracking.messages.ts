// CustomerTrackingMessageService — mensagens humanizadas por etapa.

import type { CustomerTrackingStep } from "./customer-tracking.types";

export interface MessageContext {
  driver_name?: string | null;
}

export const CustomerTrackingMessageService = {
  stepFrom(orderStatus: string, trackingStatus: string | null): CustomerTrackingStep {
    if (orderStatus === "cancelado") return "cancelado";
    if (orderStatus === "entregue") return "entregue";
    if (trackingStatus === "PROXIMO_AO_DESTINO") return "proximo_do_destino";
    if (orderStatus === "saiu_para_entrega" || trackingStatus === "EM_ROTA" || trackingStatus === "COLETANDO") {
      return "saiu_para_entrega";
    }
    if (orderStatus === "pronto") return "pronto";
    if (orderStatus === "em_preparo") return "em_preparo";
    return "pedido_recebido";
  },

  messageFor(step: CustomerTrackingStep, ctx: MessageContext = {}): string {
    const name = ctx.driver_name?.trim() || "O entregador";
    switch (step) {
      case "pedido_recebido":
        return "Pedido recebido. Sua cozinha já vai começar a preparar seu pedido.";
      case "em_preparo":
        return "Pedido em preparo. Estamos preparando tudo com cuidado.";
      case "pronto":
        return "Pedido pronto. Seu pedido está aguardando retirada.";
      case "saiu_para_entrega":
        return `Saiu para entrega. ${name} saiu para levar seu pedido.`;
      case "proximo_do_destino":
        return "Seu pedido está chegando.";
      case "entregue":
        return "Entregue. Bom apetite! Obrigado por escolher nosso restaurante.";
      case "cancelado":
        return "Este pedido foi cancelado.";
    }
  },

  etaLabel(minMinutes: number | null, maxMinutes: number | null): string | null {
    if (minMinutes == null || maxMinutes == null) return null;
    const lo = Math.max(1, Math.round(minMinutes));
    const hi = Math.max(lo + 1, Math.round(maxMinutes));
    return `Chega entre ${lo} e ${hi} minutos.`;
  },

  freshnessLabel(updatedAt: string | null, nowMs: number = Date.now()): string {
    if (!updatedAt) return "";
    const t = new Date(updatedAt).getTime();
    if (!Number.isFinite(t)) return "";
    const diff = Math.max(0, Math.floor((nowMs - t) / 1000));
    if (diff < 5) return "Atualizado agora";
    if (diff < 60) return `Atualizado há ${diff} segundos`;
    const min = Math.floor(diff / 60);
    if (min === 1) return "Atualizado há 1 minuto";
    if (min < 60) return `Atualizado há ${min} minutos`;
    const h = Math.floor(min / 60);
    return h === 1 ? "Atualizado há 1 hora" : `Atualizado há ${h} horas`;
  },

  offlineMessage(): string {
    return "Estamos atualizando as informações da sua entrega.";
  },
};
