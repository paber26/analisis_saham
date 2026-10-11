// Keep the KSEI ownership history up to date and re-derive the snapshot
// (latest shifts per stock + honest signal evaluation). The first run
// backfills from Dec 2019 (~80 small files, a few minutes); later runs only
// fetch the newest month. Runs after the daily sync (non-blocking) or via
// /api/ksei/sync.

import { fetchKseiMonth, monthsUntil } from './kseiFetch';
import { evaluateOwnership, latestOwnership, type OwnershipMonth } from './ksei';
import { saveKseiMonth, loadKseiMonths, saveKseiSnapshot, type KseiSnapshot } from './store';

const FROM = { year: 2019, month: 12 };
const RECENT = 24; // months kept in memory for per-stock history
let running: Promise<KseiSnapshot | null> | null = null;
let recentCache: OwnershipMonth[] | null = null;

/** The most recent stored months (cached in memory; refreshed by each sync). */
export async function getRecentKseiMonths(): Promise<OwnershipMonth[]> {
  recentCache ??= await loadKseiMonths(RECENT);
  return recentCache;
}

async function run(): Promise<KseiSnapshot | null> {
  const have = new Set((await loadKseiMonths()).map((m) => m.date.slice(0, 7)));
  for (const { year, month } of monthsUntil(FROM)) {
    if (have.has(`${year}-${String(month).padStart(2, '0')}`)) continue;
    const m = await fetchKseiMonth(year, month);
    if (m) await saveKseiMonth(m);
    await new Promise((r) => setTimeout(r, 300)); // be polite to KSEI
  }
  const months = await loadKseiMonths();
  recentCache = months.slice(-RECENT);
  if (!months.length) return null;
  const snap: KseiSnapshot = {
    updatedAt: new Date().toISOString(),
    date: months[months.length - 1]!.date,
    months: months.length,
    evaluation: evaluateOwnership(months),
    latest: latestOwnership(months)
  };
  await saveKseiSnapshot(snap);
  return snap;
}

/** Sync once at a time; concurrent callers share the in-flight run. */
export function syncKsei(): Promise<KseiSnapshot | null> {
  if (!running) {
    running = run().catch((err) => {
      console.error('KSEI sync failed:', err);
      return null;
    }).finally(() => { running = null; });
  }
  return running;
}
