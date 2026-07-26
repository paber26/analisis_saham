<template>
  <div class="min-h-screen bg-slate-950 text-slate-50 font-sans flex flex-col antialiased selection:bg-cyan-500/30 selection:text-cyan-200">
    <div class="flex flex-1 relative min-h-screen overflow-x-hidden">
      <!-- Mobile backdrop -->
      <div v-if="isMobileOpen" @click="isMobileOpen = false" class="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden"></div>

      <!-- SIMULATION LAB SIDEBAR (distinct quant/cyan theme) -->
      <aside
        class="fixed top-0 left-0 bottom-0 z-50 h-screen w-64 bg-gradient-to-b from-slate-950 to-cyan-950/25 border-r border-cyan-500/15 flex flex-col justify-between shadow-2xl transition-transform duration-300"
        :class="[isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0']"
      >
        <div class="min-h-0 flex flex-col">
          <!-- Brand -->
          <div class="p-4 border-b border-cyan-500/15 h-16 flex items-center gap-3 shrink-0">
            <div class="p-2 bg-gradient-to-br from-cyan-400 to-sky-500 rounded-xl shadow-lg shadow-cyan-500/20">
              <span class="text-slate-950 text-sm">🕰️</span>
            </div>
            <div>
              <h1 class="text-sm font-bold text-slate-50 tracking-tight">Simulasi Lab</h1>
              <p class="text-[10px] text-cyan-300/70">Time-Machine Quant Studio</p>
            </div>
          </div>

          <!-- Nav -->
          <div class="px-3 py-4 space-y-5 overflow-y-auto scrollbar-thin flex-1">
            <div class="space-y-1">
              <div class="px-3 text-[10px] font-bold text-cyan-300/60 uppercase tracking-wider mb-1.5">Ruang Kerja</div>
              <NuxtLink
                v-for="l in nav" :key="l.to"
                :to="l.to" @click="isMobileOpen = false"
                class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all"
                :class="[l.active() ? 'bg-cyan-500/15 text-cyan-200 border border-cyan-500/25' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60']"
              >
                <span>{{ l.icon }}</span> <span class="truncate">{{ l.label }}</span>
              </NuxtLink>
            </div>

            <!-- Selected date context (global) -->
            <div class="mx-1 p-3 rounded-xl bg-slate-900/70 border border-cyan-500/15">
              <div class="text-[10px] text-slate-500 font-bold uppercase mb-1">Tanggal Simulasi Aktif</div>
              <input v-model="simDate" type="date" :max="today" class="w-full bg-slate-950 border border-cyan-500/20 rounded-lg px-2 py-1.5 text-xs text-cyan-200" />
              <NuxtLink to="/simulasi/kondisi-pasar" class="mt-2 block text-center text-[11px] font-bold text-cyan-300 hover:text-cyan-200">Lihat kondisi pasar →</NuxtLink>
            </div>

            <!-- Panduan quick anchors -->
            <div v-if="route.path.startsWith('/simulasi/panduan')" class="space-y-1">
              <div class="px-3 text-[10px] font-bold text-cyan-300/60 uppercase tracking-wider mb-1.5">Loncat ke</div>
              <a v-for="a in anchors" :key="a.id" :href="`#${a.id}`" @click="isMobileOpen = false"
                class="block px-3 py-1.5 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-cyan-300 hover:bg-slate-900/60 transition-colors truncate">{{ a.label }}</a>
            </div>

            <!-- Live stats card -->
            <div class="mx-1 p-3 rounded-xl bg-slate-900/70 border border-cyan-500/15 space-y-2">
              <div class="text-[10px] text-slate-500 font-bold uppercase">Bank Pembelajaran</div>
              <div class="flex items-end gap-2">
                <span class="text-lg font-extrabold text-cyan-300">{{ sessionCount }}</span>
                <span class="text-[10px] text-slate-500 mb-1">sesi tersimpan</span>
              </div>
              <div class="flex items-center justify-between text-[10px] text-slate-500">
                <span>Aturan lakukan/hindari</span><span class="text-cyan-400 font-bold">{{ rulesCount }}</span>
              </div>
              <div class="flex items-center justify-between text-[10px] text-slate-500">
                <span>Total keputusan</span><span class="text-slate-300 font-bold">{{ decisionCount }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Back to analysis app -->
        <div class="p-3 border-t border-cyan-500/15">
          <NuxtLink to="/screening" class="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all">
            <span>←</span> Kembali ke Analisis Saham
          </NuxtLink>
        </div>
      </aside>

      <!-- MAIN -->
      <div class="flex-1 flex flex-col min-w-0 lg:ml-64">
        <header class="sticky top-0 z-30 h-16 bg-slate-950/80 backdrop-blur-md border-b border-cyan-500/15 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <button @click="isMobileOpen = !isMobileOpen" class="lg:hidden p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-900">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div class="flex items-center gap-2 text-xs font-semibold">
              <span class="text-cyan-300/70">🕰️ Simulasi Lab</span>
              <span class="hidden sm:inline text-slate-700">/</span>
              <span class="hidden sm:inline text-slate-200 font-bold">{{ pageLabel }}</span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="hidden sm:flex items-center gap-2 text-[11px] bg-cyan-500/10 border border-cyan-500/20 px-3 py-1.5 rounded-xl text-cyan-300 font-bold">
              📅 {{ simDate }}
            </span>
            <NuxtLink to="/screening" class="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-300 hover:border-emerald-500/30 text-xs font-bold transition-all">
              ← Analisis
            </NuxtLink>
          </div>
        </header>

        <main class="flex-grow"><slot /></main>

        <footer class="border-t border-cyan-500/15 bg-slate-950 py-4 text-slate-600 text-[11px] px-4 sm:px-6 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>🕰️ Simulasi Lab — belajar dari kinerja masa lampau</span>
          <NuxtLink to="/simulasi/panduan" class="hover:text-cyan-300">📘 Panduan cara kerja</NuxtLink>
        </footer>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const route = useRoute();
const isMobileOpen = ref(false);

const simDate = useSimDate();
const today = new Date().toISOString().split('T')[0]!;

const nav = [
  { to: '/simulasi', icon: '🕰️', label: 'Simulasi Mesin Waktu', active: () => route.path === '/simulasi' },
  { to: '/simulasi/kondisi-pasar', icon: '🐂', label: 'Kondisi Pasar (Bull/Bear)', active: () => route.path.startsWith('/simulasi/kondisi-pasar') },
  { to: '/simulasi/riwayat', icon: '📚', label: 'Bank Pembelajaran', active: () => route.path.startsWith('/simulasi/riwayat') },
  { to: '/simulasi/panduan', icon: '📘', label: 'Panduan Cara Kerja', active: () => route.path.startsWith('/simulasi/panduan') }
];

const anchors = [
  { id: 'konsep', label: '1. Konsep & Tujuan' },
  { id: 'alur', label: '2. Alur Pengguna' },
  { id: 'sistem', label: '3. Arsitektur Sistem' },
  { id: 'data', label: '4. Model Data' },
  { id: 'api', label: '5. API Endpoints' },
  { id: 'mlr', label: '8. Regresi Linear' },
  { id: 'caveat', label: '10. Isu Metodologis' }
];

const pageLabel = computed(() => nav.find((l) => l.active())?.label ?? 'Mesin Waktu');

// Live learning-bank stats (best-effort; deduped by Nuxt).
const { data: sessions } = await useFetch<{ count: number }>('/api/sim/sessions', { default: () => ({ count: 0 }) });
const { data: insights } = await useFetch<{ totalDecisions: number; rules: unknown[] }>('/api/sim/insights', { default: () => ({ totalDecisions: 0, rules: [] }) });
const sessionCount = computed(() => sessions.value?.count ?? 0);
const rulesCount = computed(() => insights.value?.rules?.length ?? 0);
const decisionCount = computed(() => insights.value?.totalDecisions ?? 0);
</script>
