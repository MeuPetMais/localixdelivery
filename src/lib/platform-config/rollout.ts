// Bucketing determinístico p/ rollout gradual.
// Hash 32-bit (FNV-1a) módulo 100 — estável entre chamadas com a mesma chave.

export function bucketOf(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash % 100;
}

/** true quando `key` cai dentro do percentual solicitado. */
export function isWithinRollout(key: string, percent: number): boolean {
  if (percent <= 0) return false;
  if (percent >= 100) return true;
  return bucketOf(key) < Math.floor(percent);
}
