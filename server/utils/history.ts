// Daily history store — the foundation for score/RS/QVM trends and honest
// screener backtests over time. Written by /api/sync (one compact file per day),
// read by /api/history. File-store only (no native module), atomic per-day.
//
// Note: history accumulates going forward from the first sync. For an immediate
// per-stock score trend (before enough days exist), backfillScoreTrend()
// recomputes the composite score on historical bar slices on demand.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { analyzeTechnical } from './technical';
import type { DailyBar } from './yahoo';

const DIR = process.env.DATA_STORE_DIR || './.data-store';
const HIST_DIR = path.join(DIR, 'history');

export interface HistoryRow {
  code: string;
  close: number;
  score: number;
  rating: string;
  per: number | null;
  pbv: number | null;
  roe: number | null;
  rs3m: number | null;
  qvm: number | null;
}

export interface DayHistory { date: string; rows: HistoryRow[] }

// Overwrites the given day's file (idempotent — re-running sync same day is safe).
export async function appendDailyHistory(date: string, rows: HistoryRow[]): Promise<void> {
  await fs.mkdir(HIST_DIR, { recursive: true });
  const tmp = path.join(HIST_DIR, `${date}.json.tmp`);
  const final = path.join(HIST_DIR, `${date}.json`);
  await fs.writeFile(tmp, JSON.stringify({ date, rows }), 'utf-8');
  await fs.rename(tmp, final); // atomic
}

export async function listHistoryDates(): Promise<string[]> {
  try {
    const files = await fs.readdir(HIST_DIR);
    return files.filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', '')).sort();
  } catch {
    return [];
  }
}

export interface StockHistoryPoint {
  date: string; close: number; score: number; per: number | null; rs3m: number | null; qvm: number | null;
}

// Stored daily history for one stock across all day files.
export async function loadStockHistory(code: string): Promise<StockHistoryPoint[]> {
  const dates = await listHistoryDates();
  const out: StockHistoryPoint[] = [];
  for (const d of dates) {
    try {
      const day = JSON.parse(await fs.readFile(path.join(HIST_DIR, `${d}.json`), 'utf-8')) as DayHistory;
      const row = day.rows.find((r) => r.code === code);
      if (row) out.push({ date: d, close: row.close, score: row.score, per: row.per, rs3m: row.rs3m, qvm: row.qvm });
    } catch { /* skip corrupt day */ }
  }
  return out;
}

export interface TrendPoint { date: string; score: number; close: number }

// Recompute the composite technical score on historical slices (no look-ahead:
// each point uses only bars up to that day). Gives an immediate score trend.
export function backfillScoreTrend(bars: DailyBar[], stepDays = 5): TrendPoint[] {
  const out: TrendPoint[] = [];
  if (bars.length < 210) return out;
  const start = Math.max(205, bars.length - 252); // ~1y of points, 200d warm-up
  for (let i = start; i < bars.length; i += stepDays) {
    const t = analyzeTechnical(bars.slice(0, i + 1));
    if (t) out.push({ date: bars[i]!.date, score: t.score, close: bars[i]!.close });
  }
  // Always include the latest bar.
  const last = bars[bars.length - 1]!;
  if (!out.length || out[out.length - 1]!.date !== last.date) {
    const t = analyzeTechnical(bars);
    if (t) out.push({ date: last.date, score: t.score, close: last.close });
  }
  return out;
}
