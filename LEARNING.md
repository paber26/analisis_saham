# Arsitektur Modul Belajar Terpandu (`/belajar`)

Modul pembelajaran saham berjenjang dengan filosofi **Learn by Doing**: tiap
lesson menghubungkan *teori → praktik langsung di tool analisis nyata aplikasi
ini → kuis → progres tersimpan*. Ini pembeda utama dari sekadar perpustakaan
artikel (yang tetap tersedia di `/edukasi`).

Melengkapi [ARCHITECTURE.md](ARCHITECTURE.md) (kondisi app) &
[ROADMAP.md](ROADMAP.md) (Tier 1–4). Konsisten dengan prinsip yang sama:
**single-user, file-store, tanpa native module, jujur & berbasis bukti.**

## Diagram

```
┌──────────────────────────── Browser ────────────────────────────────┐
│ /belajar            ikhtisar jalur + progres + streak + kuis stats  │
│ /belajar/[lesson]   konten + CTA praktik + kuis interaktif + prev/next│
│ /edukasi            perpustakaan materi + catatan pribadi (existing) │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ useFetch (GET publik) · $fetch (POST token)
┌────────────────────────── Nitro API ─────────────────────────────────┐
│ /api/learning                                                        │
│   GET  → { paths (konten teresolusi), progress, stats }   (publik)   │
│   POST → complete | uncomplete | quiz | visit             (token)    │
│                                                                      │
│ server/utils/                                                        │
│  ├─ curriculum.ts     STRUKTUR: path → module → lesson (statis).     │
│  │                    Lesson menaut materi via materialId (reuse)    │
│  │                    atau content inline (tool-literacy) + practice │
│  │                    link + quiz. Helper: findLesson, orderedIds.   │
│  ├─ learningStore.ts  PERSISTENSI progres (BATAS STORAGE — satu-      │
│  │                    satunya penyentuh storage; getProgress/        │
│  │                    saveProgress + bumpStreak). Atomic tmp+rename. │
│  └─ materialsStore.ts (existing) sumber prosa materi.                │
└───────────────────────────────┬──────────────────────────────────────┘
                                ▼
                .data-store/learning-progress.json  (gitignored)
```

## Model data

**Kurikulum (statis, di kode)** — 3 jalur × 12 lesson:
- `pemula` (4): mekanisme BEI · rasio fundamental · candlestick/S&R · money management
- `menengah` (4): laporan keuangan · indikator (MA/RSI/MACD) · seasonality · portofolio
- `lanjutan` (4): bandarmologi · literasi forecast · literasi backtest · jurnal & psikologi

Tiap lesson: `materialId?` (pakai ulang prosa materi) **atau** `content` inline,
plus `practice` (deep-link ke tool: `/screening`, `/analisa/{symbol}`,
`/saham`, `/seasonal`, `/portofolio`, `/pasar`, `/forecast`, `/backtest`) dan
`quiz[]` opsional. `{symbol}` diganti last-symbol di klien.

**Progres (file-store)**:
```ts
LearningProgress = {
  completed: string[]                         // lesson ids
  quiz: Record<lessonId, {score,total,at}>
  lastLessonId: string | null                 // "Lanjutkan Belajar"
  streak: { count, lastDay }                  // hari beruntun (WIB)
  updatedAt: string | null
}
```

## Keputusan arsitektur

- **Storage: file-store, bukan MySQL.** App single-user; data progres sangat
  kecil. Konsisten dgn watchlist/portfolio → deploy Mac→Linux aman, tanpa DB
  server. Akses storage diisolasi di `learningStore.ts` sehingga migrasi ke
  **SQLite** (langkah pertama yang wajar bila kelak multi-user) hanya mengganti
  2 fungsi — API & halaman tak berubah.
- **Baca publik, tulis token-gated.** GET (kurikulum+progres) tanpa friksi;
  POST pakai `requireAppToken` (`x-app-token`), sama seperti watchlist/portfolio.
- **Reuse, bukan duplikasi.** Prosa lesson ditarik dari `materialsStore` via
  `materialId` → satu sumber kebenaran. Renderer markdown diekstrak ke
  composable `useMarkdown` (dipakai `/belajar` & `/edukasi`).
- **Jujur.** Lesson forecast/backtest mengajarkan baseline, anti look-ahead,
  dan pita probabilistik — meneruskan filosofi `forecast.ts`.

## Menambah konten

- **Lesson/jalur baru** → edit `CURRICULUM` di `server/utils/curriculum.ts`
  (dan tambahkan materinya di `materialsStore.ts` bila ingin prosa panjang).
- **Kuis** → tambahkan array `quiz` pada lesson (`answer` = index opsi benar).
- Tidak perlu perubahan API atau halaman.

## Ide lanjutan (belum dibangun)

- Sertifikat/badge saat jalur 100%, ekspor progres.
- Prasyarat antar-lesson (lock sampai lesson sebelumnya selesai).
- Kuis acak dari bank soal + spaced repetition.
- Migrasi ke SQLite saat multi-user (ganti `learningStore.ts` saja).
