import type { KillSwitchDomain, KillSwitchState } from "./types";

// Kill switches são flags "duras": quando ativas, o domínio alvo deve
// bloquear operações imediatamente. Um consumer (Payment, Delivery, ...)
// consulta `isActive(domain)` antes de operar.

export interface KillSwitchRepository {
  get(domain: string): KillSwitchState | undefined;
  list(): KillSwitchState[];
  save(state: KillSwitchState): void;
}

export class InMemoryKillSwitchRepository implements KillSwitchRepository {
  private map = new Map<string, KillSwitchState>();
  get(d: string) { return this.map.get(d); }
  list() { return [...this.map.values()]; }
  save(s: KillSwitchState) { this.map.set(s.domain, s); }
}

export const KILL_SWITCH_DOMAINS: KillSwitchDomain[] = [
  "payments", "delivery", "promotions", "marketplace", "ai", "analytics", "notifications",
];

export class KillSwitchService {
  constructor(private readonly repo: KillSwitchRepository = new InMemoryKillSwitchRepository()) {}

  list(): KillSwitchState[] { return this.repo.list(); }
  isActive(domain: string): boolean { return Boolean(this.repo.get(domain)?.active); }

  activate(domain: string, actorId: string, reason?: string): KillSwitchState {
    const state: KillSwitchState = {
      domain, active: true,
      activated_at: new Date().toISOString(), activated_by: actorId,
      reason: reason ?? null,
    };
    this.repo.save(state);
    return state;
  }

  deactivate(domain: string, actorId: string): KillSwitchState {
    const state: KillSwitchState = {
      domain, active: false,
      activated_at: null, activated_by: actorId, reason: null,
    };
    this.repo.save(state);
    return state;
  }

  assertOperational(domain: string): void {
    if (this.isActive(domain)) throw new Error(`Kill switch active for domain: ${domain}`);
  }
}
