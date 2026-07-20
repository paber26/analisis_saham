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
  // Fundamentals (may be null when Yahoo lacks data)
  per: number | null;
  pbv: number | null;
  roe: number | null;
  dividendYield: number | null;
  marketCap: number | null;
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
