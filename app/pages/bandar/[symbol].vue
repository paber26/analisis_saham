<script setup lang="ts">
import { computed, ref } from 'vue';

const route = useRoute();
const router = useRouter();
const symbol = computed(() => ((route.params.symbol as string) || 'BBCA').toUpperCase().trim());
const codeOnly = computed(() => symbol.value.replace('.JK', ''));

const { token, authHeaders } = useAppToken();
const { loggedIn } = useAuth();

const { setLast } = useLastSymbol();
watch(codeOnly, setLast, { immediate: true });

function goTo(code: string) { router.push(`/bandar/${code.toUpperCase()}`); }

useHead(() => ({ title: `Bandarmology ${codeOnly.value} — Broker Analysis` }));

// Period presets supported (probed upstream + custom date ranges).
const PERIODS = [
  { id: '1d', label: 'Hari Ini' },
  { id: '1w', label: '1 Minggu' },
  { id: '1m', label: '1 Bulan' },
  { id: '3m', label: '3 Bulan' },
  { id: '1y', label: '1 Tahun' },
  { id: 'custom', label: 'Kustom' }
] as const;

const period = ref<string>('1d');
const customFrom = ref<string>('');
const customTo = ref<string>('');

function selectPeriod(id: string) {
  period.value = id;
  if (id === 'custom' && (!customFrom.value || !customTo.value)) {
    const today = new Date();
    const past = new Date();
    past.setDate(past.getDate() - 14);
    const fmtDate = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    customFrom.value = fmtDate(past);
    customTo.value = fmtDate(today);
  }
}

const periodLabel = computed(() => {
  if (period.value === 'custom' && customFrom.value && customTo.value) {
    return `Kustom (${customFrom.value} s/d ${customTo.value})`;
  }
  return PERIODS.find((p) => p.id === period.value)?.label || '';
});

const fetchParams = computed(() => {
  const p: Record<string, string> = { symbol: codeOnly.value, period: period.value };
  if (period.value === 'custom' && customFrom.value && customTo.value) {
    p.from = customFrom.value;
    p.to = customTo.value;
  }
  return p;
});

// Owner-only broker analysis (summary + flow + distribution). Cookie session or
// app token authorizes; fetched client-side, cached per day+period server-side.
const { data: ba, pending, error } = await useFetch<any>(() => '/api/broker-analysis', {
  params: fetchParams, headers: authHeaders, watch: [fetchParams, token], server: false, lazy: true
});

const summary = computed(() => ba.value?.summary || null);
const flow = computed(() => ba.value?.flow || null);
const distribution = computed(() => ba.value?.distribution || null);

// ---- formatters ----
const fmt = (n: number | null | undefined) => (n == null ? '—' : Math.round(n).toLocaleString('id-ID'));
function fmtVal(n: number | null | undefined) {
  if (n == null || !isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e12) return (a / 1e12).toFixed(1) + 'T';
  if (a >= 1e9) return (a / 1e9).toFixed(1) + 'B';
  if (a >= 1e6) return (a / 1e6).toFixed(1) + 'M';
  if (a >= 1e3) return (a / 1e3).toFixed(1) + 'K';
  return String(Math.round(a));
}
function fmtLot(n: number | null | undefined) {
  if (n == null || !isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e6) return (a / 1e6).toFixed(1) + 'M';
  if (a >= 1e3) return (a / 1e3).toFixed(1) + 'K';
  return String(Math.round(a));
}
// Asing→Foreign(merah), Pemerintah→BUMN(hijau), lainnya→Domestic(ungu)
function typeColor(t: string) {
  if (t === 'Asing') return '#f87171';
  if (t === 'Pemerintah') return '#34d399';
  return '#a78bfa';
}

// ---- Broker Action meter (Big Dist ↔ Big Acc) ----
const accum = computed(() => (summary.value?.netValue ?? 0) >= 0);
const meterPos = computed(() => {
  const s = summary.value;
  if (!s) return 50;
  const a = (s.avgAccdist || '').toLowerCase();
  if (a.includes('big acc')) return 90;
  if (a.includes('acc')) return 70;
  if (a.includes('big dist')) return 10;
  if (a.includes('dist')) return 30;
  return Math.max(4, Math.min(96, 50 + (s.netPercent || 0)));
});

// ---- Broker Flow chart (per-broker cumulative net + price) ----
const PALETTE = ['#a78bfa', '#34d399', '#f87171', '#fbbf24', '#60a5fa', '#f472b6'];
const flowOption = computed(() => {
  const f = flow.value;
  if (!f || !f.times?.length) return null;
  const shown = (f.brokers || []).slice(0, 6);
  const brokerSeries = shown.map((b: any, i: number) => ({
    name: b.code, type: 'line', showSymbol: false, smooth: false, yAxisIndex: 0,
    lineStyle: { width: 1.8, color: PALETTE[i % PALETTE.length] },
    itemStyle: { color: PALETTE[i % PALETTE.length] },
    data: b.values
  }));
  return {
    backgroundColor: 'transparent',
    legend: { data: [...shown.map((b: any) => b.code), 'Harga'], textStyle: { color: '#94a3b8', fontSize: 11 }, top: 0 },
    grid: { left: '2%', right: '2%', bottom: '3%', top: '16%', containLabel: true },
    tooltip: { trigger: 'axis', backgroundColor: '#0f172a', borderColor: '#334155', textStyle: { color: '#f8fafc' } },
    xAxis: { type: 'category', data: f.times, boundaryGap: false, axisLabel: { color: '#94a3b8', fontSize: 10 }, axisLine: { lineStyle: { color: '#334155' } } },
    yAxis: [
      { type: 'value', name: 'Net', nameTextStyle: { color: '#64748b', fontSize: 10 }, axisLabel: { color: '#94a3b8', fontSize: 10, formatter: (v: number) => (v / 1e9).toFixed(0) + 'B' }, splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } } },
      { type: 'value', name: 'Harga', position: 'right', nameTextStyle: { color: '#64748b', fontSize: 10 }, axisLabel: { color: '#94a3b8', fontSize: 10 }, splitLine: { show: false } }
    ],
    series: [
      ...brokerSeries,
      { name: 'Harga', type: 'line', showSymbol: false, yAxisIndex: 1, lineStyle: { width: 2, color: '#e2e8f0' }, itemStyle: { color: '#e2e8f0' }, data: f.price }
    ]
  };
});

// ---- Broker Distribution Sankey ----
const sankeyOption = computed(() => {
  const d = distribution.value;
  if (!d || !d.links?.length) return null;
  const nodes: Record<string, any> = {};
  const node = (side: string, code: string, type: string) => {
    const name = side + ':' + code;
    if (!nodes[name]) nodes[name] = { name, itemStyle: { color: typeColor(type) } };
    return name;
  };
  const links = d.links.filter((l: any) => l.value > 0).map((l: any) => ({
    source: node('B', l.from, l.fromType), target: node('S', l.to, l.toType), value: l.value
  }));
  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item', backgroundColor: '#0f172a', borderColor: '#334155', textStyle: { color: '#f8fafc' },
      formatter: (p: any) => p.dataType === 'edge'
        ? `${p.data.source.slice(2)} → ${p.data.target.slice(2)}<br/>Rp ${(p.data.value / 1e9).toFixed(2)} M`
        : p.name.slice(2)
    },
    series: [{
      type: 'sankey', left: 4, right: 4, top: 10, bottom: 10, nodeWidth: 12, nodeGap: 9,
      data: Object.values(nodes), links,
      label: { color: '#cbd5e1', fontSize: 11, formatter: (p: any) => p.name.slice(2) },
      lineStyle: { color: 'gradient', opacity: 0.35, curveness: 0.5 },
      emphasis: { focus: 'adjacency' }
    }]
  };
});
</script>

<template>
  <div class="pb-16 bg-slate-950 text-slate-100 flex flex-col flex-grow">
    <main class="max-w-7xl mx-auto px-4 sm:px-6 mt-8 flex-grow w-full space-y-6">

      <!-- Header -->
      <section class="glow-card rounded-2xl p-6">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 class="text-lg font-bold text-slate-50">Bandarmology — Broker Analysis</h2>
            <p class="text-[11px] text-slate-500">aliran broker · net buy/sell · distribusi · sumber Stockbit</p>
          </div>
          <NuxtLink :to="`/analisa/${codeOnly}`" class="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold">← Hub Analisa {{ codeOnly }}</NuxtLink>
        </div>
        <StockSearch :model-value="symbol" @update:model-value="goTo" />
        <div class="flex flex-wrap items-center justify-between gap-3 mt-4">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="text-[11px] text-slate-500 mr-1 uppercase tracking-wide font-semibold">Periode</span>
            <button
              v-for="p in PERIODS" :key="p.id" type="button" @click="selectPeriod(p.id)"
              class="px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors"
              :class="period === p.id
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shadow-sm'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'"
            >{{ p.label }}</button>
          </div>

          <!-- Custom Date Range inputs -->
          <div v-if="period === 'custom'" class="flex items-center gap-2 bg-slate-900/80 border border-slate-800 p-1.5 rounded-xl text-xs flex-wrap">
            <div class="flex items-center gap-1.5 px-2">
              <span class="text-slate-400 text-[11px] font-medium">Dari:</span>
              <input
                type="date"
                v-model="customFrom"
                class="bg-slate-950 text-slate-200 border border-slate-800 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <span class="text-slate-600 hidden sm:inline">→</span>
            <div class="flex items-center gap-1.5 px-2">
              <span class="text-slate-400 text-[11px] font-medium">Sampai:</span>
              <input
                type="date"
                v-model="customTo"
                class="bg-slate-950 text-slate-200 border border-slate-800 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>
        </div>
      </section>

      <!-- Not logged in -->
      <section v-if="!loggedIn && !token" class="glow-card rounded-2xl p-6 text-sm text-slate-300">
        Data bandar bersifat privat (owner-only). Silakan
        <NuxtLink to="/login" class="text-emerald-400 hover:text-emerald-300 font-semibold">masuk</NuxtLink>
        untuk melihatnya.
      </section>

      <template v-else>
        <!-- Loading / error -->
        <div v-if="pending" class="py-16 flex items-center justify-center gap-3 text-slate-400 text-sm bg-slate-900/30 border border-slate-900 rounded-2xl">
          <div class="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          Memuat data broker {{ codeOnly }}…
        </div>
        <div v-else-if="error" class="p-5 rounded-2xl bg-rose-500/5 border border-rose-500/20 text-rose-200 text-sm">
          Gagal memuat data broker. Pastikan token Stockbit masih valid (buka Stockbit agar extension menyegarkannya).
        </div>

        <template v-else>
          <!-- Stale cache warning banner -->
          <div v-if="summary?.isStale" class="px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs flex items-center justify-between gap-3 shadow-sm">
            <div class="flex items-center gap-2">
              <span class="text-sm">⚠️</span>
              <span><strong>Menampilkan data cache terakhir:</strong> Token Stockbit kedaluwarsa, namun data tersimpan berhasil ditampilkan. Extension akan memperbarui token otomatis di latar belakang saat Chrome dibuka.</span>
            </div>
          </div>

          <!-- Panel: Broker Summary (meter + net buy/sell tables) -->
          <section v-if="summary" class="glow-card rounded-2xl p-6">
            <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h3 class="text-sm font-bold text-slate-100">Broker Summary
                <span class="text-slate-500 font-normal">· {{ periodLabel }}<template v-if="summary.from"> ({{ summary.from }}<template v-if="summary.to && summary.to !== summary.from"> → {{ summary.to }}</template>)</template></span>
              </h3>
              <span class="text-[11px] font-bold px-2.5 py-1 rounded-lg border"
                :class="accum ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25' : 'text-rose-300 bg-rose-500/10 border-rose-500/25'">
                {{ summary.avgAccdist }} · net {{ fmtVal(summary.netValue) }} {{ accum ? '↑' : '↓' }}
              </span>
            </div>

            <!-- Broker Action meter -->
            <div class="mb-5">
              <div class="flex justify-between text-[10px] font-bold text-slate-500 uppercase mb-1.5">
                <span class="text-rose-400">Big Dist</span><span>Neutral</span><span class="text-emerald-400">Big Acc</span>
              </div>
              <div class="relative h-2.5 rounded-full" style="background: linear-gradient(90deg,#e11d48,#7f1d1d,#0f172a,#14532d,#10b981)">
                <div class="absolute -top-1 w-1.5 h-4.5 rounded-full bg-white shadow" :style="{ left: `calc(${meterPos}% - 3px)`, height: '18px' }"></div>
              </div>
              <p class="text-[11px] text-slate-500 mt-2">{{ summary.totalBuyer }} broker beli vs {{ summary.totalSeller }} jual · total nilai {{ fmtVal(summary.totalValue) }}</p>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <!-- Buyers -->
              <div>
                <p class="text-[10px] font-semibold text-emerald-400 uppercase tracking-wide mb-2">Net Buy (akumulasi)</p>
                <div class="overflow-x-auto">
                  <table class="w-full text-xs">
                    <thead><tr class="text-slate-500 text-[10px] uppercase">
                      <th class="text-left font-semibold py-1">Broker</th><th class="text-right font-semibold">Val</th><th class="text-right font-semibold">Lot</th><th class="text-right font-semibold">Avg</th>
                    </tr></thead>
                    <tbody>
                      <tr v-for="b in summary.brokersBuy.slice(0, 12)" :key="'b' + b.code" class="border-t border-slate-800/50">
                        <td class="py-1.5 font-bold text-emerald-300">
                          <span class="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle" :style="{ background: typeColor(b.type) }"></span>{{ b.code }}
                        </td>
                        <td class="text-right text-slate-200">{{ fmtVal(b.value) }}</td>
                        <td class="text-right text-slate-400">{{ fmtLot(b.lot) }}</td>
                        <td class="text-right text-slate-400">{{ fmt(b.avgPrice) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <!-- Sellers -->
              <div>
                <p class="text-[10px] font-semibold text-rose-400 uppercase tracking-wide mb-2">Net Sell (distribusi)</p>
                <div class="overflow-x-auto">
                  <table class="w-full text-xs">
                    <thead><tr class="text-slate-500 text-[10px] uppercase">
                      <th class="text-left font-semibold py-1">Broker</th><th class="text-right font-semibold">Val</th><th class="text-right font-semibold">Lot</th><th class="text-right font-semibold">Avg</th>
                    </tr></thead>
                    <tbody>
                      <tr v-for="b in summary.brokersSell.slice(0, 12)" :key="'s' + b.code" class="border-t border-slate-800/50">
                        <td class="py-1.5 font-bold text-rose-300">
                          <span class="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle" :style="{ background: typeColor(b.type) }"></span>{{ b.code }}
                        </td>
                        <td class="text-right text-slate-200">{{ fmtVal(b.value) }}</td>
                        <td class="text-right text-slate-400">{{ fmtLot(b.lot) }}</td>
                        <td class="text-right text-slate-400">{{ fmt(b.avgPrice) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div class="flex gap-4 mt-4 text-[10px] text-slate-500">
              <span><span class="inline-block w-2 h-2 rounded-full align-middle mr-1" style="background:#a78bfa"></span>Domestic</span>
              <span><span class="inline-block w-2 h-2 rounded-full align-middle mr-1" style="background:#34d399"></span>BUMN</span>
              <span><span class="inline-block w-2 h-2 rounded-full align-middle mr-1" style="background:#f87171"></span>Asing</span>
            </div>
          </section>

          <!-- Panel: Broker Flow (intraday) -->
          <section class="glow-card rounded-2xl p-6">
            <h3 class="text-sm font-bold text-slate-100 mb-1">Broker Flow <span class="text-slate-500 font-normal">— aliran kumulatif {{ period === '1d' ? 'intraday' : 'harian' }}</span></h3>
            <p class="text-[11px] text-slate-500 mb-3">Nilai net kumulatif tiap broker teratas (kiri) vs harga (kanan){{ period === '1d' ? ', sepanjang sesi' : '' }}.</p>
            <div v-if="flowOption" class="h-[360px] w-full">
              <ClientOnly>
                <VChart :option="flowOption" class="w-full h-full" autoresize />
                <template #fallback><div class="w-full h-full flex items-center justify-center text-slate-500 text-sm">Memuat grafik…</div></template>
              </ClientOnly>
            </div>
            <p v-else class="text-xs text-slate-500 py-8 text-center">Data aliran broker intraday belum tersedia untuk {{ codeOnly }}.</p>
          </section>

          <!-- Panel: Broker Distribution (Sankey) -->
          <section class="glow-card rounded-2xl p-6">
            <h3 class="text-sm font-bold text-slate-100 mb-1">Broker Distribution <span class="text-slate-500 font-normal">— siapa distribusi ke siapa</span></h3>
            <p class="text-[11px] text-slate-500 mb-3">Aliran nilai dari broker pembeli besar (kiri) ke broker penjual (kanan). Warna = tipe broker.</p>
            <div v-if="sankeyOption" class="h-[460px] w-full">
              <ClientOnly>
                <VChart :option="sankeyOption" class="w-full h-full" autoresize />
                <template #fallback><div class="w-full h-full flex items-center justify-center text-slate-500 text-sm">Memuat grafik…</div></template>
              </ClientOnly>
            </div>
            <p v-else class="text-xs text-slate-500 py-8 text-center">Data distribusi broker belum tersedia untuk {{ codeOnly }}.</p>
          </section>

          <footer class="p-4 rounded-2xl bg-slate-900/40 border border-slate-800 text-[11px] text-slate-500">
            Sumber: Stockbit (data broker IDX). Di-cache per hari (WIB). Untuk pemakaian pribadi.
          </footer>
        </template>
      </template>

    </main>
  </div>
</template>
