// KSEI month-end ownership composition ("BalanceposEfek") — pure functions.
//
// KSEI publishes, for every listed security, the scripless shares held at
// month end by local and foreign investors, split by investor type:
//   IS insurance · CP corporate · PF pension fund · IB financial institution
//   ID individual · MF mutual fund · SC securities firm · FD foundation · OT other
// From it we derive ownership shifts (foreign / retail / local institutions)
// and test, honestly, whether they predicted next-month returns.
//
// Timing: the file for month m is published before the open of the first
// trading day of m+1, so a signal formed at the end of m is tradeable at the
// next open; the m → m+1 close-to-close return used here includes that one
// overnight gap.

import { spearman } from './mlRank';

export interface OwnershipRow {
  price: number;   // month-end close (unadjusted)
  shares: number;  // listed shares
  local: number;   // scripless shares held by local investors
  foreign: number; // … by foreign investors
  retail: number;  // local individuals (ID)
  inst: number;    // local mutual funds + insurance + pension funds + financial institutions (MF+IS+PF+IB)
}

export interface OwnershipMonth {
  date: string; // YYYY-MM-DD (month-end trading day)
  rows: Record<string, OwnershipRow>;
}

const MONTHS: Record<string, string> = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' };

/** "30-SEP-2026" → "2026-09-30" */
function parseDate(s: string): string | null {
  const m = /^(\d{1,2})-([A-Z]{3})-(\d{4})$/.exec(s.trim().toUpperCase());
  const mm = m ? MONTHS[m[2]!] : undefined;
  return m && mm ? `${m[3]}-${mm}-${m[1]!.padStart(2, '0')}` : null;
}

/** Parse a BalanceposEfek text file (pipe-delimited, header row). Equities only. */
export function parseBalancepos(text: string): OwnershipMonth | null {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return null;
  const head = lines[0]!.split('|').map((h) => h.trim());
  const col = (name: string) => head.indexOf(name);
  const iCode = col('Code');
  const iType = col('Type');
  const iShares = col('Sec. Num');
  const iPrice = col('Price');
  const iLocalTotal = head.indexOf('Total');
  const iForeignTotal = head.lastIndexOf('Total');
  const local = (t: string) => col(`Local ${t}`);
  const inst = ['MF', 'IS', 'PF', 'IB'].map(local);
  const iRetail = local('ID');
  if ([iCode, iType, iShares, iPrice, iRetail, ...inst].some((i) => i < 0) || iLocalTotal < 0 || iForeignTotal <= iLocalTotal) return null;

  let date: string | null = null;
  const rows: Record<string, OwnershipRow> = {};
  for (const line of lines.slice(1)) {
    const f = line.split('|');
    const code = f[iCode]?.trim() || '';
    if (f[iType]?.trim().toUpperCase() !== 'EQUITY' || !/^[A-Z]{4}$/.test(code)) continue;
    const num = (i: number) => Number(f[i]);
    const row: OwnershipRow = {
      price: num(iPrice),
      shares: num(iShares),
      local: num(iLocalTotal),
      foreign: num(iForeignTotal),
      retail: num(iRetail),
      inst: inst.reduce((s, i) => s + num(i), 0)
    };
    if (!Object.values(row).every((v) => Number.isFinite(v) && v >= 0)) continue;
    date ??= parseDate(f[0] || '');
    rows[code] = row;
  }
  return date && Object.keys(rows).length ? { date, rows } : null;
}

const held = (r: OwnershipRow) => r.local + r.foreign;
const pct = (part: number, r: OwnershipRow) => (held(r) > 0 ? (part / held(r)) * 100 : null);
export const foreignPct = (r: OwnershipRow) => pct(r.foreign, r);
export const retailPct = (r: OwnershipRow) => pct(r.retail, r);
export const instPct = (r: OwnershipRow) => pct(r.inst, r);

/** Share count roughly unchanged → no split/rights issue distorting % holdings or price. */
const stable = (a: OwnershipRow, b: OwnershipRow) => a.shares > 0 && Math.abs(b.shares / a.shares - 1) < 0.1;

function delta(now: OwnershipRow | undefined, then: OwnershipRow | undefined, f: (r: OwnershipRow) => number | null): number | null {
  if (!now || !then || !stable(then, now)) return null;
  const a = f(now);
  const b = f(then);
  return a != null && b != null ? a - b : null;
}

export interface OwnershipSignal {
  key: 'foreign1' | 'foreign3' | 'retail3' | 'inst3';
  label: string;
  /** Change (percentage points) of the holder group's share, over `lag` months. */
  lag: 1 | 3;
  of: (r: OwnershipRow) => number | null;
}

export const OWNERSHIP_SIGNALS: OwnershipSignal[] = [
  { key: 'foreign1', label: 'Δ kepemilikan asing 1 bln', lag: 1, of: foreignPct },
  { key: 'foreign3', label: 'Δ kepemilikan asing 3 bln', lag: 3, of: foreignPct },
  { key: 'retail3', label: 'Δ kepemilikan ritel lokal 3 bln', lag: 3, of: retailPct },
  { key: 'inst3', label: 'Δ institusi lokal (reksa dana, asuransi, dapen) 3 bln', lag: 3, of: instPct }
];

/** Investable at formation: priced above the 50 floor and market cap ≥ Rp500 miliar. */
const MIN_PRICE = 50;
const MIN_MCAP = 5e11;
const MIN_STOCKS = 30;
const investable = (r: OwnershipRow) => r.price >= MIN_PRICE && r.price * r.shares >= MIN_MCAP && held(r) > 0;

export interface SignalEvaluation {
  key: OwnershipSignal['key'];
  label: string;
  meanIC: number;      // mean monthly rank IC vs next-month return
  tStat: number;       // on non-overlapping months
  nMonths: number;
  hitPct: number;      // % of months with IC > 0
  spreadPct: number;   // mean next-month return, top − bottom quintile (%)
  significant: boolean; // |t| ≥ 2
}

export interface OwnershipEvaluation {
  from: string;
  to: string;
  avgStocks: number;
  signals: SignalEvaluation[];
}

/**
 * Walk month by month: signal at the end of m vs return m → m+1, across the
 * stocks investable at m. Months are disjoint, so the t-stat needs no overlap
 * correction. Stocks listed then delisted are in the files at the time
 * (no survivorship bias); a stock missing at m+1 is skipped.
 */
export function evaluateOwnership(months: OwnershipMonth[]): OwnershipEvaluation | null {
  const ms = [...months].sort((a, b) => (a.date < b.date ? -1 : 1));
  const per = new Map<string, { ics: number[]; spreads: number[] }>(OWNERSHIP_SIGNALS.map((s) => [s.key, { ics: [], spreads: [] }]));
  let used = 0;
  let stocks = 0;
  let from = '';
  let to = '';
  for (let m = 3; m + 1 < ms.length; m++) {
    const now = ms[m]!.rows;
    const next = ms[m + 1]!.rows;
    let monthUsed = false;
    for (const s of OWNERSHIP_SIGNALS) {
      const then = ms[m - s.lag]!.rows;
      const xs: number[] = [];
      const ys: number[] = [];
      for (const [code, r] of Object.entries(now)) {
        const n = next[code];
        if (!n || !investable(r) || !stable(r, n) || n.price <= 0) continue;
        const d = delta(r, then[code], s.of);
        if (d == null) continue;
        xs.push(d);
        ys.push(n.price / r.price - 1);
      }
      if (xs.length < MIN_STOCKS) continue;
      const ic = spearman(xs, ys);
      if (ic == null) continue;
      const order = xs.map((_, i) => i).sort((a, b) => xs[a]! - xs[b]!);
      const q = Math.max(1, Math.floor(order.length / 5));
      const mean = (idx: number[]) => idx.reduce((t, i) => t + ys[i]!, 0) / idx.length;
      const acc = per.get(s.key)!;
      acc.ics.push(ic);
      acc.spreads.push(mean(order.slice(-q)) - mean(order.slice(0, q)));
      if (!monthUsed) { monthUsed = true; used++; stocks += xs.length; from ||= ms[m]!.date; to = ms[m]!.date; }
    }
  }
  if (!used) return null;
  const signals = OWNERSHIP_SIGNALS.map((s) => {
    const { ics, spreads } = per.get(s.key)!;
    const n = ics.length;
    const meanIC = n ? ics.reduce((a, b) => a + b, 0) / n : 0;
    const sd = n > 1 ? Math.sqrt(ics.reduce((a, b) => a + (b - meanIC) ** 2, 0) / (n - 1)) : 0;
    const tStat = sd > 0 ? meanIC / (sd / Math.sqrt(n)) : 0;
    const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
    return {
      key: s.key,
      label: s.label,
      meanIC: round(meanIC, 3),
      tStat: round(tStat, 2),
      nMonths: n,
      hitPct: n ? Math.round((ics.filter((v) => v > 0).length / n) * 100) : 0,
      spreadPct: n ? round((spreads.reduce((a, b) => a + b, 0) / n) * 100, 2) : 0,
      significant: n >= 12 && Math.abs(tStat) >= 2
    };
  });
  return { from, to, avgStocks: Math.round(stocks / used), signals };
}

export interface OwnershipSnapshot {
  date: string;
  foreignPct: number | null;
  retailPct: number | null;
  instPct: number | null;
  dForeign1: number | null;
  dForeign3: number | null;
  dRetail3: number | null;
  dInst3: number | null;
}

/** Latest month's ownership and its 1/3-month shifts (pp), per code. */
export function latestOwnership(months: OwnershipMonth[]): Record<string, OwnershipSnapshot> {
  const ms = [...months].sort((a, b) => (a.date < b.date ? -1 : 1));
  const last = ms[ms.length - 1];
  if (!last) return {};
  const m1 = ms[ms.length - 2]?.rows || {};
  const m3 = ms[ms.length - 4]?.rows || {};
  const r2 = (v: number | null) => (v == null ? null : Math.round(v * 100) / 100);
  const out: Record<string, OwnershipSnapshot> = {};
  for (const [code, r] of Object.entries(last.rows)) {
    out[code] = {
      date: last.date,
      foreignPct: r2(foreignPct(r)),
      retailPct: r2(retailPct(r)),
      instPct: r2(instPct(r)),
      dForeign1: r2(delta(r, m1[code], foreignPct)),
      dForeign3: r2(delta(r, m3[code], foreignPct)),
      dRetail3: r2(delta(r, m3[code], retailPct)),
      dInst3: r2(delta(r, m3[code], instPct))
    };
  }
  return out;
}

export interface OwnershipPoint { date: string; price: number; foreignPct: number | null; retailPct: number | null; instPct: number | null }

/** Monthly ownership history for one code (oldest → newest). */
export function ownershipSeries(months: OwnershipMonth[], code: string, limit = 24): OwnershipPoint[] {
  return [...months]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .filter((m) => m.rows[code])
    .slice(-limit)
    .map((m) => {
      const r = m.rows[code]!;
      const r2 = (v: number | null) => (v == null ? null : Math.round(v * 100) / 100);
      return { date: m.date, price: r.price, foreignPct: r2(foreignPct(r)), retailPct: r2(retailPct(r)), instPct: r2(instPct(r)) };
    });
}

/** Candidate month-end trading days for a month, latest first (weekdays of the last 7 days). */
export function monthEndCandidates(year: number, month: number): string[] {
  const out: string[] = [];
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let d = last; d > last - 7; d--) {
    const dt = new Date(Date.UTC(year, month - 1, d));
    const wd = dt.getUTCDay();
    if (wd === 0 || wd === 6) continue;
    out.push(`${year}${String(month).padStart(2, '0')}${String(d).padStart(2, '0')}`);
  }
  return out;
}
