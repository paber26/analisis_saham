export type CompanyProfile = {
  name: string;
  tagline: string;
  about: string;
  vision: string;
  mission: string[];
  values: { title: string; description: string }[];
  products: { title: string; description: string; highlights: string[] }[];
  contacts: {
    website?: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  legalNote?: string;
};

export const companyProfile: CompanyProfile = {
  name: 'Saham IDX Portal',
  tagline: 'Platform analisis musiman & fundamental saham BEI.',
  about:
    'Saham IDX Portal membantu investor dan analis memantau pola musiman, mengulas kinerja historis, dan merangkum data keuangan agar proses screening dan riset saham lebih cepat, konsisten, dan terukur.',
  vision: 'Menjadi portal analisis saham Indonesia yang ringkas, transparan, dan mudah digunakan.',
  mission: [
    'Menyajikan visualisasi data yang jelas untuk membantu pengambilan keputusan berbasis data.',
    'Menyediakan ringkasan metrik kunci yang relevan untuk riset saham.',
    'Membangun pengalaman pengguna yang cepat, ringan, dan konsisten di berbagai perangkat.'
  ],
  values: [
    {
      title: 'Data-driven',
      description: 'Fokus pada metrik yang dapat diverifikasi dan mudah ditelusuri.'
    },
    {
      title: 'Clarity',
      description: 'Tampilan dan istilah dibuat ringkas agar cepat dipahami.'
    },
    {
      title: 'Iterative',
      description: 'Pengembangan bertahap berdasarkan kebutuhan pengguna dan umpan balik.'
    }
  ],
  products: [
    {
      title: 'Pola Musiman',
      description:
        'Analisis performa historis bulanan/kuartalan/tahunan untuk melihat kecenderungan return dan win-rate.',
      highlights: ['Filter rentang tahun', 'Perbandingan dengan IHSG', 'Insight otomatis']
    },
    {
      title: 'Detail Saham & Keuangan',
      description:
        'Ringkasan data fundamental dan keuangan untuk screening cepat dan evaluasi kinerja emiten.',
      highlights: ['Ringkasan metrik utama', 'Data yang mudah dibaca', 'Cocok untuk riset awal']
    }
  ],
  contacts: {
    website: '—',
    email: '—',
    phone: '—',
    address: '—'
  },
  legalNote:
    'Konten pada portal ini bersifat informatif dan bukan merupakan rekomendasi investasi. Silakan sesuaikan detail profil perusahaan di file app/data/companyProfile.ts.'
};

