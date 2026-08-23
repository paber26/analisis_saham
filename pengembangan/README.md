# Rencana Pengembangan — Fase A/B/C

Dokumen eksekusi pengembangan berikutnya. Branch kerja: **`feat/pengembangan`**.
Dibuat setelah audit kodebase penuh (agustus 2026). Melengkapi
[ARCHITECTURE.md](../ARCHITECTURE.md) (kondisi app), [ROADMAP.md](../ROADMAP.md)
(Tier 1–4, mayoritas sudah jadi), dan [LEARNING.md](../LEARNING.md) (LMS).

Prinsip yang dipertahankan (sama dgn ROADMAP):

1. **Reuse infra** — server/utils, day-key cache WIB, `.data-store/`, cron harian.
2. **Tanpa native module baru** — store file JSON + Postgres opsional (sudah dual-mode).
3. **Jujur & berbasis bukti** — sinyal selalu dibandingkan baseline; tanpa look-ahead.
4. **Single-user** — endpoint tulis token-gated (`x-app-token` / `SYNC_TOKEN`).

---

## 1. Snapshot kondisi aplikasi (baseline)

Sudah berjalan (jauh melebihi README lama):

| Domain | Status |
|---|---|
| Screener ~900 emiten (skor 0–100, QVM, filter gabungan) | ✅ |
| Hub `/analisa/[symbol]` (teknikal, S/R, ATR, risiko VaR/beta/DD) | ✅ |
| Forecast ensemble walk-forward + seasonality | ✅ |
| Market breadth & rotasi sektor `/pasar` | ✅ |
| Watchlist, Portofolio (korelasi + risiko) | ✅ |
| Backtest engine + event study `/backtest` | ✅ |
| Simulasi Lab time-machine (MLR Fase 1–4, regime-aware, vs IHSG) | ✅ |
| LMS `/belajar` (5 program, quiz, streak) + auth login | ✅ |
| Digest email harian (`mailer.ts`, nodemailer) | ✅ |
| Dual persistence Postgres/file (`simulations`, `daily_history`) | ✅ |

## 2. Gap analisis (hasil audit)

| # | Masalah | Bukti | Dampak |
|---|---|---|---|
| G1 | Nol test untuk ~20rb baris kode analitik murni | tidak ada `vitest`/`test` di package.json | bug hitung tak terdeteksi |
| G2 | Tidak ada `lint`/`typecheck` script & CI | package.json hanya build/dev/generate | regresi lolos tanpa sengaja |
| G3 | Dokumentasi drift | README tidak menyebut pasar/portofolio/backtest/simulasi/belajar | sulit navigasi diri sendiri |
| G4 | Histori screener muda | `.data-store/history/` terisi mulai sync pertama saja | backtest strategi skor/QVM belum bisa jalan |
| G5 | Bandar hanya per-simbol | `fetchBandarDetector(symbol)` satu-satu | tidak tahu saham apa yang sedang diakumulasi lintas pasar |
| G6 | Tier 4 alert belum ada (hanya digest pasif) | tidak ada `alerts.ts`; ROADMAP T4 kosong | harus cek manual |
| G7 | `app/pages/simulasi/index.vue` 1.798 baris monolith | wc -l | susah maintain |

## 3. Peta perubahan per fase

```
Fase A — Fondasi Kualitas          Fase B — Keunggulan Data            Fase C — Otomasi & Kebersihan
├─ vitest + tests/                 ├─ server/utils/historyBackfill.ts   ├─ server/utils/alerts.ts
│   ├─ technical.test.ts           ├─ /api/backfill-history (token)     │    evaluate(rules, snapshot)
│   ├─ forecast.test.ts            ├─ server/utils/brokerFlow.ts        ├─ store.ts: alerts.json CRUD
│   ├─ levels/factor/portfolio     ├─ /api/broker-screen (token+cache)  ├─ /api/alerts CRUD, /api/alerts/run
│   └─ backtest.test.ts            │                                    ├─ notify: email (ada) + Telegram
├─ typecheck script (vue-tsc)      │                                    ├─ halaman /alert
├─ .github/workflows/ci.yml        └─ integrasi cron pasca-sync         └─ refactor simulasi → composables/
└─ README/ARCHITECTURE sinkron                                              + components/simulasi/*
```

---

## 4. FASE A — Fondasi Kualitas (effort rendah, nilai tinggi)

### A1. Vitest untuk fungsi analitik murni

Semua target adalah **pure TypeScript** tanpa dependensi Nuxt → test cepat,
node environment.

```bash
npm i -D vitest typescript vue-tsc
```

Struktur:

```
tests/
  technical.test.ts    # SMA/EMA/RSI/MACD/ATR vs fixture hand-computed;
                       # guard data flat; skor selalu 0–100
  levels.test.ts       # pivot klasik, fibonacci 52w, stop/target ATR
  forecast.test.ts     # walk-forward anti look-ahead (feed seri sintetis
                       # dgn pola diketahui); naive baseline RMSE; EWMA σ;
                       # P(naik)=Φ(μ̂/σ) monoton naik thd μ̂
  factor.test.ts       # peringkat persentil QVM pada rows sintetis
  portfolio.test.ts    # valuasi PnL, korelasi simetris ∈ [-1,1], VaR sanity
  backtest.test.ts     # entry open t+1, biaya transaksi termodel,
                       # equity curve konsisten dgn daftar trade
```

Acceptance:
- [ ] `npm run test` hijau (≥ 30 assertion inti, tiap util utama ≥ 1 kasus).
- [ ] Kasus "no look-ahead" eksplisit di forecast & backtest.

### A2. Script kualitas + CI

package.json:

```json
"test": "vitest run",
"typecheck": "nuxi typecheck"
```

`.github/workflows/ci.yml`: `npm ci → npm run build → npm run test`.
Build tidak memanggil Yahoo (semua fetch runtime) → aman di CI.

### A3. Sinkron dokumentasi

- README: daftar fitur aktual (pasar, portofolio, backtest, simulasi,
  belajar, auth, digest).
- ROADMAP: tandai Tier 1–3 selesai; sisakan T4 → dialihkan ke Fase C di sini.

Acceptance:
- [ ] Tidak ada fitur besar yang hilang dari README.

---

## 5. FASE B — Keunggulan Data

### B1. Backfill histori harian dari Yahoo (G4)

Tujuan: `daily_history` langsung punya ≥ 250 hari data sehingga backtest
strategi skor/QVM bisa dievaluasi **sekarang**, tanpa menunggu akumulasi bulan.

```
server/utils/historyBackfill.ts
  backfillHistory(tickers, opts {concurrency=6}):
    utk tiap ticker: fetchDailyBars(sym, '2y')
    → jalan maju per langkah mingguan (stepDays≈5): analyzeTechnical(bars.slice(0,i))
      rs3mOnly(closes_sampai_i, ihsg_sampai_i)
    → hasil digabung lintas ticker per tanggal trading (cross-sectional)
/api/backfill-history?token=SYNC_TOKEN&limit=200   (manual, sekali jalan)
```

Aturan wajib:
- **Tanpa look-ahead**: baris tanggal t hanya memakai bars ≤ t.
- **Merge, bukan timpa**: tanggal yang sudah ada di `daily_history` (hasil sync
  asli) tidak ditimpa; backfill hanya mengisi kekosongan.
- **QVM historis dibatasi**: fundamental historis (PER/ROE dsb.) tidak tersedia
  dari Yahoo → baris backfill disimpan dengan `per/pbv/roe = null` dan QVM
  dihitung versi momentum-only; tandai sumber `"backfill"` agar UI jujur.
- Jalankan di luar jam pasar, concurrency rendah (rate-limit Yahoo).

Acceptance:
- [ ] Setelah run, `listHistoryDates()` ≥ 240 tanggal unik.
- [ ] Halaman tren skor (sparkline hub) & `/backtest` strategi skor jalan dgn data ini.

> **B2 (broker-flow screening via Stockbit) DIBATALKAN** — integrasi Stockbit
> (bandar detector, broker flow/distribution, extension token-sync) telah
> dihapus dari aplikasi karena tidak dibutuhkan lagi.

---

## 6. FASE C — Otomasi & Kebersihan

### C1. Alert rule-based (menuntaskan G6 / ROADMAP Tier 4)

```
store.ts (+): getAlerts/upsertAlert/removeAlert → .data-store/alerts.json
  AlertRule = { id, symbol|'*', type, params, lastTriggeredAt }
  type: rsi_oversold | breakout_52w | cross_ma200 | score_above |
        price_below | murah_uptrend

server/utils/alerts.ts
  evaluateAlerts(rules, snapshotRows): TriggeredAlert[]   // dedupe via lastTriggeredAt

server/utils/notifyTelegram.ts   // Bot API via fetch (opsional; env TELEGRAM_*)
                                 // email tetap lewat mailer.ts yang sudah ada

/api/alerts        GET publik · POST/DELETE token
/api/alerts/run    token SYNC_TOKEN → evaluate vs snapshot → notify
Cron: setelah /api/sync sukses → curl /api/alerts/run
Halaman /alert: kelola rule + histori trigger
```

Acceptance:
- [ ] Rule RSI<30 pada snapshot uji → trigger tepat 1x (tidak spam besok).

### C2. Refactor Simulasi Lab (G7)

Tanpa perubahan perilaku — reorganisasi:

```
app/composables/useSimulationEngine.ts   # state draft→running→settled,
                                         # step playback, cut-loss regime-aware
app/components/simulasi/
  DecisionModal.vue · EquityChart.vue · CalendarPicker.vue · ScreeningStep.vue
```

Acceptance:
- [ ] `index.vue` < 500 baris; semua alur existing berfungsi sama.

---

## 7. Ringkasan prioritas & urutan eksekusi

| Tahap | Item | Effort | Nilai |
|---|---|---|---|
| A1–A2 | Test + CI | Sedang | ★★★ (melindungi semuanya) |
| B1 | Backfill histori | Sedang | ★★★ (membuka backtest QVM/skor) |
| C1 | Alert | Sedang | ★★★ |
| A3 | Docs sinkron | Rendah | ★☆☆ |
| C2 | Refactor simulasi | Sedang | ★★☆ |

**Urutan:** A1 → A2 → B1 → C1 → A3 → C2
(fondasi dulu, lalu nilai analitis tercepat, lalu otomasi, kebersihan terakhir).

## 8. Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| Rate-limit Yahoo saat backfill ~900 simbol | concurrency 6, jalankan manual di luar jam pasar, opsi `limit=` bertahap |
| Divergensi Postgres vs file store | ikuti pola existing (DB primer → file fallback); merge history by-date |
| CI build butuh network | build Nuxt tidak mem-fetch data (runtime only) — diverifikasi saat setup |
