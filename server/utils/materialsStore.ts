import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { resolve, join } from 'node:path';

export interface MaterialItem {
  id: string;
  title: string;
  category: 'Dasar Pasar Modal' | 'Analisis Fundamental' | 'Analisis Teknikal' | 'Risk Management' | 'Catatan & Strategi';
  level: 'Dasar' | 'Menengah' | 'Lanjutan';
  summary: string;
  content: string;
  tags: string[];
  updatedAt: string;
  isCustom?: boolean;
}

const STORE_DIR = process.env.DATA_STORE_DIR || './.data-store';
const STORE_FILE = join(STORE_DIR, 'materials.json');

const INITIAL_MATERIALS: MaterialItem[] = [
  {
    id: 'intro-bei',
    title: '1. Pengenalan Pasar Modal & Mekanisme Perdagangan BEI',
    category: 'Dasar Pasar Modal',
    level: 'Dasar',
    summary: 'Memahami konsep saham, IHSG, fraksi harga, lot, dan jam perdagangan pasar saham Indonesia (BEI).',
    tags: ['BEI', 'Saham', 'Lot', 'Fraksi Harga', 'IHSG'],
    updatedAt: '2026-07-22',
    content: `### Apa itu Saham?
Saham adalah bukti kepemilikan nilai sebuah perusahaan. Ketika Anda membeli saham emiten di BEI (Bursa Efek Indonesia), Anda menjadi pemilik sebagian dari perusahaan tersebut.

### Satuan Perdagangan & Fraksi Harga BEI
- **1 Lot** = 100 lembar saham.
- **Fraksi Harga** (Aturan Perubahan Harga):
  - < Rp 200: Fraksi Rp 1
  - Rp 200 - Rp 500: Fraksi Rp 2
  - Rp 500 - Rp 2.000: Fraksi Rp 5
  - Rp 2.000 - Rp 5.000: Fraksi Rp 10
  - ≥ Rp 5.000: Fraksi Rp 25

### Sesi Perdagangan
- **Sesi I**: Senin - Kamis (09:00 - 12:00 WIB), Jumat (09:00 - 11:30 WIB)
- **Sesi II**: Senin - Kamis (13:30 - 15:49 WIB), Jumat (14:00 - 15:49 WIB)`
  },
  {
    id: 'fundamental-ratios',
    title: '2. Rasio Fundamental Utama: PER, PBV, ROE, DER, & DY',
    category: 'Analisis Fundamental',
    level: 'Dasar',
    summary: 'Cara membaca dan mengevaluasi kesehatan finansial serta valuasi emiten menggunakan 5 rasio emas.',
    tags: ['PER', 'PBV', 'ROE', 'DER', 'Valuasi'],
    updatedAt: '2026-07-22',
    content: `### 1. PER (Price to Earnings Ratio)
Rasio harga saham terhadap laba bersih per saham (EPS).
- **Rumus**: Price / EPS
- **Arti**: Berapa tahun modal investor kembali jika laba perusahaan konstan. PER rendah (< 10-15x) umumnya dianggap terjangkau.

### 2. PBV (Price to Book Value)
Rasio harga saham terhadap nilai ekuitas/buku per saham (BVPS).
- **Rumus**: Price / BVPS
- **Arti**: Mengukur apakah harga pasar di atas/bawah nilai aset bersih bersih emiten.

### 3. ROE (Return on Equity)
Tingkat efisiensi perusahaan dalam menghasilkan laba dari modal sendiri.
- **Rumus**: (Laba Bersih / Ekuitas) × 100%
- **Standar**: ROE > 15% secara konsisten menunjukkan emiten berkinerja unggul.

### 4. DER (Debt to Equity Ratio)
Rasio utang berbunga terhadap ekuitas modal.
- **Rumus**: Total Liabilitas Berbunga / Ekuitas
- **Batas Aman**: DER < 1.0 (utang tidak lebih besar dari modal sendiri).

### 5. Dividend Yield (DY)
Persentase dividen tunai tahunan dibanding harga saham saat ini.`
  },
  {
    id: 'candlestick-sr',
    title: '3. Dasar Analisis Teknikal: Candlestick, Trend, & S/R',
    category: 'Analisis Teknikal',
    level: 'Dasar',
    summary: 'Menguasai pola candlestick dasar, identifikasi arah trend (Uptrend/Downtrend), dan garis Support/Resistance.',
    tags: ['Candlestick', 'Support', 'Resistance', 'Uptrend', 'Teknikal'],
    updatedAt: '2026-07-22',
    content: `### Anatomi Candlestick
Tiap lilin (*candlestick*) merekam 4 harga dalam satu periode:
- **Open** (Harga Buka)
- **High** (Harga Tertinggi)
- **Low** (Harga Terendah)
- **Close** (Harga Tutup)

### Arah Trend (Market Trend)
1. **Uptrend**: Struktur *Higher High (HH)* dan *Higher Low (HL)*. Selalu utamakan posisi beli.
2. **Downtrend**: Struktur *Lower High (LH)* dan *Lower Low (LL)*. Hindari membeli saat downtrend.
3. **Sideways**: Pergerakan harga berkonsolidasi secara mendatar dalam area *range*.

### Support & Resistance
- **Support**: Area lantai di mana pembeli diprediksi masuk menahan penurunan harga.
- **Resistance**: Area atap di mana penjual diprediksi masuk menahan kenaikan harga.`
  },
  {
    id: 'money-management',
    title: '4. Money Management & Sizing Posisi (Rule 1-2%)',
    category: 'Risk Management',
    level: 'Menengah',
    summary: 'Cara menghitung berapa lot saham yang harus dibeli agar kerugian tidak melebihi 1-2% dari modal portofolio.',
    tags: ['Risk', 'Position Sizing', 'Money Management', 'Stop Loss'],
    updatedAt: '2026-07-22',
    content: `### Prinsip 1-2% Risk Per Trade
Jangan pernah meletakkan seluruh modal Anda dalam risiko. Batasi maksimal risiko kerugian per transaksi menjadi **1% hingga 2% dari total modal**.

### Formula Menghitung Jumlah Lot (Position Size)
1. **Modal Risiko (Rp)** = Total Modal × 1%
2. **Jarak Stop Loss per Lembar (Rp)** = Harga Entry - Harga Stop Loss
3. **Jumlah Lembar** = Modal Risiko / Jarak Stop Loss per Lembar
4. **Jumlah Lot** = Jumlah Lembar / 100

### Contoh Kasus
- Modal Portofolio: Rp 100.000.000
- Risiko 1%: Rp 1.000.000
- Buy Saham BBCA di Rp 10.000, Stop Loss di Rp 9.500 (Jarak SL = Rp 500)
- Jumlah Lembar = 1.000.000 / 500 = 2.000 lembar = **20 Lot**.`
  },
  {
    id: 'trading-journal',
    title: '5. Jurnal Catatan Strategi & Psikologi Trading',
    category: 'Catatan & Strategi',
    level: 'Lanjutan',
    summary: 'Pentingnya mencatat alur pertimbangan sebelum membeli saham untuk mengeliminasi bias emosi.',
    tags: ['Jurnal', 'Psikologi', 'Checklist', 'Disiplin'],
    updatedAt: '2026-07-22',
    content: `### Checklist Sebelum Transaksi
- [ ] Apakah emiten mematuhi tren utama (di atas MA200)?
- [ ] Berapa rasio Risk/Reward (Minimal 1:2)?
- [ ] Di mana titik Stop Loss pasti?
- [ ] Apakah posisi lot sudah dihitung sesuai aturan Risk 1%?

### Psikologi Pasar
- **FOMO (Fear of Missing Out)**: Membeli saat harga sudah melonjak tinggi tanpa rencana pasti.
- **Greed & Fear**: Selalu taati rencana awal yang ditulis sebelum transaksi dibuka.`
  }
];

function ensureDirectoryExists() {
  if (!existsSync(STORE_DIR)) {
    mkdirSync(STORE_DIR, { recursive: true });
  }
}

export function getMaterials(): MaterialItem[] {
  try {
    ensureDirectoryExists();
    if (!existsSync(STORE_FILE)) {
      writeFileSync(STORE_FILE, JSON.stringify(INITIAL_MATERIALS, null, 2), 'utf-8');
      return INITIAL_MATERIALS;
    }
    const raw = readFileSync(STORE_FILE, 'utf-8');
    const items = JSON.parse(raw) as MaterialItem[];
    return Array.isArray(items) && items.length > 0 ? items : INITIAL_MATERIALS;
  } catch (err) {
    console.error('Failed reading materials store:', err);
    return INITIAL_MATERIALS;
  }
}

export function saveMaterials(materials: MaterialItem[]): boolean {
  try {
    ensureDirectoryExists();
    const tempFile = `${STORE_FILE}.tmp.${Date.now()}`;
    writeFileSync(tempFile, JSON.stringify(materials, null, 2), 'utf-8');
    renameSync(tempFile, STORE_FILE);
    return true;
  } catch (err) {
    console.error('Failed saving materials store:', err);
    return false;
  }
}
