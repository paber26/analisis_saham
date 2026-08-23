# Roadmap Arsitektur — Analisa Lanjutan (Tier 1–4)

Blueprint untuk memperluas analisa dari **per-saham** ke tiga lapisan di atasnya:
**konteks pasar**, **portofolio pribadi**, dan **validasi (backtest)**, ditutup
dengan **otomasi (alert)**.

Dokumen ini melengkapi [ARCHITECTURE.md](ARCHITECTURE.md) (kondisi saat ini).

> **STATUS (agustus 2026):** Tier 1a, 1b, 1c, 2a, 2b, dan 3 **SUDAH DIBANGUN**
> (lihat `/pasar`, RS di hub, kolom fundamental, `/watchlist`, `/portofolio`,
> `/backtest`). Tier 4 (alert rule-based) belum — dijadwalkan sebagai Fase C
> dalam [pengembangan/](pengembangan/), bersama backfill histori & broker-flow
> screening lintas universe.

## Prinsip yang dipertahankan

1. **Reuse infra yang ada** — server/utils, `/api/*`, cache day-key WIB, snapshot
   store `.data-store/`, cron harian, komponen `StockSearch`, kartu `glow-card`.
2. **Tanpa native module** — store berbasis file (JSON) supaya deploy Mac→Linux
   tetap aman. (SQLite opsional bila butuh query SQL.)
3. **Jujur & berbasis bukti** — setiap sinyal/strategi ditampilkan apa adanya,
   selalu dibandingkan baseline (IHSG / random walk).
4. **Single-user** — tidak perlu auth kompleks; endpoint tulis cukup dilindungi
   token (seperti `/api/sync`).

## Peta modul baru (ringkas)

```
server/utils/                          server/api/                 app/pages/
  market.ts     breadth + rotasi         /api/market               /pasar
  relative.ts   RS vs IHSG               (masuk /api/analysis)     (di hub)
  fundamentals.ts  +growth/DER/margin    (extend)                  (kolom baru)
  portfolio.ts  P&L, korelasi, risiko    /api/portfolio            /portofolio
  store.ts      +watchlist/portfolio     /api/watchlist            /watchlist
  backtest.ts   engine simulasi          /api/backtest             /backtest
  alerts.ts     evaluasi rule            /api/alerts               /alert
  notify.ts     kirim Telegram           (dipanggil cron)
```

Perluasan `.data-store/`:
```
.data-store/
  screen-latest.json     (ada) snapshot screener harian
  watchlist.json         (T2)  daftar simbol pantauan
  portfolio.json         (T2)  holding: {symbol, lots, avgPrice, date}
  alerts.json            (T4)  rule alert + status terakhir
  bars/<SYMBOL>.json      (opsional) cache OHLCV utk reuse korelasi/backtest
```

---

## TIER 1 — Konteks Pasar & Fundamental Dalam

**Tujuan:** berhenti menganalisa saham di ruang hampa. Tahu regime pasar,
sektor pemimpin, dan kualitas (bukan sekadar "murah").

### 1a. Market Breadth + Rotasi Sektor

Data **sudah tersedia** di `screen-latest.json` (337 saham). Hanya perlu agregasi.

Prasyarat: setiap baris snapshot diberi **sektor**. Tambah di `sync.ts` —
`sector` dari peta statis (perluas label `STOCK_GROUPS`) atau dari Yahoo search.

```
server/utils/market.ts
  computeBreadth(rows): {
    aboveMA200Pct, aboveMA50Pct, avgRsi, advancers, decliners,
    newHigh52, newLow52, regime: 'risk-on'|'netral'|'risk-off'
  }
  computeSectorRotation(rows): [{ sector, count, avgScore, avgChangePct,
                                  aboveMA200Pct, medianRsi }]  // urut kekuatan
```

```
/api/market  (day-key cache) → baca snapshot → { breadth, sectors, date }
/pasar (page): gauge regime, bar % di atas MA200, heatmap sektor
               (hijau→merah by avgScore), tabel leader/laggard sektor.
```

Effort: **rendah** · Nilai: **tinggi** · Data baru: 0 (kecuali tag sektor).

### 1b. Relative Strength vs IHSG

RS = kinerja saham relatif indeks — indikator favorit pro ("beli yang kuat").

```
server/utils/relative.ts
  relativeStrength(stockCloses, ihsgCloses, windows=[21,63,126]): {
    rs1m, rs3m, rs6m,          // return saham − return IHSG (%)
    rsLine: number[],          // (stock/ihsg) dinormalisasi utk chart
    outperforming: boolean
  }
```

Integrasi: `/api/analysis` juga fetch IHSG (`^JKSE`, di-cache day-key) → tambah
blok RS di hub `/analisa/[symbol]`. Snapshot sync juga bisa simpan `rs3m` per
saham → kolom & filter "outperformer" di screening.

### 1c. Fundamental Lebih Dalam

`fetchFundamentals` sekarang hanya PER/PBV/ROE/DY. Yahoo `financialData` +
`defaultKeyStatistics` punya lebih:

```
Extend FundamentalsData:
  revenueGrowth, earningsGrowth (%)   // pertumbuhan
  debtToEquity (DER)                  // solvabilitas
  currentRatio                        // likuiditas
  profitMargins, operatingMargins (%) // profitabilitas
  pegRatio                            // valuasi vs pertumbuhan
  fairValueGraham = sqrt(22.5*eps*bvps)  // estimasi wajar sederhana
```

Dampak: screener **kualitas** — "murah + tumbuh + DER rendah", badge
undervalued (harga < Graham), kolom pertumbuhan. Semua masuk snapshot lewat sync.

Effort: **rendah-sedang** · Nilai: **tinggi**.

---

## TIER 2 — Watchlist & Portofolio Pribadi

**Tujuan:** dari "menganalisa" jadi "mengelola uang saya". Butuh **persistence**
(sudah mungkin via `.data-store/`).

### 2a. Watchlist

```
store.ts: getWatchlist(): string[] ; setWatchlist(codes)
/api/watchlist  GET → codes ; POST {code, action:add|remove}  (token tulis)
/watchlist (page): tabel ringkas skor+harga+RS tiap simbol (baca snapshot +
                   live utk yang di luar universe), tombol ⭐ di hub & screening.
```

### 2b. Portofolio

```
store.ts: getPortfolio(): Holding[] ; upsertHolding ; removeHolding
  Holding = { symbol, lots, avgPrice, date }

server/utils/portfolio.ts
  valuation(holdings, prices): per-posisi {nilai, PnL, PnL%} + total + alokasi%
  correlationMatrix(returnsBySymbol): Pearson antar-holding (deteksi konsentrasi)
  portfolioRisk(weights, returns): {
    volAnnual (EWMA), var95 (1-hari, parametrik), maxDrawdown, beta vs IHSG
  }
```

```
/api/portfolio  GET → valuasi+risiko ; POST/DELETE holding (token)
/portofolio (page):
  - ringkasan: nilai total, PnL, alokasi (donut per saham/sektor)
  - matriks korelasi (heatmap) — warning bila banyak pasangan korelasi >0.7
  - risiko: vol, VaR, max drawdown, beta
```

Catatan: file store cukup untuk single-user; tulis atomic (tmp+rename, sudah
dipakai di store.ts) agar aman.

Effort: **sedang** · Nilai: **tinggi (untuk pemakaian pribadi)**.

---

## TIER 3 — Backtest Strategi (Validasi)

**Tujuan:** buktikan skor/screener/musiman benar-benar bekerja — atau tunjukkan
mana yang noise. Meneruskan filosofi jujur di forecasting.

```
server/utils/backtest.ts
  backtest(signalFn, universe, history, opts): {
    equityCurve, totalReturn, cagr, winRate, avgHold,
    maxDrawdown, sharpe, sortino,
    vsBenchmark: { ihsgReturn, alpha }   // selalu banding buy&hold IHSG
  }
```

Aturan anti-cheat (wajib): **tanpa look-ahead** — sinyal di hari-t hanya pakai
data ≤ t; entry harga open t+1; biaya transaksi & slippage di-model.

Strategi awal yang diuji:
- **Technical score ≥ N** (rebalance mingguan/bulanan)
- **"Murah + Uptrend"** (PER≤15 & di atas MA200)
- **Sinyal musiman** (beli bulan dengan t-stat signifikan)

```
/api/backtest?strategy=score&threshold=70   (berat → cache day-key / precompute
                                              di cron sbagai job terpisah)
/backtest (page): kurva ekuitas vs IHSG, tabel metrik, daftar trade.
```

Effort: **sedang-tinggi** · Nilai: **tinggi (intelektual/rigor)**.
Reuse: disiplin walk-forward & metrik dari `forecast.ts`.

---

## TIER 4 — Alert & Otomasi

**Tujuan:** dapat notifikasi saat setup muncul, bukan cek manual. Numpang cron
harian yang sudah jalan.

```
store.ts: getAlerts(): AlertRule[] ; upsertAlert ; removeAlert
  AlertRule = { id, symbol|'*', type, params, lastTriggered }
  type: rsi_oversold | breakout | cross_ma200 | touch_support |
        score_above | price_below | murah_uptrend

server/utils/alerts.ts  evaluate(rules, snapshot): TriggeredAlert[]
server/utils/notify.ts  sendTelegram(text)   // Bot API, env TELEGRAM_*
```

Alur:
```
Cron 19:00 WIB → /api/sync (bangun snapshot)
              → /api/alerts/run (token): evaluate rules vs snapshot → notify
                (dedupe via lastTriggered agar tidak spam)
```

Channel: **Telegram Bot** (gratis, instan, pas personal). Secret via `.deploy.env`:
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` → di-inject ke PM2 seperti `SYNC_TOKEN`.

```
/api/alerts  CRUD (token) ; /alert (page): kelola rule + histori trigger.
```

Effort: **sedang** · Nilai: **tinggi (kenyamanan)**.

---

## Ringkasan Prioritas

| Tier | Fitur | Effort | Nilai | Data baru | Halaman |
|---|---|---|---|---|---|
| 1a | Breadth + rotasi sektor | Rendah | ★★★ | tag sektor | `/pasar` |
| 1b | Relative strength vs IHSG | Sedang | ★★☆ | IHSG (ada) | di hub |
| 1c | Fundamental dalam | Rendah-sedang | ★★★ | field Yahoo | screening |
| 2a | Watchlist | Rendah | ★★☆ | store file | `/watchlist` |
| 2b | Portofolio + korelasi + risiko | Sedang | ★★★ | store file | `/portofolio` |
| 3 | Backtest strategi | Sedang-tinggi | ★★★ | histori (ada) | `/backtest` |
| 4 | Alert Telegram | Sedang | ★★☆ | rule store | `/alert` |

**Urutan disarankan:** 1a → 1c → 2b → 3 → 4 (konteks & kualitas dulu, lalu
kelola uang, lalu validasi, lalu otomasi).

## Dampak ke infrastruktur

- **Tidak ada** dependency native baru; semua tetap pure-TS + file store.
- Cron harian bertambah 1 langkah (`/api/alerts/run` setelah sync).
- Store bertambah 3 file kecil (watchlist/portfolio/alerts).
- Secret baru (Tier 4): `TELEGRAM_*` di `.deploy.env` (gitignored).
- Pola caching (day-key) & no-store `/api/**` tetap berlaku untuk endpoint baca;
  endpoint tulis (watchlist/portfolio/alerts) tidak di-cache & butuh token.
