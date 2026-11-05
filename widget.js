/* HomeDecoBali AI-assistent — chatbubbel voor de Shopify-winkel.
   Gebruik (theme.liquid, vlak voor </body>):
   <script src="https://homedecobali.github.io/hdb-ai/widget.js" data-lang="{{ request.locale.iso_code }}" defer></script>
*/
(function () {
  if (window.__hdbAi) return; window.__hdbAi = true;
  var me = document.currentScript || document.querySelector('script[src*="hdb-ai/widget.js"]');
  var base = (me && me.src) ? me.src.replace(/widget\.js.*$/, '') : 'https://homedecobali.github.io/hdb-ai/';
  var raw = ((me && me.getAttribute('data-lang')) || document.documentElement.lang || 'es').toLowerCase();
  var lang = raw.indexOf('pt') === 0 ? 'pt' : raw.indexOf('en') === 0 ? 'en' : 'es';
  var label = { es: '¿Te ayudamos?', pt: 'Precisas de ajuda?', en: 'Need help?' }[lang];
  var order = new URLSearchParams(location.search).get('hdb_order') || '';

  var css = document.createElement('style');
  css.textContent =
    '.hdbai-btn{position:fixed;right:18px;bottom:18px;z-index:2147483000;display:flex;align-items:center;gap:8px;background:#3B2F24;color:#FAF6EF;border:1px solid #A4763F;border-radius:28px;padding:10px 16px 10px 10px;font:15px Georgia,"Times New Roman",serif;cursor:pointer;box-shadow:0 4px 14px rgba(59,47,36,.25)}' +
    '.hdbai-btn img{width:30px;height:30px;border-radius:50%;background:#3B2F24}' +
    '.hdbai-frame{position:fixed;right:18px;bottom:84px;z-index:2147483001;width:380px;height:600px;max-height:calc(100vh - 110px);border:1px solid #E2D6C2;border-radius:14px;box-shadow:0 10px 30px rgba(59,47,36,.3);background:#FAF6EF;display:none}' +
    '.hdbai-open .hdbai-frame{display:block}' +
    '@media(max-width:520px){.hdbai-frame{right:0;bottom:0;width:100vw;height:100%;max-height:none;border-radius:0}.hdbai-open .hdbai-btn{display:none}}';
  document.head.appendChild(css);

  var btn = document.createElement('button');
  btn.className = 'hdbai-btn'; btn.type = 'button'; btn.setAttribute('aria-label', label);
  btn.innerHTML = '<img alt="" src="https://res.cloudinary.com/dkujwmni2/image/upload/w_80,f_png/56582_wit_ihtwgi.png"><span>' + label + '</span>';
  var frame = null;
  function open() {
    if (!frame) {
      frame = document.createElement('iframe');
      frame.className = 'hdbai-frame'; frame.title = 'HomeDecoBali';
      frame.src = base + 'index.html?embed=1&lang=' + lang + (order ? '&order=' + encodeURIComponent(order) : '');
      document.body.appendChild(frame);
    }
    document.documentElement.classList.toggle('hdbai-open');
  }
  btn.onclick = open;
  window.addEventListener('message', function (e) { if (e.data && e.data.hdbAi === 'close') document.documentElement.classList.remove('hdbai-open'); });
  function mount() { document.body.appendChild(btn); if (order) open(); }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
