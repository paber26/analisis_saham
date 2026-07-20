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

## Roadmap (belum dikerjakan, disengaja)

- **Tier 1.5**: SQLite + cron harian → universe ~900 emiten penuh, screener
  fundamental+teknikal gabungan, riwayat skor.
- **Tier 2**: microservice Python (statsmodels/LightGBM) untuk model lanjutan,
  training terjadwal, hasil disajikan via cache JSON.
- Watchlist/alert pribadi (butuh persistence — saat itulah database masuk).
