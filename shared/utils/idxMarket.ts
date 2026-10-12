// IDX trading rules that decide whether a trade could really be done, and at
// what cost. Pure functions shared by the backtest (server) and the trading
// simulation (browser); prices are in rupiah, 1 lot = 100 shares.

/** One trading session (daily bar). */
export interface SessionBar { date: string; open: number; high: number; low: number; close: number }

/** Minimum price increment (fraksi harga). */
export function tickSize(price: number): number {
  if (price < 200) return 1;
  if (price < 500) return 2;
  if (price < 2000) return 5;
  if (price < 5000) return 10;
  return 25;
}

/** Upper auto-reject (ARA) as a fraction of the previous close. */
export function araPct(prevClose: number): number {
  return prevClose <= 200 ? 0.35 : prevClose <= 5000 ? 0.25 : 0.2;
}

/**
 * Lower auto-reject (ARB) regimes announced by BEI. `null` = symmetric with
 * ARA. Lock detection below also requires a no-range session, so a regime
 * that is slightly off still flags real limit-down locks.
 */
const ARB_REGIMES: { from: string; pct: number | null }[] = [
  { from: '2020-03-10', pct: 0.07 }, // pandemi: ARB 7%
  { from: '2023-06-05', pct: 0.15 }, // normalisasi tahap I
  { from: '2023-09-04', pct: null }, // tahap II: simetris
  { from: '2025-04-08', pct: 0.15 }  // gejolak April 2025: ARB 15% (perbarui bila BEI kembali simetris)
];

/** Lower auto-reject (ARB) as a fraction of the previous close, on `date` (YYYY-MM-DD). */
export function arbPct(prevClose: number, date: string): number {
  let pct: number | null = null;
  for (const r of ARB_REGIMES) if (date >= r.from) pct = r.pct;
  return pct ?? araPct(prevClose);
}

/** Half the minimum tick, as a fraction of price: the least spread a trade crosses. */
export function halfSpread(price: number): number {
  return price > 0 ? tickSize(price) / price / 2 : 0;
}

/**
 * A buy at this session's open (or close) would not fill: the price sat at the
 * upper auto-reject limit, where only buyers queue.
 */
export function buyBlocked(bar: SessionBar, prevClose: number, atOpen: boolean): boolean {
  if (!(prevClose > 0)) return false;
  const limit = prevClose * (1 + araPct(prevClose)) - tickSize(prevClose);
  return atOpen ? bar.open >= limit : bar.close >= limit && bar.high - bar.close <= tickSize(prevClose);
}

/**
 * Locked at the lower auto-reject limit the whole session (no range): only
 * sellers queue, so a sell would not fill that day.
 */
export function sellBlocked(bar: SessionBar, prevClose: number): boolean {
  if (!(prevClose > 0)) return false;
  const t = tickSize(prevClose);
  return bar.high - bar.low <= t && bar.close <= prevClose * (1 - arbPct(prevClose, bar.date)) + t;
}

/** Typical online-broker fees: buy 0.15%, sell 0.25% (includes the 0.1% final income tax). */
export const IDX_FEES = { buyPct: 0.15, sellPct: 0.25 };

/** Cash needed to buy `shares` at `price`: value + half-tick spread + buy fee. */
export function buyCost(price: number, shares: number): { total: number; costs: number } {
  const value = price * shares;
  const total = value * (1 + halfSpread(price)) * (1 + IDX_FEES.buyPct / 100);
  return { total, costs: total - value };
}

/** Cash received for selling `shares` at `price`: value − half-tick spread − sell fee. */
export function sellProceeds(price: number, shares: number): { net: number; costs: number } {
  const value = price * shares;
  const net = value * (1 - halfSpread(price)) * (1 - IDX_FEES.sellPct / 100);
  return { net, costs: value - net };
}

/** Whole lots that `budget` can buy at `price`, costs included. */
export function maxLots(budget: number, price: number): number {
  if (!(price > 0) || !(budget > 0)) return 0;
  const perLot = buyCost(price, 100).total;
  return Math.max(0, Math.floor(budget / perLot + 1e-9));
}

/**
 * Why an order at this session's close would not fill, or null when it can.
 * `bar` null = the stock did not trade that day (suspension / no transaction).
 */
export function tradeBlockReason(side: 'buy' | 'sell', bar: SessionBar | null, prevClose: number | null): string | null {
  if (!bar) return 'tidak ada perdagangan hari ini (suspensi / tanpa transaksi)';
  if (prevClose == null) return null;
  if (side === 'buy' && buyBlocked(bar, prevClose, false)) return 'ditutup di ARA — antrean beli menumpuk, tidak ada penjual';
  if (side === 'sell' && sellBlocked(bar, prevClose)) return 'terkunci di ARB sepanjang sesi — tidak ada pembeli';
  return null;
}
