import type { ABTestConfig } from "./types";
import { bucketOf } from "@/lib/platform-config/rollout";

export const ABTestingEngine = {
  /** Deterministic variant assignment per customer using hash-based buckets. */
  assign(config: ABTestConfig, customerId: string): { key: string; template_id?: string } {
    const variants = config.variants.filter((v) => v.weight > 0);
    if (variants.length === 0) throw new Error("A/B test requires at least one variant with weight > 0");
    const total = variants.reduce((s, v) => s + v.weight, 0);
    const bucket = bucketOf(`${customerId}`) / 100;
    let acc = 0;
    for (const v of variants) {
      acc += v.weight / total;
      if (bucket < acc) return { key: v.key, template_id: v.template_id };
    }
    const last = variants[variants.length - 1];
    return { key: last.key, template_id: last.template_id };
  },

  distribute(config: ABTestConfig, customerIds: string[]): Record<string, string[]> {
    const groups: Record<string, string[]> = {};
    for (const v of config.variants) groups[v.key] = [];
    for (const cid of customerIds) {
      const v = ABTestingEngine.assign(config, cid);
      (groups[v.key] ??= []).push(cid);
    }
    return groups;
  },
} as const;
