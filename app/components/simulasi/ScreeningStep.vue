<script setup lang="ts">
import { useSimulationEngine } from '~/composables/useSimulationEngine';
import { fmtIDR, fmtNum, fmtPct, ratingClass } from '~/utils/simFormat';

const sim = useSimulationEngine();
</script>

<template>
  <section class="space-y-4">
    <div class="flex items-center justify-between flex-wrap gap-3">
      <h2 class="text-lg font-bold text-slate-100">2 · Screening per {{ sim.startDate }} <span class="text-sm text-slate-500 font-normal">— pilih beberapa saham ({{ sim.selected.size }} terpilih)</span></h2>
      <div class="flex gap-2">
        <button @click="sim.step = 'setup'" class="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300">← Ubah tanggal</button>
        <button @click="sim.buildBasket" :disabled="sim.selected.size === 0" class="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 text-xs font-bold">Lanjut racik →</button>
      </div>
    </div>

    <!-- FILTER CONTROLS BAR -->
    <div class="rounded-xl bg-slate-900/80 border border-slate-800 p-4 space-y-3">
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div class="flex items-center gap-2 font-bold text-xs text-slate-200">
          <span>🔍 Filter Hasil Screening</span>
          <span class="text-[10px] text-slate-500 font-normal">({{ sim.filteredScreenRows.length }} dari {{ sim.screenRows.length }} saham cocok)</span>
        </div>

        <!-- Quick Presets -->
        <div class="flex items-center gap-2 text-[11px]">
          <span class="text-slate-500 font-bold uppercase">Preset:</span>
          <button @click="sim.applyPreset('super_momentum')" class="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 font-bold transition-colors">🔥 Super Momentum</button>
          <button @click="sim.applyPreset('near_high')" class="px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 font-bold transition-colors">🚀 Dekat High (&gt; -10%)</button>
          <button @click="sim.applyPreset('reset')" class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px]">↺ Reset</button>
        </div>
      </div>

      <div class="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
        <!-- Search Query -->
        <div>
          <span class="text-[10px] font-bold text-slate-500 uppercase block mb-1">Cari Kode / Nama</span>
          <input v-model="sim.filterQuery" type="text" placeholder="Misal: SSIA, BBCA..." class="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500" />
        </div>

        <!-- Rating Filter -->
        <div>
          <span class="text-[10px] font-bold text-slate-500 uppercase block mb-1">Rating</span>
          <select v-model="sim.filterRating" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-slate-200">
            <option value="ALL">Semua Rating</option>
            <option value="Kuat">Kuat</option>
            <option value="Menarik">Menarik</option>
            <option value="Netral">Netral</option>
            <option value="Lemah">Lemah</option>
          </select>
        </div>

        <!-- RS 3B Filter -->
        <div>
          <span class="text-[10px] font-bold text-slate-500 uppercase block mb-1">RS 3B (vs IHSG)</span>
          <select v-model="sim.filterRS3M" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-slate-200">
            <option value="ALL">Semua RS 3B</option>
            <option value="POS">📈 RS 3B Positif (&gt; 0% vs IHSG)</option>
            <option value="HIGH">🚀 RS 3B Sangat Kuat (&gt; +10%)</option>
          </select>
        </div>

        <!-- RSI Filter -->
        <div>
          <span class="text-[10px] font-bold text-slate-500 uppercase block mb-1">RSI (14)</span>
          <select v-model="sim.filterRSI" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-slate-200">
            <option value="ALL">Semua RSI</option>
            <option value="SAFE">✅ Belum Overbought (RSI &lt; 75)</option>
            <option value="HEALTHY">✨ Momentum Sehat (RSI 40 - 70)</option>
            <option value="OVERSOLD">🎯 Oversold (RSI &lt; 40)</option>
          </select>
        </div>

        <!-- Dari High Filter -->
        <div>
          <span class="text-[10px] font-bold text-slate-500 uppercase block mb-1">Dari High 52W</span>
          <select v-model="sim.filterDariHigh" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-slate-200">
            <option value="ALL">Semua Jarak High</option>
            <option value="NEAR10">🔥 Dekat Puncak (&gt; -10%)</option>
            <option value="NEAR20">📈 Cukup Dekat (&gt; -20%)</option>
          </select>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-2 flex-wrap text-[11px]">
      <span class="text-slate-500 font-bold uppercase mr-1">Distribusi:</span>
      <span class="px-2 py-0.5 rounded-full border font-bold" :class="ratingClass('Kuat')">Kuat {{ sim.ratingCounts.Kuat }}</span>
      <span class="px-2 py-0.5 rounded-full border font-bold" :class="ratingClass('Menarik')">Menarik {{ sim.ratingCounts.Menarik }}</span>
      <span class="px-2 py-0.5 rounded-full border font-bold" :class="ratingClass('Netral')">Netral {{ sim.ratingCounts.Netral }}</span>
      <span class="px-2 py-0.5 rounded-full border font-bold" :class="ratingClass('Lemah')">Lemah {{ sim.ratingCounts.Lemah }}</span>
      <span class="text-slate-600 ml-1">dari {{ sim.screenRows.length }} saham teratas</span>
      <div class="ml-auto flex items-center gap-2">
        <button @click="sim.showRecommendation = true" class="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 font-bold transition-colors">💡 Mana yang direkomendasikan?</button>
        <button @click="sim.showIndicatorHelp = true" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold transition-colors">❓ Arti indikator</button>
      </div>
    </div>
    <div class="rounded-xl border border-slate-800 overflow-x-auto">
      <table class="w-full text-xs">
        <thead class="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider select-none">
          <tr>
            <th class="px-3 py-3 text-left">Pilih</th>
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
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-800/70 text-slate-300">
          <tr v-for="r in sim.filteredScreenRows" :key="r.code" class="hover:bg-slate-900/40 cursor-pointer" :class="{ 'bg-emerald-500/5': sim.selected.has(r.code) }" @click="sim.toggle(r.code)">
            <td class="px-3 py-2.5"><input type="checkbox" :checked="sim.selected.has(r.code)" class="accent-emerald-500 pointer-events-none" /></td>
            <td class="px-3 py-2.5"><span class="font-bold text-slate-100">{{ r.code }}</span><div class="text-[10px] text-slate-500 truncate max-w-[160px]">{{ r.name }}</div></td>
            <td class="px-3 py-2.5 text-right tabular-nums">{{ fmtIDR(r.price) }}</td>
            <td class="px-3 py-2.5 text-center"><span class="px-2 py-0.5 rounded-full border text-[10px] font-bold" :class="ratingClass(r.rating)">{{ r.rating }}</span></td>
            <td class="px-3 py-2.5 text-right font-bold tabular-nums">{{ fmtNum(r.score, 0) }}</td>
            <td class="px-3 py-2.5 text-right tabular-nums" :class="(r.rs3m ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ fmtPct(r.rs3m) }}</td>
            <td class="px-3 py-2.5 text-right tabular-nums">{{ fmtNum(r.rsi, 0) }}</td>
            <td class="px-3 py-2.5 text-right tabular-nums text-slate-400">{{ fmtPct(r.pctFromHigh) }}</td>
          </tr>
          <tr v-if="!sim.filteredScreenRows.length">
            <td colspan="8" class="py-8 text-center text-slate-500">
              Tidak ada saham yang sesuai dengan filter saat ini.
              <button @click="sim.applyPreset('reset')" class="ml-2 text-emerald-400 font-bold hover:underline">Reset filter</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <!-- MODAL: rekomendasi -->
  <div v-if="sim.showRecommendation" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" @click.self="sim.showRecommendation = false">
    <div class="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6 space-y-4 max-h-[85vh] overflow-y-auto">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h3 class="text-lg font-bold text-slate-100">💡 Mana yang lebih direkomendasikan?</h3>
          <p class="text-xs text-slate-400 mt-1">Panduan objektif dari skor teknikal &amp; momentum per {{ sim.startDate }}. <span class="text-amber-300">Bukan ajakan beli</span> — kamu yang memutuskan; justru itu inti latihan ini.</p>
        </div>
        <button @click="sim.showRecommendation = false" class="shrink-0 text-slate-500 hover:text-slate-200 text-xl leading-none">✕</button>
      </div>
      <div class="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-3 text-[11px] text-emerald-200/80 leading-relaxed">
        <span class="font-bold text-emerald-300">Prinsip:</span> utamakan Rating <b>Kuat/Menarik</b> + <b>Skor</b> tinggi + <b>RS 3B</b> positif (mengungguli IHSG) + <b>RSI</b> belum overbought (&lt;80) + harga <b>dekat puncak</b> (Dari High mendekati 0). Diversifikasi 4–6 saham lintas sektor untuk menekan risiko.
      </div>
      <div v-if="sim.recommendations.length" class="space-y-2">
        <div v-for="(r, i) in sim.recommendations" :key="r.code" class="rounded-xl bg-slate-950/60 border border-slate-800 p-3">
          <div class="flex items-center justify-between gap-2 mb-2">
            <div class="flex items-center gap-2 min-w-0">
              <span class="w-5 h-5 rounded bg-slate-800 text-slate-400 text-[10px] font-bold flex items-center justify-center shrink-0">{{ i + 1 }}</span>
              <span class="font-bold text-slate-100">{{ r.code }}</span>
              <span class="px-2 py-0.5 rounded-full border text-[10px] font-bold shrink-0" :class="ratingClass(r.rating)">{{ r.rating }}</span>
              <span class="text-[11px] text-slate-500">skor {{ fmtNum(r.score, 0) }}</span>
            </div>
            <button @click="sim.selected.add(r.code)" :disabled="sim.selected.has(r.code)"
              class="shrink-0 px-3 py-1 rounded-lg text-[11px] font-bold transition-colors" :class="sim.selected.has(r.code) ? 'bg-emerald-500/15 text-emerald-400 cursor-default' : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'">
              {{ sim.selected.has(r.code) ? '✓ Dipilih' : '+ Pilih' }}
            </button>
          </div>
          <ul class="space-y-0.5">
            <li v-for="(x, j) in r.reasons" :key="'r' + j" class="text-[11px] text-emerald-300/90 flex gap-1.5"><span>✓</span><span>{{ x }}</span></li>
            <li v-for="(x, j) in r.cautions" :key="'c' + j" class="text-[11px] text-amber-300/90 flex gap-1.5"><span>⚠</span><span>{{ x }}</span></li>
          </ul>
        </div>
      </div>
      <p v-else class="text-xs text-slate-500">Tidak ada saham berating Kuat/Menarik pada tanggal ini.</p>
      <button @click="sim.showRecommendation = false" class="w-full px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm">Tutup</button>
    </div>
  </div>

  <!-- MODAL: arti indikator -->
  <div v-if="sim.showIndicatorHelp" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" @click.self="sim.showIndicatorHelp = false">
    <div class="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6 space-y-3 max-h-[85vh] overflow-y-auto">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-bold text-slate-100">❓ Arti Indikator Screening</h3>
        <button @click="sim.showIndicatorHelp = false" class="text-slate-500 hover:text-slate-200 text-xl leading-none">✕</button>
      </div>
      <div class="space-y-2.5">
        <div v-for="ind in [
          { k: 'Harga', d: 'Harga penutupan saham pada tanggal simulasi (bukan hari ini).' },
          { k: 'Rating', d: 'Kesimpulan kualitas teknikal, diturunkan dari Skor: Kuat > Menarik > Netral > Lemah.' },
          { k: 'Skor', d: 'Nilai teknikal 0–100 gabungan tren, momentum, & volume. Makin tinggi makin baik kondisi teknikalnya.' },
          { k: 'RS 3B', d: 'Relative Strength 3 bulan vs IHSG (%). Positif = mengungguli pasar; negatif = tertinggal dari pasar.' },
          { k: 'RSI', d: 'Relative Strength Index 0–100. >70 overbought (rawan koreksi), <30 oversold (jenuh jual), 50–70 momentum sehat.' },
          { k: 'Dari High', d: 'Jarak harga dari puncak 52 minggu (%). Mendekati 0% = dekat puncak (tren kuat); sangat negatif = jauh di bawah puncak.' }
        ]" :key="ind.k" class="flex gap-3 rounded-xl bg-slate-950/60 border border-slate-800 p-3">
          <span class="shrink-0 font-bold text-emerald-400 text-xs w-20">{{ ind.k }}</span>
          <span class="text-[11px] text-slate-400 leading-relaxed">{{ ind.d }}</span>
        </div>
      </div>
      <div class="rounded-xl bg-sky-500/5 border border-sky-500/20 p-3 text-[11px] text-sky-200/80 leading-relaxed">
        <span class="font-bold text-sky-300">Ingat:</span> semua dihitung dari data ≤ tanggal simulasi (tanpa lookahead) — inilah yang kamu lihat andai berada di masa itu.
      </div>
      <button @click="sim.showIndicatorHelp = false" class="w-full px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm">Tutup</button>
    </div>
  </div>
</template>
