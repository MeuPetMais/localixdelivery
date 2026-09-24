import type { Customer360Lifecycle, Customer360ReadModel } from "@/lib/customer360";
import type { Customer360Insight } from "@/lib/customer360-intelligence";

export type GrowthCampaignChannel = "EMAIL" | "SMS" | "WHATSAPP" | "PUSH" | "IN_APP";
export type GrowthCampaignTrigger =
  | "SECOND_PURCHASE"
  | "AT_RISK"
  | "INACTIVE"
  | "REACTIVATED"
  | "RECURRENCE";

export type GrowthCampaignJobStatus =
  | "BLOCKED_CONSENT"
  | "BLOCKED_PROVIDER"
  | "BLOCKED_FREQUENCY"
  | "READY";

export type GrowthMarketingConsent = {
  id: string;
  channel: GrowthCampaignChannel;
  granted: boolean;
  captured_at: string;
  revoked_at: string | null;
};

export type RecentAutomationJob = {
  trigger_type: GrowthCampaignTrigger;
  channel: GrowthCampaignChannel;
  created_at: string;
  status: string;
};

export type GrowthCampaignAutomationPlan = {
  trigger_type: GrowthCampaignTrigger;
  channel: GrowthCampaignChannel;
  action_key: string;
  source_ref: string;
  status: GrowthCampaignJobStatus;
  reason: string;
  consent_id: string | null;
};

export const GROWTH_CAMPAIGN_AUTOMATION_DEFAULTS = {
  cooldownDays: 7,
} as const;

function triggerForLifecycle(lifecycle: Customer360Lifecycle): GrowthCampaignTrigger | null {
  switch (lifecycle) {
    case "AWAITING_SECOND_PURCHASE": return "SECOND_PURCHASE";
    case "AT_RISK": return "AT_RISK";
    case "INACTIVE": return "INACTIVE";
    case "REACTIVATED": return "REACTIVATED";
    case "RECURRING": return "RECURRENCE";
    default: return null;
  }
}

function actionForTrigger(trigger: GrowthCampaignTrigger): string {
  switch (trigger) {
    case "SECOND_PURCHASE": return "ENCOURAGE_SECOND_PURCHASE";
    case "AT_RISK":
    case "INACTIVE": return "REACTIVATE_CUSTOMER";
    case "REACTIVATED":
    case "RECURRENCE": return "MAINTAIN_RECURRENCE";
  }
}

export function planGrowthCampaignAutomation(input: {
  customer360: Customer360ReadModel;
  insights: Customer360Insight[];
  channel: GrowthCampaignChannel;
  latestConsent: GrowthMarketingConsent | null;
  providerAvailable: boolean;
  recentJobs: RecentAutomationJob[];
  now?: Date;
  cooldownDays?: number;
}): GrowthCampaignAutomationPlan | null {
  const trigger = triggerForLifecycle(input.customer360.lifecycle);
  if (!trigger) return null;

  const actionKey = actionForTrigger(trigger);
  const matchingInsight = input.insights.find((i) => i.recommended_action === actionKey);
  const sourceRef = matchingInsight?.type ?? input.customer360.lifecycle;

  if (
    !input.latestConsent ||
    input.latestConsent.channel !== input.channel ||
    !input.latestConsent.granted ||
    input.latestConsent.revoked_at
  ) {
    return {
      trigger_type: trigger,
      channel: input.channel,
      action_key: actionKey,
      source_ref: sourceRef,
      status: "BLOCKED_CONSENT",
      reason: "Sem consentimento explícito e vigente para este canal.",
      consent_id: input.latestConsent?.id ?? null,
    };
  }

  if (!input.providerAvailable) {
    return {
      trigger_type: trigger,
      channel: input.channel,
      action_key: actionKey,
      source_ref: sourceRef,
      status: "BLOCKED_PROVIDER",
      reason: "Nenhum provider de envio foi comprovado como disponível para este canal.",
      consent_id: input.latestConsent.id,
    };
  }

  const now = input.now ?? new Date();
  const cooldownDays = input.cooldownDays ?? GROWTH_CAMPAIGN_AUTOMATION_DEFAULTS.cooldownDays;
  const cutoff = now.getTime() - cooldownDays * 86_400_000;
  const duplicateRecent = input.recentJobs.some(
    (job) =>
      job.trigger_type === trigger &&
      job.channel === input.channel &&
      new Date(job.created_at).getTime() >= cutoff &&
      !["FAILED", "CANCELLED"].includes(job.status),
  );

  if (duplicateRecent) {
    return {
      trigger_type: trigger,
      channel: input.channel,
      action_key: actionKey,
      source_ref: sourceRef,
      status: "BLOCKED_FREQUENCY",
      reason: `Já existe automação equivalente dentro da janela de ${cooldownDays} dias.`,
      consent_id: input.latestConsent.id,
    };
  }

  return {
    trigger_type: trigger,
    channel: input.channel,
    action_key: actionKey,
    source_ref: sourceRef,
    status: "READY",
    reason: "Elegível para fila; envio continua dependente de sender separado e idempotente.",
    consent_id: input.latestConsent.id,
  };
}
