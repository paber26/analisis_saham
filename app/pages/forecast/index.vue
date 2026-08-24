<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { stockFundamentals, getStockFundamentals } from '../../data/stockFundamentals';

useHead({
  title: 'TradingView Chart & Forecasting Saham IDX — Backtest & Proyeksi Probabilistik',
  meta: [
    {
      name: 'description',
      content: 'Grafik harga saham interaktif ala TradingView (candlestick + volume + moving average) dan forecasting saham IDX: ensemble Naive/Drift/AR/Holt/Regresi pada log-return, walk-forward 3 fold, volatilitas EWMA, probabilitas naik, dan proyeksi dengan pita ketidakpastian.'
    }
  ]
});

const route = useRoute();
const router = useRouter();
const activeSymbol = ref(((route.query.symbol as string) || 'BBCA').toUpperCase().trim());
const horizon = ref(parseInt((route.query.horizon as string) || '14', 10) || 14);

// Sync URL query → state so external navigation (e.g. the screening rail) updates
// the page without a remount.
watch(() => route.query.symbol, (s) => {
  const v = ((s as string) || '').toUpperCase().trim();
  if (v && v !== activeSymbol.value) activeSymbol.value = v;
});

watch([activeSymbol, horizon], () => {
  router.replace({ query: { ...route.query, symbol: activeSymbol.value, horizon: horizon.value } });
});

// Remember last viewed symbol (shared across pages)
const { setLast } = useLastSymbol();
watch(activeSymbol, setLast, { immediate: true });

// ---- Forecast API ----
const { data, pending, error } = await useFetch<any>(() => '/api/forecast', {
  params: { symbol: activeSymbol, horizon },
  watch: [activeSymbol, horizon]
});

// Filter: batch scan server-side (semua saham snapshot screening). Di-cache 1 hari.
// Multi-kategori: arah proyeksi + edge + prob + upside — digabung AND di client.
const { data: filterData, pending: filterPending, refresh: refreshFilter } = await useFetch<any>(
  () => '/api/forecast-screen',
  { params: { horizon } }
);
const filterRows = computed<any[]>(() => filterData.value?.results || []);
const filterCount = computed(() => filterData.value?.count ?? filterRows.value.length);
const filterScanned = computed(() => filterData.value?.scanned ?? 0);

// ---- Multi-category filter (default: Proyeksi > Aktual, perilaku lama) ----
const activeFilters = ref<Set<string>>(new Set(['up']));

function toggleFilter(key: string) {
  const s = new Set(activeFilters.value);
  s.has(key) ? s.delete(key) : s.add(key);
  activeFilters.value = s;
}
function resetFilters() {
  activeFilters.value = new Set(['up']);
}
function clearFilters() {
  activeFilters.value = new Set();
}

const FILTER_CHIPS: { key: string; label: string; test: (r: any) => boolean }[] = [
  { key: 'up', label: '📈 Proyeksi > Aktual', test: (r) => r.direction === 'up' },
  { key: 'down', label: '📉 Proyeksi < Aktual', test: (r) => r.direction === 'down' },
  { key: 'flat', label: '➖ Proyeksi = Aktual', test: (r) => r.direction === 'flat' },
  { key: 'edge_pos', label: '✅ Edge Positif', test: (r) => r.edge === 'positif' },
  { key: 'edge_neg', label: '⚠️ Edge Negatif', test: (r) => r.edge === 'negatif' },
  { key: 'prob_high', label: '🎯 Prob ≥60%', test: (r) => r.probUp >= 60 },
  { key: 'prob_low', label: '🎲 Prob <45%', test: (r) => r.probUp < 45 },
  { key: 'upside_5', label: '🚀 Upside ≥5%', test: (r) => r.upsidePct >= 5 }
];

const filteredRows = computed<any[]>(() => {
  const rows = filterRows.value;
  if (!activeFilters.value.size) return rows;
  const active = FILTER_CHIPS.filter((c) => activeFilters.value.has(c.key));
  return rows.filter((r) => active.every((c) => c.test(r)));
});
const filterPage = ref(1);
const FILTER_PAGE_SIZE = 50;
const filteredPaged = computed(() => filteredRows.value.slice(0, filterPage.value * FILTER_PAGE_SIZE));
watch([filteredRows, horizon], () => { filterPage.value = 1; });
const allFiltersActive = computed(() => activeFilters.value.size >= FILTER_CHIPS.length);

// ---- Candlestick API (merged from /saham) ----
const selectedRange = ref<'1m' | '3m' | '6m' | '1y'>('6m');

// Fetch live stock details from server API (now queries 1 year range)
const {
  data: stockDetail,
  pending: isPending,
  error: fetchError
} = await useFetch<any>(() => '/api/detail', {
  params: { symbol: activeSymbol },
  watch: [activeSymbol]
});

// Fetch live fundamentals (PER/PBV/ROE/yield) for the active symbol
const { data: liveFund } = await useFetch<any>(() => '/api/fundamentals', {
  params: { symbol: activeSymbol },
  watch: [activeSymbol]
});

// ---- Chart data processor (oldest first, merged from /saham) ----
const chartData = computed(() => {
  if (!stockDetail.value || !stockDetail.value.history || stockDetail.value.history.length === 0) {
    return { categoryData: [], values: [], volumes: [], prevCloseList: [], rawList: [] };
  }

  const rawList = [...stockDetail.value.history].reverse(); // reverse from latest-first to oldest-first

  // Filter based on range
  let filteredList = rawList;
  if (selectedRange.value === '1m') {
    filteredList = rawList.slice(-20);
  } else if (selectedRange.value === '3m') {
    filteredList = rawList.slice(-60);
  } else if (selectedRange.value === '6m') {
    filteredList = rawList.slice(-125);
  }

  // Offset of the filtered window inside rawList, so the very first visible
  // bar still knows the true previous close (from before the window).
  const startIdx = rawList.length - filteredList.length;

  const categoryData = [];
  const values = []; // [open, close, lowest, highest]
  const volumes = []; // [index, volume] with style
  const prevCloseList: number[] = []; // previous-day close, aligned with values

  for (let i = 0; i < filteredList.length; i++) {
    const item = filteredList[i];
    categoryData.push(item.date);
    values.push([item.open, item.close, item.low, item.high]);

    const globalIdx = startIdx + i;
    const prevBar = globalIdx > 0 ? rawList[globalIdx - 1] : null;
    prevCloseList.push(prevBar ? prevBar.close : item.open);

    const isUp = item.close >= item.open;
    volumes.push({
      value: item.volume,
      itemStyle: {
        color: isUp ? '#089981' : '#f23645', // TradingView green vs red
        opacity: 0.7
      }
    });
  }

  return {
    categoryData,
    values,
    volumes,
    prevCloseList,
    rawList: filteredList
  };
});

// Moving Averages Calculations (merged from /saham)
const ma5 = computed(() => calculateMA(5, chartData.value.rawList));
const ma10 = computed(() => calculateMA(10, chartData.value.rawList));
const ma20 = computed(() => calculateMA(20, chartData.value.rawList));

function calculateMA(dayCount: number, data: any[]) {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    if (i < dayCount - 1) {
      result.push('-');
      continue;
    }
    let sum = 0;
    for (let j = 0; j < dayCount; j++) {
      sum += data[i - j].close;
    }
    result.push(Math.round((sum / dayCount) * 100) / 100);
  }
  return result;
}

// ---- Format helpers ----
const fmt = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('id-ID'));

const formatLargeNumber = (num: number, suffix = '') => {
  if (num >= 1e12) return (num / 1e12).toFixed(2) + ' T' + suffix;
  if (num >= 1e9) return (num / 1e9).toFixed(2) + ' B' + suffix;
  if (num >= 1e6) return (num / 1e6).toFixed(2) + ' M' + suffix;
  return num.toLocaleString('id-ID') + suffix;
};

const formatIdr = (n: number | null | undefined) =>
  n == null ? '—' : 'Rp ' + n.toLocaleString('id-ID', { maximumFractionDigits: 2 });

// ==========================================================================
// Fundamental Ratios (Keuangan) — merged from /saham
// Prefers LIVE fundamentals from Yahoo (/api/fundamentals, works for any IDX
// ticker) and falls back to the static snapshot when Yahoo has no data.
// ==========================================================================

// Base ticker (strip .JK) used for the static fallback lookup
const baseCode = computed(() => {
  const sym = (stockDetail.value?.symbol || activeSymbol.value || '').toUpperCase();
  return sym.replace('.JK', '');
});

// Indices (IHSG / ^JKSE) have no company fundamentals
const isIndex = computed(() => {
  const sym = (stockDetail.value?.symbol || activeSymbol.value || '').toUpperCase();
  return sym.startsWith('^') || sym === 'IHSG';
});

// Live Yahoo fundamentals, only when actually available
const live = computed(() => (liveFund.value && liveFund.value.available ? liveFund.value : null));

// Merged base figures (EPS/BVPS/DPS/shares) + provenance for the badge
const fundamentals = computed(() => {
  const stat = getStockFundamentals(baseCode.value);
  const l = live.value;
  const source: 'yahoo' | 'preset' | 'estimate' =
    l ? 'yahoo' : (stockFundamentals[baseCode.value] ? 'preset' : 'estimate');
  return {
    eps: l?.eps ?? stat.eps,
    bvps: l?.bvps ?? stat.bvps,
    dps: l?.dps ?? stat.dps,
    // Yahoo returns absolute share count; static list is already in billions
    sharesOutstanding: l?.sharesOutstanding != null ? l.sharesOutstanding / 1e9 : stat.sharesOutstanding,
    source
  };
});

const ratios = computed(() => {
  const price = stockDetail.value?.currentPrice;
  const f = fundamentals.value;
  const l = live.value;
  if (!price || isIndex.value) return null;

  const round2 = (n: number) => Math.round(n * 100) / 100;
  return {
    per: l?.per ?? (f.eps > 0 ? round2(price / f.eps) : null),          // Price / Earnings
    pbv: l?.pbv ?? (f.bvps > 0 ? round2(price / f.bvps) : null),        // Price / Book Value
    divYield: l?.dividendYield ?? (price > 0 ? round2((f.dps / price) * 100) : null), // %
    roe: l?.roe ?? (f.bvps > 0 ? round2((f.eps / f.bvps) * 100) : null),    // ROE (%)
    payout: l?.payout ?? (f.eps > 0 ? round2((f.dps / f.eps) * 100) : null),   // Payout ratio %
    marketCap: l?.marketCap ?? price * (f.sharesOutstanding || 0) * 1e9
  };
});

// Interpretation tones -> literal Tailwind classes (kept whole so JIT detects them)
const TONE: Record<string, string> = {
  emerald: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  sky: 'text-sky-300 bg-sky-500/10 border-sky-500/20',
  amber: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  rose: 'text-rose-300 bg-rose-500/10 border-rose-500/20',
  slate: 'text-slate-300 bg-slate-800/60 border-slate-700'
};

type Verdict = { label: string; tone: keyof typeof TONE };

const perVerdict = computed<Verdict>(() => {
  const per = ratios.value?.per;
  if (per == null) return { label: 'EPS negatif (rugi)', tone: 'rose' };
  if (per < 10) return { label: 'Relatif murah', tone: 'emerald' };
  if (per <= 20) return { label: 'Valuasi wajar', tone: 'sky' };
  if (per <= 30) return { label: 'Premium', tone: 'amber' };
  return { label: 'Mahal', tone: 'rose' };
});

const pbvVerdict = computed<Verdict>(() => {
  const pbv = ratios.value?.pbv;
  if (pbv == null) return { label: '—', tone: 'slate' };
  if (pbv < 1) return { label: 'Di bawah nilai buku', tone: 'emerald' };
  if (pbv <= 3) return { label: 'Wajar', tone: 'sky' };
  return { label: 'Premium', tone: 'amber' };
});

const roeVerdict = computed<Verdict>(() => {
  const roe = ratios.value?.roe;
  if (roe == null) return { label: '—', tone: 'slate' };
  if (roe < 0) return { label: 'Rugi', tone: 'rose' };
  if (roe >= 15) return { label: 'Sangat baik', tone: 'emerald' };
  if (roe >= 10) return { label: 'Baik', tone: 'sky' };
  return { label: 'Rendah', tone: 'amber' };
});

const yieldVerdict = computed<Verdict>(() => {
  const dy = ratios.value?.divYield;
  if (dy == null || dy === 0) return { label: 'Tidak bagi dividen', tone: 'slate' };
  if (dy >= 4) return { label: 'Yield tinggi', tone: 'emerald' };
  if (dy >= 1) return { label: 'Yield sedang', tone: 'sky' };
  return { label: 'Yield rendah', tone: 'amber' };
});

// ---- Forecast helpers ----
const MODEL_LABELS: Record<string, string> = {
  naive: 'Naive (baseline)',
  drift: 'Drift',
  ar: 'AR',
  holt: 'Holt (tren)',
  reg: 'Regresi teknikal',
  ensemble: 'Ensemble'
};

const metricRows = computed(() => {
  const m = data.value?.metrics;
  if (!m) return [];
  return (['naive', 'drift', 'ar', 'holt', 'reg', 'ensemble'] as const).map((k) => ({
    key: k,
    label: k === 'ar' ? `AR(${data.value.arOrder || '–'})` : MODEL_LABELS[k],
    ...m[k]
  }));
});

const bestLabel = computed(() => {
  const b = data.value?.best;
  if (!b) return '—';
  return b === 'ar' ? `AR(${data.value.arOrder || '–'})` : MODEL_LABELS[b];
});
// Honest verdict vs random walk: only claim victory when the best model beats
// naive by a meaningful margin (>=0.5% lower RMSE), else "setara" / "belum".
const naiveVerdict = computed(() => {
  const d = data.value;
  if (!d) return { label: '—', cls: 'text-slate-400' };
  if (d.best === 'naive') return { label: '⚠ Belum mengungguli random walk', cls: 'text-amber-400' };
  const nv = d.metrics?.naive?.rmse;
  const bt = d.metrics?.[d.best]?.rmse;
  if (nv != null && bt != null && bt < nv * 0.995) {
    return { label: '✓ Mengungguli random walk', cls: 'text-emerald-400' };
  }
  return { label: '≈ Setara random walk (beda tipis)', cls: 'text-amber-400' };
});
const weightsText = computed(() => {
  const w = data.value?.weights || [];
  if (!w.length) return null;
  return w.map((e: any) => `${e.model} ${e.weight}%`).join(' · ');
});

const volLabel = computed(() => {
  const r = data.value?.vol?.regime;
  return r === 'tinggi' ? 'Volatilitas Tinggi' : r === 'rendah' ? 'Volatilitas Rendah' : 'Volatilitas Normal';
});
const volClass = computed(() => {
  const r = data.value?.vol?.regime;
  return r === 'tinggi' ? 'text-rose-400' : r === 'rendah' ? 'text-emerald-400' : 'text-sky-400';
});

const rangeEnd = computed(() => {
  const fc = data.value?.forecast;
  return fc && fc.length ? fc[fc.length - 1] : null;
});

const tradeOddsView = computed(() => {
  const o = data.value?.tradeOdds;
  if (!o) return null;
  return {
    ...o,
    edgeCls: o.edge === 'positif' ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' : o.edge === 'negatif' ? 'text-rose-300 bg-rose-500/10 border-rose-500/30' : 'text-slate-300 bg-slate-800/60 border-slate-700',
    edgeLabel: o.edge === 'positif' ? 'Ekspektasi positif' : o.edge === 'negatif' ? 'Ekspektasi negatif' : 'Ekspektasi netral'
  };
});

// ---- Candlestick chart option (merged from /saham) ----
const candleChartOption = computed(() => {
  const { categoryData, values, volumes, prevCloseList } = chartData.value;
  if (categoryData.length === 0) return {};

  return {
    backgroundColor: '#020617', // Slate 950
    animation: false,
    legend: {
      data: ['Candlestick', 'MA5', 'MA10', 'MA20'],
      inactiveColor: '#475569',
      textStyle: {
        color: '#94a3b8',
        fontSize: 10,
        fontFamily: 'inherit'
      },
      top: '1.5%',
      left: '3%'
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        label: {
          backgroundColor: '#1e293b',
          color: '#f8fafc',
          fontSize: 10
        }
      },
      backgroundColor: '#0f172a',
      borderColor: '#334155',
      borderWidth: 1,
      textStyle: {
        color: '#f8fafc',
        fontSize: 11,
        fontFamily: 'inherit'
      },
      padding: [8, 12],
      position: function (pos: any, params: any, el: any, elRect: any, size: any) {
        // Position at the top right to behave like TradingView's float bar
        return { top: 8, left: size.viewSize[0] - size.contentSize[0] - 24 };
      },
      formatter: (params: any) => {
        const candleParam = params.find((p: any) => p.seriesName === 'Candlestick');
        const volParam = params.find((p: any) => p.seriesName === 'Volume');
        const ma5Param = params.find((p: any) => p.seriesName === 'MA5');
        const ma10Param = params.find((p: any) => p.seriesName === 'MA10');
        const ma20Param = params.find((p: any) => p.seriesName === 'MA20');

        if (!candleParam) return '';
        const date = candleParam.name;
        const [open, close, low, high] = candleParam.value;
        const volumeVal = volParam ? volParam.value : 0;
        // Daily change vs the PREVIOUS close (exchange convention), not intra-day open.
        const prevClose = prevCloseList[candleParam.dataIndex] ?? open;
        const changeVal = close - prevClose;
        const changePct = prevClose > 0 ? (changeVal / prevClose) * 100 : 0;
        const isUp = changeVal >= 0;
        const color = isUp ? '#22c55e' : '#ef4444'; // emerald vs red
        const sign = changeVal > 0 ? '+' : '';

        let html = `
          <div style="display: flex; gap: 12px; font-family: inherit; font-size: 11px; align-items: center; white-space: nowrap;">
            <span style="color: #64748b; font-weight: 700;">${date}</span>
            <span>O: <b style="color: #f8fafc;">${open.toLocaleString('id-ID')}</b></span>
            <span>H: <b style="color: #f8fafc;">${high.toLocaleString('id-ID')}</b></span>
            <span>L: <b style="color: #f8fafc;">${low.toLocaleString('id-ID')}</b></span>
            <span>C: <b style="color: ${color};">${close.toLocaleString('id-ID')}</b></span>
            <span style="color: ${color}; font-weight: 700;">${sign}${changeVal.toLocaleString('id-ID')} (${sign}${changePct.toFixed(2)}%)</span>
            <span>V: <b style="color: #cbd5e1;">${formatLargeNumber(volumeVal)}</b></span>
        `;

        if (ma5Param && typeof ma5Param.value === 'number') {
          html += `<span style="color: #eab308;">MA5: <b>${ma5Param.value.toLocaleString('id-ID')}</b></span>`;
        }
        if (ma10Param && typeof ma10Param.value === 'number') {
          html += `<span style="color: #ec4899;">MA10: <b>${ma10Param.value.toLocaleString('id-ID')}</b></span>`;
        }
        if (ma20Param && typeof ma20Param.value === 'number') {
          html += `<span style="color: #3b82f6;">MA20: <b>${ma20Param.value.toLocaleString('id-ID')}</b></span>`;
        }

        html += `</div>`;
        return html;
      }
    },
    axisPointer: {
      link: [{ xAxisIndex: 'all' }],
      label: { backgroundColor: '#334155' }
    },
    // Dual aligned grids (Main Candlestick top, Volume bottom)
    grid: [
      {
        left: '2%',
        right: '4%',
        height: '67%',
        top: '10%',
        containLabel: false
      },
      {
        left: '2%',
        right: '4%',
        top: '80%',
        height: '13%',
        containLabel: false
      }
    ],
    xAxis: [
      {
        type: 'category',
        data: categoryData,
        boundaryGap: true,
        axisLine: { onZero: false, lineStyle: { color: '#1e293b' } },
        splitLine: { show: true, lineStyle: { color: '#0f172a', type: 'dashed' } },
        axisLabel: { show: false },
        axisTick: { show: false },
        min: 'dataMin',
        max: 'dataMax'
      },
      {
        type: 'category',
        gridIndex: 1,
        data: categoryData,
        boundaryGap: true,
        axisLine: { onZero: false, lineStyle: { color: '#334155' } },
        splitLine: { show: true, lineStyle: { color: '#0f172a', type: 'dashed' } },
        axisLabel: {
          color: '#64748b',
          fontSize: 9,
          fontFamily: 'inherit'
        },
        axisTick: { show: false },
        min: 'dataMin',
        max: 'dataMax'
      }
    ],
    yAxis: [
      {
        scale: true,
        axisLine: { show: false },
        axisLabel: {
          color: '#64748b',
          fontFamily: 'inherit',
          fontSize: 9,
          formatter: (val: number) => val.toLocaleString('id-ID')
        },
        splitLine: { show: true, lineStyle: { color: '#0f172a', type: 'dashed' } },
        position: 'right'
      },
      {
        scale: true,
        gridIndex: 1,
        splitNumber: 2,
        axisLabel: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false }
      }
    ],
    // Scrolling & Zooming triggers
    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: [0, 1],
        start: 60, // Shows latest 40% of records by default
        end: 100
      },
      {
        show: true,
        xAxisIndex: [0, 1],
        type: 'slider',
        bottom: '0%',
        height: 16,
        backgroundColor: '#020617',
        borderColor: '#0f172a',
        fillerColor: 'rgba(8, 153, 129, 0.08)',
        textStyle: { color: '#475569', fontSize: 8, fontFamily: 'inherit' },
        handleStyle: { color: '#089981' }
      }
    ],
    series: [
      {
        name: 'Candlestick',
        type: 'candlestick',
        data: values,
        itemStyle: {
          color: '#089981',       // Green up candle
          color0: '#f23645',      // Red down candle
          borderColor: '#089981',
          borderColor0: '#f23645'
        }
      },
      {
        name: 'Volume',
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: volumes
      },
      {
        name: 'MA5',
        type: 'line',
        data: ma5.value,
        smooth: true,
        showSymbol: false,
        lineStyle: { color: '#eab308', width: 1 }
      },
      {
        name: 'MA10',
        type: 'line',
        data: ma10.value,
        smooth: true,
        showSymbol: false,
        lineStyle: { color: '#ec4899', width: 1 }
      },
      {
        name: 'MA20',
        type: 'line',
        data: ma20.value,
        smooth: true,
        showSymbol: false,
        lineStyle: { color: '#3b82f6', width: 1.2 }
      }
    ]
  };
});

// ---- Forecast chart option (line + projection band) ----
const forecastChartOption = computed(() => {
  const d = data.value;
  if (!d) return {};
  const series = d.series as any[];
  const fc = d.forecast as any[];
  const lastIdx = series.length - 1;

  const dates = [...series.map((s) => s.date), ...fc.map((f) => f.date)];
  const actual = [...series.map((s) => s.actual), ...fc.map(() => null)];
  const pred = [...series.map((s) => s.pred), ...fc.map(() => null)];

  const fwdMean: (number | null)[] = series.map(() => null);
  const fwdLower: (number | null)[] = series.map(() => null);
  const fwdBand: (number | null)[] = series.map(() => null);
  fwdMean[lastIdx] = d.lastPrice;
  fwdLower[lastIdx] = d.lastPrice;
  fwdBand[lastIdx] = 0;
  for (const f of fc) {
    fwdMean.push(f.mean);
    fwdLower.push(f.lower);
    fwdBand.push(Math.max(0, f.upper - f.lower));
  }

  return {
    backgroundColor: 'transparent',
    animation: false,
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0f172a',
      borderColor: '#334155',
      textStyle: { color: '#f8fafc', fontSize: 11 },
      valueFormatter: (v: number | null) => (v == null ? '—' : Math.round(v).toLocaleString('id-ID'))
    },
    legend: {
      data: ['Aktual', 'Prediksi 1-hari (uji)', 'Proyeksi'],
      textStyle: { color: '#94a3b8', fontSize: 11 },
      top: 0
    },
    grid: { left: 8, right: 12, top: 36, bottom: 40, containLabel: true },
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: { lineStyle: { color: '#1e293b' } },
      axisLabel: { color: '#64748b', fontSize: 9, formatter: (v: string) => v?.slice(5) },
      splitLine: { show: false }
    },
    yAxis: {
      scale: true,
      axisLabel: { color: '#64748b', fontSize: 9, formatter: (v: number) => v.toLocaleString('id-ID') },
      splitLine: { lineStyle: { color: '#0f172a' } }
    },
    dataZoom: [
      { type: 'inside', start: 40, end: 100 },
      { type: 'slider', height: 16, bottom: 8, backgroundColor: '#020617', borderColor: '#0f172a', fillerColor: 'rgba(16,185,129,0.08)', textStyle: { color: '#475569', fontSize: 8 } }
    ],
    series: [
      { name: 'lower', type: 'line', data: fwdLower, stack: 'conf', lineStyle: { opacity: 0 }, symbol: 'none', silent: true, z: 1 },
      { name: 'band', type: 'line', data: fwdBand, stack: 'conf', lineStyle: { opacity: 0 }, areaStyle: { color: 'rgba(56,189,248,0.15)' }, symbol: 'none', silent: true, z: 1, tooltip: { show: false } },
      { name: 'Aktual', type: 'line', data: actual, smooth: false, showSymbol: false, lineStyle: { color: '#e2e8f0', width: 1.5 }, z: 4 },
      { name: 'Prediksi 1-hari (uji)', type: 'line', data: pred, smooth: false, showSymbol: false, connectNulls: false, lineStyle: { color: '#f59e0b', width: 1, type: 'dotted' }, z: 3 },
      { name: 'Proyeksi', type: 'line', data: fwdMean, smooth: true, showSymbol: false, connectNulls: true, lineStyle: { color: '#38bdf8', width: 2, type: 'dashed' }, z: 5 }
    ]
  };
});
</script>

<template>
  <div class="pb-16 bg-slate-950 text-slate-100 flex flex-col flex-grow">
    <main class="max-w-7xl mx-auto px-4 sm:px-6 mt-8 flex-grow w-full space-y-6">

      <!-- Controls -->
      <section class="glow-card rounded-2xl p-6">
        <h2 class="text-lg font-bold text-slate-50">Forecasting Harga</h2>
        <p class="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
          Model pada <strong class="text-slate-300">log-return</strong>: Naive, Drift, AR(p) (orde otomatis via AIC), Holt,
          Regresi teknikal, dan <strong class="text-slate-300">Ensemble</strong> berbobot untuk model yang mengalahkan naive.
          Evaluasi <em>walk-forward</em> 3 fold tanpa look-ahead. Pita proyeksi ≈80% dari
          <strong class="text-slate-300">volatilitas EWMA</strong> terkini.
        </p>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-5 items-end">
          <div class="lg:col-span-2">
            <label class="text-xs font-semibold text-slate-400 mb-2 block">Kode Saham</label>
            <StockSearch v-model="activeSymbol" />
          </div>
          <div>
            <label class="text-xs font-semibold text-slate-400 mb-2 block">Horizon proyeksi</label>
            <div class="grid grid-cols-4 bg-slate-900 p-1 border border-slate-800 rounded-xl">
              <button v-for="h in [7, 14, 30, 60]" :key="h" type="button"
                class="py-2 text-xs font-semibold rounded-lg transition-all"
                :class="horizon === h ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'"
                @click="horizon = h">{{ h }}h</button>
            </div>
          </div>
        </div>
      </section>

      <!-- Active stock header + Forecast chart (below Forecasting Harga card, above Filter card) -->
      <div v-if="pending" class="py-20 flex flex-col items-center justify-center gap-4 bg-slate-900/30 border border-slate-900 rounded-2xl">
        <div class="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p class="text-sm text-slate-400 animate-pulse">Melatih 5 model & menjalankan walk-forward backtest…</p>
      </div>
      <div v-else-if="error" class="p-6 rounded-2xl bg-rose-500/5 border border-rose-500/20 text-rose-200 text-sm">
        Gagal memuat forecast untuk "{{ activeSymbol }}". Data mungkin kurang dari 150 hari. Coba saham lain.
      </div>
      <template v-else-if="data">
        <!-- Active stock -->
        <div class="flex items-baseline gap-3 flex-wrap px-1">
          <h3 class="text-2xl font-extrabold text-slate-50">{{ (data.symbol || '').replace('.JK', '') }}</h3>
          <span class="text-sm text-slate-400">{{ data.name }}</span>
          <NuxtLink :to="`/analisa/${(data.symbol || '').replace('.JK', '')}`" class="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold ml-auto">→ Analisa lengkap</NuxtLink>
        </div>

        <!-- Forecast chart -->
        <section class="glow-card rounded-2xl p-4">
          <div class="w-full h-[440px]">
            <ClientOnly>
              <VChart :option="forecastChartOption" class="w-full h-full" autoresize />
              <template #fallback><div class="h-full flex items-center justify-center text-slate-500 text-sm">Memuat grafik…</div></template>
            </ClientOnly>
          </div>
        </section>
      </template>

      <!-- Merged from /saham: candlestick chart (error/loading/loaded) -->
      <div v-if="fetchError" class="p-6 rounded-2xl bg-rose-500/5 border border-rose-500/20 text-rose-200">
        <div class="flex gap-4 items-start">
          <div class="p-2 bg-rose-500/10 text-rose-400 rounded-xl flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div class="flex-grow">
            <h5 class="text-base font-bold text-rose-400 mb-1">Gagal Memuat Grafik Candlestick</h5>
            <p class="text-sm text-rose-300/90 mb-4">
              Data harga untuk simbol <strong class="text-rose-100 font-bold">"{{ activeSymbol }}"</strong> tidak ditemukan. Silakan periksa kembali simbol ticker bursa atau coba emiten blue-chip preset lainnya.
            </p>
            <button
              type="button"
              @click="activeSymbol = 'BBCA'"
              class="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-350 border border-rose-500/35 font-semibold text-xs rounded-xl transition-all"
            >
              Kembali ke Saham BBCA
            </button>
          </div>
        </div>
      </div>

      <div v-else-if="isPending" class="py-32 flex flex-col items-center justify-center gap-4 bg-slate-900/10 border border-slate-900 rounded-2xl">
        <div class="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p class="text-sm text-slate-400 font-medium animate-pulse">Menggambar grafik candlestick harian ala TradingView...</p>
      </div>

      <template v-else-if="stockDetail">
        <!-- Live Price Strip / Info bar (TradingView-style Status bar) -->
        <section class="glow-card p-4 rounded-xl flex flex-wrap items-center justify-between gap-4 text-xs">
          <!-- Left Ticker details -->
          <div class="flex items-center gap-3">
            <h3 class="text-base font-bold text-slate-100 tracking-tight">{{ stockDetail.name }}</h3>
            <span class="text-[10px] font-bold text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded uppercase">
              {{ stockDetail.symbol }}
            </span>
            <span class="text-[10px] font-bold text-emerald-450/90 bg-emerald-500/5 border border-emerald-500/10 px-2 py-0.5 rounded uppercase">
              {{ stockDetail.exchange }} : {{ stockDetail.currency }}
            </span>
          </div>

          <!-- Mid / Right Financial stats -->
          <div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-slate-400">
            <!-- Current price -->
            <div class="flex items-baseline gap-2">
              <span class="text-base font-extrabold text-slate-50">{{ stockDetail.currentPrice.toLocaleString('id-ID') }}</span>
              <span
                class="font-bold text-xs"
                :class="[stockDetail.currentPrice - stockDetail.previousClose >= 0 ? 'text-emerald-400' : 'text-rose-500']"
              >
                {{ stockDetail.currentPrice - stockDetail.previousClose >= 0 ? '▲' : '▼' }}
                {{ (stockDetail.currentPrice - stockDetail.previousClose >= 0 ? '+' : '') }}{{ (((stockDetail.currentPrice - stockDetail.previousClose) / stockDetail.previousClose) * 100).toFixed(2) }}%
              </span>
            </div>

            <div class="hidden sm:block border-l border-slate-900 h-4"></div>

            <div>
              <span>Buka:</span>
              <strong class="text-slate-200 ml-1">
                {{ stockDetail.history && stockDetail.history[0] ? stockDetail.history[stockDetail.history.length - 1].open.toLocaleString('id-ID') : '-' }}
              </strong>
            </div>

            <div>
              <span>Harian:</span>
              <strong class="text-slate-200 ml-1">
                {{ stockDetail.dayLow.toLocaleString('id-ID') }} - {{ stockDetail.dayHigh.toLocaleString('id-ID') }}
              </strong>
            </div>

            <div>
              <span>52M:</span>
              <strong class="text-slate-200 ml-1">
                {{ stockDetail.fiftyTwoWeekLow.toLocaleString('id-ID') }} - {{ stockDetail.fiftyTwoWeekHigh.toLocaleString('id-ID') }}
              </strong>
            </div>

            <div>
              <span>Volume:</span>
              <strong class="text-slate-200 ml-1">
                {{ formatLargeNumber(stockDetail.volume) }}
              </strong>
            </div>
          </div>
        </section>

        <!-- Massive Chart Box (candlestick + range control) -->
        <section class="glow-card p-4 rounded-2xl bg-[#020617] border border-slate-900">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider">Grafik Candlestick Harian</h4>
            <!-- Range Filter Buttons -->
            <div class="flex bg-slate-900 border border-slate-800 p-0.5 rounded-lg text-xs font-bold text-slate-400">
              <button
                type="button"
                class="px-3 py-1.5 rounded-md transition-all"
                :class="[selectedRange === '1m' ? 'bg-slate-800 text-emerald-400 shadow-sm' : 'hover:text-slate-200']"
                @click="selectedRange = '1m'"
              >
                1B
              </button>
              <button
                type="button"
                class="px-3 py-1.5 rounded-md transition-all"
                :class="[selectedRange === '3m' ? 'bg-slate-800 text-emerald-400 shadow-sm' : 'hover:text-slate-200']"
                @click="selectedRange = '3m'"
              >
                3B
              </button>
              <button
                type="button"
                class="px-3 py-1.5 rounded-md transition-all"
                :class="[selectedRange === '6m' ? 'bg-slate-800 text-emerald-400 shadow-sm' : 'hover:text-slate-200']"
                @click="selectedRange = '6m'"
              >
                6B
              </button>
              <button
                type="button"
                class="px-3 py-1.5 rounded-md transition-all"
                :class="[selectedRange === '1y' ? 'bg-slate-800 text-emerald-400 shadow-sm' : 'hover:text-slate-200']"
                @click="selectedRange = '1y'"
              >
                1T
              </button>
            </div>
          </div>
          <div class="w-full h-[540px] relative overflow-hidden rounded-xl">
            <ClientOnly>
              <VChart :option="candleChartOption" class="w-full h-full" autoresize />
              <template #fallback>
                <div class="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">
                  Menggambar grafik lilin...
                </div>
              </template>
            </ClientOnly>
          </div>
        </section>
      </template>

      <!-- Filter batch scan: multi-kategori (arah proyeksi + edge + prob + upside) -->
      <section class="glow-card rounded-2xl p-6">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-1">
          <div>
            <h2 class="text-lg font-bold text-slate-50">📈 Filter Proyeksi Batch (Multi-Kategori)</h2>
            <p class="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              Gabungkan beberapa kategori sekaligus (logika <strong class="text-slate-300">AND</strong>).
              Dibuat dari batch scan server-side atas {{ filterScanned }} saham snapshot screening ({{ filterData?.date || '—' }}).
            </p>
          </div>
          <button
            type="button"
            class="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:text-slate-100 hover:border-emerald-500/50 transition-colors"
            :disabled="filterPending"
            @click="refreshFilter()"
          >
            {{ filterPending ? 'Memindai…' : '⟳ Muat ulang' }}
          </button>
        </div>

        <!-- Chips multi-select -->
        <div class="flex flex-wrap gap-1.5 mt-3">
          <button
            v-for="chip in FILTER_CHIPS"
            :key="chip.key"
            type="button"
            class="px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors"
            :class="activeFilters.has(chip.key)
              ? 'bg-emerald-500 text-slate-950 border-emerald-500'
              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-600'"
            @click="toggleFilter(chip.key)"
          >{{ chip.label }}</button>
          <span class="w-px bg-slate-800 mx-1" aria-hidden="true"></span>
          <button type="button" class="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-900 border border-slate-800 text-sky-300 hover:text-sky-200 transition-colors" @click="resetFilters">↺ Default (&gt; Aktual)</button>
          <button type="button" :disabled="allFiltersActive" class="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-40" @click="clearFilters">✕ Bersihkan semua</button>
        </div>

        <p class="text-[11px] text-slate-500 mt-2">
          Menampilkan <strong class="text-slate-300">{{ filteredRows.length }}</strong> dari {{ filterCount }} saham ter-scan
          <span v-if="filterData?.counts" class="text-slate-600">(↑ {{ filterData.counts.up }} · ↓ {{ filterData.counts.down }} · = {{ filterData.counts.flat }})</span>
          <span v-if="activeFilters.size" class="text-emerald-400/80"> · {{ activeFilters.size }} kategori aktif (AND)</span>
        </p>

        <div v-if="filterPending" class="py-8 flex items-center justify-center gap-3 text-sm text-slate-400">
          <div class="w-6 h-6 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          Memindai {{ filterScanned }} saham (fetch 5y + fit 5 model/saham)…
        </div>

        <div v-else-if="filteredRows.length" class="overflow-x-auto mt-3">
          <table class="w-full text-sm min-w-[680px]">
            <thead>
              <tr class="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                <th class="px-3 py-2 font-semibold">#</th>
                <th class="px-3 py-2 font-semibold">Saham</th>
                <th class="px-3 py-2 text-center font-semibold">Arah</th>
                <th class="px-3 py-2 font-semibold text-right">Aktual</th>
                <th class="px-3 py-2 font-semibold text-right">Proyeksi {{ horizon }}h</th>
                <th class="px-3 py-2 font-semibold text-right">Upside</th>
                <th class="px-3 py-2 font-semibold text-right">Ekspektasi 1h</th>
                <th class="px-3 py-2 font-semibold text-right">P Naik</th>
                <th class="px-3 py-2 font-semibold text-right">Edge</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in filteredPaged" :key="r.code" class="border-b border-slate-900/70 hover:bg-slate-900/40">
                <td class="px-3 py-2.5 text-xs text-slate-500">{{ i + 1 }}</td>
                <td class="px-3 py-2.5">
                  <NuxtLink :to="`/forecast?symbol=${r.code}`" class="font-bold text-emerald-300 hover:text-emerald-200">{{ r.code }}</NuxtLink>
                  <p class="text-[10px] text-slate-500 truncate max-w-[220px]">{{ r.name }}</p>
                </td>
                <td class="px-3 py-2.5 text-center">
                  <span class="text-xs font-bold" :class="r.direction === 'up' ? 'text-emerald-400' : r.direction === 'down' ? 'text-rose-400' : 'text-slate-500'">
                    {{ r.direction === 'up' ? '↑' : r.direction === 'down' ? '↓' : '—' }}
                  </span>
                </td>
                <td class="px-3 py-2.5 text-right font-mono text-slate-300">{{ fmt(r.price) }}</td>
                <td class="px-3 py-2.5 text-right font-mono text-sky-300">{{ fmt(r.projPrice) }}</td>
                <td class="px-3 py-2.5 text-right font-mono font-bold" :class="r.upsidePct >= 0 ? 'text-emerald-400' : 'text-rose-400'">
                  {{ r.upsidePct >= 0 ? '+' : '' }}{{ r.upsidePct }}%
                </td>
                <td class="px-3 py-2.5 text-right font-mono" :class="r.expectedReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'">
                  {{ r.expectedReturnPct >= 0 ? '+' : '' }}{{ r.expectedReturnPct }}%
                </td>
                <td class="px-3 py-2.5 text-right font-mono" :class="r.probUp >= 50 ? 'text-emerald-400' : 'text-rose-400'">{{ r.probUp }}%</td>
                <td class="px-3 py-2.5 text-right">
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                    :class="r.edge === 'positif' ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' : r.edge === 'negatif' ? 'text-rose-300 bg-rose-500/10 border-rose-500/30' : 'text-slate-300 bg-slate-800/60 border-slate-700'">
                    {{ r.edge }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
          <div class="flex items-center justify-between mt-3 px-3">
            <p class="text-[11px] text-slate-500">
              Menampilkan {{ filteredPaged.length }} dari {{ filteredRows.length }} hasil ter-filter.
            </p>
            <button
              v-if="filteredPaged.length < filteredRows.length"
              type="button"
              class="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-slate-100 hover:border-emerald-500/50 transition-colors"
              @click="filterPage++"
            >
              Muat 50 lagi ({{ filteredRows.length - filteredPaged.length }} sisa) ↓
            </button>
          </div>
        </div>

        <div v-else class="py-8 text-center text-sm text-slate-400">
          Tidak ada saham yang memenuhi kombinasi filter ini
          <span v-if="activeFilters.size">({{ activeFilters.size }} kategori AND)</span>
          pada horizon {{ horizon }} hari.
          <button type="button" class="ml-2 text-emerald-400 font-bold hover:underline" @click="resetFilters">Kembali ke default</button>
        </div>
      </section>

      <!-- Forecast details (below filter & candlestick) -->
      <template v-if="data">
        <!-- Entry / exit odds -->
        <section v-if="data?.tradeOdds" class="glow-card rounded-2xl p-6">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h3 class="text-sm font-bold text-slate-100">Peluang Entry & Exit ({{ data.horizon }} hari)</h3>
            <span class="text-[11px] font-bold px-3 py-1 rounded-full border" :class="data.tradeOdds.edge === 'positif' ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' : data.tradeOdds.edge === 'negatif' ? 'text-rose-300 bg-rose-500/10 border-rose-500/30' : 'text-slate-300 bg-slate-800/60 border-slate-700'">{{ data.tradeOdds.edge === 'positif' ? 'Ekspektasi positif' : data.tradeOdds.edge === 'negatif' ? 'Ekspektasi negatif' : 'Ekspektasi netral' }}</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div class="rounded-xl bg-rose-500/5 border border-rose-500/20 p-4">
              <p class="text-[10px] text-rose-400 uppercase tracking-wide">P kena stop −{{ data.tradeOdds.stopPct }}%</p>
              <p class="text-2xl font-extrabold text-rose-300 mt-1">{{ data.tradeOdds.probDownToStop }}%</p>
              <p class="text-[10px] text-slate-500 mt-0.5">dalam {{ data.horizon }} hari</p>
            </div>
            <div class="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-4">
              <p class="text-[10px] text-emerald-400 uppercase tracking-wide">P capai target +{{ data.tradeOdds.targetPct }}%</p>
              <p class="text-2xl font-extrabold text-emerald-300 mt-1">{{ data.tradeOdds.probUpToTarget }}%</p>
              <p class="text-[10px] text-slate-500 mt-0.5">dalam {{ data.horizon }} hari</p>
            </div>
            <div class="rounded-xl bg-slate-900/50 border border-slate-800 p-4">
              <p class="text-[10px] text-slate-400 uppercase tracking-wide">Cara baca</p>
              <p class="text-[11px] text-slate-300 leading-relaxed mt-1">Jika P(kena stop) jauh lebih besar dari P(target), hindari entri baru / kecilkan posisi.</p>
            </div>
          </div>
        </section>

        <!-- Summary cards -->
        <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="glow-card rounded-2xl p-5">
            <p class="text-[11px] text-slate-400 uppercase tracking-wide">Harga Terakhir</p>
            <p class="text-2xl font-extrabold text-slate-50 mt-1">{{ fmt(data.lastPrice) }}</p>
            <p class="text-[11px] text-slate-500 mt-1">per {{ data.lastDate }}</p>
          </div>

          <div class="glow-card rounded-2xl p-5">
            <p class="text-[11px] text-slate-400 uppercase tracking-wide">Probabilitas Naik Besok</p>
            <p class="text-2xl font-extrabold mt-1" :class="data.nextDay.probUp >= 50 ? 'text-emerald-400' : 'text-rose-400'">
              {{ data.nextDay.probUp }}%
              <span class="text-sm font-bold text-slate-400">({{ data.nextDay.expectedReturnPct >= 0 ? '+' : '' }}{{ data.nextDay.expectedReturnPct }}%)</span>
            </p>
            <p class="text-[11px] text-slate-500 mt-1">
              Akurasi arah uji: {{ data.nextDay.hitRate ?? '—' }}% · baseline {{ data.baselineDirAcc }}%
            </p>
          </div>

          <div class="glow-card rounded-2xl p-5">
            <p class="text-[11px] text-slate-400 uppercase tracking-wide">Model Terbaik (RMSE uji)</p>
            <p class="text-xl font-extrabold text-slate-50 mt-1">{{ bestLabel }}</p>
            <p class="text-[11px] mt-1" :class="naiveVerdict.cls">{{ naiveVerdict.label }}</p>
          </div>

          <div class="glow-card rounded-2xl p-5">
            <p class="text-[11px] text-slate-400 uppercase tracking-wide">{{ volLabel }}</p>
            <p class="text-2xl font-extrabold mt-1" :class="volClass">{{ data.vol.dailyPct }}%<span class="text-sm text-slate-500">/hari</span></p>
            <p class="text-[11px] text-slate-500 mt-1">
              ≈ {{ data.vol.annualPct }}%/tahun ·
              <span v-if="rangeEnd">rentang {{ data.horizon }}h: {{ fmt(rangeEnd.lower) }}–{{ fmt(rangeEnd.upper) }}</span>
            </p>
          </div>
        </section>

        <!-- Metrics -->
        <section class="glow-card rounded-2xl p-6">
          <div class="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <h3 class="text-sm font-bold text-slate-100">Hasil Backtest Walk-Forward ({{ data.testSize }} hari uji, 3 fold)</h3>
              <p class="text-xs text-slate-400 mt-1">RMSE/MAE makin kecil makin baik. Akurasi arah dibandingkan baseline mayoritas {{ data.baselineDirAcc }}%.</p>
            </div>
            <div class="text-right text-[11px] text-slate-400 space-y-1">
              <p v-if="weightsText">Bobot ensemble: <span class="text-slate-200 font-semibold">{{ weightsText }}</span></p>
              <p v-else class="text-amber-400">Tidak ada model yang lolos validasi → ensemble = naive</p>
              <p>
                Stabilitas arah per fold:
                <span v-for="(f, i) in data.foldStability" :key="i" class="ml-1 text-slate-200 font-semibold">
                  {{ f.dirAcc ?? '—' }}%<span v-if="Number(i) < data.foldStability.length - 1" class="text-slate-600"> /</span>
                </span>
              </p>
            </div>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm min-w-[560px]">
              <thead>
                <tr class="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                  <th class="px-3 py-2 font-semibold">Model</th>
                  <th class="px-3 py-2 font-semibold text-right">RMSE</th>
                  <th class="px-3 py-2 font-semibold text-right">MAE</th>
                  <th class="px-3 py-2 font-semibold text-right">MAPE</th>
                  <th class="px-3 py-2 font-semibold text-right">Akurasi Arah</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in metricRows" :key="row.key" class="border-b border-slate-900/70"
                  :class="[row.key === data.best ? 'bg-emerald-500/5' : '', row.key === 'ensemble' ? 'font-semibold' : '']">
                  <td class="px-3 py-2.5 font-semibold text-slate-200">
                    {{ row.label }}
                    <span v-if="row.key === data.best" class="ml-2 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">terbaik</span>
                  </td>
                  <td class="px-3 py-2.5 text-right font-mono text-slate-300">{{ fmt(row.rmse) }}</td>
                  <td class="px-3 py-2.5 text-right font-mono text-slate-300">{{ fmt(row.mae) }}</td>
                  <td class="px-3 py-2.5 text-right font-mono text-slate-300">{{ row.mape }}%</td>
                  <td class="px-3 py-2.5 text-right font-mono" :class="row.dirAcc == null ? 'text-slate-600' : row.dirAcc > data.baselineDirAcc ? 'text-emerald-400' : 'text-slate-300'">
                    {{ row.dirAcc == null ? '—' : row.dirAcc + '%' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Disclaimer -->
        <footer class="p-5 rounded-2xl bg-rose-500/5 border border-rose-500/10">
          <p class="text-[11px] leading-relaxed text-slate-400">
            Harga saham harian mendekati <em>random walk</em> — model apa pun sulit mengalahkan baseline secara konsisten.
            Sistem ini menampilkan hasil apa adanya: jika ensemble/naive terbaik, artinya belum ada nilai tambah prediktif
            untuk saham ini. Gunakan proyeksi sebagai <strong class="text-slate-300">indikasi arah & rentang probabilistik</strong>,
            bukan target harga. Bukan rekomendasi investasi.
          </p>
        </footer>
      </template>

      <!-- Merged from /saham: Financial Ratios & Valuation -->
      <section v-if="ratios" class="glow-card rounded-2xl p-6 space-y-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 class="text-base font-bold text-slate-50">Rasio Keuangan & Valuasi</h4>
            <p class="text-xs text-slate-400 mt-0.5">
              Dihitung dari harga terkini
              <strong class="text-slate-200">{{ formatIdr(stockDetail.currentPrice) }}</strong>
              terhadap data fundamental emiten.
            </p>
          </div>
          <span
            class="text-[10px] font-semibold px-3 py-1 rounded-full border"
            :class="fundamentals.source === 'yahoo' ? TONE.emerald : fundamentals.source === 'preset' ? TONE.sky : TONE.amber"
          >
            {{ fundamentals.source === 'yahoo' ? 'Live • Yahoo Finance' : fundamentals.source === 'preset' ? 'Data preset' : 'Estimasi otomatis' }}
          </span>
        </div>

        <!-- Valuation ratios -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <!-- PER -->
          <div class="rounded-xl bg-slate-950/40 border border-slate-800/80 p-4">
            <p class="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">PER (P/E)</p>
            <p class="text-2xl font-bold text-slate-50 mt-1">{{ ratios.per != null ? ratios.per + '×' : '—' }}</p>
            <span class="inline-block mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full border" :class="TONE[perVerdict.tone]">{{ perVerdict.label }}</span>
          </div>
          <!-- PBV -->
          <div class="rounded-xl bg-slate-950/40 border border-slate-800/80 p-4">
            <p class="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">PBV (P/B)</p>
            <p class="text-2xl font-bold text-slate-50 mt-1">{{ ratios.pbv != null ? ratios.pbv + '×' : '—' }}</p>
            <span class="inline-block mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full border" :class="TONE[pbvVerdict.tone]">{{ pbvVerdict.label }}</span>
          </div>
          <!-- ROE -->
          <div class="rounded-xl bg-slate-950/40 border border-slate-800/80 p-4">
            <p class="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">ROE</p>
            <p class="text-2xl font-bold text-slate-50 mt-1">{{ ratios.roe != null ? ratios.roe + '%' : '—' }}</p>
            <span class="inline-block mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full border" :class="TONE[roeVerdict.tone]">{{ roeVerdict.label }}</span>
          </div>
          <!-- Dividend Yield -->
          <div class="rounded-xl bg-slate-950/40 border border-slate-800/80 p-4">
            <p class="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Dividend Yield</p>
            <p class="text-2xl font-bold text-slate-50 mt-1">{{ ratios.divYield != null ? ratios.divYield + '%' : '—' }}</p>
            <span class="inline-block mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full border" :class="TONE[yieldVerdict.tone]">{{ yieldVerdict.label }}</span>
          </div>
        </div>

        <!-- Supporting fundamentals -->
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
          <div class="rounded-lg bg-slate-900/40 border border-slate-800/60 px-3 py-2.5">
            <p class="text-[10px] text-slate-500 uppercase tracking-wide">EPS</p>
            <p class="text-sm font-bold text-slate-100 mt-0.5">{{ formatIdr(fundamentals.eps) }}</p>
          </div>
          <div class="rounded-lg bg-slate-900/40 border border-slate-800/60 px-3 py-2.5">
            <p class="text-[10px] text-slate-500 uppercase tracking-wide">BVPS</p>
            <p class="text-sm font-bold text-slate-100 mt-0.5">{{ formatIdr(fundamentals.bvps) }}</p>
          </div>
          <div class="rounded-lg bg-slate-900/40 border border-slate-800/60 px-3 py-2.5">
            <p class="text-[10px] text-slate-500 uppercase tracking-wide">DPS</p>
            <p class="text-sm font-bold text-slate-100 mt-0.5">{{ formatIdr(fundamentals.dps) }}</p>
          </div>
          <div class="rounded-lg bg-slate-900/40 border border-slate-800/60 px-3 py-2.5">
            <p class="text-[10px] text-slate-500 uppercase tracking-wide">Payout Ratio</p>
            <p class="text-sm font-bold text-slate-100 mt-0.5">{{ ratios.payout != null ? ratios.payout + '%' : '—' }}</p>
          </div>
          <div class="rounded-lg bg-slate-900/40 border border-slate-800/60 px-3 py-2.5">
            <p class="text-[10px] text-slate-500 uppercase tracking-wide">Market Cap</p>
            <p class="text-sm font-bold text-slate-100 mt-0.5">Rp {{ formatLargeNumber(ratios.marketCap) }}</p>
          </div>
          <div class="rounded-lg bg-slate-900/40 border border-slate-800/60 px-3 py-2.5">
            <p class="text-[10px] text-slate-500 uppercase tracking-wide">Saham Beredar</p>
            <p class="text-sm font-bold text-slate-100 mt-0.5">{{ fundamentals.sharesOutstanding.toLocaleString('id-ID') }} M</p>
          </div>
        </div>

        <p class="text-[11px] leading-relaxed text-slate-500 border-t border-slate-800/60 pt-3">
          EPS, BVPS, dan DPS merupakan snapshot fundamental statis (bukan realtime dari laporan keuangan terbaru).
          Rasio dihitung ulang otomatis mengikuti harga live. Gunakan sebagai gambaran awal, bukan rekomendasi investasi.
        </p>
      </section>

    </main>
  </div>
</template>