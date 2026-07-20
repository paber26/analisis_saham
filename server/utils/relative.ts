// Relative strength of a stock vs the IHSG index — "is it outperforming the
// market?". Computed as the difference of trailing returns over several windows.

export interface RelStrength {
  rs1m: number | null; // %
  rs3m: number | null;
  rs6m: number | null;
  outperform: boolean; // rs3m > 0
}

// Trailing return over the last `n` sessions.
function trailingReturn(closes: number[], n: number): number | null {
  const len = closes.length;
  if (len < n + 1) return null;
  const now = closes[len - 1]!;
  const past = closes[len - 1 - n]!;
  if (!past || past <= 0) return null;
  return now / past - 1;
}

function rsOver(stock: number[], ihsg: number[], n: number): number | null {
  const s = trailingReturn(stock, n);
  const i = trailingReturn(ihsg, n);
  if (s == null || i == null) return null;
  return Math.round((s - i) * 100 * 100) / 100;
}

export function relativeStrength(stockCloses: number[], ihsgCloses: number[]): RelStrength {
  const rs1m = rsOver(stockCloses, ihsgCloses, 21);
  const rs3m = rsOver(stockCloses, ihsgCloses, 63);
  const rs6m = rsOver(stockCloses, ihsgCloses, 126);
  return { rs1m, rs3m, rs6m, outperform: rs3m != null && rs3m > 0 };
}

// Lightweight 3-month RS only (used by the sync job per stock).
export function rs3mOnly(stockCloses: number[], ihsgCloses: number[]): number | null {
  return rsOver(stockCloses, ihsgCloses, 63);
}
