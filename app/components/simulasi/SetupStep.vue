<script setup lang="ts">
import { ref } from 'vue';
import { useSimulationEngine } from '~/composables/useSimulationEngine';
import { yearsAgoDate, monthsAgoDate, fmtPct, fmtNum } from '~/utils/simFormat';

const sim = useSimulationEngine();
// Template ref milik komponen ini (dulu startDateInput di page) — hanya untuk
// memicu date-picker bawaan browser.
const dateInput = ref<HTMLInputElement | null>(null);
function openDatePicker() {
  try {
    dateInput.value?.showPicker();
  } catch {
    /* fallback if showPicker is not supported */
  }
}
</script>

<template>
  <section class="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-5">
    <h2 class="text-lg font-bold text-slate-100">1 · Pilih Titik Waktu &amp; Parameter</h2>
    <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <label class="block cursor-pointer">
        <span class="text-[11px] font-bold text-slate-500 uppercase">Tanggal Masuk (masa lalu)</span>
        <div class="relative mt-1">
          <input
            ref="dateInput"
            v-model="sim.startDate"
            type="date"
            :max="yearsAgoDate(0)"
            class="w-full bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-10 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 [color-scheme:dark] cursor-pointer"
            @click="openDatePicker"
          />
          <button
            type="button"
            @click="openDatePicker"
            class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-400 text-sm p-1 rounded transition-colors"
            title="Buka Kalender"
          >
            📅
          </button>
        </div>
      </label>
      <label class="block">
        <span class="text-[11px] font-bold text-slate-500 uppercase">Horizon (hari bursa)</span>
        <input v-model.number="sim.horizonDays" type="number" min="5" max="250" class="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100" />
      </label>
      <label class="block">
        <span class="text-[11px] font-bold text-slate-500 uppercase">Keputusan tiap (hari)</span>
        <input v-model.number="sim.decisionEveryDays" type="number" min="1" max="60" class="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100" />
      </label>
      <label class="block">
        <span class="text-[11px] font-bold text-slate-500 uppercase">Modal awal (Rp)</span>
        <input v-model.number="sim.initialCapital" type="number" step="1000000" class="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100" />
      </label>
    </div>
    <div class="flex items-center gap-2 flex-wrap">
      <span class="text-[11px] text-slate-500 font-bold uppercase mr-1">Cepat:</span>
      <button v-for="p in [{l:'6 bln lalu',d:monthsAgoDate(6)},{l:'1 thn lalu',d:yearsAgoDate(1)},{l:'2 thn lalu',d:yearsAgoDate(2)},{l:'3 thn lalu',d:yearsAgoDate(3)}]" :key="p.l"
        @click="sim.startDate = p.d" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700">{{ p.l }}</button>
    </div>
    <button @click="sim.loadScreening" :disabled="sim.loadingScreen" class="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-sm rounded-xl transition-colors">
      {{ sim.loadingScreen ? 'Memuat screening…' : 'Lihat Screening pada tanggal ini →' }}
    </button>
    <p class="text-[11px] text-slate-500">Screening dihitung ulang dari harga ≤ tanggal itu (tanpa lookahead). Untuk universe penuh, load pertama bisa ~10–30 detik lalu di-cache.</p>
  </section>

  <!-- SAVED HISTORY (setup landing) -->
  <section class="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-3">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-bold text-slate-100">📚 Riwayat Simulasi Tersimpan</h2>
      <span class="text-[11px] text-slate-500">{{ sim.savedSessions.length }} sesi</span>
    </div>
    <p v-if="!sim.savedSessions.length" class="text-xs text-slate-500">Belum ada. Jalankan simulasi lalu tekan <span class="text-emerald-400 font-semibold">Simpan analisa</span> di akhir — sesi akan muncul di sini untuk kamu pelajari kembali.</p>
    <div v-else class="grid sm:grid-cols-2 gap-2">
      <div v-for="s in sim.savedSessions" :key="s.id" @click="sim.openReview(s.id)" role="button" tabindex="0"
        class="group text-left rounded-xl bg-slate-950/60 border border-slate-800 hover:border-emerald-500/40 p-3.5 transition-colors cursor-pointer">
        <div class="flex items-center justify-between gap-2">
          <span class="font-bold text-slate-100 text-sm">📅 {{ s.startDate }}</span>
          <div class="flex items-center gap-2">
            <span v-if="s.totalReturnPct != null" class="text-sm font-bold tabular-nums" :class="s.totalReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ fmtPct(s.totalReturnPct) }}</span>
            <span v-if="s.alphaPct != null" class="text-[10px] font-bold px-2 py-0.5 rounded-full border" :class="s.alphaPct >= 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'">
              {{ s.alphaPct >= 0 ? '🚀 +' : '🔻 ' }}{{ fmtNum(s.alphaPct, 1) }}% vs IHSG
            </span>
            <button type="button" @click.stop="sim.promptDeleteSession(s.id, s.startDate)" title="Hapus sesi"
              class="shrink-0 w-6 h-6 flex items-center justify-center rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors opacity-60 group-hover:opacity-100">🗑</button>
          </div>
        </div>
        <div class="text-[11px] text-slate-400 mt-1.5 truncate">{{ s.picks.join(' · ') }}</div>
        <div class="text-[10px] text-slate-600 mt-1 flex items-center justify-between">
          <span>horizon {{ s.horizonDays }} hari bursa · {{ s.status }}</span>
          <span class="text-emerald-400 font-semibold">tinjau →</span>
        </div>
      </div>
    </div>
  </section>
</template>
