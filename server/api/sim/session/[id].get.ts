import { defineEventHandler, getRouterParam, createError } from 'h3';
import { loadSession } from '../../../utils/simStore';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') || '';
  const session = await loadSession(id);
  if (!session) throw createError({ statusCode: 404, statusMessage: 'sesi tidak ditemukan' });
  return session;
});
