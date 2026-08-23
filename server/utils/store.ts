// File-based data store for the daily screener snapshot.
// Written by the /api/sync cron job, read by /api/screen. Lives OUTSIDE
// .output (survives deploys) and uses only Node fs — no native modules.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { TechResult } from './technical';

export interface ScreenRow extends TechResult {
  code: string;
  symbol: string;
  name: string;
  sector: string | null;   // Yahoo GICS sector (translated in market.ts)
  rs3m: number | null;     // relative strength vs IHSG, 3-month (%)
  // Fundamentals (may be null when Yahoo lacks data)
  per: number | null;
  pbv: number | null;
  roe: number | null;
  dividendYield: number | null;
  marketCap: number | null;
  revenueGrowth: number | null;  // % YoY
  earningsGrowth: number | null; // % YoY
  debtToEquity: number | null;   // ratio
}

export interface ScreenSnapshot {
  date: string;        // trading day (WIB) the data represents
  generatedAt: string; // ISO timestamp the sync finished
  count: number;
  attempted: number;
  rows: ScreenRow[];
}

const DIR = process.env.DATA_STORE_DIR || './.data-store';
const SCREEN_FILE = 'screen-latest.json';

export async function saveScreenSnapshot(snapshot: ScreenSnapshot): Promise<void> {
  await fs.mkdir(DIR, { recursive: true });
  const tmp = path.join(DIR, SCREEN_FILE + '.tmp');
  const final = path.join(DIR, SCREEN_FILE);
  await fs.writeFile(tmp, JSON.stringify(snapshot), 'utf-8');
  await fs.rename(tmp, final); // atomic swap so readers never see a partial file
}

export async function loadScreenSnapshot(): Promise<ScreenSnapshot | null> {
  try {
    const txt = await fs.readFile(path.join(DIR, SCREEN_FILE), 'utf-8');
    return JSON.parse(txt) as ScreenSnapshot;
  } catch {
    return null;
  }
}

// ---- Generic atomic JSON read/write (single-user personal data) ----
async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(path.join(DIR, file), 'utf-8')) as T;
  } catch {
    return fallback;
  }
}
async function writeJson(file: string, data: unknown): Promise<void> {
  await fs.mkdir(DIR, { recursive: true });
  const tmp = path.join(DIR, file + '.tmp');
  await fs.writeFile(tmp, JSON.stringify(data), 'utf-8');
  await fs.rename(tmp, path.join(DIR, file));
}

// ---- Watchlist ----
export async function getWatchlist(): Promise<string[]> {
  return readJson<string[]>('watchlist.json', []);
}
export async function setWatchlist(codes: string[]): Promise<void> {
  const clean = Array.from(new Set(codes.map((c) => c.toUpperCase().trim()).filter(Boolean)));
  await writeJson('watchlist.json', clean);
}

// ---- Skips ("kurang menarik") ----
// Codes the user has flagged as "not interesting" so they stop appearing in
// the right-rail screening list and the daily digest. Personal single-user data
// like watchlist, stored as a plain string[] JSON file.
export async function getSkips(): Promise<string[]> {
  return readJson<string[]>('skips.json', []);
}
export async function setSkips(codes: string[]): Promise<void> {
  const clean = Array.from(new Set(codes.map((c) => c.toUpperCase().trim()).filter(Boolean)));
  await writeJson('skips.json', clean);
}

// ---- Portfolio ----
export interface Holding {
  symbol: string;   // display code, e.g. 'BBCA'
  lots: number;     // 1 lot = 100 shares
  avgPrice: number; // average buy price (IDR)
  date?: string;
}
export async function getPortfolio(): Promise<Holding[]> {
  return readJson<Holding[]>('portfolio.json', []);
}
export async function setPortfolio(holdings: Holding[]): Promise<void> {
  await writeJson('portfolio.json', holdings);
}

// ---- Alerts (rule-based notifications) ----
// Rules are evaluated against the daily screener snapshot by /api/alerts/run
// (cron after /api/sync). Dedupe is date-keyed: a rule notifies at most once
// per WIB trading day via lastTriggeredAt.
export interface AlertRule {
  id: string;
  code: string;              // 'BBCA' or '*' (seluruh snapshot)
  type: 'rsi_oversold' | 'breakout_52w' | 'above_ma200' | 'score_above' | 'price_below' | 'murah_uptrend';
  value?: number | null;     // threshold (wajib utk price_below/score_above/rsi_oversold custom)
  active?: boolean;
  createdAt?: string;
  lastTriggeredAt?: string | null; // YYYY-MM-DD (WIB trading day)
}

export interface AlertTrigger {
  id: string;
  ruleId: string;
  code: string;
  type: AlertRule['type'];
  message: string;
  date: string;              // YYYY-MM-DD (WIB)
}

export interface AlertStore {
  rules: AlertRule[];
  history: AlertTrigger[];   // newest first, capped
}

const ALERTS_FILE = 'alerts.json';
const HISTORY_CAP = 100;

export async function getAlertStore(): Promise<AlertStore> {
  const s = await readJson<AlertStore>(ALERTS_FILE, { rules: [], history: [] });
  return { rules: s.rules ?? [], history: s.history ?? [] };
}
export async function saveAlertStore(store: AlertStore): Promise<void> {
  await writeJson(ALERTS_FILE, { ...store, history: store.history.slice(0, HISTORY_CAP) });
}
