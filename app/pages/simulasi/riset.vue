<script setup lang="ts">
import { computed } from 'vue';
definePageMeta({ layout: 'simulasi' });
useHead({ title: 'Riset & Temuan — Simulasi Lab' });

// Hasil eksperimen (analisis lintas ratusan skenario acak, sudah termasuk biaya
// transaksi Indonesia beli 0,15% / jual 0,25%). Angka ringkas dari uji kami.
const THRESH = ['−5%', '−8%', '−12%', '−15%', 'tanpa'];
const regimeReturn = {
  bull: [2.33, 3.89, 4.26, 4.65, 4.93],
  bear: [-4.24, -5.41, -6.32, -6.67, -7.24],
  netral: [-0.77, -0.24, -0.21, -0.25, 0.65]
};
const freq = {
  labels: ['Mingguan\ncut-loss −8', 'Harian\ncut-loss −8', 'Harian\ntrailing 8%', 'Harian\ntrailing 12%', 'Hold\n(tanpa aturan)'],
  ret: [-0.64, -0.95, -0.32, -0.55, -0.02]
};

const barColor = (v: number) => (v >= 0 ? '#34d399' : '#fb7185');

const regimeOption = computed(() => ({
  grid: { left: 8, right: 12, top: 32, bottom: 20, containLabel: true },
  legend: { data: ['Bull 🐂', 'Bear 🐻', 'Sideways ➡️'], textStyle: { color: '#94a3b8', fontSize: 11 }, top: 0 },
  tooltip: { trigger: 'axis', valueFormatter: (v: number) => (v >= 0 ? '+' : '') + v.toFixed(2) + '%' },
  xAxis: { type: 'category', data: THRESH, name: 'ambang cut-loss', nameTextStyle: { color: '#64748b' }, axisLabel: { color: '#94a3b8', fontSize: 11 }, axisLine: { lineStyle: { color: '#1e293b' } } },
  yAxis: { type: 'value', axisLabel: { color: '#64748b', fontSize: 10, formatter: '{value}%' }, splitLine: { lineStyle: { color: '#1e293b' } } },
  series: [
    { name: 'Bull 🐂', type: 'bar', data: regimeReturn.bull, itemStyle: { color: '#34d399', borderRadius: [3, 3, 0, 0] } },
    { name: 'Bear 🐻', type: 'bar', data: regimeReturn.bear, itemStyle: { color: '#fb7185', borderRadius: [3, 3, 0, 0] } },
    { name: 'Sideways ➡️', type: 'bar', data: regimeReturn.netral, itemStyle: { color: '#fbbf24', borderRadius: [3, 3, 0, 0] } }
  ]
}));

const freqOption = computed(() => ({
  grid: { left: 8, right: 12, top: 16, bottom: 40, containLabel: true },
  tooltip: { trigger: 'axis', valueFormatter: (v: number) => (v >= 0 ? '+' : '') + v.toFixed(2) + '%' },
  xAxis: { type: 'category', data: freq.labels, axisLabel: { color: '#94a3b8', fontSize: 10, interval: 0, lineHeight: 13 }, axisLine: { lineStyle: { color: '#1e293b' } } },
  yAxis: { type: 'value', axisLabel: { color: '#64748b', fontSize: 10, formatter: '{value}%' }, splitLine: { lineStyle: { color: '#1e293b' } } },
  series: [{ type: 'bar', data: freq.ret.map((v) => ({ value: v, itemStyle: { color: barColor(v), borderRadius: [3, 3, 0, 0] } })), barWidth: '52%' }]
}));
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
    <div class="rounded-2xl bg-gradient-to-r from-slate-900 to-slate-950 p-6 border border-cyan-500/15">
      <h1 class="text-2xl font-extrabold text-slate-50 tracking-tight">📊 Riset &amp; Temuan</h1>
      <p class="text-sm text-slate-400 mt-1">Ringkasan eksperimen kuantitatif dari ratusan skenario acak — sudah termasuk biaya transaksi (beli 0,15% / jual 0,25%).</p>
    </div>

    <!-- Takeaways -->
    <div class="grid md:grid-cols-3 gap-3">
      <div class="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-4">
        <div class="text-2xl mb-1">🐂</div>
        <div class="font-bold text-emerald-300 text-sm">Saat Bull — longgarkan stop</div>
        <p class="text-xs text-slate-400 mt-1">Return naik saat cut-loss dilonggarkan (+4,9% tanpa stop vs +2,3% di −5%). Stop ketat men-whipsaw keluar dari pemenang.</p>
      </div>
      <div class="rounded-xl bg-rose-500/5 border border-rose-500/20 p-4">
        <div class="text-2xl mb-1">🐻</div>
        <div class="font-bold text-rose-300 text-sm">Saat Bear — cut-loss ketat −5%</div>
        <p class="text-xs text-slate-400 mt-1">−5% paling kecil ruginya (−4,2% vs −7,2% tanpa stop), satu-satunya alpha positif, drawdown paling dangkal.</p>
      </div>
      <div class="rounded-xl bg-amber-500/5 border border-amber-500/20 p-4">
        <div class="text-2xl mb-1">💸</div>
        <div class="font-bold text-amber-300 text-sm">Biaya ~0,4% seragam</div>
        <p class="text-xs text-slate-400 mt-1">Karena jual-ke-kas tanpa beli-ulang, churn tak menambah round-trip — biaya tak mengubah peringkat strategi.</p>
      </div>
    </div>

    <!-- Chart 1: regime × threshold -->
    <div class="rounded-2xl bg-slate-900/60 border border-slate-800 p-5">
      <div class="text-sm font-bold text-slate-100">Return rata-rata per ambang cut-loss, dipisah rezim pasar</div>
      <p class="text-[11px] text-slate-500 mb-2">Terlihat pola menyilang: di Bull makin longgar makin baik; di Bear makin ketat makin baik.</p>
      <div class="h-80"><VChart :option="regimeOption" class="w-full h-full" autoresize /></div>
    </div>

    <!-- Chart 2: frequency -->
    <div class="rounded-2xl bg-slate-900/60 border border-slate-800 p-5">
      <div class="text-sm font-bold text-slate-100">Frekuensi keputusan &amp; jenis stop (setelah biaya)</div>
      <p class="text-[11px] text-slate-500 mb-2">Harian trailing-stop memberi drawdown terkecil; setelah biaya, hold unggul tipis di sampel netral-ini.</p>
      <div class="h-72"><VChart :option="freqOption" class="w-full h-full" autoresize /></div>
    </div>

    <!-- Recommendation -->
    <div class="rounded-2xl bg-cyan-500/5 border border-cyan-500/20 p-5">
      <div class="text-sm font-bold text-cyan-300 mb-2">🎯 Aturan main yang direkomendasikan</div>
      <ul class="text-xs text-slate-300 space-y-1.5 list-disc pl-5">
        <li><b>Deteksi rezim dulu</b> (lihat halaman Kondisi Pasar) — ini pengungkit terbesar, bukan angka stop-nya.</li>
        <li><b>Bull:</b> stop longgar −12% s/d trailing 12–15%, biarkan pemenang jalan.</li>
        <li><b>Bear:</b> stop ketat −5% atau trailing 8%, prioritaskan jaga modal.</li>
        <li><b>Sideways:</b> moderat −8%; seleksi saham lebih menentukan daripada stop.</li>
        <li><b>Hindari</b> average down membabi-buta pada saham yang sedang koreksi (pola merugikan terkuat).</li>
      </ul>
      <NuxtLink to="/simulasi/kondisi-pasar" class="inline-block mt-3 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors">🐂🐻 Cek rezim tanggalku →</NuxtLink>
    </div>

    <p class="text-[11px] text-slate-600">Catatan: hasil indikatif dari ~40–70 skenario/uji (bukan riset final), belum memodelkan slippage & aturan beli-ulang. Rezim diklasifikasi dari arah IHSG.</p>
  </div>
</template>
