<script setup lang="ts">
import { ref, computed } from 'vue';

useHead({
  title: 'Lembar Kerja WMI — Kalkulator Ujian Wakil Manajer Investasi',
  meta: [
    {
      name: 'description',
      content: 'Lembar kerja perhitungan standar persiapan ujian WMI: nilai waktu uang, valuasi saham (Gordon), valuasi obligasi & durasi, portofolio Markowitz, CAPM/SML, Sharpe/Treynor/Jensen, dan NAB reksa dana.',
    },
  ],
});

// ---- Formatting helpers ----
const cf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
function num(v: number, dp = 2): string {
  if (!isFinite(v)) return '—';
  return new Intl.NumberFormat('id-ID', { minimumFractionDigits: dp, maximumFractionDigits: dp }).format(v);
}
function rupiah(v: number): string { return isFinite(v) ? 'Rp ' + cf.format(v) : '—'; }
function pct(v: number, dp = 2): string { return isFinite(v) ? num(v, dp) + '%' : '—'; }

// ==================== 1. Time Value of Money ====================
const tvm = ref({ pv: 1000, pmt: 100, rate: 10, n: 5 });
const tvmOut = computed(() => {
  const r = tvm.value.rate / 100;
  const n = tvm.value.n;
  const fvLump = tvm.value.pv * Math.pow(1 + r, n);
  const pvLump = tvm.value.pv / Math.pow(1 + r, n);
  const fvAnn = r === 0 ? tvm.value.pmt * n : tvm.value.pmt * ((Math.pow(1 + r, n) - 1) / r);
  const pvAnn = r === 0 ? tvm.value.pmt * n : tvm.value.pmt * ((1 - Math.pow(1 + r, -n)) / r);
  const perp = r === 0 ? Infinity : tvm.value.pmt / r;
  return { fvLump, pvLump, fvAnn, pvAnn, perp };
});

// ==================== 2. Valuasi Saham (Gordon Growth) ====================
const gg = ref({ d0: 200, g: 4, r: 12, eps1: 400 });
const ggOut = computed(() => {
  const g = gg.value.g / 100, r = gg.value.r / 100;
  const d1 = gg.value.d0 * (1 + g);
  const valid = r > g;
  const p0 = valid ? d1 / (r - g) : Infinity;
  const perJust = gg.value.eps1 > 0 && valid ? p0 / gg.value.eps1 : NaN;
  const payout = gg.value.eps1 > 0 ? d1 / gg.value.eps1 : NaN;
  return { d1, p0, perJust, payout, valid };
});

// ==================== 3. Valuasi Obligasi ====================
const bond = ref({ face: 1000, coupon: 8, ytm: 10, years: 5, freq: 1 });
const bondOut = computed(() => {
  const m = bond.value.freq;
  const periods = Math.round(bond.value.years * m);
  const y = bond.value.ytm / 100 / m;
  const c = (bond.value.coupon / 100) * bond.value.face / m; // coupon per period
  let price = 0, macW = 0;
  for (let t = 1; t <= periods; t++) {
    const cf = t === periods ? c + bond.value.face : c;
    const pvcf = cf / Math.pow(1 + y, t);
    price += pvcf;
    macW += t * pvcf;
  }
  const macPeriods = price > 0 ? macW / price : NaN;
  const macYears = macPeriods / m;
  const modYears = macYears / (1 + y);
  const annualCoupon = (bond.value.coupon / 100) * bond.value.face;
  const currentYield = price > 0 ? (annualCoupon / price) * 100 : NaN;
  const status = bond.value.ytm > bond.value.coupon ? 'Discount (di bawah par)'
    : bond.value.ytm < bond.value.coupon ? 'Premium (di atas par)'
    : 'At par';
  return { price, currentYield, macYears, modYears, status };
});

// ==================== 4. Portofolio 2 Aset (Markowitz) ====================
const port = ref({ w1: 60, r1: 15, r2: 9, sd1: 25, sd2: 12, corr: 0.3 });
const portOut = computed(() => {
  const w1 = port.value.w1 / 100, w2 = 1 - w1;
  const erp = w1 * port.value.r1 + w2 * port.value.r2;
  const variance = Math.pow(w1 * port.value.sd1, 2) + Math.pow(w2 * port.value.sd2, 2)
    + 2 * w1 * w2 * port.value.corr * port.value.sd1 * port.value.sd2;
  const sdp = Math.sqrt(Math.max(variance, 0));
  const weightedSd = w1 * port.value.sd1 + w2 * port.value.sd2;
  const benefit = weightedSd - sdp;
  return { w2: w2 * 100, erp, sdp, weightedSd, benefit };
});

// ==================== 5. CAPM / SML ====================
const capm = ref({ rf: 6, rm: 12, beta: 1.5 });
const capmOut = computed(() => {
  const premium = capm.value.rm - capm.value.rf;
  const er = capm.value.rf + capm.value.beta * premium;
  return { premium, er };
});

// ==================== 6. Evaluasi Kinerja ====================
const perf = ref({ rp: 14, rf: 6, sdp: 18, beta: 1.2, rm: 11 });
const perfOut = computed(() => {
  const excess = perf.value.rp - perf.value.rf;
  const sharpe = perf.value.sdp !== 0 ? excess / perf.value.sdp : NaN;
  const treynor = perf.value.beta !== 0 ? excess / perf.value.beta : NaN;
  const jensen = perf.value.rp - (perf.value.rf + perf.value.beta * (perf.value.rm - perf.value.rf));
  return { sharpe, treynor, jensen };
});

// ==================== 7. NAB Reksa Dana ====================
const nav = ref({ aset: 1050000000000, kewajiban: 50000000000, unit: 850000000, dana: 10000000, biaya: 1 });
const navOut = computed(() => {
  const nab = nav.value.aset - nav.value.kewajiban;
  const perUnit = nav.value.unit > 0 ? nab / nav.value.unit : NaN;
  const unitDiperoleh = perUnit > 0 ? (nav.value.dana * (1 - nav.value.biaya / 100)) / perUnit : NaN;
  return { nab, perUnit, unitDiperoleh };
});

const toc = [
  { id: 'tvm', label: '1. Nilai Waktu Uang' },
  { id: 'gordon', label: '2. Valuasi Saham (Gordon)' },
  { id: 'bond', label: '3. Valuasi Obligasi' },
  { id: 'portfolio2', label: '4. Portofolio 2 Aset' },
  { id: 'capm', label: '5. CAPM / SML' },
  { id: 'performance', label: '6. Evaluasi Kinerja' },
  { id: 'nav', label: '7. NAB Reksa Dana' },
];
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
    <!-- Breadcrumb -->
    <div class="flex items-center gap-1.5 text-xs text-slate-500">
      <NuxtLink to="/belajar" class="hover:text-amber-400 font-semibold">🎓 Belajar</NuxtLink>
      <span class="text-slate-700">/</span>
      <span class="text-slate-300">🧮 Lembar Kerja WMI</span>
    </div>

    <!-- Header -->
    <div class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-950 p-6 sm:p-8 border border-amber-500/20 shadow-xl">
      <div class="absolute -right-10 -bottom-10 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div class="relative z-10">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-3">
          <span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
          LEMBAR KERJA PERHITUNGAN · PERSIAPAN UJIAN WMI
        </div>
        <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-50 tracking-tight">Lembar Kerja Wakil Manajer Investasi</h1>
        <p class="text-sm text-slate-400 mt-2 max-w-3xl leading-relaxed">
          Tujuh lembar kerja perhitungan yang lazim dipakai untuk lulus ujian sertifikasi WMI. Ubah angka input — hasil dihitung otomatis. Rumus ditampilkan agar bisa dijadikan template belajar.
        </p>
      </div>
    </div>

    <!-- Quick nav -->
    <div class="flex flex-wrap gap-2">
      <a v-for="t in toc" :key="t.id" :href="`#${t.id}`"
         class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-300 hover:border-amber-500/50 hover:text-amber-300 transition-colors">
        {{ t.label }}
      </a>
    </div>

    <!-- 1. TVM -->
    <section id="tvm" class="glow-card rounded-2xl p-6 space-y-4 scroll-mt-20">
      <h2 class="text-lg font-bold text-slate-100 flex items-center gap-2">⏳ 1. Nilai Waktu Uang (TVM)</h2>
      <pre class="bg-slate-950 p-3 rounded-xl border border-slate-800 text-amber-400 font-mono text-[11px] overflow-x-auto">FV = PV·(1+r)^n   ·   PV = FV/(1+r)^n   ·   PV Anuitas = PMT·[1−(1+r)^-n]/r   ·   Perpetuitas = PMT/r</pre>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <label class="text-xs text-slate-400">PV / Pokok (Rp)
          <input v-model.number="tvm.pv" type="number" class="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500" /></label>
        <label class="text-xs text-slate-400">Angsuran PMT (Rp)
          <input v-model.number="tvm.pmt" type="number" class="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500" /></label>
        <label class="text-xs text-slate-400">Bunga r (% / periode)
          <input v-model.number="tvm.rate" type="number" step="0.1" class="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500" /></label>
        <label class="text-xs text-slate-400">Periode n
          <input v-model.number="tvm.n" type="number" class="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500" /></label>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="bg-slate-950 rounded-xl border border-slate-800 p-3"><div class="text-[10px] text-slate-500 uppercase font-bold">FV Pokok</div><div class="text-sm font-bold text-emerald-400 mt-1">{{ rupiah(tvmOut.fvLump) }}</div></div>
        <div class="bg-slate-950 rounded-xl border border-slate-800 p-3"><div class="text-[10px] text-slate-500 uppercase font-bold">PV Pokok</div><div class="text-sm font-bold text-slate-100 mt-1">{{ rupiah(tvmOut.pvLump) }}</div></div>
        <div class="bg-slate-950 rounded-xl border border-slate-800 p-3"><div class="text-[10px] text-slate-500 uppercase font-bold">FV Anuitas</div><div class="text-sm font-bold text-emerald-400 mt-1">{{ rupiah(tvmOut.fvAnn) }}</div></div>
        <div class="bg-slate-950 rounded-xl border border-slate-800 p-3"><div class="text-[10px] text-slate-500 uppercase font-bold">PV Anuitas</div><div class="text-sm font-bold text-slate-100 mt-1">{{ rupiah(tvmOut.pvAnn) }}</div></div>
      </div>
      <div class="text-xs text-slate-400">PV Perpetuitas (PMT/r): <span class="font-bold text-amber-300">{{ rupiah(tvmOut.perp) }}</span></div>
    </section>

    <!-- 2. Gordon -->
    <section id="gordon" class="glow-card rounded-2xl p-6 space-y-4 scroll-mt-20">
      <h2 class="text-lg font-bold text-slate-100 flex items-center gap-2">📈 2. Valuasi Saham — Gordon Growth (DDM)</h2>
      <pre class="bg-slate-950 p-3 rounded-xl border border-slate-800 text-amber-400 font-mono text-[11px] overflow-x-auto">D1 = D0·(1+g)   ·   P0 = D1/(r−g)   [syarat r > g]   ·   PER justified = P0/EPS1</pre>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <label class="text-xs text-slate-400">D0 — dividen terakhir (Rp)
          <input v-model.number="gg.d0" type="number" class="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500" /></label>
        <label class="text-xs text-slate-400">Pertumbuhan g (%)
          <input v-model.number="gg.g" type="number" step="0.1" class="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500" /></label>
        <label class="text-xs text-slate-400">Return disyaratkan r (%)
          <input v-model.number="gg.r" type="number" step="0.1" class="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500" /></label>
        <label class="text-xs text-slate-400">EPS1 (Rp, opsional)
          <input v-model.number="gg.eps1" type="number" class="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500" /></label>
      </div>
      <div v-if="!ggOut.valid" class="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">⚠ Model tidak valid: g harus lebih kecil dari r.</div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="bg-slate-950 rounded-xl border border-slate-800 p-3"><div class="text-[10px] text-slate-500 uppercase font-bold">D1</div><div class="text-sm font-bold text-slate-100 mt-1">{{ rupiah(ggOut.d1) }}</div></div>
        <div class="bg-slate-950 rounded-xl border border-amber-500/30 p-3"><div class="text-[10px] text-amber-500 uppercase font-bold">Nilai Wajar P0</div><div class="text-base font-extrabold text-amber-300 mt-1">{{ rupiah(ggOut.p0) }}</div></div>
        <div class="bg-slate-950 rounded-xl border border-slate-800 p-3"><div class="text-[10px] text-slate-500 uppercase font-bold">PER Justified</div><div class="text-sm font-bold text-emerald-400 mt-1">{{ isFinite(ggOut.perJust) ? num(ggOut.perJust) + '×' : '—' }}</div></div>
        <div class="bg-slate-950 rounded-xl border border-slate-800 p-3"><div class="text-[10px] text-slate-500 uppercase font-bold">Payout Ratio</div><div class="text-sm font-bold text-slate-100 mt-1">{{ isFinite(ggOut.payout) ? pct(ggOut.payout * 100) : '—' }}</div></div>
      </div>
    </section>

    <!-- 3. Bond -->
    <section id="bond" class="glow-card rounded-2xl p-6 space-y-4 scroll-mt-20">
      <h2 class="text-lg font-bold text-slate-100 flex items-center gap-2">🏦 3. Valuasi Obligasi &amp; Durasi</h2>
      <pre class="bg-slate-950 p-3 rounded-xl border border-slate-800 text-amber-400 font-mono text-[11px] overflow-x-auto">Harga = Σ Kupon/(1+y)^t + Nominal/(1+y)^n   ·   Durasi Modified = Macaulay/(1+y)   ·   ΔHarga% ≈ −DurMod·Δy</pre>
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <label class="text-xs text-slate-400">Nominal (Rp)
          <input v-model.number="bond.face" type="number" class="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500" /></label>
        <label class="text-xs text-slate-400">Kupon (% / thn)
          <input v-model.number="bond.coupon" type="number" step="0.1" class="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500" /></label>
        <label class="text-xs text-slate-400">YTM (% / thn)
          <input v-model.number="bond.ytm" type="number" step="0.1" class="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500" /></label>
        <label class="text-xs text-slate-400">Tenor (tahun)
          <input v-model.number="bond.years" type="number" class="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500" /></label>
        <label class="text-xs text-slate-400">Frekuensi/thn
          <select v-model.number="bond.freq" class="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500">
            <option :value="1">1 (tahunan)</option>
            <option :value="2">2 (semesteran)</option>
          </select></label>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="bg-slate-950 rounded-xl border border-amber-500/30 p-3"><div class="text-[10px] text-amber-500 uppercase font-bold">Harga Wajar</div><div class="text-base font-extrabold text-amber-300 mt-1">{{ rupiah(bondOut.price) }}</div></div>
        <div class="bg-slate-950 rounded-xl border border-slate-800 p-3"><div class="text-[10px] text-slate-500 uppercase font-bold">Current Yield</div><div class="text-sm font-bold text-emerald-400 mt-1">{{ pct(bondOut.currentYield) }}</div></div>
        <div class="bg-slate-950 rounded-xl border border-slate-800 p-3"><div class="text-[10px] text-slate-500 uppercase font-bold">Durasi Macaulay</div><div class="text-sm font-bold text-slate-100 mt-1">{{ num(bondOut.macYears) }} thn</div></div>
        <div class="bg-slate-950 rounded-xl border border-slate-800 p-3"><div class="text-[10px] text-slate-500 uppercase font-bold">Durasi Modified</div><div class="text-sm font-bold text-slate-100 mt-1">{{ num(bondOut.modYears) }}</div></div>
      </div>
      <div class="text-xs text-slate-400">Status harga: <span class="font-bold text-amber-300">{{ bondOut.status }}</span></div>
    </section>

    <!-- 4. Portfolio -->
    <section id="portfolio2" class="glow-card rounded-2xl p-6 space-y-4 scroll-mt-20">
      <h2 class="text-lg font-bold text-slate-100 flex items-center gap-2">📊 4. Portofolio 2 Aset (Markowitz)</h2>
      <pre class="bg-slate-950 p-3 rounded-xl border border-slate-800 text-amber-400 font-mono text-[11px] overflow-x-auto">E(Rp) = w1·R1 + w2·R2   ·   σp² = w1²σ1² + w2²σ2² + 2·w1·w2·ρ·σ1·σ2</pre>
      <div class="grid grid-cols-2 sm:grid-cols-6 gap-3">
        <label class="text-xs text-slate-400">Bobot w1 (%)
          <input v-model.number="port.w1" type="number" step="1" class="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500" /></label>
        <label class="text-xs text-slate-400">E(R1) (%)
          <input v-model.number="port.r1" type="number" step="0.1" class="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500" /></label>
        <label class="text-xs text-slate-400">E(R2) (%)
          <input v-model.number="port.r2" type="number" step="0.1" class="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500" /></label>
        <label class="text-xs text-slate-400">σ1 (%)
          <input v-model.number="port.sd1" type="number" step="0.1" class="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500" /></label>
        <label class="text-xs text-slate-400">σ2 (%)
          <input v-model.number="port.sd2" type="number" step="0.1" class="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500" /></label>
        <label class="text-xs text-slate-400">Korelasi ρ
          <input v-model.number="port.corr" type="number" step="0.05" min="-1" max="1" class="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500" /></label>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="bg-slate-950 rounded-xl border border-slate-800 p-3"><div class="text-[10px] text-slate-500 uppercase font-bold">Bobot w2</div><div class="text-sm font-bold text-slate-100 mt-1">{{ pct(portOut.w2, 0) }}</div></div>
        <div class="bg-slate-950 rounded-xl border border-amber-500/30 p-3"><div class="text-[10px] text-amber-500 uppercase font-bold">E(Rp)</div><div class="text-base font-extrabold text-amber-300 mt-1">{{ pct(portOut.erp) }}</div></div>
        <div class="bg-slate-950 rounded-xl border border-slate-800 p-3"><div class="text-[10px] text-slate-500 uppercase font-bold">Risiko σp</div><div class="text-sm font-bold text-emerald-400 mt-1">{{ pct(portOut.sdp) }}</div></div>
        <div class="bg-slate-950 rounded-xl border border-slate-800 p-3"><div class="text-[10px] text-slate-500 uppercase font-bold">Manfaat Diversifikasi</div><div class="text-sm font-bold text-emerald-400 mt-1">−{{ num(portOut.benefit) }} pp</div></div>
      </div>
      <div class="text-xs text-slate-400">σp ({{ pct(portOut.sdp) }}) &lt; rata-rata tertimbang σ ({{ pct(portOut.weightedSd) }}) → itulah efek diversifikasi (selama ρ &lt; 1).</div>
    </section>

    <!-- 5. CAPM -->
    <section id="capm" class="glow-card rounded-2xl p-6 space-y-4 scroll-mt-20">
      <h2 class="text-lg font-bold text-slate-100 flex items-center gap-2">🎯 5. CAPM / Security Market Line</h2>
      <pre class="bg-slate-950 p-3 rounded-xl border border-slate-800 text-amber-400 font-mono text-[11px] overflow-x-auto">E(R) = Rf + β·(Rm − Rf)</pre>
      <div class="grid grid-cols-3 gap-3">
        <label class="text-xs text-slate-400">Rf — bebas risiko (%)
          <input v-model.number="capm.rf" type="number" step="0.1" class="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500" /></label>
        <label class="text-xs text-slate-400">Rm — return pasar (%)
          <input v-model.number="capm.rm" type="number" step="0.1" class="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500" /></label>
        <label class="text-xs text-slate-400">Beta β
          <input v-model.number="capm.beta" type="number" step="0.05" class="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500" /></label>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div class="bg-slate-950 rounded-xl border border-slate-800 p-3"><div class="text-[10px] text-slate-500 uppercase font-bold">Premi Risiko Pasar</div><div class="text-sm font-bold text-slate-100 mt-1">{{ pct(capmOut.premium) }}</div></div>
        <div class="bg-slate-950 rounded-xl border border-amber-500/30 p-3"><div class="text-[10px] text-amber-500 uppercase font-bold">Return Disyaratkan E(R)</div><div class="text-base font-extrabold text-amber-300 mt-1">{{ pct(capmOut.er) }}</div></div>
      </div>
      <p class="text-xs text-slate-500">💡 Gunakan E(R) ini sebagai nilai <em>r</em> di Lembar Kerja Valuasi Saham (Gordon).</p>
    </section>

    <!-- 6. Performance -->
    <section id="performance" class="glow-card rounded-2xl p-6 space-y-4 scroll-mt-20">
      <h2 class="text-lg font-bold text-slate-100 flex items-center gap-2">🏆 6. Evaluasi Kinerja Portofolio</h2>
      <pre class="bg-slate-950 p-3 rounded-xl border border-slate-800 text-amber-400 font-mono text-[11px] overflow-x-auto">Sharpe = (Rp−Rf)/σp   ·   Treynor = (Rp−Rf)/β   ·   Jensen α = Rp − [Rf + β(Rm−Rf)]</pre>
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <label class="text-xs text-slate-400">Rp portofolio (%)
          <input v-model.number="perf.rp" type="number" step="0.1" class="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500" /></label>
        <label class="text-xs text-slate-400">Rf (%)
          <input v-model.number="perf.rf" type="number" step="0.1" class="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500" /></label>
        <label class="text-xs text-slate-400">σp (%)
          <input v-model.number="perf.sdp" type="number" step="0.1" class="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500" /></label>
        <label class="text-xs text-slate-400">Beta β
          <input v-model.number="perf.beta" type="number" step="0.05" class="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500" /></label>
        <label class="text-xs text-slate-400">Rm pasar (%)
          <input v-model.number="perf.rm" type="number" step="0.1" class="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500" /></label>
      </div>
      <div class="grid grid-cols-3 gap-3">
        <div class="bg-slate-950 rounded-xl border border-slate-800 p-3"><div class="text-[10px] text-slate-500 uppercase font-bold">Sharpe Ratio</div><div class="text-base font-extrabold text-emerald-400 mt-1">{{ num(perfOut.sharpe, 3) }}</div></div>
        <div class="bg-slate-950 rounded-xl border border-slate-800 p-3"><div class="text-[10px] text-slate-500 uppercase font-bold">Treynor Ratio</div><div class="text-base font-extrabold text-emerald-400 mt-1">{{ num(perfOut.treynor, 3) }}</div></div>
        <div class="bg-slate-950 rounded-xl border p-3" :class="perfOut.jensen >= 0 ? 'border-emerald-500/30' : 'border-rose-500/30'"><div class="text-[10px] uppercase font-bold" :class="perfOut.jensen >= 0 ? 'text-emerald-500' : 'text-rose-500'">Jensen's Alpha</div><div class="text-base font-extrabold mt-1" :class="perfOut.jensen >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ pct(perfOut.jensen) }}</div></div>
      </div>
    </section>

    <!-- 7. NAV -->
    <section id="nav" class="glow-card rounded-2xl p-6 space-y-4 scroll-mt-20">
      <h2 class="text-lg font-bold text-slate-100 flex items-center gap-2">🧾 7. NAB Reksa Dana</h2>
      <pre class="bg-slate-950 p-3 rounded-xl border border-slate-800 text-amber-400 font-mono text-[11px] overflow-x-auto">NAB = Total Aset − Kewajiban   ·   NAB/Unit = NAB / Unit Penyertaan   ·   Unit diperoleh = Dana·(1−biaya)/NAB per Unit</pre>
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <label class="text-xs text-slate-400">Total Aset (Rp)
          <input v-model.number="nav.aset" type="number" class="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500" /></label>
        <label class="text-xs text-slate-400">Total Kewajiban (Rp)
          <input v-model.number="nav.kewajiban" type="number" class="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500" /></label>
        <label class="text-xs text-slate-400">Unit Penyertaan
          <input v-model.number="nav.unit" type="number" class="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500" /></label>
        <label class="text-xs text-slate-400">Dana Investasi (Rp)
          <input v-model.number="nav.dana" type="number" class="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500" /></label>
        <label class="text-xs text-slate-400">Biaya Beli (%)
          <input v-model.number="nav.biaya" type="number" step="0.1" class="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500" /></label>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div class="bg-slate-950 rounded-xl border border-slate-800 p-3"><div class="text-[10px] text-slate-500 uppercase font-bold">NAB Total</div><div class="text-sm font-bold text-slate-100 mt-1">{{ rupiah(navOut.nab) }}</div></div>
        <div class="bg-slate-950 rounded-xl border border-amber-500/30 p-3"><div class="text-[10px] text-amber-500 uppercase font-bold">NAB per Unit</div><div class="text-base font-extrabold text-amber-300 mt-1">{{ rupiah(navOut.perUnit) }}</div></div>
        <div class="bg-slate-950 rounded-xl border border-slate-800 p-3"><div class="text-[10px] text-slate-500 uppercase font-bold">Unit Diperoleh</div><div class="text-sm font-bold text-emerald-400 mt-1">{{ num(navOut.unitDiperoleh, 2) }} UP</div></div>
      </div>
    </section>

    <!-- Disclaimer + back -->
    <div class="glow-card rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3">
      <p class="text-xs text-slate-500 max-w-2xl leading-relaxed">
        ⚠ Lembar kerja untuk latihan &amp; edukasi. Perhitungan memakai konvensi standar (mis. durasi memakai yield periodik) — untuk ujian, cocokkan dengan konvensi yang diminta soal.
      </p>
      <NuxtLink to="/belajar" class="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl transition-colors">← Kembali ke Jalur Belajar</NuxtLink>
    </div>
  </div>
</template>
