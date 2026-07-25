import { defineEventHandler, readBody, createError } from 'h3';
import { saveSession, newSimId, loadSession, type SimSession } from '../../utils/simStore';

// Create or update a simulation session. The client builds the session (picks,
// decisions, and the locally-computed result) and posts it here to persist.
export default defineEventHandler(async (event): Promise<{ ok: true; id: string }> => {
  const body = await readBody<Partial<SimSession>>(event);
  if (!body || !Array.isArray(body.picks) || body.picks.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'picks wajib diisi' });
  }
  if (!body.startDate) {
    throw createError({ statusCode: 400, statusMessage: 'startDate wajib diisi' });
  }

  const id = body.id || newSimId();
  const existing = body.id ? await loadSession(body.id) : null;

  const session: SimSession = {
    id,
    createdAt: existing?.createdAt || body.createdAt || new Date().toISOString(),
    startDate: body.startDate,
    horizonDays: body.horizonDays ?? 20,
    decisionEveryDays: body.decisionEveryDays ?? 5,
    initialCapital: body.initialCapital ?? 0,
    picks: body.picks as SimSession['picks'],
    decisions: (body.decisions as SimSession['decisions']) || [],
    result: (body.result as SimSession['result']) ?? null,
    status: body.status || (body.result ? 'settled' : 'draft')
  };

  await saveSession(session);
  return { ok: true, id };
});
