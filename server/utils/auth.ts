import {
  getHeader, getQuery, getCookie, setCookie, deleteCookie, createError, type H3Event
} from 'h3';
import { createHmac, timingSafeEqual } from 'node:crypto';

// Single-user auth. A request is authorized if EITHER:
//   1) it carries a valid login SESSION cookie (set by /api/auth/login) — the
//      nice path: log in once with username+password and every gated call just
//      works, because the browser sends the cookie automatically; OR
//   2) it carries the legacy x-app-token header / ?token= (kept for backward
//      compatibility and simple scripts).
//
// The session cookie value is "<user>.<hmac>", signed with APP_SESSION_SECRET.
// It is httpOnly (JS can't read it) so it can't be stolen from the page.

const COOKIE = 'app_session';

function sessionSecret(): string {
  return (
    process.env.APP_SESSION_SECRET ||
    process.env.APP_PASSWORD ||
    'saham-dev-secret-change-me-please-32'
  );
}
function sign(user: string): string {
  return createHmac('sha256', sessionSecret()).update(user).digest('hex');
}
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

/** Issue the login session cookie (httpOnly). Call after verifying credentials. */
export function setSession(event: H3Event, user: string): void {
  // secure only when the edge served us over https (nginx sets x-forwarded-proto);
  // plain http on localhost during dev still works.
  const secure = getHeader(event, 'x-forwarded-proto') === 'https';
  setCookie(event, COOKIE, `${user}.${sign(user)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 60 * 60 * 24 * 30 // 30 days
  });
}

export function clearSession(event: H3Event): void {
  deleteCookie(event, COOKIE, { path: '/' });
}

/** The logged-in username from a valid session cookie, else null. */
export function getSessionUser(event: H3Event): string | null {
  const raw = getCookie(event, COOKIE);
  if (!raw) return null;
  const dot = raw.lastIndexOf('.');
  if (dot < 1) return null;
  const user = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  return safeEqual(sig, sign(user)) ? user : null;
}

// Gate for personal endpoints (watchlist/portfolio/bandar/learning): allow a
// valid login session OR the legacy token. Kept named requireAppToken so the
// existing call sites don't change — they now transparently accept a login too.
export function requireAppToken(event: H3Event): void {
  if (getSessionUser(event)) return; // logged in — done
  const expected = process.env.APP_TOKEN || 'saham-app';
  const provided =
    (getHeader(event, 'x-app-token') as string) || (getQuery(event).token as string) || '';
  if (!safeEqual(provided, expected)) {
    throw createError({ statusCode: 401, statusMessage: 'Silakan login dulu untuk mengakses fitur ini.' });
  }
}
