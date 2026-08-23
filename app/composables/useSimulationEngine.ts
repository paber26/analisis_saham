// Simulasi Lab engine — wizard state, as-of screening, basket composition,
// time-machine playback with regime-aware cut-loss suggestions, mid-simulation
// re-screening/buying, results & saved sessions.
//
// REFACTOR NOTE (C2): this is the former <script setup> of pages/simulasi/
// index.vue moved VERBATIM into a factory. The page creates exactly ONE
// instance and provides it via SIM_KEY; child components inject it. No logic
// was changed — only relocated.

import { ref, computed, reactive, inject, onBeforeUnmount, type InjectionKey } from 'vue';
import type { AsOfRow, PriceBar, BasketItem, Decision, DecRow, SimStep, SortKey, SortOrder, RecoNote } from '~/types/sim';
import { fmtIDR } from '~/utils/simFormat';
import type { SimUi } from './useSimUi';

export function createSimulationEngine(ui: SimUi) {
  const notify = ui.notify;
  const showConfirm = ui.showConfirm;

  // ---------------- Wizard state ----------------
  const step = ref<SimStep>('setup');

  const startDate = useSimDate(); // shared across the whole Simulasi Lab
  const horizonDays = ref(30);
  const decisionEveryDays = ref(5);
  const initialCapital = ref(100_000_000);

  // ---------------- Step 1 → 2: load as-of screening ----------------
  const screenRows = ref<AsOfRow[]>([]);
  const selected = reactive(new Set<string>());
  const loadingScreen = ref(false);
  const errorMsg = ref('');

  async function loadScreening() {
    errorMsg.value = '';
    loadingScreen.value = true;
    try {
      const res = await $fetch<{ results: AsOfRow[] }>('/api/sim/screen', { params: { date: startDate.value, limit: 60 } });
      screenRows.value = res.results;
      selected.clear();
      step.value = 'screen';
    } catch (e: any) {
      errorMsg.value = e?.data?.statusMessage || e?.message || 'Gagal memuat screening';
    } finally {
      loadingScreen.value = false;
    }
  }

  // ---------------- Filter State for Step 2 Screening & Mid-Simulation Screening ----------------
  const filterQuery = ref('');
  const filterRating = ref<'ALL' | 'Kuat' | 'Menarik' | 'Netral' | 'Lemah'>('ALL');
  const filterRS3M = ref<'ALL' | 'POS' | 'HIGH'>('ALL');
  const filterRSI = ref<'ALL' | 'HEALTHY' | 'SAFE' | 'OVERSOLD'>('ALL');
  const filterDariHigh = ref<'ALL' | 'NEAR10' | 'NEAR20'>('ALL');

  function applyPreset(preset: 'super_momentum' | 'near_high' | 'reset') {
    if (preset === 'super_momentum') {
      filterQuery.value = '';
      filterRating.value = 'ALL';
      filterRS3M.value = 'POS';
      filterRSI.value = 'SAFE';
      filterDariHigh.value = 'ALL';
    } else if (preset === 'near_high') {
      filterQuery.value = '';
      filterRating.value = 'ALL';
      filterRS3M.value = 'ALL';
      filterRSI.value = 'ALL';
      filterDariHigh.value = 'NEAR10';
    } else if (preset === 'reset') {
      filterQuery.value = '';
      filterRating.value = 'ALL';
      filterRS3M.value = 'ALL';
      filterRSI.value = 'ALL';
      filterDariHigh.value = 'ALL';
    }
  }

  function filterRow(r: AsOfRow): boolean {
    if (filterQuery.value) {
      const q = filterQuery.value.toUpperCase();
      if (!r.code.toUpperCase().includes(q) && !r.name.toUpperCase().includes(q)) return false;
    }
    if (filterRating.value !== 'ALL' && r.rating !== filterRating.value) return false;
    const rs = r.rs3m ?? 0;
    if (filterRS3M.value === 'POS' && rs <= 0) return false;
    if (filterRS3M.value === 'HIGH' && rs <= 10) return false;
    const rsi = r.rsi ?? 50;
    if (filterRSI.value === 'HEALTHY' && (rsi < 40 || rsi > 70)) return false;
    if (filterRSI.value === 'SAFE' && rsi > 75) return false;
    if (filterRSI.value === 'OVERSOLD' && rsi >= 40) return false;
    const fh = r.pctFromHigh ?? -100;
    if (filterDariHigh.value === 'NEAR10' && fh < -10) return false;
    if (filterDariHigh.value === 'NEAR20' && fh < -20) return false;
    return true;
  }

  // ---------------- Sorting State ----------------
  const sortKey = ref<SortKey>('score');
  const sortOrder = ref<SortOrder>('desc');

  function sortBy(key: SortKey) {
    if (sortKey.value === key) {
      sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc';
    } else {
      sortKey.value = key;
      sortOrder.value = 'desc';
    }
  }

  function sortRows<T extends { code: string; price: number; rating: string; score?: number | null; rs3m?: number | null; rsi?: number | null; pctFromHigh?: number | null }>(rows: T[]): T[] {
    const mult = sortOrder.value === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) => {
      let valA: any = a[sortKey.value];
      let valB: any = b[sortKey.value];

      if (valA == null) valA = sortOrder.value === 'desc' ? -999999 : 999999;
      if (valB == null) valB = sortOrder.value === 'desc' ? -999999 : 999999;

      if (typeof valA === 'string') {
        return valA.localeCompare(valB) * mult;
      }
      return (valA - valB) * mult;
    });
  }

  const filteredScreenRows = computed(() => sortRows(screenRows.value.filter(filterRow)));
  const filteredMidScreenRows = computed(() => sortRows(midScreenRows.value.filter(filterRow)));
  const sortedDecisionRows = computed(() => sortRows(decisionRows.value));

  function toggle(code: string) { selected.has(code) ? selected.delete(code) : selected.add(code); }
  const ratingCounts = computed(() => {
    const c: Record<string, number> = { Kuat: 0, Menarik: 0, Netral: 0, Lemah: 0 };
    for (const r of screenRows.value) c[r.rating] = (c[r.rating] || 0) + 1;
    return c;
  });

  // Popups: indicator help + recommendation reasoning
  const showIndicatorHelp = ref(false);
  const showRecommendation = ref(false);
  const recommendations = computed<RecoNote[]>(() => {
    const strong = screenRows.value.filter((r) => r.rating === 'Kuat' || r.rating === 'Menarik'); // already score-sorted
    return strong.slice(0, 6).map((r) => {
      const reasons: string[] = [];
      const cautions: string[] = [];
      reasons.push(`Skor teknikal ${Math.round(r.score)} — rating ${r.rating}`);
      const rs = r.rs3m ?? 0, rsi = r.rsi ?? 50;
      if (rs > 10) reasons.push(`Mengungguli IHSG kuat (RS 3B +${rs.toFixed(0)}%)`);
      else if (rs > 0) reasons.push(`Sedikit di atas IHSG (RS 3B +${rs.toFixed(0)}%)`);
      else cautions.push(`Lebih lemah dari IHSG (RS 3B ${rs.toFixed(0)}%)`);
      if (rsi > 80) cautions.push(`RSI ${Math.round(rsi)} — overbought, rawan koreksi jangka pendek`);
      else if (rsi >= 50 && rsi <= 75) reasons.push(`RSI ${Math.round(rsi)} — momentum sehat`);
      else if (rsi < 40) cautions.push(`RSI ${Math.round(rsi)} — momentum lemah`);
      if (r.pctFromHigh > -5) reasons.push(`Dekat puncak 52-minggu (${r.pctFromHigh.toFixed(0)}%) — tren kuat`);
      else if (r.pctFromHigh < -20) cautions.push(`Jauh dari puncak (${r.pctFromHigh.toFixed(0)}%) — tren mungkin belum pulih`);
      return { code: r.code, name: r.name, score: r.score, rating: r.rating, reasons, cautions };
    });
  });

  // ---------------- Step 2 → 3: compose basket ----------------
  const basket = ref<BasketItem[]>([]);
  function buildBasket() {
    const picks = screenRows.value.filter((r) => selected.has(r.code));
    const w = picks.length ? 100 / picks.length : 0;
    basket.value = picks.map((r) => ({
      code: r.code,
      name: r.name,
      entryPrice: r.price,
      rating: r.rating,
      score: r.score,
      rs3m: r.rs3m,
      rsi: r.rsi,
      pctFromHigh: r.pctFromHigh,
      weightPct: Math.round(w * 10) / 10,
      lots: 0
    }));
    recomputeLots();
    step.value = 'basket';
  }
  function recomputeLots() {
    for (const b of basket.value) {
      const alloc = initialCapital.value * (b.weightPct / 100);
      b.lots = Math.max(0, Math.floor(alloc / (b.entryPrice * 100)));
    }
  }
  const totalWeight = computed(() => basket.value.reduce((s, b) => s + b.weightPct, 0));
  function equalizeWeights() {
    const n = basket.value.length; if (!n) return;
    const w = Math.round((100 / n) * 10) / 10;
    basket.value.forEach((b) => (b.weightPct = w));
    const last = basket.value[n - 1]!;
    last.weightPct = Math.round((last.weightPct + (100 - basket.value.reduce((s, b) => s + b.weightPct, 0))) * 10) / 10;
    recomputeLots();
  }

  // ---------------- Step 3 → 4: fetch prices + start playback ----------------
  const closesByCode = reactive<Record<string, number[]>>({}); // aligned to timeline
  const ihsgCloses = ref<number[]>([]);
  const timeline = ref<string[]>([]);
  const cursor = ref(0);
  const playing = ref(false);
  const speed = ref(4);
  let timer: ReturnType<typeof setInterval> | null = null;

  const positions = reactive<Record<string, { lots: number; avgPrice: number }>>({});
  const cash = ref(0);
  const decisions = ref<Decision[]>([]);
  const equityCurve = ref<{ date: string; value: number }[]>([]);
  const loadingPrices = ref(false);

  function alignForwardFill(bars: PriceBar[], dates: string[]): number[] {
    const map = new Map(bars.map((b) => [b.date, b.close]));
    const out: number[] = [];
    let last = bars[0]?.close ?? 0;
    for (const d of dates) { if (map.has(d)) last = map.get(d)!; out.push(last); }
    return out;
  }

  function ihsgReturnPctAt(idx: number): number {
    if (!ihsgCloses.value.length || idx < 0 || idx >= ihsgCloses.value.length) return 0;
    const c0 = ihsgCloses.value[0];
    const cIdx = ihsgCloses.value[idx];
    if (!c0 || c0 <= 0 || cIdx == null) return 0;
    return ((cIdx / c0) - 1) * 100;
  }

  function ihsgEquityAt(idx: number): number {
    return initialCapital.value * (1 + ihsgReturnPctAt(idx) / 100);
  }

  // Regime-aware cut-loss suggestion (from Kondisi Pasar of the entry date).
  const regimeInfo = ref<null | { regime: string; label: string; cutloss: string; threshold: number; note: string }>(null);
  async function loadRegime() {
    try {
      const r = await $fetch<any>('/api/sim/regime', { params: { date: startDate.value } });
      const threshold = r.regime === 'bull' ? -12 : r.regime === 'bear' ? -5 : -8;
      regimeInfo.value = { regime: r.regime, label: r.label, cutloss: r.stance.cutloss, threshold, note: r.stance.note };
    } catch { regimeInfo.value = null; }
  }
  const regimeBadgeClass = computed(() => {
    const r = regimeInfo.value?.regime;
    return r === 'bull' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
      : r === 'bear' ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
      : 'bg-amber-500/10 text-amber-300 border-amber-500/30';
  });
  const regimeEmoji = computed(() => (regimeInfo.value?.regime === 'bull' ? '🐂' : regimeInfo.value?.regime === 'bear' ? '🐻' : '➡️'));
  const regimeTextClass = computed(() => (regimeInfo.value?.regime === 'bull' ? 'text-emerald-300' : regimeInfo.value?.regime === 'bear' ? 'text-rose-300' : 'text-amber-300'));
  function suggestedAction(plPct: number): 'HOLD' | 'SELL' {
    return regimeInfo.value && plPct < regimeInfo.value.threshold ? 'SELL' : 'HOLD';
  }
  function applySuggestions() { for (const d of decisionRows.value) d.action = suggestedAction(d.plPct); }

  async function startSimulation() {
    errorMsg.value = '';
    loadingPrices.value = true;
    try {
      const from = startDate.value;
      const end = new Date(startDate.value);
      end.setDate(end.getDate() + Math.ceil(horizonDays.value * 1.8) + 10); // enough calendar days for H trading days
      const to = end.toISOString().split('T')[0]!;
      const codes = basket.value.map((b) => b.code).join(',');
      const res = await $fetch<{ series: { code: string; bars: PriceBar[] }[]; ihsgSeries?: { code: string; bars: PriceBar[] } }>('/api/sim/prices', { params: { codes, from, to } });

      // Union of trading dates >= start, then take first (horizon+1) as the window.
      const dateSet = new Set<string>();
      for (const s of res.series) for (const b of s.bars) if (b.date >= from) dateSet.add(b.date);
      const allDates = Array.from(dateSet).sort();
      timeline.value = allDates.slice(0, horizonDays.value + 1);
      if (timeline.value.length < 2) { errorMsg.value = 'Data harga tidak cukup untuk periode ini.'; return; }

      for (const s of res.series) closesByCode[s.code] = alignForwardFill(s.bars, timeline.value);
      if (res.ihsgSeries?.bars?.length) {
        ihsgCloses.value = alignForwardFill(res.ihsgSeries.bars, timeline.value);
      } else {
        ihsgCloses.value = [];
      }

      // Set entry prices to the actual first-bar close on the timeline, recompute lots.
      for (const b of basket.value) { const c0 = closesByCode[b.code]?.[0]; if (c0) b.entryPrice = c0; }
      recomputeLots();

      // Open positions, leftover → cash.
      let spent = 0;
      for (const k of Object.keys(positions)) delete positions[k];
      for (const b of basket.value) { positions[b.code] = { lots: b.lots, avgPrice: b.entryPrice }; spent += b.lots * 100 * b.entryPrice; }
      cash.value = initialCapital.value - spent;
      decisions.value = [];
      cursor.value = 0;
      equityCurve.value = [{ date: timeline.value[0]!, value: valueAt(0) }];
      loadRegime();
      step.value = 'play';
    } catch (e: any) {
      errorMsg.value = e?.data?.statusMessage || e?.message || 'Gagal memuat harga';
    } finally {
      loadingPrices.value = false;
    }
  }

  function priceAt(code: string, idx: number): number { return closesByCode[code]?.[idx] ?? 0; }
  function valueAt(idx: number): number {
    let v = cash.value;
    for (const b of basket.value) { const p = positions[b.code]; if (p && p.lots > 0) v += p.lots * 100 * priceAt(b.code, idx); }
    return v;
  }

  // ---------------- Playback controls ----------------
  function play() { if (playing.value || step.value !== 'play') return; playing.value = true; timer = setInterval(tick, Math.max(120, 1000 / speed.value)); }
  function pause() { playing.value = false; if (timer) { clearInterval(timer); timer = null; } }
  function tick() {
    if (cursor.value >= timeline.value.length - 1) { pause(); finish(); return; }
    cursor.value++;
    equityCurve.value.push({ date: timeline.value[cursor.value]!, value: valueAt(cursor.value) });
    const atEnd = cursor.value >= timeline.value.length - 1;
    if (!atEnd && cursor.value % decisionEveryDays.value === 0) { pause(); openDecision(); return; }
    if (atEnd) { pause(); finish(); }
  }
  function stepOnce() { if (step.value !== 'play') return; pause(); tick(); }
  onBeforeUnmount(pause);

  // ---------------- Decision gate & Mid-Simulation Re-Screening ----------------
  const decisionOpen = ref(false);
  const decisionViewMode = ref<'cards' | 'table'>('cards');
  const decisionTab = ref<'positions' | 'buy_new'>('positions');
  const midScreenRows = ref<AsOfRow[]>([]);
  const loadingMidScreen = ref(false);
  // Buy new stocks by NOMINAL (Rp): the system fits the maximum whole lots that
  // the nominal buys, capped by available cash.
  const newStockBuyNominal = reactive<Record<string, number>>({});
  function lotsFromNominal(r: AsOfRow): number {
    const lotPrice = r.price * 100;
    const byNominal = Math.floor((Number(newStockBuyNominal[r.code]) || 0) / lotPrice);
    const byCash = Math.floor(cash.value / lotPrice);
    return Math.max(0, Math.min(byNominal, byCash));
  }

  const decisionRows = ref<DecRow[]>([]);

  function getRecommendedAvgDownLots(code: string, currentPrice: number) {
    const b = basket.value.find((x) => x.code === code);
    const weightPct = b?.weightPct ?? (100 / (basket.value.length || 1));
    const budget = initialCapital.value * (weightPct / 100);
    const lotPrice = currentPrice * 100;
    const targetAdd = Math.max(1, Math.floor(budget / lotPrice));
    const maxAffordable = Math.floor(cash.value / lotPrice);
    return Math.min(targetAdd, maxAffordable);
  }

  async function fetchMidScreening(dateStr: string) {
    loadingMidScreen.value = true;
    try {
      const res = await $fetch<{ results: AsOfRow[] }>('/api/sim/screen', { params: { date: dateStr, limit: 30 } });
      midScreenRows.value = res.results;
      for (const r of res.results) {
        if (!newStockBuyNominal[r.code]) {
          const lotPrice = r.price * 100;
          const maxAffordable = Math.floor(cash.value / lotPrice);
          const defaultLots = Math.min(5, Math.max(1, Math.floor(maxAffordable / 3)));
          newStockBuyNominal[r.code] = defaultLots * lotPrice; // nominal awal ≈ beberapa lot
        }
      }
    } catch {
      midScreenRows.value = [];
    } finally {
      loadingMidScreen.value = false;
    }
  }

  async function buyNewStockMidSim(r: AsOfRow) {
    const requestedLots = lotsFromNominal(r);
    if (requestedLots < 1) {
      notify(`Nominal terlalu kecil / kas tak cukup untuk 1 lot ${r.code} (${fmtIDR(r.price * 100)}/lot). Sisa kas: ${fmtIDR(cash.value)}`, 'error');
      return;
    }
    const cost = requestedLots * 100 * r.price;

    // Ensure price series for new symbol is loaded
    if (!closesByCode[r.code] || !closesByCode[r.code]?.length) {
      try {
        const from = startDate.value;
        const end = new Date(startDate.value);
        end.setDate(end.getDate() + Math.ceil(horizonDays.value * 1.8) + 10);
        const to = end.toISOString().split('T')[0]!;
        const res = await $fetch<{ series: { code: string; bars: PriceBar[] }[] }>('/api/sim/prices', { params: { codes: r.code, from, to } });
        if (res.series?.[0]) {
          closesByCode[r.code] = alignForwardFill(res.series[0].bars, timeline.value);
        }
      } catch {
        notify(`Gagal memuat serial harga ${r.code}`, 'error');
        return;
      }
    }

    // Deduct cash & update position
    cash.value -= cost;
    if (!positions[r.code]) {
      positions[r.code] = { lots: requestedLots, avgPrice: r.price };
    } else {
      const p = positions[r.code]!;
      const newLots = p.lots + requestedLots;
      p.avgPrice = (p.avgPrice * p.lots + r.price * requestedLots) / newLots;
      p.lots = newLots;
    }

    // Ensure in basket
    if (!basket.value.some((b) => b.code === r.code)) {
      basket.value.push({
        code: r.code,
        name: r.name,
        entryPrice: r.price,
        rating: r.rating,
        score: r.score,
        rs3m: r.rs3m,
        rsi: r.rsi,
        pctFromHigh: r.pctFromHigh,
        weightPct: 0,
        lots: requestedLots
      });
    } else {
      const b = basket.value.find((x) => x.code === r.code);
      if (b) b.lots = positions[r.code]!.lots;
    }

    const date = timeline.value[cursor.value]!;
    decisions.value.push({
      date,
      code: r.code,
      action: 'BUY',
      lots: requestedLots,
      price: r.price,
      unrealizedPct: 0,
      rating: r.rating
    });

    // Re-sync decisionRows for positions tab
    const rec = getRecommendedAvgDownLots(r.code, r.price);
    const existingDec = decisionRows.value.find((d) => d.code === r.code);
    if (existingDec) {
      existingDec.lots = positions[r.code]!.lots;
      existingDec.avgPrice = positions[r.code]!.avgPrice;
    } else {
      decisionRows.value.push({
        code: r.code,
        name: r.name,
        price: r.price,
        avgPrice: r.price,
        plPct: 0,
        lots: requestedLots,
        rating: r.rating,
        score: r.score,
        rs3m: r.rs3m,
        rsi: r.rsi,
        pctFromHigh: r.pctFromHigh,
        action: 'HOLD',
        avgDownLots: rec
      });
    }

    notify(`✨ Berhasil membeli ${requestedLots} lot ${r.code} pada harga ${fmtIDR(r.price)}!`, 'success');
  }

  function openDecision() {
    decisionTab.value = 'positions';
    const currentDateStr = timeline.value[cursor.value]!;
    fetchMidScreening(currentDateStr);

    decisionRows.value = basket.value
      .filter((b) => (positions[b.code]?.lots ?? 0) > 0)
      .map((b) => {
        const p = positions[b.code]!;
        const price = priceAt(b.code, cursor.value);
        const rec = getRecommendedAvgDownLots(b.code, price);
        return {
          code: b.code,
          name: b.name,
          price,
          avgPrice: p.avgPrice,
          plPct: (price / p.avgPrice - 1) * 100,
          lots: p.lots,
          rating: b.rating,
          score: b.score,
          rs3m: b.rs3m,
          rsi: b.rsi,
          pctFromHigh: b.pctFromHigh,
          action: 'HOLD' as const,
          avgDownLots: rec
        };
      });
    decisionOpen.value = true;
  }

  function applyDecisions() {
    const date = timeline.value[cursor.value]!;
    for (const d of decisionRows.value) {
      const pos = positions[d.code]; if (!pos) continue;
      if (d.action === 'SELL' && pos.lots > 0) {
        cash.value += pos.lots * 100 * d.price;
        decisions.value.push({ date, code: d.code, action: 'SELL', lots: pos.lots, price: d.price, unrealizedPct: d.plPct, rating: d.rating });
        pos.lots = 0;
      } else if (d.action === 'SELL_50' && pos.lots > 0) {
        const sellLots = Math.ceil(pos.lots / 2);
        cash.value += sellLots * 100 * d.price;
        pos.lots -= sellLots;
        decisions.value.push({ date, code: d.code, action: 'SELL', lots: sellLots, price: d.price, unrealizedPct: d.plPct, rating: d.rating });
      } else if (d.action === 'AVERAGE_DOWN') {
        const requestedLots = Math.max(1, Number(d.avgDownLots) || 1);
        const maxAffordable = Math.floor(cash.value / (d.price * 100));
        const addLots = Math.min(requestedLots, maxAffordable);
        if (addLots > 0) {
          const cost = addLots * 100 * d.price;
          const newLots = pos.lots + addLots;
          pos.avgPrice = (pos.avgPrice * pos.lots + d.price * addLots) / newLots;
          pos.lots = newLots;
          cash.value -= cost;
          decisions.value.push({ date, code: d.code, action: 'AVERAGE_DOWN', lots: addLots, price: d.price, unrealizedPct: d.plPct, rating: d.rating });
        }
      } else {
        decisions.value.push({ date, code: d.code, action: 'HOLD', lots: 0, price: d.price, unrealizedPct: d.plPct, rating: d.rating });
      }
    }
    // Recompute equity at current cursor after trades.
    equityCurve.value[equityCurve.value.length - 1] = { date, value: valueAt(cursor.value) };
    decisionOpen.value = false;
    play(); // auto-resume
  }

  // ---------------- Finish → results + regression ----------------
  const result = ref<null | {
    finalValue: number;
    totalReturnPct: number;
    ihsgReturnPct: number;
    alphaPct: number;
    maxDrawdownPct: number;
    winRate: number;
    realizedPnl: number;
    perStock: { code: string; returnPct: number; contributionPct: number }[];
  }>(null);
  const regression = ref<any>(null);
  const loadingReg = ref(false);
  const savedId = ref('');

  async function finish() {
    const lastIdx = timeline.value.length - 1;
    const finalValue = valueAt(lastIdx);
    const totalReturnPct = (finalValue / initialCapital.value - 1) * 100;
    const ihsgReturnPct = ihsgReturnPctAt(lastIdx);
    const alphaPct = totalReturnPct - ihsgReturnPct;

    let peak = -Infinity, maxDd = 0;
    for (const e of equityCurve.value) { peak = Math.max(peak, e.value); maxDd = Math.min(maxDd, (e.value / peak - 1) * 100); }
    const perStock = basket.value.map((b) => {
      const finalPrice = priceAt(b.code, lastIdx);
      const returnPct = (finalPrice / b.entryPrice - 1) * 100;
      const contributionPct = (b.weightPct / 100) * returnPct;
      return { code: b.code, returnPct, contributionPct };
    });
    const winRate = perStock.length ? perStock.filter((s) => s.returnPct > 0).length / perStock.length * 100 : 0;
    result.value = {
      finalValue,
      totalReturnPct,
      ihsgReturnPct,
      alphaPct,
      maxDrawdownPct: maxDd,
      winRate,
      realizedPnl: finalValue - initialCapital.value,
      perStock
    };
    step.value = 'result';
    loadRegression();
  }

  async function loadRegression() {
    loadingReg.value = true;
    try {
      regression.value = await $fetch('/api/sim/regression', { params: { date: startDate.value, horizon: horizonDays.value } });
    } catch { regression.value = null; } finally { loadingReg.value = false; }
  }

  async function saveSession() {
    if (!result.value) return;
    try {
      const body = {
        startDate: startDate.value, horizonDays: horizonDays.value, decisionEveryDays: decisionEveryDays.value,
        initialCapital: initialCapital.value,
        picks: basket.value.map((b) => ({ code: b.code, entryDate: timeline.value[0], entryPrice: b.entryPrice, lots: b.lots, weightPct: b.weightPct })),
        decisions: decisions.value,
        result: { endDate: timeline.value.at(-1), ...result.value, regression: regression.value?.regression ?? null },
        status: 'settled'
      };
      const res = await $fetch<{ id: string }>('/api/sim/session', { method: 'POST', body });
      savedId.value = res.id;
      loadInsights();
      loadSavedSessions();
      notify('Analisa sesi simulasi berhasil disimpan!', 'success');
    } catch (e: any) {
      const msg = e?.data?.statusMessage || e?.message || 'Gagal menyimpan sesi simulasi';
      errorMsg.value = msg;
      notify(msg, 'error');
    }
  }

  // ---------------- Insights + saved sessions ----------------
  const insights = ref<any>(null);
  async function loadInsights() { try { insights.value = await $fetch('/api/sim/insights'); } catch { insights.value = null; } }

  // ---------------- Saved-session history + review ----------------
  const savedSessions = ref<any[]>([]);
  async function loadSavedSessions() { try { savedSessions.value = (await $fetch<{ sessions: any[] }>('/api/sim/sessions')).sessions; } catch { savedSessions.value = []; } }
  const reviewData = ref<any>(null);
  async function openReview(id: string) {
    errorMsg.value = '';
    try {
      reviewData.value = await $fetch(`/api/sim/session/${id}`);
      step.value = 'review';
      if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      const msg = 'Gagal memuat sesi tersimpan';
      errorMsg.value = msg;
      notify(msg, 'error');
    }
  }

  function promptDeleteSession(id: string, dateStr?: string) {
    showConfirm({
      title: '🗑️ Hapus Sesi Simulasi',
      message: `Apakah kamu yakin ingin menghapus sesi simulasi ${dateStr ? 'tanggal ' + dateStr : ''}? Sesi yang dihapus tidak dapat dikembalikan.`,
      confirmText: 'Ya, Hapus Sesi',
      cancelText: 'Batal',
      type: 'danger',
      onConfirm: () => deleteSavedSession(id)
    });
  }

  async function deleteSavedSession(id: string) {
    try {
      await $fetch(`/api/sim/session/${id}`, { method: 'DELETE' });
      savedSessions.value = savedSessions.value.filter((s) => s.id !== id);
      if (reviewData.value?.id === id) reset();
      loadInsights();
      notify('Sesi simulasi telah berhasil dihapus.', 'success');
    } catch {
      const msg = 'Gagal menghapus sesi simulasi';
      errorMsg.value = msg;
      notify(msg, 'error');
    }
  }

  function reset() { pause(); step.value = 'setup'; screenRows.value = []; selected.clear(); basket.value = []; result.value = null; regression.value = null; savedId.value = ''; reviewData.value = null; }

  // ---------------- Equity chart option ----------------
  const equityOption = computed(() => {
    const portData = equityCurve.value.map((e) => [e.date, Math.round(e.value)]);
    const ihsgData = equityCurve.value.map((e, idx) => [e.date, Math.round(ihsgEquityAt(idx))]);
    const base = initialCapital.value;
    return {
      grid: { left: 8, right: 12, top: 28, bottom: 24, containLabel: true },
      legend: { data: ['Portofolio', 'IHSG Benchmark'], textStyle: { color: '#94a3b8', fontSize: 11 }, top: 0, right: 12 },
      tooltip: { trigger: 'axis', valueFormatter: (v: number) => fmtIDR(v) },
      xAxis: { type: 'category', data: equityCurve.value.map((e) => e.date), axisLabel: { color: '#64748b', fontSize: 10 }, axisLine: { lineStyle: { color: '#1e293b' } } },
      yAxis: { type: 'value', scale: true, axisLabel: { color: '#64748b', fontSize: 10, formatter: (v: number) => (v / 1e6).toFixed(0) + 'jt' }, splitLine: { lineStyle: { color: '#1e293b' } } },
      series: [
        { name: 'Portofolio', type: 'line', data: portData, showSymbol: false, smooth: true, lineStyle: { width: 2.5, color: '#34d399' }, areaStyle: { color: 'rgba(52,211,153,0.12)' } },
        { name: 'IHSG Benchmark', type: 'line', data: ihsgData, showSymbol: false, smooth: true, lineStyle: { width: 2, type: 'dashed', color: '#38bdf8' } },
        { type: 'line', data: equityCurve.value.map((e) => [e.date, base]), showSymbol: false, lineStyle: { width: 1, type: 'dotted', color: '#475569' } }
      ]
    };
  });

  const currentValue = computed(() => equityCurve.value.at(-1)?.value ?? initialCapital.value);
  const currentReturnPct = computed(() => (currentValue.value / initialCapital.value - 1) * 100);
  const currentIhsgReturnPct = computed(() => ihsgReturnPctAt(cursor.value));
  const currentAlphaPct = computed(() => currentReturnPct.value - currentIhsgReturnPct.value);
  const progressPct = computed(() => timeline.value.length > 1 ? (cursor.value / (timeline.value.length - 1)) * 100 : 0);

  // Wizard
  // NOTE: dibungkus reactive() agar akses bertingkat di template komponen anak
  // (mis. sim.timeline[cursor]) otomatis meng-unwrap ref — semantik identik
  // dengan binding <script setup> lama.
  const bundle = {
    step, startDate, horizonDays, decisionEveryDays, initialCapital, reset,
    // screening step
    screenRows, selected, loadingScreen, errorMsg, loadScreening,
    filterQuery, filterRating, filterRS3M, filterRSI, filterDariHigh, applyPreset,
    sortKey, sortOrder, sortBy, filteredScreenRows, toggle, ratingCounts,
    showIndicatorHelp, showRecommendation, recommendations,
    // basket
    basket, buildBasket, recomputeLots, totalWeight, equalizeWeights,
    // playback
    closesByCode, timeline, cursor, playing, speed, positions, cash, decisions, equityCurve, loadingPrices,
    play, pause, stepOnce, priceAt, currentValue, currentReturnPct, currentIhsgReturnPct, currentAlphaPct,
    progressPct, equityOption, regimeInfo, regimeBadgeClass, regimeEmoji, regimeTextClass,
    ihsgReturnPctAt,
    // decision modal
    decisionOpen, decisionViewMode, decisionTab, midScreenRows, loadingMidScreen, newStockBuyNominal,
    lotsFromNominal, decisionRows, openDecision, applyDecisions, applySuggestions, sortedDecisionRows,
    buyNewStockMidSim,
    // result & sessions
    result, regression, loadingReg, savedId, finish, saveSession,
    insights, loadInsights, savedSessions, loadSavedSessions, reviewData, openReview,
    promptDeleteSession, deleteSavedSession
  };
  return reactive(bundle);
}

export type SimEngine = ReturnType<typeof createSimulationEngine>;

export const SIM_KEY: InjectionKey<SimEngine> = Symbol('sim-engine');

/** Inject the page-level simulation engine inside simulasi components. */
export function useSimulationEngine(): SimEngine {
  const sim = inject(SIM_KEY);
  if (!sim) throw new Error('useSimulationEngine must be used inside /simulasi page (SIM_KEY missing)');
  return sim;
}
