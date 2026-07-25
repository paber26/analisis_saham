<template>
  <div class="min-h-screen bg-slate-950 text-slate-50 font-sans flex flex-col antialiased selection:bg-emerald-500/30 selection:text-emerald-200">
    <div class="flex flex-1 relative min-h-screen overflow-x-hidden">
      <!-- Mobile Backdrop Overlay -->
      <div
        v-if="isMobileOpen"
        @click="isMobileOpen = false"
        class="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden transition-opacity"
      ></div>

      <!-- FIXED SIDEBAR -->
      <aside
        class="fixed top-0 left-0 bottom-0 z-50 h-screen bg-slate-950 border-r border-slate-900 flex flex-col justify-between transition-all duration-300 shadow-2xl shrink-0"
        :class="[
          isMobileOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0',
          isCollapsed ? 'lg:w-20' : 'lg:w-64'
        ]"
      >
        <!-- Sidebar Top Logo Section -->
        <div>
          <div class="p-4 border-b border-slate-900 flex items-center justify-between gap-3 h-16">
            <NuxtLink to="/screening" class="flex items-center gap-3 group overflow-hidden">
              <div class="p-2 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl shadow-lg shadow-emerald-500/10 group-hover:scale-105 transition-transform shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-950" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div v-if="!isCollapsed" class="whitespace-nowrap transition-opacity">
                <h1 class="text-sm font-bold text-slate-50 tracking-tight flex items-center gap-1.5">
                  Saham IDX <span class="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 font-mono">PRO</span>
                </h1>
                <p class="text-[10px] text-slate-400">Analisis Saham BEI</p>
              </div>
            </NuxtLink>

            <!-- Toggle Collapse Desktop -->
            <button
              @click="isCollapsed = !isCollapsed"
              class="hidden lg:flex items-center justify-center p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-900 rounded-lg transition-colors"
              :title="isCollapsed ? 'Perluas Sidebar' : 'Ciutkan Sidebar'"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform duration-300" :class="{ 'rotate-180': isCollapsed }" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          </div>

          <!-- Navigation Links List (Internal scrollable if content overflows sidebar height) -->
          <div class="px-3 py-4 space-y-6 overflow-y-auto max-h-[calc(100vh-130px)] scrollbar-thin">
            <!-- Group 1: Pasar & Screening -->
            <div class="space-y-1">
              <div v-if="!isCollapsed" class="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Pasar &amp; Screener
              </div>

              <NuxtLink
                to="/pasar"
                @click="isMobileOpen = false"
                class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group relative"
                :class="[route.path.startsWith('/pasar') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60']"
                :title="isCollapsed ? 'Pasar' : ''"
              >
                <span class="text-sm shrink-0">🏛️</span>
                <span v-if="!isCollapsed" class="truncate">Pasar (Market)</span>
              </NuxtLink>

              <NuxtLink
                to="/screening"
                @click="isMobileOpen = false"
                class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group relative"
                :class="[route.path.startsWith('/screening') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60']"
                :title="isCollapsed ? 'Screening' : ''"
              >
                <span class="text-sm shrink-0">🔍</span>
                <span v-if="!isCollapsed" class="truncate">Screening Saham</span>
              </NuxtLink>
            </div>

            <!-- Group 2: Analisis Saham Individual -->
            <div class="space-y-1">
              <div v-if="!isCollapsed" class="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Analisis Emiten ({{ lastSymbol }})
              </div>

              <NuxtLink
                :to="`/analisa/${lastSymbol}`"
                @click="isMobileOpen = false"
                class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group relative"
                :class="[route.path.startsWith('/analisa') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60']"
                :title="isCollapsed ? 'Analisa' : ''"
              >
                <span class="text-sm shrink-0">📊</span>
                <span v-if="!isCollapsed" class="truncate">Hub Analisa {{ lastSymbol }}</span>
              </NuxtLink>

              <NuxtLink
                :to="`/saham?symbol=${lastSymbol}`"
                @click="isMobileOpen = false"
                class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group relative"
                :class="[route.path.startsWith('/saham') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60']"
                :title="isCollapsed ? 'Chart & Keuangan' : ''"
              >
                <span class="text-sm shrink-0">📈</span>
                <span v-if="!isCollapsed" class="truncate">Chart &amp; Keuangan</span>
              </NuxtLink>

              <NuxtLink
                :to="`/forecast?symbol=${lastSymbol}`"
                @click="isMobileOpen = false"
                class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group relative"
                :class="[route.path.startsWith('/forecast') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60']"
                :title="isCollapsed ? 'Forecast' : ''"
              >
                <span class="text-sm shrink-0">🎯</span>
                <span v-if="!isCollapsed" class="truncate">Forecast Harga</span>
              </NuxtLink>

              <NuxtLink
                :to="`/seasonal?symbol=${lastSymbol}`"
                @click="isMobileOpen = false"
                class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group relative"
                :class="[route.path.startsWith('/seasonal') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60']"
                :title="isCollapsed ? 'Pola Musiman' : ''"
              >
                <span class="text-sm shrink-0">🗓️</span>
                <span v-if="!isCollapsed" class="truncate">Pola Musiman</span>
              </NuxtLink>

              <NuxtLink
                :to="`/profil-saham?symbol=${lastSymbol}`"
                @click="isMobileOpen = false"
                class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group relative"
                :class="[route.path.startsWith('/profil-saham') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60']"
                :title="isCollapsed ? 'Profil Emiten' : ''"
              >
                <span class="text-sm shrink-0">🏢</span>
                <span v-if="!isCollapsed" class="truncate">Profil Emiten</span>
              </NuxtLink>

              <NuxtLink
                :to="`/bandar/${lastSymbol}`"
                @click="isMobileOpen = false"
                class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group relative"
                :class="[route.path.startsWith('/bandar') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60']"
                :title="isCollapsed ? 'Bandarmology' : ''"
              >
                <span class="text-sm shrink-0">🏦</span>
                <span v-if="!isCollapsed" class="truncate">Bandarmology (Broker)</span>
              </NuxtLink>
            </div>

            <!-- Group 3: Portofolio & Tooling -->
            <div class="space-y-1">
              <div v-if="!isCollapsed" class="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Portofolio &amp; Riset
              </div>

              <NuxtLink
                to="/watchlist"
                @click="isMobileOpen = false"
                class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group relative"
                :class="[route.path.startsWith('/watchlist') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60']"
                :title="isCollapsed ? 'Watchlist' : ''"
              >
                <span class="text-sm shrink-0">⭐</span>
                <span v-if="!isCollapsed" class="truncate">Watchlist</span>
              </NuxtLink>

              <NuxtLink
                to="/portofolio"
                @click="isMobileOpen = false"
                class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group relative"
                :class="[route.path.startsWith('/portofolio') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60']"
                :title="isCollapsed ? 'Portofolio' : ''"
              >
                <span class="text-sm shrink-0">💼</span>
                <span v-if="!isCollapsed" class="truncate">Portofolio</span>
              </NuxtLink>

              <NuxtLink
                to="/backtest"
                @click="isMobileOpen = false"
                class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group relative"
                :class="[route.path.startsWith('/backtest') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60']"
                :title="isCollapsed ? 'Backtest' : ''"
              >
                <span class="text-sm shrink-0">🧪</span>
                <span v-if="!isCollapsed" class="truncate">Backtest Strategi</span>
              </NuxtLink>

              <NuxtLink
                to="/simulasi"
                @click="isMobileOpen = false"
                class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group relative"
                :class="[route.path.startsWith('/simulasi') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60']"
                :title="isCollapsed ? 'Simulasi Mesin Waktu' : ''"
              >
                <span class="text-sm shrink-0">🕰️</span>
                <span v-if="!isCollapsed" class="truncate">Simulasi Mesin Waktu</span>
              </NuxtLink>
            </div>

            <!-- Group 4: Pengetahuan & Infrastruktur -->
            <div class="space-y-1">
              <div v-if="!isCollapsed" class="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Edukasi &amp; Sistem
              </div>

              <NuxtLink
                to="/belajar"
                @click="isMobileOpen = false"
                class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group relative border border-emerald-500/20 bg-emerald-500/5"
                :class="[route.path.startsWith('/belajar') ? 'bg-emerald-500/10 text-emerald-400 shadow-sm' : 'text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/10']"
                :title="isCollapsed ? 'Pusat Belajar (LMS)' : ''"
              >
                <span class="text-sm shrink-0">🎓</span>
                <span v-if="!isCollapsed" class="truncate">Pusat Belajar (LMS)</span>
              </NuxtLink>

              <NuxtLink
                to="/edukasi"
                @click="isMobileOpen = false"
                class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group relative"
                :class="[route.path.startsWith('/edukasi') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60']"
                :title="isCollapsed ? 'Edukasi' : ''"
              >
                <span class="text-sm shrink-0">📚</span>
                <span v-if="!isCollapsed" class="truncate">Perpustakaan &amp; Catatan</span>
              </NuxtLink>

              <NuxtLink
                to="/pengembangan"
                @click="isMobileOpen = false"
                class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group relative"
                :class="[route.path.startsWith('/pengembangan') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60']"
                :title="isCollapsed ? 'Pengembangan' : ''"
              >
                <span class="text-sm shrink-0">🛠️</span>
                <span v-if="!isCollapsed" class="truncate">Arsitektur WMI</span>
              </NuxtLink>
            </div>
          </div>
        </div>

        <!-- Sidebar Footer Status -->
        <div class="p-3 border-t border-slate-900 bg-slate-950/90">
          <div v-if="!isCollapsed" class="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs">
            <div>
              <div class="text-[10px] text-slate-500 font-bold uppercase">Saham Terakhir</div>
              <div class="font-extrabold text-emerald-400">{{ lastSymbol }}</div>
            </div>
            <NuxtLink :to="`/analisa/${lastSymbol}`" class="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold rounded">
              Buka
            </NuxtLink>
          </div>
          <div v-else class="text-center font-bold text-xs text-emerald-400 py-1">
            {{ lastSymbol }}
          </div>
        </div>
      </aside>

      <!-- MAIN CONTENT WRAPPER (Offset by fixed sidebar width on desktop) -->
      <div
        class="flex-1 flex flex-col min-w-0 transition-all duration-300"
        :class="[
          isCollapsed ? 'lg:ml-20' : 'lg:ml-64'
        ]"
      >
        <!-- TOP HEADER BAR -->
        <header class="sticky top-0 z-30 h-16 bg-slate-950/80 backdrop-blur-md border-b border-slate-900 px-4 sm:px-6 flex items-center justify-between gap-4">
          <!-- Left: Mobile Menu Toggle & Breadcrumb -->
          <div class="flex items-center gap-3">
            <button
              @click="isMobileOpen = !isMobileOpen"
              class="lg:hidden p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-900 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div class="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <span class="hidden sm:inline text-slate-500">Analisis Saham BEI</span>
              <span class="hidden sm:inline text-slate-700">/</span>
              <span class="text-slate-200 capitalize font-bold">{{ currentPageTitle }}</span>
            </div>
          </div>

          <!-- Right: Stock Search & Market Badge -->
          <div class="flex items-center gap-3">
            <div class="hidden sm:flex items-center gap-2 text-xs bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-slate-400">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>BEI Daily Feed</span>
            </div>

            <NuxtLink
              :to="`/analisa/${lastSymbol}`"
              class="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <span>⚡</span> {{ lastSymbol }}
            </NuxtLink>

            <!-- Auth: login link, or logged-in user + logout -->
            <div v-if="loggedIn" class="flex items-center gap-2">
              <span class="hidden sm:inline text-[11px] text-slate-400">👤 {{ user }}</span>
              <button
                type="button" @click="onLogout"
                class="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-bold transition-all"
              >Keluar</button>
            </div>
            <NuxtLink
              v-else to="/login"
              class="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-bold transition-all"
            >Masuk</NuxtLink>
          </div>
        </header>

        <!-- PAGE CONTENT CONTAINER (+ optional screening rail on analysis pages) -->
        <div class="flex-grow flex min-w-0 items-start">
          <main class="flex-grow min-w-0 p-4 sm:p-6 lg:p-8" :class="{ 'max-w-7xl w-full mx-auto': !showRail }">
            <slot />
          </main>
          <aside
            v-if="showRail"
            class="hidden lg:block w-[300px] xl:w-[340px] shrink-0 sticky top-16 h-[calc(100vh-4rem)] border-l border-slate-900 bg-slate-950/60 overflow-hidden"
          >
            <ScreenRail />
          </aside>
        </div>

        <!-- ADMIN FOOTER -->
        <footer class="border-t border-slate-900 bg-slate-950 py-5 text-slate-500 text-xs mt-auto px-4 sm:px-6">
          <div class="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
            <div>© Analisis Saham BEI — Admin Dashboard Interface</div>
            <div class="flex items-center gap-4 text-slate-400">
              <NuxtLink to="/belajar" class="hover:text-emerald-400">🎓 Pusat Belajar</NuxtLink>
              <NuxtLink to="/pengembangan" class="hover:text-emerald-400">📐 Cetak Biru WMI</NuxtLink>
            </div>
          </div>
        </footer>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

const route = useRoute();
const router = useRouter();
const isCollapsed = ref(false);
const isMobileOpen = ref(false);

// Auth (single owner). Logged in via session cookie → all gated features unlock.
const { user, loggedIn, logout } = useAuth();
async function onLogout() {
  await logout();
  router.push('/login');
}

// Emiten-analysis pages get a screening list in the right rail (desktop) so the
// user can switch stocks without going back to /screening.
const RAIL_PREFIXES = ['/analisa', '/saham', '/forecast', '/seasonal', '/profil-saham', '/bandar'];
const showRail = computed(() => RAIL_PREFIXES.some((p) => route.path.startsWith(p)));

const { last: lastSymbol, hydrate } = useLastSymbol();
onMounted(hydrate);

const currentPageTitle = computed(() => {
  const p = route.path;
  if (p.startsWith('/pasar')) return 'Pasar (Market Breadth)';
  if (p.startsWith('/screening')) return 'Screening Saham';
  if (p.startsWith('/analisa')) return 'Hub Analisa Emiten';
  if (p.startsWith('/forecast')) return 'Forecast & Proyeksi';
  if (p.startsWith('/backtest')) return 'Backtest Strategi';
  if (p.startsWith('/simulasi')) return 'Simulasi Mesin Waktu';
  if (p.startsWith('/seasonal')) return 'Pola Musiman';
  if (p.startsWith('/saham')) return 'Chart & Keuangan';
  if (p.startsWith('/profil-saham')) return 'Profil Emiten';
  if (p.startsWith('/bandar')) return 'Bandarmology (Broker Analysis)';
  if (p.startsWith('/watchlist')) return 'Watchlist';
  if (p.startsWith('/portofolio')) return 'Portofolio';
  if (p.startsWith('/edukasi')) return 'Perpustakaan & Catatan';
  if (p.startsWith('/pengembangan')) return 'Arsitektur & WMI Blueprint';
  return 'Dashboard';
});
</script>
