<script setup lang="ts">
// Halaman /saham telah digabung ke /forecast (candlestick + rasio keuangan sudah ada di sana).
// Redirect ini menjaga bookmark/link lama tetap berfungsi.

const route = useRoute();
const q = route.query;
const sym = (q.symbol as string) || (q.code as string) || '';
const to = sym
  ? `/forecast?symbol=${encodeURIComponent(String(sym).toUpperCase().trim())}${q.horizon ? `&horizon=${encodeURIComponent(String(q.horizon))}` : ''}`
  : '/forecast';

// Server: 302, Client: navigate
if (import.meta.server) {
  await navigateTo(to, { redirectCode: 302 });
} else {
  await navigateTo(to, { redirectCode: 302 });
}
</script>

<template>
  <div class="pb-16 bg-slate-950 text-slate-400 text-center py-20 text-sm">Mengalihkan ke Forecast…</div>
</template>
