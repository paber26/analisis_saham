<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { seasonalStocks } from '../../data/seasonalStocks';
import type { PeriodType } from '../../types/seasonal';
import {
  calculateSeasonalStats,
  calculateDashboardSummary,
  generateInsights
} from '../../utils/seasonalCalculator';

// Page Title and SEO Meta
useHead({
  title: 'Seasonal Saham Indonesia (IDX) - Pola Performa Historis',
  meta: [
    { name: 'description', content: 'Analisis pola musiman pergerakan harga saham Indonesia berdasarkan data historis bulanan, kuartalan, dan tahunan.' }
  ]
});

// Selection States
const selectedStockCode = ref('BBCA');
const selectedPeriodType = ref<PeriodType>('monthly');

const searchSymbolQuery = ref('');
const activeSymbol = ref('BBCA');

// Sync activeSymbol when dropdown changes
watch(selectedStockCode, (newCode) => {
  if (newCode !== 'CUSTOM') {
    activeSymbol.value = newCode;
    searchSymbolQuery.value = '';
  } else {
    // Default to Indonesian stock BUMI when custom search is selected
    searchSymbolQuery.value = 'BUMI';
    activeSymbol.value = 'BUMI';
  }
});

const handleCustomSearch = () => {
  const query = searchSymbolQuery.value.trim().toUpperCase();
  if (query) {
    activeSymbol.value = query;
  }
};

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

const allAvailableYears = computed(() => {
  if (!fetchedStockData.value || !fetchedStockData.value.history) return [];
  const years = fetchedStockData.value.history.map((h: any) => h.year);
  return Array.from(new Set(years)).sort((a: any, b: any) => a - b);
});

// Year range filters
const startYear = ref(2015);
const endYear = ref(2025);

// Sync year bounds when fetched stock data updates
watch(allAvailableYears, (years) => {
  if (years.length > 0) {
    startYear.value = Math.max(years[0], startYear.value);
    endYear.value = Math.min(years[years.length - 1], endYear.value);
    if (startYear.value > endYear.value) {
      startYear.value = years[0];
      endYear.value = years[years.length - 1];
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
              Seasonal IDX <span class="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">INDONESIA</span>
            </h1>
            <p class="text-xs text-slate-400">Analisis Pola Historis Musiman Saham BEI</p>
          </div>
        </div>

        <!-- Docs Link Button -->
        <div class="flex items-center gap-4">
          <a 
            href="/docs.html"
            target="_blank"
            class="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-emerald-400 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-850 hover:border-slate-700 hover:text-emerald-350 transition-all shadow-md shadow-emerald-500/5 group"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-emerald-500 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span>Panduan Integrasi API & Data</span>
          </a>
          
          <div class="text-right hidden lg:block border-l border-slate-800 pl-4">
            <p class="text-xs text-slate-500">Workspace: analisis_saham</p>
            <p class="text-xs text-slate-400">Indikator Terkini</p>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content Container -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 mt-8 flex-grow w-full space-y-6">
      
      <!-- Filters Panel -->
      <section class="glow-card rounded-2xl p-6">
        <h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Pengaturan Analisis</h2>
        
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          <!-- Stock Selector -->
          <div class="flex flex-col gap-2">
            <label for="stockSelect" class="text-xs font-semibold text-slate-400">Kode Saham / Indeks</label>
            <select 
              id="stockSelect"
              v-model="selectedStockCode"
              class="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
            >
              <option value="IHSG">IHSG - Indeks Harga Saham Gabungan</option>
              
              <optgroup label="Perbankan & Keuangan">
                <option value="BBCA">BBCA - Bank Central Asia Tbk</option>
                <option value="BBRI">BBRI - Bank Rakyat Indonesia Tbk</option>
                <option value="BMRI">BMRI - Bank Mandiri Tbk</option>
                <option value="BBNI">BBNI - Bank Negara Indonesia Tbk</option>
                <option value="BBTN">BBTN - Bank Tabungan Negara Tbk</option>
              </optgroup>
              
              <optgroup label="Energi & Tambang">
                <option value="ADRO">ADRO - Adaro Energy Indonesia Tbk</option>
                <option value="PTBA">PTBA - Bukit Asam Tbk</option>
                <option value="BUMI">BUMI - Bumi Resources Tbk</option>
                <option value="MEDC">MEDC - Medco Energi Internasional Tbk</option>
                <option value="HRUM">HRUM - Harum Energy Tbk</option>
              </optgroup>
              
              <optgroup label="Infrastruktur & Telko">
                <option value="TLKM">TLKM - Telkom Indonesia Tbk</option>
                <option value="ISAT">ISAT - Indosat Ooredoo Hutchison Tbk</option>
                <option value="EXCL">EXCL - XL Axiata Tbk</option>
                <option value="JSMR">JSMR - Jasa Marga Tbk</option>
                <option value="PGAS">PGAS - Perusahaan Gas Negara Tbk</option>
              </optgroup>
              
              <optgroup label="Konsumer Non-Primer (Siklikal/Ritel)">
                <option value="UNVR">UNVR - Unilever Indonesia Tbk</option>
                <option value="ICBP">ICBP - Indofood CBP Sukses Makmur Tbk</option>
                <option value="INDF">INDF - Indofood Sukses Makmur Tbk</option>
                <option value="MYOR">MYOR - Mayora Indah Tbk</option>
                <option value="ACES">ACES - Aspirasi Hidup Indonesia Tbk (Ace Hardware)</option>
              </optgroup>
              
              <optgroup label="Barang Baku & Logam">
                <option value="ANTM">ANTM - Aneka Tambang Tbk</option>
                <option value="INCO">INCO - Vale Indonesia Tbk</option>
                <option value="TPIA">TPIA - Chandra Asri Pacific Tbk</option>
                <option value="KRAS">KRAS - Krakatau Steel Tbk</option>
                <option value="MDKA">MDKA - Merdeka Gold Copper Tbk</option>
              </optgroup>
              
              <optgroup label="Industri & Otomotif">
                <option value="ASII">ASII - Astra International Tbk</option>
                <option value="UNTR">UNTR - United Tractors Tbk</option>
              </optgroup>
              
              <optgroup label="Teknologi & Digital">
                <option value="GOTO">GOTO - GoTo Gojek Tokopedia Tbk</option>
                <option value="BUKA">BUKA - Bukalapak.com Tbk</option>
              </optgroup>
              
              <optgroup label="Kesehatan & Farmasi">
                <option value="KLBF">KLBF - Kalbe Farma Tbk</option>
                <option value="MIKA">MIKA - Mitra Keluarga Karyasehat Tbk</option>
              </optgroup>
              
              <optgroup label="Properti & Real Estate">
                <option value="BSDE">BSDE - Bumi Serpong Damai Tbk</option>
                <option value="PWON">PWON - Pakuwon Jati Tbk</option>
                <option value="SMRA">SMRA - Summarecon Agung Tbk</option>
              </optgroup>
              
              <option value="CUSTOM">Cari Kode Saham IDX Lainnya...</option>
            </select>
          </div>

          <!-- Custom Symbol Search (Only show if CUSTOM is selected) -->
          <div v-if="selectedStockCode === 'CUSTOM'" class="flex flex-col gap-2">
            <label for="customSearch" class="text-xs font-semibold text-slate-400">Simbol Kustom (contoh: BUMI, GOTO)</label>
            <div class="flex gap-2">
              <input 
                id="customSearch"
                v-model="searchSymbolQuery"
                type="text"
                placeholder="Kode Saham (misal: BUMI, GOTO)"
                @keyup.enter="handleCustomSearch"
                class="flex-grow min-w-0 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors"
              />
              <button 
                type="button"
                @click="handleCustomSearch"
                class="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-colors whitespace-nowrap"
              >
                Cari
              </button>
            </div>
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
              @click="selectedStockCode = 'BBCA'"
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

        <!-- Charts grid (Bar Chart and Insights side-by-side on desktop) -->
        <section class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          <!-- Bar Chart (Span 2) -->
          <div class="lg:col-span-2 flex flex-col">
            <SeasonalBarChart 
              :stats="seasonalStats" 
              :ihsg-stats="ihsgSeasonalStats"
              :stock-code="fetchedStockData.code"
              class="flex-grow"
            />
          </div>

          <!-- Automated Insights (Span 1) -->
          <div class="flex flex-col">
            <SeasonalInsight 
              :insights="insights" 
              :stock-code="fetchedStockData.code"
              class="flex-grow"
            />
          </div>
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
