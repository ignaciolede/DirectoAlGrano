/* Directo al grano — helpers de UI (íconos + interacción de previews). Sin dependencias. */
(function () {
  var ICONS = {"bean": "<ellipse class=\"fill\" cx=\"12\" cy=\"12\" rx=\"6.5\" ry=\"9.5\" transform=\"rotate(35 12 12)\"/><path class=\"crease\" d=\"M15.9 6.3 8.1 17.7\"/>", "ranking": "<path d=\"M3.5 20.5h17M5.5 20.5v-6h4v6M9.5 20.5V8.5h5v12M14.5 20.5v-8h4v8\"/><path d=\"M12 3.5v2\"/>", "map": "<path d=\"M12 21s-7-6.1-7-11.2A7 7 0 0 1 19 9.8C19 14.9 12 21 12 21z\"/><circle cx=\"12\" cy=\"10\" r=\"2.5\"/>", "plus": "<path d=\"M12 5v14M5 12h14\"/>", "wishlist": "<path d=\"M6.5 3.5h11v17l-5.5-3.8-5.5 3.8z\"/>", "journal": "<rect x=\"5\" y=\"3.5\" width=\"14\" height=\"17\" rx=\"2\"/><path d=\"M9 8h6M9 12h6M9 16h3\"/>", "cup": "<path d=\"M4.5 9h11.5v4.5A5.5 5.5 0 0 1 10.5 19h-.5a5.5 5.5 0 0 1-5.5-5.5z\"/><path d=\"M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5v2.5M12 3.5v2.5\"/>", "food": "<path d=\"M7 3.5v17M4.5 3.5v5a2.5 2.5 0 0 0 5 0v-5M17.5 20.5v-17c-2.2 0-3.5 2.3-3.5 5.5v4.5h3.5\"/>", "place": "<path d=\"M3.5 20.5h17M5 20.5V10l7-5.5 7 5.5v10.5\"/><path d=\"M10 20.5v-5h4v5\"/>", "service": "<circle cx=\"12\" cy=\"8\" r=\"3.5\"/><path d=\"M5 20.5a7 7 0 0 1 14 0\"/>", "price": "<circle cx=\"12\" cy=\"12\" r=\"8.5\"/><path d=\"M14.5 9.2c-.5-.8-1.4-1.2-2.5-1.2-1.5 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1.1 0-2-.4-2.5-1.2M12 6.5V8M12 16v1.5\"/>", "laptop": "<rect x=\"5\" y=\"5\" width=\"14\" height=\"10\" rx=\"1.5\"/><path d=\"M3 18.5h18\"/>", "search": "<circle cx=\"11\" cy=\"11\" r=\"6.5\"/><path d=\"m16 16 4.5 4.5\"/>", "check": "<path d=\"m5 12.5 4.5 4.5L19 7.5\"/>", "route": "<path d=\"M3.5 11 20.5 3.5 13 20.5l-2-7.5z\"/>", "back": "<path d=\"M15 5l-7 7 7 7\"/>", "more": "<circle cx=\"5.5\" cy=\"12\" r=\".8\"/><circle cx=\"12\" cy=\"12\" r=\".8\"/><circle cx=\"18.5\" cy=\"12\" r=\".8\"/>", "filter": "<path d=\"M4 6.5h16M7 12h10M10 17.5h4\"/>", "edit": "<path d=\"M4 20h4L19 9l-4-4L4 16z\"/><path d=\"m13.5 6.5 4 4\"/>", "calendar": "<rect x=\"4\" y=\"5\" width=\"16\" height=\"15\" rx=\"2\"/><path d=\"M4 10h16M8.5 3v4M15.5 3v4\"/>", "crown": "<path d=\"M4 18.5h16M4.5 15.5l-1-9 5 4 3.5-6 3.5 6 5-4-1 9z\"/>"};
  var MARK = "<defs><mask id=\"{id}\"><rect width=\"64\" height=\"64\" fill=\"#fff\"/><path d=\"M41.8 17.6 22.2 46.4\" stroke=\"#000\" stroke-width=\"4.5\" stroke-linecap=\"round\"/></mask></defs><ellipse cx=\"32\" cy=\"32\" rx=\"17\" ry=\"25.5\" transform=\"rotate(35 32 32)\" fill=\"{fill}\" mask=\"url(#{id})\"/>";
  var uid = 0;
  function icon(name) {
    var b = ICONS[name]; if (!b) return '';
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + b + '</svg>';
  }
  function mark() {
    var id = 'dagm' + (++uid);
    return '<svg viewBox="0 0 64 64" aria-hidden="true">' + MARK.split('{id}').join(id).split('{fill}').join('currentColor') + '</svg>';
  }
  function band(s) { s = Number(s); return s >= 9 ? 'top' : s >= 7 ? 'good' : s >= 5 ? 'ok' : 'low'; }
  var WORDS = { top: 'Directo al grano', good: 'Vuelvo seguro', ok: 'Zafa', low: 'No vuelvo' };
  function bandWord(s) { return WORDS[band(s)]; }
  function fmt(s) { return String(s).replace('.', ','); }

  function hydrate(root) {
    root = root || document;
    root.querySelectorAll('[data-icon]').forEach(function (el) {
      if (!el.firstChild) { el.classList.add('dag-icon'); el.innerHTML = icon(el.getAttribute('data-icon')); }
    });
    root.querySelectorAll('[data-mark]').forEach(function (el) { if (!el.firstChild) el.innerHTML = mark(); });
    root.querySelectorAll('[data-score]').forEach(function (el) {
      var s = el.getAttribute('data-score'); el.setAttribute('data-band', band(s));
      if (!el.textContent.trim()) el.textContent = fmt(s);
    });
    root.querySelectorAll('[data-band-of]').forEach(function (el) {
      var s = el.getAttribute('data-band-of'); el.setAttribute('data-band', band(s)); el.textContent = bandWord(s);
    });
    // chips: toggle; group with data-single = una sola opción
    root.querySelectorAll('.dag-chip').forEach(function (c) {
      c.addEventListener('click', function () {
        var g = c.closest('[data-single]');
        if (g) g.querySelectorAll('.dag-chip').forEach(function (o) { o.setAttribute('aria-pressed', 'false'); });
        c.setAttribute('aria-pressed', g ? 'true' : String(c.getAttribute('aria-pressed') !== 'true'));
      });
    });
    // picker 1–10
    root.querySelectorAll('.dag-picker').forEach(function (p) {
      var opts = p.querySelectorAll('.dag-picker__opt');
      function set(v) {
        opts.forEach(function (o) { var n = Number(o.textContent); o.setAttribute('aria-pressed', String(n === v)); o.setAttribute('data-filled', String(n < v)); });
        var out = p.querySelector('.dag-picker__value'); if (out) out.textContent = v;
        var w = p.querySelector('[data-band-of]'); if (w) { w.setAttribute('data-band-of', v); w.setAttribute('data-band', band(v)); w.textContent = bandWord(v); }
      }
      opts.forEach(function (o) { o.addEventListener('click', function () { set(Number(o.textContent)); }); });
      var cur = p.querySelector('.dag-picker__opt[aria-pressed="true"]'); if (cur) set(Number(cur.textContent));
    });
    // granos 1–5
    root.querySelectorAll('.dag-beans:not(.dag-beans--read)').forEach(function (g) {
      var beans = g.querySelectorAll('.dag-bean');
      beans.forEach(function (b, i) { b.addEventListener('click', function () { beans.forEach(function (x, j) { x.setAttribute('data-on', String(j <= i)); }); }); });
    });
    // switch (¿comiste?)
    root.querySelectorAll('.dag-switch').forEach(function (s) {
      s.addEventListener('click', function () {
        var on = s.getAttribute('aria-checked') !== 'true'; s.setAttribute('aria-checked', String(on));
        var f = s.closest('.dag-food'); if (f) f.setAttribute('data-open', String(on));
      });
    });
    // pins
    root.querySelectorAll('.dag-pin').forEach(function (pin) {
      pin.addEventListener('click', function () {
        var m = pin.closest('.dag-map'); if (m) m.querySelectorAll('.dag-pin').forEach(function (o) { o.setAttribute('aria-pressed', 'false'); });
        pin.setAttribute('aria-pressed', 'true');
      });
    });
  }
  window.DirectoAlGrano = { icons: ICONS, icon: icon, mark: mark, band: band, bandWord: bandWord, format: fmt, hydrate: hydrate };
})();
