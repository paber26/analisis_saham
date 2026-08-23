<script setup lang="ts">
import { useSimulationEngine } from '~/composables/useSimulationEngine';
import { fmtIDR, fmtNum, fmtPct, ratingClass } from '~/utils/simFormat';

const sim = useSimulationEngine();
</script>

<template>
  <div v-if="sim.decisionOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
    <div class="w-full max-w-4xl rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
      <!-- Header -->
      <div class="flex items-start justify-between gap-4 pb-3 border-b border-slate-800 flex-wrap">
        <div>
          <h3 class="text-lg font-bold text-slate-100 flex items-center gap-2">
            <span>🤔 Titik Keputusan Investasi</span>
            <span class="text-xs px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">{{ sim.timeline[sim.cursor] }}</span>
          </h3>
          <p class="text-xs text-slate-400 mt-1">Evaluasi indikator &amp; alokasikan modal ke saham eksisting atau saham prospektif baru pada tanggal ini.</p>
        </div>
        <div class="flex items-center gap-3">
          <div class="text-right bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-1.5 shrink-0">
            <div class="text-[10px] text-slate-500 font-bold uppercase">Kas Tersedia</div>
            <div class="text-sm font-extrabold text-emerald-400">{{ fmtIDR(sim.cash) }}</div>
          </div>
        </div>
      </div>

      <!-- Market Regime & Context Card -->
      <div class="rounded-xl p-3 bg-slate-950/80 border border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs">
        <div class="flex items-center gap-2.5">
          <span class="text-lg">{{ sim.currentIhsgReturnPct >= 2 ? '🚀' : sim.currentIhsgReturnPct < -2 ? '⚠️' : '⚖️' }}</span>
          <div>
            <span class="font-bold text-slate-200">Kondisi Pasar (IHSG): </span>
            <span class="font-extrabold" :class="sim.currentIhsgReturnPct >= 2 ? 'text-emerald-400' : sim.currentIhsgReturnPct < -2 ? 'text-rose-400' : 'text-sky-400'">
              {{ sim.currentIhsgReturnPct >= 2 ? 'Bullish (Tren Naik)' : sim.currentIhsgReturnPct < -2 ? 'Koreksi / Bearish (Tren Turun)' : 'Konsolidasi (Netral)' }}
            </span>
            <span class="text-slate-500 ml-2">({{ fmtPct(sim.currentIhsgReturnPct) }} sejak awal)</span>
          </div>
        </div>
        <div class="text-[11px] text-slate-400">
          Holding Aktif: <strong class="text-slate-200 font-bold">{{ sim.decisionRows.length }} saham</strong>
        </div>
        <!-- Regime-aware cut-loss suggestion (from entry-date Kondisi Pasar) -->
        <div v-if="sim.regimeInfo" class="w-full flex items-center justify-between gap-2 pt-2 mt-1 border-t border-slate-800/70 flex-wrap">
          <span class="text-[11px]">
            <span class="font-bold" :class="sim.regimeTextClass">{{ sim.regimeEmoji }} Fase pasar saat masuk: {{ sim.regimeInfo.label }}</span>
            <span class="text-slate-500"> · saran <b>{{ sim.regimeInfo.cutloss }}</b> → jual otomatis bila rugi &lt; {{ sim.regimeInfo.threshold }}%</span>
          </span>
          <button @click="sim.applySuggestions" class="px-3 py-1.5 rounded-lg bg-cyan-500/15 text-cyan-300 border border-cyan-500/25 text-[11px] font-bold hover:bg-cyan-500/25 transition-colors shrink-0">✨ Terapkan saran</button>
        </div>
      </div>

      <!-- Decision Tabs -->
      <div class="flex items-center justify-between gap-3 border-b border-slate-800 pb-2">
        <div class="flex items-center gap-2 text-xs font-bold">
          <button
            @click="sim.decisionTab = 'positions'"
            class="px-4 py-2 rounded-xl transition-all flex items-center gap-2 border"
            :class="sim.decisionTab === 'positions' ? 'bg-emerald-500 text-slate-950 border-emerald-500 shadow-md' : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'"
          >
            <span>💼 Posisi Eksisting</span>
            <span class="px-2 py-0.5 rounded-full text-[10px]" :class="sim.decisionTab === 'positions' ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-slate-300'">{{ sim.decisionRows.length }}</span>
          </button>
          <button
            @click="sim.decisionTab = 'buy_new'"
            class="px-4 py-2 rounded-xl transition-all flex items-center gap-2 border"
            :class="sim.decisionTab === 'buy_new' ? 'bg-emerald-500 text-slate-950 border-emerald-500 shadow-md' : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'"
          >
            <span>➕ Beli Saham Baru (Top Screening)</span>
          </button>
        </div>

        <div v-if="sim.decisionTab === 'positions'" class="flex items-center bg-slate-950 rounded-lg p-0.5 border border-slate-800 text-[11px] font-bold">
          <button @click="sim.decisionViewMode = 'cards'" class="px-2.5 py-1 rounded-md transition-colors" :class="sim.decisionViewMode === 'cards' ? 'bg-slate-800 text-slate-100' : 'text-slate-500 hover:text-slate-300'">🎴 Kartu</button>
          <button @click="sim.decisionViewMode = 'table'" class="px-2.5 py-1 rounded-md transition-colors" :class="sim.decisionViewMode === 'table' ? 'bg-slate-800 text-slate-100' : 'text-slate-500 hover:text-slate-300'">📊 Tabel</button>
        </div>
      </div>

      <!-- TAB 1: POSISI EKSISTING -->
      <div v-if="sim.decisionTab === 'positions'">
        <!-- CARDS VIEW MODE -->
        <div v-if="sim.decisionViewMode === 'cards'" class="space-y-3">
          <div v-for="d in sim.decisionRows" :key="d.code" class="rounded-xl bg-slate-950/60 border border-slate-800 p-4 space-y-3">
            <!-- Header row -->
            <div class="flex items-center justify-between flex-wrap gap-2">
              <div>
                <span class="font-extrabold text-slate-100 text-base">{{ d.code }}</span>
                <span class="ml-2 px-2 py-0.5 rounded-full border text-[10px] font-bold" :class="ratingClass(d.rating)">{{ d.rating }}</span>
                <span class="ml-2 text-xs text-slate-400">(Holding: <strong class="text-slate-200">{{ d.lots }} lot</strong> @ {{ fmtIDR(d.avgPrice) }})</span>
              </div>
              <div class="text-right text-xs tabular-nums">
                <span class="text-slate-300">{{ fmtIDR(d.price) }}</span>
                <span class="ml-2 font-bold" :class="d.plPct >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ fmtPct(d.plPct) }}</span>
              </div>
            </div>

            <!-- Technical Indicators Grid Bar -->
            <div class="grid grid-cols-3 sm:grid-cols-6 gap-2 bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 text-center text-[11px] tabular-nums">
              <div class="space-y-0.5">
                <div class="text-[9px] text-slate-500 uppercase font-bold">Harga</div>
                <div class="font-bold text-slate-100">{{ fmtIDR(d.price) }}</div>
              </div>
              <div class="space-y-0.5">
                <div class="text-[9px] text-slate-500 uppercase font-bold">Rating</div>
                <div>
                  <span class="px-1.5 py-0.5 rounded-full border text-[9px] font-bold" :class="ratingClass(d.rating)">{{ d.rating }}</span>
                </div>
              </div>
              <div class="space-y-0.5">
                <div class="text-[9px] text-slate-500 uppercase font-bold">Skor</div>
                <div class="font-extrabold text-slate-200">{{ fmtNum(d.score, 0) }}</div>
              </div>
              <div class="space-y-0.5">
                <div class="text-[9px] text-slate-500 uppercase font-bold">RS 3B</div>
                <div class="font-bold" :class="(d.rs3m ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ fmtPct(d.rs3m) }}</div>
              </div>
              <div class="space-y-0.5">
                <div class="text-[9px] text-slate-500 uppercase font-bold">RSI</div>
                <div class="font-bold" :class="(d.rsi ?? 50) > 70 ? 'text-amber-400' : (d.rsi ?? 50) < 30 ? 'text-sky-400' : 'text-slate-200'">{{ fmtNum(d.rsi, 0) }}</div>
              </div>
              <div class="space-y-0.5">
                <div class="text-[9px] text-slate-500 uppercase font-bold">Dari High</div>
                <div class="font-bold text-slate-400">{{ fmtPct(d.pctFromHigh) }}</div>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="grid grid-cols-4 gap-2">
              <button @click="d.action = 'HOLD'" class="px-2 py-2 rounded-lg text-xs font-bold border transition-colors" :class="d.action === 'HOLD' ? 'bg-emerald-500 text-slate-950 border-emerald-500' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'">Tahan</button>
              <button @click="d.action = 'SELL_50'" class="px-2 py-2 rounded-lg text-xs font-bold border transition-colors" :class="d.action === 'SELL_50' ? 'bg-sky-500 text-slate-950 border-sky-500' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'">Jual 50%</button>
              <button @click="d.action = 'SELL'" class="px-2 py-2 rounded-lg text-xs font-bold border transition-colors" :class="d.action === 'SELL' ? 'bg-rose-500 text-white border-rose-500' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'">Jual 100%</button>
              <button @click="d.action = 'AVERAGE_DOWN'" class="px-2 py-2 rounded-lg text-xs font-bold border transition-colors" :class="d.action === 'AVERAGE_DOWN' ? 'bg-amber-500 text-slate-950 border-amber-500' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'">Avg Down</button>
            </div>

            <!-- Detail Average Down Panel -->
            <div v-if="d.action === 'AVERAGE_DOWN'" class="p-3.5 rounded-xl bg-amber-500/[0.08] border border-amber-500/30 text-xs space-y-2.5">
              <div class="flex items-center justify-between flex-wrap gap-2">
                <span class="font-bold text-amber-300 flex items-center gap-1.5">
                  <span>📥</span> Jumlah Lot Average Down:
                </span>
                <div class="flex items-center gap-2">
                  <input
                    v-model.number="d.avgDownLots"
                    type="number"
                    min="1"
                    :max="Math.max(1, Math.floor(sim.cash / (d.price * 100)))"
                    class="w-20 bg-slate-950 border border-amber-500/50 rounded-lg px-2.5 py-1 text-right font-bold text-amber-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <span class="font-bold text-amber-200">lot</span>
                </div>
              </div>

              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-slate-950/60 p-2.5 rounded-lg border border-amber-500/20">
                <div>
                  <div class="text-slate-500">Biaya Pembelian</div>
                  <div class="font-bold text-slate-100 mt-0.5">{{ fmtIDR((d.avgDownLots || 0) * 100 * d.price) }}</div>
                </div>
                <div>
                  <div class="text-slate-500">Total Posisi Baru</div>
                  <div class="font-bold text-slate-100 mt-0.5">{{ d.lots + (d.avgDownLots || 0) }} lot</div>
                </div>
                <div>
                  <div class="text-slate-500">Avg Price Baru</div>
                  <div class="font-bold text-emerald-400 mt-0.5">Rp {{ Math.round((d.avgPrice * d.lots + d.price * (d.avgDownLots || 0)) / (d.lots + (d.avgDownLots || 0))).toLocaleString('id-ID') }}</div>
                </div>
                <div>
                  <div class="text-slate-500">Sisa Kas</div>
                  <div class="font-bold mt-0.5" :class="sim.cash >= (d.avgDownLots || 0) * 100 * d.price ? 'text-slate-100' : 'text-rose-400'">{{ fmtIDR(sim.cash - (d.avgDownLots || 0) * 100 * d.price) }}</div>
                </div>
              </div>

              <p v-if="sim.cash < (d.avgDownLots || 0) * 100 * d.price" class="text-[11px] text-rose-400 font-semibold">
                ⚠️ Kas tidak mencukupi untuk membeli {{ d.avgDownLots }} lot (Maksimal yang dapat dibeli: {{ Math.floor(sim.cash / (d.price * 100)) }} lot).
              </p>
            </div>

            <!-- Detail Jual 50% Panel -->
            <div v-else-if="d.action === 'SELL_50'" class="p-3 rounded-xl bg-sky-500/[0.08] border border-sky-500/30 text-xs">
              <div class="flex items-center justify-between text-[11px] text-slate-300">
                <span>Jual parsial (50%): <strong class="text-sky-300">{{ Math.ceil(d.lots / 2) }} lot</strong> @ {{ fmtIDR(d.price) }}</span>
                <span>Hasil Penjualan: <strong class="text-emerald-400">+{{ fmtIDR(Math.ceil(d.lots / 2) * 100 * d.price) }}</strong></span>
              </div>
            </div>

            <!-- Detail Jual 100% Panel -->
            <div v-else-if="d.action === 'SELL'" class="p-3 rounded-xl bg-rose-500/[0.08] border border-rose-500/30 text-xs">
              <div class="flex items-center justify-between text-[11px] text-slate-300">
                <span>Jual seluruh posisi: <strong class="text-rose-300">{{ d.lots }} lot</strong> @ {{ fmtIDR(d.price) }}</span>
                <span>Hasil Penjualan: <strong class="text-emerald-400">+{{ fmtIDR(d.lots * 100 * d.price) }}</strong></span>
              </div>
            </div>
          </div>
        </div>

        <!-- TABLE VIEW MODE -->
        <div v-else-if="sim.decisionViewMode === 'table'" class="rounded-xl border border-slate-800 overflow-x-auto">
          <table class="w-full text-xs">
            <thead class="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider select-none">
              <tr>
                <th @click="sim.sortBy('code')" class="px-3 py-3 text-left cursor-pointer hover:text-emerald-400 transition-colors">
                  Kode <span v-if="sim.sortKey === 'code'" class="text-emerald-400 font-bold">{{ sim.sortOrder === 'desc' ? '↓' : '↑' }}</span><span v-else class="text-slate-600">↕</span>
                </th>
                <th @click="sim.sortBy('price')" class="px-3 py-3 text-right cursor-pointer hover:text-emerald-400 transition-colors">
                  Harga (P&amp;L) <span v-if="sim.sortKey === 'price'" class="text-emerald-400 font-bold">{{ sim.sortOrder === 'desc' ? '↓' : '↑' }}</span><span v-else class="text-slate-600">↕</span>
                </th>
                <th @click="sim.sortBy('rating')" class="px-3 py-3 text-center cursor-pointer hover:text-emerald-400 transition-colors">
                  Rating <span v-if="sim.sortKey === 'rating'" class="text-emerald-400 font-bold">{{ sim.sortOrder === 'desc' ? '↓' : '↑' }}</span><span v-else class="text-slate-600">↕</span>
                </th>
                <th @click="sim.sortBy('score')" class="px-3 py-3 text-right cursor-pointer hover:text-emerald-400 transition-colors">
                  Skor <span v-if="sim.sortKey === 'score'" class="text-emerald-400 font-bold">{{ sim.sortOrder === 'desc' ? '↓' : '↑' }}</span><span v-else class="text-slate-600">↕</span>
                </th>
                <th @click="sim.sortBy('rs3m')" class="px-3 py-3 text-right cursor-pointer hover:text-emerald-400 transition-colors">
                  RS 3B <span v-if="sim.sortKey === 'rs3m'" class="text-emerald-400 font-bold">{{ sim.sortOrder === 'desc' ? '↓' : '↑' }}</span><span v-else class="text-slate-600">↕</span>
                </th>
                <th @click="sim.sortBy('rsi')" class="px-3 py-3 text-right cursor-pointer hover:text-emerald-400 transition-colors">
                  RSI <span v-if="sim.sortKey === 'rsi'" class="text-emerald-400 font-bold">{{ sim.sortOrder === 'desc' ? '↓' : '↑' }}</span><span v-else class="text-slate-600">↕</span>
                </th>
                <th @click="sim.sortBy('pctFromHigh')" class="px-3 py-3 text-right cursor-pointer hover:text-emerald-400 transition-colors">
                  Dari High <span v-if="sim.sortKey === 'pctFromHigh'" class="text-emerald-400 font-bold">{{ sim.sortOrder === 'desc' ? '↓' : '↑' }}</span><span v-else class="text-slate-600">↕</span>
                </th>
                <th class="px-3 py-3 text-left">Holding</th>
                <th class="px-3 py-3 text-center w-64">Tindakan</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/80 text-slate-300">
              <tr v-for="d in sim.sortedDecisionRows" :key="d.code" class="hover:bg-slate-950/40">
                <td class="px-3 py-3 font-bold text-slate-100">{{ d.code }}</td>
                <td class="px-3 py-3 text-right tabular-nums">
                  <div class="text-slate-200 font-bold">{{ fmtIDR(d.price) }}</div>
                  <div class="text-[10px]" :class="d.plPct >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ fmtPct(d.plPct) }}</div>
                </td>
                <td class="px-3 py-3 text-center">
                  <span class="px-2 py-0.5 rounded-full border text-[10px] font-bold" :class="ratingClass(d.rating)">{{ d.rating }}</span>
                </td>
                <td class="px-3 py-3 text-right font-extrabold text-slate-200 tabular-nums">{{ fmtNum(d.score, 0) }}</td>
                <td class="px-3 py-3 text-right tabular-nums font-bold" :class="(d.rs3m ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ fmtPct(d.rs3m) }}</td>
                <td class="px-3 py-3 text-right tabular-nums font-bold" :class="(d.rsi ?? 50) > 70 ? 'text-amber-400' : (d.rsi ?? 50) < 30 ? 'text-sky-400' : 'text-slate-200'">{{ fmtNum(d.rsi, 0) }}</td>
                <td class="px-3 py-3 text-right tabular-nums text-slate-400 font-semibold">{{ fmtPct(d.pctFromHigh) }}</td>
                <td class="px-3 py-3 text-left tabular-nums text-slate-400 text-[11px]">
                  <div><strong class="text-slate-200">{{ d.lots }} lot</strong></div>
                  <div class="text-[10px]">@ {{ fmtIDR(d.avgPrice) }}</div>
                </td>
                <td class="px-3 py-3">
                  <div class="flex items-center justify-center gap-1">
                    <button @click="d.action = 'HOLD'" class="px-2 py-1 rounded text-[10px] font-bold border" :class="d.action === 'HOLD' ? 'bg-emerald-500 text-slate-950 border-emerald-500' : 'bg-slate-800 text-slate-300 border-slate-700'">Tahan</button>
                    <button @click="d.action = 'SELL_50'" class="px-2 py-1 rounded text-[10px] font-bold border" :class="d.action === 'SELL_50' ? 'bg-sky-500 text-slate-950 border-sky-500' : 'bg-slate-800 text-slate-300 border-slate-700'">50%</button>
                    <button @click="d.action = 'SELL'" class="px-2 py-1 rounded text-[10px] font-bold border" :class="d.action === 'SELL' ? 'bg-rose-500 text-white border-rose-500' : 'bg-slate-800 text-slate-300 border-slate-700'">Jual</button>
                    <button @click="d.action = 'AVERAGE_DOWN'" class="px-2 py-1 rounded text-[10px] font-bold border" :class="d.action === 'AVERAGE_DOWN' ? 'bg-amber-500 text-slate-950 border-amber-500' : 'bg-slate-800 text-slate-300 border-slate-700'">Avg</button>
                  </div>
                  <div v-if="d.action === 'AVERAGE_DOWN'" class="mt-1.5 flex items-center justify-center gap-1 text-[10px]">
                    <span class="text-amber-300 font-semibold">Lot:</span>
                    <input v-model.number="d.avgDownLots" type="number" min="1" class="w-14 bg-slate-950 border border-amber-500/50 rounded px-1.5 py-0.5 text-right font-bold text-amber-200" />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- TAB 2: BELI SAHAM BARU (MID-SIMULATION RE-SCREENING) -->
      <div v-else-if="sim.decisionTab === 'buy_new'" class="space-y-4">
        <div class="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-200 leading-relaxed flex items-center justify-between flex-wrap gap-2">
          <div>
            <span class="font-bold text-emerald-400">💡 Putar Ulang Modal (Re-Investment):</span>
            Gunakan kas bebas dari hasil penjualan (<strong class="text-emerald-300 font-bold">{{ fmtIDR(sim.cash) }}</strong>) untuk membeli saham-saham baru dengan skor teknikal tertinggi pada tanggal <strong class="underline font-mono">{{ sim.timeline[sim.cursor] }}</strong>.
          </div>
        </div>

        <div v-if="sim.loadingMidScreen" class="py-12 text-center text-xs text-slate-500">
          <span class="inline-block animate-spin mr-2">⏳</span> Menjalankan Re-Screening as-of {{ sim.timeline[sim.cursor] }}…
        </div>

        <div v-else-if="sim.midScreenRows.length" class="rounded-xl border border-slate-800 overflow-x-auto">
          <table class="w-full text-xs">
            <thead class="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider select-none">
              <tr>
                <th @click="sim.sortBy('code')" class="px-3 py-3 text-left cursor-pointer hover:text-emerald-400 transition-colors">
                  Kode <span v-if="sim.sortKey === 'code'" class="text-emerald-400 font-bold">{{ sim.sortOrder === 'desc' ? '↓' : '↑' }}</span><span v-else class="text-slate-600">↕</span>
                </th>
                <th @click="sim.sortBy('price')" class="px-3 py-3 text-right cursor-pointer hover:text-emerald-400 transition-colors">
                  Harga <span v-if="sim.sortKey === 'price'" class="text-emerald-400 font-bold">{{ sim.sortOrder === 'desc' ? '↓' : '↑' }}</span><span v-else class="text-slate-600">↕</span>
                </th>
                <th @click="sim.sortBy('rating')" class="px-3 py-3 text-center cursor-pointer hover:text-emerald-400 transition-colors">
                  Rating <span v-if="sim.sortKey === 'rating'" class="text-emerald-400 font-bold">{{ sim.sortOrder === 'desc' ? '↓' : '↑' }}</span><span v-else class="text-slate-600">↕</span>
                </th>
                <th @click="sim.sortBy('score')" class="px-3 py-3 text-right cursor-pointer hover:text-emerald-400 transition-colors">
                  Skor <span v-if="sim.sortKey === 'score'" class="text-emerald-400 font-bold">{{ sim.sortOrder === 'desc' ? '↓' : '↑' }}</span><span v-else class="text-slate-600">↕</span>
                </th>
                <th @click="sim.sortBy('rs3m')" class="px-3 py-3 text-right cursor-pointer hover:text-emerald-400 transition-colors">
                  RS 3B <span v-if="sim.sortKey === 'rs3m'" class="text-emerald-400 font-bold">{{ sim.sortOrder === 'desc' ? '↓' : '↑' }}</span><span v-else class="text-slate-600">↕</span>
                </th>
                <th @click="sim.sortBy('rsi')" class="px-3 py-3 text-right cursor-pointer hover:text-emerald-400 transition-colors">
                  RSI <span v-if="sim.sortKey === 'rsi'" class="text-emerald-400 font-bold">{{ sim.sortOrder === 'desc' ? '↓' : '↑' }}</span><span v-else class="text-slate-600">↕</span>
                </th>
                <th @click="sim.sortBy('pctFromHigh')" class="px-3 py-3 text-right cursor-pointer hover:text-emerald-400 transition-colors">
                  Dari High <span v-if="sim.sortKey === 'pctFromHigh'" class="text-emerald-400 font-bold">{{ sim.sortOrder === 'desc' ? '↓' : '↑' }}</span><span v-else class="text-slate-600">↕</span>
                </th>
                <th class="px-3 py-3 text-center w-36">Beli (Rp Nominal)</th>
                <th class="px-3 py-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/80 text-slate-300">
              <tr v-for="r in sim.filteredMidScreenRows" :key="r.code" class="hover:bg-slate-950/40">
                <td class="px-3 py-2.5">
                  <span class="font-bold text-slate-100">{{ r.code }}</span>
                  <div class="text-[10px] text-slate-500 truncate max-w-[140px]">{{ r.name }}</div>
                </td>
                <td class="px-3 py-2.5 text-right tabular-nums font-bold text-slate-200">{{ fmtIDR(r.price) }}</td>
                <td class="px-3 py-2.5 text-center">
                  <span class="px-2 py-0.5 rounded-full border text-[10px] font-bold" :class="ratingClass(r.rating)">{{ r.rating }}</span>
                </td>
                <td class="px-3 py-2.5 text-right font-extrabold text-slate-200 tabular-nums">{{ fmtNum(r.score, 0) }}</td>
                <td class="px-3 py-2.5 text-right tabular-nums font-bold" :class="(r.rs3m ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ fmtPct(r.rs3m) }}</td>
                <td class="px-3 py-2.5 text-right tabular-nums font-bold" :class="(r.rsi ?? 50) > 70 ? 'text-amber-400' : (r.rsi ?? 50) < 30 ? 'text-sky-400' : 'text-slate-200'">{{ fmtNum(r.rsi, 0) }}</td>
                <td class="px-3 py-2.5 text-right tabular-nums text-slate-400 font-semibold">{{ fmtPct(r.pctFromHigh) }}</td>
                <td class="px-3 py-2.5 text-center">
                  <div class="flex items-center justify-center gap-1">
                    <span class="text-[11px] text-slate-500">Rp</span>
                    <input
                      v-model.number="sim.newStockBuyNominal[r.code]"
                      type="number"
                      min="0"
                      step="100000"
                      class="w-24 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-right font-bold text-slate-100"
                    />
                    <button type="button" @click="sim.newStockBuyNominal[r.code] = sim.cash" title="Pakai semua kas" class="px-1.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 font-bold">Max</button>
                  </div>
                  <div class="text-[10px] mt-0.5" :class="sim.lotsFromNominal(r) >= 1 ? 'text-emerald-400' : 'text-rose-400'">
                    ≈ {{ sim.lotsFromNominal(r) }} lot · {{ fmtIDR(sim.lotsFromNominal(r) * 100 * r.price) }}
                  </div>
                </td>
                <td class="px-3 py-2.5 text-center">
                  <button
                    @click="sim.buyNewStockMidSim(r)"
                    :disabled="sim.lotsFromNominal(r) < 1"
                    class="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold text-xs transition-colors"
                  >
                    + Beli
                  </button>
                </td>
              </tr>
              <tr v-if="!sim.filteredMidScreenRows.length">
                <td colspan="9" class="py-8 text-center text-slate-500">
                  Tidak ada saham yang sesuai dengan filter saat ini.
                  <button @click="sim.applyPreset('reset')" class="ml-2 text-emerald-400 font-bold hover:underline">Reset filter</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <button @click="sim.applyDecisions" class="w-full px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors shadow-lg shadow-emerald-500/20">
        Terapkan Keputusan &amp; Lanjutkan ▶
      </button>
    </div>
  </div>
</template>
