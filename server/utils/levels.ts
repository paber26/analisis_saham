// Price-level analysis: classic pivot points, swing-based support/resistance
// (clustered by ATR), Fibonacci retracement of the 52-week range, and an
// ATR-based trade plan (2×ATR stop / 3×ATR target — common professional rule).

import type { DailyBar } from './yahoo';

export interface LevelCluster { price: number; touches: number }

export interface TradePlan {
  entry: number;
  stop: number;
  target: number;
  rr: number;
  regime: 'breakout' | 'pullback' | 'range';
  stopPct: number;   // % drop from entry to stop
  targetPct: number; // % gain from entry to target
}

export interface Levels {
  pivot: { p: number; r1: number; r2: number; s1: number; s2: number };
  supports: LevelCluster[];     // nearest below price, strongest-first ordering by proximity
  resistances: LevelCluster[];  // nearest above price
  fib: { low52: number; high52: number; l382: number; l500: number; l618: number };
  atr: number;
  atrPct: number;
  plan: TradePlan;
}

const roundPrice = (v: number) => (v >= 100 ? Math.round(v) : Math.round(v * 100) / 100);
const round2 = (n: number) => Math.round(n * 100) / 100;

function atr14(bars: DailyBar[]): number {
  const n = bars.length;
  const period = 14;
  if (n < period + 1) return 0;
  const tr: number[] = [];
  for (let i = 1; i < n; i++) {
    tr.push(Math.max(
      bars[i]!.high - bars[i]!.low,
      Math.abs(bars[i]!.high - bars[i - 1]!.close),
      Math.abs(bars[i]!.low - bars[i - 1]!.close)
    ));
  }
  let a = 0;
  for (let i = 0; i < period; i++) a += tr[i]!;
  a /= period;
  for (let i = period; i < tr.length; i++) a = (a * (period - 1) + tr[i]!) / period;
  return a;
}

/** Cluster nearby swing levels: merge levels within `tol`; count touches. */
function cluster(levels: number[], tol: number): LevelCluster[] {
  if (!levels.length) return [];
  const sorted = [...levels].sort((a, b) => a - b);
  const out: LevelCluster[] = [];
  let cur = { sum: sorted[0]!, count: 1 };
  for (let i = 1; i < sorted.length; i++) {
    const avg = cur.sum / cur.count;
    if (sorted[i]! - avg <= tol) {
      cur.sum += sorted[i]!;
      cur.count++;
    } else {
      out.push({ price: roundPrice(cur.sum / cur.count), touches: cur.count });
      cur = { sum: sorted[i]!, count: 1 };
    }
  }
  out.push({ price: roundPrice(cur.sum / cur.count), touches: cur.count });
  return out;
}

/** 20-day simple moving average at the last bar (for pullback detection). */
function sma20At(bars: DailyBar[]): number | null {
  const n = bars.length;
  if (n < 20) return null;
  let s = 0;
  for (let i = n - 20; i < n; i++) s += bars[i]!.close;
  return s / 20;
}

export function computeLevels(bars: DailyBar[]): Levels | null {
  const n = bars.length;
  if (n < 60) return null;

  const last = bars[n - 1]!;
  const price = last.close;
  const atr = atr14(bars) || price * 0.02;

  // Classic pivot points from the last session
  const p = (last.high + last.low + last.close) / 3;
  const pivot = {
    p: roundPrice(p),
    r1: roundPrice(2 * p - last.low),
    r2: roundPrice(p + (last.high - last.low)),
    s1: roundPrice(2 * p - last.high),
    s2: roundPrice(p - (last.high - last.low))
  };

  // Swing highs/lows over the last ~180 sessions (window ±3, exclude tail)
  const look = Math.min(180, n - 4);
  const w = 3;
  const swingHighs: number[] = [];
  const swingLows: number[] = [];
  for (let i = n - look; i < n - w; i++) {
    if (i - w < 0) continue;
    let isHigh = true;
    let isLow = true;
    for (let j = i - w; j <= i + w; j++) {
      if (j === i) continue;
      if (bars[j]!.high >= bars[i]!.high) isHigh = false;
      if (bars[j]!.low <= bars[i]!.low) isLow = false;
      if (!isHigh && !isLow) break;
    }
    if (isHigh) swingHighs.push(bars[i]!.high);
    if (isLow) swingLows.push(bars[i]!.low);
  }
  const tol = 0.75 * atr;
  const supports = cluster(swingLows, tol)
    .filter((c) => c.price < price * 0.999)
    .sort((a, b) => b.price - a.price)
    .slice(0, 3);
  const resistances = cluster(swingHighs, tol)
    .filter((c) => c.price > price * 1.001)
    .sort((a, b) => a.price - b.price)
    .slice(0, 3);

  // Fibonacci retracement of the 52-week range
  const win = Math.min(252, n);
  let high52 = -Infinity;
  let low52 = Infinity;
  for (let i = n - win; i < n; i++) {
    high52 = Math.max(high52, bars[i]!.high);
    low52 = Math.min(low52, bars[i]!.low);
  }
  const span = high52 - low52;
  const fib = {
    low52: roundPrice(low52),
    high52: roundPrice(high52),
    l382: roundPrice(high52 - 0.382 * span),
    l500: roundPrice(high52 - 0.5 * span),
    l618: roundPrice(high52 - 0.618 * span)
  };

  // ---- ADAPTIVE trade plan ----
  const sma20 = sma20At(bars);
  // Baseline: stop 2×ATR below, target 3×ATR above (R:R 1.5).
  const rawStop = price - 2 * atr;
  const rawTarget = price + 3 * atr;

  // Improve stop: use the strongest real support below price when it's
  // BETWEEN the raw stop and price (tighter, more mechanical stop).
  const nearestSupport = supports.find((s) => s.price > rawStop && s.price < price * 0.999);
  const stop = nearestSupport ? Math.max(nearestSupport.price, 0) : Math.max(rawStop, 0);

  // Improve target: use the nearest real resistance above price when it's
  // BELOW the raw target (realistic, closer target instead of hoping for 3×ATR).
  const nearestResistance = resistances.find((r) => r.price < rawTarget && r.price > price * 1.001);
  const target = nearestResistance ? nearestResistance.price : rawTarget;

  // Entry regime classification (informational for the UI):
  // - breakout: price near/at resistance (needs close above to trigger)
  // - pullback: price near/at support (buy the dip at a known level)
  // - range: no clear signal (mid-channel)
  const atrPct = (atr / price) * 100;
  const distToSupportAtr = nearestSupport ? (price - nearestSupport.price) / atr : 2.5;
  const distToResAtr = nearestResistance ? (nearestResistance.price - price) / atr : 2.5;
  const belowSma20 = sma20 != null && price < sma20;
  const regime: TradePlan['regime'] =
    distToResAtr <= 0.4 ? 'breakout' :
      (distToSupportAtr <= 0.75 || belowSma20) ? 'pullback' : 'range';

  // R:R — computed from the refined levels
  const riskPerShare = stop > 0 && stop < price ? price - stop : 2 * atr;
  const rewardPerShare = Math.max(target - price, 0);
  const rr = riskPerShare > 0 ? round2(rewardPerShare / riskPerShare) : 0;

  return {
    pivot,
    supports,
    resistances,
    fib,
    atr: roundPrice(atr),
    atrPct: Math.round(atrPct * 100) / 100,
    plan: {
      entry: roundPrice(price),
      stop: roundPrice(stop),
      target: roundPrice(target),
      rr,
      regime,
      stopPct: Math.round(((price - stop) / price) * 10000) / 100,
      targetPct: Math.round(((target - price) / price) * 10000) / 100
    }
  };
}
