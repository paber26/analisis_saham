import { readBody, createError } from 'h3';
import { timingSafeEqual } from 'node:crypto';
import { setSession } from '../../utils/auth';

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

// POST /api/auth/login  { username, password }
// Verifies against APP_USERNAME / APP_PASSWORD (env) and, on success, sets the
// httpOnly session cookie so the browser is authenticated for all later calls.
export default defineEventHandler(async (event) => {
  const body = await readBody<{ username?: string; password?: string }>(event);
  const username = (body?.username || '').trim();
  const password = body?.password || '';

  const U = process.env.APP_USERNAME || 'admin';
  const P = process.env.APP_PASSWORD || '';
  if (!P) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Login belum dikonfigurasi di server (APP_PASSWORD kosong).'
    });
  }
  if (!safeEqual(username, U) || !safeEqual(password, P)) {
    throw createError({ statusCode: 401, statusMessage: 'Username atau password salah.' });
  }

  setSession(event, username);
  return { ok: true, user: username };
});
