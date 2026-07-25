import { getQuery, defineEventHandler, createError } from 'h3';
import { screenAsOf, asOfKey, type AsOfRow } from '../../utils/asof';
import { SCREENING_UNIVERSE } from '../../utils/universe';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface SimScreenResponse {
  date: string;
  count: number;
  results: AsOfRow[];
}

// Point-in-time screening for the simulation "time machine". Given ?date=T,
// returns the screener exactly as it would have looked on T (no lookahead).
// Cached per (date, universe hash) — a past day never changes.
const cachedScreen = defineCachedFunction(
  async (date: string, codes: string[]): Promise<AsOfRow[]> => screenAsOf(date, codes),
  {
    maxAge: 60 * 60 * 24 * 30, // a historical day is immutable — cache long
    swr: true,
    name: 'sim-screen-asof',
    getKey: (date: string, codes: string[]) => asOfKey(date, codes)
  }
);

export default defineEventHandler(async (event): Promise<SimScreenResponse> => {
  const query = getQuery(event);
  const date = (query.date as string) || '';
  if (!DATE_RE.test(date)) {
    throw createError({ statusCode: 400, statusMessage: 'date wajib format YYYY-MM-DD' });
  }
  if (date >= new Date().toISOString().split('T')[0]!) {
    throw createError({ statusCode: 400, statusMessage: 'date harus di masa lalu' });
  }

  const symbolsParam = (query.symbols as string) || '';
  const codes = symbolsParam
    ? symbolsParam.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
    : SCREENING_UNIVERSE;

  const limit = Math.max(1, Math.min(200, parseInt((query.limit as string) || '60', 10) || 60));
  const all = await cachedScreen(date, codes);
  return { date, count: all.length, results: all.slice(0, limit) };
});
