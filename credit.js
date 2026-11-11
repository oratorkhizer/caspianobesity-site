// The Caspian Studio credit, in one place.
//
// It used to be copied into the footer markup of every page, which meant a
// wording change was a nine-file edit. Now each page just loads this.
(function () {
  var host =
    document.querySelector("footer .copyright span") ||
    document.querySelector("footer .f span");
  if (!host || host.querySelector(".studio-credit")) return;

  var el = document.createElement("span");
  el.className = "studio-credit";
  el.style.cssText = "display:block;opacity:.72;font-size:.92em;margin-top:2px";
  el.innerHTML =
    'Made with love by <a href="https://caspianstudio.in" target="_blank" ' +
    'rel="noopener" style="color:inherit;text-decoration:underline">Caspian Studio</a>';
  host.appendChild(el);
})();


/* Diabetes Promise bar for World Diabetes Day 2026, added 11 Nov 2026 at Dr Khizer's request.
   It links to caspianfoundation.in/pledge, removes itself after 30 Nov 2026,
   and can be deleted from this file any time after that. */
(function () {
  try {
    if (new Date() > new Date('2026-12-01T00:00:00+05:30')) return;
    if (/\/pledge/.test(location.pathname)) return;
    try { if (localStorage.getItem('dp_bar_x')) return; } catch (e) {}
    var src = location.hostname.replace(/^www\./, '');
    var bar = document.createElement('div');
    bar.id = 'dp-bar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'World Diabetes Day');
    bar.style.cssText = 'position:relative;z-index:2147483000;background:#1d6b52;color:#fff;font:600 15px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:10px 46px 10px 16px;text-align:center';
    bar.innerHTML = 'World Diabetes Day, 14 Nov: <a href="https://caspianfoundation.in/pledge?utm_source=' + src + '&utm_medium=banner" style="color:#f2cc8f;text-decoration:underline">make your Diabetes Promise in one minute</a>' +
      '<button type="button" aria-label="Close" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:0;color:#fff;font-size:24px;line-height:1;cursor:pointer;padding:4px 8px">&times;</button>';
    bar.querySelector('button').onclick = function () {
      bar.remove();
      try { localStorage.setItem('dp_bar_x', '1'); } catch (e) {}
    };
    var add = function () { document.body.insertBefore(bar, document.body.firstChild); };
    if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
  } catch (e) {}
})();
