<script setup lang="ts">
import { ref, computed } from 'vue';
import { seasonalStocks } from '../../data/seasonalStocks';
import type { PeriodType } from '../../types/seasonal';
import {
  filterStockData,
  getAvailableYears,
  calculateSeasonalStats,
  calculateDashboardSummary,
  generateInsights
} from '../../utils/seasonalCalculator';

// Page Title and SEO Meta
useHead({
  title: 'Seasonal Saham Analytics - Pola Performa Historis',
  meta: [
    { name: 'description', content: 'Analisis pola musiman pergerakan harga saham Indonesia berdasarkan data historis bulanan, kuartalan, dan tahunan.' }
  ]
});

// Selection States
const selectedStockCode = ref('BBCA');
const selectedPeriodType = ref<PeriodType>('monthly');

// Find active stock and its year boundaries
const activeStock = computed(() => {
  return seasonalStocks.find(s => s.code === selectedStockCode.value) || seasonalStocks[0];
});

const allAvailableYears = computed(() => {
  return getAvailableYears(activeStock.value);
});

// Year range filters
const startYear = ref(2015);
const endYear = ref(2025);

// Sync year bounds when stock changes
watch(activeStock, (newStock) => {
  const years = getAvailableYears(newStock);
  if (years.length > 0) {
    startYear.value = Math.max(years[0], startYear.value);
    endYear.value = Math.min(years[years.length - 1], endYear.value);
    if (startYear.value > endYear.value) {
      startYear.value = years[0];
      endYear.value = years[years.length - 1];
    }
  }
}, { immediate: true });

// Filtered Stock Data
const filteredData = computed(() => {
  return filterStockData(
    seasonalStocks,
    selectedStockCode.value,
    startYear.value,
    endYear.value
  );
});

// Computed seasonal metrics
const seasonalStats = computed(() => {
  if (!filteredData.value) return [];
  return calculateSeasonalStats(filteredData.value.history, selectedPeriodType.value);
});

const dashboardSummary = computed(() => {
  if (!filteredData.value || seasonalStats.value.length === 0) {
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
    filteredData.value.history,
    selectedPeriodType.value
  );
});

const insights = computed(() => {
  if (!filteredData.value) return [];
  return generateInsights(
    filteredData.value.code,
    filteredData.value.name,
    seasonalStats.value,
    dashboardSummary.value,
    filteredData.value.history,
    selectedPeriodType.value
  );
});
</script>

<template>
  <div class="min-h-screen pb-16 bg-slate-950 text-slate-100 flex flex-col">
    <!-- Navigation Header -->
    <header class="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30 px-6 py-4">
      <div class="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
        <!-- Logo -->
        <div class="flex items-center gap-3">
          <div class="p-2 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl shadow-lg shadow-emerald-500/10">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-slate-950" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div>
            <h1 class="text-xl font-bold text-slate-50 tracking-tight flex items-center gap-2">
              Antigravity Seasonal <span class="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">PRO</span>
            </h1>
            <p class="text-xs text-slate-400">Analisis Pola Historis Musiman Saham</p>
          </div>
        </div>

        <!-- System Time display / metadata -->
        <div class="text-right hidden md:block">
          <p class="text-xs text-slate-500">Workspace: analisis_saham</p>
          <p class="text-xs text-slate-400">Indikator Terkini</p>
        </div>
      </div>
    </header>

    <!-- Main Content Container -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 mt-8 flex-grow w-full space-y-6">
      
      <!-- Filters Panel -->
      <section class="glow-card rounded-2xl p-6">
        <h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Pengaturan Analisis</h2>
        
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <!-- Stock Selector -->
          <div class="flex flex-col gap-2">
            <label for="stockSelect" class="text-xs font-semibold text-slate-400">Kode Saham</label>
            <select 
              id="stockSelect"
              v-model="selectedStockCode"
              class="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
            >
              <option v-for="stock in seasonalStocks" :key="stock.code" :value="stock.code">
                {{ stock.code }} - {{ stock.name }}
              </option>
            </select>
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
              class="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors"
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
              class="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors"
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

      <!-- Summary Info Cards -->
      <section v-if="filteredData">
        <SeasonalSummaryCards 
          :summary="dashboardSummary" 
          :period-type="selectedPeriodType" 
        />
      </section>

      <!-- Charts grid (Bar Chart and Insights side-by-side on desktop) -->
      <section class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        <!-- Bar Chart (Span 2) -->
        <div class="lg:col-span-2 flex flex-col">
          <SeasonalBarChart 
            :stats="seasonalStats" 
            :stock-code="selectedStockCode"
            class="flex-grow"
          />
        </div>

        <!-- Automated Insights (Span 1) -->
        <div class="flex flex-col">
          <SeasonalInsight 
            :insights="insights" 
            :stock-code="selectedStockCode"
            class="flex-grow"
          />
        </div>
      </section>

      <!-- Heatmap (Full width) -->
      <section v-if="filteredData">
        <SeasonalHeatmap 
          :history="filteredData.history" 
          :stats="seasonalStats"
          :period-type="selectedPeriodType"
          :stock-code="selectedStockCode"
        />
      </section>

      <!-- Table Section (Full width) -->
      <section>
        <SeasonalTable 
          :stats="seasonalStats" 
          :period-type="selectedPeriodType" 
        />
      </section>

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
