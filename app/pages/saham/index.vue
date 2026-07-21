<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { stockFundamentals, getStockFundamentals } from '../../data/stockFundamentals';

// Page Title and SEO Meta
useHead({
  title: 'TradingView Chart - Analisis Harga Saham IDX',
  meta: [
    { name: 'description', content: 'Grafik harga saham interaktif ala TradingView dengan analisis candlestick harian, volume transaksi, dan rata-rata bergerak (Moving Average).' }
  ]
});

// Active symbol (initialised from the URL so links are shareable)
const route = useRoute();
const router = useRouter();
const activeSymbol = ref(((route.query.symbol as string) || 'BBCA').toUpperCase().trim());
const selectedRange = ref<'1m' | '3m' | '6m' | '1y'>('6m');

// Reflect the active symbol in the URL query for shareable links
watch(activeSymbol, (sym) => {
  router.replace({ query: { ...route.query, symbol: sym } });
});

const { setLast } = useLastSymbol();
watch(activeSymbol, setLast, { immediate: true });

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

// Chronological chart data processor (oldest first)
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

// Moving Averages Calculations
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

// Format Large Numbers Helper
const formatLargeNumber = (num: number, suffix = '') => {
  if (num >= 1e12) return (num / 1e12).toFixed(2) + ' T' + suffix;
  if (num >= 1e9) return (num / 1e9).toFixed(2) + ' B' + suffix;
  if (num >= 1e6) return (num / 1e6).toFixed(2) + ' M' + suffix;
  return num.toLocaleString('id-ID') + suffix;
};

// ==========================================================================
// Fundamental Ratios (Keuangan)
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

const formatIdr = (n: number | null | undefined) =>
  n == null ? '—' : 'Rp ' + n.toLocaleString('id-ID', { maximumFractionDigits: 2 });

// ECharts Candlestick + Volume Config
const chartOption = computed(() => {
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
</script>

<template>
  <div class="pb-16 bg-slate-950 text-slate-100 flex flex-col flex-grow">
    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 mt-8 flex-grow w-full flex flex-col space-y-4">
      
      <!-- Top Actions Bar -->
      <section class="glow-card rounded-2xl p-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <!-- Stock Ticker selectors -->
        <div class="w-full md:max-w-2xl">
          <StockSearch v-model="activeSymbol" />
        </div>

        <!-- Range Filter Buttons -->
        <div class="flex bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs font-bold text-slate-400">
          <button 
            type="button" 
            class="px-3 py-1.5 rounded-lg transition-all"
            :class="[selectedRange === '1m' ? 'bg-slate-800 text-emerald-450 shadow-sm' : 'hover:text-slate-200']"
            @click="selectedRange = '1m'"
          >
            1B
          </button>
          <button 
            type="button" 
            class="px-3 py-1.5 rounded-lg transition-all"
            :class="[selectedRange === '3m' ? 'bg-slate-800 text-emerald-450 shadow-sm' : 'hover:text-slate-200']"
            @click="selectedRange = '3m'"
          >
            3B
          </button>
          <button 
            type="button" 
            class="px-3 py-1.5 rounded-lg transition-all"
            :class="[selectedRange === '6m' ? 'bg-slate-800 text-emerald-450 shadow-sm' : 'hover:text-slate-200']"
            @click="selectedRange = '6m'"
          >
            6B
          </button>
          <button 
            type="button" 
            class="px-3 py-1.5 rounded-lg transition-all"
            :class="[selectedRange === '1y' ? 'bg-slate-800 text-emerald-450 shadow-sm' : 'hover:text-slate-200']"
            @click="selectedRange = '1y'"
          >
            1T
          </button>
        </div>
      </section>

      <!-- Error State Warning -->
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

      <!-- Loading State -->
      <div v-else-if="isPending" class="py-32 flex flex-col items-center justify-center gap-4 bg-slate-900/10 border border-slate-900 rounded-2xl flex-grow">
        <div class="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p class="text-sm text-slate-400 font-medium animate-pulse">Menggambar grafik candlestick harian ala TradingView...</p>
      </div>

      <!-- Loaded Candlestick + Volume Chart -->
      <div v-else-if="stockDetail" class="flex flex-col flex-grow space-y-4">
        
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

        <!-- Massive Chart Box -->
        <section class="glow-card p-2 rounded-2xl bg-[#020617] border border-slate-900">
          <div class="w-full h-[540px] relative">
            <ClientOnly>
              <VChart :option="chartOption" class="w-full h-full" autoresize />
              <template #fallback>
                <div class="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">
                  Menggambar grafik lilin...
                </div>
              </template>
            </ClientOnly>
          </div>
        </section>

        <!-- Financial Ratios & Valuation (Keuangan) -->
        <section v-if="ratios" class="glow-card rounded-2xl p-6 space-y-5">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 class="text-base font-bold text-slate-50">Rasio Keuangan &amp; Valuasi</h4>
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
      </div>

    </main>
  </div>
</template>
