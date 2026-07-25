import { defineEventHandler, getRouterParam, createError } from 'h3';
import { loadSession, deleteSession } from '../../../utils/simStore';

export default defineEventHandler(async (event): Promise<{ ok: true; id: string }> => {
  const id = getRouterParam(event, 'id') || '';
  const existing = await loadSession(id);
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'sesi tidak ditemukan' });
  await deleteSession(id);
  return { ok: true, id };
});
