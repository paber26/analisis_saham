import { createError } from 'h3';
import { loadScreenSnapshot } from '../utils/store';
import { computeBreadth, computeSectorRotation, type Breadth, type SectorStat } from '../utils/market';

interface MarketResponse {
  date: string;
  generatedAt: string;
  total: number;
  breadth: Breadth;
  sectors: SectorStat[];
}

// Market context: breadth (regime) + sector rotation, aggregated from the daily
// screener snapshot. Reads the file store directly (fast); no-store plugin keeps
// it uncached at the edge, day freshness comes from the sync job.
export default defineEventHandler(async (): Promise<MarketResponse> => {
  const snap = await loadScreenSnapshot();
  if (!snap || !snap.rows.length) {
    throw createError({ statusCode: 503, statusMessage: 'Snapshot pasar belum tersedia. Jalankan sync harian dulu.' });
  }
  return {
    date: snap.date,
    generatedAt: snap.generatedAt,
    total: snap.count,
    breadth: computeBreadth(snap.rows),
    sectors: computeSectorRotation(snap.rows)
  };
});
