# Arsitektur — Analisis Saham IDX

Aplikasi analisis saham personal (single-user) berbasis **Nuxt 4 SSR**. Semua
komputasi analitik berjalan di server (Nitro), data harga dari Yahoo Finance
(unofficial), maksimal 1 fetch per simbol per hari berkat cache disk ber-key
tanggal WIB.

## Diagram

```
┌─────────────────────────── Browser ────────────────────────────────┐
│  /screening (home)   /analisa/[symbol]   /forecast    /seasonal    │
│  /saham (chart)      /profil-saham                                 │
└───────────────────────────────┬────────────────────────────────────┘
                                │ useFetch (SSR + client)
┌────────────────────────── Nitro API ───────────────────────────────┐
│ /api/screen        skor teknikal semua universe (~170)             │
│ /api/analysis      teknikal + level S/R + rencana ATR (per saham)  │
│ /api/forecast      backtest walk-forward + proyeksi (per saham)    │
│ /api/forecast-screen batch scan seluruh snapshot: proyeksi>aktual  │
│ /api/seasonal      return bulanan 10y (per saham)                  │
│ /api/detail        OHLCV harian 1y + meta (chart)                  │
│ /api/fundamentals  PER/PBV/ROE/DY live (crumb auth)                │
│ /api/profile       profil emiten (crumb auth)                      │
│ /api/search        autocomplete seluruh emiten .JK                 │
│                                                                    │
│ server/utils/                                                      │
│  ├─ symbol.ts     normalisasi .JK/^JKSE, nama, header, crumb auth  │
│  ├─ yahoo.ts      fetch OHLCV harian (satu pintu, dipakai         │
│  │                screen/analysis/forecast)                        │
│  ├─ technical.ts  SMA/EMA/RSI/MACD/ADX/Stoch/BB/ATR + skor 0-100   │
│  │                + guard data flat/illikuid                       │
│  ├─ levels.ts     pivot klasik, swing S/R (klaster ATR),           │
│  │                fibonacci 52w, rencana trade 2×ATR stop          │
│  ├─ forecast.ts   v2 (lihat bawah)                                 │
│  ├─ universe.ts   ~170 saham likuid (LQ45/IDX80/Kompas100 + mid)   │
│  └─ cacheKey.ts   tradingDay() WIB + shortHash                     │
│                                                                    │
│ Cache: nitro fs driver → ./.cache (di luar .output, selamat        │
│ deploy). Key mengandung tanggal WIB → refresh otomatis ganti hari. │
└───────────────────────────────┬────────────────────────────────────┘
                                ▼
                     Yahoo Finance (unofficial API)
```

## Forecasting v2 (server/utils/forecast.ts)

Prinsip: **model pada log-return** (stasioner), evaluasi **walk-forward tanpa
look-ahead**, ketidakpastian dari **volatilitas terkini**, dan **jujur terhadap
baseline** (random walk sulit dikalahkan — sistem menampilkannya apa adanya).

Model (semua pure TypeScript):
- **Naive** — r̂=0 (harga besok = hari ini). Baseline wajib.
- **Drift** — r̂ = rata-rata return train.
- **AR(p)** — autoregresi pada return, orde p∈1..5 dipilih otomatis via AIC.
- **Holt** — double exponential smoothing pada harga (grid search α,β).
- **Regresi ridge** — fitur teknikal: lag return, momentum 5d, RSI, MACD-hist,
  jarak ke SMA10.
- **Ensemble** — rata-rata berbobot 1/RMSE² dari model yang mengalahkan naive
  pada window validasi (60 hari terakhir train). Jika tidak ada yang menang,
  ensemble = naive.

Evaluasi: **3 fold walk-forward** (3×60 hari terakhir; refit per fold; bobot
ensemble dihitung dari validasi di dalam train fold → bebas leakage). Metrik:
RMSE/MAE/MAPE harga + akurasi arah vs baseline mayoritas, plus **stabilitas
akurasi per fold**.

Ketidakpastian & probabilitas:
- σ harian dari **EWMA (λ=0.94)**; pita proyeksi = P₀·exp(Σμ̂ ± 1.2816·σ·√h) (~80%).
- **P(naik besok) = Φ(μ̂/σ)** — output probabilistik.
- Rezim volatilitas: σ sekarang vs median σ 1 tahun (rendah/normal/tinggi).

## Hub Analisa (/analisa/[symbol])

Menggabungkan semua sudut pandang dalam satu halaman:
1. Header harga + chip fundamental live (PER/PBV/ROE/DY)
2. Skor teknikal + grid indikator + sinyal
3. Level penting: pivot, support/resistance (klaster swing ber-ATR), fibonacci
4. Rencana trade ATR (entry/stop 2×ATR/target 3×ATR) + kalkulator ukuran
   posisi (modal, %risiko → lot)
5. Bias musiman bulan ini/depan (dengan n tahun & signifikansi t-stat)
6. Forecast ringkas (arah, probabilitas, rentang)
7. Kesimpulan otomatis (rule-based, jujur terhadap baseline)

## Batasan yang disadari

- Yahoo Finance tidak resmi: bisa berubah/rate-limit → mitigasi: cache harian,
  concurrency 12, crumb auth di-cache 30 menit.
- Harga harian ≈ random walk: forecasting diposisikan sebagai indikasi
  arah/rentang probabilistik, bukan target harga.
- Fundamental statis (stockFundamentals.ts) hanya fallback bila live kosong.

## Data pipeline harian (Tier 1.5)

- **/api/sync** (token) memindai seluruh `idxTickers.ts`, menghitung teknikal +
  fundamental tiap saham, lalu menulis snapshot `.data-store/screen-latest.json`
  (store berbasis file — tanpa native module, aman untuk deploy Mac→Linux).
- **/api/screen** memprioritaskan snapshot (instan, seluruh universe +
  fundamental); fallback ke live compute bila snapshot belum ada / list kustom.
- **Cron** (crontab server) memanggil `/api/sync` sekali/hari sore WIB.
- Screener gabungan: filter **"Murah + Uptrend"** (PER 0–15 & di atas MA200).
- Skala ke ~900: cukup tambah kode ke `idxTickers.ts` (invalid auto-skip).
- SQLite bisa menggantikan store file bila butuh query SQL ad-hoc (opsional).

### Faktor, risiko per-saham, histori & event study (baru)

- **Risiko per-saham** (`server/utils/risk.ts` → `/api/analysis`): volatilitas
  tahunan, VaR 95% harian, max drawdown 1th, beta vs IHSG + rating. Tampil di
  Hub Analisa.
- **Multi-faktor QVM** (`server/utils/factor.ts` → `/api/screen`): peringkat
  persentil lintas-universe Value(PER/PBV/DY)+Quality(ROE/DER/growth)+Momentum
  (RS/skor). Kolom QVM + sort + sinyal "QVM Top 20" di screening.
- **Histori harian** (`server/utils/history.ts`): `/api/sync` meng-append
  `.data-store/history/YYYY-MM-DD.json` (compact: close/score/rating/PER/RS/QVM)
  — fondasi tren & backtest fundamental lintas waktu. Akumulatif dari sync
  pertama; `/api/history?symbol` juga membackfill tren skor on-demand (recompute
  skor pada potongan historis, tanpa look-ahead) → sparkline di Hub.
- **Event study** (`server/utils/eventStudy.ts` → `/api/eventstudy`): distribusi
  return ke depan (5/10/20/60 hari) setelah sinyal (golden/ma200/rsi30/breakout)
  lintas universe likuid 5th, dibandingkan baseline (edge). Tanpa look-ahead.
  Tampil di halaman Backtest melengkapi engine kurva-ekuitas yang sudah ada.

## Roadmap berikutnya

Rancangan analisa lanjutan (konteks pasar, portofolio, backtest, alert)
didokumentasikan terpisah di **[ROADMAP.md](ROADMAP.md)** (Tier 1–4).

- **Tier 1.5+**: simpan histori OHLCV harian (SQLite/parquet) untuk kepemilikan
  data & fetch inkremental; riwayat skor harian.
- **Tier 2**: microservice Python (statsmodels/LightGBM) untuk model lanjutan,
  training terjadwal, hasil disajikan via cache JSON.
- Watchlist/alert pribadi (butuh persistence — saat itulah database masuk).

---

## Cetak Biru (Blueprint) Analisis Institusional — Perspective Wakil Manajer Investasi (WMI)

### 1. 3 Pilar Utama Pengelolaan Reksa Dana Saham
- **AUM Preservation (Proteksi Modal / Risk Control)**: Mencegah *major drawdown* saat pasar bearish, mengendalikan korelasi portofolio, VaR (Value at Risk 95%), dan likuiditas eksekusi.
- **Alpha Generation & Outperformance vs Benchmark**: Mengalahkan benchmark (IHSG / LQ45 / IDX80) secara konsisten menggunakan *Factor Investing* (Value, Quality, Momentum, Low Volatility).
- **AUM Growth & Investor Trust**: Konsistensi Risk-Adjusted Return (Sharpe Ratio, Sortino Ratio, Information Ratio) yang menarik inflows dana baru dari nasabah/distributor.

### 2. Arsitektur Analitis 5 Layer Institusional
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. LAYER ENTERPRISE DASHBOARD & DECISION SUPPORT (UI/UX)                   │
│   • Multi-Portfolio Dashboard (Core Equity Fund, Dividend Yield Fund)       │
│   • Risk & Drawdown Monitor  • Factor Exposure Matrix  • Rebalancing Suite  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ REST / SSR
┌──────────────────────────────────────┴──────────────────────────────────────┐
│ 2. LAYER ENGINE ANALITIK WMI (Nitro Server Engine)                          │
│                                                                             │
│  [A. Institutional Screener]     [B. Portfolio Construction]               │
│  • Filter ADV (> Rp 5M/hari)     • Max 10% Single Issuer Cap (OJK Rule)     │
│  • Multi-Factor Rating (QVM)     • Limit Sektor (Max 25-30%)               │
│                                  • Equal Risk Contribution / Risk Parity    │
│                                                                             │
│  [C. Risk & Stress Test Engine]  [D. Performance Attribution]              │
│  • Value at Risk (VaR 95%)       • Brinson Sector Attribution (Alloc/Select)│
│  • Correlation Matrix Heatmap    • Sharpe, Sortino, Information Ratio       │
│  • Days-to-Liquid (Likuiditas)   • Tracking Error vs IHSG / LQ45            │
│                                                                             │
│  [E. Market Breadth & TAA]       [F. Rebalancing Guardrail]                 │
│  • Market Regime (Risk-On/Off)   • Target vs Current Allocation Drift       │
│  • Cash Allocation Adjuster      • Rebalance Trigger Signal                 │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Async Pipeline / Cron Sync
┌──────────────────────────────────────┴──────────────────────────────────────┐
│ 3. LAYER DATA MANAGEMENT & TIME-SERIES STORE                                │
│  • Data Store Harian (.data-store/ / SQLite)                                │
│  • Benchmark Index Store (^JKSE, ^LQ45, IDX80)                             │
│  • Corporate Actions & Fundamentals Registry (PER, PBV, ROE, DER, FreeFloat)│
└──────────────────────────────────────┬──────────────────────────────────────┘
```

### 3. Modul WMI Utama
- **Institutional Screener**: Mandat likuiditas harian (ADV > Rp 5M/hari, Free Float > 15%) & Smart Beta Scoring (Quality, Value, Momentum).
- **Portfolio Guardrails**: Single Issuer Cap max 10% NAV, Limit Sektor max 25-30%, Dynamic Cash Buffer (0-20%).
- **Risk Management**: Parametric VaR (95%), Days-to-Liquid Stress Test, Correlation Matrix Heatmap (>0.75 warning).
- **Attribution & Benchmarking**: Brinson Sector Attribution (Allocation Effect & Selection Effect), Sharpe/Sortino/Information Ratio vs IHSG.

