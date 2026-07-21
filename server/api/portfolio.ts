import { getMethod, readBody, createError } from 'h3';
import { requireAppToken } from '../utils/auth';
import { normalizeSymbol } from '../utils/symbol';
import { fetchDailyBars, type DailyBar } from '../utils/yahoo';
import { getPortfolio, setPortfolio, type Holding } from '../utils/store';
import { analyzePortfolio } from '../utils/portfolio';

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) || 1 }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx]!);
    }
  });
  await Promise.all(workers);
  return results;
}

// Personal portfolio (token-gated). GET returns holdings + valuation +
// correlation + risk; POST upserts a holding; DELETE removes one.
export default defineEventHandler(async (event) => {
  requireAppToken(event);
  const method = getMethod(event);

  if (method === 'POST') {
    const body = await readBody<{ symbol?: string; lots?: number; avgPrice?: number }>(event);
    const symbol = normalizeSymbol((body?.symbol || '').toUpperCase());
    const lots = Number(body?.lots);
    const avgPrice = Number(body?.avgPrice);
    if (!symbol || symbol.startsWith('^') || !isFinite(lots) || lots <= 0 || !isFinite(avgPrice) || avgPrice <= 0) {
      throw createError({ statusCode: 400, statusMessage: 'Data holding tidak valid (symbol, lots>0, avgPrice>0).' });
    }
    const holdings = await getPortfolio();
    const idx = holdings.findIndex((h) => h.symbol === symbol);
    const entry: Holding = { symbol, lots, avgPrice, date: new Date().toISOString().split('T')[0] };
    if (idx >= 0) holdings[idx] = entry; else holdings.push(entry);
    await setPortfolio(holdings);
    return { ok: true };
  }

  if (method === 'DELETE') {
    const body = await readBody<{ symbol?: string }>(event);
    const symbol = normalizeSymbol((body?.symbol || '').toUpperCase());
    const holdings = (await getPortfolio()).filter((h) => h.symbol !== symbol);
    await setPortfolio(holdings);
    return { ok: true };
  }

  // GET → valuation + risk
  const holdings = await getPortfolio();
  if (!holdings.length) {
    return { holdings: [], analysis: null };
  }

  const barsBySymbol = new Map<string, DailyBar[]>();
  await mapWithConcurrency(holdings, 6, async (h) => {
    const f = await fetchDailyBars(h.symbol, '1y', false);
    if (f && f.bars.length) barsBySymbol.set(h.symbol, f.bars);
  });
  const ihsg = await fetchDailyBars('^JKSE', '1y', false);

  const analysis = analyzePortfolio(holdings, barsBySymbol, ihsg?.bars || []);
  return { holdings, analysis };
});
