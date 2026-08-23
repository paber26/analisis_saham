<script setup lang="ts">
import { useSimulationEngine } from '~/composables/useSimulationEngine';
import { fmtIDR, fmtNum, fmtPct, ratingClass } from '~/utils/simFormat';

const sim = useSimulationEngine();
</script>

<template>
  <section v-if="sim.result" class="space-y-5">
    <h2 class="text-lg font-bold text-slate-100">5 · Hasil &amp; Pembelajaran</h2>

    <!-- Benchmark Comparison Card -->
    <div class="rounded-2xl p-5 border overflow-hidden relative" :class="sim.result.alphaPct >= 0 ? 'bg-emerald-500/[0.08] border-emerald-500/30' : 'bg-rose-500/[0.08] border-rose-500/30'">
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div class="flex items-center gap-2">
            <span class="text-xl">{{ sim.result.alphaPct >= 0 ? '🚀' : '🔻' }}</span>
            <h3 class="text-base font-extrabold" :class="sim.result.alphaPct >= 0 ? 'text-emerald-300' : 'text-rose-300'">
              {{ sim.result.alphaPct >= 0 ? 'TERBUKTI MENGALAHKAN IHSG!' : 'DI BAWAH BENCHMARK IHSG' }}
            </h3>
          </div>
          <p class="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
            <template v-if="sim.result.alphaPct >= 0">
              Strategi kamu terbukti mengalahkan IHSG sebesar <strong class="text-emerald-400 font-bold">+{{ fmtNum(sim.result.alphaPct, 1) }}%</strong>!
              <template v-if="sim.result.totalReturnPct < 0">
                Meskipun portofolio bernilai minus, penurunannya jauh lebih terkendali dibanding pasar IHSG yang turun lebih dalam.
              </template>
              <template v-else>
                Portofolio kamu berhasil memaksimalkan tren naik melebihi kenaikan indeks pasar.
              </template>
            </template>
            <template v-else>
              Portofolio kamu tertinggal <strong class="text-rose-400 font-bold">{{ fmtNum(sim.result.alphaPct, 1) }}%</strong> di bawah performa IHSG pada periode ini.
            </template>
          </p>
        </div>

        <div class="flex items-center gap-4 bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 shrink-0">
          <div>
            <div class="text-[10px] text-slate-500 font-bold uppercase">Portofolio Kamu</div>
            <div class="text-lg font-black" :class="sim.result.totalReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ fmtPct(sim.result.totalReturnPct) }}</div>
          </div>
          <div class="text-slate-600 font-extrabold text-lg">vs</div>
          <div>
            <div class="text-[10px] text-slate-500 font-bold uppercase">IHSG Index</div>
            <div class="text-lg font-black text-sky-400">{{ fmtPct(sim.result.ihsgReturnPct) }}</div>
          </div>
          <div class="pl-3 border-l border-slate-800">
            <div class="text-[10px] text-slate-500 font-bold uppercase">Keunggulan (Alpha)</div>
            <div class="text-lg font-black" :class="sim.result.alphaPct >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ sim.result.alphaPct >= 0 ? '+' : '' }}{{ fmtNum(sim.result.alphaPct, 1) }}%</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Metrics -->
    <div class="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4"><div class="text-[10px] text-slate-500 uppercase font-bold">Return Portofolio</div><div class="text-xl font-extrabold" :class="sim.result.totalReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ fmtPct(sim.result.totalReturnPct) }}</div></div>
      <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4"><div class="text-[10px] text-slate-500 uppercase font-bold">Benchmark IHSG</div><div class="text-xl font-extrabold text-sky-400">{{ fmtPct(sim.result.ihsgReturnPct) }}</div></div>
      <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4"><div class="text-[10px] text-slate-500 uppercase font-bold">Nilai Akhir</div><div class="text-xl font-extrabold text-slate-100">{{ fmtIDR(sim.result.finalValue) }}</div></div>
      <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4"><div class="text-[10px] text-slate-500 uppercase font-bold">Max Drawdown</div><div class="text-xl font-extrabold text-rose-400">{{ fmtPct(sim.result.maxDrawdownPct) }}</div></div>
      <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4"><div class="text-[10px] text-slate-500 uppercase font-bold">Win Rate</div><div class="text-xl font-extrabold text-slate-100">{{ fmtNum(sim.result.winRate, 0) }}%</div></div>
    </div>

    <div class="h-56 rounded-2xl bg-slate-900/60 border border-slate-800 p-4"><VChart :option="sim.equityOption" class="w-full h-full" autoresize /></div>

    <div class="grid lg:grid-cols-2 gap-4">
      <!-- Per stock -->
      <div class="rounded-2xl bg-slate-900/60 border border-slate-800 p-4">
        <div class="text-sm font-bold text-slate-100 mb-3">Kontribusi per Saham</div>
        <div class="space-y-2">
          <div v-for="s in sim.result.perStock" :key="s.code" class="flex items-center justify-between text-xs">
            <span class="font-bold text-slate-200">{{ s.code }}</span>
            <div class="flex items-center gap-3 tabular-nums"><span :class="s.returnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ fmtPct(s.returnPct) }}</span><span class="text-slate-500 w-16 text-right">kontrib {{ fmtPct(s.contributionPct) }}</span></div>
          </div>
        </div>
      </div>
      <!-- Regression -->
      <div class="rounded-2xl bg-slate-900/60 border border-slate-800 p-4">
        <div class="text-sm font-bold text-slate-100 mb-1">📉 Regresi: apa yang mendorong return {{ sim.horizonDays }} hari?</div>
        <div v-if="sim.loadingReg" class="text-xs text-slate-500 py-4">Menghitung regresi universe…</div>
        <div v-else-if="sim.regression?.regression" class="space-y-3">
          <div class="text-[11px] text-slate-400">n = {{ sim.regression.n }} saham · R² = {{ fmtNum(sim.regression.regression.r2 * 100, 1) }}% · adj-R² = {{ fmtNum(sim.regression.regression.adjR2 * 100, 1) }}%</div>
          <table class="w-full text-[11px]">
            <thead class="text-slate-500 uppercase text-[10px]"><tr><th class="text-left py-1">Faktor</th><th class="text-right">Koef</th><th class="text-right">t</th><th class="text-right">p</th></tr></thead>
            <tbody class="text-slate-300">
              <tr v-for="t in sim.regression.regression.terms" :key="t.name" class="border-t border-slate-800/60">
                <td class="py-1.5 font-semibold">{{ t.name }}</td>
                <td class="text-right tabular-nums" :class="t.coef >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ fmtNum(t.coef, 3) }}</td>
                <td class="text-right tabular-nums text-slate-400">{{ fmtNum(t.tStat, 2) }}</td>
                <td class="text-right tabular-nums" :class="t.pValue < 0.05 ? 'text-emerald-400 font-bold' : 'text-slate-500'">{{ fmtNum(t.pValue, 3) }}</td>
              </tr>
            </tbody>
          </table>
          <div class="flex flex-wrap gap-2 pt-1">
            <span v-for="g in sim.regression.byRating" :key="g.rating" class="text-[10px] px-2 py-1 rounded-lg border" :class="ratingClass(g.rating)">{{ g.rating }}: {{ fmtPct(g.avgReturnPct) }} (n={{ g.n }})</span>
          </div>
        </div>
        <div v-else class="text-xs text-slate-500 py-4">Regresi tidak tersedia untuk periode ini.</div>
      </div>
    </div>

    <!-- Save + insights -->
    <div class="flex items-center gap-3 flex-wrap">
      <button v-if="!sim.savedId" @click="sim.saveSession" class="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm">💾 Simpan analisa sesi ini</button>
      <span v-else class="text-emerald-400 text-sm font-semibold">✓ Tersimpan ({{ sim.savedId }})</span>
      <button @click="sim.reset" class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm">↺ Simulasi baru</button>
    </div>

    <!-- Meta insights -->
    <div v-if="sim.insights" class="rounded-2xl bg-slate-900/60 border border-slate-800 p-5 space-y-3">
      <div class="text-sm font-bold text-slate-100">🧠 Pembelajaran lintas sesi ({{ sim.insights.settledSessions }} sesi · {{ sim.insights.totalDecisions }} keputusan)</div>
      <div v-if="sim.insights.rules?.length" class="grid sm:grid-cols-2 gap-2">
        <div v-for="(r, i) in sim.insights.rules" :key="i" class="rounded-xl border p-3" :class="r.kind === 'do' ? 'bg-emerald-500/5 border-emerald-500/20' : r.kind === 'avoid' ? 'bg-rose-500/5 border-rose-500/20' : 'bg-slate-800/40 border-slate-700'">
          <div class="text-xs font-bold" :class="r.kind === 'do' ? 'text-emerald-300' : r.kind === 'avoid' ? 'text-rose-300' : 'text-slate-300'">{{ r.kind === 'do' ? '✅' : r.kind === 'avoid' ? '⛔' : '•' }} {{ r.title }}</div>
          <div class="text-[11px] text-slate-400 mt-1">{{ r.detail }} <span class="text-slate-600">(n={{ r.samples }})</span></div>
        </div>
      </div>
      <p v-else class="text-xs text-slate-500">Belum cukup data. Jalankan &amp; simpan beberapa sesi lagi untuk memunculkan pola lakukan/hindari.</p>
    </div>
  </section>
</template>
