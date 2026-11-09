/* Directo al grano — app. Router por hash, pantallas y formulario de review. */
(function () {
  var DAG = window.DirectoAlGrano, S = window.Store;
  var view = document.getElementById('view');
  var tabbar = document.getElementById('tabbar');

  // ---------- helpers ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function ic(name) { return '<span class="dag-icon">' + DAG.icon(name) + '</span>'; }
  function r1(n) { return Math.round(n * 10) / 10; }
  function num(n) { return DAG.format(r1(n)); }
  function badge(n, mod) {
    return '<span class="dag-score ' + (mod || '') + '" data-band="' + DAG.band(r1(n)) + '">' + num(n) + '</span>';
  }
  function bandWord(n) {
    return '<span class="dag-band-word" data-band="' + DAG.band(r1(n)) + '">' + DAG.bandWord(r1(n)) + '</span>';
  }
  function scoreCol(n, mod) {
    return '<span class="app-scorecol">' + badge(n, mod) + '<span class="app-scorecol__word" data-band="' + DAG.band(r1(n)) + '">' + DAG.bandWord(r1(n)) + '</span></span>';
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function joinMeta(parts) { return parts.filter(Boolean).map(esc).join(' · '); }

  var MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  function parseDate(iso) { var p = iso.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function shortDate(iso) {
    var d = parseDate(iso), now = new Date();
    var s = d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3);
    return d.getFullYear() === now.getFullYear() ? s : s + ' ' + d.getFullYear();
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  var ASPECT_FILTERS = S.ASPECTS.map(function (a) { return { key: a.key, name: a.name }; }).concat([{ key: 'comida', name: 'Comida' }]);
  var HERO_LABEL = { general: 'Tu número 1', cafe: 'Mejor café', lugar: 'Mejor lugar', atencion: 'Mejor atención', precio: 'Mejor precio/calidad', trabajo: 'Mejor para trabajar', comida: 'Mejor comida' };

  var ui = { rankKey: 'general', rankQuery: '', searchOpen: false, mapFilter: 'todas', mapSel: null, mapPlace: null, pendingPlace: null };
  var cleanup = [];
  var navigatedInApp = false;

  // ---------- tema ----------
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function applyTheme() {
    var pref = S.prefs().theme || 'system';
    var t = pref === 'system' ? (mq && mq.matches ? 'dark' : 'light') : pref;
    document.documentElement.setAttribute('data-theme', t);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--surface').trim());
  }
  if (mq && mq.addEventListener) mq.addEventListener('change', applyTheme);

  // ---------- toast y sheets ----------
  var toastTimer;
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('is-on'); }, 2600);
  }

  function openSheet(html, onMount) {
    var prevFocus = document.activeElement;
    var ov = document.createElement('div');
    ov.className = 'app-overlay';
    ov.innerHTML = '<div class="dag-sheet app-modal" role="dialog" aria-modal="true" tabindex="-1"><div class="dag-sheet__grip"></div>' + html + '</div>';
    document.body.appendChild(ov);
    document.body.classList.add('has-modal');
    DAG.hydrate(ov);
    function onKey(e) { if (e.key === 'Escape') close(); }
    function close() {
      document.removeEventListener('keydown', onKey);
      ov.classList.remove('is-open');
      document.body.classList.remove('has-modal');
      setTimeout(function () { ov.remove(); }, 180);
      if (prevFocus && prevFocus.focus) prevFocus.focus();
    }
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(function () {
      ov.classList.add('is-open');
      var f = ov.querySelector('input:not([type=file]), textarea');
      (f || ov.firstElementChild).focus({ preventScroll: true });
    });
    if (onMount) onMount(ov.firstElementChild, close);
    return close;
  }

  function confirmSheet(title, body, action) {
    return new Promise(function (resolve) {
      var done = false;
      openSheet(
        '<h2 class="dag-title app-sheet-title">' + esc(title) + '</h2>' +
        (body ? '<p class="dag-muted app-sheet-text">' + esc(body) + '</p>' : '') +
        '<div class="app-sheet-actions"><button type="button" class="dag-btn dag-btn--secondary" data-no>Mejor no</button>' +
        '<button type="button" class="dag-btn app-btn-danger" data-yes>' + esc(action) + '</button></div>',
        function (sheet, close) {
          sheet.querySelector('[data-no]').addEventListener('click', function () { close(); });
          sheet.querySelector('[data-yes]').addEventListener('click', function () { done = true; close(); resolve(true); });
          var obs = new MutationObserver(function () { if (!document.body.contains(sheet)) { obs.disconnect(); if (!done) resolve(false); } });
          obs.observe(document.body, { childList: true });
        });
    });
  }

  // ---------- router ----------
  function route() {
    var h = location.hash.replace(/^#\/?/, '');
    var qi = h.indexOf('?');
    var path = qi >= 0 ? h.slice(0, qi) : h;
    var parts = path.split('/').filter(Boolean);
    return { name: parts[0] || 'ranking', id: parts[1] ? decodeURIComponent(parts[1]) : null, q: new URLSearchParams(qi >= 0 ? h.slice(qi + 1) : '') };
  }
  function go(hash, replace) {
    navigatedInApp = true;
    if (replace) location.replace(hash); else location.hash = hash;
  }
  function back(fallback) {
    if (navigatedInApp && history.length > 1) history.back(); else go(fallback || '#/ranking', true);
  }

  var VIEWS = {};
  var AUTH_VIEWS = { entrar: true, registro: true, recuperar: true };
  var booted = false;
  function setHash(h) { history.replaceState(null, '', h); }
  function render() {
    cleanup.forEach(function (fn) { fn(); }); cleanup = [];
    if (!booted) return;
    var r = route();
    // Sin sesión, solo las pantallas de cuenta; con sesión, nunca.
    if (!S.auth.user() && !AUTH_VIEWS[r.name]) { setHash('#/entrar'); r = route(); }
    else if (S.auth.user() && AUTH_VIEWS[r.name]) { setHash('#/ranking'); r = route(); }
    var fn = S.auth.user() && S.loadError() ? VIEWS.error : VIEWS[r.name] || VIEWS.ranking;
    var tab = { ranking: 'ranking', cafe: 'ranking', mapa: 'mapa', wishlist: 'wishlist', diario: 'diario' }[r.name] || '';
    tabbar.querySelectorAll('.dag-tab').forEach(function (t) {
      if (t.getAttribute('data-tab') === tab) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    });
    var form = r.name === 'nueva' || r.name === 'editar' || !!AUTH_VIEWS[r.name] || fn === VIEWS.error;
    document.body.classList.toggle('no-tabbar', form);
    document.body.setAttribute('data-route', r.name);
    view.innerHTML = '';
    fn(r);
    DAG.hydrate(view);
    window.scrollTo(0, 0);
    var h1 = view.querySelector('h1') || view.querySelector('.dag-topbar__title');
    document.title = r.name === 'ranking' || !h1 || !h1.textContent ? 'Directo al grano' : h1.textContent + ' · Directo al grano';
  }
  window.addEventListener('hashchange', render);

  // ================= RANKING =================
  VIEWS.ranking = function () {
    var cafes = S.cafes();
    var head = '<div class="dag-screen__head app-head">' +
      '<span class="dag-logo"><span class="dag-logo__mark" style="width:30px;height:30px">' + DAG.mark() + '</span>' +
      '<span class="dag-logo__word" style="font-size:20px">Directo <em>al</em> grano</span></span>' +
      '<span class="dag-row" style="flex-wrap:nowrap">' +
      (cafes.length ? '<button type="button" class="dag-btn dag-btn--secondary dag-btn--icon" id="rk-search-btn" aria-label="Buscar" aria-expanded="' + ui.searchOpen + '">' + ic('search') + '</button>' : '') +
      '<button type="button" class="dag-btn dag-btn--ghost dag-btn--icon" id="rk-more" aria-label="Ajustes">' + ic('more') + '</button></span></div>';

    if (!cafes.length) {
      view.innerHTML = head + '<h1 class="dag-display">Ranking</h1>' +
        '<div class="app-empty"><span class="app-empty__mark">' + DAG.mark() + '</span>' +
        '<p>Todavía no reseñaste nada. El primer cortado corre por tu cuenta.</p>' +
        '<a class="dag-btn" href="#/nueva">' + ic('plus') + 'Nueva review</a>' +
        (S.hasLegacy() ? '<button type="button" class="dag-btn dag-btn--secondary" id="rk-legacy">Subir lo que tenías en este navegador</button>' : '') +
        '<button type="button" class="dag-btn dag-btn--ghost" id="rk-seed">Ver con datos de ejemplo</button></div>';
      view.querySelector('#rk-seed').addEventListener('click', function () { S.seed(); render(); toast('Listo: siete cafeterías de ejemplo. Las borrás desde Ajustes.'); });
      var lg = view.querySelector('#rk-legacy');
      if (lg) lg.addEventListener('click', function () {
        try { S.importLegacy(); render(); toast('Listo: tus reviews ya están en tu cuenta.'); }
        catch (err) { toast('No pude leer lo que había en este navegador.'); }
      });
      view.querySelector('#rk-more').addEventListener('click', openSettings);
      return;
    }

    view.innerHTML = head + '<h1 class="dag-display" style="margin-bottom:12px">Ranking</h1>' +
      '<div class="app-searchrow" ' + (ui.searchOpen ? '' : 'hidden') + '><label class="dag-search">' + ic('search') +
      '<input id="rk-q" type="search" placeholder="Buscá por nombre o barrio" value="' + esc(ui.rankQuery) + '" autocomplete="off"></label></div>' +
      '<div class="dag-chips dag-chips--scroll app-filters" data-single role="group" aria-label="Ordenar por">' +
      '<button type="button" class="dag-chip dag-chip--solid" data-key="general" aria-pressed="' + (ui.rankKey === 'general') + '">General</button>' +
      ASPECT_FILTERS.map(function (f) {
        return '<button type="button" class="dag-chip dag-chip--solid" data-key="' + f.key + '" aria-pressed="' + (ui.rankKey === f.key) + '">' + f.name + '</button>';
      }).join('') + '</div><div id="rk-list"></div>';

    view.querySelector('.app-filters').addEventListener('click', function (e) {
      var c = e.target.closest('.dag-chip'); if (!c) return;
      ui.rankKey = c.getAttribute('data-key'); renderRankList();
    });
    var q = view.querySelector('#rk-q');
    q.addEventListener('input', function () { ui.rankQuery = q.value; renderRankList(); });
    view.querySelector('#rk-search-btn').addEventListener('click', function () {
      ui.searchOpen = !ui.searchOpen;
      if (!ui.searchOpen) { ui.rankQuery = ''; q.value = ''; renderRankList(); }
      view.querySelector('.app-searchrow').hidden = !ui.searchOpen;
      this.setAttribute('aria-expanded', String(ui.searchOpen));
      if (ui.searchOpen) q.focus();
    });
    view.querySelector('#rk-more').addEventListener('click', openSettings);
    renderRankList();
  };

  function rankMeta(row, key) {
    var c = row.cafe, s = row.stats;
    if (key === 'general') return joinMeta([c.barrio, s.drink, plural(s.n, 'visita', 'visitas')]);
    if (key === 'comida') return joinMeta([c.barrio, 'Comida ' + num(row.value)]);
    var a = S.ASPECTS.find(function (x) { return x.key === key; });
    return joinMeta([c.barrio, a.name + ' ' + num(row.value) + ' de 5']);
  }

  function renderRankList() {
    var box = view.querySelector('#rk-list'); if (!box) return;
    var key = ui.rankKey;
    var rows = S.ranking(key);
    var all = S.ranking('general').length;
    var query = ui.rankQuery.trim().toLowerCase();
    var ranked = rows.map(function (r, i) { return { row: r, pos: i + 1 }; });
    if (query) ranked = ranked.filter(function (x) { return (x.row.cafe.name + ' ' + x.row.cafe.barrio).toLowerCase().indexOf(query) >= 0; });

    var html = '';
    if (!ranked.length) {
      html = '<p class="app-empty-line">' + (query ? 'Nada con “' + esc(ui.rankQuery.trim()) + '”. Probá con el barrio.' :
        key === 'comida' ? 'Todavía no anotaste nada de comida. La medialuna también cuenta.' : 'Ninguna review puntuó esto todavía.') + '</p>';
    } else {
      html = '<div class="dag-stack">' + ranked.map(function (x, i) {
        var r = x.row, c = r.cafe;
        if (i === 0 && !query) {
          return '<a class="dag-hero" href="#/cafe/' + c.id + '"><span class="dag-hero__bean">' + DAG.mark() + '</span>' +
            '<span class="dag-hero__crown">' + ic('crown') + HERO_LABEL[key] + '</span>' +
            '<span><p class="dag-hero__name">' + esc(c.name) + '</p><p class="dag-hero__meta">' + rankMeta(r, key) + '</p>' +
            '<p class="app-hero__band">' + DAG.bandWord(r1(r.stats.avg)) + '</p></span>' +
            '<span class="dag-hero__score" aria-label="Nota ' + num(r.stats.avg) + '">' + num(r.stats.avg) + '</span></a>';
        }
        return '<a class="dag-cafe" href="#/cafe/' + c.id + '"><span class="dag-cafe__rank">' + x.pos + '</span>' +
          '<span class="dag-cafe__thumb">' + ic('cup') + '</span>' +
          '<span class="dag-cafe__info"><p class="dag-cafe__name">' + esc(c.name) + '</p><p class="dag-cafe__meta">' + rankMeta(r, key) + '</p></span>' +
          scoreCol(r.stats.avg) + '</a>';
      }).join('') + '</div>';
      if (key !== 'general' && rows.length < all && !query) {
        html += '<p class="app-footnote">' + plural(all - rows.length, 'cafetería no tiene', 'cafeterías no tienen') + ' nota de ' + (key === 'comida' ? 'comida' : 'este aspecto') + '.</p>';
      }
    }
    box.innerHTML = html;
  }

  // ================= DETALLE =================
  VIEWS.cafe = function (r) {
    var c = S.cafe(r.id);
    if (!c) {
      view.innerHTML = topbar('', '') + '<div class="app-empty"><p>Esa cafetería ya no está. Capaz la borraste.</p><a class="dag-btn dag-btn--secondary" href="#/ranking">Ir al ranking</a></div>';
      bindBack(); return;
    }
    var s = S.stats(c.id), rank = S.rankOf(c.id), last = s.last;
    var aspectRows = S.ASPECTS.filter(function (a) { return s.aspects[a.key] != null; });
    var lastWithText = s.visits.find(function (v) { return v.text; });
    var tags = last ? [last.drink, last.origin, last.roast ? 'Tueste ' + last.roast.toLowerCase() : '', last.method].filter(Boolean) : [];

    var html = topbar('', '<a class="dag-btn dag-btn--ghost dag-btn--icon" href="#/editar/' + (last ? last.id : '') + '" aria-label="Editar la última visita">' + ic('edit') + '</a>') +
      '<div class="app-detail-head"><div style="min-width:0">' +
      (rank ? '<p class="dag-label">#' + rank.pos + ' de ' + rank.total + '</p>' : '') +
      '<h1 class="dag-title app-detail-name">' + esc(c.name) + '</h1>' +
      '<p class="dag-cafe__meta">' + joinMeta([c.barrio, plural(s.n, 'visita', 'visitas')]) + '</p></div>' +
      badge(s.avg, 'dag-score--xl app-detail-score') + '</div>' +
      '<p class="app-detail-band">' + bandWord(s.avg) + (s.n > 1 ? '<span class="dag-muted"> · promedio de ' + s.n + ' visitas</span>' : '') + '</p>';

    if (aspectRows.length) {
      html += '<div class="dag-card app-gap"><div class="dag-stack" style="gap:4px">' + aspectRows.map(function (a) {
        var v = s.aspects[a.key];
        return '<div class="dag-bar"><span>' + a.name + '</span><span class="dag-bar__track"><span class="dag-bar__fill" style="width:' + (v / 5 * 100) + '%;display:block"></span></span><span class="dag-bar__val">' + num(v) + '</span></div>';
      }).join('') + '</div></div>';
    }
    if (tags.length) html += '<div class="dag-row app-gap" style="gap:6px">' + tags.map(function (t, i) { return '<span class="dag-tag">' + (i === 0 && last.drink ? ic('cup') : '') + esc(t) + '</span>'; }).join('') + '</div>';
    if (lastWithText) html += '<p class="app-quote">“' + esc(lastWithText.text) + '”</p>';
    if (s.lastFood) {
      html += '<div class="dag-card app-food-card app-gap"><span class="app-food-card__icon">' + ic('food') + '</span><div style="flex:1;min-width:0"><p class="app-strong">' + esc(s.lastFood.name || 'Algo rico') + '</p>' +
        (s.lastFood.text ? '<p class="dag-cafe__meta">' + esc(s.lastFood.text) + '</p>' : '') + '</div>' + (s.lastFood.score ? scoreCol(s.lastFood.score, 'dag-score--sm') : '') + '</div>';
    }
    if (c.address || hasLL(c)) {
      html += '<div class="dag-card app-place app-gap"><span class="app-place__icon">' + ic('map') + '</span><p class="app-place__addr">' + esc(c.address || 'Marcada en el mapa') + (c.barrio ? '<span class="dag-muted">, ' + esc(c.barrio) + '</span>' : '') + '</p>' +
        '<a class="dag-btn dag-btn--secondary dag-btn--icon" href="' + routeUrl(c) + '" target="_blank" rel="noopener" aria-label="Cómo llegar">' + ic('route') + '</a></div>';
    }

    html += '<section class="dag-section app-visits"><div class="dag-section__head"><p class="dag-label">Visitas</p></div><div class="dag-stack" style="gap:8px">' +
      s.visits.map(function (v) {
        return '<a class="dag-card app-visit" href="#/editar/' + v.id + '"><span class="app-visit__date">' + shortDate(v.date) + '</span>' +
          '<span class="app-visit__what">' + esc(v.drink || 'Visita') + (v.food ? ' <span class="dag-muted">+ ' + esc(v.food.name || 'comida') + '</span>' : '') + '</span>' + scoreCol(v.score, 'dag-score--sm') + '</a>';
      }).join('') + '</div>' +
      '<a class="dag-btn dag-btn--secondary dag-btn--block" href="#/nueva?cafe=' + c.id + '">' + ic('plus') + 'Volví: sumar visita</a></section>';

    view.innerHTML = html;
    bindBack();
  };

  function routeUrl(c) {
    if (typeof c.lat === 'number' && typeof c.lng === 'number') return 'https://www.google.com/maps/dir/?api=1&destination=' + c.lat + ',' + c.lng;
    return 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent([c.address, c.barrio, 'Buenos Aires'].filter(Boolean).join(', '));
  }

  function topbar(title, right) {
    return '<div class="dag-topbar app-topbar"><button type="button" class="dag-btn dag-btn--ghost dag-btn--icon" data-back aria-label="Volver">' + ic('back') + '</button>' +
      '<span class="dag-topbar__title">' + esc(title) + '</span>' + (right || '<span style="width:44px"></span>') + '</div>';
  }
  function bindBack(fallback) {
    var b = view.querySelector('[data-back]');
    if (b) b.addEventListener('click', function () { back(fallback); });
  }

  // ================= NUEVA / EDITAR REVIEW =================
  VIEWS.nueva = function (r) {
    var place = r.q.get('lugar') ? ui.pendingPlace : null;
    ui.pendingPlace = null;
    reviewForm({ mode: 'new', cafeId: r.q.get('cafe'), wishId: r.q.get('wish'), place: place });
  };
  VIEWS.editar = function (r) {
    var v = S.visit(r.id);
    if (!v) { go('#/ranking', true); return; }
    reviewForm({ mode: 'edit', visit: v, cafeId: v.cafeId });
  };

  function chipGroup(name, options, selected) {
    return '<div class="dag-chips" data-single data-group="' + name + '">' + options.map(function (o) {
      return '<button type="button" class="dag-chip" aria-pressed="' + (o === selected) + '">' + esc(o) + '</button>';
    }).join('') + '</div>';
  }
  function pickerScale(selected, label) {
    var h = '<div class="dag-picker__scale" role="group" aria-label="' + label + '">';
    for (var i = 1; i <= 10; i++) h += '<button type="button" class="dag-picker__opt" aria-pressed="' + (i === selected) + '" data-filled="' + (selected && i < selected) + '">' + i + '</button>';
    return h + '</div>';
  }
  function beans(value, name) {
    var h = '<div class="dag-beans" role="group" aria-label="' + esc(name) + ', de 1 a 5 granos">';
    for (var i = 1; i <= 5; i++) h += '<button type="button" class="dag-bean" data-on="' + (i <= value) + '" aria-label="' + i + ' de 5">' + DAG.icon('bean') + '</button>';
    return h + '</div>';
  }

  // ---------- ubicación real: buscador + mapa + pin movible ----------
  function hasLL(o) { return !!o && typeof o.lat === 'number' && typeof o.lng === 'number'; }
  function pinCup() { return '<span class="dag-pin dag-pin--pick"><span class="dag-pin__body">' + ic('cup') + '</span><span class="dag-pin__tip"></span></span>'; }
  function pinWish() { return '<span class="dag-pin dag-pin--wish"><span class="dag-pin__body">' + ic('wishlist') + '</span><span class="dag-pin__tip"></span></span>'; }
  function defaultView(m, pad) {
    var pts = S.cafes().filter(hasLL);
    if (!m.fit(pts, pad)) m.centerOn(Geo.BA.lat, Geo.BA.lng, 12);
  }

  /* cfg: mapEl, hintEl, addrInput, addrList, barrioInput() (opcional), pin (html), point ({lat,lng} o null) */
  function placeFields(cfg) {
    var point = hasLL(cfg.point) ? { lat: cfg.point.lat, lng: cfg.point.lng } : null;
    var addr = cfg.addrInput, addrTouched = !!addr.value, barrioAuto = false;
    var m = MapView.mount(cfg.mapEl, { onTap: function (ll) { setPoint(ll); } });

    function hint() {
      if (!cfg.hintEl) return;
      cfg.hintEl.textContent = !m ? '' : point ? 'Listo. Arrastrá el pin o tocá otro punto para corregirlo.' : 'Buscá la dirección o tocá el mapa para marcar el lugar.';
    }
    function sync(center) {
      if (m) m.setPin(point ? point.lat : null, point ? point.lng : null, cfg.pin, function (ll) { setPoint(ll); });
      if (m && center && point) m.centerOn(point.lat, point.lng, Math.max(16, m.map.getZoom()));
      hint();
    }
    function fillBarrio(b) {
      var bi = cfg.barrioInput && cfg.barrioInput();
      if (bi && b && (!bi.value.trim() || barrioAuto)) { bi.value = b; bi.dispatchEvent(new Event('input')); barrioAuto = true; }
    }
    function setPoint(ll) {
      point = { lat: ll.lat, lng: ll.lng }; sync(false);
      if (addrTouched && addr.value.trim()) return;
      var asked = point;
      Geo.reverse(ll.lat, ll.lng).then(function (pl) {
        if (!pl || point !== asked) return;
        var a = pl.address || pl.name;
        if (a) { addr.value = a; addrTouched = false; }
        fillBarrio(pl.barrio);
      }).catch(function () { /* sin conexión: queda el pin sin dirección */ });
    }
    function applyPlace(pl) {
      addr.value = pl.address || pl.name || ''; addrTouched = false;
      fillBarrio(pl.barrio);
      point = { lat: pl.lat, lng: pl.lng }; sync(true);
    }
    function watchBarrio(bi) { bi.addEventListener('input', function (e) { if (e.isTrusted) barrioAuto = false; }); }

    addr.addEventListener('input', function (e) { if (e.isTrusted) addrTouched = true; });
    var bi0 = cfg.barrioInput && cfg.barrioInput();
    if (bi0) watchBarrio(bi0);
    Geo.attach(addr, {
      list: cfg.addrList,
      near: function () { return point || (m ? m.center() : Geo.BA); },
      onPick: applyPlace
    });

    if (m) { if (point) m.centerOn(point.lat, point.lng, 16); else defaultView(m); }
    sync(false);
    return {
      point: function () { return point; },
      applyPlace: applyPlace,
      clear: function () { point = null; addr.value = ''; addrTouched = false; sync(false); },
      setExisting: function (c) { addr.value = c.address || ''; addrTouched = !!c.address; point = hasLL(c) ? { lat: c.lat, lng: c.lng } : null; sync(true); },
      near: function () { return point || (m ? m.center() : Geo.BA); },
      watchBarrio: watchBarrio,
      invalidate: function () { if (m) m.invalidate(); },
      destroy: function () { if (m) m.destroy(); }
    };
  }

  function reviewForm(o) {
    var edit = o.mode === 'edit', v = o.visit || {};
    var wish = o.wishId ? S.wish(o.wishId) : null;
    var seed = wish || o.place || null;
    var st = {
      cafeId: o.cafeId && S.cafe(o.cafeId) ? o.cafeId : null,
      name: seed ? seed.name || '' : '', barrio: seed ? seed.barrio || '' : '',
      address: seed ? seed.address || '' : '', lat: seed ? seed.lat : null, lng: seed ? seed.lng : null
    };
    if (st.cafeId) { var c0 = S.cafe(st.cafeId); st.address = c0.address; st.lat = c0.lat; st.lng = c0.lng; }
    var food = v.food || null;

    var html = topbar(edit ? 'Editar visita' : 'Nueva review', '') +
      '<form id="rv" novalidate>' +
      '<div class="dag-section"><p class="dag-label">Cafetería</p><div id="rv-cafe"></div>' +
      '<label class="dag-field"><span class="app-field-label">¿Cuándo fuiste?</span><input class="dag-input" type="date" id="rv-date" value="' + esc(v.date || S.today()) + '" max="' + S.today() + '"></label></div>' +

      '<div class="dag-section" id="rv-score-sec"><p class="dag-label">Tu nota</p><div class="dag-picker" id="rv-score"><div class="dag-picker__readout">' +
      '<span class="dag-picker__value">' + (v.score || '–') + '</span><span class="dag-picker__of">/10</span>' +
      (v.score ? '<span class="dag-band-word" data-band-of="' + v.score + '"></span>' : '<span class="dag-band-word" data-band-of="0" hidden></span>') + '</div>' +
      pickerScale(v.score, 'Nota del 1 al 10') + '</div><p class="app-error" id="rv-score-err" hidden>Falta la nota. Es lo único obligatorio.</p></div>' +

      '<div class="dag-section"><p class="dag-label">Aspectos <span class="app-label-opt">· opcional</span></p><div class="dag-card" style="padding:0 16px"><div class="dag-aspects">' +
      S.ASPECTS.map(function (a) {
        return '<div class="dag-aspect" data-aspect="' + a.key + '"><span class="dag-aspect__name">' + ic(a.icon) + a.name + '</span>' + beans((v.aspects && v.aspects[a.key]) || 0, a.name) + '</div>';
      }).join('') + '</div></div><p class="app-hint">No suman a la nota: la explican. Tocá el último grano otra vez para borrar.</p></div>' +

      '<div class="dag-section"><p class="dag-label">¿Qué tomaste?</p>' + chipGroup('drink', S.BEAN.drink, v.drink) + '</div>' +
      '<div class="dag-section"><p class="dag-label">Origen del grano</p>' + chipGroup('origin', S.BEAN.origin, v.origin) + '</div>' +
      '<div class="dag-section"><p class="dag-label">Tueste</p>' + chipGroup('roast', S.BEAN.roast, v.roast) + '</div>' +
      '<div class="dag-section"><p class="dag-label">Método</p>' + chipGroup('method', S.BEAN.method, v.method) + '</div>' +

      '<div class="dag-section"><label class="dag-field"><span class="dag-label">La review</span>' +
      '<textarea class="dag-textarea" id="rv-text" maxlength="600" placeholder="¿Cómo estuvo? Sin vueltas.">' + esc(v.text || '') + '</textarea>' +
      '<span class="dag-field__hint"><span>Opcional</span><span id="rv-count">' + (v.text || '').length + '/600</span></span></label></div>' +

      '<div class="dag-section"><div class="dag-card dag-food" data-open="' + !!food + '"><div class="dag-food__toggle">' + ic('food') +
      '<span class="dag-food__q" id="rv-food-q">¿Comiste algo?</span><button type="button" class="dag-switch" role="switch" aria-checked="' + !!food + '" aria-labelledby="rv-food-q"></button></div>' +
      '<div class="dag-food__body"><label class="dag-field"><span class="app-field-label">¿Qué comiste?</span><input class="dag-input" id="rv-food-name" placeholder="Medialuna, tostado, budín…" value="' + esc(food ? food.name : '') + '"></label>' +
      '<div class="dag-field"><span class="app-field-label">Nota de la comida</span><div class="dag-picker dag-picker--compact" id="rv-food-score">' + pickerScale(food ? food.score : 0, 'Nota de la comida del 1 al 10') + '</div></div>' +
      '<label class="dag-field"><span class="app-field-label">Comentario</span><input class="dag-input" id="rv-food-text" placeholder="Opcional" value="' + esc(food ? food.text : '') + '"></label></div></div></div>' +

      '<div class="dag-section" id="rv-loc"><p class="dag-label">Ubicación</p><div class="app-pop"><label class="dag-search app-search-input">' + ic('search') +
      '<input id="rv-address" placeholder="Buscá la dirección o el lugar" autocomplete="off" value="' + esc(st.address || '') + '"></label>' +
      '<div id="rv-addr-suggest" class="app-suggest app-suggest--pop" hidden></div></div>' +
      '<div class="dag-map app-pickmap" id="rv-map" aria-label="Mapa: tocá para marcar el lugar"></div>' +
      '<p class="app-hint" id="rv-map-hint"></p></div>' +

      (edit ? '<button type="button" class="dag-btn dag-btn--ghost app-btn-danger-ghost" id="rv-delete">Borrar esta visita</button>' : '') +
      '<div class="app-savebar"><button type="submit" class="dag-btn dag-btn--block">' + ic('check') + (edit ? 'Guardar cambios' : 'Guardar review') + '</button></div>' +
      '</form>';
    view.innerHTML = html;
    bindBack(edit ? '#/cafe/' + v.cafeId : '#/ranking');

    var form = view.querySelector('#rv');

    // --- ubicación (va primero: el nombre la usa) ---
    var loc = placeFields({
      mapEl: form.querySelector('#rv-map'), hintEl: form.querySelector('#rv-map-hint'),
      addrInput: form.querySelector('#rv-address'), addrList: form.querySelector('#rv-addr-suggest'),
      barrioInput: function () { return form.querySelector('#rv-barrio'); },
      pin: pinCup(), point: hasLL(st) ? st : null
    });
    cleanup.push(loc.destroy);

    // --- cafetería ---
    function pickExisting(c) {
      st.cafeId = c.id; st.name = c.name;
      loc.setExisting(c);
      renderCafe();
    }
    function renderCafe() {
      var box = form.querySelector('#rv-cafe');
      if (st.cafeId) {
        var c = S.cafe(st.cafeId);
        box.innerHTML = '<div class="dag-card app-picked"><span class="dag-cafe__thumb">' + ic('cup') + '</span><div style="flex:1;min-width:0"><p class="dag-title">' + esc(c.name) + '</p>' +
          '<p class="dag-cafe__meta">' + joinMeta([c.barrio, plural(S.stats(c.id).n, 'visita', 'visitas')]) + '</p></div>' +
          (edit ? '' : '<button type="button" class="dag-btn dag-btn--ghost dag-btn--sm" id="rv-change">Cambiar</button>') + '</div>';
        var ch = box.querySelector('#rv-change');
        if (ch) ch.addEventListener('click', function () { st.cafeId = null; st.name = ''; st.barrio = ''; loc.clear(); renderCafe(); box.querySelector('#rv-name').focus(); });
      } else {
        box.innerHTML = '<div class="dag-stack"><div class="app-pop"><label class="dag-field"><span class="app-field-label">Nombre</span>' +
          '<input class="dag-input" id="rv-name" placeholder="¿Dónde fuiste? Buscala por nombre" autocomplete="off" value="' + esc(st.name) + '"></label>' +
          '<div id="rv-suggest" class="app-suggest app-suggest--pop" hidden></div></div>' +
          '<p class="app-error" id="rv-name-err" hidden>Poné el nombre de la cafetería.</p>' +
          '<label class="dag-field"><span class="app-field-label">Barrio</span><input class="dag-input" id="rv-barrio" placeholder="Palermo, Almagro…" value="' + esc(st.barrio) + '"></label></div>';
        var name = box.querySelector('#rv-name'), barrio = box.querySelector('#rv-barrio');
        name.addEventListener('input', function () { st.name = name.value; });
        barrio.addEventListener('input', function () { st.barrio = barrio.value; });
        loc.watchBarrio(barrio);
        Geo.attach(name, {
          list: box.querySelector('#rv-suggest'),
          near: loc.near,
          local: function (q) {
            q = q.toLowerCase();
            var hits = q ? S.cafes().filter(function (c) { return c.name.toLowerCase().indexOf(q) >= 0; }).slice(0, 3) : [];
            return hits.length ? '<p class="app-suggest__head">Ya la tenés</p>' + hits.map(function (c) {
              return '<button type="button" class="app-suggest__item" data-local="' + c.id + '">' + ic('cup') + '<span class="app-suggest__txt"><b>' + esc(c.name) + '</b><span class="dag-muted">' + esc(c.barrio) + '</span></span></button>';
            }).join('') : '';
          },
          onLocal: function (el) { pickExisting(S.cafe(el.getAttribute('data-local'))); },
          onPick: function (pl) {
            var mine = pl.name && S.cafes().find(function (c) { return c.name.toLowerCase() === pl.name.toLowerCase() && (!hasLL(c) || Geo.km(c, pl) < 0.3); });
            if (mine) { pickExisting(mine); return; }
            if (pl.name) { name.value = pl.name; st.name = pl.name; }
            loc.applyPlace(pl);
            form.querySelector('#rv-name-err').hidden = true;
          }
        });
      }
    }

    // --- nota ---
    var scorePicker = form.querySelector('#rv-score');
    scorePicker.addEventListener('click', function (e) {
      if (!e.target.closest('.dag-picker__opt')) return;
      var w = scorePicker.querySelector('.dag-band-word'); w.hidden = false;
      form.querySelector('#rv-score-err').hidden = true;
    });

    // --- granos: tocar el último encendido lo apaga todo ---
    form.querySelectorAll('.dag-beans').forEach(function (g) {
      var beansEls = g.querySelectorAll('.dag-bean'), before = 0;
      g.addEventListener('pointerdown', function () { before = g.querySelectorAll('.dag-bean[data-on="true"]').length; }, true);
      g.addEventListener('keydown', function () { before = g.querySelectorAll('.dag-bean[data-on="true"]').length; }, true);
      g.addEventListener('click', function (e) {
        var b = e.target.closest('.dag-bean'); if (!b) return;
        var idx = Array.prototype.indexOf.call(beansEls, b) + 1;
        if (idx === before) beansEls.forEach(function (x) { x.setAttribute('data-on', 'false'); });
      });
    });

    // --- chips: tocar el elegido lo deselecciona ---
    form.querySelectorAll('[data-group]').forEach(function (g) {
      var was = null;
      g.addEventListener('click', function (e) { var c = e.target.closest('.dag-chip'); was = c && c.getAttribute('aria-pressed') === 'true' ? c : null; }, true);
      g.addEventListener('click', function (e) { var c = e.target.closest('.dag-chip'); if (c && c === was) c.setAttribute('aria-pressed', 'false'); was = null; });
    });

    var text = form.querySelector('#rv-text');
    text.addEventListener('input', function () { form.querySelector('#rv-count').textContent = text.value.length + '/600'; });

    renderCafe();

    if (edit) {
      form.querySelector('#rv-delete').addEventListener('click', function () {
        var only = S.stats(v.cafeId).n === 1;
        confirmSheet('¿Borrás esta visita?', only ? 'Es la única: la cafetería también sale del ranking.' : 'La nota promedio se recalcula sin ella.', 'Borrar').then(function (ok) {
          if (!ok) return;
          var gone = S.deleteVisit(v.id);
          toast(gone ? 'Borrada. La cafetería salió del ranking.' : 'Visita borrada.');
          if (gone) go('#/ranking', true); else back('#/cafe/' + v.cafeId);
        });
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var sel = scorePicker.querySelector('.dag-picker__opt[aria-pressed="true"]');
      var score = sel ? Number(sel.textContent) : null;
      var nameErr = form.querySelector('#rv-name-err');
      var firstErr = null;
      if (!st.cafeId && !st.name.trim()) { nameErr.hidden = false; firstErr = form.querySelector('#rv-name'); }
      else if (nameErr) nameErr.hidden = true;
      if (!score) { form.querySelector('#rv-score-err').hidden = false; firstErr = firstErr || form.querySelector('#rv-score-sec'); }
      if (firstErr) {
        firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (firstErr.focus && firstErr.tagName === 'INPUT') firstErr.focus({ preventScroll: true });
        return;
      }

      var aspects = {};
      form.querySelectorAll('[data-aspect]').forEach(function (row) {
        var n = row.querySelectorAll('.dag-bean[data-on="true"]').length;
        if (n) aspects[row.getAttribute('data-aspect')] = n;
      });
      function chip(g) { var c = form.querySelector('[data-group="' + g + '"] .dag-chip[aria-pressed="true"]'); return c ? c.textContent : ''; }
      var foodOn = form.querySelector('.dag-switch').getAttribute('aria-checked') === 'true';
      var fSel = form.querySelector('#rv-food-score .dag-picker__opt[aria-pressed="true"]');
      var foodData = foodOn ? {
        name: form.querySelector('#rv-food-name').value.trim(),
        score: fSel ? Number(fSel.textContent) : null,
        text: form.querySelector('#rv-food-text').value.trim()
      } : null;
      if (foodData && !foodData.name && !foodData.score && !foodData.text) foodData = null;

      var address = form.querySelector('#rv-address').value.trim();
      var pt = loc.point();
      var cafeId = st.cafeId;
      if (!cafeId) {
        var existing = S.findCafeByName(st.name);
        if (existing) cafeId = existing.id;
        else cafeId = S.addCafe({ name: st.name, barrio: st.barrio, address: address, lat: pt ? pt.lat : null, lng: pt ? pt.lng : null }).id;
      }
      var patch = { address: address || undefined };
      if (pt) { patch.lat = Math.round(pt.lat * 1e6) / 1e6; patch.lng = Math.round(pt.lng * 1e6) / 1e6; }
      S.updateCafe(cafeId, patch);

      var data = {
        cafeId: cafeId, score: score, date: form.querySelector('#rv-date').value || S.today(),
        aspects: aspects, drink: chip('drink'), origin: chip('origin'), roast: chip('roast'), method: chip('method'),
        text: text.value.trim(), food: foodData
      };
      if (edit) { S.updateVisit(v.id, data); toast('Cambios guardados.'); back('#/cafe/' + cafeId); return; }
      S.addVisit(data);
      if (wish) S.deleteWish(wish.id);
      var rk = S.rankOf(cafeId);
      toast(wish ? 'Tachada de la wishlist. Ya cuenta para el ranking.' : rk ? 'Guardada. Quedó #' + rk.pos + ' de ' + rk.total + '.' : 'Guardada.');
      if (o.cafeId === cafeId && navigatedInApp) back(); else go('#/cafe/' + cafeId, true);
    });
  }

  // ================= MAPA =================
  VIEWS.mapa = function (r) {
    var focus = r.q.get('foco'); // "cafe:id" | "wish:id"
    if (focus) { ui.mapSel = focus; ui.mapPlace = null; ui.mapFilter = focus.indexOf('wish:') === 0 ? 'wishlist' : 'todas'; }
    if (ui.mapSel === 'place' && !ui.mapPlace) ui.mapSel = null;
    view.innerHTML = '<h1 class="app-sr">Mapa</h1><div class="app-mapscreen">' +
      '<div class="dag-map app-mapfull" id="mp"></div>' +
      '<div class="app-maptop dag-stack"><div class="app-pop"><label class="dag-search app-search-input" style="box-shadow:var(--shadow-float)">' + ic('search') +
      '<input id="mp-q" type="search" placeholder="Buscá una cafetería o dirección" autocomplete="off"></label>' +
      '<div id="mp-results" class="app-suggest app-suggest--pop" hidden></div></div>' +
      '<div class="dag-chips" data-single id="mp-filters">' +
      [['todas', 'Todas'], ['top', '9 o más'], ['wishlist', 'Wishlist']].map(function (f) {
        return '<button type="button" class="dag-chip dag-chip--solid" data-f="' + f[0] + '" aria-pressed="' + (ui.mapFilter === f[0]) + '" style="box-shadow:var(--shadow-card)">' + f[1] + '</button>';
      }).join('') + '</div></div>' +
      '<div class="dag-sheet app-mapsheet" id="mp-sheet"></div></div>';

    var mapEl = view.querySelector('#mp'), sheetEl = view.querySelector('#mp-sheet');
    var map = MapView.mount(mapEl, {
      wheel: true, zoomControl: true,
      onTap: function () { if (ui.mapSel) { ui.mapSel = null; ui.mapPlace = null; draw(); } }
    });
    if (map) cleanup.push(map.destroy);

    function items() {
      var list = [];
      if (ui.mapFilter !== 'wishlist') {
        S.cafes().forEach(function (c) {
          var s = S.stats(c.id); if (!s.n) return;
          if (ui.mapFilter === 'top' && r1(s.avg) < 9) return;
          list.push({ key: 'cafe:' + c.id, kind: 'cafe', c: c, s: s });
        });
      }
      if (ui.mapFilter !== 'top') S.wishlist().forEach(function (w) { list.push({ key: 'wish:' + w.id, kind: 'wish', c: w }); });
      return list;
    }
    function select(key) { ui.mapSel = key; if (key !== 'place') ui.mapPlace = null; draw(); focusSel(); }

    function draw() {
      var list = items();
      var placed = list.filter(function (it) { return hasLL(it.c); });
      if (ui.mapSel && ui.mapSel !== 'place' && !list.some(function (it) { return it.key === ui.mapSel; })) ui.mapSel = null;
      if (map) {
        var pins = placed.map(function (it) {
          var pressed = it.key === ui.mapSel;
          var html = it.kind === 'wish'
            ? '<button type="button" class="dag-pin dag-pin--wish" aria-pressed="' + pressed + '" aria-label="' + esc(it.c.name) + ', en tu wishlist"><span class="dag-pin__body">' + ic('wishlist') + '</span><span class="dag-pin__tip"></span></button>'
            : '<button type="button" class="dag-pin" data-band="' + DAG.band(r1(it.s.avg)) + '" aria-pressed="' + pressed + '" aria-label="' + esc(it.c.name) + ', nota ' + num(it.s.avg) + '"><span class="dag-pin__body">' + num(it.s.avg) + '</span><span class="dag-pin__tip"></span></button>';
          return { lat: it.c.lat, lng: it.c.lng, html: html, z: pressed ? 1000 : 0, onClick: function () { select(it.key); } };
        });
        if (ui.mapSel === 'place' && ui.mapPlace) {
          pins.push({ lat: ui.mapPlace.lat, lng: ui.mapPlace.lng, z: 2000, html: '<span class="dag-pin dag-pin--place" aria-pressed="true"><span class="dag-pin__body">' + ic('cup') + '</span><span class="dag-pin__tip"></span></span>' });
        }
        map.setPins(pins);
      }
      drawSheet(list, placed);
    }

    function drawSheet(list, placed) {
      var it = list.find(function (x) { return x.key === ui.mapSel; });
      var pl = ui.mapSel === 'place' ? ui.mapPlace : null;
      var html = '<div class="dag-sheet__grip"></div>';
      if (pl) {
        html += '<div class="app-mapsheet__row"><span class="app-place-dot">' + ic('cup') + '</span>' +
          '<div class="app-mapsheet__info"><p class="dag-title">' + esc(pl.name || pl.address) + '</p><p class="dag-cafe__meta">' + esc(pl.name ? Geo.sub(pl) : [pl.barrio, pl.city].filter(Boolean).join(', ')) + '</p></div></div>' +
          '<div class="app-sheet-actions" style="margin-top:12px"><button type="button" class="dag-btn dag-btn--sm" id="mp-review">' + ic('plus') + 'Reseñarla</button>' +
          '<button type="button" class="dag-btn dag-btn--sm dag-btn--secondary" id="mp-wish">' + ic('wishlist') + 'A la wishlist</button></div>';
      } else if (it && it.kind === 'cafe') {
        var rk = S.rankOf(it.c.id);
        html += '<div class="app-mapsheet__row">' + badge(it.s.avg, 'dag-score--lg') +
          '<a class="app-mapsheet__info" href="#/cafe/' + it.c.id + '"><p class="dag-title">' + esc(it.c.name) + '</p><p class="dag-cafe__meta">' + joinMeta([it.c.barrio, rk ? '#' + rk.pos : '', DAG.bandWord(r1(it.s.avg))]) + '</p></a>' +
          '<a class="dag-btn dag-btn--secondary dag-btn--icon" href="' + routeUrl(it.c) + '" target="_blank" rel="noopener" aria-label="Cómo llegar">' + ic('route') + '</a></div>';
      } else if (it && it.kind === 'wish') {
        html += '<div class="app-mapsheet__row"><span class="dag-wish__icon">' + ic('wishlist') + '</span>' +
          '<div class="app-mapsheet__info"><p class="dag-title">' + esc(it.c.name) + '</p><p class="dag-cafe__meta">' + (it.c.why ? esc(it.c.why) : joinMeta([it.c.barrio, 'Pendiente'])) + '</p></div>' +
          '<a class="dag-btn dag-btn--sm" href="#/nueva?wish=' + it.c.id + '">' + ic('check') + 'Ya fui</a></div>';
      } else if (!list.length) {
        html += '<p class="app-mapsheet__note">' + (ui.mapFilter === 'wishlist' ? 'No tenés pendientes. Buscá una cafetería y guardala.' : ui.mapFilter === 'top' ? 'Todavía ninguna llegó al 9. Seguí buscando.' : 'El mapa está vacío. Buscá una cafetería arriba para arrancar.') + '</p>';
      } else {
        var missing = list.length - placed.length;
        html += '<p class="app-mapsheet__note">' + plural(placed.length, 'lugar en el mapa', 'lugares en el mapa') + '. Tocá un pin o buscá uno nuevo.' +
          (missing ? ' <span class="dag-muted">' + plural(missing, 'no tiene', 'no tienen') + ' ubicación.</span>' : '') + '</p>';
      }
      sheetEl.innerHTML = html;
      mapEl.style.setProperty('--sheet-h', sheetEl.offsetHeight + 'px');
      if (pl) {
        sheetEl.querySelector('#mp-review').addEventListener('click', function () { ui.pendingPlace = pl; go('#/nueva?lugar=1'); });
        sheetEl.querySelector('#mp-wish').addEventListener('click', function () {
          var w = S.addWish({ name: pl.name || pl.address, barrio: pl.barrio, address: pl.address, lat: pl.lat, lng: pl.lng });
          if (ui.mapFilter === 'top') ui.mapFilter = 'todas';
          view.querySelectorAll('#mp-filters .dag-chip').forEach(function (c) { c.setAttribute('aria-pressed', String(c.getAttribute('data-f') === ui.mapFilter)); });
          select('wish:' + w.id);
          toast('A la wishlist. Ahora no te la olvidás.');
        });
      }
    }

    // el punto elegido queda entre el buscador y el sheet
    function focusSel() {
      if (!map) return;
      var target = ui.mapSel === 'place' ? ui.mapPlace : (items().find(function (it) { return it.key === ui.mapSel; }) || {}).c;
      if (!hasLL(target)) return;
      var top = 130, bottom = sheetEl.offsetHeight;
      map.centerOn(target.lat, target.lng, Math.max(15, map.map.getZoom()), (bottom - top) / 2);
    }
    function centerAll() {
      if (!map) return;
      if (ui.mapSel) { focusSel(); return; }
      var pts = items().filter(function (it) { return hasLL(it.c); }).map(function (it) { return it.c; });
      if (!map.fit(pts, { top: 140, bottom: sheetEl.offsetHeight + 16 })) map.centerOn(Geo.BA.lat, Geo.BA.lng, 12);
    }

    view.querySelector('#mp-filters').addEventListener('click', function (e) {
      var c = e.target.closest('.dag-chip'); if (!c) return;
      ui.mapFilter = c.getAttribute('data-f'); ui.mapSel = null; ui.mapPlace = null; draw(); centerAll();
    });
    var q = view.querySelector('#mp-q');
    Geo.attach(q, {
      list: view.querySelector('#mp-results'),
      near: function () { return map ? map.center() : Geo.BA; },
      local: function (txt) {
        txt = txt.toLowerCase();
        if (!txt) return '';
        var hits = items().filter(function (it) { return hasLL(it.c) && (it.c.name + ' ' + it.c.barrio).toLowerCase().indexOf(txt) >= 0; }).slice(0, 3);
        return hits.length ? '<p class="app-suggest__head">Tuyas</p>' + hits.map(function (it) {
          return '<button type="button" class="app-suggest__item" data-local="' + it.key + '">' + ic(it.kind === 'wish' ? 'wishlist' : 'cup') +
            '<span class="app-suggest__txt"><b>' + esc(it.c.name) + '</b><span class="dag-muted">' + esc(it.kind === 'wish' ? 'En tu wishlist' : joinMeta([it.c.barrio, 'Nota ' + num(it.s.avg)])) + '</span></span></button>';
        }).join('') : '';
      },
      onLocal: function (el) { q.value = ''; q.blur(); select(el.getAttribute('data-local')); },
      onPick: function (pl) {
        q.value = ''; q.blur();
        var mine = pl.name && items().find(function (it) { return hasLL(it.c) && it.c.name.toLowerCase() === pl.name.toLowerCase() && Geo.km(it.c, pl) < 0.3; });
        if (mine) { select(mine.key); return; }
        ui.mapPlace = pl; select('place');
      }
    });

    draw();
    requestAnimationFrame(function () { if (map) map.invalidate(); centerAll(); });
    if (focus) history.replaceState(null, '', '#/mapa');
  };

  // ================= WISHLIST =================
  VIEWS.wishlist = function () {
    var list = S.wishlist();
    var html = '<div class="dag-screen__head app-head"><h1 class="dag-display">Wishlist</h1>' +
      '<button type="button" class="dag-btn dag-btn--secondary dag-btn--icon" id="ws-add" aria-label="Agregar a la wishlist">' + ic('plus') + '</button></div>';
    if (!list.length) {
      html += '<div class="app-empty"><span class="app-empty__mark app-empty__mark--wish">' + DAG.icon('wishlist') + '</span><p>No tenés pendientes. Anotá la próxima antes de que te la olvides.</p>' +
        '<button type="button" class="dag-btn" id="ws-add2">' + ic('plus') + 'Guardar una cafetería</button></div>';
    } else {
      html += '<p class="dag-muted app-sub">' + plural(list.length, 'cafetería por probar', 'cafeterías por probar') + '</p><div class="dag-stack">' +
        list.map(function (w) {
          var d = w.savedAt ? parseDate(w.savedAt) : null;
          var when = d ? 'guardada en ' + MONTHS[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? ' de ' + d.getFullYear() : '') : '';
          return '<div class="dag-wish"><span class="dag-wish__icon">' + ic('wishlist') + '</span><div style="min-width:0"><p class="dag-wish__name">' + esc(w.name) + '</p>' +
            '<p class="dag-wish__meta">' + joinMeta([w.barrio, when]) + '</p>' +
            (w.why ? '<p class="dag-wish__note"><b>Por qué:</b> ' + esc(w.why) + '</p>' : '') + '</div>' +
            '<div class="dag-wish__actions"><a class="dag-btn dag-btn--sm" href="#/nueva?wish=' + w.id + '">' + ic('check') + 'Ya fui</a>' +
            (hasLL(w) ? '<a class="dag-btn dag-btn--sm dag-btn--secondary" href="#/mapa?foco=wish:' + w.id + '">' + ic('map') + 'Mapa</a>' : '') +
            '<button type="button" class="dag-btn dag-btn--sm dag-btn--ghost app-btn-danger-ghost" data-del="' + w.id + '" aria-label="Sacar ' + esc(w.name) + ' de la wishlist">Sacar</button></div></div>';
        }).join('') + '</div>';
    }
    view.innerHTML = html;
    view.querySelectorAll('#ws-add, #ws-add2').forEach(function (b) { b.addEventListener('click', openWishForm); });
    view.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        var w = S.wish(b.getAttribute('data-del'));
        confirmSheet('¿Sacás ' + w.name + '?', 'Se va de la wishlist y del mapa.', 'Sacar').then(function (ok) {
          if (ok) { S.deleteWish(w.id); render(); toast('Afuera.'); }
        });
      });
    });
  };

  function openWishForm() {
    openSheet('<h2 class="dag-title app-sheet-title">Guardala para después</h2><form id="wf" class="dag-stack" novalidate>' +
      '<div class="app-pop"><label class="dag-field"><span class="app-field-label">Nombre</span><input class="dag-input" id="wf-name" placeholder="Buscala por nombre" autocomplete="off"></label>' +
      '<div id="wf-suggest" class="app-suggest app-suggest--pop" hidden></div></div>' +
      '<p class="app-error" id="wf-err" hidden>Poné el nombre.</p>' +
      '<label class="dag-field"><span class="app-field-label">Barrio</span><input class="dag-input" id="wf-barrio" placeholder="Opcional"></label>' +
      '<label class="dag-field"><span class="app-field-label">¿Por qué?</span><input class="dag-input" id="wf-why" placeholder="Quién te la recomendó, qué tienen…"></label>' +
      '<div class="app-pop"><label class="dag-search app-search-input">' + ic('search') + '<input id="wf-address" placeholder="Dirección (opcional)" autocomplete="off"></label>' +
      '<div id="wf-addr-suggest" class="app-suggest app-suggest--pop" hidden></div></div>' +
      '<div class="dag-map app-pickmap app-pickmap--sm" id="wf-map" aria-label="Mapa: tocá para marcar el lugar"></div><p class="app-hint" id="wf-hint"></p>' +
      '<button type="submit" class="dag-btn dag-btn--block">' + ic('wishlist') + 'Guardar en la wishlist</button></form>',
      function (sheet, done) {
        var loc = placeFields({
          mapEl: sheet.querySelector('#wf-map'), hintEl: sheet.querySelector('#wf-hint'),
          addrInput: sheet.querySelector('#wf-address'), addrList: sheet.querySelector('#wf-addr-suggest'),
          barrioInput: function () { return sheet.querySelector('#wf-barrio'); }, pin: pinWish(), point: null
        });
        setTimeout(function () { loc.invalidate(); }, 220); // el sheet sube animado
        var name = sheet.querySelector('#wf-name');
        Geo.attach(name, {
          list: sheet.querySelector('#wf-suggest'), near: loc.near,
          onPick: function (pl) { if (pl.name) name.value = pl.name; loc.applyPlace(pl); sheet.querySelector('#wf-err').hidden = true; }
        });
        sheet.querySelector('#wf').addEventListener('submit', function (e) {
          e.preventDefault();
          var n = name.value.trim();
          if (!n) { sheet.querySelector('#wf-err').hidden = false; name.focus(); return; }
          var pt = loc.point();
          S.addWish({ name: n, barrio: sheet.querySelector('#wf-barrio').value, why: sheet.querySelector('#wf-why').value, address: sheet.querySelector('#wf-address').value, lat: pt ? pt.lat : null, lng: pt ? pt.lng : null });
          done(); render(); toast('Guardada. Ahora no te la olvidás.');
        });
        // el mapa se libera cuando se cierra el sheet
        var obs = new MutationObserver(function () { if (!document.body.contains(sheet)) { obs.disconnect(); loc.destroy(); } });
        obs.observe(document.body, { childList: true });
      });
  }

  // ================= DIARIO =================
  VIEWS.diario = function () {
    var visits = S.visits();
    var html = '<div class="dag-screen__head app-head"><h1 class="dag-display">Diario</h1>' +
      '<button type="button" class="dag-btn dag-btn--ghost dag-btn--icon" id="dy-more" aria-label="Ajustes">' + ic('more') + '</button></div>';
    if (!visits.length) {
      html += '<div class="app-empty"><span class="app-empty__mark app-empty__mark--muted">' + DAG.icon('journal') + '</span><p>Tu diario está en blanco. Cada visita queda acá, con fecha.</p><a class="dag-btn" href="#/nueva">' + ic('plus') + 'Nueva review</a></div>';
    } else {
      var cafes = {}; visits.forEach(function (v) { cafes[v.cafeId] = 1; });
      html += '<p class="dag-muted app-sub">' + plural(visits.length, 'visita', 'visitas') + ' en ' + plural(Object.keys(cafes).length, 'cafetería', 'cafeterías') + '</p>';
      var groups = [], cur = null;
      visits.forEach(function (v) {
        var k = v.date.slice(0, 7);
        if (!cur || cur.k !== k) { cur = { k: k, items: [] }; groups.push(cur); }
        cur.items.push(v);
      });
      html += groups.map(function (g) {
        var d = parseDate(g.k + '-01');
        return '<section class="dag-section"><p class="dag-label">' + cap(MONTHS[d.getMonth()]) + ' ' + d.getFullYear() + '</p><div class="dag-stack" style="gap:8px">' +
          g.items.map(function (v) {
            var c = S.cafe(v.cafeId), dd = parseDate(v.date);
            return '<a class="dag-card app-diary" href="#/cafe/' + v.cafeId + '"><span class="app-diary__date"><b>' + dd.getDate() + '</b><span>' + DAYS[dd.getDay()] + '</span></span>' +
              '<span style="min-width:0"><p class="dag-cafe__name" style="font-size:17px">' + esc(c ? c.name : '—') + '</p><p class="dag-cafe__meta">' +
              joinMeta([v.drink, v.food ? (v.food.name || 'Comida') : '', c ? c.barrio : '']) + '</p></span>' + scoreCol(v.score, 'dag-score--sm') + '</a>';
          }).join('') + '</div></section>';
      }).join('');
    }
    view.innerHTML = html;
    view.querySelector('#dy-more').addEventListener('click', openSettings);
  };

  // ================= AJUSTES =================
  function openSettings() {
    var pref = S.prefs().theme || 'system';
    var hasData = S.cafes().length || S.wishlist().length;
    openSheet('<h2 class="dag-title app-sheet-title">Ajustes</h2>' +
      '<div class="dag-section"><p class="dag-label">Tema</p><div class="dag-chips" data-single id="st-theme">' +
      [['system', 'Como el teléfono'], ['light', 'Crema'], ['dark', 'Espresso']].map(function (t) {
        return '<button type="button" class="dag-chip" data-t="' + t[0] + '" aria-pressed="' + (pref === t[0]) + '">' + t[1] + '</button>';
      }).join('') + '</div></div>' +
      '<div class="dag-section"><p class="dag-label">Cuenta</p><p class="app-account">' +
      (S.auth.name() ? '<b>' + esc(S.auth.name()) + '</b>' : '') + '<span>' + esc(S.auth.user() ? S.auth.user().email : '') + '</span></p>' +
      '<button type="button" class="dag-btn dag-btn--secondary dag-btn--block" id="st-logout">Cerrar sesión</button></div>' +
      '<div class="dag-section"><p class="dag-label">Tus datos</p><p class="app-hint" style="margin:0">Se guardan en tu cuenta y los ves desde cualquier dispositivo. Igual podés bajarte una copia.</p>' +
      '<div class="app-sheet-actions"><button type="button" class="dag-btn dag-btn--secondary" id="st-export"' + (hasData ? '' : ' disabled') + '>Exportar</button>' +
      '<label class="dag-btn dag-btn--secondary" tabindex="0">Importar<input type="file" accept="application/json,.json" id="st-import" hidden></label></div>' +
      (hasData ? '<button type="button" class="dag-btn dag-btn--ghost app-btn-danger-ghost" id="st-reset">Empezar de cero</button>'
        : '<button type="button" class="dag-btn dag-btn--ghost" id="st-seed">Cargar datos de ejemplo</button>') + '</div>',
      function (sheet, close) {
        sheet.querySelector('#st-theme').addEventListener('click', function (e) {
          var c = e.target.closest('[data-t]'); if (!c) return;
          S.setPref('theme', c.getAttribute('data-t')); applyTheme();
        });
        var ex = sheet.querySelector('#st-export');
        ex.addEventListener('click', function () {
          var blob = new Blob([S.exportJSON()], { type: 'application/json' });
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob); a.download = 'directo-al-grano-' + S.today() + '.json';
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
          toast('Copia descargada.');
        });
        var imp = sheet.querySelector('#st-import');
        imp.parentElement.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); imp.click(); } });
        imp.addEventListener('change', function () {
          var f = imp.files[0]; if (!f) return;
          f.text().then(function (t) {
            try { S.importJSON(t); close(); applyTheme(); render(); toast('Datos importados.'); }
            catch (err) { toast('Ese archivo no parece una copia de Directo al grano.'); }
          });
        });
        var rs = sheet.querySelector('#st-reset');
        if (rs) rs.addEventListener('click', function () {
          close();
          confirmSheet('¿Borrás todo?', 'Reviews, visitas y wishlist. No hay vuelta atrás: si querés, exportá antes.', 'Borrar todo').then(function (ok) {
            if (ok) { S.reset(); go('#/ranking', true); render(); toast('Todo en blanco.'); }
          });
        });
        var sd = sheet.querySelector('#st-seed');
        if (sd) sd.addEventListener('click', function () { S.seed(); close(); render(); toast('Listo: siete cafeterías de ejemplo.'); });
        var lo = sheet.querySelector('#st-logout');
        lo.addEventListener('click', function () {
          lo.disabled = true; lo.textContent = 'Cerrando…';
          S.auth.signOut().then(function (res) {
            if (res.error) { lo.disabled = false; lo.textContent = 'Cerrar sesión'; toast('No pude cerrar la sesión. Probá de nuevo.'); return; }
            close();
          });
        });
      });
  }

  // ================= CUENTA =================
  var AUTH_ERRORS = {
    invalid_credentials: 'El mail o la contraseña no coinciden.',
    email_not_confirmed: 'Todavía no confirmaste el mail. Buscá el link en tu casilla (y en spam).',
    user_already_exists: 'Ese mail ya tiene cuenta. Entrá con tu contraseña.',
    email_exists: 'Ese mail ya tiene cuenta. Entrá con tu contraseña.',
    weak_password: 'Esa contraseña es muy fácil. Probá con una más larga.',
    same_password: 'Es la misma que tenías. Elegí otra.',
    over_email_send_rate_limit: 'Mandamos muchos mails seguidos. Esperá un rato y probá de nuevo.',
    over_request_rate_limit: 'Muchos intentos seguidos. Esperá un minuto.',
    email_address_invalid: 'Ese mail no parece válido.',
    signup_disabled: 'Por ahora no se pueden crear cuentas nuevas.'
  };
  function authError(err) {
    if (!err) return '';
    if (AUTH_ERRORS[err.code]) return AUTH_ERRORS[err.code];
    var m = String(err.message || '');
    if (/invalid login credentials/i.test(m)) return AUTH_ERRORS.invalid_credentials;
    if (/email not confirmed/i.test(m)) return AUTH_ERRORS.email_not_confirmed;
    if (/already registered/i.test(m)) return AUTH_ERRORS.user_already_exists;
    if (/password should be at least/i.test(m)) return 'La contraseña necesita al menos ' + (m.match(/\d+/) || ['6'])[0] + ' caracteres.';
    if (/rate limit/i.test(m)) return AUTH_ERRORS.over_request_rate_limit;
    if (/fetch|network/i.test(m)) return 'Sin conexión. Revisá internet y probá de nuevo.';
    return 'Algo falló: ' + m;
  }
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var MIN_PASS = 8;

  function authShell(title, sub, body, foot) {
    return '<div class="app-auth">' +
      '<span class="dag-logo app-auth__logo"><span class="dag-logo__mark">' + DAG.mark() + '</span>' +
      '<span class="dag-logo__word">Directo <em>al</em> grano</span></span>' +
      '<h1 class="dag-display">' + title + '</h1><p class="dag-muted app-auth__sub">' + sub + '</p>' +
      (S.auth.configured() ? body :
        '<p class="app-error" role="alert">Falta conectar Supabase: completá <code>js/config.js</code> con la URL y la anon key de tu proyecto.</p>') +
      (foot ? '<div class="app-auth__foot">' + foot + '</div>' : '') + '</div>';
  }
  function field(id, label, attrs, hint) {
    return '<label class="dag-field"><span class="app-field-label">' + label + '</span><input class="dag-input" id="' + id + '" ' + attrs + '>' +
      (hint ? '<span class="dag-field__hint"><span>' + hint + '</span></span>' : '') + '</label>';
  }
  function passField(id, label, autocomplete, hint) {
    return '<div class="dag-field"><label class="app-field-label" for="' + id + '">' + label + '</label>' +
      '<span class="app-pass"><input class="dag-input" id="' + id + '" type="password" autocomplete="' + autocomplete + '" required minlength="' + MIN_PASS + '">' +
      '<button type="button" class="app-pass__toggle" aria-controls="' + id + '" aria-pressed="false">Ver</button></span>' +
      (hint ? '<span class="dag-field__hint"><span>' + hint + '</span></span>' : '') + '</div>';
  }
  // Conecta "Ver/Ocultar", el submit con estado de carga y el mensaje de error de un formulario de cuenta.
  function wireAuthForm(form, busyLabel, onSubmit) {
    var btn = form.querySelector('[type=submit]'), label = btn.textContent;
    var err = form.querySelector('.app-error');
    form.querySelectorAll('.app-pass__toggle').forEach(function (t) {
      t.addEventListener('click', function () {
        var inp = document.getElementById(t.getAttribute('aria-controls'));
        var show = inp.type === 'password';
        inp.type = show ? 'text' : 'password';
        t.textContent = show ? 'Ocultar' : 'Ver'; t.setAttribute('aria-pressed', String(show));
      });
    });
    function fail(msg, focusEl) {
      err.textContent = msg; err.hidden = !msg;
      btn.disabled = false; btn.textContent = label;
      if (focusEl) focusEl.focus();
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (btn.disabled) return;
      err.hidden = true;
      btn.disabled = true; btn.textContent = busyLabel;
      onSubmit(fail);
    });
  }

  VIEWS.entrar = function () {
    var linkErr = ui.linkErrShown ? '' : S.auth.urlError();
    ui.linkErrShown = true;
    view.innerHTML = authShell('Entrá', 'Tu ranking te espera donde lo dejaste.',
      '<form class="dag-stack app-auth__form" novalidate>' +
      field('au-email', 'Mail', 'type="email" autocomplete="email" inputmode="email" autocapitalize="none" spellcheck="false" required') +
      passField('au-pass', 'Contraseña', 'current-password') +
      '<p class="app-error" role="alert"' + (linkErr ? '' : ' hidden') + '>' + (linkErr ? 'Ese link ya no sirve (venció o ya lo usaste). Pedí otro.' : '') + '</p>' +
      '<button type="submit" class="dag-btn dag-btn--block">Entrar</button>' +
      '<a class="app-auth__link" href="#/recuperar">Me olvidé la contraseña</a></form>',
      '¿Primera vez? <a href="#/registro">Creá tu cuenta</a>');
    var form = view.querySelector('form'); if (!form) return;
    var email = form.querySelector('#au-email'), pass = form.querySelector('#au-pass');
    if (ui.authEmail) email.value = ui.authEmail;
    wireAuthForm(form, 'Entrando…', function (fail) {
      var em = email.value.trim(); ui.authEmail = em;
      if (!EMAIL_RE.test(em)) return fail('Escribí tu mail.', email);
      if (!pass.value) return fail('Falta la contraseña.', pass);
      S.auth.signIn(em, pass.value).then(function (res) {
        if (res.error) fail(authError(res.error), res.error.code === 'email_not_confirmed' ? null : pass);
        // si salió bien, onChange carga los datos y lleva al ranking
      }, function (e) { fail(authError(e)); });
    });
  };

  VIEWS.registro = function () {
    view.innerHTML = authShell('Registrate', 'Una cuenta y tus reviews te siguen a cualquier lado.',
      '<form class="dag-stack app-auth__form" novalidate>' +
      field('au-name', 'Nombre <span class="dag-muted app-label-opt">(opcional)</span>', 'type="text" autocomplete="given-name" maxlength="40"') +
      field('au-email', 'Mail', 'type="email" autocomplete="email" inputmode="email" autocapitalize="none" spellcheck="false" required') +
      passField('au-pass', 'Contraseña', 'new-password', 'Mínimo ' + MIN_PASS + ' caracteres.') +
      '<p class="app-error" role="alert" hidden></p>' +
      '<button type="submit" class="dag-btn dag-btn--block">Crear cuenta</button></form>',
      '¿Ya tenés cuenta? <a href="#/entrar">Entrá</a>');
    var form = view.querySelector('form'); if (!form) return;
    var name = form.querySelector('#au-name'), email = form.querySelector('#au-email'), pass = form.querySelector('#au-pass');
    if (ui.authEmail) email.value = ui.authEmail;
    wireAuthForm(form, 'Creando…', function (fail) {
      var em = email.value.trim(); ui.authEmail = em;
      if (!EMAIL_RE.test(em)) return fail('Ese mail no parece válido.', email);
      if (pass.value.length < MIN_PASS) return fail('La contraseña necesita al menos ' + MIN_PASS + ' caracteres.', pass);
      S.auth.signUp(em, pass.value, name.value.trim()).then(function (res) {
        if (res.error) return fail(authError(res.error), res.error.code === 'user_already_exists' ? null : pass);
        if (res.needsConfirm) {
          view.querySelector('.app-auth').innerHTML = '<span class="app-empty__mark">' + DAG.icon('check') + '</span>' +
            '<h1 class="dag-display">Revisá tu mail</h1>' +
            '<p class="dag-muted app-auth__sub">Te mandamos un link a <b>' + esc(em) + '</b>. Tocalo y quedás adentro. Si no llega, fijate en spam.</p>' +
            '<a class="dag-btn dag-btn--secondary dag-btn--block" href="#/entrar">Ya lo confirmé</a>';
        }
        // sin confirmación por mail, onChange ya entra solo
      }, function (e) { fail(authError(e)); });
    });
  };

  VIEWS.recuperar = function () {
    view.innerHTML = authShell('Contraseña', 'Pasá tu mail y te mandamos un link para elegir una nueva.',
      '<form class="dag-stack app-auth__form" novalidate>' +
      field('au-email', 'Mail', 'type="email" autocomplete="email" inputmode="email" autocapitalize="none" spellcheck="false" required') +
      '<p class="app-error" role="alert" hidden></p>' +
      '<button type="submit" class="dag-btn dag-btn--block">Mandar link</button></form>',
      '<a href="#/entrar">Volver a entrar</a>');
    var form = view.querySelector('form'); if (!form) return;
    var email = form.querySelector('#au-email');
    if (ui.authEmail) email.value = ui.authEmail;
    wireAuthForm(form, 'Mandando…', function (fail) {
      var em = email.value.trim(); ui.authEmail = em;
      if (!EMAIL_RE.test(em)) return fail('Ese mail no parece válido.', email);
      S.auth.resetPassword(em).then(function (res) {
        if (res.error) return fail(authError(res.error));
        // misma respuesta exista o no la cuenta: no se revela quién está registrado
        form.innerHTML = '<p class="app-auth__done">Si hay una cuenta con <b>' + esc(em) + '</b>, te llegó un link. Abrilo en este mismo navegador.</p>';
      }, function (e) { fail(authError(e)); });
    });
  };

  function openNewPassword() {
    openSheet('<h2 class="dag-title app-sheet-title">Nueva contraseña</h2>' +
      '<form class="dag-stack" novalidate>' + passField('np-pass', 'Contraseña nueva', 'new-password', 'Mínimo ' + MIN_PASS + ' caracteres.') +
      '<p class="app-error" role="alert" hidden></p><button type="submit" class="dag-btn dag-btn--block">Guardar</button></form>',
      function (sheet, close) {
        var form = sheet.querySelector('form'), pass = form.querySelector('#np-pass');
        wireAuthForm(form, 'Guardando…', function (fail) {
          if (pass.value.length < MIN_PASS) return fail('La contraseña necesita al menos ' + MIN_PASS + ' caracteres.', pass);
          S.auth.updatePassword(pass.value).then(function (res) {
            if (res.error) return fail(authError(res.error), pass);
            close(); toast('Contraseña cambiada.');
          }, function (e) { fail(authError(e)); });
        });
      });
  }

  VIEWS.error = function () {
    view.innerHTML = '<div class="app-empty"><span class="app-empty__mark app-empty__mark--muted">' + DAG.mark() + '</span>' +
      '<p>No pude traer tus reviews. Revisá la conexión.</p>' +
      '<button type="button" class="dag-btn" id="er-retry">Reintentar</button>' +
      '<button type="button" class="dag-btn dag-btn--ghost" id="er-out">Cerrar sesión</button></div>';
    view.querySelector('#er-retry').addEventListener('click', function () {
      this.disabled = true; this.textContent = 'Cargando…';
      S.reload().then(render);
    });
    view.querySelector('#er-out').addEventListener('click', function () { S.auth.signOut(); });
  };

  // ---------- arranque ----------
  tabbar.addEventListener('click', function () { navigatedInApp = true; });
  view.addEventListener('click', function (e) { if (e.target.closest('a[href^="#/"]')) navigatedInApp = true; });
  DAG.hydrate(tabbar);
  applyTheme();
  view.innerHTML = '<div class="app-boot" aria-label="Cargando"><span class="app-empty__mark">' + DAG.mark() + '</span></div>';
  document.body.classList.add('no-tabbar');

  var saveErrorShown = 0;
  S.onError(function () {
    if (!booted || !S.auth.user() || S.loadError() || Date.now() - saveErrorShown < 5000) return;
    saveErrorShown = Date.now();
    toast('No se pudo guardar el último cambio. Revisá la conexión.');
  });

  S.auth.onChange(function (event, changed) {
    if (!booted) return;
    if (changed) {
      navigatedInApp = false;
      setHash(S.auth.user() ? '#/ranking' : '#/entrar');
      render();
      if (S.auth.user() && !S.loadError()) toast(S.auth.name() ? 'Hola, ' + S.auth.name() + '.' : 'Adentro.');
    }
    if (S.auth.takeRecovery()) openNewPassword();
  });

  S.auth.ready().then(function () {
    booted = true;
    var fromLink = S.auth.fromEmailLink(), type = S.auth.linkType();
    if (fromLink) setHash(S.auth.user() ? '#/ranking' : '#/entrar'); // saca los tokens de la URL
    render();
    if (S.auth.takeRecovery()) openNewPassword();
    else if (fromLink && S.auth.user() && type === 'signup') toast('Mail confirmado. Ya estás adentro.');
  });
})();
