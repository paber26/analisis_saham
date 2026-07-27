// Persistence for time-machine simulation sessions.
// Dual-mode persistence:
// 1. Primary: Vercel Postgres / Neon Postgres ('simulations' table) when POSTGRES_URL is set.
// 2. Secondary/Fallback: Local file store under .data-store/simulations/<id>.json

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { RegressionResult } from './regression';
import { getSql, ensureTablesExist } from './postgres';

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
  ihsgReturnPct?: number | null;
  alphaPct?: number | null;
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
  ihsgReturnPct?: number | null;
  alphaPct?: number | null;
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
    totalReturnPct: s.result?.totalReturnPct ?? null,
    ihsgReturnPct: s.result?.ihsgReturnPct ?? null,
    alphaPct: s.result?.alphaPct ?? (s.result && s.result.totalReturnPct != null && s.result.ihsgReturnPct != null ? s.result.totalReturnPct - s.result.ihsgReturnPct : null)
  };
}

async function readIndexLocal(): Promise<SimSummary[]> {
  try {
    return JSON.parse(await fs.readFile(INDEX, 'utf-8')) as SimSummary[];
  } catch {
    return [];
  }
}

async function writeIndexLocal(list: SimSummary[]): Promise<void> {
  try {
    await fs.mkdir(DIR, { recursive: true });
    const tmp = INDEX + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(list), 'utf-8');
    await fs.rename(tmp, INDEX);
  } catch { /* ignore local file errors in serverless */ }
}

export function newSimId(): string {
  return 'sim_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

export async function saveSession(session: SimSession): Promise<void> {
  const sql = getSql();
  if (sql) {
    try {
      await ensureTablesExist();
      const payload = JSON.stringify(session);
      await sql`
        INSERT INTO simulations (id, data)
        VALUES (${session.id}, ${payload}::jsonb)
        ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;
      `;
      console.log(`[simStore] Saved session ${session.id} to Postgres.`);
    } catch (err) {
      console.warn(`[simStore] Failed to save session ${session.id} to Postgres:`, (err as Error).message);
    }
  }

  // Mirror to local disk if writable
  try {
    await fs.mkdir(DIR, { recursive: true });
    const file = path.join(DIR, `${session.id}.json`);
    const tmp = file + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(session), 'utf-8');
    await fs.rename(tmp, file);

    const list = await readIndexLocal();
    const next = list.filter((s) => s.id !== session.id);
    next.unshift(summarize(session));
    await writeIndexLocal(next);
  } catch { /* ignore file write errors in read-only serverless */ }
}

export async function loadSession(id: string): Promise<SimSession | null> {
  const sql = getSql();
  if (sql) {
    try {
      await ensureTablesExist();
      const rows = await sql<{ data: SimSession }[]>`
        SELECT data FROM simulations WHERE id = ${id} LIMIT 1;
      `;
      if (rows.length > 0 && rows[0]?.data) {
        return rows[0].data;
      }
    } catch (err) {
      console.warn(`[simStore] Failed to load session ${id} from Postgres, trying local file fallback:`, (err as Error).message);
    }
  }

  // Fallback to local file store
  try {
    return JSON.parse(await fs.readFile(path.join(DIR, `${id}.json`), 'utf-8')) as SimSession;
  } catch {
    return null;
  }
}

export async function listSessions(): Promise<SimSummary[]> {
  const sql = getSql();
  if (sql) {
    try {
      await ensureTablesExist();
      const rows = await sql<{ data: SimSession }[]>`
        SELECT data FROM simulations ORDER BY created_at DESC;
      `;
      return rows.map((r) => summarize(r.data));
    } catch (err) {
      console.warn('[simStore] Failed to list sessions from Postgres, trying local index fallback:', (err as Error).message);
    }
  }

  return readIndexLocal();
}

export async function loadAllSessions(): Promise<SimSession[]> {
  const sql = getSql();
  if (sql) {
    try {
      await ensureTablesExist();
      const rows = await sql<{ data: SimSession }[]>`
        SELECT data FROM simulations ORDER BY created_at DESC;
      `;
      return rows.map((r) => r.data);
    } catch (err) {
      console.warn('[simStore] Failed to load all sessions from Postgres, trying local fallback:', (err as Error).message);
    }
  }

  const list = await readIndexLocal();
  const out: SimSession[] = [];
  for (const s of list) {
    const full = await loadSession(s.id);
    if (full) out.push(full);
  }
  return out;
}

export async function deleteSession(id: string): Promise<void> {
  const sql = getSql();
  if (sql) {
    try {
      await ensureTablesExist();
      await sql`
        DELETE FROM simulations WHERE id = ${id};
      `;
      console.log(`[simStore] Deleted session ${id} from Postgres.`);
    } catch (err) {
      console.warn(`[simStore] Failed to delete session ${id} from Postgres:`, (err as Error).message);
    }
  }

  try {
    await fs.unlink(path.join(DIR, `${id}.json`));
  } catch { /* ignore */ }
  const list = await readIndexLocal();
  await writeIndexLocal(list.filter((s) => s.id !== id));
}
