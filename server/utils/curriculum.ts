// Curriculum definition for the guided learning module (/belajar).
//
// This is the *structure* of learning — ordered paths → modules → lessons.
// Lesson prose is NOT duplicated here: a lesson references an existing
// education material by `materialId` (see materialsStore.ts) so the two stay in
// sync. A lesson may instead carry inline `content` when it teaches one of the
// app's own tools (forecast/backtest) that has no standalone article.
//
// Each lesson optionally links to a real tool in the app (`practice`) so theory
// is immediately exercised on live BEI data — the core "learn by doing" idea —
// and optionally carries a short `quiz` checkpoint.

export interface QuizQuestion {
  q: string;
  options: string[];
  answer: number; // index of the correct option
  explain?: string;
}

export interface PracticeLink {
  label: string;
  to: string;   // route; "{symbol}" is replaced client-side with the last symbol
  hint: string;
}

export interface Lesson {
  id: string;             // stable, unique — the key used for progress tracking
  title: string;
  summary: string;
  minutes: number;        // estimated time
  materialId?: string;    // pull prose from materialsStore by this id
  content?: string;       // inline prose fallback (tool-literacy lessons)
  practice?: PracticeLink;
  quiz?: QuizQuestion[];
}

export interface LearningModule {
  id: string;
  title: string;
  icon: string;
  lessons: Lesson[];
}

export interface LearningPath {
  id: string;
  title: string;
  level: 'Pemula' | 'Menengah' | 'Lanjutan';
  goal: string;
  icon: string;
  accent: string;         // tailwind color token for the path (e.g. 'emerald')
  modules: LearningModule[];
}

export const CURRICULUM: LearningPath[] = [
  {
    id: 'pemula',
    title: 'Jalur Pemula — Fondasi Investor BEI',
    level: 'Pemula',
    goal: 'Dari nol memahami mekanisme bursa, cara menilai perusahaan, membaca grafik dasar, dan menjaga modal — siap membuka posisi pertama dengan sadar risiko.',
    icon: '🌱',
    accent: 'emerald',
    modules: [
      {
        id: 'pemula-pasar',
        title: 'Mengenal Pasar Modal',
        icon: '🏛️',
        lessons: [
          {
            id: 'l-intro-bei',
            materialId: 'intro-bei',
            title: 'Mekanisme Bursa: Lot, Fraksi, ARA/ARB & T+2',
            summary: 'Cara kerja BEI: satuan lot, fraksi harga, auto rejection, papan perdagangan, jam sesi, dan settlement.',
            minutes: 8,
            practice: {
              label: 'Buka Screening Saham',
              to: '/screening',
              hint: 'Lihat daftar emiten nyata BEI — perhatikan rentang harga & kelompoknya.',
            },
            quiz: [
              {
                q: '1 lot saham di BEI sama dengan berapa lembar?',
                options: ['10 lembar', '100 lembar', '500 lembar', '1.000 lembar'],
                answer: 1,
                explain: 'Sejak 2014, 1 lot = 100 lembar saham.',
              },
              {
                q: 'Settlement T+2 berarti hak dana/saham diselesaikan…',
                options: ['Hari yang sama', '1 hari kerja setelah transaksi', '2 hari kerja setelah transaksi', '2 minggu setelah transaksi'],
                answer: 2,
              },
              {
                q: 'Batas Auto Rejection untuk saham berharga di atas Rp 5.000 adalah…',
                options: ['35%', '25%', '20%', 'Tidak ada batas'],
                answer: 2,
                explain: 'Semakin tinggi harga, semakin kecil persen ARA/ARB: >Rp5.000 = 20%.',
              },
            ],
          },
        ],
      },
      {
        id: 'pemula-nilai',
        title: 'Menilai Perusahaan',
        icon: '💰',
        lessons: [
          {
            id: 'l-fundamental-ratios',
            materialId: 'fundamental-ratios',
            title: 'Rasio Fundamental: PER, PBV, ROE, DER, DY',
            summary: 'Lima rasio inti kesehatan emiten dan cara membaca valuasi murah/mahal.',
            minutes: 10,
            practice: {
              label: 'Lihat rasio live di Hub Analisa {symbol}',
              to: '/analisa/{symbol}',
              hint: 'Chip fundamental (PER/PBV/ROE/DY) di header adalah data live — bandingkan dengan teori.',
            },
            quiz: [
              {
                q: 'PER rendah (misal < 10x) umumnya menandakan…',
                options: ['Saham pasti mahal', 'Potensi undervalued atau bisnis sedang kontraksi', 'Perusahaan bangkrut', 'Dividen besar'],
                answer: 1,
              },
              {
                q: 'ROE > 15% konsisten menunjukkan…',
                options: ['Utang besar', 'Emiten berdaya saing tinggi (moat)', 'Harga saham murah', 'Likuiditas rendah'],
                answer: 1,
              },
            ],
          },
        ],
      },
      {
        id: 'pemula-grafik',
        title: 'Membaca Grafik',
        icon: '📈',
        lessons: [
          {
            id: 'l-candlestick-sr',
            materialId: 'candlestick-sr',
            title: 'Candlestick, Tren & Support/Resistance',
            summary: 'Anatomi candle, struktur tren (HH/HL), dan menentukan level S/R yang valid.',
            minutes: 10,
            practice: {
              label: 'Buka Chart {symbol}',
              to: '/saham?symbol={symbol}',
              hint: 'Cari pola candle & level support/resistance pada grafik harian sungguhan.',
            },
            quiz: [
              {
                q: 'Uptrend dikonfirmasi oleh pola…',
                options: ['Lower High & Lower Low', 'Higher High & Higher Low', 'Doji berulang', 'Volume nol'],
                answer: 1,
              },
              {
                q: 'Saat resistance ditembus (breakout), level itu cenderung berubah menjadi…',
                options: ['Resistance lebih kuat', 'Support baru (role reversal)', 'Tidak berpengaruh', 'Garis tren turun'],
                answer: 1,
              },
            ],
          },
        ],
      },
      {
        id: 'pemula-risiko',
        title: 'Menjaga Modal',
        icon: '🛡️',
        lessons: [
          {
            id: 'l-money-management',
            materialId: 'money-management',
            title: 'Money Management & Position Sizing',
            summary: 'Aturan risiko 1–2% per transaksi, menghitung lot dari stop loss, dan Risk-to-Reward.',
            minutes: 9,
            practice: {
              label: 'Coba kalkulator posisi di Hub Analisa {symbol}',
              to: '/analisa/{symbol}',
              hint: 'Bagian rencana trade ATR punya kalkulator ukuran posisi — masukkan modal & % risiko.',
            },
            quiz: [
              {
                q: 'Aturan umum kerugian maksimum per transaksi adalah…',
                options: ['1–2% dari total modal', '10% dari total modal', '50% dari total modal', 'Bebas tanpa batas'],
                answer: 0,
              },
              {
                q: 'Dengan RRR 1:2 dan win rate 40%, sistem trading secara matematis…',
                options: ['Pasti rugi', 'Tetap bisa profit konsisten', 'Impas selamanya', 'Tergantung berita'],
                answer: 1,
                explain: 'Expectancy = (0.4 × 2) − (0.6 × 1) = +0.2 → positif.',
              },
            ],
          },
        ],
      },
    ],
  },

  {
    id: 'menengah',
    title: 'Jalur Menengah — Analis Mandiri',
    level: 'Menengah',
    goal: 'Membaca laporan keuangan, memadukan indikator teknikal, memanfaatkan pola musiman, dan mengelola portofolio secara terukur.',
    icon: '📊',
    accent: 'sky',
    modules: [
      {
        id: 'menengah-lapkeu',
        title: 'Membedah Laporan Keuangan',
        icon: '🧾',
        lessons: [
          {
            id: 'l-financial-analysis',
            materialId: 'financial-analysis',
            title: 'Neraca, Laba Rugi, Cash Flow & Red Flags',
            summary: 'Tiga laporan utama, kualitas laba (CFO/Net Income), dan mendeteksi tanda bahaya.',
            minutes: 12,
            practice: {
              label: 'Buka Chart & Keuangan {symbol}',
              to: '/saham?symbol={symbol}',
              hint: 'Telaah data keuangan emiten — cek apakah laba disokong arus kas operasi.',
            },
            quiz: [
              {
                q: 'Rasio kualitas laba yang sehat adalah CFO / Laba Bersih…',
                options: ['< 0', '> 1,0', 'Selalu = 0,5', 'Tidak relevan'],
                answer: 1,
              },
            ],
          },
        ],
      },
      {
        id: 'menengah-indikator',
        title: 'Indikator & Momentum',
        icon: '📉',
        lessons: [
          {
            id: 'l-indicators',
            materialId: 'indicators-price-action',
            title: 'Moving Average, RSI, MACD & Smart Money',
            summary: 'EMA 20/50/200, RSI divergence, MACD histogram, plus dasar Order Block.',
            minutes: 11,
            practice: {
              label: 'Lihat grid indikator di Hub Analisa {symbol}',
              to: '/analisa/{symbol}',
              hint: 'Grid indikator menghitung RSI/MACD/ADX live — cocokkan sinyalnya dengan teori.',
            },
            quiz: [
              {
                q: 'Golden Cross terjadi saat…',
                options: ['EMA 50 memotong ke bawah EMA 200', 'EMA 50 memotong ke atas EMA 200', 'RSI menembus 70', 'Harga menyentuh support'],
                answer: 1,
              },
              {
                q: 'Bullish divergence: harga Lower Low sementara RSI…',
                options: ['Lower Low juga', 'Higher Low', 'Datar di 50', 'Overbought'],
                answer: 1,
              },
            ],
          },
        ],
      },
      {
        id: 'menengah-musiman',
        title: 'Pola Musiman',
        icon: '🗓️',
        lessons: [
          {
            id: 'l-seasonal',
            materialId: 'seasonal-anomalies',
            title: 'Seasonality & Anomali Pasar BEI',
            summary: 'Window dressing, January effect, musim dividen, Sell in May, siklus komoditas.',
            minutes: 9,
            practice: {
              label: 'Buka analisis Pola Musiman {symbol}',
              to: '/seasonal?symbol={symbol}',
              hint: 'Halaman ini menghitung return bulanan 10 tahun + signifikansi t-stat — bukti empiris seasonality.',
            },
          },
        ],
      },
      {
        id: 'menengah-portofolio',
        title: 'Mengelola Portofolio',
        icon: '💼',
        lessons: [
          {
            id: 'l-portfolio-literacy',
            title: 'Diversifikasi, Korelasi & Risiko Portofolio',
            summary: 'Membaca alokasi, korelasi antar-holding, dan metrik risiko (volatilitas, VaR, drawdown) pada portofolio nyata.',
            minutes: 8,
            content: `### Dari Satu Saham ke Portofolio
Menganalisa satu saham saja tidak cukup — yang menentukan kekayaan jangka panjang adalah **komposisi portofolio** secara keseluruhan.

### Tiga Ukuran Risiko Portofolio
1. **Alokasi (Weight)**: berapa persen modal di tiap saham/sektor. Konsentrasi berlebih = risiko sistemik.
2. **Korelasi**: bila banyak holding bergerak searah (korelasi > 0,7), diversifikasi Anda semu — turun bareng saat pasar jatuh.
3. **Volatilitas & VaR**: seberapa besar potensi kerugian harian pada tingkat keyakinan 95%; plus *max drawdown* historis.

### Aturan Praktis
- Maksimal **15–20%** modal per satu saham.
- Maksimal **~30%** per sektor.
- Sisakan **10–20%** kas untuk peluang saat koreksi.

> Aplikasi ini menghitung valuasi, matriks korelasi, dan risiko portofolio Anda secara otomatis di halaman Portofolio.`,
            practice: {
              label: 'Buka Portofolio saya',
              to: '/portofolio',
              hint: 'Masukkan holding untuk melihat alokasi, heatmap korelasi, volatilitas, VaR & drawdown dihitung otomatis.',
            },
            quiz: [
              {
                q: 'Dua holding dengan korelasi > 0,7 berarti diversifikasi Anda…',
                options: ['Sangat kuat', 'Semu — keduanya cenderung turun bersamaan', 'Tidak berisiko', 'Bebas pajak'],
                answer: 1,
              },
            ],
          },
        ],
      },
    ],
  },

  {
    id: 'lanjutan',
    title: 'Jalur Lanjutan — Strategi & Validasi',
    level: 'Lanjutan',
    goal: 'Melacak jejak smart money, memahami forecast probabilistik, memvalidasi strategi lewat backtest, dan berdisiplin dengan jurnal trading.',
    icon: '🎯',
    accent: 'violet',
    modules: [
      {
        id: 'lanjutan-bandar',
        title: 'Smart Money & Foreign Flow',
        icon: '🕵️',
        lessons: [
          {
            id: 'l-bandarmologi',
            materialId: 'bandarmologi-foreign',
            title: 'Bandarmologi & Aliran Dana Asing',
            summary: 'Membaca broker summary, siklus akumulasi–distribusi, dan korelasi foreign flow dengan IHSG.',
            minutes: 10,
            practice: {
              label: 'Buka halaman Pasar (Market Breadth)',
              to: '/pasar',
              hint: 'Amati regime pasar & rotasi sektor — konteks makro tempat smart money bergerak.',
            },
          },
        ],
      },
      {
        id: 'lanjutan-forecast',
        title: 'Forecast Probabilistik',
        icon: '🔮',
        lessons: [
          {
            id: 'l-forecast-literacy',
            title: 'Membaca Forecast dengan Jujur (Bukan Ramalan Pasti)',
            summary: 'Mengapa harga harian ≈ random walk, arti pita proyeksi ~80%, probabilitas arah, dan rezim volatilitas.',
            minutes: 9,
            content: `### Forecast ≠ Kepastian
Harga saham harian mendekati **random walk** — sangat sulit dikalahkan model apa pun. Karena itu forecast di aplikasi ini diposisikan sebagai **indikasi arah & rentang probabilistik**, bukan target harga pasti.

### Cara Membacanya
- **Pita proyeksi (~80%)**: rentang harga yang secara statistik menampung ~80% skenario, dihitung dari volatilitas terkini (EWMA). Pita lebar = ketidakpastian tinggi.
- **P(naik besok)**: peluang arah dari distribusi return — angka 55% berarti sedikit condong naik, bukan jaminan.
- **Rezim volatilitas**: membandingkan volatilitas sekarang vs median 1 tahun (rendah/normal/tinggi).
- **Selalu vs baseline**: model dibandingkan *naive/random walk*. Jika model tak mengalahkan baseline, sistem menampilkannya apa adanya — itu kejujuran, bukan kelemahan.

> Prinsip inti: percayai **proses & probabilitas**, bukan satu angka ajaib.`,
            practice: {
              label: 'Buka Forecast {symbol}',
              to: '/forecast?symbol={symbol}',
              hint: 'Perhatikan pita proyeksi, probabilitas arah, dan perbandingan model vs baseline naive.',
            },
            quiz: [
              {
                q: 'Pita proyeksi ~80% yang lebar menandakan…',
                options: ['Harga pasti naik', 'Ketidakpastian tinggi', 'Volatilitas nol', 'Sinyal jual'],
                answer: 1,
              },
              {
                q: 'Jika sebuah model tidak mengalahkan baseline naive, sistem sebaiknya…',
                options: ['Menyembunyikannya', 'Menampilkannya apa adanya (jujur)', 'Memaksa beli', 'Menghapus data'],
                answer: 1,
              },
            ],
          },
        ],
      },
      {
        id: 'lanjutan-backtest',
        title: 'Validasi Strategi',
        icon: '🧪',
        lessons: [
          {
            id: 'l-backtest-literacy',
            title: 'Backtest Tanpa Menipu Diri (Anti Look-Ahead)',
            summary: 'Mengapa strategi wajib diuji pada data historis, aturan anti look-ahead, dan metrik jujur vs buy & hold IHSG.',
            minutes: 10,
            content: `### Kenapa Backtest?
Keyakinan bukan bukti. Sebuah strategi (mis. "skor teknikal ≥ 70") harus **dibuktikan** pada data historis sebelum dipercaya — atau ditunjukkan bahwa ia sekadar *noise*.

### Aturan Wajib: Tanpa Look-Ahead
- Sinyal di hari-*t* hanya boleh memakai data **≤ t** (tidak mengintip masa depan).
- Entry dieksekusi di harga **open t+1**, bukan close hari sinyal.
- **Biaya transaksi & slippage** dimodelkan — tanpa ini hasil backtest terlalu indah.

### Metrik yang Jujur
- **CAGR, Win Rate, Max Drawdown, Sharpe/Sortino**.
- **Selalu dibandingkan buy & hold IHSG** → hitung *alpha*. Kalau strategi kalah dari sekadar memegang indeks, ia tidak layak.

> Filosofi yang sama dengan forecasting: walk-forward, jujur terhadap baseline.`,
            practice: {
              label: 'Buka Backtest Strategi',
              to: '/backtest',
              hint: 'Jalankan strategi & bandingkan kurva ekuitas vs IHSG — perhatikan drawdown dan alpha.',
            },
            quiz: [
              {
                q: 'Aturan anti look-ahead mengharuskan sinyal hari-t memakai data…',
                options: ['Sampai hari t saja (≤ t)', 'Termasuk hari esok', 'Seluruh masa depan', 'Acak'],
                answer: 0,
              },
            ],
          },
        ],
      },
      {
        id: 'lanjutan-jurnal',
        title: 'Disiplin & Psikologi',
        icon: '🧠',
        lessons: [
          {
            id: 'l-trading-journal',
            materialId: 'trading-journal',
            title: 'Jurnal Trading, Playbook & Kontrol Bias',
            summary: 'Membangun sistem (setup), mencatat jurnal transaksi, dan menaklukkan bias psikologi.',
            minutes: 9,
            practice: {
              label: 'Simpan playbook di Materi Edukasi',
              to: '/edukasi',
              hint: 'Gunakan fitur catatan pribadi untuk menulis checklist & jurnal trading Anda sendiri.',
            },
            quiz: [
              {
                q: 'Solusi terbaik melawan bias Loss Aversion (enggan cut loss) adalah…',
                options: ['Menambah posisi (average down) tanpa rencana', 'Memakai automatic stop loss order', 'Menutup aplikasi', 'Menunggu tanpa batas'],
                answer: 1,
              },
            ],
          },
        ],
      },
    ],
  },
];

// ---- Derived helpers (pure) ----

export function allLessons(): Lesson[] {
  return CURRICULUM.flatMap((p) => p.modules.flatMap((m) => m.lessons));
}

export function totalLessonCount(): number {
  return allLessons().length;
}

export function findLesson(lessonId: string): {
  path: LearningPath;
  module: LearningModule;
  lesson: Lesson;
} | null {
  for (const path of CURRICULUM) {
    for (const module of path.modules) {
      const lesson = module.lessons.find((l) => l.id === lessonId);
      if (lesson) return { path, module, lesson };
    }
  }
  return null;
}

// Flat ordered lesson ids for prev/next navigation.
export function orderedLessonIds(): string[] {
  return allLessons().map((l) => l.id);
}
