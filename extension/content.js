// Runs inside stockbit.com pages. Reports what's in page storage (for the
// diagnostic panel) and hands any JWT found to the background service worker.
(function () {
  const RE = /(eyJ[\w-]+\.[\w-]+\.[\w-]+)/;

  function scan(store) {
    let count = 0;
    let token = null;
    try {
      count = store.length;
      for (let i = 0; i < store.length; i++) {
        const v = store.getItem(store.key(i)) || '';
        const m = RE.exec(v);
        if (m && !token) token = m[1];
      }
    } catch (e) {
      /* storage may be inaccessible in some frames */
    }
    return { count, token };
  }

  function report() {
    const l = scan(window.localStorage);
    const s = scan(window.sessionStorage);
    try {
      chrome.runtime.sendMessage({
        type: 'page-diag',
        local: { count: l.count, found: !!l.token },
        session: { count: s.count, found: !!s.token }
      });
      const token = l.token || s.token;
      if (token) chrome.runtime.sendMessage({ type: 'page-token', token });
    } catch (e) {
      /* extension context invalidated (e.g. just reloaded) */
    }
  }

  report();
  setTimeout(report, 2500); // after the app hydrates
  setInterval(report, 60000); // catch refreshes
})();
