import { getHeader, getQuery, createError, type H3Event } from 'h3';

// Lightweight single-user gate for personal data (watchlist/portfolio).
// The token is supplied via the `x-app-token` header (or ?token=) and checked
// against APP_TOKEN. Not meant as real multi-user auth — just to keep the
// public site's personal data private and un-editable by strangers.
export function requireAppToken(event: H3Event): void {
  const expected = process.env.APP_TOKEN || 'saham-app';
  const provided = (getHeader(event, 'x-app-token') as string) || (getQuery(event).token as string) || '';
  if (provided !== expected) {
    throw createError({ statusCode: 401, statusMessage: 'Token akses salah atau belum dimasukkan.' });
  }
}
