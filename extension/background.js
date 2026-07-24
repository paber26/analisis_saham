// Captures the Stockbit access token from wherever it lives (Authorization
// header, Cookie header, a stored cookie, or page localStorage) and POSTs it to
// your server when it changes. Also records a live DIAGNOSTIC (chrome.storage
// key "diag") that the popup shows, so we can see exactly where the token is.

const DEFAULT_SERVER = 'https://saham.kuydinas.id';
const JWT_RE = /(eyJ[\w-]+\.[\w-]+\.[\w-]+)/;
const log = (...a) => console.log('[TokenSync]', ...a);

async function setDiag(patch) {
  const cur = (await chrome.storage.local.get('diag')).diag || {};
  await chrome.storage.local.set({ diag: { ...cur, ...patch, at: new Date().toISOString() } });
}
async function setStatus(text) {
  await chrome.storage.local.set({ lastStatus: text, lastStatusAt: new Date().toISOString() });
}

// --- Sources 1 & 2: headers on exodus API calls (Authorization or Cookie) ---
chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    const headers = details.requestHeaders || [];
    const names = headers.map((h) => h.name.toLowerCase());
    setDiag({ exodusSeen: true, reqHeaders: names });

    for (const h of headers) {
      const n = h.name.toLowerCase();
      if (n === 'authorization' || n === 'x-authorization') {
        const m = JWT_RE.exec(h.value || '');
        if (m) { handleToken(m[1], 'auth-header'); return; }
      }
    }
    const cookieHeader = headers.find((h) => h.name.toLowerCase() === 'cookie');
    if (cookieHeader) {
      const m = JWT_RE.exec(cookieHeader.value || '');
      if (m) { handleToken(m[1], 'cookie-header'); return; }
    }
    scanCookies('exodus'); // fallback to the cookie jar
  },
  { urls: ['*://exodus.stockbit.com/*'] },
  ['requestHeaders', 'extraHeaders']
);

// --- Source 3: cookie jar (can read httpOnly) ---
async function scanCookies(trigger) {
  try {
    const cookies = await chrome.cookies.getAll({ domain: 'stockbit.com' });
    let hit = null;
    for (const c of cookies) {
      const m = JWT_RE.exec(decodeURIComponent(c.value || ''));
      if (m) { hit = { name: c.name, token: m[1] }; break; }
    }
    await setDiag({ cookieCount: cookies.length, cookieJwt: !!hit });
    if (hit) { handleToken(hit.token, 'cookie:' + hit.name); return true; }
    log('cookie scan (' + trigger + '):', cookies.length, 'cookies, no JWT');
  } catch (e) {
    await setDiag({ cookieErr: String((e && e.message) || e) });
    log('cookie scan error', e);
  }
  return false;
}

// --- Source 4: page storage (content.js) + popup "scan now" ---
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'page-token' && msg.token) {
    const m = JWT_RE.exec(msg.token);
    if (m) handleToken(m[1], 'storage');
  } else if (msg && msg.type === 'page-diag') {
    setDiag({ local: msg.local, session: msg.session });
  } else if (msg && msg.type === 'scan-now') {
    scanCookies('popup').then((ok) => sendResponse({ ok }));
    return true; // keep the message channel open for the async reply
  }
});

// --- Source 5: Background Periodic Alarm Sync ---
// Scans cookies every 30 minutes and silently refreshes/pushes token to server
// so user never has to manually open stockbit.com tab.
chrome.runtime.onInstalled?.addListener(() => {
  chrome.alarms.create('periodic-token-sync', { periodInMinutes: 30 });
});
chrome.alarms?.onAlarm.addListener((alarm) => {
  if (alarm && alarm.name === 'periodic-token-sync') {
    log('running background periodic token sync alarm...');
    scanCookies('alarm');
    fetch('https://stockbit.com/', { method: 'HEAD', mode: 'no-cors' }).catch(() => {});
  }
});

// --- Dedupe + push ---
async function handleToken(token, source) {
  const cfg = await chrome.storage.local.get(['lastToken', 'secret', 'server']);
  await setDiag({ lastSource: source, tokenFound: true });
  if (token === cfg.lastToken) { await setStatus('✓ Token sudah tersinkron (' + source + ')'); return; }

  const secret = (cfg.secret || '').trim();
  const server = (cfg.server || DEFAULT_SERVER).replace(/\/+$/, '');
  if (!secret) { await setStatus('⚠ Secret belum diisi — buka popup.'); return; }

  log('pushing token from', source);
  try {
    const res = await fetch(server + '/api/stockbit-token', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-push-secret': secret },
      body: JSON.stringify({ token })
    });
    if (res.ok) {
      await chrome.storage.local.set({ lastToken: token });
      await setStatus('✓ Token terkirim (' + source + ')');
    } else {
      await setStatus('✗ Gagal push (' + (res.status === 401 ? 'secret salah' : 'HTTP ' + res.status) + ')');
    }
  } catch (e) {
    await setStatus('✗ Error: ' + (String((e && e.message) || e)));
  }
}
