export interface StockMonthlyData {
  year: number;
  month: number; // 1 to 12
  returnVal: number; // percentage, e.g. 5.4 for 5.4%
}

export interface StockData {
  code: string;
  name: string;
  history: StockMonthlyData[];
}

export type PeriodType = 'monthly' | 'quarterly' | 'yearly';

export interface SeasonalPeriodStats {
  periodLabel: string; // e.g. "Jan", "Feb" or "Q1", "Q2" or "2024"
  avgReturn: number; // Average percentage return
  winRate: number; // Percentage of positive return years (0 - 100)
  yearsUp: number; // Number of years where return was > 0
  yearsDown: number; // Number of years where return was <= 0
  maxReturn: number; // Maximum return percentage observed
  minReturn: number; // Minimum return percentage observed
  count: number; // Number of observations (years) behind this stat
  stdDev: number; // Sample standard deviation of returns
  tStat: number; // avg / (sd/sqrt(n)) — 0 when undefined
  significant: boolean; // |tStat| >= 2 with n >= 5 → pattern unlikely to be noise
}

export interface DashboardSummary {
  avgReturn: number;
  winRate: number;
  bestPeriod: { label: string; value: number } | null;
  worstPeriod: { label: string; value: number } | null;
  totalYears: number;
}

export interface HeatmapDataRow {
  year: number;
  periodLabel: string;
  returnVal: number;
}
