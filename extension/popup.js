const $ = (id) => document.getElementById(id);
const yn = (b) => (b ? 'ya' : 'tidak');

function fmtDiag(d) {
  if (!d) return '';
  const L = [];
  L.push('Request exodus terlihat: <b>' + (d.exodusSeen ? 'ya' : 'BELUM') + '</b>');
  if (d.reqHeaders) {
    L.push('  · header Authorization: <b>' + yn(d.reqHeaders.includes('authorization')) +
      '</b>, Cookie: <b>' + yn(d.reqHeaders.includes('cookie')) + '</b>');
  }
  if (d.cookieCount != null) L.push('Cookie stockbit: ' + d.cookieCount + ' — ada JWT: <b>' + yn(d.cookieJwt) + '</b>');
  if (d.cookieErr) L.push('Cookie error: ' + d.cookieErr);
  if (d.local) L.push('localStorage: ' + d.local.count + ' key — JWT: <b>' + yn(d.local.found) + '</b>');
  if (d.session) L.push('sessionStorage: ' + d.session.count + ' key — JWT: <b>' + yn(d.session.found) + '</b>');
  if (d.lastSource) L.push('Sumber token: <b>' + d.lastSource + '</b>');
  if (d.at) L.push('(diperbarui ' + new Date(d.at).toLocaleTimeString('id-ID') + ')');
  return L.join('\n');
}

async function load() {
  const c = await chrome.storage.local.get(['server', 'secret', 'lastStatus', 'lastStatusAt', 'diag']);
  $('server').value = c.server || 'https://saham.kuydinas.id';
  $('secret').value = c.secret || '';
  if (c.lastStatus) {
    const when = c.lastStatusAt ? new Date(c.lastStatusAt).toLocaleString('id-ID') : '';
    $('status').innerHTML = c.lastStatus + '<div class="t">' + when + '</div>';
  } else {
    $('status').textContent = 'Belum ada aktivitas. Simpan secret lalu buka Stockbit.';
  }
  $('diag').innerHTML = fmtDiag(c.diag);
}

$('save').addEventListener('click', async () => {
  await chrome.storage.local.set({ server: $('server').value.trim(), secret: $('secret').value.trim() });
  $('status').textContent = '✓ Tersimpan. Buka stockbit.com lalu klik "Scan & kirim sekarang".';
});

$('scan').addEventListener('click', async () => {
  $('status').textContent = 'Memindai…';
  try { await chrome.runtime.sendMessage({ type: 'scan-now' }); } catch (e) { /* SW waking */ }
  setTimeout(load, 900);
});

load();
