// Strategi Lab — systematic parameter sweep for the backtest engine.
//
// A sweep runs EXACTLY 500 configurations (legacy 50 + 450 faktorial) over the
// same bars, reusing one precomputed signal matrix per (family × cadence).
//
// Honesty: results are exploratory. Picking the best-of-500 afterwards is
// curve-fitting — the UI says so, and every run is stored in history.

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
// Grid — tepat 500 kombinasi deterministik.
// 50 legacy (v1, 28 bulanan + 22 mingguan) DIJAMIN ada di urutan awal agar
// kompatibel dgn histori; 450 sisanya diisi faktorial terurut sampai cap 500.
// ---------------------------------------------------------------------------
const SCORE_THR_ALL = [40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90];

function cfg(cadence: Cadence, family: FamilyKey, threshold: number | null, maxNames: number | null): LabConfig {
  const famLabel = family === 'score' ? 'Skor'
    : family === 'score_ma200' ? 'Skor+MA200'
    : family === 'ma200' ? 'MA200'
    : family === 'golden' ? 'Golden Cross'
    : family === 'lowvol' ? 'LowVol'
    : 'Baseline';
  const thr = threshold != null ? `≥${threshold}` : '';
  const top = maxNames != null ? `Top${maxNames}` : 'Semua';
  const kad = cadence === 'weekly' ? 'Mingguan' : cadence === 'biweekly' ? 'Dwi-mingguan' : 'Bulanan';
  return {
    id: `${cadence}-${family}-t${threshold ?? 'x'}-k${maxNames ?? 'all'}`,
    cadence, family, threshold, maxNames,
    label: `${famLabel} ${thr} ${top} · ${kad}`.replace(/\s+/g, ' ').trim()
  };
}

function buildLegacyGrid(): LabConfig[] {
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

  return grid;
}

const LEGACY_GRID = buildLegacyGrid();

export function buildLabGrid(): LabConfig[] {
  const TARGET = 500;
  const seen = new Set(LEGACY_GRID.map((c) => c.id));
  const grid: LabConfig[] = [...LEGACY_GRID];

  // Faktorial deterministik — cadence luar, family, ambang, topK dalam.
  const cadences: Cadence[] = ['monthly', 'weekly', 'biweekly'];
  const THR_SCORE = [30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95];
  const TOPK_SCORE: (number | null)[] = [null, 30, 20, 15, 10, 7, 5, 3];
  const TOPK_TREND: (number | null)[] = [null, 30, 20, 15, 10, 5, 3];
  const TOPK_LOWVOL: (number | null)[] = [null, 30, 20, 15, 10, 7, 5, 3];

  function pushUnique(c: LabConfig) {
    if (seen.has(c.id) || grid.length >= TARGET) return;
    seen.add(c.id);
    grid.push(c);
  }

  for (const cad of cadences) {
    // Skor (threshold matters)
    for (const thr of THR_SCORE) {
      for (const k of TOPK_SCORE) {
        pushUnique(cfg(cad, 'score', thr, k));
        if (grid.length >= TARGET) break;
      }
      if (grid.length >= TARGET) break;
    }
    if (grid.length >= TARGET) break;

    // Skor+MA200
    for (const thr of [40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90]) {
      for (const k of [null, 30, 20, 15, 10, 5, 3] as (number | null)[]) {
        pushUnique(cfg(cad, 'score_ma200', thr, k));
        if (grid.length >= TARGET) break;
      }
      if (grid.length >= TARGET) break;
    }
    if (grid.length >= TARGET) break;

    // MA200
    for (const k of TOPK_TREND) {
      pushUnique(cfg(cad, 'ma200', null, k));
      if (grid.length >= TARGET) break;
    }
    if (grid.length >= TARGET) break;

    // Golden
    for (const k of TOPK_TREND) {
      pushUnique(cfg(cad, 'golden', null, k));
      if (grid.length >= TARGET) break;
    }
    if (grid.length >= TARGET) break;

    // LowVol
    for (const k of TOPK_LOWVOL) {
      pushUnique(cfg(cad, 'lowvol', null, k));
      if (grid.length >= TARGET) break;
    }
    if (grid.length >= TARGET) break;

    // Baseline
    for (const k of [null, 20, 10, 5] as (number | null)[]) {
      pushUnique(cfg(cad, 'always', null, k));
      if (grid.length >= TARGET) break;
    }
    if (grid.length >= TARGET) break;
  }

  return grid.slice(0, TARGET);
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
 * Jalankan seluruh grid (500) pada data yang sama.
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
