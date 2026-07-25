import { getQuery, defineEventHandler, createError } from 'h3';
import { regressionDataset, FEATURE_LABELS, asOfKey, type RegressionObs } from '../../utils/asof';
import { ols, type RegressionResult } from '../../utils/regression';
import { SCREENING_UNIVERSE } from '../../utils/universe';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface SimRegressionResponse {
  date: string;
  horizonDays: number;
  n: number;
  regression: RegressionResult | null;
  meanForwardReturnPct: number;
  byRating: { rating: string; n: number; avgReturnPct: number }[];
}

// Regress realized forward return (over horizonDays) on as-of features across
// the universe → which factors drove up/down. Cached per (date, horizon, codes).
const cachedDataset = defineCachedFunction(
  async (date: string, horizon: number, codes: string[]): Promise<RegressionObs[]> =>
    regressionDataset(date, horizon, codes),
  {
    maxAge: 60 * 60 * 24 * 30,
    swr: true,
    name: 'sim-regression-ds',
    getKey: (date: string, horizon: number, codes: string[]) => `${asOfKey(date, codes)}:${horizon}`
  }
);

export default defineEventHandler(async (event): Promise<SimRegressionResponse> => {
  const query = getQuery(event);
  const date = (query.date as string) || '';
  if (!DATE_RE.test(date)) throw createError({ statusCode: 400, statusMessage: 'date wajib YYYY-MM-DD' });
  const horizon = Math.max(2, Math.min(250, parseInt((query.horizon as string) || '20', 10) || 20));

  const symbolsParam = (query.symbols as string) || '';
  const codes = symbolsParam
    ? symbolsParam.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
    : SCREENING_UNIVERSE;

  const ds = await cachedDataset(date, horizon, codes);
  const regression = ols(ds.map((o) => o.features), ds.map((o) => o.forwardReturnPct), [...FEATURE_LABELS]);

  const meanForwardReturnPct = ds.length ? ds.reduce((s, o) => s + o.forwardReturnPct, 0) / ds.length : 0;

  const ratings = ['Kuat', 'Menarik', 'Netral', 'Lemah'];
  const byRating = ratings
    .map((rating) => {
      const g = ds.filter((o) => o.rating === rating);
      return { rating, n: g.length, avgReturnPct: g.length ? g.reduce((s, o) => s + o.forwardReturnPct, 0) / g.length : 0 };
    })
    .filter((g) => g.n > 0);

  return { date, horizonDays: horizon, n: ds.length, regression, meanForwardReturnPct, byRating };
});
