// Stockbit bandarmology data — personal-use integration (proof of concept).
//
// WHY: Stockbit's `exodus` API serves the same broker/bandar data that paid
// wrappers (e.g. Zenith) resell — but as plaintext JSON. As a Stockbit
// brokerage customer you may read your own account's market data for personal
// analysis. Access is deliberately GENTLE: on-demand only, cached per symbol
// (see server/api/bandar.ts) so we never hammer Stockbit.
//
// AUTH: supply your Stockbit access token (Bearer JWT) via STOCKBIT_TOKEN.
// Grab it from your browser while logged in to stockbit.com:
//   DevTools → Network → any exodus.stockbit.com request → Request Headers →
//   copy the value after `authorization: Bearer ` (or Application → Local Storage).
// Put it in `.env` (already gitignored):  STOCKBIT_TOKEN=eyJ...
// The token expires periodically — refresh it when calls start returning 401.
// NEVER commit the token.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { tradingDay } from './cacheKey';

const STOCKBIT_API = 'https://exodus.stockbit.com';
const DATA_DIR = process.env.DATA_STORE_DIR || './.data-store';
const CACHE_DIR = path.join(DATA_DIR, 'bandar');
const TOKEN_FILE = path.join(DATA_DIR, 'stockbit-token.json'); // pushed by the browser extension

// Period presets the Stockbit endpoints actually accept (probed live). Same
// range, different enum prefix per panel. Only these three are valid upstream.
export type BandarPeriod = '1d' | '1w' | '1m' | '3m' | '1y' | 'custom';
const PERIOD_ENUM: Record<string, { md: string; tb: string; rt: string }> = {
  '1d': { md: 'BROKER_SUMMARY_PERIOD_LATEST', tb: 'TB_PERIOD_LAST_1_DAY', rt: 'RT_PERIOD_LAST_1_DAY' },
  '1m': { md: 'BROKER_SUMMARY_PERIOD_LAST_1_MONTH', tb: 'TB_PERIOD_LAST_1_MONTH', rt: 'RT_PERIOD_LAST_1_MONTH' },
  '1y': { md: 'BROKER_SUMMARY_PERIOD_LAST_1_YEAR', tb: 'TB_PERIOD_LAST_1_YEAR', rt: 'RT_PERIOD_LAST_1_YEAR' }
};
export const normPeriod = (p: string | undefined | null): BandarPeriod => {
  if (p === '1w' || p === '1m' || p === '3m' || p === '1y' || p === 'custom') return p;
  return '1d';
};

/** Helper to format Date to YYYY-MM-DD */
function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Compute default from/to dates for relative period presets if needed */
export function resolveDateRange(period: string, from?: string, to?: string): { from?: string; to?: string; isCustom: boolean } {
  if (from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return { from, to, isCustom: true };
  }
  const today = new Date();
  if (period === '1w') {
    const past = new Date(today);
    past.setDate(past.getDate() - 7);
    return { from: formatDate(past), to: formatDate(today), isCustom: true };
  }
  if (period === '3m') {
    const past = new Date(today);
    past.setMonth(past.getMonth() - 3);
    return { from: formatDate(past), to: formatDate(today), isCustom: true };
  }
  return { isCustom: false };
}

const normalizeToken = (t: string | null | undefined): string | null => {
  const s = (t || '').trim().replace(/^Bearer\s+/i, '');
  return s || null;
};

/**
 * The freshest Stockbit bearer token. Prefers the token pushed by the browser
 * extension (.data-store/stockbit-token.json) — kept up to date automatically as
 * you browse Stockbit — and falls back to the STOCKBIT_TOKEN env (set at deploy).
 */
export async function getStockbitToken(): Promise<string | null> {
  try {
    const j = JSON.parse(await fs.readFile(TOKEN_FILE, 'utf-8'));
    const fromFile = normalizeToken(j?.token);
    if (fromFile) return fromFile;
  } catch {
    // no pushed token yet → fall back to env
  }
  return normalizeToken(process.env.STOCKBIT_TOKEN);
}

/** Persist a token pushed by the extension (atomic write). */
export async function saveStockbitToken(token: string): Promise<{ updatedAt: string }> {
  const clean = normalizeToken(token);
  if (!clean) throw new Error('empty token');
  await fs.mkdir(DATA_DIR, { recursive: true });
  const updatedAt = new Date().toISOString();
  const tmp = `${TOKEN_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify({ token: clean, updatedAt }), 'utf-8');
  await fs.rename(tmp, TOKEN_FILE);
  return { updatedAt };
}

/** Metadata about the stored token (never leaks the secret) — for a UI status chip. */
export async function stockbitTokenStatus(): Promise<{ hasToken: boolean; source: 'extension' | 'env' | 'none'; updatedAt: string | null }> {
  try {
    const j = JSON.parse(await fs.readFile(TOKEN_FILE, 'utf-8'));
    if (normalizeToken(j?.token)) return { hasToken: true, source: 'extension', updatedAt: j.updatedAt ?? null };
  } catch {
    // fall through to env
  }
  if (normalizeToken(process.env.STOCKBIT_TOKEN)) return { hasToken: true, source: 'env', updatedAt: null };
  return { hasToken: false, source: 'none', updatedAt: null };
}

/** Stockbit uses the bare IDX code (BBCA), not Yahoo's BBCA.JK. */
export function stockbitSymbol(raw: string | undefined | null): string {
  return (raw || 'BBCA').toUpperCase().trim().replace(/\.JK$/i, '').replace(/^\^/, '');
}

const stockbitHeaders = (token: string) => ({
  authorization: `Bearer ${token}`,
  accept: 'application/json, text/plain, */*',
  origin: 'https://stockbit.com',
  referer: 'https://stockbit.com/',
  'x-platform': 'web',
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36'
});

// ---- Clean shape our app consumes ----
export interface BandarBroker {
  code: string;      // broker code, e.g. 'BK'
  type: string;      // 'Asing' | 'Lokal' | 'Pemerintah' | ...
  lot: number;       // net lot (buyers > 0, sellers < 0)
  value: number;     // net value in IDR (buyers > 0, sellers < 0)
  avgPrice: number;  // volume-weighted average price
  freq: number;      // number of trades
}

export interface BandarDetector {
  symbol: string;
  from: string;         // period start (YYYY-MM-DD)
  to: string;           // period end
  accdist: string;      // overall broker accum/dist label, e.g. 'Dist'
  avgAccdist: string;   // avg classification, e.g. 'Big Dist'
  netValue: number;     // net value (IDR): + = accumulation, - = distribution
  netVolume: number;    // net volume
  netPercent: number;   // net % of value
  totalBuyer: number;
  totalSeller: number;
  totalValue: number;
  totalVolume: number;
  brokersBuy: BandarBroker[];   // net buyers
  brokersSell: BandarBroker[];  // net sellers
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Pure transform: raw Stockbit `/marketdetectors` payload → clean BandarDetector.
 * Exported (and side-effect free) so it can be unit-tested against captured
 * responses without any network/token.
 */
export function parseBandarDetector(raw: any): BandarDetector | null {
  const d = raw?.data;
  if (!d || !d.bandar_detector) return null;
  const bd = d.bandar_detector;
  const bs = d.broker_summary || {};

  const brokersBuy: BandarBroker[] = (bs.brokers_buy || []).map((b: any) => ({
    code: b.netbs_broker_code ?? '',
    type: b.type ?? '',
    lot: num(b.blot),
    value: num(b.bval),
    avgPrice: num(b.netbs_buy_avg_price),
    freq: num(b.freq)
  }));
  const brokersSell: BandarBroker[] = (bs.brokers_sell || []).map((b: any) => ({
    code: b.netbs_broker_code ?? '',
    type: b.type ?? '',
    lot: num(b.slot),
    value: num(b.sval),
    avgPrice: num(b.netbs_sell_avg_price),
    freq: num(b.freq)
  }));

  return {
    symbol: bs.symbol ?? '',
    from: d.from ?? '',
    to: d.to ?? '',
    accdist: bd.broker_accdist ?? '',
    avgAccdist: bd.avg?.accdist ?? '',
    netValue: num(bd.avg?.amount),
    netVolume: num(bd.avg?.vol),
    netPercent: num(bd.avg?.percent),
    totalBuyer: num(bd.total_buyer),
    totalSeller: num(bd.total_seller),
    totalValue: num(bd.value),
    totalVolume: num(bd.volume),
    brokersBuy,
    brokersSell
  };
}

async function readLatestAnyCache<T>(dirName: string, keyPrefix: string): Promise<T | null> {
  try {
    const targetDir = dirName === 'bandar' ? CACHE_DIR : path.join(DATA_DIR, dirName);
    const files = await fs.readdir(targetDir);
    const matching = files.filter((f) => f.startsWith(`${keyPrefix}-`) && f.endsWith('.json'));
    if (!matching.length) return null;

    // Sort descending by filename or mtime to get the freshest cache available
    matching.sort().reverse();
    const latestFile = matching[0];
    const txt = await fs.readFile(path.join(targetDir, latestFile), 'utf-8');
    const data = JSON.parse(txt) as any;
    if (data && typeof data === 'object') {
      data.isStale = true;
    }
    return data as T;
  } catch {
    return null;
  }
}

/**
 * Get the bandar detector for one symbol, cached PER TRADING DAY on disk.
 * Flow: today's cache file → hit? return it (no network). Miss → fetch from
 * Stockbit, save to disk immediately, return. If live fetch fails (token expired),
 * falls back to the most recent cached data available on disk.
 */
export async function fetchBandarDetector(rawSymbol: string, period: string = '1d', fromStr?: string, toStr?: string): Promise<BandarDetector | null> {
  const symbol = stockbitSymbol(rawSymbol);
  const p = normPeriod(period);
  const range = resolveDateRange(p, fromStr, toStr);
  const day = tradingDay();
  const key = range.isCustom ? `${symbol}-range_${range.from}_${range.to}` : `${symbol}-${p}`;

  // 1) Per-day disk cache — saved on first open, reused for the rest of the day.
  const cached = await readBandarCache(key, day);
  if (cached) return cached;

  // 2) Cache miss → fetch from Stockbit (needs a valid token).
  const token = await getStockbitToken();
  if (!token) {
    console.error('[stockbit] no token — cannot fetch live bandar detector, trying stale cache fallback');
    return readLatestAnyCache<BandarDetector>('bandar', key);
  }
  let url = `${STOCKBIT_API}/marketdetectors/${encodeURIComponent(symbol)}?transaction_type=TRANSACTION_TYPE_NET&market_board=MARKET_BOARD_REGULER&investor_type=INVESTOR_TYPE_ALL&limit=25`;
  if (range.isCustom && range.from && range.to) {
    url += `&from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;
  } else {
    const enumVal = PERIOD_ENUM[p]?.md || PERIOD_ENUM['1d'].md;
    url += `&period=${enumVal}`;
  }
  try {
    const raw = await $fetch<any>(url, { headers: stockbitHeaders(token) });
    const parsed = parseBandarDetector(raw);
    if (parsed) await writeBandarCache(key, day, parsed); // 3) save to disk immediately
    return parsed;
  } catch (err: any) {
    console.error(`[stockbit] bandar fetch failed for ${symbol}:`, err?.status || err?.message || err);
    // Fall back to freshest cached data if live fetch failed
    return readLatestAnyCache<BandarDetector>('bandar', key);
  }
}

// ================= Generic fetch + per-day cache (for extra broker panels) ==========
// Same day-cache idiom, generalized so each Stockbit dataset lives in its own
// .data-store/<kind>/SYMBOL-YYYY-MM-DD.json.
async function readDayCache<T>(kind: string, symbol: string, day: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(DATA_DIR, kind, `${symbol}-${day}.json`), 'utf-8')) as T;
  } catch {
    return null;
  }
}
async function writeDayCache(kind: string, symbol: string, day: string, data: unknown): Promise<void> {
  try {
    const dir = path.join(DATA_DIR, kind);
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, `${symbol}-${day}.json`);
    const tmp = `${file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data), 'utf-8');
    await fs.rename(tmp, file);
  } catch (err) {
    console.error('[stockbit] cache write failed:', err);
  }
}
/** Authenticated GET to the Stockbit API → parsed JSON, or null on any failure. */
async function stockbitGet(apiPath: string): Promise<any | null> {
  const token = await getStockbitToken();
  if (!token) {
    console.error('[stockbit] no token — set STOCKBIT_TOKEN or push via the extension');
    return null;
  }
  try {
    return await $fetch<any>(`${STOCKBIT_API}${apiPath}`, { headers: stockbitHeaders(token) });
  } catch (err: any) {
    console.error('[stockbit] GET failed', apiPath, err?.status || err?.message || err);
    return null;
  }
}
async function fetchCached<T>(
  kind: string,
  rawSymbol: string,
  period: string,
  buildPath: (symbol: string, period: string, range: { from?: string; to?: string; isCustom: boolean }) => string,
  parse: (raw: any) => T | null,
  fromStr?: string,
  toStr?: string
): Promise<T | null> {
  const symbol = stockbitSymbol(rawSymbol);
  const p = normPeriod(period);
  const range = resolveDateRange(p, fromStr, toStr);
  const day = tradingDay();
  const key = range.isCustom ? `${symbol}-range_${range.from}_${range.to}` : `${symbol}-${p}`;

  const cached = await readDayCache<T>(kind, key, day);
  if (cached) return cached;
  const raw = await stockbitGet(buildPath(symbol, p, range));
  if (!raw) {
    return readLatestAnyCache<T>(kind, key);
  }
  const parsed = parse(raw);
  if (parsed) {
    await writeDayCache(kind, key, day, parsed);
    return parsed;
  }
  return readLatestAnyCache<T>(kind, key);
}

// ---- Panel: intraday Broker Flow (per-broker cumulative net value + price) ----
export interface BrokerFlow {
  from: string;
  to: string;
  times: string[];                               // intraday time labels (09:00 …)
  price: (number | null)[];                      // price aligned to times
  brokers: { code: string; values: (number | null)[] }[]; // cumulative net value
}
export function parseBrokerFlow(raw: any): BrokerFlow | null {
  const d = raw?.data;
  if (!d || !Array.isArray(d.price_chart_data)) return null;
  const times = d.price_chart_data.map((p: any) => p?.datetime_label || p?.time || '');
  const price = d.price_chart_data.map((p: any) => num(p?.value?.raw));
  const bundle =
    (d.broker_chart_data || []).find((b: any) => b?.type === 'TYPE_CHART_VALUE') ||
    (d.broker_chart_data || [])[0];
  const brokers = (bundle?.charts || []).map((c: any) => ({
    code: c?.broker_code || '',
    values: (c?.chart || []).map((pt: any) => num(pt?.value?.raw))
  }));
  return { from: d.from ?? '', to: d.to ?? '', times, price, brokers };
}
export function fetchBrokerFlow(rawSymbol: string, period: string = '1d', fromStr?: string, toStr?: string): Promise<BrokerFlow | null> {
  return fetchCached(
    'broker-flow',
    rawSymbol,
    period,
    (s, p, range) => {
      let base = `/order-trade/running-trade/chart/${encodeURIComponent(s)}?investor_type=INVESTOR_TYPE_ALL&market_board=BOARD_TYPE_REGULAR`;
      if (range.isCustom && range.from && range.to) {
        return `${base}&from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;
      }
      const enumVal = PERIOD_ENUM[p]?.rt || PERIOD_ENUM['1d'].rt;
      return `${base}&period=${enumVal}`;
    },
    parseBrokerFlow,
    fromStr,
    toStr
  );
}

// ---- Panel: Broker Distribution (who distributed to whom → Sankey) ----
export interface BrokerDistLink { from: string; fromType: string; to: string; toType: string; value: number; }
export interface BrokerDistribution {
  date: string;
  buyers: { code: string; type: string; amount: number }[];
  sellers: { code: string; type: string; amount: number }[];
  links: BrokerDistLink[];
}
export function parseBrokerDistribution(raw: any): BrokerDistribution | null {
  const bv = raw?.data?.by_value;
  if (!bv || !Array.isArray(bv.top_broker_buy)) return null;
  const mapDetail = (arr: any[]) =>
    (arr || []).map((b: any) => ({ code: b?.detail?.code ?? '', type: b?.detail?.type ?? '', amount: num(b?.detail?.amount) }));
  const links: BrokerDistLink[] = [];
  for (const b of bv.top_broker_buy.slice(0, 8)) {
    const from = b?.detail?.code ?? '';
    const fromType = b?.detail?.type ?? '';
    for (const s of (b?.distribute_to || []).slice(0, 6)) {
      links.push({ from, fromType, to: s?.code ?? '', toType: s?.type ?? '', value: num(s?.amount) });
    }
  }
  return {
    date: raw?.data?.date_info ?? raw?.data?.start_date ?? '',
    buyers: mapDetail(bv.top_broker_buy),
    sellers: mapDetail(bv.top_broker_sell),
    links
  };
}
export function fetchBrokerDistribution(rawSymbol: string, period: string = '1d', fromStr?: string, toStr?: string): Promise<BrokerDistribution | null> {
  return fetchCached(
    'broker-dist',
    rawSymbol,
    period,
    (s, p, range) => {
      let base = `/order-trade/broker/distribution?date=&symbol=${encodeURIComponent(s)}&investor_type=INVESTOR_TYPE_ALL&market_board=MARKET_TYPE_REGULER&data_type=BROKER_DISTRIBUTION_DATA_TYPE_VALUE`;
      if (range.isCustom && range.from && range.to) {
        return `${base}&from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;
      }
      const enumVal = PERIOD_ENUM[p]?.tb || PERIOD_ENUM['1d'].tb;
      return `${base}&period=${enumVal}`;
    },
    parseBrokerDistribution,
    fromStr,
    toStr
  );
}
