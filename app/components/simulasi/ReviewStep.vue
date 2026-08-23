<script setup lang="ts">
import { useSimulationEngine } from '~/composables/useSimulationEngine';
import { fmtIDR, fmtNum, fmtPct, ratingClass, actionLabel } from '~/utils/simFormat';

const sim = useSimulationEngine();
</script>

<template>
  <section v-if="sim.reviewData" class="space-y-5">
    <div class="flex items-center justify-between flex-wrap gap-3">
      <h2 class="text-lg font-bold text-slate-100">📖 Tinjau Sesi · {{ sim.reviewData.startDate }} <span class="text-sm text-slate-500 font-normal">(horizon {{ sim.reviewData.horizonDays }} hari)</span></h2>
      <div class="flex items-center gap-2">
        <button @click="sim.deleteSavedSession(sim.reviewData.id)" class="px-3 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold">🗑 Hapus</button>
        <button @click="sim.reset" class="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300">← Kembali ke daftar</button>
      </div>
    </div>

    <div v-if="sim.reviewData.result" class="space-y-4">
      <div v-if="sim.reviewData.result.alphaPct != null" class="rounded-2xl p-4 border flex items-center justify-between flex-wrap gap-3" :class="sim.reviewData.result.alphaPct >= 0 ? 'bg-emerald-500/[0.08] border-emerald-500/30' : 'bg-rose-500/[0.08] border-rose-500/30'">
        <div class="flex items-center gap-2">
          <span class="text-base">{{ sim.reviewData.result.alphaPct >= 0 ? '🚀' : '🔻' }}</span>
          <span class="font-extrabold text-sm" :class="sim.reviewData.result.alphaPct >= 0 ? 'text-emerald-300' : 'text-rose-300'">
            {{ sim.reviewData.result.alphaPct >= 0 ? 'MENGALAHKAN BENCHMARK IHSG' : 'DI BAWAH BENCHMARK IHSG' }}
          </span>
        </div>
        <div class="text-xs font-bold" :class="sim.reviewData.result.alphaPct >= 0 ? 'text-emerald-400' : 'text-rose-400'">
          Alpha: {{ sim.reviewData.result.alphaPct >= 0 ? '+' : '' }}{{ fmtNum(sim.reviewData.result.alphaPct, 1) }}% vs IHSG
        </div>
      </div>

      <div class="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4"><div class="text-[10px] text-slate-500 uppercase font-bold">Return Total</div><div class="text-xl font-extrabold" :class="sim.reviewData.result.totalReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ fmtPct(sim.reviewData.result.totalReturnPct) }}</div></div>
        <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4"><div class="text-[10px] text-slate-500 uppercase font-bold">Benchmark IHSG</div><div class="text-xl font-extrabold text-sky-400">{{ fmtPct(sim.reviewData.result.ihsgReturnPct ?? null) }}</div></div>
        <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4"><div class="text-[10px] text-slate-500 uppercase font-bold">Nilai Akhir</div><div class="text-xl font-extrabold text-slate-100">{{ fmtIDR(sim.reviewData.result.finalValue) }}</div></div>
        <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4"><div class="text-[10px] text-slate-500 uppercase font-bold">Max Drawdown</div><div class="text-xl font-extrabold text-rose-400">{{ fmtPct(sim.reviewData.result.maxDrawdownPct) }}</div></div>
        <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4"><div class="text-[10px] text-slate-500 uppercase font-bold">Win Rate</div><div class="text-xl font-extrabold text-slate-100">{{ fmtNum(sim.reviewData.result.winRate, 0) }}%</div></div>
      </div>
    </div>

    <div class="grid lg:grid-cols-2 gap-4">
      <!-- Keranjang + kontribusi -->
      <div class="rounded-2xl bg-slate-900/60 border border-slate-800 p-4">
        <div class="text-sm font-bold text-slate-100 mb-3">Keranjang &amp; Kontribusi</div>
        <div class="space-y-2">
          <div v-for="p in sim.reviewData.picks" :key="p.code" class="flex items-center justify-between text-xs">
            <div><span class="font-bold text-slate-200">{{ p.code }}</span><span class="text-slate-500 ml-2">{{ p.lots }} lot @ {{ fmtIDR(p.entryPrice) }}</span></div>
            <div class="tabular-nums text-slate-500">bobot {{ fmtNum(p.weightPct, 0) }}%</div>
          </div>
          <div v-if="sim.reviewData.result?.perStock" class="pt-2 mt-1 border-t border-slate-800 space-y-1.5">
            <div v-for="s in sim.reviewData.result.perStock" :key="s.code" class="flex items-center justify-between text-xs">
              <span class="font-semibold text-slate-300">{{ s.code }}</span>
              <div class="flex items-center gap-3 tabular-nums"><span :class="s.returnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ fmtPct(s.returnPct) }}</span><span class="text-slate-500 w-20 text-right">kontrib {{ fmtPct(s.contributionPct) }}</span></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Jejak keputusan -->
      <div class="rounded-2xl bg-slate-900/60 border border-slate-800 p-4">
        <div class="text-sm font-bold text-slate-100 mb-3">Jejak Keputusan</div>
        <div v-if="sim.reviewData.decisions?.length" class="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          <div v-for="(d, i) in sim.reviewData.decisions" :key="i" class="flex items-center justify-between text-xs bg-slate-950/60 rounded-lg px-3 py-2 border border-slate-800">
            <div class="flex items-center gap-2 min-w-0">
              <span class="text-slate-500 tabular-nums shrink-0">{{ d.date }}</span>
              <span class="font-bold text-slate-200 shrink-0">{{ d.code }}</span>
              <span class="px-1.5 py-0.5 rounded-full border text-[10px] font-bold shrink-0" :class="ratingClass(d.rating)">{{ d.rating }}</span>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold" :class="d.action === 'SELL' ? 'bg-rose-500/15 text-rose-300' : d.action === 'AVERAGE_DOWN' ? 'bg-amber-500/15 text-amber-300' : 'bg-slate-700 text-slate-300'">{{ actionLabel(d.action) }}</span>
              <span class="tabular-nums" :class="d.unrealizedPct >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ fmtPct(d.unrealizedPct) }}</span>
            </div>
          </div>
        </div>
        <p v-else class="text-xs text-slate-500">Tidak ada keputusan tercatat (semua ditahan otomatis).</p>
      </div>
    </div>

    <!-- Regresi tersimpan -->
    <div v-if="sim.reviewData.result?.regression" class="rounded-2xl bg-slate-900/60 border border-slate-800 p-4">
      <div class="text-sm font-bold text-slate-100 mb-1">📉 Regresi faktor (tersimpan)</div>
      <div class="text-[11px] text-slate-400 mb-2">n = {{ sim.reviewData.result.regression.n }} · R² = {{ fmtNum(sim.reviewData.result.regression.r2 * 100, 1) }}% · adj-R² = {{ fmtNum(sim.reviewData.result.regression.adjR2 * 100, 1) }}%</div>
      <table class="w-full text-[11px]">
        <thead class="text-slate-500 uppercase text-[10px]"><tr><th class="text-left py-1">Faktor</th><th class="text-right">Koef</th><th class="text-right">t</th><th class="text-right">p</th></tr></thead>
        <tbody class="text-slate-300">
          <tr v-for="t in sim.reviewData.result.regression.terms" :key="t.name" class="border-t border-slate-800/60">
            <td class="py-1.5 font-semibold">{{ t.name }}</td>
            <td class="text-right tabular-nums" :class="t.coef >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ fmtNum(t.coef, 3) }}</td>
            <td class="text-right tabular-nums text-slate-400">{{ fmtNum(t.tStat, 2) }}</td>
            <td class="text-right tabular-nums" :class="t.pValue < 0.05 ? 'text-emerald-400 font-bold' : 'text-slate-500'">{{ fmtNum(t.pValue, 3) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <button @click="sim.reset" class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm">← Kembali ke daftar</button>
  </section>
</template>
