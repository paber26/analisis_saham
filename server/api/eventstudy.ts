import { getQuery, createError } from 'h3';
import { normalizeSymbol } from '../utils/symbol';
import { fetchDailyBars, type DailyBar } from '../utils/yahoo';
import { runEventStudy, EVENT_SIGNALS, type EventSignal } from '../utils/eventStudy';
import { tradingDay } from '../utils/cacheKey';

// Liquid universe (same as backtest) — kept small so a cold run is fast.
const UNIVERSE = [
  'BBCA', 'BBRI', 'BMRI', 'BBNI', 'BRIS', 'TLKM', 'ISAT', 'EXCL', 'ASII', 'UNTR',
  'ADRO', 'PTBA', 'ITMG', 'INDY', 'UNVR', 'ICBP', 'INDF', 'MYOR', 'KLBF', 'CPIN',
  'JPFA', 'ANTM', 'INCO', 'MDKA', 'AMMN', 'SMGR', 'INTP', 'TPIA', 'BRPT', 'AKRA',
  'PGAS', 'TOWR', 'MTEL', 'GOTO', 'MAPI', 'ACES', 'ERAA', 'BSDE', 'PWON', 'SMRA',
  'CTRA', 'HMSP', 'GGRM', 'MEDC', 'HRUM',
];

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx]!);
    }
  });
  await Promise.all(workers);
  return results;
}

export default defineCachedEventHandler(async (event) => {
  const query = getQuery(event);
  const signal = (EVENT_SIGNALS as readonly string[]).includes(query.signal as string)
    ? (query.signal as EventSignal)
    : 'golden';

  const barsBySymbol = new Map<string, DailyBar[]>();
  await mapWithConcurrency(UNIVERSE, 8, async (code) => {
    const f = await fetchDailyBars(normalizeSymbol(code), '5y', false);
    if (f && f.bars.length > 260) barsBySymbol.set(code, f.bars);
  });
  if (barsBySymbol.size < 5) {
    throw createError({ statusCode: 503, statusMessage: 'Data event study belum cukup, coba lagi.' });
  }

  const result = runEventStudy(barsBySymbol, signal);
  if (!result) throw createError({ statusCode: 422, statusMessage: 'Event study gagal dihitung.' });

  return result;
}, {
  maxAge: 60 * 60 * 24,
  swr: true,
  name: 'eventstudy',
  getKey: (event) => `${getQuery(event).signal || 'golden'}:${tradingDay()}`,
});
