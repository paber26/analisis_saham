<script setup lang="ts">
import { useSimulationEngine } from '~/composables/useSimulationEngine';
import { fmtIDR, fmtNum, fmtPct } from '~/utils/simFormat';

const sim = useSimulationEngine();
</script>

<template>
  <section class="space-y-4">
    <div class="grid lg:grid-cols-3 gap-4">
      <div class="lg:col-span-2 rounded-2xl bg-slate-900/60 border border-slate-800 p-4">
        <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <div class="text-[11px] text-slate-500 uppercase font-bold">Nilai Portofolio · {{ sim.timeline[sim.cursor] }}</div>
            <div class="text-2xl font-extrabold" :class="sim.currentReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ fmtIDR(sim.currentValue) }} <span class="text-sm">({{ fmtPct(sim.currentReturnPct) }})</span></div>
          </div>
          <div class="flex items-center gap-2.5">
            <div class="text-right bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-1.5">
              <div class="text-[10px] text-slate-500 font-bold uppercase">Benchmark IHSG</div>
              <div class="text-xs font-bold text-sky-400">{{ fmtPct(sim.currentIhsgReturnPct) }}</div>
            </div>
            <div class="text-right bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-1.5">
              <div class="text-[10px] text-slate-500 font-bold uppercase">Alpha vs IHSG</div>
              <div class="text-xs font-extrabold" :class="sim.currentAlphaPct >= 0 ? 'text-emerald-400' : 'text-rose-400'">
                {{ sim.currentAlphaPct >= 0 ? '🚀 +' : '🔻 ' }}{{ fmtNum(sim.currentAlphaPct, 1) }}%
              </div>
            </div>
          </div>
        </div>
        <div class="h-64"><VChart :option="sim.equityOption" class="w-full h-full" autoresize /></div>
        <!-- Regime-aware stop guidance -->
        <div v-if="sim.regimeInfo" class="mt-3 flex items-center gap-2 flex-wrap text-[11px] rounded-xl border px-3 py-2" :class="sim.regimeBadgeClass">
          <span class="font-bold">{{ sim.regimeEmoji }} {{ sim.regimeInfo.label }}</span>
          <span class="opacity-80">· saran cut-loss: <b>{{ sim.regimeInfo.cutloss }}</b> (jual bila rugi &lt; {{ sim.regimeInfo.threshold }}%)</span>
        </div>
        <!-- Progress + controls -->
        <div class="mt-3 h-1.5 rounded-full bg-slate-800 overflow-hidden"><div class="h-full bg-emerald-500 transition-all" :style="{ width: sim.progressPct + '%' }"></div></div>
        <div class="flex items-center gap-2 mt-3">
          <button v-if="!sim.playing" @click="sim.play" class="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold">▶ Putar</button>
          <button v-else @click="sim.pause" class="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm font-bold">⏸ Jeda</button>
          <button @click="sim.stepOnce" class="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold">⏭ 1 hari</button>
          <div class="flex items-center gap-1 ml-auto text-[11px] text-slate-500">Kecepatan
            <select v-model.number="sim.speed" class="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200"><option :value="2">2×</option><option :value="4">4×</option><option :value="8">8×</option></select>
          </div>
        </div>
      </div>
      <!-- Holdings -->
      <div class="rounded-2xl bg-slate-900/60 border border-slate-800 p-4">
        <div class="text-[11px] text-slate-500 uppercase font-bold mb-2">Posisi</div>
        <div class="space-y-2">
          <div v-for="b in sim.basket" :key="b.code" class="flex items-center justify-between text-xs bg-slate-950/60 rounded-lg px-3 py-2 border border-slate-800">
            <div><span class="font-bold text-slate-100">{{ b.code }}</span><div class="text-[10px] text-slate-500">{{ (sim.positions[b.code]?.lots ?? 0) }} lot @ {{ fmtIDR(sim.positions[b.code]?.avgPrice ?? b.entryPrice) }}</div></div>
            <div class="text-right tabular-nums">
              <div :class="(sim.priceAt(b.code, sim.cursor) / (sim.positions[b.code]?.avgPrice || b.entryPrice) - 1) >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ fmtIDR(sim.priceAt(b.code, sim.cursor)) }}</div>
              <div class="text-[10px]" :class="(sim.priceAt(b.code, sim.cursor) / (sim.positions[b.code]?.avgPrice || b.entryPrice) - 1) >= 0 ? 'text-emerald-500' : 'text-rose-500'">{{ fmtPct((sim.priceAt(b.code, sim.cursor) / (sim.positions[b.code]?.avgPrice || b.entryPrice) - 1) * 100) }}</div>
            </div>
          </div>
          <div class="flex items-center justify-between text-xs px-3 pt-1 text-slate-500"><span>Kas</span><span class="tabular-nums">{{ fmtIDR(sim.cash) }}</span></div>
        </div>
      </div>
    </div>
  </section>
</template>
