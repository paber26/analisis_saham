// Train the pooled ML ranking model (see mlRank.ts) on ~5y of adjusted daily
// bars for the screening universe and store scores + honest walk-forward
// evaluation. Runs after the daily sync (non-blocking) or via /api/ml/train.
// Training yields to the event loop between trees, so the site stays
// responsive on a small VPS.

import { fetchDailyBars } from './yahoo';
import { normalizeSymbol } from './symbol';
import { buildDataset, walkForward, scoreLatest, type MlSeries } from './mlRank';
import { saveMlSnapshot, type MlSnapshot } from './store';

const HORIZON = 20;
const STEP = 5;
let running: Promise<MlSnapshot | null> | null = null;

async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let k = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (k < items.length) { const i = k++; out[i] = await fn(items[i]!); }
  }));
  return out;
}

async function run(codes: string[]): Promise<MlSnapshot | null> {
  const t0 = Date.now();
  const ihsgF = await fetchDailyBars('^JKSE', '5y', false);
  if (!ihsgF || ihsgF.bars.length < 300) return null;
  const ihsg = ihsgF.bars.map((b) => ({ date: b.date, close: b.close }));

  const fetched = await mapLimit(codes, 4, async (code) => {
    const f = await fetchDailyBars(normalizeSymbol(code), '5y', true).catch(() => null);
    return f && f.bars.length > 260 ? ({ code, bars: f.bars.map((b) => ({ date: b.date, close: b.close, volume: b.volume })) } as MlSeries) : null;
  });
  const series = fetched.filter((s): s is MlSeries => s !== null);
  if (series.length < 30) return null;

  const { rows } = buildDataset(series, ihsg, HORIZON, STEP);
  const evaluation = await walkForward(rows, HORIZON, STEP);
  const scored = await scoreLatest(rows);
  if (!scored) return null;

  const snap: MlSnapshot = {
    date: scored.date,
    trainedAt: new Date().toISOString(),
    horizon: HORIZON,
    nStocks: series.length,
    nTrain: scored.nTrain,
    ms: Date.now() - t0,
    evaluation,
    importance: scored.importance,
    scores: scored.scores
  };
  await saveMlSnapshot(snap);
  return snap;
}

/** Train once at a time; concurrent callers share the in-flight run. */
export function trainAndStoreMl(codes: string[]): Promise<MlSnapshot | null> {
  if (!running) {
    running = run(codes).catch((err) => {
      console.error('ML training failed:', err);
      return null;
    }).finally(() => { running = null; });
  }
  return running;
}
