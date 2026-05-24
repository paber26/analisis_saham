<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { getStockFundamentals } from '../../data/stockFundamentals';

// Page Title and SEO Meta
useHead({
  title: 'Detail Harga Harian & Profil Keuangan Saham IDX',
  meta: [
    { name: 'description', content: 'Informasi harga penutupan harian, statistik pergerakan pasar harian, dan ringkasan rasio keuangan fundamental emiten BEI.' }
  ]
});

// Selection States
const selectedStockCode = ref('BBCA');
const searchSymbolQuery = ref('');
const activeSymbol = ref('BBCA');
const selectedRange = ref<'1m' | '3m'>('3m');

// Sync activeSymbol when dropdown changes
watch(selectedStockCode, (newCode) => {
  if (newCode !== 'CUSTOM') {
    activeSymbol.value = newCode;
    searchSymbolQuery.value = '';
  } else {
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

// Fetch live stock details from server API
const {
  data: stockDetail,
  pending: isPending,
  error: fetchError
} = await useFetch<any>(() => '/api/detail', {
  params: { symbol: activeSymbol },
  watch: [activeSymbol]
});

// Get fundamental mapping
const fundamentalData = computed(() => {
  return getStockFundamentals(activeSymbol.value);
});

// Calculate live metrics based on real-time price
const computedMarketCap = computed(() => {
  if (!stockDetail.value) return 0;
  return stockDetail.value.currentPrice * fundamentalData.value.sharesOutstanding * 1000000000;
});

const computedPE = computed(() => {
  if (!stockDetail.value || fundamentalData.value.eps === 0) return 'N/A';
  if (fundamentalData.value.eps < 0) return 'Negatif';
  return (stockDetail.value.currentPrice / fundamentalData.value.eps).toFixed(2);
});

const computedPB = computed(() => {
  if (!stockDetail.value || fundamentalData.value.bvps === 0) return 'N/A';
  if (fundamentalData.value.bvps < 0) return 'Negatif';
  return (stockDetail.value.currentPrice / fundamentalData.value.bvps).toFixed(2);
});

const computedDivYield = computed(() => {
  if (!stockDetail.value || fundamentalData.value.dps === 0) return '0.00%';
  return ((fundamentalData.value.dps / stockDetail.value.currentPrice) * 100).toFixed(2) + '%';
});

// Format volume helper
const formatLargeNumber = (num: number, suffix = '') => {
  if (num >= 1e12) return (num / 1e12).toFixed(2) + ' T' + suffix;
  if (num >= 1e9) return (num / 1e9).toFixed(2) + ' B' + suffix;
  if (num >= 1e6) return (num / 1e6).toFixed(2) + ' M' + suffix;
  return num.toLocaleString('id-ID') + suffix;
};

// Calculate Sitting Position inside 52-Week Range
const sliderPercentage = computed(() => {
  if (!stockDetail.value) return 0;
  const high = stockDetail.value.fiftyTwoWeekHigh;
  const low = stockDetail.value.fiftyTwoWeekLow;
  const curr = stockDetail.value.currentPrice;
  if (high === low) return 50;
  const pct = ((curr - low) / (high - low)) * 100;
  return Math.min(Math.max(Math.round(pct), 0), 100);
});

// Daily Chart Configuration
const chartOption = computed(() => {
  if (!stockDetail.value || !stockDetail.value.history || stockDetail.value.history.length === 0) return {};
  
  // Create copy of history and reverse to chronological order (oldest first)
  let rawHistory = [...stockDetail.value.history].reverse();
  if (selectedRange.value === '1m') {
    rawHistory = rawHistory.slice(-20);
  }
  
  const dates = rawHistory.map((h: any) => h.date);
  const prices = rawHistory.map((h: any) => h.close);

  return {
    backgroundColor: 'transparent',
    grid: {
      left: '3%',
      right: '3%',
      bottom: '5%',
      top: '12%',
      containLabel: true
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0f172a',
      borderColor: '#334155',
      borderWidth: 1,
      textStyle: { color: '#f8fafc', fontSize: 12, fontFamily: 'inherit' },
      padding: [10, 14],
      formatter: (params: any) => {
        const item = params[0];
        if (!item) return '';
        const date = item.name;
        const val = item.value;
        const index = item.dataIndex;
        const record = rawHistory[index];
        if (!record) return '';
        const color = record.changeVal >= 0 ? '#34d399' : '#f87171';
        const sign = record.changeVal > 0 ? '+' : '';
        
        return `
          <div style="font-family: inherit;">
            <div style="font-weight: 600; margin-bottom: 6px; color: #94a3b8; font-size: 13px;">${date}</div>
            <div style="display: flex; justify-content: space-between; gap: 24px; margin-bottom: 4px;">
              <span style="color: #cbd5e1;">Close:</span>
              <span style="font-weight: 700; color: #f8fafc;">${val.toLocaleString('id-ID')} IDR</span>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 24px; margin-bottom: 4px;">
              <span style="color: #cbd5e1;">Perubahan:</span>
              <span style="font-weight: 700; color: ${color};">${sign}${record.changeVal.toLocaleString('id-ID')} (${sign}${record.changePct.toFixed(2)}%)</span>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 24px; margin-bottom: 4px;">
              <span style="color: #cbd5e1;">Open / Vol:</span>
              <span style="font-weight: 500; color: #cbd5e1;">${record.open.toLocaleString('id-ID')} / ${record.volume.toLocaleString('id-ID')}</span>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 24px;">
              <span style="color: #cbd5e1;">High - Low:</span>
              <span style="font-weight: 500; color: #94a3b8;">${record.low.toLocaleString('id-ID')} - ${record.high.toLocaleString('id-ID')}</span>
            </div>
          </div>
        `;
      }
    },
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: { lineStyle: { color: '#334155' } },
      axisLabel: { color: '#94a3b8', fontSize: 10, fontFamily: 'inherit' },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisLabel: {
        color: '#94a3b8',
        fontFamily: 'inherit',
        fontSize: 10,
        formatter: (val: number) => val.toLocaleString('id-ID')
      },
      splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } }
    },
    series: [
      {
        name: 'Harga Harian',
        type: 'line',
        showSymbol: false,
        smooth: true,
        lineStyle: {
          width: 3,
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: '#10b981' },
              { offset: 1, color: '#06b6d4' }
            ]
          }
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(16, 185, 129, 0.2)' },
              { offset: 1, color: 'rgba(6, 182, 212, 0)' }
            ]
          }
        },
        data: prices
      }
    ]
  };
});
</script>

<template>
  <div class="pb-16 bg-slate-950 text-slate-100 flex flex-col flex-grow">
    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 mt-8 flex-grow w-full space-y-6">
      
      <!-- Filters Panel -->
      <section class="glow-card rounded-2xl p-6">
        <h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Pilih Saham untuk Informasi Detail</h2>
        
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          <!-- Stock Selector -->
          <div class="flex flex-col gap-2">
            <label for="stockSelect" class="text-xs font-semibold text-slate-400">Kode Saham Preset</label>
            <select 
              id="stockSelect"
              v-model="selectedStockCode"
              class="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
            >
              <optgroup label="Indeks">
                <option value="IHSG">IHSG - Indeks Harga Saham Gabungan</option>
              </optgroup>
              
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
                <option value="ACES">ACES - Aspirasi Hidup Indonesia Tbk</option>
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
              
              <option value="CUSTOM">Pencarian Simbol Kustom...</option>
            </select>
          </div>

          <!-- Custom Ticker Search -->
          <div v-if="selectedStockCode === 'CUSTOM'" class="flex flex-col gap-2 xl:col-span-2">
            <label for="customSearch" class="text-xs font-semibold text-slate-400">Masukkan Simbol Saham BEI</label>
            <div class="flex gap-2">
              <input 
                id="customSearch"
                v-model="searchSymbolQuery"
                type="text"
                placeholder="Contoh: BUMI, GOTO, ASII"
                class="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 w-full uppercase"
                @keyup.enter="handleCustomSearch"
              />
              <button 
                type="button"
                @click="handleCustomSearch"
                class="bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-slate-950 px-4 py-2.5 rounded-xl font-bold text-xs transition-all uppercase tracking-wider"
              >
                Cari
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Error State -->
      <div v-if="fetchError" class="p-6 rounded-2xl bg-rose-500/5 border border-rose-500/20 text-rose-200">
        <div class="flex gap-4 items-start">
          <div class="p-2 bg-rose-500/10 text-rose-400 rounded-xl flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div class="flex-grow">
            <h5 class="text-base font-bold text-rose-400 mb-1">Gagal Memuat Informasi Detail</h5>
            <p class="text-sm text-rose-300/90 mb-4 leading-relaxed">
              Detail untuk simbol <strong class="text-rose-100 font-bold">"{{ activeSymbol }}"</strong> gagal diambil dari Yahoo Finance. Periksa kembali ticker yang Anda ketikkan atau coba gunakan kode preset terdaftar.
            </p>
            <button 
              type="button"
              @click="selectedStockCode = 'BBCA'"
              class="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-350 border border-rose-500/30 font-semibold text-xs rounded-xl transition-all"
            >
              Kembali ke Saham BBCA
            </button>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-else-if="isPending" class="py-24 flex flex-col items-center justify-center gap-4 bg-slate-900/20 border border-slate-900 rounded-2xl">
        <div class="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p class="text-sm text-slate-400 font-medium animate-pulse">Mengambil data penutupan harian dan profil emiten...</p>
      </div>

      <!-- Content State (Loaded) -->
      <div v-else-if="stockDetail" class="space-y-6">
        
        <!-- Header Info Cards & Price Quote -->
        <section class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <!-- Core Quote (Span 2) -->
          <div class="lg:col-span-2 glow-card p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden">
            <div>
              <div class="flex justify-between items-start gap-4 mb-2">
                <div>
                  <span class="text-[10px] font-bold text-emerald-400 tracking-wider bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md uppercase">
                    {{ stockDetail.exchange }} : {{ stockDetail.currency }}
                  </span>
                  <h3 class="text-xl font-bold text-slate-100 mt-2">{{ stockDetail.name }}</h3>
                  <p class="text-sm font-semibold text-slate-400 mt-0.5">{{ stockDetail.symbol }}</p>
                </div>
                
                <div class="text-right">
                  <div class="text-3xl font-extrabold text-slate-50 tracking-tight">
                    {{ stockDetail.currentPrice.toLocaleString('id-ID') }}
                  </div>
                  
                  <!-- Price changes -->
                  <div 
                    class="text-sm font-bold mt-1 flex items-center justify-end gap-1.5"
                    :class="[stockDetail.currentPrice - stockDetail.previousClose >= 0 ? 'text-emerald-400' : 'text-rose-400']"
                  >
                    <span>
                      {{ stockDetail.currentPrice - stockDetail.previousClose >= 0 ? '▲' : '▼' }}
                    </span>
                    <span>
                      {{ Math.abs(stockDetail.currentPrice - stockDetail.previousClose).toLocaleString('id-ID') }} 
                      ({{ (stockDetail.currentPrice - stockDetail.previousClose >= 0 ? '+' : '') }}{{ (((stockDetail.currentPrice - stockDetail.previousClose) / stockDetail.previousClose) * 100).toFixed(2) }}%)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Divider -->
            <div class="border-t border-slate-900 my-4"></div>

            <!-- Quick Data Grid -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2">
              <div class="p-3 bg-slate-900/40 border border-slate-900 rounded-xl">
                <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Harga Buka</span>
                <span class="text-sm font-bold text-slate-200 mt-1 block">
                  {{ stockDetail.history && stockDetail.history[0] ? stockDetail.history[0].open.toLocaleString('id-ID') : '-' }}
                </span>
              </div>
              <div class="p-3 bg-slate-900/40 border border-slate-900 rounded-xl">
                <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Tertinggi Harian</span>
                <span class="text-sm font-bold text-slate-200 mt-1 block">
                  {{ stockDetail.dayHigh.toLocaleString('id-ID') }}
                </span>
              </div>
              <div class="p-3 bg-slate-900/40 border border-slate-900 rounded-xl">
                <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Terendah Harian</span>
                <span class="text-sm font-bold text-slate-200 mt-1 block">
                  {{ stockDetail.dayLow.toLocaleString('id-ID') }}
                </span>
              </div>
              <div class="p-3 bg-slate-900/40 border border-slate-900 rounded-xl">
                <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Prev Close</span>
                <span class="text-sm font-bold text-slate-200 mt-1 block">
                  {{ stockDetail.previousClose.toLocaleString('id-ID') }}
                </span>
              </div>
            </div>
          </div>

          <!-- 52-Week Range Bar (Span 1) -->
          <div class="glow-card p-6 rounded-2xl flex flex-col justify-between">
            <div>
              <h4 class="text-sm font-bold text-slate-300 uppercase tracking-wider">Rentang 52 Minggu</h4>
              <p class="text-xs text-slate-500 mt-1">Mengukur posisi harga saat ini dalam setahun terakhir</p>
            </div>

            <!-- Visual Bar Slider -->
            <div class="my-6">
              <div class="flex justify-between text-xs text-slate-400 font-semibold mb-2">
                <span>Min: {{ stockDetail.fiftyTwoWeekLow.toLocaleString('id-ID') }}</span>
                <span>Max: {{ stockDetail.fiftyTwoWeekHigh.toLocaleString('id-ID') }}</span>
              </div>
              
              <!-- Track -->
              <div class="w-full h-3 bg-slate-900 border border-slate-800 rounded-full relative overflow-visible">
                <!-- Highlight active segment -->
                <div 
                  class="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full absolute left-0"
                  :style="{ width: `${sliderPercentage}%` }"
                ></div>
                <!-- Pin Pointer -->
                <div 
                  class="w-4 h-4 rounded-full bg-slate-50 border-3 border-emerald-500 shadow-md absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-default"
                  :style="{ left: `${sliderPercentage}%` }"
                ></div>
              </div>
              
              <div class="text-right text-[10px] text-slate-400 mt-2 font-medium">
                Posisi saat ini: <strong class="text-emerald-400 font-bold">{{ sliderPercentage }}%</strong> dari batas bawah
              </div>
            </div>

            <div class="p-3 bg-slate-900/30 border border-slate-900 rounded-xl text-center">
              <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Volume Hari Ini</span>
              <span class="text-base font-bold text-slate-200 mt-1 block">
                {{ formatLargeNumber(stockDetail.volume, ' Lembar') }}
              </span>
            </div>
          </div>

        </section>

        <!-- Daily Price Chart (Full Width) -->
        <section class="glow-card p-6 rounded-2xl">
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div>
              <h4 class="text-lg font-bold text-slate-100">Grafik Pergerakan Harga Penutupan Harian</h4>
              <p class="text-xs text-slate-400">Harga perdagangan harian terakhir emiten {{ stockDetail.symbol }}</p>
            </div>
            
            <!-- Time Range Tabs -->
            <div class="flex bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs font-bold text-slate-400">
              <button 
                type="button" 
                class="px-4 py-2 rounded-lg transition-all"
                :class="[selectedRange === '1m' ? 'bg-slate-800 text-emerald-400 shadow-sm' : 'hover:text-slate-200']"
                @click="selectedRange = '1m'"
              >
                1 Bulan (20 Hari Kerja)
              </button>
              <button 
                type="button" 
                class="px-4 py-2 rounded-lg transition-all"
                :class="[selectedRange === '3m' ? 'bg-slate-800 text-emerald-400 shadow-sm' : 'hover:text-slate-200']"
                @click="selectedRange = '3m'"
              >
                3 Bulan (60 Hari Kerja)
              </button>
            </div>
          </div>

          <!-- ECharts container -->
          <div class="h-[360px] w-full">
            <ClientOnly>
              <VChart :option="chartOption" class="w-full h-full" autoresize />
              <template #fallback>
                <div class="w-full h-full flex items-center justify-center text-slate-500 text-sm">
                  Memuat grafik harga...
                </div>
              </template>
            </ClientOnly>
          </div>
        </section>

        <!-- Financial Profile & Ratios -->
        <section class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          
          <!-- Key Fundamental Ratios (Span 2) -->
          <div class="lg:col-span-2 glow-card p-6 rounded-2xl flex flex-col justify-between">
            <div>
              <h4 class="text-base font-bold text-slate-200 uppercase tracking-wider mb-4">Profil & Rasio Keuangan Fundamental</h4>
              <p class="text-xs text-slate-400 mb-6">Metrik fundamental dihitung otomatis berdasarkan harga pasar berjalan emiten.</p>
              
              <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                <!-- Ratio 1 -->
                <div class="p-4 bg-slate-900/40 border border-slate-800 rounded-xl flex flex-col justify-between min-h-[90px]">
                  <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Kapitalisasi Pasar</span>
                  <span class="text-lg font-bold text-slate-100 block mt-2">
                    Rp {{ formatLargeNumber(computedMarketCap) }}
                  </span>
                </div>
                <!-- Ratio 2 -->
                <div class="p-4 bg-slate-900/40 border border-slate-800 rounded-xl flex flex-col justify-between min-h-[90px]">
                  <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Rasio P/E (Price-to-Earnings)</span>
                  <span class="text-lg font-bold text-slate-100 block mt-2">
                    {{ computedPE }}x
                  </span>
                </div>
                <!-- Ratio 3 -->
                <div class="p-4 bg-slate-900/40 border border-slate-800 rounded-xl flex flex-col justify-between min-h-[90px]">
                  <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Rasio P/B (Price-to-Book)</span>
                  <span class="text-lg font-bold text-slate-100 block mt-2">
                    {{ computedPB }}x
                  </span>
                </div>
                <!-- Ratio 4 -->
                <div class="p-4 bg-slate-900/40 border border-slate-800 rounded-xl flex flex-col justify-between min-h-[90px]">
                  <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Dividend Yield</span>
                  <span class="text-lg font-bold text-emerald-450 block mt-2">
                    {{ computedDivYield }}
                  </span>
                </div>
                <!-- Ratio 5 -->
                <div class="p-4 bg-slate-900/40 border border-slate-800 rounded-xl flex flex-col justify-between min-h-[90px]">
                  <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Laba Bersih per Saham (EPS)</span>
                  <span class="text-lg font-bold text-slate-100 block mt-2">
                    Rp {{ fundamentalData.eps.toLocaleString('id-ID') }}
                  </span>
                </div>
                <!-- Ratio 6 -->
                <div class="p-4 bg-slate-900/40 border border-slate-800 rounded-xl flex flex-col justify-between min-h-[90px]">
                  <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Nilai Buku per Saham (BVPS)</span>
                  <span class="text-lg font-bold text-slate-100 block mt-2">
                    Rp {{ fundamentalData.bvps.toLocaleString('id-ID') }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Divider -->
            <div class="border-t border-slate-900 my-6"></div>

            <!-- Additional stats -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-400">
              <div class="flex justify-between py-1.5 border-b border-slate-900">
                <span>Saham Beredar:</span>
                <span class="font-bold text-slate-300">{{ fundamentalData.sharesOutstanding }} Miliar Lembar</span>
              </div>
              <div class="flex justify-between py-1.5 border-b border-slate-900">
                <span>Dividen per Saham (DPS):</span>
                <span class="font-bold text-slate-300">Rp {{ fundamentalData.dps.toLocaleString('id-ID') }}</span>
              </div>
            </div>
          </div>

          <!-- Company Profile Card (Span 1) -->
          <div class="glow-card p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden">
            <div>
              <h4 class="text-sm font-bold text-slate-300 uppercase tracking-wider">Profil Emiten</h4>
              <p class="text-xs text-slate-500 mt-1">Identitas dan operasional bisnis perusahaan</p>
              
              <!-- Sector Industry info -->
              <div class="mt-6 space-y-3">
                <div>
                  <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Sektor Bisnis</span>
                  <span class="text-sm font-bold text-slate-200 mt-1 block">
                    {{ stockDetail.sector !== 'N/A' ? stockDetail.sector : 'Financial Services' }}
                  </span>
                </div>
                <div>
                  <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Sub-Industri</span>
                  <span class="text-sm font-bold text-slate-200 mt-1 block font-sans">
                    {{ stockDetail.industry !== 'N/A' ? stockDetail.industry : 'Banks—Regional' }}
                  </span>
                </div>
              </div>
              
              <!-- Divider -->
              <div class="border-t border-slate-900 my-4"></div>
              
              <div>
                <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Deskripsi Singkat</span>
                <p class="text-xs text-slate-300 mt-2 leading-relaxed font-sans text-justify">
                  {{ fundamentalData.description }}
                </p>
              </div>
            </div>

            <!-- Footer indicator -->
            <div class="text-center text-[10px] text-slate-500 mt-6 pt-4 border-t border-slate-900/60 font-medium">
              Data diolah dari Bursa Efek Indonesia (IDX) & Yahoo Finance
            </div>
          </div>
        </section>

        <!-- Historical Prices Table (Full Width) -->
        <section class="glow-card p-6 rounded-2xl">
          <div class="mb-6">
            <h4 class="text-lg font-bold text-slate-100">Riwayat Penutupan Harga Harian</h4>
            <p class="text-xs text-slate-400">Data harga harian 15 hari perdagangan bursa terakhir</p>
          </div>

          <div class="overflow-x-auto rounded-xl border border-slate-900">
            <table class="w-full border-collapse text-left text-sm text-slate-300">
              <thead class="bg-slate-900/60 text-xs font-semibold uppercase text-slate-400 border-b border-slate-900">
                <tr>
                  <th class="px-6 py-4">Tanggal</th>
                  <th class="px-6 py-4 text-right">Harga Open</th>
                  <th class="px-6 py-4 text-right">Harga Close</th>
                  <th class="px-6 py-4 text-right">Perubahan (IDR)</th>
                  <th class="px-6 py-4 text-right">Perubahan (%)</th>
                  <th class="px-6 py-4 text-right">Volume Perdagangan</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-900">
                <tr 
                  v-for="row in stockDetail.history.slice(0, 15)" 
                  :key="row.timestamp"
                  class="hover:bg-slate-900/20 transition-colors"
                >
                  <!-- Date -->
                  <td class="px-6 py-4 font-semibold text-slate-200">{{ row.date }}</td>
                  <!-- Open -->
                  <td class="px-6 py-4 text-right">{{ row.open.toLocaleString('id-ID') }}</td>
                  <!-- Close -->
                  <td class="px-6 py-4 text-right font-bold text-slate-100">{{ row.close.toLocaleString('id-ID') }}</td>
                  <!-- Change val -->
                  <td 
                    class="px-6 py-4 text-right font-semibold"
                    :class="[row.changeVal >= 0 ? 'text-emerald-450' : 'text-rose-455']"
                  >
                    {{ row.changeVal >= 0 ? '+' : '' }}{{ row.changeVal.toLocaleString('id-ID') }}
                  </td>
                  <!-- Change pct -->
                  <td 
                    class="px-6 py-4 text-right font-semibold"
                    :class="[row.changePct >= 0 ? 'text-emerald-450' : 'text-rose-455']"
                  >
                    {{ row.changePct >= 0 ? '+' : '' }}{{ row.changePct.toFixed(2) }}%
                  </td>
                  <!-- Volume -->
                  <td class="px-6 py-4 text-right text-slate-400">{{ row.volume.toLocaleString('id-ID') }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

    </main>
  </div>
</template>
