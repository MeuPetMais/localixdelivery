import { toJson } from "@/lib/json";
import type { Promotion } from "./types";
/** Relations have their own mutation operations and are not columns of promotions. */
export function promotionColumnPatch(input: Partial<Promotion>) {
  const { rules, targets, config, ...patch } = input;
  if (rules !== undefined || targets !== undefined)
    throw new Error("Update promotion rules and targets through their dedicated operations");
  return { ...patch, ...(config === undefined ? {} : { config: toJson(config) }) };
}
