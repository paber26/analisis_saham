// File-based persistence for time-machine simulation sessions.
// Each session is one JSON file under .data-store/simulations/<id>.json, plus a
// lightweight index.json of summaries for fast listing. Single-user, no DB —
// same idiom as store.ts / learningStore.ts (safe for Mac→Linux deploy).

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { RegressionResult } from './regression';

export type SimAction = 'HOLD' | 'SELL' | 'AVERAGE_DOWN' | 'BUY';

export interface SimPick {
  code: string;
  entryDate: string;
  entryPrice: number;
  lots: number;        // 1 lot = 100 shares
  weightPct: number;
}

export interface SimDecision {
  date: string;
  code: string;
  action: SimAction;
  lots: number;
  price: number;
  unrealizedPct: number; // position P/L at the moment of the decision
  rating: string;        // as-of rating when the decision was made
  note?: string;
}

export interface SimPerStock { code: string; returnPct: number; contributionPct: number }

export interface SimResult {
  endDate: string;
  finalValue: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  winRate: number;
  realizedPnl: number;
  perStock: SimPerStock[];
  regression: RegressionResult | null;
}

export interface SimSession {
  id: string;
  createdAt: string;
  startDate: string;
  horizonDays: number;
  decisionEveryDays: number;
  initialCapital: number;
  picks: SimPick[];
  decisions: SimDecision[];
  result: SimResult | null;
  status: 'draft' | 'running' | 'settled';
}

export interface SimSummary {
  id: string;
  createdAt: string;
  startDate: string;
  horizonDays: number;
  status: SimSession['status'];
  picks: string[];
  totalReturnPct: number | null;
}

const DIR = path.join(process.env.DATA_STORE_DIR || './.data-store', 'simulations');
const INDEX = path.join(DIR, 'index.json');

function summarize(s: SimSession): SimSummary {
  return {
    id: s.id,
    createdAt: s.createdAt,
    startDate: s.startDate,
    horizonDays: s.horizonDays,
    status: s.status,
    picks: s.picks.map((p) => p.code),
    totalReturnPct: s.result?.totalReturnPct ?? null
  };
}

async function readIndex(): Promise<SimSummary[]> {
  try {
    return JSON.parse(await fs.readFile(INDEX, 'utf-8')) as SimSummary[];
  } catch {
    return [];
  }
}
async function writeIndex(list: SimSummary[]): Promise<void> {
  await fs.mkdir(DIR, { recursive: true });
  const tmp = INDEX + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(list), 'utf-8');
  await fs.rename(tmp, INDEX);
}

export function newSimId(): string {
  return 'sim_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

export async function saveSession(session: SimSession): Promise<void> {
  await fs.mkdir(DIR, { recursive: true });
  const file = path.join(DIR, `${session.id}.json`);
  const tmp = file + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(session), 'utf-8');
  await fs.rename(tmp, file);

  const list = await readIndex();
  const next = list.filter((s) => s.id !== session.id);
  next.unshift(summarize(session));
  await writeIndex(next);
}

export async function loadSession(id: string): Promise<SimSession | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(DIR, `${id}.json`), 'utf-8')) as SimSession;
  } catch {
    return null;
  }
}

export async function listSessions(): Promise<SimSummary[]> {
  return readIndex();
}

export async function loadAllSessions(): Promise<SimSession[]> {
  const list = await readIndex();
  const out: SimSession[] = [];
  for (const s of list) {
    const full = await loadSession(s.id);
    if (full) out.push(full);
  }
  return out;
}

export async function deleteSession(id: string): Promise<void> {
  try { await fs.unlink(path.join(DIR, `${id}.json`)); } catch { /* ignore */ }
  const list = await readIndex();
  await writeIndex(list.filter((s) => s.id !== id));
}
