<script setup lang="ts">
defineProps<{
  insights: string[];
  stockCode: string;
}>();
</script>

<template>
  <div class="glow-card rounded-2xl p-6 relative overflow-hidden">
    <!-- Header with AI/Insight decoration -->
    <div class="flex items-center gap-3 mb-6">
      <div class="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      </div>
      <div>
        <h4 class="text-lg font-bold text-slate-100">Insight Otomatis</h4>
        <p class="text-xs text-slate-400">Analisis kecenderungan pergerakan historis saham {{ stockCode }}</p>
      </div>
    </div>

    <!-- Insights List -->
    <div class="space-y-4">
      <div 
        v-for="(insight, idx) in insights" 
        :key="idx" 
        class="flex gap-4 p-4 rounded-xl bg-slate-900/40 border border-slate-800/60 hover:border-slate-700/50 transition-colors"
      >
        <span class="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-400 text-xs flex items-center justify-center font-bold">
          {{ idx + 1 }}
        </span>
        <p 
          class="text-sm text-slate-300 leading-relaxed font-sans"
          v-html="insight"
        ></p>
      </div>

      <div 
        v-if="insights.length === 0" 
        class="text-center py-8 text-slate-500 text-sm"
      >
        Tidak ada data insight yang cukup untuk rentang waktu terpilih.
      </div>
    </div>
  </div>
</template>
