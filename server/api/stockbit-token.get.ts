import { requireAppToken } from '../utils/auth';
import { stockbitTokenStatus } from '../utils/stockbit';

// GET /api/stockbit-token — owner-only status of the stored token (freshness +
// source), never the token itself. Lets the UI show "bandar token: fresh 2m ago".
export default defineEventHandler(async (event) => {
  requireAppToken(event);
  return await stockbitTokenStatus();
});
