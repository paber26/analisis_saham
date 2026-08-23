// Persisted history of Strategi Lab sweeps (.data-store/backtest-lab.json).
// Every executed 50-run sweep is stored so results can be compared across
// time — did the "winner" stay a winner? File-store pattern (atomic tmp+rename),
// same philosophy as alerts/watchlist; capacity capped at the latest 20 sweeps.
//
// Semua fungsi menerima { dir } opsional — test memakai dir eksplisit agar
// TERISOLASI penuh dari store produksi (tidak bergantung pada env-var).

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { SweepSummary } from './backtestLab';

export interface LabRunRecord {
  id: string;
  cadence: 'monthly' | 'weekly';
  family: string;
  threshold: number | null;
  maxNames: number | null;
  label: string;
  metrics: { totalReturnPct: number; cagrPct: number; winRatePct: number; maxDrawdownPct: number; sharpe: number; sortino: number; avgHoldings: number };
  bench: { totalReturnPct: number; cagrPct: number; maxDrawdownPct: number; alphaCagrPct: number };
}

export interface LabSweep {
  id: string;
  createdAt: string;      // ISO timestamp
  periodStart: string | null;
  periodEnd: string | null;
  universeSize: number;
  executed: number;
  failed: number;
  beatsCount: number;
  bestAlphaPct: number | null;
  medianAlphaPct: number | null;
  ihsgCagrPct: number | null; // benchmark CAGR dari run pertama yang sukses
  runs: LabRunRecord[];       // urut alpha desc
}

export interface LabHistory { sweeps: LabSweep[] }

const CAP = 20;

export interface HistoryOpts { dir?: string }

function fileIn(opts: HistoryOpts | undefined): string {
  const dir = opts?.dir || process.env.DATA_STORE_DIR || './.data-store';
  return path.join(dir, 'backtest-lab.json');
}

async function readHistory(opts?: HistoryOpts): Promise<LabHistory> {
  try {
    const j = JSON.parse(await fs.readFile(fileIn(opts), 'utf-8')) as LabHistory;
    return { sweeps: Array.isArray(j.sweeps) ? j.sweeps : [] };
  } catch {
    return { sweeps: [] };
  }
}

async function writeHistory(h: LabHistory, opts?: HistoryOpts): Promise<void> {
  const target = fileIn(opts);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const tmp = target + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(h), 'utf-8');
  await fs.rename(tmp, target);
}

/** Ubah hasil runner menjadi record ringkas utk disimpan (runs urut alpha desc). */
export function sweepFromSummary(summary: SweepSummary): LabSweep {
  const okRuns = summary.runs.filter((r) => r.result);
  const runs: LabRunRecord[] = okRuns
    .map((r) => ({
      id: r.id,
      cadence: r.cadence,
      family: r.family,
      threshold: r.threshold,
      maxNames: r.maxNames,
      label: r.label,
      metrics: r.result!.metrics,
      bench: r.result!.benchmark
    }))
    .sort((a, b) => b.bench.alphaCagrPct - a.bench.alphaCagrPct);
  return {
    id: `sweep_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    periodStart: summary.periodStart,
    periodEnd: summary.periodEnd,
    universeSize: summary.universeSize,
    executed: summary.executed,
    failed: summary.failed,
    beatsCount: summary.beatsCount,
    bestAlphaPct: summary.bestAlphaPct,
    medianAlphaPct: summary.medianAlphaPct,
    ihsgCagrPct: runs.length ? runs[0]!.bench.cagrPct : null,
    runs
  };
}

export async function saveSweep(sweep: LabSweep, opts?: HistoryOpts): Promise<void> {
  const h = await readHistory(opts);
  h.sweeps.unshift(sweep);
  h.sweeps = h.sweeps.slice(0, CAP);
  await writeHistory(h, opts);
}

/** Daftar ringkas semua sweep tersimpan (terbaru dulu) — untuk dropdown UI. */
export type SweepListItem = Pick<LabSweep, 'id' | 'createdAt' | 'periodStart' | 'periodEnd' | 'beatsCount' | 'bestAlphaPct' | 'executed'>;

export async function listSweepSummaries(opts?: HistoryOpts): Promise<SweepListItem[]> {
  const h = await readHistory(opts);
  return h.sweeps.map((s) => ({
    id: s.id, createdAt: s.createdAt, periodStart: s.periodStart,
    periodEnd: s.periodEnd, beatsCount: s.beatsCount, bestAlphaPct: s.bestAlphaPct,
    executed: s.executed
  }));
}

export async function getSweep(id: string, opts?: HistoryOpts): Promise<LabSweep | null> {
  const h = await readHistory(opts);
  return h.sweeps.find((s) => s.id === id) ?? null;
}

export async function getLatestSweep(opts?: HistoryOpts): Promise<LabSweep | null> {
  const h = await readHistory(opts);
  return h.sweeps[0] ?? null;
}
