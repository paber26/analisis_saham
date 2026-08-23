// Deterministic synthetic market data for tests — no network, no randomness leaks.
import type { DailyBar } from '../server/utils/yahoo';

/** mulberry32 seeded PRNG — reproducible across runs/machines. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** n consecutive business days (skips weekends), starting Mon 2022-01-03. */
export function dates(n: number): string[] {
  const out: string[] = [];
  const d = new Date('2022-01-03T00:00:00Z');
  while (out.length < n) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export interface BarsOpts {
  volume?: number;
  /** intraday spread as fraction of close (default 1%). */
  spreadPct?: number;
  seed?: number;
  /** explicit date list (must match closes length) — for aligning multiple series. */
  dateList?: string[];
}

/** Build OHLCV bars around a close series. */
export function bars(closes: number[], opts: BarsOpts = {}): DailyBar[] {
  const spread = opts.spreadPct ?? 0.01;
  const r = rng(opts.seed ?? 42);
  const ds = opts.dateList ?? dates(closes.length);
  if (ds.length < closes.length) throw new Error('dateList shorter than closes');
  return closes.map((c, i) => {
    const hi = c * (1 + spread * (0.5 + r()));
    const lo = c * (1 - spread * (0.5 + r()));
    return {
      date: ds[i]!,
      open: lo + (hi - lo) * r(),
      high: hi,
      low: lo,
      close: c,
      volume: opts.volume ?? 1_000_000
    };
  });
}

export function geometric(start: number, dailyPct: number, n: number): number[] {
  const out: number[] = [];
  let v = start;
  for (let i = 0; i < n; i++) {
    out.push(v);
    v *= 1 + dailyPct;
  }
  return out;
}

/** Random-walk around `start` with per-day sigma (deterministic via seed). */
export function randomWalk(start: number, sigmaDaily: number, n: number, seed = 7): number[] {
  const r = rng(seed);
  const out: number[] = [];
  let v = start;
  // Box-Muller for normal draws
  for (let i = 0; i < n; i++) {
    out.push(v);
    const u1 = Math.max(r(), 1e-9);
    const u2 = r();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    v *= Math.exp(sigmaDaily * z);
  }
  return out;
}

/** Series whose log-returns are `mult` × the log-returns of `base`. */
export function scaledReturns(base: number[], mult: number): number[] {
  const out = [base[0]!];
  for (let i = 1; i < base.length; i++) {
    out.push(out[i - 1]! * Math.pow(base[i]! / base[i - 1]!, mult));
  }
  return out;
}
