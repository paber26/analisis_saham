import { getQuery, createError } from 'h3';
import { requireAppToken } from '../utils/auth';
import {
  stockbitSymbol,
  fetchBandarDetector,
  fetchBrokerFlow,
  fetchBrokerDistribution
} from '../utils/stockbit';

// GET /api/broker-analysis?symbol=BBCA — the full Stockbit-style broker analysis
// in one call: summary (net buy/sell + accum/dist), intraday flow, and the
// distribution Sankey. Owner-only; each dataset is cached per trading day.
export default defineEventHandler(async (event) => {
  requireAppToken(event);
  const q = getQuery(event);
  const symbol = stockbitSymbol(q.symbol as string);
  const period = (q.period as string) || '1d';
  const from = (q.from as string) || undefined;
  const to = (q.to as string) || undefined;

  const [summary, flow, distribution] = await Promise.all([
    fetchBandarDetector(symbol, period, from, to),
    fetchBrokerFlow(symbol, period, from, to),
    fetchBrokerDistribution(symbol, period, from, to)
  ]);

  if (!summary && !flow && !distribution) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Gagal memuat data broker dari Stockbit. Pastikan token Stockbit masih valid.'
    });
  }

  return { symbol, period, from, to, source: 'stockbit', summary, flow, distribution };
});
