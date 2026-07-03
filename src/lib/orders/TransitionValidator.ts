// Valida transições de estado de um pedido de forma pura (sem I/O).
import { canTransition, isTerminal, type OrderState } from "./OrderStateMachine";
import { canActorPerform, type OrderActorType } from "./OrderPermissions";

export interface TransitionRequest {
  from: OrderState;
  to: OrderState;
  actorType: OrderActorType;
}

export interface ValidationResult {
  ok: boolean;
  reason?: string;
}

export const TransitionValidator = {
  validate(req: TransitionRequest): ValidationResult {
    if (req.from === req.to) {
      return { ok: false, reason: "SAME_STATE" };
    }
    if (isTerminal(req.from) && !canTransition(req.from, req.to)) {
      return { ok: false, reason: "TERMINAL_STATE" };
    }
    if (!canTransition(req.from, req.to)) {
      return { ok: false, reason: "INVALID_TRANSITION" };
    }
    if (!canActorPerform(req.actorType, req.to)) {
      return { ok: false, reason: "FORBIDDEN_ACTOR" };
    }
    return { ok: true };
  },
};
