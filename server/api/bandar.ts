import { getQuery, createError } from 'h3';
import { fetchBandarDetector, stockbitSymbol } from '../utils/stockbit';
import { requireAppToken } from '../utils/auth';

// Expose Stockbit's "bandar detector" (broker accumulation/distribution + net
// buy/sell per broker) for one symbol.
//
// Caching lives in the util: fetchBandarDetector() reads/writes a PER-DAY file at
// .data-store/bandar/SYMBOL-YYYY-MM-DD.json — the first time you open a stock we
// fetch once from Stockbit and save it; the rest of the day is served from disk,
// zero repeat Stockbit calls. Survives restarts.
//
// OWNER-ONLY: this proxies the owner's PERSONAL Stockbit token, so on the public
// site it is gated by APP_TOKEN (x-app-token header / ?token=) — same gate as
// watchlist/portfolio. Prevents strangers from spending the token / risking the
// Stockbit account. The UI sends the token via authHeaders from useAppToken().
export default defineEventHandler(async (event) => {
  requireAppToken(event);
  const q = getQuery(event);
  const symbol = stockbitSymbol(q.symbol as string);
  const period = (q.period as string) || '1d';
  const from = (q.from as string) || undefined;
  const to = (q.to as string) || undefined;

  const data = await fetchBandarDetector(symbol, period, from, to);
  if (!data) {
    throw createError({
      statusCode: 502,
      statusMessage:
        'Gagal memuat data bandar dari Stockbit. Pastikan STOCKBIT_TOKEN sudah diisi di .env dan belum kedaluwarsa.'
    });
  }
  return { source: 'stockbit', ...data };
});
