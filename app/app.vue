<template>
  <div class="min-h-screen bg-slate-950 text-slate-50 selection:bg-emerald-500/30 selection:text-emerald-200 font-sans flex flex-col">
    <NuxtRouteAnnouncer />
    
    <!-- Shared Navbar -->
    <nav class="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        <!-- Logo / Brand -->
        <NuxtLink to="/screening" class="flex items-center gap-3 group">
          <div class="p-2 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl shadow-lg shadow-emerald-500/10 group-hover:scale-105 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-slate-950" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div>
            <h1 class="text-lg font-bold text-slate-50 tracking-tight">
              Saham IDX <span class="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">PORTAL</span>
            </h1>
            <p class="text-[10px] text-slate-400">Analisis Musiman & Keuangan Saham BEI</p>
          </div>
        </NuxtLink>

        <!-- Navbar Links -->
        <div class="flex items-center gap-6">
          <NuxtLink 
            to="/seasonal" 
            class="text-sm font-semibold transition-colors"
            :class="[route.path.startsWith('/seasonal') ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200']"
          >
            Pola Musiman
          </NuxtLink>
          <NuxtLink
            to="/screening"
            class="text-sm font-semibold transition-colors"
            :class="[route.path.startsWith('/screening') ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200']"
          >
            Screening
          </NuxtLink>
          <NuxtLink
            to="/saham"
            class="text-sm font-semibold transition-colors"
            :class="[route.path.startsWith('/saham') ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200']"
          >
            Detail Saham & Keuangan
          </NuxtLink>
          <NuxtLink 
            to="/profil-saham" 
            class="text-sm font-semibold transition-colors"
            :class="[route.path.startsWith('/profil-saham') ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200']"
          >
            Profil Saham
          </NuxtLink>
          
          <a 
            href="/docs.html"
            target="_blank"
            class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-400 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-850 hover:border-slate-700 hover:text-emerald-350 transition-all"
          >
            <span>Panduan API</span>
          </a>
        </div>
      </div>
    </nav>

    <!-- Page Content Container -->
    <div class="flex-grow flex flex-col">
      <NuxtPage />
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute();
</script>
