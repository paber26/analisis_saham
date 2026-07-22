// Event study — "what happens N days after signal X?"
//
// For a price-based signal, scan every stock in the universe across all history,
// find each day the signal *fires* (a transition, using only data ≤ that day),
// then measure the forward return at several horizons. Compare against the
// unconditional baseline (forward return from ALL eligible days) so any edge is
// shown honestly. No look-ahead: detection uses past bars; returns are future.

import type { DailyBar } from './yahoo';

export const EVENT_SIGNALS = ['golden', 'ma200', 'rsi30', 'breakout'] as const;
export type EventSignal = (typeof EVENT_SIGNALS)[number];

export const SIGNAL_LABELS: Record<EventSignal, string> = {
  golden: 'Golden Cross (MA50 tembus atas MA200)',
  ma200: 'Reclaim MA200 (harga tembus atas MA200)',
  rsi30: 'RSI keluar oversold (tembus atas 30)',
  breakout: 'Breakout high 20 hari',
};

export interface HorizonStat {
  h: number;
  n: number;
  avgPct: number;
  medianPct: number;
  winRatePct: number;
  baselineAvgPct: number;
  edgePct: number; // avg − baseline
}

export interface EventStudyResult {
  signal: EventSignal;
  label: string;
  events: number;
  universeSize: number;
  horizons: HorizonStat[];
}

const HORIZONS = [5, 10, 20, 60];

function sma(closes: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  let sum = 0;
  for (let i = 0; i < closes.length; i++) {
    sum += closes[i]!;
    if (i >= period) sum -= closes[i - period]!;
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

// Wilder's RSI (14 by default).
function rsi(closes: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const ch = closes[i]! - closes[i - 1]!;
    if (ch >= 0) gain += ch; else loss -= ch;
  }
  let avgG = gain / period;
  let avgL = loss / period;
  out[period] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  for (let i = period + 1; i < closes.length; i++) {
    const ch = closes[i]! - closes[i - 1]!;
    const g = ch > 0 ? ch : 0;
    const l = ch < 0 ? -ch : 0;
    avgG = (avgG * (period - 1) + g) / period;
    avgL = (avgL * (period - 1) + l) / period;
    out[i] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  }
  return out;
}

// Highest high over the `period` bars BEFORE i (exclusive of i).
function priorHigh(highs: number[], i: number, period: number): number {
  let m = -Infinity;
  for (let k = Math.max(0, i - period); k < i; k++) m = Math.max(m, highs[k]!);
  return m;
}

const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);
function median(v: number[]): number {
  if (!v.length) return 0;
  const s = [...v].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}
const r2 = (n: number) => Math.round(n * 100) / 100;

// Returns the indices where the signal fires for one stock (using data ≤ i).
function detectEvents(signal: EventSignal, bars: DailyBar[]): number[] {
  const closes = bars.map((b) => b.close);
  const highs = bars.map((b) => b.high ?? b.close);
  const out: number[] = [];

  if (signal === 'golden' || signal === 'ma200') {
    const s50 = sma(closes, 50);
    const s200 = sma(closes, 200);
    for (let i = 1; i < bars.length; i++) {
      if (signal === 'golden') {
        if (s50[i] != null && s200[i] != null && s50[i - 1] != null && s200[i - 1] != null) {
          if (s50[i - 1]! <= s200[i - 1]! && s50[i]! > s200[i]!) out.push(i);
        }
      } else {
        if (s200[i] != null && s200[i - 1] != null) {
          if (closes[i - 1]! <= s200[i - 1]! && closes[i]! > s200[i]!) out.push(i);
        }
      }
    }
  } else if (signal === 'rsi30') {
    const r = rsi(closes, 14);
    for (let i = 1; i < bars.length; i++) {
      if (r[i] != null && r[i - 1] != null && r[i - 1]! <= 30 && r[i]! > 30) out.push(i);
    }
  } else if (signal === 'breakout') {
    for (let i = 21; i < bars.length; i++) {
      const ph = priorHigh(highs, i, 20);
      if (isFinite(ph) && closes[i - 1]! <= ph && closes[i]! > ph) out.push(i);
    }
  }
  return out;
}

export function runEventStudy(barsBySymbol: Map<string, DailyBar[]>, signal: EventSignal): EventStudyResult | null {
  const maxH = Math.max(...HORIZONS);
  const eventRets: Record<number, number[]> = {};
  const baseRets: Record<number, number[]> = {};
  for (const h of HORIZONS) { eventRets[h] = []; baseRets[h] = []; }

  let events = 0;
  let universeSize = 0;

  for (const [, bars] of barsBySymbol) {
    if (bars.length < 260) continue;
    universeSize++;
    const closes = bars.map((b) => b.close);

    // Baseline: unconditional forward returns from every eligible day (warm-up
    // 200 so it's comparable to MA-based signals; leave room for maxH ahead).
    for (let i = 200; i < bars.length - maxH; i++) {
      for (const h of HORIZONS) baseRets[h]!.push(closes[i + h]! / closes[i]! - 1);
    }

    // Event forward returns
    for (const i of detectEvents(signal, bars)) {
      if (i + maxH >= bars.length) continue;
      events++;
      for (const h of HORIZONS) eventRets[h]!.push(closes[i + h]! / closes[i]! - 1);
    }
  }

  if (universeSize === 0) return null;

  const horizons: HorizonStat[] = HORIZONS.map((h) => {
    const ev = eventRets[h]!;
    const base = baseRets[h]!;
    const avg = mean(ev) * 100;
    const baseAvg = mean(base) * 100;
    return {
      h,
      n: ev.length,
      avgPct: r2(avg),
      medianPct: r2(median(ev) * 100),
      winRatePct: r2(ev.length ? (ev.filter((x) => x > 0).length / ev.length) * 100 : 0),
      baselineAvgPct: r2(baseAvg),
      edgePct: r2(avg - baseAvg),
    };
  });

  return { signal, label: SIGNAL_LABELS[signal], events, universeSize, horizons };
}
