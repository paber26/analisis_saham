import type {
  StockData,
  StockMonthlyData,
  PeriodType,
  SeasonalPeriodStats,
  DashboardSummary,
  HeatmapDataRow
} from '../types/seasonal';

// Month labels in Indonesian
export const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'
];

export const QUARTER_LABELS = ['Q1', 'Q2', 'Q3', 'Q4'];

/**
 * Filter stock data by code and year range
 */
export function filterStockData(
  stocks: StockData[],
  code: string,
  startYear: number,
  endYear: number
): StockData | null {
  const stock = stocks.find(s => s.code === code);
  if (!stock) return null;

  return {
    code: stock.code,
    name: stock.name,
    history: stock.history.filter(h => h.year >= startYear && h.year <= endYear)
  };
}

/**
 * Get unique years in stock history
 */
export function getAvailableYears(stock: StockData): number[] {
  const years = stock.history.map(h => h.year);
  return Array.from(new Set(years)).sort((a, b) => a - b);
}

/**
 * Compound return calculation: (1 + r1/100) * (1 + r2/100) * ... - 1
 */
function compoundReturns(returns: number[]): number {
  if (returns.length === 0) return 0;
  const product = returns.reduce((acc, val) => acc * (1 + val / 100), 1);
  return Math.round((product - 1) * 100 * 100) / 100;
}

/**
 * Aggregate monthly returns into periods (monthly, quarterly, or yearly) per year
 */
export function aggregateDataByPeriod(
  history: StockMonthlyData[],
  periodType: PeriodType
): { year: number; periodLabel: string; returnVal: number }[] {
  const result: { year: number; periodLabel: string; returnVal: number }[] = [];

  // Group history by year
  const historyByYear: Record<number, StockMonthlyData[]> = {};
  history.forEach(item => {
    if (!historyByYear[item.year]) {
      historyByYear[item.year] = [];
    }
    historyByYear[item.year].push(item);
  });

  Object.entries(historyByYear).forEach(([yearStr, monthlyData]) => {
    const year = parseInt(yearStr);
    
    if (periodType === 'monthly') {
      // Return monthly as-is
      monthlyData.forEach(item => {
        if (item.month >= 1 && item.month <= 12) {
          result.push({
            year,
            periodLabel: MONTH_LABELS[item.month - 1],
            returnVal: item.returnVal
          });
        }
      });
    } else if (periodType === 'quarterly') {
      // Q1: Jan-Mar (months 1, 2, 3)
      // Q2: Apr-Jun (months 4, 5, 6)
      // Q3: Jul-Sep (months 7, 8, 9)
      // Q4: Oct-Dec (months 10, 11, 12)
      for (let q = 1; q <= 4; q++) {
        const monthsInQuarter = monthlyData.filter(
          item => item.month >= (q - 1) * 3 + 1 && item.month <= q * 3
        );
        if (monthsInQuarter.length > 0) {
          const qReturn = compoundReturns(monthsInQuarter.map(m => m.returnVal));
          result.push({
            year,
            periodLabel: QUARTER_LABELS[q - 1],
            returnVal: qReturn
          });
        }
      }
    } else if (periodType === 'yearly') {
      // Compound all 12 months
      if (monthlyData.length > 0) {
        const yReturn = compoundReturns(monthlyData.map(m => m.returnVal));
        result.push({
          year,
          periodLabel: 'Tahunan',
          returnVal: yReturn
        });
      }
    }
  });

  return result.sort((a, b) => a.year - b.year);
}

/**
 * Calculate seasonal statistics for each period
 */
export function calculateSeasonalStats(
  history: StockMonthlyData[],
  periodType: PeriodType
): SeasonalPeriodStats[] {
  const aggregated = aggregateDataByPeriod(history, periodType);
  const labels = periodType === 'monthly'
    ? MONTH_LABELS
    : periodType === 'quarterly'
      ? QUARTER_LABELS
      : ['Tahunan'];

  const stats: SeasonalPeriodStats[] = [];

  labels.forEach(label => {
    const periodValues = aggregated.filter(item => item.periodLabel === label);
    if (periodValues.length === 0) return;

    const returns = periodValues.map(item => item.returnVal);
    const sum = returns.reduce((acc, val) => acc + val, 0);
    const avgReturn = Math.round((sum / returns.length) * 100) / 100;
    
    const yearsUp = returns.filter(r => r > 0).length;
    const yearsDown = returns.filter(r => r <= 0).length;
    const winRate = Math.round((yearsUp / returns.length) * 100);

    const maxReturn = Math.max(...returns);
    const minReturn = Math.min(...returns);

    stats.push({
      periodLabel: label,
      avgReturn,
      winRate,
      yearsUp,
      yearsDown,
      maxReturn,
      minReturn
    });
  });

  return stats;
}

/**
 * Calculate Dashboard summary
 */
export function calculateDashboardSummary(
  stats: SeasonalPeriodStats[],
  history: StockMonthlyData[],
  periodType: PeriodType
): DashboardSummary {
  const uniqueYears = Array.from(new Set(history.map(h => h.year)));
  const totalYears = uniqueYears.length;

  if (stats.length === 0) {
    return {
      avgReturn: 0,
      winRate: 0,
      bestPeriod: null,
      worstPeriod: null,
      totalYears
    };
  }

  // Calculate overall average of period returns
  const totalPeriodsReturn = stats.reduce((acc, s) => acc + s.avgReturn, 0);
  const avgReturn = Math.round((totalPeriodsReturn / stats.length) * 100) / 100;

  // Calculate overall win rate (weighted by total up / total observations)
  const totalUp = stats.reduce((acc, s) => acc + s.yearsUp, 0);
  const totalDown = stats.reduce((acc, s) => acc + s.yearsDown, 0);
  const totalObs = totalUp + totalDown;
  const winRate = totalObs > 0 ? Math.round((totalUp / totalObs) * 100) : 0;

  // Find best and worst periods based on average return
  let bestPeriod = stats[0];
  let worstPeriod = stats[0];

  stats.forEach(s => {
    if (s.avgReturn > bestPeriod.avgReturn) {
      bestPeriod = s;
    }
    if (s.avgReturn < worstPeriod.avgReturn) {
      worstPeriod = s;
    }
  });

  return {
    avgReturn,
    winRate,
    bestPeriod: { label: bestPeriod.periodLabel, value: bestPeriod.avgReturn },
    worstPeriod: { label: worstPeriod.periodLabel, value: worstPeriod.avgReturn },
    totalYears
  };
}

/**
 * Generate automated insights in Indonesian
 */
export function generateInsights(
  stockCode: string,
  stockName: string,
  stats: SeasonalPeriodStats[],
  summary: DashboardSummary,
  history: StockMonthlyData[],
  periodType: PeriodType
): string[] {
  const insights: string[] = [];
  const periodTypeName = periodType === 'monthly' ? 'bulan' : periodType === 'quarterly' ? 'kuartal' : 'tahun';

  if (stats.length === 0) return insights;

  // 1. Best performing period insight
  if (summary.bestPeriod && summary.bestPeriod.value > 0) {
    const bestStat = stats.find(s => s.periodLabel === summary.bestPeriod?.label);
    if (bestStat) {
      insights.push(
        `Secara historis, ${periodTypeName} terbaik untuk saham <strong>${stockCode}</strong> adalah <strong>${summary.bestPeriod.label}</strong> dengan rata-rata kenaikan sebesar <strong>${summary.bestPeriod.value}%</strong> dan tingkat keberhasilan (Win Rate) mencapai <strong>${bestStat.winRate}%</strong>.`
      );
    }
  }

  // 2. Worst performing period insight
  if (summary.worstPeriod && summary.worstPeriod.value < 0) {
    const worstStat = stats.find(s => s.periodLabel === summary.worstPeriod?.label);
    if (worstStat) {
      insights.push(
        `Waspadai ${periodTypeName} <strong>${summary.worstPeriod.label}</strong> yang mencatatkan kinerja historis terendah dengan rata-rata return <strong>${summary.worstPeriod.value}%</strong> serta probabilitas turun sebesar <strong>${Math.round(100 - worstStat.winRate)}%</strong>.`
      );
    }
  }

  // 3. High Consistency Period (>75% win rate)
  const consistentUp = stats.filter(s => s.winRate >= 75);
  if (consistentUp.length > 0) {
    const periodNames = consistentUp.map(s => `<strong>${s.periodLabel}</strong> (${s.winRate}%)`).join(', ');
    insights.push(
      `Tingkat konsistensi kenaikan tertinggi (Win Rate &ge; 75%) terdapat pada periode: ${periodNames}. Ini menunjukkan kecenderungan musiman yang kuat di periode tersebut.`
    );
  }

  // 4. Extreme records
  const aggregatedData = aggregateDataByPeriod(history, periodType);
  if (aggregatedData.length > 0) {
    let highestSingle = aggregatedData[0];
    let lowestSingle = aggregatedData[0];

    aggregatedData.forEach(d => {
      if (d.returnVal > highestSingle.returnVal) highestSingle = d;
      if (d.returnVal < lowestSingle.returnVal) lowestSingle = d;
    });

    insights.push(
      `Return single-period tertinggi yang pernah dicatat adalah <strong>+${highestSingle.returnVal}%</strong> pada ${periodTypeName} <strong>${highestSingle.periodLabel} ${highestSingle.year}</strong>, sedangkan return terendah adalah <strong>${lowestSingle.returnVal}%</strong> pada ${periodTypeName} <strong>${lowestSingle.periodLabel} ${lowestSingle.year}</strong>.`
    );
  }

  // 5. Overall Stock character based on Win Rate
  if (summary.winRate > 55) {
    insights.push(
      `Dengan total <strong>${summary.totalYears} tahun</strong> data historis, saham <strong>${stockCode}</strong> memiliki bias musiman yang cenderung <strong>bullish</strong> (Win Rate global ${summary.winRate}%), membuatnya menarik untuk strategi rotasi sektor berbasis musiman.`
    );
  } else if (summary.winRate < 45) {
    insights.push(
      `Saham <strong>${stockCode}</strong> memiliki bias musiman yang cenderung <strong>bearish/konsolidasi</strong> (Win Rate global ${summary.winRate}%) dalam jangka panjang. Disarankan untuk lebih selektif dalam memilih momentum masuk.`
    );
  } else {
    insights.push(
      `Kinerja musiman saham <strong>${stockCode}</strong> cenderung seimbang (Win Rate global ${summary.winRate}%). Pergerakan harga lebih dipengaruhi oleh katalis fundamental spesifik dibanding pola musiman.`
    );
  }

  return insights;
}
