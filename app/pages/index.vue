<script setup lang="ts">
// Root path lands on the technical screening dashboard
await navigateTo('/screening');
</script>

<template>
  <div class="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
    <div class="flex flex-col items-center gap-3">
      <div class="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      <p class="text-sm">Mengarahkan ke halaman Screening Saham...</p>
    </div>
  </div>
</template>
