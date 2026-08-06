import { getMethod, readBody } from 'h3';
import { requireAppToken } from '../utils/auth';
import { getSkips, setSkips, loadScreenSnapshot } from '../utils/store';

// Personal "kurang menarik" list (token-gated). GET returns codes enriched with
// the latest snapshot rows; POST {code, action:add|remove} mutates.
export default defineEventHandler(async (event) => {
    requireAppToken(event);
    const method = getMethod(event);

    if (method === 'POST') {
        const body = await readBody<{ code?: string; action?: 'add' | 'remove' }>(event);
        const code = (body?.code || '').toUpperCase().replace('.JK', '').trim();
        let codes = await getSkips();
        if (code) {
            if (body?.action === 'remove') codes = codes.filter((c) => c !== code);
            else if (!codes.includes(code)) codes = [...codes, code];
            await setSkips(codes);
        }
        return { codes };
    }

    // GET
    const codes = await getSkips();
    const snap = await loadScreenSnapshot();
    const bySnap = new Map((snap?.rows || []).map((r) => [r.code, r]));
    const rows = codes.map((c) => bySnap.get(c)).filter(Boolean);
    return { codes, rows, date: snap?.date || null };
});