import type { LoyaltyLevel, LoyaltyLevelName } from "./types";

/**
 * LevelResolver — pure. Picks the highest level the customer qualifies for
 * based on their lifetime points balance.
 */
export const LevelResolver = {
  resolve(lifetimePoints: number, levels: LoyaltyLevel[]): LoyaltyLevelName {
    const active = levels.filter((l) => l.active).sort((a, b) => b.minimum_points - a.minimum_points);
    for (const lvl of active) {
      if (lifetimePoints >= lvl.minimum_points) return lvl.name;
    }
    return active.at(-1)?.name ?? "BRONZE";
  },

  didLevelUp(previousLifetime: number, nextLifetime: number, levels: LoyaltyLevel[]): boolean {
    return LevelResolver.resolve(previousLifetime, levels) !== LevelResolver.resolve(nextLifetime, levels);
  },
} as const;
