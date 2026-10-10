// Exogenous drivers for the forecaster: IHSG, commodities, USD/IDR.
// Pure helpers (no network) — fetching lives in server/api.
//
// Look-ahead rule: a feature for IDX session t may only use data published by
// the IDX close (16:00 WIB). IHSG closes together with the stock → same-day
// (lag 0). US/EU-listed futures and FX settle AFTER the IDX close → use the
// last close dated strictly BEFORE t (lag 1).

export interface ExoPoint { date: string; close: number }

export interface Driver {
  key: string;
  /** Yahoo symbol. Best-effort: when Yahoo has no data the driver is skipped. */
  symbol: string;
  label: string;
  lag: 0 | 1;
}

export const IHSG: Driver = { key: 'ihsg', symbol: '^JKSE', label: 'IHSG', lag: 0 };
export const USDIDR: Driver = { key: 'usdidr', symbol: 'IDR=X', label: 'USD/IDR', lag: 1 };

// Free daily proxies on Yahoo. Nickel and CPO have no free Yahoo futures:
// copper stands in for base metals, soybean oil for vegetable oils (CPO).
const COAL: Driver = { key: 'coal', symbol: 'MTF=F', label: 'Batubara (API2)', lag: 1 };
const GOLD: Driver = { key: 'gold', symbol: 'GC=F', label: 'Emas', lag: 1 };
const COPPER: Driver = { key: 'copper', symbol: 'HG=F', label: 'Tembaga (proksi logam/nikel)', lag: 1 };
const OIL: Driver = { key: 'oil', symbol: 'BZ=F', label: 'Minyak Brent', lag: 1 };
const GAS: Driver = { key: 'gas', symbol: 'NG=F', label: 'Gas alam', lag: 1 };
const VEGOIL: Driver = { key: 'vegoil', symbol: 'ZL=F', label: 'Minyak kedelai (proksi CPO)', lag: 1 };

const GROUPS: [Driver[], string[]][] = [
  [[COAL], ['ADRO', 'AADI', 'PTBA', 'ITMG', 'HRUM', 'INDY', 'BUMI', 'GEMS', 'BSSR', 'DOID', 'ADMR', 'KKGI', 'MBAP', 'TOBA', 'ABMM', 'DSSA', 'MCOL', 'RMKE', 'BYAN']],
  [[COPPER, GOLD], ['INCO', 'ANTM', 'MDKA', 'NCKL', 'MBMA', 'AMMN', 'TINS', 'NICL', 'HRTA', 'ARCI', 'BRMS', 'PSAB', 'ZINC']],
  [[OIL], ['MEDC', 'ENRG', 'ELSA', 'AKRA', 'RAJA', 'SURE', 'ESSA']],
  [[GAS, OIL], ['PGAS']],
  [[VEGOIL], ['AALI', 'LSIP', 'SIMP', 'SSMS', 'TAPG', 'DSNG', 'TBLA', 'SGRO', 'BWPT', 'PALM', 'STAA', 'NSSS', 'CSRA', 'ANJT']]
];

const BY_CODE = new Map<string, Driver[]>();
for (const [drivers, codes] of GROUPS) for (const c of codes) BY_CODE.set(c, drivers);

/** Commodity drivers relevant to an IDX code (without .JK). USD/IDR is added for every stock. */
export function driversFor(code: string): Driver[] {
  const c = code.toUpperCase().replace(/\.JK$/, '');
  return [...(BY_CODE.get(c) || []), USDIDR];
}

/**
 * Log returns of an exogenous series aligned to the stock's trading dates.
 * The level used at stock date d is the last exogenous close dated <= d
 * (lag 0) or < d (lag 1), forward-filled over holidays; out[t] =
 * ln(level[t] / level[t-1]). null where no level is known yet.
 */
export function alignExoReturns(stockDates: string[], series: ExoPoint[], lag: 0 | 1): (number | null)[] {
  const s = series.filter((p) => p.close > 0).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const level: (number | null)[] = new Array(stockDates.length).fill(null);
  let j = -1;
  for (let t = 0; t < stockDates.length; t++) {
    const d = stockDates[t]!;
    while (j + 1 < s.length && (lag === 0 ? s[j + 1]!.date <= d : s[j + 1]!.date < d)) j++;
    level[t] = j >= 0 ? s[j]!.close : null;
  }
  return level.map((v, t) => {
    const prev = t > 0 ? level[t - 1] : null;
    return v != null && prev != null ? Math.log(v / prev) : null;
  });
}
