<script setup lang="ts">
import { useSimulationEngine } from '~/composables/useSimulationEngine';
import { fmtIDR, fmtNum, ratingClass } from '~/utils/simFormat';

const sim = useSimulationEngine();
</script>

<template>
  <section class="space-y-4">
    <div class="flex items-center justify-between flex-wrap gap-3">
      <h2 class="text-lg font-bold text-slate-100">3 · Racik Keranjang (Reksa Dana)</h2>
      <div class="flex gap-2">
        <button @click="sim.step = 'screen'" class="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300">← Pilih saham</button>
        <button @click="sim.equalizeWeights" class="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300" title="Ratakan bobot ke 100%">⚖ Bagi rata</button>
        <button @click="sim.startSimulation" :disabled="sim.loadingPrices || Math.abs(sim.totalWeight - 100) > 0.5" class="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 text-xs font-bold">{{ sim.loadingPrices ? 'Memuat harga…' : 'Mulai simulasi ▶' }}</button>
      </div>
    </div>
    <div class="rounded-xl border border-slate-800 overflow-x-auto">
      <table class="w-full text-xs">
        <thead class="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider">
          <tr><th class="px-4 py-3 text-left">Saham</th><th class="px-4 py-3 text-center">Rating</th><th class="px-4 py-3 text-right">Harga masuk</th><th class="px-4 py-3 text-right w-40">Bobot %</th><th class="px-4 py-3 text-right">Lot</th><th class="px-4 py-3 text-right">Alokasi</th></tr>
        </thead>
        <tbody class="divide-y divide-slate-800/70 text-slate-300">
          <tr v-for="b in sim.basket" :key="b.code">
            <td class="px-4 py-3"><span class="font-bold text-slate-100">{{ b.code }}</span><div class="text-[10px] text-slate-500 truncate max-w-[160px]">{{ b.name }}</div></td>
            <td class="px-4 py-3 text-center"><span class="px-2 py-0.5 rounded-full border text-[10px] font-bold" :class="ratingClass(b.rating)">{{ b.rating }}</span></td>
            <td class="px-4 py-3 text-right tabular-nums">{{ fmtIDR(b.entryPrice) }}</td>
            <td class="px-4 py-3 text-right"><input v-model.number="b.weightPct" @input="sim.recomputeLots" type="number" min="0" max="100" class="w-24 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-right text-slate-100" /></td>
            <td class="px-4 py-3 text-right font-bold tabular-nums">{{ b.lots }}</td>
            <td class="px-4 py-3 text-right tabular-nums text-slate-400">{{ fmtIDR(b.lots * 100 * b.entryPrice) }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="border-t border-slate-700 text-slate-400 font-bold"><td class="px-4 py-3">Total</td><td></td><td></td>
            <td class="px-4 py-3 text-right" :class="Math.abs(sim.totalWeight - 100) > 0.5 ? 'text-rose-400' : 'text-emerald-400'">{{ fmtNum(sim.totalWeight, 1) }}%</td><td></td>
            <td class="px-4 py-3 text-right">{{ fmtIDR(sim.basket.reduce((s,b)=>s+b.lots*100*b.entryPrice,0)) }}</td></tr>
        </tfoot>
      </table>
    </div>
    <p v-if="Math.abs(sim.totalWeight - 100) > 0.5" class="text-[11px] text-rose-400">Total bobot harus ≈ 100% (saat ini {{ fmtNum(sim.totalWeight,1) }}%).</p>
  </section>
</template>
