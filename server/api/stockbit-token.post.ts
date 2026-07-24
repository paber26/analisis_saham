import { readBody, getHeader, createError } from 'h3';
import { timingSafeEqual } from 'node:crypto';
import { saveStockbitToken } from '../utils/stockbit';

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  try {
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

// POST /api/stockbit-token  { token }   header: x-push-secret
// Receives the freshest Stockbit bearer token from the browser extension and
// stores it (so /api/bandar always uses a live token — no daily manual refresh).
// Gated by a shared STOCKBIT_PUSH_SECRET (NOT the login session, because the
// extension's cross-site background fetch can't carry the SameSite=Lax cookie).
export default defineEventHandler(async (event) => {
  const expected = process.env.STOCKBIT_PUSH_SECRET || '';
  if (!expected) {
    throw createError({ statusCode: 503, statusMessage: 'Push token belum dikonfigurasi (STOCKBIT_PUSH_SECRET kosong).' });
  }
  const provided = (getHeader(event, 'x-push-secret') as string) || '';
  if (!safeEqual(provided, expected)) {
    throw createError({ statusCode: 401, statusMessage: 'Secret salah.' });
  }

  const body = await readBody<{ token?: string }>(event);
  const token = (body?.token || '').trim();
  if (!/^(Bearer\s+)?eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(token)) {
    throw createError({ statusCode: 400, statusMessage: 'Token tidak berbentuk JWT yang valid.' });
  }

  const { updatedAt } = await saveStockbitToken(token);
  return { ok: true, updatedAt };
});
