// Piotroski F-Score (0–9) from annual financial statements — pure functions.
//
// Nine binary signals (Piotroski 2000), using the two most recent fiscal years
// (t, t-1) and total assets at the start of each year (t-1, t-2):
//   Profitability  1 ROA > 0            2 CFO > 0
//                  3 ΔROA > 0           4 CFO/assets > ROA (accruals)
//   Leverage/liq.  5 Δ(LT debt/assets) < 0   6 Δ current ratio > 0
//                  7 no new shares issued
//   Efficiency     8 Δ gross margin > 0      9 Δ asset turnover > 0
// A signal whose inputs are missing (or not meaningful, e.g. current ratio and
// gross margin for banks) is left null and the score is reported out of the
// signals that could be evaluated.

export interface AnnualFinancials {
  asOfDate: string;               // fiscal year end, YYYY-MM-DD
  netIncome: number | null;
  totalAssets: number | null;
  operatingCashFlow: number | null;
  longTermDebt: number | null;
  currentAssets: number | null;
  currentLiabilities: number | null;
  sharesIssued: number | null;
  grossProfit: number | null;
  totalRevenue: number | null;
}

export interface PiotroskiSignal {
  key: string;
  label: string;
  pass: boolean | null; // null = cannot be evaluated
}

export interface PiotroskiResult {
  score: number;      // signals passed
  max: number;        // signals evaluable (≤ 9)
  fiscalYear: string; // asOfDate of year t
  signals: PiotroskiSignal[];
}

/** Yahoo fundamentals-timeseries `type` names, in AnnualFinancials field order. */
export const TIMESERIES_TYPES: Record<keyof Omit<AnnualFinancials, 'asOfDate'>, string> = {
  netIncome: 'annualNetIncome',
  totalAssets: 'annualTotalAssets',
  operatingCashFlow: 'annualOperatingCashFlow',
  longTermDebt: 'annualLongTermDebt',
  currentAssets: 'annualCurrentAssets',
  currentLiabilities: 'annualCurrentLiabilities',
  sharesIssued: 'annualShareIssued',
  grossProfit: 'annualGrossProfit',
  totalRevenue: 'annualTotalRevenue'
};

/**
 * Alternative type names, used only where the primary type has no value.
 * IDX filers report cash flow with the direct method (PSAK 2), which Yahoo
 * stores under its own type — non-banks have no `annualOperatingCashFlow`.
 */
export const TIMESERIES_FALLBACK_TYPES: Partial<Record<keyof Omit<AnnualFinancials, 'asOfDate'>, string>> = {
  operatingCashFlow: 'annualCashFlowsfromusedinOperatingActivitiesDirect'
};

/** Every `type` to request from Yahoo (primary + fallback). */
export const TIMESERIES_QUERY_TYPES: string[] = [...Object.values(TIMESERIES_TYPES), ...Object.values(TIMESERIES_FALLBACK_TYPES)];

/**
 * Parse a Yahoo `ws/fundamentals-timeseries` response into one row per fiscal
 * year (oldest → newest). Unknown/missing values become null.
 */
export function parseTimeseries(json: any): AnnualFinancials[] {
  const results: any[] = json?.timeseries?.result || [];
  const byDate = new Map<string, AnnualFinancials>();
  const fallbacks: [AnnualFinancials, keyof AnnualFinancials, number][] = [];
  const fieldOf = new Map(Object.entries(TIMESERIES_TYPES).map(([field, type]) => [type, field as keyof AnnualFinancials]));
  const fallbackOf = new Map(Object.entries(TIMESERIES_FALLBACK_TYPES).map(([field, type]) => [type!, field as keyof AnnualFinancials]));
  for (const r of results) {
    const type: string | undefined = r?.meta?.type?.[0];
    const field = type ? fieldOf.get(type) ?? fallbackOf.get(type) : undefined;
    if (!type || !field) continue;
    const isFallback = !fieldOf.has(type);
    for (const pt of r[type] || []) {
      const date: string | undefined = pt?.asOfDate;
      const v = pt?.reportedValue?.raw;
      if (!date || typeof v !== 'number' || !isFinite(v)) continue;
      let row = byDate.get(date);
      if (!row) {
        row = {
          asOfDate: date, netIncome: null, totalAssets: null, operatingCashFlow: null, longTermDebt: null,
          currentAssets: null, currentLiabilities: null, sharesIssued: null, grossProfit: null, totalRevenue: null
        };
        byDate.set(date, row);
      }
      if (isFallback) fallbacks.push([row, field, v]);
      else (row as any)[field] = v;
    }
  }
  // Fallbacks fill only what the primary type left empty, whatever the response order.
  for (const [row, field, v] of fallbacks) if (row[field] == null) (row as any)[field] = v;
  return [...byDate.values()].sort((a, b) => (a.asOfDate < b.asOfDate ? -1 : 1));
}

const div = (a: number | null, b: number | null) => (a != null && b != null && b !== 0 ? a / b : null);
const gt = (a: number | null, b: number | null) => (a != null && b != null ? a > b : null);

/**
 * @param years   annual rows oldest → newest (needs ≥ 2; a 3rd improves Δ signals)
 * @param isBank  financials: skip current ratio & gross margin (not meaningful)
 */
export function computePiotroski(years: AnnualFinancials[], isBank = false): PiotroskiResult | null {
  if (years.length < 2) return null;
  const t = years[years.length - 1]!;
  const p = years[years.length - 2]!;
  const pp = years.length >= 3 ? years[years.length - 3]! : null;

  // Start-of-year assets; fall back to end-of-year when the earlier year is missing.
  const taT = p.totalAssets ?? t.totalAssets;
  const taP = pp?.totalAssets ?? p.totalAssets;

  const roaT = div(t.netIncome, taT);
  const roaP = div(p.netIncome, taP);
  const cfoT = div(t.operatingCashFlow, taT);
  const levT = t.longTermDebt != null ? div(t.longTermDebt, t.totalAssets) : t.totalAssets != null ? 0 : null;
  const levP = p.longTermDebt != null ? div(p.longTermDebt, p.totalAssets) : p.totalAssets != null ? 0 : null;
  const crT = div(t.currentAssets, t.currentLiabilities);
  const crP = div(p.currentAssets, p.currentLiabilities);
  const gmT = div(t.grossProfit, t.totalRevenue);
  const gmP = div(p.grossProfit, p.totalRevenue);
  const turnT = div(t.totalRevenue, taT);
  const turnP = div(p.totalRevenue, taP);

  const signals: PiotroskiSignal[] = [
    { key: 'roa', label: 'ROA positif', pass: roaT != null ? roaT > 0 : null },
    { key: 'cfo', label: 'Arus kas operasi positif', pass: t.operatingCashFlow != null ? t.operatingCashFlow > 0 : null },
    { key: 'droa', label: 'ROA membaik', pass: gt(roaT, roaP) },
    { key: 'accrual', label: 'Kas operasi > laba (kualitas laba)', pass: gt(cfoT, roaT) },
    { key: 'dlever', label: 'Rasio utang jangka panjang turun', pass: levT != null && levP != null ? levT < levP || (levT === 0 && levP === 0) : null },
    { key: 'dliquid', label: 'Current ratio naik', pass: isBank ? null : gt(crT, crP) },
    { key: 'noissue', label: 'Tidak menerbitkan saham baru', pass: t.sharesIssued != null && p.sharesIssued != null ? t.sharesIssued <= p.sharesIssued * 1.001 : null },
    { key: 'dmargin', label: 'Margin kotor naik', pass: isBank ? null : gt(gmT, gmP) },
    { key: 'dturn', label: 'Perputaran aset naik', pass: gt(turnT, turnP) }
  ];
  const evaluable = signals.filter((s) => s.pass != null);
  if (evaluable.length < 5) return null;
  return {
    score: evaluable.filter((s) => s.pass).length,
    max: evaluable.length,
    fiscalYear: t.asOfDate,
    signals
  };
}
