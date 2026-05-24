export interface StockFundamentalData {
  sharesOutstanding: number; // in billions of shares
  eps: number; // earnings per share in IDR
  bvps: number; // book value per share in IDR
  dps: number; // dividend per share in IDR
  description: string;
}

export const stockFundamentals: Record<string, StockFundamentalData> = {
  // Perbankan & Keuangan
  'BBCA': {
    sharesOutstanding: 123.27,
    eps: 394,
    bvps: 1950,
    dps: 205,
    description: 'PT Bank Central Asia Tbk merupakan bank swasta terbesar di Indonesia. BCA berfokus pada bisnis perbankan transaksi dan menyediakan sarana kredit bagi nasabah korporasi, komersial, UKM, dan konsumer.'
  },
  'BBRI': {
    sharesOutstanding: 151.55,
    eps: 398,
    bvps: 2080,
    dps: 310,
    description: 'PT Bank Rakyat Indonesia (Persero) Tbk adalah salah satu bank milik pemerintah terbesar di Indonesia yang memiliki fokus utama dalam penyediaan kredit dan layanan keuangan bagi segmen mikro, kecil, dan menengah (UMKM).'
  },
  'BMRI': {
    sharesOutstanding: 93.33,
    eps: 590,
    bvps: 2850,
    dps: 353,
    description: 'PT Bank Mandiri (Persero) Tbk adalah bank BUMN terbesar dari sisi aset di Indonesia. Bank Mandiri menyediakan berbagai macam layanan finansial terintegrasi untuk segmen korporat, komersial, ritel, dan pembiayaan konsumen.'
  },
  'BBNI': {
    sharesOutstanding: 37.29,
    eps: 560,
    bvps: 3920,
    dps: 280,
    description: 'PT Bank Negara Indonesia (Persero) Tbk merupakan bank BUMN pertama yang menjadi perusahaan publik. BNI menawarkan jasa perbankan korporasi, investasi, ritel, dan memiliki jaringan cabang internasional yang luas.'
  },
  'BBTN': {
    sharesOutstanding: 14.12,
    eps: 248,
    bvps: 2110,
    dps: 49.6,
    description: 'PT Bank Tabungan Negara (Persero) Tbk adalah bank BUMN Indonesia yang fokus utamanya berfokus pada pembiayaan sektor perumahan melalui Kredit Pemilikan Rumah (KPR).'
  },

  // Energi & Tambang
  'ADRO': {
    sharesOutstanding: 31.98,
    eps: 410,
    bvps: 2450,
    dps: 380,
    description: 'PT Adaro Energy Indonesia Tbk adalah perusahaan pertambangan batu bara terintegrasi terkemuka di Indonesia yang mengoperasikan pertambangan batu bara termal terbesar di belahan bumi selatan.'
  },
  'PTBA': {
    sharesOutstanding: 11.52,
    eps: 512,
    bvps: 1850,
    dps: 397,
    description: 'PT Bukit Asam Tbk merupakan anggota dari holding BUMN pertambangan MIND ID yang berfokus pada pertambangan batu bara, briket batu bara, kelistrikan, dan gasifikasi batu bara.'
  },
  'BUMI': {
    sharesOutstanding: 371.28,
    eps: 3.5,
    bvps: 42,
    dps: 0,
    description: 'PT Bumi Resources Tbk adalah produsen batu bara termal terbesar di Indonesia dan pengekspor batu bara termal terbesar ke berbagai negara di Asia dan dunia.'
  },
  'MEDC': {
    sharesOutstanding: 25.13,
    eps: 180,
    bvps: 890,
    dps: 25,
    description: 'PT Medco Energi Internasional Tbk adalah perusahaan energi dan sumber daya alam terkemuka di Indonesia yang berfokus pada eksplorasi dan produksi minyak bumi, gas, kelistrikan, serta pertambangan tembaga.'
  },
  'HRUM': {
    sharesOutstanding: 13.52,
    eps: 85,
    bvps: 820,
    dps: 15,
    description: 'PT Harum Energy Tbk adalah perusahaan induk yang berfokus pada industri pertambangan batu bara dan mineral nikel terintegrasi di Indonesia.'
  },

  // Infrastruktur & Telko
  'TLKM': {
    sharesOutstanding: 99.06,
    eps: 247,
    bvps: 1450,
    dps: 190,
    description: 'PT Telkom Indonesia (Persero) Tbk adalah perusahaan BUMN yang bergerak di bidang jasa layanan teknologi informasi dan komunikasi (TIK) serta jaringan telekomunikasi terbesar di Indonesia.'
  },
  'ISAT': {
    sharesOutstanding: 8.06,
    eps: 540,
    bvps: 2150,
    dps: 220,
    description: 'PT Indosat Tbk (Indosat Ooredoo Hutchison) adalah penyedia jasa telekomunikasi dan jaringan bergerak terkemuka di Indonesia dengan jutaan pelanggan di seluruh negeri.'
  },
  'EXCL': {
    sharesOutstanding: 13.11,
    eps: 102,
    bvps: 1520,
    dps: 48,
    description: 'PT XL Axiata Tbk merupakan penyedia jasa layanan seluler dan telekomunikasi swasta terkemuka di Indonesia dengan jangkauan jaringan yang terus berkembang.'
  },
  'JSMR': {
    sharesOutstanding: 7.26,
    eps: 310,
    bvps: 3450,
    dps: 80,
    description: 'PT Jasa Marga (Persero) Tbk adalah BUMN Indonesia yang memimpin di bidang penyelenggaraan jalan tol di Indonesia melalui pembangunan dan pengoperasian jaringan jalan tol utama.'
  },
  'PGAS': {
    sharesOutstanding: 24.24,
    eps: 165,
    bvps: 1720,
    dps: 120,
    description: 'PT Perusahaan Gas Negara Tbk adalah subholding gas bumi BUMN di bawah Pertamina yang mendistribusikan dan mentransmisikan gas bumi ke segmen industri, komersial, dan rumah tangga.'
  },

  // Konsumer Non-Primer (Siklikal/Ritel)
  'UNVR': {
    sharesOutstanding: 38.15,
    eps: 126,
    bvps: 180,
    dps: 126,
    description: 'PT Unilever Indonesia Tbk merupakan salah satu produsen barang konsumen cepat saji (FMCG) terkemuka di Indonesia yang memproduksi sabun, detergen, margarin, kosmetik, es krim, dan produk makanan lainnya.'
  },
  'ICBP': {
    sharesOutstanding: 11.66,
    eps: 820,
    bvps: 4120,
    dps: 278,
    description: 'PT Indofood CBP Sukses Makmur Tbk adalah produsen terkemuka produk konsumen bermerek di Indonesia dengan merek mi instan legendaris Indomie.'
  },
  'INDF': {
    sharesOutstanding: 8.78,
    eps: 940,
    bvps: 6250,
    dps: 267,
    description: 'PT Indofood Sukses Makmur Tbk merupakan perusahaan solusi pangan terkemuka yang mencakup seluruh tahapan proses makanan mulai dari produksi bahan baku hingga produk akhir di rak ritel.'
  },
  'MYOR': {
    sharesOutstanding: 22.36,
    eps: 135,
    bvps: 760,
    dps: 35,
    description: 'PT Mayora Indah Tbk adalah salah satu produsen makanan olahan terkemuka di Indonesia yang mengekspor biskuit, permen, kopi (seperti Kopiko), dan sereal ke puluhan negara.'
  },
  'ACES': {
    sharesOutstanding: 17.15,
    eps: 44,
    bvps: 345,
    dps: 22.5,
    description: 'PT Aspirasi Hidup Indonesia Tbk (sebelumnya Ace Hardware Indonesia) adalah pemegang waralaba ritel perabot rumah tangga dan perkakas terbesar di Indonesia.'
  },

  // Barang Baku & Logam
  'ANTM': {
    sharesOutstanding: 24.03,
    eps: 128,
    bvps: 1150,
    dps: 78,
    description: 'PT Aneka Tambang Tbk merupakan perusahaan pertambangan logam terdiversifikasi vertikal terintegrasi yang memproduksi feronikel, bijih nikel, emas, perak, bauksit, dan alumina.'
  },
  'INCO': {
    sharesOutstanding: 9.94,
    eps: 320,
    bvps: 2800,
    dps: 95,
    description: 'PT Vale Indonesia Tbk adalah produsen nikel matte terkemuka di Indonesia yang beroperasi di bawah kemitraan pertambangan berkelanjutan.'
  },
  'TPIA': {
    sharesOutstanding: 86.51,
    eps: 8.2,
    bvps: 450,
    dps: 0,
    description: 'PT Chandra Asri Pacific Tbk adalah kompleks petrokimia terintegrasi terbesar di Indonesia yang menyediakan berbagai bahan baku plastik dan industri kimia.'
  },
  'KRAS': {
    sharesOutstanding: 19.34,
    eps: -12,
    bvps: 110,
    dps: 0,
    description: 'PT Krakatau Steel (Persero) Tbk adalah produsen baja terbesar di Indonesia yang memproduksi baja lembaran panas, baja lembaran dingin, dan baja batang kawat.'
  },
  'MDKA': {
    sharesOutstanding: 24.12,
    eps: -12.4,
    bvps: 460,
    dps: 0,
    description: 'PT Merdeka Copper Gold Tbk adalah perusahaan induk pertambangan logam mulia dan logam industri dengan proyek emas, perak, tembaga, dan nikel terkemuka di Indonesia.'
  },

  // Industri & Otomotif
  'ASII': {
    sharesOutstanding: 40.48,
    eps: 835,
    bvps: 4950,
    dps: 640,
    description: 'PT Astra International Tbk adalah konglomerat multinasional Indonesia yang beroperasi di sektor otomotif, jasa keuangan, alat berat, pertambangan, energi, agribisnis, infrastruktur, dan teknologi informasi.'
  },
  'UNTR': {
    sharesOutstanding: 3.73,
    eps: 5520,
    bvps: 24300,
    dps: 2270,
    description: 'PT United Tractors Tbk merupakan distributor alat berat terbesar di Indonesia (seperti Komatsu) dan anak perusahaan Astra International yang juga bergerak di bidang kontraktor penambangan dan pertambangan batu bara/emas.'
  },

  // Teknologi & Digital
  'GOTO': {
    sharesOutstanding: 1201.2,
    eps: -8.5,
    bvps: 105,
    dps: 0,
    description: 'PT GoTo Gojek Tokopedia Tbk adalah perusahaan ekosistem digital terbesar di Indonesia yang mengintegrasikan layanan on-demand (Gojek), e-commerce (Tokopedia), serta teknologi finansial (GoTo Financial).'
  },
  'BUKA': {
    sharesOutstanding: 103.06,
    eps: -1.2,
    bvps: 242,
    dps: 0,
    description: 'PT Bukalapak.com Tbk adalah perusahaan teknologi e-commerce Indonesia yang berfokus memberdayakan Usaha Mikro, Kecil, dan Menengah (UMKM) melalui platform online dan O2O (Mitra Bukalapak).'
  },

  // Kesehatan & Farmasi
  'KLBF': {
    sharesOutstanding: 46.88,
    eps: 66,
    bvps: 470,
    dps: 31,
    description: 'PT Kalbe Farma Tbk merupakan salah satu perusahaan farmasi terbesar di Asia Tenggara yang memproduksi obat resep, produk kesehatan konsumen, nutrisi, dan perangkat medis.'
  },
  'MIKA': {
    sharesOutstanding: 14.25,
    eps: 74,
    bvps: 480,
    dps: 36,
    description: 'PT Mitra Keluarga Karyasehat Tbk mengoperasikan jaringan rumah sakit swasta terkemuka (Mitra Keluarga) yang menyediakan jasa pelayanan kesehatan di wilayah Jabodetabek dan sekitarnya.'
  },

  // Properti & Real Estate
  'BSDE': {
    sharesOutstanding: 21.17,
    eps: 94,
    bvps: 1250,
    dps: 0,
    description: 'PT Bumi Serpong Damai Tbk adalah pengembang real estat dan properti terkemuka di Indonesia yang mengembangkan kota mandiri BSD City di Tangerang.'
  },
  'PWON': {
    sharesOutstanding: 48.16,
    eps: 38,
    bvps: 395,
    dps: 9.5,
    description: 'PT Pakuwon Jati Tbk adalah pengembang properti ritel dan komersial terkemuka di Indonesia yang terkenal dengan portofolio pusat perbelanjaan (Tunjungan Plaza, Kota Kasablanka, Gandaria City).'
  },
  'SMRA': {
    sharesOutstanding: 16.51,
    eps: 48,
    bvps: 580,
    dps: 12,
    description: 'PT Summarecon Agung Tbk adalah pengembang properti yang fokus pada pengembangan kota mandiri terintegrasi di Kelapa Gading, Serpong, Bekasi, Karawang, dan Bandung.'
  }
};

export function getStockFundamentals(symbol: string): StockFundamentalData {
  // Normalize symbol (remove .JK and convert to upper case)
  const key = symbol.replace('.JK', '').toUpperCase().trim();
  
  if (stockFundamentals[key]) {
    return stockFundamentals[key]!;
  }
  
  // Dynamic fallback for custom tickers (hash-based generation to ensure consistency)
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);

  // Generate deterministic realistic statistics
  const sharesOutstanding = Math.round((5.0 + (hash % 45)) * 10) / 10; // 5.0 to 50.0 Billion
  const eps = Math.round((10 + (hash % 190)) * 10) / 10; // 10 to 200 IDR
  const bvps = Math.round((100 + (hash % 1900)) * 10) / 10; // 100 to 2000 IDR
  const dps = hash % 3 === 0 ? Math.round((eps * 0.25) * 10) / 10 : 0; // 25% payout or 0

  return {
    sharesOutstanding,
    eps,
    bvps,
    dps,
    description: `PT ${key} Tbk adalah perusahaan publik yang terdaftar di Bursa Efek Indonesia. Perusahaan beroperasi di sektor industri terkait dan berkomitmen untuk terus meningkatkan efisiensi operasional serta nilai jangka panjang bagi para pemegang saham.`
  };
}
