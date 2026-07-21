<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { calculateSeasonalStats, MONTH_LABELS } from '../../utils/seasonalCalculator';

const route = useRoute();
const router = useRouter();

const symbol = computed(() => ((route.params.symbol as string) || 'BBCA').toUpperCase().trim());

useHead(() => ({
  title: `Analisa ${symbol.value} — Teknikal, Level, Musiman & Forecast`,
  meta: [
    { name: 'description', content: `Analisa lengkap saham ${symbol.value}: skor teknikal, support/resistance, rencana trade ATR, bias musiman, dan forecast probabilistik.` }
  ]
}));

function goTo(code: string) {
  router.push(`/analisa/${code.toUpperCase()}`);
}

// Main technical analysis (awaited — page core)
const { data: an, pending: anPending, error: anError } = await useFetch<any>(() => '/api/analysis', {
  params: { symbol },
  watch: [symbol]
});

// Secondary data (lazy — sections fill in as they arrive)
const { data: fund } = await useFetch<any>(() => '/api/fundamentals', {
  params: { symbol }, watch: [symbol], lazy: true
});
const { data: seasonal } = await useFetch<any>(() => '/api/seasonal', {
  params: { symbol }, watch: [symbol], lazy: true
});
const { data: fc, pending: fcPending } = await useFetch<any>(() => '/api/forecast', {
  params: { symbol, horizon: 14 }, watch: [symbol], lazy: true
});

const t = computed(() => an.value?.technical || null);
const lv = computed(() => an.value?.levels || null);
const liveFund = computed(() => (fund.value?.available ? fund.value : null));

const fmt = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('id-ID'));
const fmtIdr = (n: number | null | undefined) =>
  n == null ? '—' : 'Rp ' + n.toLocaleString('id-ID', { maximumFractionDigits: 2 });

// ---- Seasonal: current & next month from monthly history ----
const monthlyStats = computed(() => {
  const hist = seasonal.value?.history;
  if (!hist || !hist.length) return [];
  return calculateSeasonalStats(hist, 'monthly');
});
const curMonthIdx = new Date().getMonth();
const seasonalNow = computed(() => monthlyStats.value.find((s) => s.periodLabel === MONTH_LABELS[curMonthIdx]) || null);
const seasonalNext = computed(() => monthlyStats.value.find((s) => s.periodLabel === MONTH_LABELS[(curMonthIdx + 1) % 12]) || null);

// ---- Rating / tone helpers ----
function ratingClass(rating: string | undefined) {
  if (rating === 'Kuat') return 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25';
  if (rating === 'Menarik') return 'text-sky-300 bg-sky-500/10 border-sky-500/25';
  if (rating === 'Netral') return 'text-slate-300 bg-slate-800/60 border-slate-700';
  return 'text-rose-300 bg-rose-500/10 border-rose-500/25';
}
const SIGNAL_TONE: Record<string, string> = {
  bull: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  bear: 'text-rose-300 bg-rose-500/10 border-rose-500/20',
  warn: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  neutral: 'text-slate-300 bg-slate-800/60 border-slate-700'
};
const isUptrend = computed(() => t.value && t.value.sma200 != null && t.value.price > t.value.sma200);

// ---- Position sizing calculator ----
const modal = ref(10_000_000);
const riskPct = ref(1);
const entry = ref(0);
const stop = ref(0);
watch(lv, (v) => {
  if (v?.plan) { entry.value = v.plan.entry; stop.value = v.plan.stop; }
}, { immediate: true });

const posCalc = computed(() => {
  const perShare = entry.value - stop.value;
  if (perShare <= 0 || modal.value <= 0 || riskPct.value <= 0) return null;
  const riskRp = (modal.value * riskPct.value) / 100;
  const lots = Math.floor(riskRp / perShare / 100);
  const shares = lots * 100;
  const nilai = shares * entry.value;
  return {
    riskRp: Math.round(riskRp),
    lots,
    shares,
    nilai: Math.round(nilai),
    pctModal: modal.value > 0 ? Math.round((nilai / modal.value) * 1000) / 10 : 0
  };
});

// ---- Automated conclusion (honest, rule-based) ----
interface Bullet { text: string; tone: 'bull' | 'bear' | 'warn' | 'neutral' }
const conclusions = computed<Bullet[]>(() => {
  const out: Bullet[] = [];
  const tv = t.value;
  if (!tv) return out;

  // Trend — pisahkan jangka panjang (MA200) vs pendek (MA20/MA50), arah dari DMI.
  // ADX hanya mengukur KEKUATAN, bukan arah — arah ditentukan +DI vs -DI.
  if (tv.sma200 != null) {
    const longUp = tv.price > tv.sma200;
    const aboveMA20 = tv.sma20 != null && tv.price > tv.sma20;
    const aboveMA50 = tv.sma50 != null && tv.price > tv.sma50;
    const shortUp = aboveMA20; // reclaim MA tercepat = pemulihan jangka pendek
    const diDir = tv.plusDI != null && tv.minusDI != null ? (tv.plusDI > tv.minusDI ? 'naik' : 'turun') : null;
    const adxTxt = tv.adx != null
      ? `ADX ${Math.round(tv.adx)} (${tv.adx >= 25 ? 'kuat' : 'lemah'})${diDir ? `, arah ${diDir}` : ''}`
      : '';
    const maShort = aboveMA20 && aboveMA50 ? 'MA20 & MA50' : aboveMA20 ? 'MA20' : 'MA20/MA50';

    if (longUp && shortUp) {
      out.push({ text: `Uptrend selaras — harga di atas MA200 dan ${maShort}${adxTxt ? ` (${adxTxt})` : ''}.`, tone: 'bull' });
    } else if (!longUp && shortUp) {
      out.push({ text: `Jangka panjang masih lemah (di bawah MA200), TAPI jangka pendek memantul — harga sudah reclaim ${maShort}${adxTxt ? ` (${adxTxt})` : ''}. Pola pemulihan/reversal awal; konfirmasi bila tembus & bertahan di atas MA200.`, tone: 'warn' });
    } else if (longUp && !shortUp) {
      out.push({ text: `Uptrend jangka panjang (di atas MA200) tapi sedang koreksi jangka pendek (di bawah MA20)${adxTxt ? ` (${adxTxt})` : ''}.`, tone: 'warn' });
    } else {
      out.push({ text: `Downtrend — harga di bawah MA200 dan MA20${adxTxt ? ` (${adxTxt})` : ''}. Beli melawan tren berisiko tinggi.`, tone: 'bear' });
    }
  }

  // Score
  out.push({
    text: `Skor teknikal ${tv.score}/100 (${tv.rating}).`,
    tone: tv.score >= 55 ? 'bull' : tv.score >= 40 ? 'neutral' : 'bear'
  });

  // Momentum (RSI + MACD + Stochastic untuk deteksi jenuh beli/jual jangka pendek)
  if (tv.rsi != null) {
    const macdUp = (tv.macd ?? 0) > (tv.macdSignal ?? 0);
    const macdTxt = tv.macd != null && tv.macdSignal != null ? (macdUp ? 'MACD bullish' : 'MACD bearish') : '';
    const stochHot = tv.stochK != null && tv.stochK > 80;
    const stochCold = tv.stochK != null && tv.stochK < 20;
    let rsiZone: string;
    if (tv.rsi > 70) rsiZone = 'overbought — rawan koreksi';
    else if (tv.rsi < 30) rsiZone = 'oversold — potensi rebound tapi bisa berlanjut turun';
    else if (tv.rsi >= 58 && stochHot) rsiZone = 'sehat tapi jangka pendek mulai jenuh beli (Stochastic overbought)';
    else if (tv.rsi <= 45 && stochCold) rsiZone = 'lemah, Stochastic oversold — waspada rebound teknikal';
    else rsiZone = 'netral-sehat';
    const warn = tv.rsi > 70 || (tv.rsi >= 58 && stochHot);
    out.push({
      text: `Momentum: RSI ${Math.round(tv.rsi)} (${rsiZone})${macdTxt ? ', ' + macdTxt : ''}.`,
      tone: warn ? 'warn' : tv.rsi < 30 ? 'warn' : macdUp ? 'bull' : 'neutral'
    });
  }

  // Relative strength vs IHSG (deadband ±2% agar RS mendekati nol = setara pasar)
  const rel = an.value?.relative;
  if (rel && rel.rs3m != null) {
    const strong = Math.abs(rel.rs3m) > 2;
    out.push({
      text: `Relative strength 3 bulan vs IHSG: ${rel.rs3m >= 0 ? '+' : ''}${rel.rs3m}% — ${
        !strong ? 'bergerak setara pasar (tidak menonjol)'
          : rel.rs3m > 0 ? 'mengungguli pasar (relatif kuat)' : 'tertinggal dari pasar (relatif lemah)'
      }.`,
      tone: !strong ? 'neutral' : rel.rs3m > 0 ? 'bull' : 'bear'
    });
  }

  // Seasonal
  const sn = seasonalNow.value;
  if (sn) {
    const sig = sn.significant ? 'signifikan secara statistik' : 'TIDAK signifikan (bisa jadi noise)';
    out.push({
      text: `Musiman ${MONTH_LABELS[curMonthIdx]}: rata-rata ${sn.avgReturn >= 0 ? '+' : ''}${sn.avgReturn}%, win rate ${sn.winRate}% dari ${sn.count} tahun — ${sig}.`,
      tone: sn.significant ? (sn.avgReturn >= 0 ? 'bull' : 'bear') : 'neutral'
    });
  }

  // Forecast
  const f = fc.value;
  if (f) {
    if (f.best === 'naive') {
      out.push({ text: `Forecast: tidak ada model yang mengungguli random walk pada backtest — jangan jadikan prediksi arah sebagai dasar utama.`, tone: 'warn' });
    } else {
      out.push({
        text: `Forecast ensemble: P(naik besok) ${f.nextDay.probUp}% (akurasi arah uji ${f.nextDay.hitRate ?? '—'}% vs baseline ${f.baselineDirAcc}%).`,
        tone: f.nextDay.probUp >= 55 ? 'bull' : f.nextDay.probUp <= 45 ? 'bear' : 'neutral'
      });
    }
    out.push({
      text: `Volatilitas ${f.vol.regime} (${f.vol.dailyPct}%/hari) — sesuaikan ukuran posisi.`,
      tone: f.vol.regime === 'tinggi' ? 'warn' : 'neutral'
    });
  }

  // Valuation (+ Graham hanya relevan bila PBV wajar, + peringatan value trap)
  const lf = liveFund.value;
  if (lf && lf.per != null) {
    const perZone = lf.per < 10 ? 'relatif murah' : lf.per <= 25 ? 'wajar' : 'premium';
    const dy = lf.dividendYield != null ? `, dividend yield ${lf.dividendYield}%` : '';
    let grahamTxt = '';
    if (lf.grahamFair != null) {
      grahamTxt = lf.pbv != null && lf.pbv <= 2.5
        ? ` Nilai wajar Graham ≈ ${fmt(lf.grahamFair)} (${tv.price < lf.grahamFair ? 'harga di bawah — undervalued' : 'harga di atas'}).`
        : ` (Graham ≈ ${fmt(lf.grahamFair)}, kurang relevan karena PBV tinggi.)`;
    }
    const cheap = lf.per < 10;
    const earnDown = lf.earningsGrowth != null && lf.earningsGrowth < 0;
    const trapTxt = cheap && earnDown ? ' ⚠ Murah tapi laba menurun — waspada value trap.' : '';
    out.push({
      text: `Valuasi: PER ${lf.per}× (${perZone}), PBV ${lf.pbv ?? '—'}×${dy}.${grahamTxt}${trapTxt}`,
      tone: cheap && earnDown ? 'neutral' : cheap ? 'bull' : lf.per > 25 ? 'warn' : 'neutral'
    });
  }

  // Quality: growth + leverage
  if (lf && (lf.revenueGrowth != null || lf.earningsGrowth != null)) {
    const parts: string[] = [];
    if (lf.revenueGrowth != null) parts.push(`pendapatan ${lf.revenueGrowth >= 0 ? '+' : ''}${lf.revenueGrowth}%`);
    if (lf.earningsGrowth != null) parts.push(`laba ${lf.earningsGrowth >= 0 ? '+' : ''}${lf.earningsGrowth}%`);
    if (lf.debtToEquity != null) parts.push(`DER ${lf.debtToEquity}×`);
    const growthPos = (lf.earningsGrowth ?? lf.revenueGrowth ?? 0) >= 0;
    out.push({ text: `Kualitas: pertumbuhan ${parts.join(', ')}.`, tone: growthPos ? 'bull' : 'warn' });
  }

  // Risk plan
  if (lv.value?.plan) {
    out.push({
      text: `Manajemen risiko: stop 2×ATR di ${fmt(lv.value.plan.stop)} (−${lv.value.atrPct * 2}% dari entry), target 3×ATR di ${fmt(lv.value.plan.target)} (R:R 1,5).`,
      tone: 'neutral'
    });
  }

  return out;
});

const verdict = computed(() => {
  const tv = t.value;
  if (!tv) return null;
  const fullDown = tv.sma200 != null && tv.sma20 != null && tv.price < tv.sma200 && tv.price < tv.sma20;
  if (tv.score >= 55 && isUptrend.value) return { label: 'Layak dipantau untuk beli', cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' };
  if (fullDown && tv.score < 50) return { label: 'Hindari dulu', cls: 'text-rose-300 bg-rose-500/10 border-rose-500/30' };
  if (tv.score >= 40) return { label: 'Netral — tunggu konfirmasi', cls: 'text-amber-300 bg-amber-500/10 border-amber-500/30' };
  return { label: 'Hindari dulu', cls: 'text-rose-300 bg-rose-500/10 border-rose-500/30' };
});
</script>

<template>
  <div class="pb-16 bg-slate-950 text-slate-100 flex flex-col flex-grow">
    <main class="max-w-7xl mx-auto px-4 sm:px-6 mt-8 flex-grow w-full space-y-6">

      <!-- Symbol picker -->
      <section class="glow-card rounded-2xl p-6">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 class="text-lg font-bold text-slate-50">Hub Analisa Saham</h2>
          <span class="text-[11px] text-slate-500">teknikal · level harga · musiman · forecast · valuasi</span>
        </div>
        <StockSearch :model-value="symbol" @update:model-value="goTo" />
      </section>

      <!-- Loading / Error -->
      <div v-if="anPending" class="py-20 flex flex-col items-center justify-center gap-4 bg-slate-900/30 border border-slate-900 rounded-2xl">
        <div class="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p class="text-sm text-slate-400 animate-pulse">Menganalisis {{ symbol }}…</p>
      </div>
      <div v-else-if="anError" class="p-6 rounded-2xl bg-rose-500/5 border border-rose-500/20 text-rose-200 text-sm">
        Gagal menganalisis "{{ symbol }}" — simbol tidak ditemukan atau data tidak likuid.
      </div>

      <template v-else-if="an && t">
        <!-- Header -->
        <section class="glow-card rounded-2xl p-6">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div class="flex items-center gap-3 flex-wrap">
                <h3 class="text-2xl font-extrabold text-slate-50">{{ an.code }}</h3>
                <span class="text-[10px] font-bold px-2.5 py-1 rounded-full border" :class="ratingClass(t.rating)">{{ t.rating }} · {{ t.score }}/100</span>
                <span v-if="verdict" class="text-[10px] font-bold px-2.5 py-1 rounded-full border" :class="verdict.cls">{{ verdict.label }}</span>
                <span v-if="an.relative && an.relative.rs3m != null" class="text-[10px] font-bold px-2.5 py-1 rounded-full border"
                  :class="an.relative.outperform ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25' : 'text-rose-300 bg-rose-500/10 border-rose-500/25'"
                  title="Relative strength 3 bulan vs IHSG">
                  {{ an.relative.outperform ? '↑ Outperform IHSG' : '↓ Underperform' }} {{ an.relative.rs3m >= 0 ? '+' : '' }}{{ an.relative.rs3m }}%
                </span>
              </div>
              <p class="text-xs text-slate-400 mt-1">{{ an.name }}<span v-if="liveFund?.sector"> · {{ liveFund.sector }}</span></p>
            </div>
            <div class="text-right">
              <p class="text-3xl font-extrabold text-slate-50">{{ fmt(t.price) }}</p>
              <p class="text-sm font-bold" :class="t.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'">
                {{ t.changePct >= 0 ? '▲ +' : '▼ ' }}{{ t.changePct }}%
              </p>
            </div>
          </div>

          <!-- Fundamental chips (live) -->
          <div v-if="liveFund" class="flex flex-wrap gap-2 mt-4">
            <span class="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">PER <strong class="text-slate-100">{{ liveFund.per ?? '—' }}×</strong></span>
            <span class="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">PBV <strong class="text-slate-100">{{ liveFund.pbv ?? '—' }}×</strong></span>
            <span class="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">ROE <strong class="text-slate-100">{{ liveFund.roe ?? '—' }}%</strong></span>
            <span class="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">Div. Yield <strong class="text-slate-100">{{ liveFund.dividendYield ?? '—' }}%</strong></span>
            <span v-if="liveFund.revenueGrowth != null" class="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">Rev. Growth <strong :class="liveFund.revenueGrowth >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ liveFund.revenueGrowth >= 0 ? '+' : '' }}{{ liveFund.revenueGrowth }}%</strong></span>
            <span v-if="liveFund.earningsGrowth != null" class="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">Laba Growth <strong :class="liveFund.earningsGrowth >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ liveFund.earningsGrowth >= 0 ? '+' : '' }}{{ liveFund.earningsGrowth }}%</strong></span>
            <span v-if="liveFund.debtToEquity != null" class="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">DER <strong :class="liveFund.debtToEquity <= 1 ? 'text-emerald-400' : liveFund.debtToEquity <= 2 ? 'text-slate-100' : 'text-amber-400'">{{ liveFund.debtToEquity }}×</strong></span>
            <span v-if="liveFund.pegRatio != null" class="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">PEG <strong class="text-slate-100">{{ liveFund.pegRatio }}</strong></span>
            <span v-if="liveFund.grahamFair != null" class="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300" title="Estimasi nilai wajar Graham">Wajar <strong :class="t.price < liveFund.grahamFair ? 'text-emerald-400' : 'text-amber-400'">{{ fmt(liveFund.grahamFair) }}</strong></span>
          </div>

          <div class="flex flex-wrap gap-3 mt-4 text-[11px]">
            <NuxtLink :to="`/saham?symbol=${an.code}`" class="text-emerald-400 hover:text-emerald-300 font-semibold">→ Chart candlestick</NuxtLink>
            <NuxtLink :to="`/seasonal?symbol=${an.code}`" class="text-emerald-400 hover:text-emerald-300 font-semibold">→ Pola musiman lengkap</NuxtLink>
            <NuxtLink :to="`/forecast?symbol=${an.code}`" class="text-emerald-400 hover:text-emerald-300 font-semibold">→ Forecast lengkap</NuxtLink>
            <NuxtLink :to="`/profil-saham?symbol=${an.code}`" class="text-emerald-400 hover:text-emerald-300 font-semibold">→ Profil emiten</NuxtLink>
          </div>
        </section>

        <!-- Indicators + signals -->
        <section class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="glow-card rounded-2xl p-6">
            <h4 class="text-sm font-bold text-slate-100 mb-4">Indikator Teknikal</h4>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div class="rounded-lg bg-slate-900/40 border border-slate-800/60 px-3 py-2.5">
                <p class="text-[10px] text-slate-500 uppercase">RSI (14)</p>
                <p class="text-sm font-bold mt-0.5" :class="t.rsi == null ? 'text-slate-500' : t.rsi > 70 ? 'text-rose-400' : t.rsi < 30 ? 'text-amber-400' : 'text-slate-100'">{{ t.rsi ?? '—' }}</p>
              </div>
              <div class="rounded-lg bg-slate-900/40 border border-slate-800/60 px-3 py-2.5">
                <p class="text-[10px] text-slate-500 uppercase">ADX (+DI/−DI)</p>
                <p class="text-sm font-bold text-slate-100 mt-0.5">{{ t.adx ?? '—' }} <span class="text-[10px] text-slate-500">({{ t.plusDI ?? '—' }}/{{ t.minusDI ?? '—' }})</span></p>
              </div>
              <div class="rounded-lg bg-slate-900/40 border border-slate-800/60 px-3 py-2.5">
                <p class="text-[10px] text-slate-500 uppercase">Stochastic %K/%D</p>
                <p class="text-sm font-bold text-slate-100 mt-0.5">{{ t.stochK ?? '—' }} / {{ t.stochD ?? '—' }}</p>
              </div>
              <div class="rounded-lg bg-slate-900/40 border border-slate-800/60 px-3 py-2.5">
                <p class="text-[10px] text-slate-500 uppercase">MACD hist</p>
                <p class="text-sm font-bold mt-0.5" :class="(t.macdHist ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ t.macdHist ?? '—' }}</p>
              </div>
              <div class="rounded-lg bg-slate-900/40 border border-slate-800/60 px-3 py-2.5">
                <p class="text-[10px] text-slate-500 uppercase">Bollinger %B</p>
                <p class="text-sm font-bold text-slate-100 mt-0.5">{{ t.bbPercentB ?? '—' }}</p>
              </div>
              <div class="rounded-lg bg-slate-900/40 border border-slate-800/60 px-3 py-2.5">
                <p class="text-[10px] text-slate-500 uppercase">ATR</p>
                <p class="text-sm font-bold text-slate-100 mt-0.5">{{ t.atrPct ?? '—' }}%<span class="text-[10px] text-slate-500">/hari</span></p>
              </div>
              <div class="rounded-lg bg-slate-900/40 border border-slate-800/60 px-3 py-2.5">
                <p class="text-[10px] text-slate-500 uppercase">MA20 / 50 / 200</p>
                <p class="text-[11px] font-bold text-slate-100 mt-0.5">{{ fmt(t.sma20) }} · {{ fmt(t.sma50) }} · {{ fmt(t.sma200) }}</p>
              </div>
              <div class="rounded-lg bg-slate-900/40 border border-slate-800/60 px-3 py-2.5">
                <p class="text-[10px] text-slate-500 uppercase">Volume vs 20d</p>
                <p class="text-sm font-bold text-slate-100 mt-0.5">{{ t.volRatio != null ? t.volRatio + '×' : '—' }}</p>
              </div>
              <div class="rounded-lg bg-slate-900/40 border border-slate-800/60 px-3 py-2.5">
                <p class="text-[10px] text-slate-500 uppercase">Dari 52w High/Low</p>
                <p class="text-[11px] font-bold text-slate-100 mt-0.5">{{ t.pctFromHigh }}% / +{{ t.pctFromLow }}%</p>
              </div>
            </div>
            <div class="flex flex-wrap gap-1.5 mt-4">
              <span v-for="(sig, i) in t.signals" :key="i" class="text-[10px] font-medium px-2 py-0.5 rounded-full border" :class="SIGNAL_TONE[sig.tone]">{{ sig.label }}</span>
            </div>
          </div>

          <!-- Levels -->
          <div class="glow-card rounded-2xl p-6">
            <h4 class="text-sm font-bold text-slate-100 mb-4">Level Harga Penting</h4>
            <template v-if="lv">
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <p class="text-[10px] font-semibold text-rose-400 uppercase tracking-wide mb-2">Resistance (atas)</p>
                  <div class="space-y-1.5">
                    <div v-for="r in [...lv.resistances].reverse()" :key="r.price" class="flex justify-between text-sm bg-rose-500/5 border border-rose-500/15 rounded-lg px-3 py-1.5">
                      <span class="font-bold text-rose-300">{{ fmt(r.price) }}</span>
                      <span class="text-[10px] text-slate-500 self-center">{{ r.touches }}× sentuh</span>
                    </div>
                    <p v-if="!lv.resistances.length" class="text-xs text-slate-600">— (dekat all-time high)</p>
                  </div>
                </div>
                <div>
                  <p class="text-[10px] font-semibold text-emerald-400 uppercase tracking-wide mb-2">Support (bawah)</p>
                  <div class="space-y-1.5">
                    <div v-for="s in lv.supports" :key="s.price" class="flex justify-between text-sm bg-emerald-500/5 border border-emerald-500/15 rounded-lg px-3 py-1.5">
                      <span class="font-bold text-emerald-300">{{ fmt(s.price) }}</span>
                      <span class="text-[10px] text-slate-500 self-center">{{ s.touches }}× sentuh</span>
                    </div>
                    <p v-if="!lv.supports.length" class="text-xs text-slate-600">— (dekat 52w low)</p>
                  </div>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-800/60 text-[11px]">
                <div>
                  <p class="text-slate-500 uppercase text-[10px] mb-1.5">Pivot Klasik (harian)</p>
                  <p class="text-slate-300 leading-relaxed">R2 {{ fmt(lv.pivot.r2) }} · R1 {{ fmt(lv.pivot.r1) }}<br />
                    <strong class="text-slate-100">P {{ fmt(lv.pivot.p) }}</strong><br />
                    S1 {{ fmt(lv.pivot.s1) }} · S2 {{ fmt(lv.pivot.s2) }}</p>
                </div>
                <div>
                  <p class="text-slate-500 uppercase text-[10px] mb-1.5">Fibonacci 52w ({{ fmt(lv.fib.low52) }}–{{ fmt(lv.fib.high52) }})</p>
                  <p class="text-slate-300 leading-relaxed">38,2% → {{ fmt(lv.fib.l382) }}<br />50% → {{ fmt(lv.fib.l500) }}<br />61,8% → {{ fmt(lv.fib.l618) }}</p>
                </div>
              </div>
            </template>
            <p v-else class="text-xs text-slate-500">Data belum cukup untuk analisis level.</p>
          </div>
        </section>

        <!-- Trade plan + position calculator -->
        <section v-if="lv" class="glow-card rounded-2xl p-6">
          <h4 class="text-sm font-bold text-slate-100 mb-1">Rencana Trade (ATR) &amp; Kalkulator Ukuran Posisi</h4>
          <p class="text-[11px] text-slate-400 mb-4">Aturan baku profesional: stop 2×ATR di bawah entry, target 3×ATR (R:R 1,5). Risiko per trade umumnya 1–2% modal.</p>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="grid grid-cols-3 gap-3">
              <div class="rounded-xl bg-slate-900/50 border border-slate-800 p-4 text-center">
                <p class="text-[10px] text-slate-500 uppercase">Entry</p>
                <p class="text-lg font-extrabold text-slate-100 mt-1">{{ fmt(lv.plan.entry) }}</p>
              </div>
              <div class="rounded-xl bg-rose-500/5 border border-rose-500/20 p-4 text-center">
                <p class="text-[10px] text-rose-400 uppercase">Stop (2×ATR)</p>
                <p class="text-lg font-extrabold text-rose-300 mt-1">{{ fmt(lv.plan.stop) }}</p>
              </div>
              <div class="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-4 text-center">
                <p class="text-[10px] text-emerald-400 uppercase">Target (3×ATR)</p>
                <p class="text-lg font-extrabold text-emerald-300 mt-1">{{ fmt(lv.plan.target) }}</p>
              </div>
            </div>
            <div>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div class="flex flex-col gap-1">
                  <label class="text-[10px] font-semibold text-slate-400 uppercase">Modal (Rp)</label>
                  <input v-model.number="modal" type="number" class="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-[10px] font-semibold text-slate-400 uppercase">Risiko %</label>
                  <input v-model.number="riskPct" type="number" step="0.5" min="0.5" max="5" class="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-[10px] font-semibold text-slate-400 uppercase">Entry</label>
                  <input v-model.number="entry" type="number" class="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-[10px] font-semibold text-slate-400 uppercase">Stop</label>
                  <input v-model.number="stop" type="number" class="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500" />
                </div>
              </div>
              <div v-if="posCalc" class="mt-3 rounded-xl bg-slate-900/50 border border-slate-800 px-4 py-3 flex flex-wrap gap-x-6 gap-y-1.5 text-xs">
                <span class="text-slate-400">Beli maks: <strong class="text-emerald-300 text-sm">{{ posCalc.lots }} lot</strong> ({{ fmt(posCalc.shares) }} lembar)</span>
                <span class="text-slate-400">Nilai posisi: <strong class="text-slate-100">{{ fmtIdr(posCalc.nilai) }}</strong> ({{ posCalc.pctModal }}% modal)</span>
                <span class="text-slate-400">Risiko jika kena stop: <strong class="text-rose-300">{{ fmtIdr(posCalc.riskRp) }}</strong></span>
              </div>
              <p v-else class="mt-3 text-[11px] text-amber-400">Entry harus lebih besar dari stop untuk menghitung ukuran posisi.</p>
            </div>
          </div>
        </section>

        <!-- Seasonal + Forecast summary -->
        <section class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="glow-card rounded-2xl p-6">
            <h4 class="text-sm font-bold text-slate-100 mb-4">Bias Musiman</h4>
            <div v-if="seasonalNow || seasonalNext" class="space-y-3">
              <div v-for="(item, i) in [{ label: 'Bulan ini', s: seasonalNow }, { label: 'Bulan depan', s: seasonalNext }]" :key="i">
                <div v-if="item.s" class="rounded-xl border p-4" :class="item.s.avgReturn >= 0 ? 'border-emerald-500/20 bg-emerald-500/[0.04]' : 'border-rose-500/20 bg-rose-500/[0.04]'">
                  <div class="flex items-center justify-between mb-1.5">
                    <span class="text-xs font-bold text-slate-200">{{ item.s.periodLabel }} <span class="text-[10px] text-slate-500 font-medium">({{ item.label }})</span></span>
                    <span v-if="item.s.significant" class="text-[9px] font-bold px-1.5 py-0.5 rounded-full border text-emerald-300 bg-emerald-500/10 border-emerald-500/25">★ signifikan t={{ item.s.tStat }}</span>
                    <span v-else class="text-[9px] text-slate-600">t={{ item.s.tStat }} (belum signifikan)</span>
                  </div>
                  <div class="flex gap-5 text-sm">
                    <span :class="item.s.avgReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'" class="font-extrabold">{{ item.s.avgReturn >= 0 ? '+' : '' }}{{ item.s.avgReturn }}%</span>
                    <span class="text-slate-300">win {{ item.s.winRate }}%</span>
                    <span class="text-slate-500 text-xs self-center">{{ item.s.count }} tahun data</span>
                  </div>
                </div>
              </div>
            </div>
            <p v-else class="text-xs text-slate-500">Memuat data musiman…</p>
          </div>

          <div class="glow-card rounded-2xl p-6">
            <h4 class="text-sm font-bold text-slate-100 mb-4">Forecast 14 Hari (Ensemble)</h4>
            <div v-if="fcPending" class="text-xs text-slate-500 animate-pulse">Melatih model &amp; backtest…</div>
            <template v-else-if="fc">
              <div class="grid grid-cols-2 gap-3">
                <div class="rounded-xl bg-slate-900/50 border border-slate-800 p-4">
                  <p class="text-[10px] text-slate-500 uppercase">P(naik besok)</p>
                  <p class="text-xl font-extrabold mt-1" :class="fc.nextDay.probUp >= 50 ? 'text-emerald-400' : 'text-rose-400'">{{ fc.nextDay.probUp }}%</p>
                </div>
                <div class="rounded-xl bg-slate-900/50 border border-slate-800 p-4">
                  <p class="text-[10px] text-slate-500 uppercase">Rentang 14 hari (~80%)</p>
                  <p class="text-sm font-extrabold text-slate-100 mt-1.5">{{ fmt(fc.forecast[fc.forecast.length - 1]?.lower) }} – {{ fmt(fc.forecast[fc.forecast.length - 1]?.upper) }}</p>
                </div>
              </div>
              <p class="text-[11px] mt-3" :class="fc.best !== 'naive' ? 'text-emerald-400' : 'text-amber-400'">
                {{ fc.best !== 'naive' ? `✓ Model terbaik mengungguli random walk (akurasi arah ${fc.nextDay.hitRate ?? '—'}% vs baseline ${fc.baselineDirAcc}%)` : '⚠ Belum ada model yang mengungguli random walk — perlakukan sebagai indikasi kasar' }}
              </p>
            </template>
            <p v-else class="text-xs text-slate-500">Forecast tidak tersedia untuk simbol ini.</p>
          </div>
        </section>

        <!-- Automated conclusion -->
        <section class="glow-card rounded-2xl p-6">
          <h4 class="text-sm font-bold text-slate-100 mb-4">Kesimpulan Otomatis</h4>
          <ul class="space-y-2.5">
            <li v-for="(b, i) in conclusions" :key="i" class="flex gap-3 items-start text-sm">
              <span class="mt-0.5 w-2 h-2 rounded-full flex-shrink-0"
                :class="b.tone === 'bull' ? 'bg-emerald-400' : b.tone === 'bear' ? 'bg-rose-400' : b.tone === 'warn' ? 'bg-amber-400' : 'bg-slate-500'"></span>
              <span class="text-slate-300 leading-relaxed">{{ b.text }}</span>
            </li>
          </ul>
        </section>

        <!-- Disclaimer -->
        <footer class="p-5 rounded-2xl bg-rose-500/5 border border-rose-500/10">
          <p class="text-[11px] leading-relaxed text-slate-400">
            Seluruh analisa dihitung otomatis dari data historis Yahoo Finance dan merupakan alat bantu, bukan rekomendasi
            beli/jual. Kinerja masa lalu tidak menjamin masa depan. Selalu gunakan manajemen risiko.
          </p>
        </footer>
      </template>

    </main>
  </div>
</template>
