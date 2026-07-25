import { defineEventHandler } from 'h3';
import { listSessions } from '../../utils/simStore';

export default defineEventHandler(async () => {
  const sessions = await listSessions();
  return { count: sessions.length, sessions };
});
