// Broad IDX ticker list for the daily sync job. The screener infra scales to
// the full ~900 emiten — drop more codes here and they are picked up on the
// next sync. Invalid/illiquid tickers are skipped automatically (Yahoo returns
// nothing, or the data-quality guard drops flat series).
//
// Seeded from the curated liquid universe + a wide set of additional real IDX
// codes across every sector.

import { SCREENING_UNIVERSE } from './universe';

const EXTRA: string[] = [
  // Perbankan & multifinance
  'BBYB', 'BGTG', 'BSIM', 'SDRA', 'BVIC', 'BNBA', 'INPC', 'BMAS', 'ADMF', 'CFIN',
  'PNBS', 'NOBU', 'BEKS', 'BKSW', 'MASB', 'BABP', 'AGRS', 'BBSI', 'DNAR', 'AMOR',
  // Energi & migas
  'MBAP', 'ITMA', 'KKGI', 'MYOH', 'SGER', 'FIRE', 'BIPI', 'HITS', 'SOCI', 'LEAD',
  'RUIS', 'ARII', 'MTFN', 'WOWS', 'SICO', 'CGAS', 'PSSI', 'BULL',
  // Logam & pertambangan lain
  'CITA', 'DKFT', 'ISSP', 'GDST', 'ALKA', 'SMMT', 'PICO', 'BAJA', 'NIKL', 'IRSX',
  // Barang baku & kimia
  'AGII', 'INCI', 'ADMG', 'IGAR', 'IPOL', 'TALF', 'SIPD', 'PBID', 'EKAD', 'SRSN',
  'ETWA', 'FPNI', 'LTLS', 'SULI',
  // Konsumer & makanan-minuman
  'CEKA', 'SKLT', 'PSDN', 'BUDI', 'CAMP', 'HOKI', 'KEJU', 'TCID', 'KINO', 'MBTO',
  'DMND', 'FOOD', 'ALTO', 'COCO', 'TAYS', 'PCAR', 'ITIC', 'MRAT', 'CINT',
  // Ritel & perdagangan
  'RANC', 'MPMX', 'TURI', 'CSAP', 'ECII', 'MKNT', 'SONA', 'HERO', 'SDPC', 'ZONE',
  'CARS', 'DAYA', 'KOIN', 'BOGA',
  // Properti & konstruksi
  'BEST', 'GPRA', 'RDTX', 'PPRO', 'LPCK', 'BKSL', 'MDLN', 'DUTI', 'JRPT', 'MMLP',
  'MKPI', 'NRCA', 'TOTL', 'DGIK', 'WEGE', 'RODA', 'GWSA', 'PLIN', 'INPP', 'ACST',
  'PPRE', 'IDPR', 'SMDM', 'BAPA', 'TARA', 'KOTA',
  // Infrastruktur & transportasi
  'CMNP', 'IPCC', 'CASS', 'WEHA', 'NELY', 'SAPX', 'PTIS', 'GIAA', 'IPCM', 'PORT',
  'BPTR', 'TAXI', 'AKSI',
  // Telko, teknologi & media
  'FREN', 'LINK', 'IBST', 'EDGE', 'TFAS', 'WIRG', 'MCAS', 'NFCX', 'KIOS', 'AXIO',
  'ATIC', 'GHON', 'CENT', 'JAST', 'DATA', 'LUCK', 'HDIT', 'PTSN', 'VIVA', 'BHIT',
  'BMTR', 'MLPL', 'POOL', 'ELPI',
  // Kesehatan & farmasi
  'PEHA', 'PYFA', 'MERK', 'SCPI', 'IRRA', 'DGNS', 'PRAY', 'CARE', 'SAME', 'LABS',
  // Agri & perkebunan
  'SGRO', 'BWPT', 'ANJT', 'SIMP', 'SMAR', 'MAGP', 'DSFI', 'GZCO', 'JAWA', 'PALM',
  // Aneka industri & otomotif
  'GDYR', 'INDS', 'NIPS', 'PRAS', 'BOLT', 'LPIN', 'MASA', 'BRAM'
];

export const IDX_TICKERS: string[] = Array.from(
  new Set([...SCREENING_UNIVERSE, ...EXTRA].map((s) => s.toUpperCase()))
);
