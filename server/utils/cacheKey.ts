// Helpers for day-based cache keys.
// The whole point: within one trading day repeated requests hit the persistent
// cache (no Yahoo call); when the WIB date rolls over the key changes, so the
// next request naturally fetches fresh data.

/** Current date in Asia/Jakarta (WIB) as YYYY-MM-DD. */
export function tradingDay(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

/** Short stable hash (djb2 → base36) to keep cache keys short. */
export function shortHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
