// IDX trading rules that decide whether a backtest trade could really be done,
// and at what cost. Pure functions; prices are in rupiah.

import type { DailyBar } from './yahoo';

/** Minimum price increment (fraksi harga). */
export function tickSize(price: number): number {
  if (price < 200) return 1;
  if (price < 500) return 2;
  if (price < 2000) return 5;
  if (price < 5000) return 10;
  return 25;
}

/** Upper auto-reject (ARA) as a fraction of the previous close. */
export function araPct(prevClose: number): number {
  return prevClose <= 200 ? 0.35 : prevClose <= 5000 ? 0.25 : 0.2;
}

/**
 * Lower auto-reject (ARB) regimes announced by BEI. `null` = symmetric with
 * ARA. Lock detection below also requires a no-range session, so a regime
 * that is slightly off still flags real limit-down locks.
 */
const ARB_REGIMES: { from: string; pct: number | null }[] = [
  { from: '2020-03-10', pct: 0.07 }, // pandemi: ARB 7%
  { from: '2023-06-05', pct: 0.15 }, // normalisasi tahap I
  { from: '2023-09-04', pct: null }, // tahap II: simetris
  { from: '2025-04-08', pct: 0.15 }  // gejolak April 2025: ARB 15% (perbarui bila BEI kembali simetris)
];

/** Lower auto-reject (ARB) as a fraction of the previous close, on `date` (YYYY-MM-DD). */
export function arbPct(prevClose: number, date: string): number {
  let pct: number | null = null;
  for (const r of ARB_REGIMES) if (date >= r.from) pct = r.pct;
  return pct ?? araPct(prevClose);
}

/** Half the minimum tick, as a fraction of price: the least spread a trade crosses. */
export function halfSpread(price: number): number {
  return price > 0 ? tickSize(price) / price / 2 : 0;
}

/**
 * A buy at this session's open (or close) would not fill: the price sat at the
 * upper auto-reject limit, where only buyers queue.
 */
export function buyBlocked(bar: DailyBar, prevClose: number, atOpen: boolean): boolean {
  if (!(prevClose > 0)) return false;
  const limit = prevClose * (1 + araPct(prevClose)) - tickSize(prevClose);
  return atOpen ? bar.open >= limit : bar.close >= limit && bar.high - bar.close <= tickSize(prevClose);
}

/**
 * Locked at the lower auto-reject limit the whole session (no range): only
 * sellers queue, so a sell would not fill that day.
 */
export function sellBlocked(bar: DailyBar, prevClose: number): boolean {
  if (!(prevClose > 0)) return false;
  const t = tickSize(prevClose);
  return bar.high - bar.low <= t && bar.close <= prevClose * (1 - arbPct(prevClose, bar.date)) + t;
}
