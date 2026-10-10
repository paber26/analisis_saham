// Multi-factor (Quality–Value–Momentum) scoring over the screener universe.
// Pure & cross-sectional: each factor is a 0–100 percentile rank of the stock
// vs its peers in the same result set, then Value/Quality/Momentum are the mean
// of their sub-metrics and QVM is the mean of the three. Higher = better.
//
// Value & Quality are ranked WITHIN the stock's sector when the sector has at
// least MIN_SECTOR_PEERS stocks with that metric (a bank's PBV is not
// comparable to a miner's); otherwise vs the whole universe. Momentum stays
// cross-sectional on purpose — sector momentum is itself a signal.
// qvmRank skips 'tipis' (illiquid) stocks: their signals can't be executed.
//
// Derived entirely from fields already present on ScreenRow (no new fetches):
//   Value    ← PER (low), PBV (low), Dividend Yield (high), EV/EBITDA (low)
//   Quality  ← ROE (high), DER (low), Earnings Growth (high), Piotroski F-Score (high)
//   Momentum ← RS 3m vs IHSG (high), technical score (high)

import type { ScreenRow } from './store';

export interface FactorScores {
  value: number | null;
  quality: number | null;
  momentum: number | null;
  qvm: number | null;
  qvmRank: number | null; // 1 = best; null when qvm can't be computed or illiquid
  /** true when Value/Quality were ranked against sector peers (not the whole universe). */
  sectorRelative: boolean;
}

export const MIN_SECTOR_PEERS = 5;

export type ScoredRow = ScreenRow & FactorScores;

// Percentile rank (0–100) of each value among the non-null numbers.
// direction 'high' = larger is better; 'low' = smaller is better.
// Returns an array aligned to input; null stays null (excluded from the factor).
function percentile(values: (number | null)[], direction: 'high' | 'low'): (number | null)[] {
  const nums = values.filter((v): v is number => v != null && isFinite(v));
  const n = nums.length;
  if (n < 2) return values.map(() => null);
  const sorted = [...nums].sort((a, b) => a - b);
  return values.map((v) => {
    if (v == null || !isFinite(v)) return null;
    // mid-rank percentile: (# strictly less + 0.5·# equal) / n
    let less = 0;
    let equal = 0;
    for (const s of sorted) {
      if (s < v) less++;
      else if (s === v) equal++;
    }
    const pct = ((less + 0.5 * equal) / n) * 100;
    return direction === 'high' ? pct : 100 - pct;
  });
}

/**
 * Percentile within each sector group that has ≥ MIN_SECTOR_PEERS non-null
 * values; rows in smaller/unknown sectors fall back to the universe percentile.
 */
function sectorPercentile(
  values: (number | null)[],
  sectors: (string | null)[],
  direction: 'high' | 'low'
): { pct: (number | null)[]; relative: boolean[] } {
  const universe = percentile(values, direction);
  const pct = [...universe];
  const relative = values.map(() => false);
  const groups = new Map<string, number[]>();
  sectors.forEach((s, i) => {
    if (!s || values[i] == null || !isFinite(values[i] as number)) return;
    const g = groups.get(s);
    if (g) g.push(i); else groups.set(s, [i]);
  });
  for (const idx of groups.values()) {
    if (idx.length < MIN_SECTOR_PEERS) continue;
    const within = percentile(idx.map((i) => values[i]!), direction);
    idx.forEach((i, k) => { pct[i] = within[k]!; relative[i] = true; });
  }
  return { pct, relative };
}

function avg(parts: (number | null)[]): number | null {
  const ok = parts.filter((p): p is number => p != null && isFinite(p));
  if (!ok.length) return null;
  return Math.round((ok.reduce((a, b) => a + b, 0) / ok.length) * 10) / 10;
}

export function computeFactors(rows: ScreenRow[]): ScoredRow[] {
  // Value inputs — a non-positive PER/PBV means loss-making / negative book,
  // which shouldn't count as "cheap": treat as null (rely on other sub-metrics).
  const sectors = rows.map((r) => r.sector ?? null);
  const perP = sectorPercentile(rows.map((r) => (r.per != null && r.per > 0 ? r.per : null)), sectors, 'low');
  const pbvP = sectorPercentile(rows.map((r) => (r.pbv != null && r.pbv > 0 ? r.pbv : null)), sectors, 'low');
  const dyP = sectorPercentile(rows.map((r) => r.dividendYield), sectors, 'high');
  const evP = sectorPercentile(rows.map((r) => (r.evEbitda != null && r.evEbitda > 0 ? r.evEbitda : null)), sectors, 'low');

  // Quality inputs
  const roeP = sectorPercentile(rows.map((r) => r.roe), sectors, 'high');
  const derP = sectorPercentile(rows.map((r) => (r.debtToEquity != null && r.debtToEquity >= 0 ? r.debtToEquity : null)), sectors, 'low');
  const egP = sectorPercentile(rows.map((r) => r.earningsGrowth), sectors, 'high');
  // F-Score as a fraction of evaluable signals (banks are scored out of fewer).
  const fsP = sectorPercentile(rows.map((r) => (r.fScore != null && r.fScoreMax ? r.fScore / r.fScoreMax : null)), sectors, 'high');

  // Momentum inputs
  const rsP = percentile(rows.map((r) => r.rs3m), 'high');
  const scoreP = percentile(rows.map((r) => (typeof r.score === 'number' ? r.score : null)), 'high');

  const scored: ScoredRow[] = rows.map((r, i) => {
    const value = avg([perP.pct[i]!, pbvP.pct[i]!, dyP.pct[i]!, evP.pct[i]!]);
    const quality = avg([roeP.pct[i]!, derP.pct[i]!, egP.pct[i]!, fsP.pct[i]!]);
    const sectorRelative = [perP, pbvP, dyP, evP, roeP, derP, egP, fsP].some((f) => f.relative[i]);
    const momentum = avg([rsP[i]!, scoreP[i]!]);
    const qvm = avg([value, quality, momentum]);
    return { ...r, value, quality, momentum, qvm, qvmRank: null, sectorRelative };
  });

  // Dense rank by QVM (desc). Rows without a QVM — or too illiquid to trade —
  // keep a null rank (their QVM score is still shown).
  const ranked = scored
    .filter((r) => r.qvm != null && (r as Partial<ScoredRow>).liquidity !== 'tipis')
    .sort((a, b) => (b.qvm as number) - (a.qvm as number));
  ranked.forEach((r, idx) => { r.qvmRank = idx + 1; });

  return scored;
}
