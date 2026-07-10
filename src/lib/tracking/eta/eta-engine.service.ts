// ETA Engine Service — orquestra strategy + confidence + window + history + eventos.
// Puro (sem I/O). Persistência remota fica em eta.functions.ts.

import type {
  EtaInput, EtaResult, EtaEngineConfig, EtaConfidence, EtaAlgorithm,
} from "./eta.types";
import { DEFAULT_ETA_CONFIG } from "./eta.types";
import { DEFAULT_STRATEGY, type EtaStrategy } from "./eta-calculator";
import { evaluateEtaConfidence } from "./eta-confidence";
import { buildEtaWindow } from "./eta-window";
import { createInMemoryEtaHistoryStore, type EtaHistoryStore } from "./eta-history";
import { buildEtaEvent, emitEtaEvent } from "./eta-events";

export interface EtaEngineDeps {
  strategy?: EtaStrategy;
  history?: EtaHistoryStore;
  config?: Partial<EtaEngineConfig>;
}

interface LastState {
  eta_seconds: number;
  confidence: EtaConfidence;
  updated_at: string;
}

export function createEtaEngine(deps: EtaEngineDeps = {}) {
  const config: EtaEngineConfig = { ...DEFAULT_ETA_CONFIG, ...(deps.config ?? {}) };
  const history = deps.history ?? createInMemoryEtaHistoryStore();
  const strategy: EtaStrategy = deps.strategy ?? DEFAULT_STRATEGY;
  const lastByAssignment = new Map<string, LastState>();

  function isSignificantChange(prev: LastState | undefined, next: EtaResult): boolean {
    if (!prev) return true;
    if (prev.confidence !== next.confidence) return true;
    return Math.abs(prev.eta_seconds - next.eta_seconds) >= config.significant_change_seconds;
  }

  function compute(input: EtaInput): EtaResult {
    const nowIso = input.now ?? new Date().toISOString();
    const est = strategy.estimate(input, config);
    const conf = evaluateEtaConfidence(input, config, nowIso);
    const window = buildEtaWindow(est.eta_seconds, conf.confidence, config);
    return {
      eta_seconds: est.eta_seconds,
      eta_minutes: Math.max(1, Math.round(est.eta_seconds / 60)),
      distance_km: est.distance_km,
      window,
      confidence: conf.confidence,
      algorithm: strategy.id as EtaAlgorithm,
      reasons: [...est.reasons, ...conf.reasons],
      updated_at: nowIso,
    };
  }

  function calculate(input: EtaInput): {
    result: EtaResult;
    changed: boolean;
    previous_eta_seconds: number | null;
  } {
    const prev = lastByAssignment.get(input.assignment_id);
    const result = compute(input);
    const changed = isSignificantChange(prev, result);
    const previous_eta_seconds = prev?.eta_seconds ?? null;

    emitEtaEvent(buildEtaEvent("EtaCalculated", {
      assignment_id: input.assignment_id,
      restaurant_id: input.restaurant_id,
      order_id: input.order_id,
      driver_id: input.driver_id,
      result, previous_eta_seconds, correlation_id: input.correlation_id,
    }));

    if (changed) {
      lastByAssignment.set(input.assignment_id, {
        eta_seconds: result.eta_seconds,
        confidence: result.confidence,
        updated_at: result.updated_at,
      });
      history.append({
        assignment_id: input.assignment_id,
        restaurant_id: input.restaurant_id,
        order_id: input.order_id,
        driver_id: input.driver_id,
        predicted_eta_seconds: result.eta_seconds,
        actual_eta_seconds: null,
        difference_seconds: null,
        confidence: result.confidence,
        algorithm: result.algorithm,
        window_min_seconds: result.window.min_seconds,
        window_max_seconds: result.window.max_seconds,
        correlation_id: input.correlation_id ?? null,
        metadata: { reasons: result.reasons, distance_km: result.distance_km },
      });
      emitEtaEvent(buildEtaEvent("EtaChanged", {
        assignment_id: input.assignment_id,
        restaurant_id: input.restaurant_id,
        order_id: input.order_id,
        driver_id: input.driver_id,
        result, previous_eta_seconds, correlation_id: input.correlation_id,
      }));
    } else {
      emitEtaEvent(buildEtaEvent("EtaSkipped", {
        assignment_id: input.assignment_id,
        restaurant_id: input.restaurant_id,
        order_id: input.order_id,
        driver_id: input.driver_id,
        result, previous_eta_seconds, correlation_id: input.correlation_id,
      }));
    }

    return { result, changed, previous_eta_seconds };
  }

  function recordActual(assignmentId: string, actualSeconds: number) {
    const rows = history.list(assignmentId);
    const last = rows[rows.length - 1];
    if (!last) return null;
    last.actual_eta_seconds = actualSeconds;
    last.difference_seconds = actualSeconds - last.predicted_eta_seconds;
    return last;
  }

  return {
    calculate,
    compute,
    recordActual,
    getLast: (id: string) => lastByAssignment.get(id) ?? null,
    getHistory: (id: string) => history.list(id),
    _reset() { lastByAssignment.clear(); history.clear(); },
    config,
  };
}

export type EtaEngine = ReturnType<typeof createEtaEngine>;
export const etaEngine = createEtaEngine();
