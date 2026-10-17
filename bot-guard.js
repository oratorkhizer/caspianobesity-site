/* Invisible bot protection for the public forms (Cloudflare Turnstile + fill time).
   Usage:
     var g = CaspianGuard.attach(formOrContainer);
     g.take().then(function(token){ ... body.turnstile = token; body.ms = g.ms(); ... });
   take() waits up to 8 s for a token, hands it over once and resets the widget,
   so the next call gets a fresh token (tokens are single use). */
(function () {
  if (typeof window === "undefined") return;
  var SITEKEY = "0x4AAAAAAFZJWkXyld4s97kl";
  var MSG = "We could not confirm this was sent by a person. Please refresh the page and try again.";
  var loading = null;

  function load() {
    if (loading) return loading;
    loading = new Promise(function (resolve, reject) {
      if (window.turnstile) return resolve(window.turnstile);
      var s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      s.defer = true;
      s.onload = function () { window.turnstile ? resolve(window.turnstile) : reject(); };
      s.onerror = function () { reject(); };
      document.head.appendChild(s);
    });
    return loading;
  }

  function attach(container) {
    var g = { shown: Date.now(), token: "", id: null, failed: false };
    g.ms = function () { return Date.now() - g.shown; };
    g.reset = function () {
      g.token = "";
      try { if (window.turnstile && g.id != null) window.turnstile.reset(g.id); } catch (e) {}
    };
    g.getToken = function () {
      return new Promise(function (resolve) {
        var start = Date.now();
        (function poll() {
          if (g.token || g.failed || Date.now() - start > 8000) return resolve(g.token || "");
          setTimeout(poll, 200);
        })();
      });
    };
    g.take = function () {
      return g.getToken().then(function (t) { g.reset(); return t; });
    };
    if (!SITEKEY || !container) { g.failed = true; return g; }
    var el = document.createElement("div");
    container.appendChild(el);
    load().then(function (ts) {
      g.id = ts.render(el, {
        sitekey: SITEKEY,
        appearance: "interaction-only",
        callback: function (t) { g.token = t; },
        "expired-callback": function () { g.token = ""; },
        "error-callback": function () { g.token = ""; }
      });
    }).catch(function () { g.failed = true; });
    return g;
  }

  window.CaspianGuard = { attach: attach, MSG: MSG, SITEKEY: SITEKEY };
})();
