// Cached fetch of exogenous series (IHSG, commodities, FX) for the forecaster.
// One Yahoo request per symbol per trading day, shared by /api/forecast and
// the /api/forecast-screen batch. A failed / empty fetch is NOT cached, and the
// forecaster simply runs without that driver.

import { fetchDailyBars } from './yahoo';
import { IHSG, driversFor, type ExoPoint } from './exogenous';
import type { ExoInput } from './forecast';
import { tradingDay } from './cacheKey';

const fetchExoSeriesCached = defineCachedFunction(async (symbol: string): Promise<ExoPoint[]> => {
  const f = await fetchDailyBars(symbol, '5y', false);
  const pts = f ? f.bars.map((b) => ({ date: b.date, close: b.close })) : [];
  if (pts.length < 100) throw new Error(`exo ${symbol}: no data`); // don't cache failures
  return pts;
}, {
  maxAge: 60 * 60 * 24,
  swr: true,
  name: 'exo-series',
  getKey: (symbol: string) => `${symbol}:${tradingDay()}`
});

async function fetchExoSeries(symbol: string): Promise<ExoPoint[]> {
  try {
    return await fetchExoSeriesCached(symbol);
  } catch {
    return [];
  }
}

/** IHSG + the commodity/FX drivers relevant to an IDX code. */
export async function loadExoFor(code: string): Promise<ExoInput> {
  const drivers = driversFor(code);
  const [ihsg, ...series] = await Promise.all([fetchExoSeries(IHSG.symbol), ...drivers.map((d) => fetchExoSeries(d.symbol))]);
  return { ihsg, drivers: drivers.map((driver, i) => ({ driver, points: series[i] || [] })) };
}
