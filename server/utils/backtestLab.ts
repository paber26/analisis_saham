// Strategi Lab — systematic parameter sweep for the backtest engine.
//
// A sweep runs EXACTLY 50 configurations (28 monthly + 22 weekly) over the
// same bars, reusing one precomputed signal matrix per (family × cadence) so
// the whole grid costs roughly the CPU of ~10 individual backtests.
//
// Honesty: results are exploratory. Picking the best-of-50 afterwards is
// curve-fitting — the UI says so, and every run is stored in history so
// future-you can check whether the "winner" stayed a winner.

import type { DailyBar } from './yahoo';
import { normalizeSymbol } from './symbol';
import { fetchDailyBars } from './yahoo';
import {
  runBacktest, rebalanceIndices, evaluateFamily,
  type BacktestResult, type Cadence, type FamilyKey, type SignalMatrix
} from './backtest';

/** Universe likuid utk backtest & lab (survivorship bias diakui di UI). */
export const LAB_UNIVERSE = [
  'BBCA', 'BBRI', 'BMRI', 'BBNI', 'BRIS', 'TLKM', 'ISAT', 'EXCL', 'ASII', 'UNTR',
  'ADRO', 'PTBA', 'ITMG', 'INDY', 'UNVR', 'ICBP', 'INDF', 'MYOR', 'KLBF', 'CPIN',
  'JPFA', 'ANTM', 'INCO', 'MDKA', 'AMMN', 'SMGR', 'INTP', 'TPIA', 'BRPT', 'AKRA',
  'PGAS', 'TOWR', 'MTEL', 'GOTO', 'MAPI', 'ACES', 'ERAA', 'BSDE', 'PWON', 'SMRA',
  'CTRA', 'HMSP', 'GGRM', 'MEDC', 'HRUM'
];

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx]!);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Fetch 5y bars utk seluruh universe + IHSG (cache harian membuat re-run murah). */
export async function fetchLabBars(concurrency = 8): Promise<{
  barsBySymbol: Map<string, DailyBar[]>;
  ihsgBars: DailyBar[];
}> {
  const barsBySymbol = new Map<string, DailyBar[]>();
  await mapWithConcurrency(LAB_UNIVERSE, concurrency, async (code) => {
    const f = await fetchDailyBars(normalizeSymbol(code), '5y', false);
    if (f && f.bars.length > 260) barsBySymbol.set(code, f.bars);
  });
  const ihsg = await fetchDailyBars('^JKSE', '5y', false);
  return { barsBySymbol, ihsgBars: ihsg?.bars ?? [] };
}

export interface LabConfig {
  id: string;
  cadence: Cadence;
  family: FamilyKey;
  threshold: number | null;
  maxNames: number | null;
  label: string;
}

export interface LabRunResult extends LabConfig {
  result: BacktestResult | null; // null = gagal dihitung (data kurang)
}

// ---------------------------------------------------------------------------
// Grid — tepat 50 kombinasi deterministik.
// Bulanan 28: score(11×all) + score({60,70,80}×10) + score_ma200({60,70,80}×all)
//           + ma200(all) + golden(all) + baseline(always,all)
//           + score(70×{10,5}) + score_ma200(70×10)
//           + score({50..65}×5) + ma200(top10)
// Mingguan 22: score(11×all) + score({60,70,80}×10) + score_ma200({60,70,80}×all)
//           + ma200(all) + golden(all) + baseline(always,all) + score(70×{10,5})
// ---------------------------------------------------------------------------
const SCORE_THR_ALL = [40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90];

function cfg(cadence: Cadence, family: FamilyKey, threshold: number | null, maxNames: number | null): LabConfig {
  const famLabel = family === 'score' ? 'Skor'
    : family === 'score_ma200' ? 'Skor+MA200'
    : family === 'ma200' ? 'MA200'
    : family === 'golden' ? 'Golden Cross'
    : 'Baseline';
  const thr = threshold != null ? `≥${threshold}` : '';
  const top = maxNames != null ? `Top${maxNames}` : 'Semua';
  const kad = cadence === 'weekly' ? 'Mingguan' : 'Bulanan';
  return {
    id: `${cadence}-${family}-t${threshold ?? 'x'}-k${maxNames ?? 'all'}`,
    cadence, family, threshold, maxNames,
    label: `${famLabel} ${thr} ${top} · ${kad}`.replace(/\s+/g, ' ').trim()
  };
}

export function buildLabGrid(): LabConfig[] {
  const grid: LabConfig[] = [];

  // ---- BLOK BULANAN (28) ----
  for (const t of SCORE_THR_ALL) grid.push(cfg('monthly', 'score', t, null));          // 11
  for (const t of [60, 70, 80]) grid.push(cfg('monthly', 'score', t, 10));             // 3
  for (const t of [60, 70, 80]) grid.push(cfg('monthly', 'score_ma200', t, null));     // 3
  grid.push(cfg('monthly', 'ma200', null, null));                                      // 1
  grid.push(cfg('monthly', 'golden', null, null));                                     // 1
  grid.push(cfg('monthly', 'always', null, null));                                     // 1
  grid.push(cfg('monthly', 'score_ma200', 70, 10));                                    // 1
  for (const t of [50, 55, 60, 65]) grid.push(cfg('monthly', 'score', t, 5));          // 4
  grid.push(cfg('monthly', 'ma200', null, 10));                                        // 1
  grid.push(cfg('monthly', 'score_ma200', 65, 10));                                    // 1
  grid.push(cfg('monthly', 'score_ma200', 75, 10));                                    // 1
  // = 28

  // ---- BLOK MINGGUAN (22) ----
  for (const t of SCORE_THR_ALL) grid.push(cfg('weekly', 'score', t, null));           // 11
  for (const t of [60, 70, 80]) grid.push(cfg('weekly', 'score', t, 10));              // 3
  for (const t of [60, 70, 80]) grid.push(cfg('weekly', 'score_ma200', t, null));      // 3
  grid.push(cfg('weekly', 'ma200', null, null));                                       // 1
  grid.push(cfg('weekly', 'golden', null, null));                                      // 1
  grid.push(cfg('weekly', 'always', null, null));                                      // 1
  grid.push(cfg('weekly', 'ma200', null, 5));                                          // 1
  grid.push(cfg('weekly', 'score_ma200', 70, 5));                                      // 1
  // = 22

  return grid; // 50 total — dipin oleh test
}

// ---------------------------------------------------------------------------
// Matrix build & sweep runner
// ---------------------------------------------------------------------------
/** Prakomputasi sel sinyal utk satu keluarga+kadensi di seluruh universe. */
export function buildMatrix(
  barsBySymbol: Map<string, DailyBar[]>,
  ihsgBars: DailyBar[],
  family: FamilyKey,
  cadence: Cadence
): SignalMatrix {
  const dates = rebalanceIndices(ihsgBars, cadence).filter((i) => i >= 200);
  const matrix: SignalMatrix = new Map();
  for (const [code, bars] of barsBySymbol) {
    const idxByDate = new Map(bars.map((b, i) => [b.date, i]));
    const perDate = new Map<string, { ok: boolean; rank: number }>();
    for (const ri of dates) {
      const date = ihsgBars[ri]!.date;
      const idx = idxByDate.get(date);
      if (idx == null || idx < 30) continue;
      const cell = evaluateFamily(family, bars.slice(0, idx + 1));
      if (cell) perDate.set(date, cell);
    }
    if (perDate.size) matrix.set(code, perDate);
  }
  return matrix;
}

export interface SweepSummary {
  runs: LabRunResult[];
  executed: number;
  failed: number;
  periodStart: string | null;
  periodEnd: string | null;
  universeSize: number;
  beatsCount: number;
  bestAlphaPct: number | null;
  medianAlphaPct: number | null;
}

function median(v: number[]): number {
  if (!v.length) return 0;
  const s = [...v].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : Math.round(((s[mid - 1]! + s[mid]!) / 2) * 100) / 100;
}

/**
 * Jalankan seluruh 50 konfigurasi pada data yang sama.
 * Konfigurasi dikelompokkan per (family × cadence) agar matrix prakomputasi
 * dipakai ulang — biaya CPU dominan hanya pada pembentukan matrix.
 */
export function runSweep(
  barsBySymbol: Map<string, DailyBar[]>,
  ihsgBars: DailyBar[],
  opts: { costPct?: number } = {}
): SweepSummary {
  const grid = buildLabGrid();
  const matrixCache = new Map<string, SignalMatrix>();
  const getMatrix = (family: FamilyKey, cadence: Cadence): SignalMatrix => {
    const key = `${family}|${cadence}`;
    let m = matrixCache.get(key);
    if (!m) { m = buildMatrix(barsBySymbol, ihsgBars, family, cadence); matrixCache.set(key, m); }
    return m;
  };

  const runs: LabRunResult[] = [];
  let failed = 0;
  let periodStart: string | null = null;
  let periodEnd: string | null = null;

  for (const config of grid) {
    const result = runBacktest(barsBySymbol, ihsgBars, () => false, {
      ...opts,
      cadence: config.cadence,
      maxNames: config.maxNames,
      minRank: config.threshold,
      signals: getMatrix(config.family, config.cadence)
    });
    if (!result) { failed++; runs.push({ ...config, result: null }); continue; }
    periodStart = periodStart ?? result.start;
    periodEnd = result.end;
    runs.push({ ...config, result });
  }

  const alphas = runs.filter((r) => r.result).map((r) => r.result!.benchmark.alphaCagrPct);
  const best = alphas.length ? Math.max(...alphas) : null;

  return {
    runs,
    executed: runs.length - failed,
    failed,
    periodStart,
    periodEnd,
    universeSize: barsBySymbol.size,
    beatsCount: alphas.filter((a) => a > 0).length,
    bestAlphaPct: best,
    medianAlphaPct: alphas.length ? median(alphas) : null
  };
}
