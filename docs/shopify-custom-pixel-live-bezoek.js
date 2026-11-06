// HDB · Live bezoek — Shopify Custom Pixel (06-11-2026)
// Plaatsen: Shopify-admin → Instellingen → Klantevenementen → Aangepaste pixel toevoegen
//   Naam: "HDB Live bezoek" · Machtiging: Vereist · Categorie: Analyse (Analytics)
//   Gegevensverkoop: "Verzamelde gegevens kwalificeren niet als gegevensverkoop"
// Plak dit hele bestand in het codeveld → Opslaan → Verbinden.
//
// Stuurt per paginaweergave, ping (elke 15 s zolang het tabblad zichtbaar is) en
// winkelevent één klein bericht naar Supabase RPC web_track (alleen INSERT/UPDATE via
// SECURITY DEFINER; geen leesrechten). Geen IP, e-mail of naam — alleen Shopify's
// anonieme clientId (voor 'terugkerend'), pad, paginatitel, herkomst en apparaat.
// Eigen bezoek uitsluiten: open één keer https://homedecobali.es/?hdbnotrack=1
// (weer aanzetten: ?hdbnotrack=0). Dashboard: dash.homedecobali.com/kpi.html → zone LIVE BEZOEK.

const HDB_EP  = 'https://jucubuoftjehwancegma.supabase.co/rest/v1/rpc/web_track';
const HDB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Y3VidW9mdGplaHdhbmNlZ21hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2OTYwMDIsImV4cCI6MjA5ODI3MjAwMn0.gKYBE76kVv5XdMb-GuFAELdSp5R7OjCIiUzw7hW2Jus';
const HDB_BOT = /bot|crawl|spider|slurp|headless|lighthouse|pingdom|gtmetrix|facebookexternalhit|bingpreview|prerender/i;
const HDB_IDLE = 30 * 60 * 1000;   // nieuwe sessie na 30 min stilte
const HDB_PING = 15;               // seconden

let hdbCust = false, hdbPv = null, hdbAct = 0, hdbTimer = null, hdbQ = Promise.resolve();

try { const c = init && init.data && init.data.customer; hdbCust = !!(c && (c.id || (c.ordersCount || 0) > 0)); } catch (e) {}

function hdbId() {
  try { if (crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
  return (Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)).slice(0, 32);
}
function hdbSend(o) {
  return fetch(HDB_EP, {
    method: 'POST', keepalive: true,
    headers: { 'Content-Type': 'application/json', apikey: HDB_KEY, Authorization: 'Bearer ' + HDB_KEY },
    body: JSON.stringify({ p: o })
  }).catch(function () {});
}
// sessie {sid, vno, last} in de localStorage van de winkel; alles achter elkaar (queue) zodat
// gelijktijdige events niet twee sessies maken
function hdbSession(touchOnly) {
  hdbQ = hdbQ.then(async function () {
    const now = Date.now();
    let st = null, isNew = false;
    try { st = JSON.parse((await browser.localStorage.getItem('hdb_live')) || 'null'); } catch (e) { st = null; }
    if (!st || !st.sid || now - (st.last || 0) > HDB_IDLE) {
      if (touchOnly && st && st.sid) return { st: null };
      st = { sid: hdbId(), vno: ((st && st.vno) || 0) + 1, last: now }; isNew = true;
    }
    st.last = now;
    try { await browser.localStorage.setItem('hdb_live', JSON.stringify(st)); } catch (e) {}
    return { st: st, isNew: isNew };
  });
  return hdbQ;
}
async function hdbOptedOut(search) {
  try {
    const p = new URLSearchParams(search || '');
    if (p.get('hdbnotrack') === '1') await browser.localStorage.setItem('hdb_nt', '1');
    if (p.get('hdbnotrack') === '0') await browser.localStorage.removeItem('hdb_nt');
    return (await browser.localStorage.getItem('hdb_nt')) === '1';
  } catch (e) { return false; }
}
function hdbType(path) {
  const p = (path || '/').replace(/^\/(es|pt|pt-pt|en|en-[a-z]{2}|pt-[a-z]{2}|es-[a-z]{2})(?=\/|$)/i, '') || '/';
  if (p === '/' ) return 'home';
  if (/\/products\//.test(p)) return 'product';
  if (/^\/collections\b/.test(p)) return 'collection';
  if (/^\/search\b/.test(p)) return 'search';
  if (/^\/cart\b/.test(p)) return 'cart';
  if (/^\/checkouts?\b/.test(p) || /\/thank[_-]you/.test(p)) return 'checkout';
  if (/^\/blogs\b/.test(p)) return 'blog';
  if (/^\/pages\b/.test(p)) return 'page';
  if (/^\/account\b/.test(p)) return 'account';
  if (/^\/policies\b/.test(p)) return 'policy';
  return 'other';
}
function hdbVisible() {
  try { return typeof document === 'undefined' || document.visibilityState !== 'hidden'; } catch (e) { return true; }
}
function hdbStartPing(sid) {
  if (hdbTimer) clearInterval(hdbTimer);
  hdbTimer = setInterval(async function () {
    if (!hdbVisible() || !hdbPv) return;
    hdbAct += HDB_PING;
    const r = await hdbSession(true);
    if (!r.st) { clearInterval(hdbTimer); return; }
    hdbSend({ t: 'ping', sid: sid, pvid: hdbPv, act: hdbAct });
  }, HDB_PING * 1000);
  try {
    document.addEventListener('visibilitychange', function () {
      if (hdbVisible() && hdbPv) hdbSend({ t: 'ping', sid: sid, pvid: hdbPv, act: hdbAct });
    });
  } catch (e) {}
}

analytics.subscribe('page_viewed', async function (event) {
  try {
    const ctx = event.context || {}, doc = ctx.document || {}, loc = doc.location || {}, nav = ctx.navigator || {};
    if (HDB_BOT.test(nav.userAgent || '')) return;
    if (await hdbOptedOut(loc.search)) return;
    const r = await hdbSession(false), st = r.st;
    hdbPv = hdbId(); hdbAct = 0;
    const o = { t: 'pv', site: 'shop', sid: st.sid, cid: event.clientId || null, pvid: hdbPv,
      path: (loc.pathname || '/').slice(0, 300), title: (doc.title || '').slice(0, 200), pt: hdbType(loc.pathname), cust: hdbCust };
    if (r.isNew) {
      const q = new URLSearchParams(loc.search || '');
      let refh = '';
      try { refh = doc.referrer ? new URL(doc.referrer).hostname : ''; } catch (e) {}
      const w = (ctx.window && ctx.window.innerWidth) || 0;
      o.ref = (doc.referrer || '').split('?')[0].slice(0, 300);
      o.refh = refh;
      o.us = q.get('utm_source'); o.um = q.get('utm_medium'); o.uc = q.get('utm_campaign'); o.ux = q.get('utm_content');
      o.clk = q.get('gclid') ? 'gclid' : q.get('gbraid') ? 'gbraid' : q.get('wbraid') ? 'wbraid' : q.get('gad_source') ? 'gad'
            : q.get('fbclid') ? 'fbclid' : q.get('msclkid') ? 'msclkid' : null;
      try { o.tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) {}
      o.lang = nav.language || null;
      o.dev = w && w < 768 ? 'mobile' : w && w < 1100 ? 'tablet' : 'desktop';
      o.vno = st.vno; o.ret = st.vno > 1;
    }
    hdbSend(o);
    hdbStartPing(st.sid);
  } catch (e) {}
});

async function hdbEvent(kind, label, value) {
  try {
    if (await hdbOptedOut('')) return;
    const r = await hdbSession(true);
    if (!r.st) return;
    hdbSend({ t: 'ev', sid: r.st.sid, k: kind, l: label ? String(label).slice(0, 200) : null, v: value != null ? Number(value) : null });
  } catch (e) {}
}
analytics.subscribe('product_viewed', function (e) {
  const v = e.data && e.data.productVariant; hdbEvent('product_viewed', v && v.product && v.product.title, v && v.price && v.price.amount);
});
analytics.subscribe('collection_viewed', function (e) {
  hdbEvent('collection_viewed', e.data && e.data.collection && e.data.collection.title);
});
analytics.subscribe('search_submitted', function (e) {
  hdbEvent('search', e.data && e.data.searchResult && e.data.searchResult.query);
});
analytics.subscribe('product_added_to_cart', function (e) {
  const l = e.data && e.data.cartLine;
  hdbEvent('add_to_cart', l && l.merchandise && l.merchandise.product && l.merchandise.product.title, l && l.cost && l.cost.totalAmount && l.cost.totalAmount.amount);
});
analytics.subscribe('checkout_started', function (e) {
  const c = e.data && e.data.checkout; hdbEvent('checkout_started', null, c && c.totalPrice && c.totalPrice.amount);
});
analytics.subscribe('checkout_completed', function (e) {
  const c = e.data && e.data.checkout; hdbEvent('checkout_completed', null, c && c.totalPrice && c.totalPrice.amount);
});
