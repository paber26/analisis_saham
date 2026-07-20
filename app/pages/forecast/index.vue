<script setup lang="ts">
import { ref, computed, watch } from 'vue';

useHead({
  title: 'Forecasting Saham IDX — Backtest & Proyeksi',
  meta: [
    { name: 'description', content: 'Forecasting harga saham IDX dengan model Naive, Holt, dan regresi fitur teknikal. Dilengkapi backtest train/test jujur vs baseline dan proyeksi tren beberapa hari ke depan.' }
  ]
});

const route = useRoute();
const router = useRouter();
const activeSymbol = ref(((route.query.symbol as string) || 'BBCA').toUpperCase().trim());
const horizon = ref(parseInt((route.query.horizon as string) || '14', 10) || 14);

watch([activeSymbol, horizon], () => {
  router.replace({ query: { ...route.query, symbol: activeSymbol.value, horizon: horizon.value } });
});

const { data, pending, error } = await useFetch<any>(() => '/api/forecast', {
  params: { symbol: activeSymbol, horizon },
  watch: [activeSymbol, horizon]
});

const fmt = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('id-ID'));

const bestLabel = computed(() => {
  const b = data.value?.best;
  return b === 'holt' ? 'Holt (tren)' : b === 'reg' ? 'Regresi teknikal' : 'Naive (random walk)';
});
const beatsNaive = computed(() => data.value && data.value.best !== 'naive');

// Metric table rows
const metricRows = computed(() => {
  const m = data.value?.metrics;
  if (!m) return [];
  return [
    { key: 'naive', label: 'Naive (baseline)', ...m.naive },
    { key: 'holt', label: 'Holt (tren)', ...m.holt },
    { key: 'reg', label: 'Regresi teknikal', ...m.reg }
  ];
});

// ---- Chart ----
const chartOption = computed(() => {
  const d = data.value;
  if (!d) return {};
  const series = d.series as any[];
  const fc = d.forecast as any[];
  const lastIdx = series.length - 1;

  const dates = [...series.map((s) => s.date), ...fc.map((f) => f.date)];
  const actual = [...series.map((s) => s.actual), ...fc.map(() => null)];
  const holt = [...series.map((s) => s.holt), ...fc.map(() => null)];

  // Forward mean + band (connected to last actual point)
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
    dataZoom: [{ type: 'inside', start: 40, end: 100 }, { type: 'slider', height: 16, bottom: 8, backgroundColor: '#020617', borderColor: '#0f172a', fillerColor: 'rgba(16,185,129,0.08)', textStyle: { color: '#475569', fontSize: 8 } }],
    series: [
      // Confidence band (stacked: transparent lower + translucent width)
      { name: 'lower', type: 'line', data: fwdLower, stack: 'conf', lineStyle: { opacity: 0 }, symbol: 'none', silent: true, z: 1 },
      { name: 'band', type: 'line', data: fwdBand, stack: 'conf', lineStyle: { opacity: 0 }, areaStyle: { color: 'rgba(56,189,248,0.15)' }, symbol: 'none', silent: true, z: 1, tooltip: { show: false } },
      { name: 'Aktual', type: 'line', data: actual, smooth: false, showSymbol: false, lineStyle: { color: '#e2e8f0', width: 1.5 }, z: 4 },
      { name: 'Prediksi 1-hari (uji)', type: 'line', data: holt, smooth: false, showSymbol: false, connectNulls: false, lineStyle: { color: '#f59e0b', width: 1, type: 'dotted' }, z: 3 },
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
          Data dibagi kronologis: <strong class="text-slate-300">80% latih</strong> / <strong class="text-slate-300">20% uji</strong>.
          Model dilatih di data latih lalu diuji <em>walk-forward</em> (satu langkah ke depan) di data uji — dibandingkan jujur
          dengan baseline <strong class="text-slate-300">random walk</strong>. Proyeksi memakai tren Holt dengan pita ketidakpastian ≈80%.
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

      <!-- Loading / Error -->
      <div v-if="pending" class="py-20 flex flex-col items-center justify-center gap-4 bg-slate-900/30 border border-slate-900 rounded-2xl">
        <div class="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p class="text-sm text-slate-400 animate-pulse">Melatih model & menjalankan backtest…</p>
      </div>
      <div v-else-if="error" class="p-6 rounded-2xl bg-rose-500/5 border border-rose-500/20 text-rose-200 text-sm">
        Gagal memuat forecast untuk "{{ activeSymbol }}". Data mungkin kurang dari 150 hari. Coba saham lain.
      </div>

      <template v-else-if="data">
        <!-- Summary cards -->
        <section class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="glow-card rounded-2xl p-5">
            <p class="text-[11px] text-slate-400 uppercase tracking-wide">Harga Terakhir</p>
            <p class="text-2xl font-extrabold text-slate-50 mt-1">{{ fmt(data.lastPrice) }}</p>
            <p class="text-[11px] text-slate-500 mt-1">per {{ data.lastDate }}</p>
          </div>
          <div class="glow-card rounded-2xl p-5">
            <p class="text-[11px] text-slate-400 uppercase tracking-wide">Prediksi Arah Besok</p>
            <p class="text-2xl font-extrabold mt-1" :class="data.nextDay.direction === 'up' ? 'text-emerald-400' : 'text-rose-400'">
              {{ data.nextDay.direction === 'up' ? '▲ Naik' : '▼ Turun' }}
              <span class="text-base font-bold">{{ data.nextDay.expectedReturnPct >= 0 ? '+' : '' }}{{ data.nextDay.expectedReturnPct }}%</span>
            </p>
            <p class="text-[11px] text-slate-500 mt-1">
              Akurasi arah model (uji): {{ data.nextDay.hitRate ?? '—' }}% · baseline {{ data.baselineDirAcc }}%
            </p>
          </div>
          <div class="glow-card rounded-2xl p-5">
            <p class="text-[11px] text-slate-400 uppercase tracking-wide">Model Terbaik (RMSE uji)</p>
            <p class="text-2xl font-extrabold text-slate-50 mt-1">{{ bestLabel }}</p>
            <p class="text-[11px] mt-1" :class="beatsNaive ? 'text-emerald-400' : 'text-amber-400'">
              {{ beatsNaive ? '✓ Mengungguli random walk' : '⚠ Belum mengungguli random walk' }}
            </p>
          </div>
        </section>

        <!-- Chart -->
        <section class="glow-card rounded-2xl p-4">
          <div class="w-full h-[440px]">
            <ClientOnly>
              <VChart :option="chartOption" class="w-full h-full" autoresize />
              <template #fallback><div class="h-full flex items-center justify-center text-slate-500 text-sm">Memuat grafik…</div></template>
            </ClientOnly>
          </div>
        </section>

        <!-- Metrics -->
        <section class="glow-card rounded-2xl p-6">
          <h3 class="text-sm font-bold text-slate-100 mb-1">Hasil Backtest (data uji: {{ data.testSize }} hari)</h3>
          <p class="text-xs text-slate-400 mb-4">RMSE/MAE makin kecil makin baik. Akurasi arah: % tebakan naik/turun yang benar (bandingkan dengan baseline {{ data.baselineDirAcc }}%).</p>
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
                  :class="row.key === data.best ? 'bg-emerald-500/5' : ''">
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
            Harga saham harian mendekati <em>random walk</em> — memprediksi harga persis sangat sulit dan sering tidak
            mengalahkan baseline. Jika "model terbaik" adalah Naive, artinya model lain belum memberi nilai tambah untuk saham ini;
            gunakan proyeksi sebagai <strong class="text-slate-300">indikasi arah/tren</strong>, bukan target harga pasti.
            Ini bukan rekomendasi investasi.
          </p>
        </footer>
      </template>

    </main>
  </div>
</template>
