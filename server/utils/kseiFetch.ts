// Download KSEI month-end ownership files (public, one ZIP per month).
// Uses the global fetch so it also runs outside Nitro (scripts, tests).

import { unzipFirst } from './unzip';
import { parseBalancepos, monthEndCandidates, type OwnershipMonth } from './ksei';

const BASE = 'https://web.ksei.co.id/Download';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

async function tryFile(ymd: string): Promise<OwnershipMonth | null> {
  const res = await fetch(`${BASE}/BalanceposEfek${ymd}.zip`, { headers: { 'user-agent': UA } }).catch(() => null);
  if (!res || !res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 4 || buf.readUInt32LE(0) !== 0x04034b50) return null; // 404 pages come back as HTML
  const txt = unzipFirst(buf);
  return txt ? parseBalancepos(txt.toString('utf-8')) : null;
}

/** The month's file, trying the last weekdays of the month (holidays shift the date). */
export async function fetchKseiMonth(year: number, month: number): Promise<OwnershipMonth | null> {
  for (const ymd of monthEndCandidates(year, month)) {
    const m = await tryFile(ymd);
    if (m) return m;
  }
  return null;
}

/** Months (year, month) from `from` up to the last complete month before `now`. */
export function monthsUntil(from: { year: number; month: number }, now = new Date()): { year: number; month: number }[] {
  const out: { year: number; month: number }[] = [];
  let y = from.year;
  let m = from.month;
  const endY = now.getUTCFullYear();
  const endM = now.getUTCMonth() + 1; // current month is not complete yet
  while (y < endY || (y === endY && m < endM)) {
    out.push({ year: y, month: m });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}
