<template>
  <div class="min-h-screen bg-slate-950 text-slate-50 font-sans flex flex-col antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
    <div class="flex flex-1 relative min-h-screen overflow-x-hidden">
      <!-- Mobile backdrop -->
      <div v-if="isMobileOpen" @click="isMobileOpen = false" class="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden"></div>

      <!-- LMS SIDEBAR (distinct academic theme) -->
      <aside
        class="fixed top-0 left-0 bottom-0 z-50 h-screen w-64 bg-gradient-to-b from-slate-950 to-indigo-950/30 border-r border-indigo-500/15 flex flex-col justify-between shadow-2xl transition-transform duration-300"
        :class="[isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0']"
      >
        <div class="min-h-0 flex flex-col">
          <!-- Brand -->
          <div class="p-4 border-b border-indigo-500/15 h-16 flex items-center gap-3 shrink-0">
            <div class="p-2 bg-gradient-to-br from-indigo-400 to-violet-500 rounded-xl shadow-lg shadow-indigo-500/20">
              <span class="text-slate-950 text-sm">🎓</span>
            </div>
            <div>
              <h1 class="text-sm font-bold text-slate-50 tracking-tight">Pusat Belajar</h1>
              <p class="text-[10px] text-indigo-300/70">Learning Management System</p>
            </div>
          </div>

          <!-- Nav -->
          <div class="px-3 py-4 space-y-5 overflow-y-auto scrollbar-thin flex-1">
            <NuxtLink
              to="/belajar" @click="isMobileOpen = false"
              class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all"
              :class="[route.path === '/belajar' ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/25' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60']"
            >
              <span>🏠</span> <span class="truncate">Beranda Belajar</span>
            </NuxtLink>

            <div class="space-y-1">
              <div class="px-3 text-[10px] font-bold text-indigo-300/60 uppercase tracking-wider mb-1.5">Program</div>
              <NuxtLink
                v-for="p in programs" :key="p.id"
                :to="`/belajar/program/${p.id}`" @click="isMobileOpen = false"
                class="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group"
                :class="[route.path === `/belajar/program/${p.id}` ? 'bg-indigo-500/15 text-indigo-200 border border-indigo-500/25' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60']"
              >
                <span class="flex items-center gap-2.5 min-w-0"><span class="shrink-0">{{ p.icon }}</span><span class="truncate">{{ p.short }}</span></span>
                <span class="shrink-0 text-[10px] font-bold" :class="progPct(p) === 100 ? 'text-emerald-400' : 'text-slate-500'">{{ progPct(p) }}%</span>
              </NuxtLink>
            </div>

            <div class="space-y-1">
              <div class="px-3 text-[10px] font-bold text-indigo-300/60 uppercase tracking-wider mb-1.5">Alat &amp; Referensi</div>
              <NuxtLink
                to="/belajar/lembar-kerja" @click="isMobileOpen = false"
                class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all"
                :class="[route.path.startsWith('/belajar/lembar-kerja') ? 'bg-amber-500/15 text-amber-300 border border-amber-500/25' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60']"
              >
                <span>🧮</span> <span class="truncate">Lembar Kerja WMI</span>
              </NuxtLink>
              <NuxtLink
                to="/edukasi" @click="isMobileOpen = false"
                class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-100 hover:bg-slate-900/60 transition-all"
              >
                <span>📚</span> <span class="truncate">Perpustakaan &amp; Catatan</span>
              </NuxtLink>
            </div>

            <!-- Progress mini -->
            <div class="mx-1 p-3 rounded-xl bg-slate-900/70 border border-indigo-500/15">
              <div class="flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase">
                <span>Progres Total</span><span class="text-amber-400">🔥 {{ stats.streak }}</span>
              </div>
              <div class="mt-1 flex items-end gap-2">
                <span class="text-lg font-extrabold text-indigo-300">{{ stats.percent }}%</span>
                <span class="text-[10px] text-slate-500 mb-1">{{ stats.completedLessons }}/{{ stats.totalLessons }} lesson</span>
              </div>
              <div class="mt-1.5 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div class="h-full bg-indigo-500 rounded-full transition-all" :style="{ width: stats.percent + '%' }"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Back to analysis app -->
        <div class="p-3 border-t border-indigo-500/15">
          <NuxtLink to="/screening" class="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all">
            <span>←</span> Kembali ke Analisis Saham
          </NuxtLink>
        </div>
      </aside>

      <!-- MAIN -->
      <div class="flex-1 flex flex-col min-w-0 lg:ml-64">
        <header class="sticky top-0 z-30 h-16 bg-slate-950/80 backdrop-blur-md border-b border-indigo-500/15 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <button @click="isMobileOpen = !isMobileOpen" class="lg:hidden p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-900">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div class="flex items-center gap-2 text-xs font-semibold">
              <span class="text-indigo-300/70">🎓 Pusat Belajar</span>
              <span class="hidden sm:inline text-slate-700">/</span>
              <span class="hidden sm:inline text-slate-200 font-bold">Mode Pembelajaran</span>
            </div>
          </div>
          <NuxtLink to="/screening" class="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-300 hover:border-emerald-500/30 text-xs font-bold transition-all">
            ← Analisis
          </NuxtLink>
        </header>

        <main class="flex-grow"><slot /></main>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const route = useRoute();
const isMobileOpen = ref(false);

// Shared with the page (same key → single request, deduped by Nuxt).
interface Lesson { id: string }
interface Prog { id: string; short: string; icon: string; paths: { modules: { lessons: Lesson[] }[] }[] }
interface Stats { totalLessons: number; completedLessons: number; percent: number; streak: number }
const { data } = await useFetch<{ programs: Prog[]; progress: { completed: string[] }; stats: Stats }>('/api/learning');

const programs = computed(() => data.value?.programs ?? []);
const stats = computed<Stats>(() => data.value?.stats ?? { totalLessons: 0, completedLessons: 0, percent: 0, streak: 0 });
const done = computed(() => new Set(data.value?.progress?.completed ?? []));

function progPct(p: Prog): number {
  const ls = p.paths.flatMap((path) => path.modules.flatMap((m) => m.lessons));
  if (!ls.length) return 0;
  return Math.round((ls.filter((l) => done.value.has(l.id)).length / ls.length) * 100);
}
</script>
