<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';

useHead({
  title: 'Backtest Strategi — Validasi vs IHSG',
  meta: [{ name: 'description', content: 'Backtest strategi teknikal (skor, tren MA200, golden cross) di saham likuid IDX — rebalance bulanan, tanpa look-ahead, dengan biaya transaksi, dibandingkan buy & hold IHSG.' }]
});

const route = useRoute();
const router = useRouter();
const { token, authHeaders } = useAppToken();
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

// ---- Strategi Lab: 500 kombinasi parameter + histori sweep ----
interface LabRun {
  id: string; cadence: 'monthly' | 'weekly'; family: string;
  threshold: number | null; maxNames: number | null; label: string;
  metrics: { totalReturnPct: number; cagrPct: number; winRatePct: number; maxDrawdownPct: number; sharpe: number; sortino: number; avgHoldings: number };
  bench: { totalReturnPct: number; cagrPct: number; maxDrawdownPct: number; alphaCagrPct: number };
}
interface LabSweep {
  id: string; createdAt: string; periodStart: string | null; periodEnd: string | null;
  universeSize: number; executed: number; failed: number; beatsCount: number;
  bestAlphaPct: number | null; medianAlphaPct: number | null; ihsgCagrPct: number | null;
  runs: LabRun[];
}
const labRunning = ref(false);
const labError = ref('');
const labSweep = ref<LabSweep | null>(null);
const labSweeps = ref<{ id: string; createdAt: string; periodStart: string | null; bestAlphaPct: number | null; beatsCount: number }[]>([]);

async function loadLabHistory() {
  try {
    const d = await $fetch<any>('/api/backtest-lab');
    labSweep.value = d.latest ?? null;
    labSweeps.value = d.sweeps ?? [];
  } catch { /* belum ada histori */ }
}

async function runLab() {
  labRunning.value = true;
  labError.value = '';
  try {
    const d = await $fetch<any>('/api/backtest-lab/execute', { headers: authHeaders.value, timeout: 300_000 });
    labSweep.value = d.sweep;
    await loadLabHistory();
  } catch (e: any) {
    labError.value = e?.statusMessage || e?.data?.statusMessage || (e?.statusCode === 401
      ? 'Jalankan lab memerlukan login / token akses.'
      : 'Gagal menjalankan sweep.');
  } finally {
    labRunning.value = false;
  }
}

function selectSweep(id: string) {
  if (!id) return;
  $fetch<any>('/api/backtest-lab', { params: { sweep: id } })
    .then((d) => { labSweep.value = d.sweep; })
    .catch(() => {});
}

const labSortedRuns = computed<LabRun[]>(() =>
  [...(labSweep.value?.runs ?? [])].sort((a, b) => b.bench.alphaCagrPct - a.bench.alphaCagrPct)
);
const famLabel = (f: string) => ({ score: 'Skor', score_ma200: 'Skor+MA200', ma200: 'MA200', golden: 'Golden', always: 'Baseline' } as Record<string, string>)[f] || f;

/** Klik baris → muat konfigurasi ke panel utama (hanya family yang didukung panel). */
function applyRunToMain(r: LabRun) {
  if (r.family === 'score') {
    strategy.value = 'score';
    threshold.value = r.threshold ?? 70;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (r.family === 'ma200') {
    strategy.value = 'ma200';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (r.family === 'golden') {
    strategy.value = 'golden';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
const isMainLoadable = (r: LabRun) => ['score', 'ma200', 'golden'].includes(r.family);

onMounted(loadLabHistory);

// ---- Event study: forward returns after a signal, vs baseline ----
const evSignal = ref('golden');
const EV_SIGNALS = [
  { key: 'golden', label: 'Golden Cross' },
  { key: 'ma200', label: 'Reclaim MA200' },
  { key: 'rsi30', label: 'RSI keluar oversold' },
  { key: 'breakout', label: 'Breakout 20 hari' }
];
const { data: ev, pending: evPending, error: evError } = await useFetch<any>(() => '/api/eventstudy', {
  params: { signal: evSignal }, watch: [evSignal], lazy: true
});

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

      <!-- ================= STRATEGI LAB (50 KOMBINASI) ================= -->
      <section class="glow-card rounded-2xl p-6 space-y-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-lg font-bold text-slate-50">🧪 Strategi Lab — 50 Kombinasi Parameter</h2>
            <p class="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              Sweep sistematis: strategi × ambang × top-K × kadensi bulanan/mingguan pada data yang sama,
              tanpa look-ahead, biaya transaksi terpotong. Setiap sweep tersimpan ke
              <strong class="text-slate-300">histori</strong> agar bisa dicek: apakah "juara" dulu tetap juara?
            </p>
          </div>
          <div class="flex flex-col items-end gap-2">
            <button type="button" :disabled="labRunning"
              class="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 text-xs font-bold transition-colors"
              @click="runLab">
              {{ labRunning ? '⏳ Menjalankan 500 percobaan…' : '▶ Jalankan 500 percobaan' }}
            </button>
            <select v-if="labSweeps.length" class="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px] text-slate-300 max-w-[260px]"
              @change="selectSweep(($event.target as HTMLSelectElement).value)">
              <option value="">📚 Histori sweep ({{ labSweeps.length }})…</option>
              <option v-for="s in labSweeps" :key="s.id" :value="s.id">
                {{ s.createdAt.slice(0, 16).replace('T', ' ') }} · best {{ s.bestAlphaPct != null ? fmtPct(s.bestAlphaPct) : '—' }} · {{ s.beatsCount }}/500 menang
              </option>
            </select>
          </div>
        </div>

        <p v-if="labError" class="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/25 rounded-xl px-3 py-2">{{ labError }}</p>

        <template v-if="labSweep">
          <!-- Ringkasan -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-3.5">
              <p class="text-[10px] text-slate-500 uppercase font-bold">Mengungguli IHSG</p>
              <p class="text-xl font-extrabold mt-0.5" :class="labSweep.beatsCount > 0 ? 'text-emerald-400' : 'text-slate-300'">{{ labSweep.beatsCount }}<span class="text-sm text-slate-500">/500</span></p>
            </div>
            <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-3.5">
              <p class="text-[10px] text-slate-500 uppercase font-bold">Alpha Terbaik</p>
              <p class="text-xl font-extrabold mt-0.5" :class="(labSweep.bestAlphaPct ?? 0) > 0 ? 'text-emerald-400' : 'text-rose-400'">{{ fmtPct(labSweep.bestAlphaPct) }}</p>
            </div>
            <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-3.5">
              <p class="text-[10px] text-slate-500 uppercase font-bold">Median Alpha</p>
              <p class="text-xl font-extrabold mt-0.5" :class="(labSweep.medianAlphaPct ?? 0) > 0 ? 'text-emerald-400' : 'text-rose-400'">{{ fmtPct(labSweep.medianAlphaPct) }}</p>
            </div>
            <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-3.5">
              <p class="text-[10px] text-slate-500 uppercase font-bold">Periode</p>
              <p class="text-[11px] font-bold mt-1 text-slate-200">{{ labSweep.periodStart }} → {{ labSweep.periodEnd }}</p>
              <p class="text-[10px] text-slate-500">{{ labSweep.universeSize }} saham · IHSG {{ fmtPct(labSweep.ihsgCagrPct) }}/thn</p>
            </div>
          </div>

          <!-- Leaderboard -->
          <div class="overflow-x-auto rounded-xl border border-slate-800">
            <table class="w-full text-xs min-w-[820px]">
              <thead>
                <tr class="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800 bg-slate-900/70">
                  <th class="px-3 py-2.5 font-semibold">#</th>
                  <th class="px-3 py-2.5 font-semibold">Strategi</th>
                  <th class="px-3 py-2.5 text-center">Kadensi</th>
                  <th class="px-3 py-2.5 text-right">CAGR</th>
                  <th class="px-3 py-2.5 text-right">Alpha/thn</th>
                  <th class="px-3 py-2.5 text-right">Max DD</th>
                  <th class="px-3 py-2.5 text-right">Sharpe</th>
                  <th class="px-3 py-2.5 text-right">Win bln</th>
                  <th class="px-3 py-2.5 text-right">Rata² hold</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(r, i) in labSortedRuns" :key="r.id"
                  class="border-b border-slate-900/70"
                  :class="[r.bench.alphaCagrPct > 0 ? 'bg-emerald-500/[0.05]' : '', isMainLoadable(r) ? 'cursor-pointer hover:bg-slate-900/60' : '']"
                  :title="isMainLoadable(r) ? 'Klik untuk memuat konfigurasi ini ke panel utama' : ''"
                  @click="isMainLoadable(r) && applyRunToMain(r)">
                  <td class="px-3 py-2.5 tabular-nums" :class="i === 0 ? 'text-amber-300 font-extrabold' : i < 3 ? 'text-slate-200 font-bold' : 'text-slate-500'">{{ i + 1 }}</td>
                  <td class="px-3 py-2.5">
                    <span class="font-semibold text-slate-100">{{ famLabel(r.family) }}</span>
                    <span v-if="r.threshold != null" class="text-slate-400 ml-1">≥{{ r.threshold }}</span>
                    <span class="text-slate-500 ml-1.5">{{ r.maxNames != null ? `Top${r.maxNames}` : 'semua' }}</span>
                    <span v-if="r.family === 'always'" class="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">baseline</span>
                  </td>
                  <td class="px-3 py-2.5 text-center">
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border" :class="r.cadence === 'weekly' ? 'text-violet-300 bg-violet-500/10 border-violet-500/25' : 'text-sky-300 bg-sky-500/10 border-sky-500/25'">{{ r.cadence === 'weekly' ? 'Mingguan' : 'Bulanan' }}</span>
                  </td>
                  <td class="px-3 py-2.5 text-right font-bold tabular-nums" :class="r.metrics.cagrPct >= 0 ? 'text-emerald-300' : 'text-rose-300'">{{ fmtPct(r.metrics.cagrPct) }}</td>
                  <td class="px-3 py-2.5 text-right font-extrabold tabular-nums" :class="r.bench.alphaCagrPct > 0 ? 'text-emerald-400' : 'text-rose-400'">{{ fmtPct(r.bench.alphaCagrPct) }}</td>
                  <td class="px-3 py-2.5 text-right tabular-nums text-slate-400">−{{ r.metrics.maxDrawdownPct }}%</td>
                  <td class="px-3 py-2.5 text-right tabular-nums" :class="r.metrics.sharpe >= 1 ? 'text-emerald-300' : 'text-slate-300'">{{ r.metrics.sharpe }}</td>
                  <td class="px-3 py-2.5 text-right tabular-nums text-slate-300">{{ r.metrics.winRatePct }}%</td>
                  <td class="px-3 py-2.5 text-right tabular-nums text-slate-500">{{ r.metrics.avgHoldings }}</td>
                </tr>
                <tr v-if="!labSortedRuns.length"><td colspan="9" class="py-8 text-center text-slate-500">Run gagal dihitung.</td></tr>
              </tbody>
            </table>
          </div>

          <p class="text-[11px] text-slate-500 leading-relaxed">
            ⚠ <strong class="text-slate-300">Kejujuran metodologi:</strong> memilih konfigurasi terbaik dari 500 percobaan
            <strong class="text-slate-300">rawan overfitting</strong> — sebagian "menang" karena kebetulan periode ini.
            Gunakan leaderboard sebagai eksplorasi karakter strategi (mis. top-K vs semua, mingguan vs bulanan),
            lalu validasi konfigurasi favorit di sweep berikutnya via histori.
          </p>
        </template>
        <p v-else-if="!labRunning" class="text-xs text-slate-500">
          Belum ada sweep tersimpan. Tekan <span class="text-emerald-400 font-semibold">▶ Jalankan 500 percobaan</span> — hasilnya otomatis masuk histori.
        </p>
      </section>

      <!-- ================= EVENT STUDY ================= -->
      <section class="glow-card rounded-2xl p-6 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-bold text-slate-50">Event Study — "Apa yang terjadi setelah sinyal?"</h2>
            <p class="text-xs text-slate-400 mt-1">Return rata-rata ke depan setelah sinyal muncul, lintas universe likuid &amp; 5 tahun, dibandingkan baseline (return acak). Edge = sinyal − baseline.</p>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="s in EV_SIGNALS" :key="s.key"
              @click="evSignal = s.key"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              :class="evSignal === s.key ? 'bg-emerald-500 text-slate-950' : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-slate-100'"
            >{{ s.label }}</button>
          </div>
        </div>

        <div v-if="evPending && !ev" class="py-8 text-center text-sm text-slate-500">Menghitung event study…</div>
        <div v-else-if="evError" class="py-8 text-center text-sm text-rose-400">Gagal memuat event study. Coba lagi.</div>
        <template v-else-if="ev">
          <p class="text-xs text-slate-400">
            <strong class="text-slate-100">{{ ev.events.toLocaleString('id-ID') }}</strong> kejadian sinyal terdeteksi pada {{ ev.universeSize }} saham.
            Sinyal: <span class="text-emerald-300">{{ ev.label }}</span>
          </p>
          <div class="overflow-x-auto">
            <table class="w-full text-sm min-w-[560px]">
              <thead>
                <tr class="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                  <th class="px-3 py-2 font-semibold">Horizon</th>
                  <th class="px-3 py-2 font-semibold text-right">Return rata-rata</th>
                  <th class="px-3 py-2 font-semibold text-right">Median</th>
                  <th class="px-3 py-2 font-semibold text-right">Win rate</th>
                  <th class="px-3 py-2 font-semibold text-right">Baseline</th>
                  <th class="px-3 py-2 font-semibold text-right">Edge</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="h in ev.horizons" :key="h.h" class="border-b border-slate-900/70">
                  <td class="px-3 py-2.5 font-semibold text-slate-200">+{{ h.h }} hari</td>
                  <td class="px-3 py-2.5 text-right font-semibold" :class="h.avgPct >= 0 ? 'text-emerald-300' : 'text-rose-300'">{{ fmtPct(h.avgPct) }}</td>
                  <td class="px-3 py-2.5 text-right text-slate-300">{{ fmtPct(h.medianPct) }}</td>
                  <td class="px-3 py-2.5 text-right" :class="h.winRatePct >= 50 ? 'text-emerald-300' : 'text-slate-400'">{{ h.winRatePct }}%</td>
                  <td class="px-3 py-2.5 text-right text-slate-500">{{ fmtPct(h.baselineAvgPct) }}</td>
                  <td class="px-3 py-2.5 text-right font-extrabold" :class="h.edgePct > 0 ? 'text-emerald-400' : 'text-rose-400'">{{ fmtPct(h.edgePct) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="text-[11px] text-slate-500 leading-relaxed">
            Deteksi memakai data ≤ hari sinyal (tanpa look-ahead); return diukur ke depan. <strong class="text-slate-300">Edge positif</strong> = sinyal mengungguli hari acak. Universe likuid saat ini (survivorship bias) — indikatif, bukan janji.
          </p>
        </template>
      </section>

    </main>
  </div>
</template>
