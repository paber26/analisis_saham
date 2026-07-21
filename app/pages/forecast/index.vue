<script setup lang="ts">
import { ref, computed, watch } from 'vue';

useHead({
  title: 'Forecasting Saham IDX — Backtest & Proyeksi Probabilistik',
  meta: [
    { name: 'description', content: 'Forecasting saham IDX: ensemble Naive/Drift/AR/Holt/Regresi pada log-return, walk-forward 3 fold, volatilitas EWMA, probabilitas naik, dan proyeksi dengan pita ketidakpastian.' }
  ]
});

const route = useRoute();
const router = useRouter();
const activeSymbol = ref(((route.query.symbol as string) || 'BBCA').toUpperCase().trim());
const horizon = ref(parseInt((route.query.horizon as string) || '14', 10) || 14);

watch([activeSymbol, horizon], () => {
  router.replace({ query: { ...route.query, symbol: activeSymbol.value, horizon: horizon.value } });
});

// Remember last viewed symbol (shared across pages)
const { setLast } = useLastSymbol();
watch(activeSymbol, setLast, { immediate: true });

const { data, pending, error } = await useFetch<any>(() => '/api/forecast', {
  params: { symbol: activeSymbol, horizon },
  watch: [activeSymbol, horizon]
});

const fmt = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('id-ID'));

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

// ---- Chart ----
const chartOption = computed(() => {
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

      <!-- Loading / Error -->
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
                  {{ f.dirAcc ?? '—' }}%<span v-if="i < data.foldStability.length - 1" class="text-slate-600"> /</span>
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
            untuk saham ini. Gunakan proyeksi sebagai <strong class="text-slate-300">indikasi arah &amp; rentang probabilistik</strong>,
            bukan target harga. Bukan rekomendasi investasi.
          </p>
        </footer>
      </template>

    </main>
  </div>
</template>
