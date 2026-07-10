// Driver Location Service — RC5.3.b.
// Responsabilidades:
//  • ingest de sample GPS
//  • anti-spoofing / confidence
//  • rate limit e deduplicação
//  • cache offline (fila local) e sync ordenado
// NUNCA muta Orders/Delivery/Wallet/Queue. Apenas observa e publica.

import {
  DEFAULT_LOCATION_CONFIG,
  type DriverLocationConfig,
  type DriverLocationConfidence,
  type DriverLocationEvaluation,
  type DriverLocationSample,
} from "./driver-location.types";
import { driverLocationBus, type DriverLocationEvent } from "./driver-location.events";

type Uploader = (samples: DriverLocationSample[]) => Promise<void>;

export interface LocationServiceDeps {
  config?: Partial<DriverLocationConfig>;
  now?: () => Date;
  uploader?: Uploader; // envio remoto (server function). Sem uploader → apenas em memória.
  isOnline?: () => boolean;
}

interface DriverState {
  last?: DriverLocationSample;
  offlineQueue: DriverLocationSample[];
  lastAcceptedAt?: number;
}

const EARTH_R = 6_371_000;
function haversineMeters(a: {lat:number;lng:number}, b: {lat:number;lng:number}): number {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(s)));
}

function cryptoRandom(): string {
  const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
  return g.crypto?.randomUUID?.() ?? (Math.random().toString(36).slice(2) + Date.now().toString(36));
}

export function createDriverLocationService(deps: LocationServiceDeps = {}) {
  const config = { ...DEFAULT_LOCATION_CONFIG, ...(deps.config ?? {}) };
  const now = deps.now ?? (() => new Date());
  const isOnline = deps.isOnline ?? (() => (typeof navigator === "undefined" ? true : navigator.onLine !== false));
  const drivers = new Map<string, DriverState>();

  function stateOf(driverId: string): DriverState {
    let s = drivers.get(driverId);
    if (!s) { s = { offlineQueue: [] }; drivers.set(driverId, s); }
    return s;
  }

  function evaluate(sample: DriverLocationSample, prev?: DriverLocationSample): DriverLocationEvaluation {
    const reasons: string[] = [];
    let spoof = 0;
    let confidence: DriverLocationConfidence = "HIGH";

    const ageSec = (now().getTime() - new Date(sample.captured_at).getTime()) / 1000;
    if (ageSec > config.stale_seconds) { reasons.push("stale_sample"); confidence = "LOW"; }

    if (sample.accuracy != null && sample.accuracy > config.min_accuracy_m) {
      reasons.push("low_accuracy"); confidence = confidence === "HIGH" ? "MEDIUM" : "LOW";
    }

    if (sample.speed != null && sample.speed > config.max_speed_ms) {
      reasons.push("speed_exceeds_max"); spoof += 40; confidence = "LOW";
    }

    let significant = true;
    if (prev) {
      const dt = Math.max(1, (new Date(sample.captured_at).getTime() - new Date(prev.captured_at).getTime()) / 1000);
      const dist = haversineMeters(prev, sample);
      const derivedSpeed = dist / dt;
      if (derivedSpeed > config.max_teleport_meters_per_sec) {
        reasons.push("teleport_detected"); spoof += 60; confidence = "LOW";
      }
      significant = dist >= config.min_move_meters;
    }

    if (spoof >= 60 && confidence !== "LOW") confidence = "LOW";
    spoof = Math.min(100, spoof);
    return { sample, confidence, reasons, spoof_score: spoof, significant_change: significant };
  }

  function publish(type: DriverLocationEvent["type"], sample: DriverLocationSample, evaluation?: DriverLocationEvaluation, reason?: string) {
    driverLocationBus.publish({
      type,
      driver_id: sample.driver_id,
      assignment_id: sample.assignment_id ?? null,
      restaurant_id: sample.restaurant_id ?? null,
      at: now().toISOString(),
      correlation_id: sample.correlation_id ?? cryptoRandom(),
      sample, evaluation, reason,
    });
  }

  async function flushOffline(driverId: string): Promise<number> {
    const s = stateOf(driverId);
    if (!s.offlineQueue.length || !deps.uploader || !isOnline()) return 0;
    const batch = s.offlineQueue.sort((a, b) => a.captured_at.localeCompare(b.captured_at));
    s.offlineQueue = [];
    try {
      await deps.uploader(batch);
      for (const sample of batch) publish("DriverLocationSynced", sample);
      return batch.length;
    } catch (err) {
      // Falha → devolver à fila preservando ordem.
      s.offlineQueue = [...batch, ...s.offlineQueue];
      console.error("[driver-location] sync failed", err);
      return 0;
    }
  }

  return {
    async ingest(sample: DriverLocationSample): Promise<DriverLocationEvaluation> {
      const s = stateOf(sample.driver_id);
      publish("DriverLocationReceived", sample);

      const evaluation = evaluate(sample, s.last);

      // Dedup: mesma posição + timestamp anterior → ignora.
      if (s.last && s.last.captured_at === sample.captured_at &&
          s.last.lat === sample.lat && s.last.lng === sample.lng) {
        publish("DriverLocationRejected", sample, evaluation, "duplicate");
        return evaluation;
      }

      // Rate limit mínimo (500ms entre aceites) para evitar spam.
      const nowMs = now().getTime();
      if (s.lastAcceptedAt && nowMs - s.lastAcceptedAt < 500) {
        publish("DriverLocationRejected", sample, evaluation, "rate_limit");
        return evaluation;
      }

      s.last = sample;
      s.lastAcceptedAt = nowMs;
      publish("DriverLocationAccepted", sample, evaluation);

      // Se offline, enfileira; senão, sobe imediato (se houver uploader).
      if (!isOnline()) {
        s.offlineQueue.push(sample);
      } else if (deps.uploader && evaluation.significant_change) {
        try { await deps.uploader([sample]); publish("DriverLocationSynced", sample); }
        catch (err) { console.error("[driver-location] upload failed", err); s.offlineQueue.push(sample); }
      }
      return evaluation;
    },
    getLast(driverId: string): DriverLocationSample | null { return stateOf(driverId).last ?? null; },
    getOfflineQueue(driverId: string): DriverLocationSample[] { return [...stateOf(driverId).offlineQueue]; },
    flushOffline,
    _reset() { drivers.clear(); },
    _config: config,
  };
}

export type DriverLocationService = ReturnType<typeof createDriverLocationService>;
export const driverLocationService = createDriverLocationService();
