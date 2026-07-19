<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { PeriodType } from '../../types/seasonal';
import {
  calculateSeasonalStats,
  calculateDashboardSummary,
  generateInsights,
  MONTH_LABELS
} from '../../utils/seasonalCalculator';

// Page Title and SEO Meta
useHead({
  title: 'Seasonal Saham Indonesia (IDX) - Pola Performa Historis',
  meta: [
    { name: 'description', content: 'Analisis pola musiman pergerakan harga saham Indonesia berdasarkan data historis bulanan, kuartalan, dan tahunan.' }
  ]
});

// Selection States (symbol & period initialised from the URL for shareable links)
const route = useRoute();
const router = useRouter();
const activeSymbol = ref(((route.query.symbol as string) || 'BBCA').toUpperCase().trim());
const selectedPeriodType = ref<PeriodType>(
  ['monthly', 'quarterly', 'yearly'].includes(route.query.period as string)
    ? (route.query.period as PeriodType)
    : 'monthly'
);

// Keep the URL in sync so an analysis can be shared via link
watch([activeSymbol, selectedPeriodType], () => {
  router.replace({
    query: { ...route.query, symbol: activeSymbol.value, period: selectedPeriodType.value }
  });
});

// Fetch active stock data dynamically from API
const { 
  data: fetchedStockData, 
  pending: isStockPending, 
  error: stockError 
} = await useFetch<any>(() => '/api/seasonal', {
  params: { symbol: activeSymbol },
  watch: [activeSymbol]
});

// Fetch IHSG benchmark data dynamically from API (constant symbol 'IHSG')
const {
  data: fetchedIhsgData,
  pending: isIhsgPending
} = await useFetch<any>('/api/seasonal', {
  params: { symbol: 'IHSG' }
});

const allAvailableYears = computed<number[]>(() => {
  const data = fetchedStockData.value as any;
  if (!data || !data.history) return [];
  const years = data.history.map((h: any) => h.year as number);
  const uniqueYears: number[] = Array.from(new Set(years)) as number[];
  return uniqueYears.sort((a, b) => a - b);
});

// Year range filters
const startYear = ref(2015);
const endYear = ref(2025);

// Sync year bounds when fetched stock data updates
watch(allAvailableYears, (years: number[]) => {
  if (years.length > 0) {
    const firstYear = years[0];
    const lastYear = years[years.length - 1];
    if (firstYear !== undefined && lastYear !== undefined) {
      startYear.value = Math.max(firstYear, startYear.value);
      endYear.value = Math.min(lastYear, endYear.value);
      if (startYear.value > endYear.value) {
        startYear.value = firstYear;
        endYear.value = lastYear;
      }
    }
  }
}, { immediate: true });

// Filtered Active Stock History
const filteredHistory = computed(() => {
  if (!fetchedStockData.value || !fetchedStockData.value.history) return [];
  return fetchedStockData.value.history.filter(
    (h: any) => h.year >= startYear.value && h.year <= endYear.value
  );
});

// Filtered IHSG History
const filteredIhsgHistory = computed(() => {
  if (!fetchedIhsgData.value || !fetchedIhsgData.value.history) return [];
  return fetchedIhsgData.value.history.filter(
    (h: any) => h.year >= startYear.value && h.year <= endYear.value
  );
});

// Computed seasonal metrics
const seasonalStats = computed(() => {
  return calculateSeasonalStats(filteredHistory.value, selectedPeriodType.value);
});

const dashboardSummary = computed(() => {
  if (seasonalStats.value.length === 0) {
    return {
      avgReturn: 0,
      winRate: 0,
      bestPeriod: null,
      worstPeriod: null,
      totalYears: 0
    };
  }
  return calculateDashboardSummary(
    seasonalStats.value,
    filteredHistory.value,
    selectedPeriodType.value
  );
});

const insights = computed(() => {
  if (!fetchedStockData.value) return [];
  return generateInsights(
    fetchedStockData.value.code,
    fetchedStockData.value.name,
    seasonalStats.value,
    dashboardSummary.value,
    filteredHistory.value,
    selectedPeriodType.value
  );
});

const ihsgSeasonalStats = computed(() => {
  return calculateSeasonalStats(filteredIhsgHistory.value, selectedPeriodType.value);
});

// Actionable signal for the current & upcoming month (monthly view only)
const monthlySignal = computed(() => {
  if (selectedPeriodType.value !== 'monthly') return null;
  const curIdx = new Date().getMonth(); // 0-11
  const nextIdx = (curIdx + 1) % 12;
  const find = (idx: number) =>
    seasonalStats.value.find((s) => s.periodLabel === MONTH_LABELS[idx]) || null;
  return {
    current: { label: MONTH_LABELS[curIdx], stat: find(curIdx) },
    next: { label: MONTH_LABELS[nextIdx], stat: find(nextIdx) }
  };
});

// Classify a period's historical bias into a colour + verdict for the banner
function signalMeta(stat: { avgReturn: number; winRate: number } | null) {
  if (!stat) return { cls: 'border-slate-800 bg-slate-900/40 text-slate-300', verdict: 'Data belum cukup' };
  if (stat.avgReturn > 0 && stat.winRate >= 55)
    return { cls: 'border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-300', verdict: 'Cenderung bullish' };
  if (stat.avgReturn < 0 || stat.winRate <= 45)
    return { cls: 'border-rose-500/25 bg-rose-500/[0.06] text-rose-300', verdict: 'Cenderung bearish' };
  return { cls: 'border-amber-500/25 bg-amber-500/[0.06] text-amber-300', verdict: 'Netral / campuran' };
}
</script>

<template>
  <div class="pb-16 bg-slate-950 text-slate-100 flex flex-col flex-grow">
    <!-- Main Content Container -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 mt-8 flex-grow w-full space-y-6">
      
      <!-- Filters Panel -->
      <section class="glow-card rounded-2xl p-6">
        <h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Pengaturan Analisis</h2>
        
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          <!-- Stock Selector (live autocomplete over all IDX) -->
          <div class="flex flex-col gap-2 sm:col-span-2">
            <label class="text-xs font-semibold text-slate-400">Kode Saham / Indeks</label>
            <StockSearch v-model="activeSymbol" />
          </div>

          
          <!-- Period Type Selector -->
          <div class="flex flex-col gap-2">
            <label class="text-xs font-semibold text-slate-400">Jenis Periode</label>
            <div class="grid grid-cols-3 bg-slate-900 p-1 border border-slate-800 rounded-xl">
              <button 
                type="button"
                @click="selectedPeriodType = 'monthly'"
                class="py-1.5 text-xs font-semibold rounded-lg transition-all"
                :class="selectedPeriodType === 'monthly' ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/10' : 'text-slate-400 hover:text-slate-200'"
              >
                Bulanan
              </button>
              <button 
                type="button"
                @click="selectedPeriodType = 'quarterly'"
                class="py-1.5 text-xs font-semibold rounded-lg transition-all"
                :class="selectedPeriodType === 'quarterly' ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/10' : 'text-slate-400 hover:text-slate-200'"
              >
                Kuartalan
              </button>
              <button 
                type="button"
                @click="selectedPeriodType = 'yearly'"
                class="py-1.5 text-xs font-semibold rounded-lg transition-all"
                :class="selectedPeriodType === 'yearly' ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/10' : 'text-slate-400 hover:text-slate-200'"
              >
                Tahunan
              </button>
            </div>
          </div>

          <!-- Year Start Selector -->
          <div class="flex flex-col gap-2">
            <label for="yearStart" class="text-xs font-semibold text-slate-400">Tahun Mulai</label>
            <select 
              id="yearStart"
              v-model="startYear"
              :disabled="allAvailableYears.length === 0"
              class="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-50"
            >
              <option 
                v-for="year in allAvailableYears.filter(y => y <= endYear)" 
                :key="year" 
                :value="year"
              >
                {{ year }}
              </option>
            </select>
          </div>

          <!-- Year End Selector -->
          <div class="flex flex-col gap-2">
            <label for="yearEnd" class="text-xs font-semibold text-slate-400">Tahun Selesai</label>
            <select 
              id="yearEnd"
              v-model="endYear"
              :disabled="allAvailableYears.length === 0"
              class="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-50"
            >
              <option 
                v-for="year in allAvailableYears.filter(y => y >= startYear)" 
                :key="year" 
                :value="year"
              >
                {{ year }}
              </option>
            </select>
          </div>
        </div>
      </section>

      <!-- Error State Warning -->
      <div v-if="stockError" class="p-6 rounded-2xl bg-rose-500/5 border border-rose-500/20 text-rose-200">
        <div class="flex gap-4 items-start">
          <div class="p-2 bg-rose-500/10 text-rose-400 rounded-xl flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div class="flex-grow">
            <h5 class="text-base font-bold text-rose-400 mb-1">Gagal Memuat Data Saham</h5>
            <p class="text-sm text-rose-300/90 mb-4 leading-relaxed">
              Kode Saham <strong class="text-rose-100 font-bold">"{{ activeSymbol }}"</strong> gagal diambil dari Yahoo Finance. Pastikan kode saham terdaftar di Bursa Efek Indonesia (IDX) (contoh: <code>BUMI</code>, <code>GOTO</code>, atau <code>ASII</code>).
            </p>
            <button 
              type="button"
              @click="activeSymbol = 'BBCA'"
              class="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-455 border border-rose-500/35 font-semibold text-xs rounded-xl transition-all"
            >
              Kembali ke Saham BBCA
            </button>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-else-if="isStockPending" class="py-20 flex flex-col items-center justify-center gap-4 bg-slate-900/30 border border-slate-900 rounded-2xl">
        <div class="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p class="text-sm text-slate-400 font-medium animate-pulse">Mengambil data harga historis dari Yahoo Finance...</p>
      </div>

      <!-- Active Dashboard Content (Once loaded) -->
      <div v-else-if="fetchedStockData" class="space-y-6">
        <!-- Summary Info Cards -->
        <section>
          <SeasonalSummaryCards
            :summary="dashboardSummary"
            :period-type="selectedPeriodType"
          />
        </section>

        <!-- Actionable Signal: current & upcoming month -->
        <section v-if="monthlySignal" class="glow-card rounded-2xl p-5">
          <div class="flex items-center gap-2 mb-4">
            <span class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Sinyal Musiman Bulan Ini</span>
            <span class="text-[10px] text-slate-500">• berdasarkan {{ dashboardSummary.totalYears }} tahun data</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div
              v-for="item in [monthlySignal.current, monthlySignal.next]"
              :key="item.label"
              class="rounded-xl border p-4"
              :class="signalMeta(item.stat).cls"
            >
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-bold text-slate-100">{{ item.label }}
                  <span class="text-[10px] font-medium text-slate-400 ml-1">{{ item === monthlySignal.current ? 'bulan berjalan' : 'bulan depan' }}</span>
                </span>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border" :class="signalMeta(item.stat).cls">
                  {{ signalMeta(item.stat).verdict }}
                </span>
              </div>
              <div v-if="item.stat" class="flex items-end gap-5">
                <div>
                  <p class="text-[10px] text-slate-500 uppercase tracking-wide">Rata-rata Return</p>
                  <p class="text-xl font-extrabold" :class="item.stat.avgReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'">
                    {{ item.stat.avgReturn >= 0 ? '+' : '' }}{{ item.stat.avgReturn }}%
                  </p>
                </div>
                <div>
                  <p class="text-[10px] text-slate-500 uppercase tracking-wide">Win Rate</p>
                  <p class="text-xl font-extrabold text-slate-100">{{ item.stat.winRate }}%</p>
                </div>
                <div>
                  <p class="text-[10px] text-slate-500 uppercase tracking-wide">Naik / Turun</p>
                  <p class="text-sm font-bold text-slate-300 mt-1">{{ item.stat.yearsUp }} / {{ item.stat.yearsDown }} thn</p>
                </div>
              </div>
              <p v-else class="text-xs text-slate-400">Belum ada data historis untuk bulan ini.</p>
            </div>
          </div>
          <p class="text-[11px] text-slate-500 mt-3">
            Ganti periode ke <strong class="text-slate-300">Bulanan</strong> untuk melihat sinyal ini. Kinerja historis bukan jaminan masa depan.
          </p>
        </section>

        <!-- Bar Chart (Full Width) -->
        <section>
          <SeasonalBarChart 
            :stats="seasonalStats" 
            :ihsg-stats="ihsgSeasonalStats"
            :stock-code="fetchedStockData.code"
          />
        </section>

        <!-- Automated Insights (Full Width) -->
        <section>
          <SeasonalInsight 
            :insights="insights" 
            :stock-code="fetchedStockData.code"
          />
        </section>

        <!-- Heatmap (Full width) -->
        <section>
          <SeasonalHeatmap 
            :history="filteredHistory" 
            :stats="seasonalStats"
            :period-type="selectedPeriodType"
            :stock-code="fetchedStockData.code"
          />
        </section>

        <!-- Table Section (Full width) -->
        <section>
          <SeasonalTable 
            :stats="seasonalStats" 
            :period-type="selectedPeriodType" 
          />
        </section>
      </div>

      <!-- Warning Disclaimer -->
      <footer class="p-6 rounded-2xl bg-rose-500/5 border border-rose-500/10 text-slate-350">
        <div class="flex gap-4 items-start">
          <div class="p-1 bg-rose-500/15 text-rose-400 rounded-lg flex-shrink-0 mt-0.5">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
          </div>
          <div>
            <h5 class="text-sm font-semibold text-rose-400 mb-1">Catatan Risiko Penting</h5>
            <p class="text-xs leading-relaxed text-slate-400">
              Analisis performa musiman saham di atas didasarkan sepenuhnya pada data historis. Kinerja masa lalu tidak menjamin, menggambarkan, atau menjadi indikator mutlak performa harga saham di masa mendatang. Kondisi makro ekonomi, kebijakan emiten, serta sentimen pasar terkini dapat mengubah kecenderungan pergerakan harga secara signifikan. Berinvestasi dalam instrumen saham mengandung risiko pasar. Lakukan analisis fundamental dan manajemen risiko yang matang sebelum mengambil keputusan investasi.
            </p>
          </div>
        </div>
      </footer>

    </main>
  </div>
</template>
