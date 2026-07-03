// Registro padrão de regras iniciais.
import { BusinessRuleRegistry, globalRuleRegistry } from "../BusinessRuleRegistry";
import * as O from "./order-rules";
import * as P from "./payment-rules";
import * as C from "./coupon-rules";
import * as L from "./cashback-rules";
import * as D from "./delivery-rules";
import * as R from "./restaurant-rules";
import * as U from "./customer-rules";

export const DEFAULT_RULES = [
  O.RULE_RESTAURANT_ACTIVE,
  O.RULE_RESTAURANT_OPEN,
  O.RULE_MIN_ORDER,
  O.RULE_CUSTOMER_NOT_BLOCKED,
  O.RULE_DUPLICATE_ORDER,
  O.RULE_PAYMENT_MAX_WAIT,
  P.RULE_MP_CONNECTED,
  P.RULE_PAYMENT_NOT_REJECTED,
  P.RULE_PAYMENT_APPROVED,
  C.RULE_COUPON_ACTIVE,
  C.RULE_COUPON_EXPIRED,
  C.RULE_COUPON_MAX_USES,
  C.RULE_COUPON_MIN_ORDER,
  C.RULE_COUPON_FIRST_PURCHASE,
  C.RULE_COUPON_CATEGORY,
  L.RULE_CASHBACK_ELIGIBLE,
  L.RULE_CASHBACK_MAX,
  L.RULE_CASHBACK_VALID,
  L.RULE_CASHBACK_STACKABLE,
  D.RULE_DELIVERY_AVAILABLE,
  D.RULE_DELIVERY_AREA,
  D.RULE_DELIVERY_DISTANCE,
  R.RULE_RESTAURANT_CAPACITY,
  U.RULE_CUSTOMER_ACTIVE,
  U.RULE_CUSTOMER_PHONE_CONFIRMED,
  U.RULE_CUSTOMER_EMAIL_CONFIRMED,
  U.RULE_CUSTOMER_DAILY_LIMIT,
];

export function registerDefaultRules(registry: BusinessRuleRegistry = globalRuleRegistry) {
  for (const r of DEFAULT_RULES) {
    if (!registry.get(r.id)) registry.register(r);
  }
}

export * from "./order-rules";
export * from "./payment-rules";
export * from "./coupon-rules";
export * from "./cashback-rules";
export * from "./delivery-rules";
export * from "./restaurant-rules";
export * from "./customer-rules";
