// Persisted history of Strategi Lab sweeps (.data-store/backtest-lab.json).
// Every executed 50-run sweep is stored so results can be compared across
// time — did the "winner" stay a winner? File-store pattern (atomic tmp+rename),
// same philosophy as alerts/watchlist; capacity capped at the latest 20 sweeps.
//
// NOTE: DATA_STORE_DIR dibaca per-panggilan (bukan di module load) supaya
// test dapat mengarahkan store ke direktori sementara.

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

function dataDir(): string {
  return process.env.DATA_STORE_DIR || './.data-store';
}
function filePath(): string {
  return path.join(dataDir(), 'backtest-lab.json');
}

async function readHistory(): Promise<LabHistory> {
  try {
    const j = JSON.parse(await fs.readFile(filePath(), 'utf-8')) as LabHistory;
    return { sweeps: Array.isArray(j.sweeps) ? j.sweeps : [] };
  } catch {
    return { sweeps: [] };
  }
}

async function writeHistory(h: LabHistory): Promise<void> {
  await fs.mkdir(dataDir(), { recursive: true });
  const tmp = filePath() + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(h), 'utf-8');
  await fs.rename(tmp, filePath());
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

export async function saveSweep(sweep: LabSweep): Promise<void> {
  const h = await readHistory();
  h.sweeps.unshift(sweep);
  h.sweeps = h.sweeps.slice(0, CAP);
  await writeHistory(h);
}

/** Daftar ringkas semua sweep tersimpan (terbaru dulu) — untuk dropdown UI. */
export async function listSweepSummaries(): Promise<Pick<LabSweep, 'id' | 'createdAt' | 'periodStart' | 'periodEnd' | 'beatsCount' | 'bestAlphaPct' | 'executed'>[]> {
  const h = await readHistory();
  return h.sweeps.map((s) => ({
    id: s.id, createdAt: s.createdAt, periodStart: s.periodStart,
    periodEnd: s.periodEnd, beatsCount: s.beatsCount, bestAlphaPct: s.bestAlphaPct,
    executed: s.executed
  }));
}

export async function getSweep(id: string): Promise<LabSweep | null> {
  const h = await readHistory();
  return h.sweeps.find((s) => s.id === id) ?? null;
}

export async function getLatestSweep(): Promise<LabSweep | null> {
  const h = await readHistory();
  return h.sweeps[0] ?? null;
}
