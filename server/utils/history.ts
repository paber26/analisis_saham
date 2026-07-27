// Daily history store — foundation for score/RS/QVM trends over time.
// Written by /api/sync (one snapshot per day).
// Dual-mode persistence: Vercel Postgres / Neon Postgres ('daily_history' table) + local file fallback.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { analyzeTechnical } from './technical';
import type { DailyBar } from './yahoo';
import { getSql, ensureTablesExist } from './postgres';

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

export async function appendDailyHistory(date: string, rows: HistoryRow[]): Promise<void> {
  const sql = getSql();
  if (sql) {
    try {
      await ensureTablesExist();
      const payload = JSON.stringify(rows);
      await sql`
        INSERT INTO daily_history (date, rows)
        VALUES (${date}, ${payload}::jsonb)
        ON CONFLICT (date) DO UPDATE SET rows = EXCLUDED.rows;
      `;
      console.log(`[history] Saved daily history for ${date} to Postgres.`);
    } catch (err) {
      console.warn(`[history] Failed to save daily history for ${date} to Postgres:`, (err as Error).message);
    }
  }

  // Mirror to local disk if writable
  try {
    await fs.mkdir(HIST_DIR, { recursive: true });
    const tmp = path.join(HIST_DIR, `${date}.json.tmp`);
    const final = path.join(HIST_DIR, `${date}.json`);
    await fs.writeFile(tmp, JSON.stringify({ date, rows }), 'utf-8');
    await fs.rename(tmp, final);
  } catch { /* ignore local file errors in serverless */ }
}

export async function listHistoryDates(): Promise<string[]> {
  const sql = getSql();
  if (sql) {
    try {
      await ensureTablesExist();
      const rows = await sql<{ date: string }[]>`
        SELECT date FROM daily_history ORDER BY date ASC;
      `;
      return rows.map((r) => r.date);
    } catch (err) {
      console.warn('[history] Failed to list history dates from Postgres, using local fallback:', (err as Error).message);
    }
  }

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

export async function loadStockHistory(code: string): Promise<StockHistoryPoint[]> {
  const sql = getSql();
  if (sql) {
    try {
      await ensureTablesExist();
      const rows = await sql<{ date: string; rows: HistoryRow[] }[]>`
        SELECT date, rows FROM daily_history ORDER BY date ASC;
      `;
      const out: StockHistoryPoint[] = [];
      for (const r of rows) {
        const row = r.rows?.find((item) => item.code === code);
        if (row) out.push({ date: r.date, close: row.close, score: row.score, per: row.per, rs3m: row.rs3m, qvm: row.qvm });
      }
      return out;
    } catch (err) {
      console.warn(`[history] Failed to load stock history for ${code} from Postgres, using local fallback:`, (err as Error).message);
    }
  }

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

export function backfillScoreTrend(bars: DailyBar[], stepDays = 5): TrendPoint[] {
  const out: TrendPoint[] = [];
  if (bars.length < 210) return out;
  const start = Math.max(205, bars.length - 252);
  for (let i = start; i < bars.length; i += stepDays) {
    const t = analyzeTechnical(bars.slice(0, i + 1));
    if (t) out.push({ date: bars[i]!.date, score: t.score, close: bars[i]!.close });
  }
  const last = bars[bars.length - 1]!;
  if (!out.length || out[out.length - 1]!.date !== last.date) {
    const t = analyzeTechnical(bars);
    if (t) out.push({ date: last.date, score: t.score, close: last.close });
  }
  return out;
}
