<script setup lang="ts">
import { computed } from 'vue';

useHead({
  title: 'Konteks Pasar IDX — Breadth & Rotasi Sektor',
  meta: [
    { name: 'description', content: 'Regime pasar saham IDX: market breadth (% di atas MA200, advancers/decliners, RSI rata-rata) dan rotasi sektor berdasarkan skor teknikal.' }
  ]
});

const { data, pending, error } = await useFetch<any>(() => '/api/market');

const breadth = computed(() => data.value?.breadth || null);
const sectors = computed<any[]>(() => data.value?.sectors || []);

const regimeMeta = computed(() => {
  const b = breadth.value;
  // Deskripsi memakai angka breadth aktual agar tidak bertentangan dgn stat di bawahnya
  const p = b ? `${b.aboveMA200Pct}% saham di atas MA200` : '';
  const r = b?.regime;
  if (r === 'risk-on') return { label: 'RISK-ON', desc: `${p} — breadth kuat, momentum pasar cenderung positif.`, cls: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/[0.06]', bar: 'bg-emerald-500' };
  if (r === 'risk-off') return { label: 'RISK-OFF', desc: `${p} — breadth lemah, pasar defensif, hati-hati beli.`, cls: 'text-rose-300 border-rose-500/30 bg-rose-500/[0.06]', bar: 'bg-rose-500' };
  return { label: 'NETRAL', desc: `${p} — pasar campuran, pilih saham secara selektif.`, cls: 'text-amber-300 border-amber-500/30 bg-amber-500/[0.06]', bar: 'bg-amber-500' };
});

// Rata-rata skor sektor → warna bar RELATIF (memimpin/tertinggal), bukan absolut,
// supaya tetap membedakan sektor meski di pasar lemah skornya sama-sama rendah.
const sectorMean = computed(() => {
  const s = sectors.value;
  return s.length ? s.reduce((a, b) => a + b.avgScore, 0) / s.length : 0;
});
function sectorBarClass(score: number) {
  const m = sectorMean.value;
  if (score >= m + 3) return 'bg-emerald-500';
  if (score >= m) return 'bg-sky-500';
  if (score >= m - 3) return 'bg-slate-500';
  return 'bg-rose-500';
}
const pct = (n: number | null | undefined) => (n == null ? '—' : n + '%');
</script>

<template>
  <div class="pb-16 bg-slate-950 text-slate-100 flex flex-col flex-grow">
    <main class="max-w-7xl mx-auto px-4 sm:px-6 mt-8 flex-grow w-full space-y-6">

      <section class="glow-card rounded-2xl p-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-bold text-slate-50">Konteks Pasar</h2>
            <p class="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Analisa pasar secara keseluruhan sebelum memilih saham: kesehatan pasar (breadth) &amp; sektor mana yang memimpin.
              Diagregasi dari snapshot harian {{ data?.total ?? '—' }} saham.
            </p>
          </div>
          <span v-if="data" class="text-[10px] text-slate-500">📦 {{ data.date }}</span>
        </div>
      </section>

      <div v-if="pending" class="py-20 flex flex-col items-center justify-center gap-4 bg-slate-900/30 border border-slate-900 rounded-2xl">
        <div class="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p class="text-sm text-slate-400 animate-pulse">Menghitung breadth &amp; rotasi sektor…</p>
      </div>
      <div v-else-if="error" class="p-6 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-amber-200 text-sm">
        Snapshot pasar belum tersedia. Data terisi otomatis setelah sync harian (19:00 WIB) berjalan.
      </div>

      <template v-else-if="breadth">
        <!-- Regime guidance (position sizing / entry bias) -->
        <section v-if="breadth.guidance" class="glow-card rounded-2xl p-6">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 class="text-sm font-bold text-slate-100">Panduan Entry / Exit Berdasarkan Regime</h3>
              <p class="text-[11px] text-slate-400 mt-1 leading-relaxed max-w-2xl">{{ breadth.guidance.advice }}</p>
            </div>
            <div class="flex gap-3 text-[11px] font-bold">
              <span class="px-3 py-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 text-emerald-300">Maks posisi: {{ breadth.guidance.positionSizePct }}% modal</span>
              <span class="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-300">Bias: {{ breadth.guidance.entryBias }}</span>
            </div>
          </div>
        </section>

        <!-- Regime hero -->
        <section class="rounded-2xl border p-6" :class="regimeMeta.cls">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p class="text-[11px] uppercase tracking-wider opacity-70">Regime Pasar</p>
              <p class="text-3xl font-extrabold mt-1">{{ regimeMeta.label }}</p>
              <p class="text-xs mt-1 opacity-90 max-w-md">{{ regimeMeta.desc }}</p>
            </div>
            <div class="w-full sm:w-64">
              <div class="flex justify-between text-[11px] mb-1 opacity-80">
                <span>Skor regime</span><span class="font-bold">{{ breadth.regimeScore }}/100</span>
              </div>
              <div class="h-2.5 bg-slate-800/60 rounded-full overflow-hidden">
                <div class="h-full rounded-full" :class="regimeMeta.bar" :style="{ width: breadth.regimeScore + '%' }"></div>
              </div>
              <div class="flex justify-between text-[9px] mt-1 opacity-60">
                <span>risk-off</span><span>netral</span><span>risk-on</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Breadth stats -->
        <section class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div class="glow-card rounded-xl p-4">
            <p class="text-[10px] text-slate-500 uppercase">Di atas MA200</p>
            <p class="text-2xl font-extrabold mt-1" :class="breadth.aboveMA200Pct >= 50 ? 'text-emerald-400' : 'text-rose-400'">{{ breadth.aboveMA200Pct }}%</p>
            <p class="text-[10px] text-slate-500 mt-0.5">{{ breadth.aboveMA200 }}/{{ breadth.total }} saham</p>
          </div>
          <div class="glow-card rounded-xl p-4">
            <p class="text-[10px] text-slate-500 uppercase">Di atas MA50</p>
            <p class="text-2xl font-extrabold text-slate-100 mt-1">{{ breadth.aboveMA50Pct }}%</p>
          </div>
          <div class="glow-card rounded-xl p-4">
            <p class="text-[10px] text-slate-500 uppercase">Naik / Turun</p>
            <p class="text-lg font-extrabold mt-1"><span class="text-emerald-400">{{ breadth.advancers }}</span> <span class="text-slate-600">/</span> <span class="text-rose-400">{{ breadth.decliners }}</span></p>
          </div>
          <div class="glow-card rounded-xl p-4">
            <p class="text-[10px] text-slate-500 uppercase">RSI rata-rata</p>
            <p class="text-2xl font-extrabold mt-1" :class="breadth.avgRsi == null ? 'text-slate-500' : breadth.avgRsi > 60 ? 'text-rose-400' : breadth.avgRsi < 40 ? 'text-amber-400' : 'text-slate-100'">{{ breadth.avgRsi ?? '—' }}</p>
          </div>
          <div class="glow-card rounded-xl p-4">
            <p class="text-[10px] text-slate-500 uppercase">Dekat 52w High/Low</p>
            <p class="text-lg font-extrabold mt-1"><span class="text-emerald-400">{{ breadth.newHigh52 }}</span> <span class="text-slate-600">/</span> <span class="text-rose-400">{{ breadth.newLow52 }}</span></p>
          </div>
          <div class="glow-card rounded-xl p-4">
            <p class="text-[10px] text-slate-500 uppercase">Tren kuat (ADX≥25)</p>
            <p class="text-2xl font-extrabold text-slate-100 mt-1">{{ breadth.strongTrend }}</p>
          </div>
        </section>

        <!-- Sector rotation -->
        <section class="glow-card rounded-2xl overflow-hidden">
          <div class="p-6 pb-3">
            <h3 class="text-sm font-bold text-slate-100">Rotasi Sektor</h3>
            <p class="text-xs text-slate-400 mt-1">Diurutkan dari skor teknikal rata-rata tertinggi — sektor teratas sedang memimpin. Pilih sektor kuat dulu, baru sahamnya.</p>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm min-w-[720px]">
              <thead>
                <tr class="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                  <th class="px-4 py-2.5 font-semibold">Sektor</th>
                  <th class="px-4 py-2.5 font-semibold">Skor rata-rata</th>
                  <th class="px-4 py-2.5 font-semibold text-right">Perubahan</th>
                  <th class="px-4 py-2.5 font-semibold text-right">Di atas MA200</th>
                  <th class="px-4 py-2.5 font-semibold text-right">RS vs IHSG</th>
                  <th class="px-4 py-2.5 font-semibold">Pemimpin</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in sectors" :key="s.sector" class="border-b border-slate-900/70 hover:bg-slate-900/40 transition-colors">
                  <td class="px-4 py-3">
                    <span class="font-semibold text-slate-200">{{ s.sector }}</span>
                    <span class="text-[10px] text-slate-500 ml-1">({{ s.count }})</span>
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-bold text-slate-100 w-8">{{ s.avgScore }}</span>
                      <div class="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div class="h-full rounded-full" :class="sectorBarClass(s.avgScore)" :style="{ width: Math.min(100, s.avgScore) + '%' }"></div>
                      </div>
                    </div>
                  </td>
                  <td class="px-4 py-3 text-right font-semibold" :class="s.avgChangePct >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ s.avgChangePct >= 0 ? '+' : '' }}{{ s.avgChangePct }}%</td>
                  <td class="px-4 py-3 text-right text-slate-300">{{ pct(s.aboveMA200Pct) }}</td>
                  <td class="px-4 py-3 text-right font-semibold" :class="s.avgRs3m == null ? 'text-slate-600' : s.avgRs3m >= 0 ? 'text-emerald-400' : 'text-rose-400'">
                    {{ s.avgRs3m == null ? '—' : (s.avgRs3m >= 0 ? '+' : '') + s.avgRs3m + '%' }}
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex flex-wrap gap-1">
                      <NuxtLink v-for="c in s.leaders" :key="c" :to="`/analisa/${c}`"
                        class="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded hover:bg-emerald-500/20">{{ c }}</NuxtLink>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <footer class="p-5 rounded-2xl bg-rose-500/5 border border-rose-500/10">
          <p class="text-[11px] leading-relaxed text-slate-400">
            Breadth &amp; rotasi dihitung dari universe likuid yang dipantau (bukan seluruh bursa), sebagai gambaran regime.
            RS vs IHSG = selisih return 3 bulan terhadap indeks. Bukan rekomendasi investasi.
          </p>
        </footer>
      </template>

    </main>
  </div>
</template>
