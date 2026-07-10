// Tracking Realtime — Testes de publication/subscription/payload (RC5.3.x.2).
import { describe, it, expect, vi, beforeEach } from "vitest";

type ChangeHandler = (p: { new?: Record<string, unknown>; old?: Record<string, unknown> }) => void;
const registered: Array<{ channel: string; filter: string; table: string; handler: ChangeHandler }> = [];

vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      channel(name: string) {
        const chan = {
          _name: name,
          on(_type: string, cfg: { table: string; filter: string }, handler: ChangeHandler) {
            registered.push({ channel: name, filter: cfg.filter, table: cfg.table, handler });
            return chan;
          },
          subscribe() { return chan; },
        };
        return chan;
      },
      removeChannel: vi.fn(),
    },
  };
});

import {
  trackingChannelNames,
  subscribeRestaurantTracking,
  subscribePublicOrderTracking,
  subscribeDriverTracking,
} from "./tracking.realtime";

const snapshotRow = {
  id: "s1",
  assignment_id: "a1",
  driver_id: "d1",
  restaurant_id: "r1",
  order_id: "o1",
  status: "EM_ROTA",
  confidence: "HIGH",
  last_lat: -23.5,
  last_lng: -46.6,
  eta_seconds: 600,
  updated_at: new Date().toISOString(),
  correlation_id: "c1",
};

beforeEach(() => { registered.length = 0; });

describe("Realtime channels & filters", () => {
  it("restaurant channel usa filtro restaurant_id", () => {
    subscribeRestaurantTracking("r1", { onUpdate: () => {} });
    expect(registered[0].channel).toBe(trackingChannelNames.restaurant("r1"));
    expect(registered[0].filter).toBe("restaurant_id=eq.r1");
    expect(registered[0].table).toBe("tracking_snapshots");
  });

  it("public order channel usa filtro order_id e nome público", () => {
    subscribePublicOrderTracking("o1", { onUpdate: () => {} });
    expect(registered[0].channel).toBe("tracking-public-o1");
    expect(registered[0].filter).toBe("order_id=eq.o1");
  });

  it("driver channel usa filtro driver_id", () => {
    subscribeDriverTracking("d1", { onUpdate: () => {} });
    expect(registered[0].channel).toBe("tracking-driver-d1");
    expect(registered[0].filter).toBe("driver_id=eq.d1");
  });
});

describe("Realtime payload", () => {
  it("entrega payload público (sem lat/lng) em INSERT/UPDATE/DELETE", () => {
    const received: unknown[] = [];
    subscribeRestaurantTracking("r1", { onUpdate: (p) => received.push(p) });
    const h = registered[0].handler;
    h({ new: snapshotRow });                    // INSERT/UPDATE
    h({ old: snapshotRow });                    // DELETE
    expect(received).toHaveLength(2);
    for (const p of received as Array<Record<string, unknown>>) {
      expect(p).not.toHaveProperty("last_lat");
      expect(p).not.toHaveProperty("last_lng");
      expect(p.status).toBe("EM_ROTA");
    }
  });

  it("erros no mapper acionam onError e não quebram o canal", () => {
    const onError = vi.fn();
    subscribeRestaurantTracking("r1", { onUpdate: () => { throw new Error("boom"); }, onError });
    registered[0].handler({ new: snapshotRow });
    expect(onError).toHaveBeenCalled();
  });

  it("payload vazio é ignorado silenciosamente", () => {
    const onUpdate = vi.fn();
    subscribeRestaurantTracking("r1", { onUpdate });
    registered[0].handler({});
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
