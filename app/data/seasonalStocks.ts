import type { StockData } from '../types/seasonal';

// Helper to generate monthly data with some seasonal biases
// December: usually positive (window dressing)
// May: often negative or low (sell in May)
// August/September: often weak
// Q1 (Jan/Feb): often positive (January effect)
function generateHistoricalData(
  startYear: number,
  endYear: number,
  baseReturn: number, // typical monthly return
  volatility: number, // standard deviation of returns
  seasonalBiases: Record<number, number> // month -> bias added to return
): { year: number; month: number; returnVal: number }[] {
  const history = [];
  // Use a simple pseudo-random generator with a seed to get consistent data
  let seed = 42;
  function random() {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  }

  for (let year = startYear; year <= endYear; year++) {
    for (let month = 1; month <= 12; month++) {
      // Box-Muller transform for normal distribution
      const u1 = random() || 0.0001;
      const u2 = random() || 0.0001;
      const randNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
      
      const bias = seasonalBiases[month] !== undefined ? seasonalBiases[month] : 0;
      
      // Calculate return percentage
      let returnVal = baseReturn + randNormal * volatility + bias;
      
      // Round to 2 decimal places
      returnVal = Math.round(returnVal * 100) / 100;
      
      history.push({
        year,
        month,
        returnVal
      });
    }
  }
  return history;
}

export const seasonalStocks: StockData[] = [
  {
    code: 'BBCA',
    name: 'PT Bank Central Asia Tbk',
    history: generateHistoricalData(2015, 2025, 0.8, 4.5, {
      1: 1.5,   // Jan: Strong (January Effect)
      2: 0.5,   // Feb: Neutral-positive
      3: 1.2,   // Mar: Positive
      4: 0.8,   // Apr: Moderate
      5: -1.8,  // May: Weak (Sell in May)
      6: 0.2,   // Jun: Flat
      7: 1.5,   // Jul: Positive
      8: -0.9,  // Aug: Moderate weak
      9: -1.2,  // Sep: Weak
      10: 1.1,  // Oct: Recovery
      11: -0.5, // Nov: Consolidation
      12: 3.8   // Dec: Very strong (Window dressing)
    })
  },
  {
    code: 'BBRI',
    name: 'PT Bank Rakyat Indonesia (Persero) Tbk',
    history: generateHistoricalData(2015, 2025, 0.6, 5.8, {
      1: 2.1,   // Jan: Very Strong
      2: 1.2,   // Feb: Strong
      3: -0.5,  // Mar: Profit taking
      4: 1.8,   // Apr: Dividend season
      5: -2.5,  // May: Sell in May
      6: -0.8,  // Jun: Consolidation
      7: 0.8,   // Jul: Moderate
      8: -1.5,  // Aug: Weak
      9: -0.5,  // Sep: Flat-weak
      10: 1.5,  // Oct: Positive
      11: 0.2,  // Nov: Flat
      12: 4.2   // Dec: Very strong (Window dressing)
    })
  },
  {
    code: 'TLKM',
    name: 'PT Telkom Indonesia (Persero) Tbk',
    history: generateHistoricalData(2015, 2025, 0.3, 5.0, {
      1: 1.0,   // Jan: Positive
      2: 1.8,   // Feb: Strong
      3: 1.5,   // Mar: Strong
      4: -0.8,  // Apr: Consolidation
      5: -1.2,  // May: Sell in May
      6: 1.4,   // Jun: Post-dividend recovery
      7: -0.5,  // Jul: Flat
      8: -2.1,  // Aug: Weak
      9: -0.8,  // Sep: Flat-weak
      10: 0.8,  // Oct: Moderate
      11: -1.5, // Nov: Weak
      12: 2.5   // Dec: Strong (Window dressing)
    })
  },
  {
    code: 'ASII',
    name: 'PT Astra International Tbk',
    history: generateHistoricalData(2015, 2025, 0.2, 5.5, {
      1: -0.8,  // Jan: Weak
      2: 0.5,   // Feb: Flat
      3: 2.5,   // Mar: Strong (Dividend expectation)
      4: 3.0,   // Apr: Strong (Dividend payout)
      5: -3.2,  // May: Very weak
      6: 0.5,   // Jun: Flat
      7: -0.2,  // Jul: Flat
      8: -1.0,  // Aug: Weak
      9: -1.5,  // Sep: Weak
      10: 1.8,  // Oct: Strong
      11: -0.5, // Nov: Flat
      12: 2.0   // Dec: Window Dressing
    })
  }
];
