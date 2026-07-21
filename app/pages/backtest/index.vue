<script setup lang="ts">
import { ref, computed, watch } from 'vue';

useHead({
  title: 'Backtest Strategi — Validasi vs IHSG',
  meta: [{ name: 'description', content: 'Backtest strategi teknikal (skor, tren MA200, golden cross) di saham likuid IDX — rebalance bulanan, tanpa look-ahead, dengan biaya transaksi, dibandingkan buy & hold IHSG.' }]
});

const route = useRoute();
const router = useRouter();
const strategy = ref((route.query.strategy as string) || 'score');
const threshold = ref(parseInt((route.query.threshold as string) || '70', 10) || 70);

watch([strategy, threshold], () => {
  router.replace({ query: { strategy: strategy.value, threshold: threshold.value } });
});

const { data, pending, error } = await useFetch<any>(() => '/api/backtest', {
  params: { strategy, threshold },
  watch: [strategy, threshold]
});

const STRATS = [
  { key: 'score', label: 'Skor Teknikal ≥ N' },
  { key: 'ma200', label: 'Di atas MA200 (tren)' },
  { key: 'golden', label: 'Golden Cross (MA50>MA200)' }
];

const m = computed(() => data.value?.metrics || null);
const bench = computed(() => data.value?.benchmark || null);
const beatsIhsg = computed(() => bench.value && bench.value.alphaCagrPct > 0);

const fmtPct = (n: number | null | undefined) => (n == null ? '—' : (n >= 0 ? '+' : '') + n + '%');

const chartOption = computed(() => {
  const d = data.value;
  if (!d?.equity?.length) return {};
  const dates = d.equity.map((e: any) => e.date);
  return {
    backgroundColor: 'transparent',
    animation: false,
    tooltip: { trigger: 'axis', backgroundColor: '#0f172a', borderColor: '#334155', textStyle: { color: '#f8fafc', fontSize: 11 }, valueFormatter: (v: number) => v?.toFixed(1) },
    legend: { data: ['Strategi', 'IHSG (buy & hold)'], textStyle: { color: '#94a3b8', fontSize: 11 }, top: 0 },
    grid: { left: 8, right: 12, top: 34, bottom: 30, containLabel: true },
    xAxis: { type: 'category', data: dates, axisLine: { lineStyle: { color: '#1e293b' } }, axisLabel: { color: '#64748b', fontSize: 9, formatter: (v: string) => v?.slice(0, 7) } },
    yAxis: { scale: true, axisLabel: { color: '#64748b', fontSize: 9 }, splitLine: { lineStyle: { color: '#0f172a' } } },
    series: [
      { name: 'Strategi', type: 'line', data: d.equity.map((e: any) => e.strat), smooth: true, showSymbol: false, lineStyle: { color: '#34d399', width: 2 } },
      { name: 'IHSG (buy & hold)', type: 'line', data: d.equity.map((e: any) => e.ihsg), smooth: true, showSymbol: false, lineStyle: { color: '#64748b', width: 1.5, type: 'dashed' } }
    ]
  };
});
</script>

<template>
  <div class="pb-16 bg-slate-950 text-slate-100 flex flex-col flex-grow">
    <main class="max-w-7xl mx-auto px-4 sm:px-6 mt-8 flex-grow w-full space-y-6">

      <section class="glow-card rounded-2xl p-6">
        <h2 class="text-lg font-bold text-slate-50">Backtest Strategi</h2>
        <p class="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
          Menguji strategi pada ~45 saham likuid, <strong class="text-slate-300">rebalance bulanan equal-weight</strong>,
          <strong class="text-slate-300">tanpa look-ahead</strong> (sinyal hari-t hanya pakai data ≤ t), sudah dipotong
          biaya transaksi, lalu dibandingkan <strong class="text-slate-300">buy &amp; hold IHSG</strong>.
        </p>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5 items-end">
          <div>
            <label class="text-xs font-semibold text-slate-400 mb-2 block">Strategi</label>
            <div class="flex flex-wrap gap-2">
              <button v-for="s in STRATS" :key="s.key" type="button"
                class="px-3 py-2 text-xs font-semibold rounded-xl border transition-all"
                :class="strategy === s.key ? 'bg-emerald-500 text-slate-950 border-emerald-500' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'"
                @click="strategy = s.key">{{ s.label }}</button>
            </div>
          </div>
          <div v-if="strategy === 'score'">
            <label class="text-xs font-semibold text-slate-400 mb-2 block flex justify-between"><span>Ambang skor</span><span class="text-slate-200 font-bold">≥ {{ threshold }}</span></label>
            <input v-model.number="threshold" type="range" min="40" max="85" step="5" class="w-full accent-emerald-500" />
          </div>
        </div>
      </section>

      <div v-if="pending" class="py-20 flex flex-col items-center justify-center gap-4 bg-slate-900/30 border border-slate-900 rounded-2xl">
        <div class="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p class="text-sm text-slate-400 animate-pulse">Menjalankan backtest (rebalance bulanan lintas tahun)…</p>
      </div>
      <div v-else-if="error" class="p-6 rounded-2xl bg-rose-500/5 border border-rose-500/20 text-rose-200 text-sm">Gagal menjalankan backtest. Coba lagi sebentar.</div>

      <template v-else-if="data && m && bench">
        <!-- Verdict -->
        <section class="rounded-2xl border p-6" :class="beatsIhsg ? 'border-emerald-500/30 bg-emerald-500/[0.06]' : 'border-amber-500/30 bg-amber-500/[0.06]'">
          <p class="text-[11px] uppercase tracking-wider opacity-70">Periode {{ data.start }} → {{ data.end }} · {{ data.months }} bulan · {{ data.universeSize }} saham</p>
          <p class="text-xl font-extrabold mt-1" :class="beatsIhsg ? 'text-emerald-300' : 'text-amber-300'">
            {{ beatsIhsg ? '✓ Strategi mengungguli IHSG' : '⚠ Strategi belum mengungguli IHSG' }}
            <span class="text-base">(alpha {{ fmtPct(bench.alphaCagrPct) }}/tahun)</span>
          </p>
          <p class="text-xs mt-1 opacity-90">
            Strategi CAGR <strong>{{ fmtPct(m.cagrPct) }}</strong> vs IHSG <strong>{{ fmtPct(bench.cagrPct) }}</strong> ·
            drawdown strategi <strong>−{{ m.maxDrawdownPct }}%</strong> vs IHSG <strong>−{{ bench.maxDrawdownPct }}%</strong>
          </p>
        </section>

        <!-- Equity curve -->
        <section class="glow-card rounded-2xl p-4">
          <div class="w-full h-[400px]">
            <ClientOnly>
              <VChart :option="chartOption" class="w-full h-full" autoresize />
              <template #fallback><div class="h-full flex items-center justify-center text-slate-500 text-sm">Memuat kurva…</div></template>
            </ClientOnly>
          </div>
          <p class="text-[10px] text-slate-500 text-center">Pertumbuhan Rp 100 (equal-weight, sudah termasuk biaya {{ data.costPerRebalancePct }}%/rebalance).</p>
        </section>

        <!-- Metrics -->
        <section class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div class="glow-card rounded-xl p-4"><p class="text-[10px] text-slate-500 uppercase">Total Return</p><p class="text-lg font-extrabold mt-1" :class="m.totalReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ fmtPct(m.totalReturnPct) }}</p></div>
          <div class="glow-card rounded-xl p-4"><p class="text-[10px] text-slate-500 uppercase">CAGR</p><p class="text-lg font-extrabold mt-1" :class="m.cagrPct >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ fmtPct(m.cagrPct) }}</p></div>
          <div class="glow-card rounded-xl p-4"><p class="text-[10px] text-slate-500 uppercase">Max Drawdown</p><p class="text-lg font-extrabold text-rose-400 mt-1">−{{ m.maxDrawdownPct }}%</p></div>
          <div class="glow-card rounded-xl p-4"><p class="text-[10px] text-slate-500 uppercase">Sharpe</p><p class="text-lg font-extrabold mt-1" :class="m.sharpe >= 1 ? 'text-emerald-400' : 'text-slate-100'">{{ m.sharpe }}</p></div>
          <div class="glow-card rounded-xl p-4"><p class="text-[10px] text-slate-500 uppercase">Sortino</p><p class="text-lg font-extrabold text-slate-100 mt-1">{{ m.sortino }}</p></div>
          <div class="glow-card rounded-xl p-4"><p class="text-[10px] text-slate-500 uppercase">Win Rate bln</p><p class="text-lg font-extrabold text-slate-100 mt-1">{{ m.winRatePct }}%</p></div>
        </section>
        <p class="text-[11px] text-slate-500 text-center">Rata-rata {{ m.avgHoldings }} saham dipegang tiap bulan. Sharpe/Sortino disetahunkan (risk-free 0%).</p>

        <footer class="p-5 rounded-2xl bg-rose-500/5 border border-rose-500/10">
          <p class="text-[11px] leading-relaxed text-slate-400">
            ⚠ Keterbatasan: memakai <strong class="text-slate-300">universe likuid saat ini</strong> (ada survivorship bias — saham yang delisting/bermasalah tak masuk),
            eksekusi pada harga penutupan bulanan, dan biaya disederhanakan. Hasil masa lalu <strong class="text-slate-300">bukan jaminan</strong> masa depan.
            Backtest untuk memvalidasi logika, bukan janji imbal hasil.
          </p>
        </footer>
      </template>

    </main>
  </div>
</template>
