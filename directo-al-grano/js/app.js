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
  var HERO_LABEL = { general: 'Tu número 1', cafe: 'Mejor café', lugar: 'Mejor lugar', atencion: 'Mejor atención', precio: 'Mejor precio/calidad', comida: 'Mejor comida' };

  // Ranking tiene tres vistas: el tuyo, el de toda la app y el de otra persona.
  function rankSeg(cur) {
    return '<nav class="app-seg" aria-label="Rankings">' + [['ranking', 'Mío'], ['global', 'Global'], ['personas', 'Personas']].map(function (t) {
      return '<a class="app-seg__opt" href="#/' + t[0] + '"' + (t[0] === cur ? ' aria-current="page"' : '') + '>' + t[1] + '</a>';
    }).join('') + '</nav>';
  }

  var ui = { rankKey: 'general', rankQuery: '', peopleQuery: '', searchOpen: false, mapFilter: 'todas', mapSel: null, mapPlace: null, pendingPlace: null };
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
    screenId++;
    if (!booted) return;
    var r = route();
    // Sin sesión, solo las pantallas de cuenta; con sesión, nunca.
    if (!S.auth.user() && !AUTH_VIEWS[r.name]) { setHash('#/entrar'); r = route(); }
    else if (S.auth.user() && AUTH_VIEWS[r.name]) { setHash('#/ranking'); r = route(); }
    var fn = S.auth.user() && S.loadError() ? VIEWS.error : VIEWS[r.name] || VIEWS.ranking;
    var tab = { ranking: 'ranking', cafe: 'ranking', global: 'ranking', personas: 'ranking', persona: 'ranking', mapa: 'mapa', wishlist: 'wishlist', diario: 'diario' }[r.name] || '';
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
      (cafes.length ? '<button type="button" class="dag-btn dag-btn--ghost dag-btn--icon" id="rk-search-btn" aria-label="Buscar" aria-expanded="' + ui.searchOpen + '">' + ic('search') + '</button>' : '') +
      '<button type="button" class="dag-btn dag-btn--ghost dag-btn--icon" id="rk-more" aria-label="Ajustes">' + ic('more') + '</button></span></div>';

    if (!cafes.length) {
      view.innerHTML = head + '<h1 class="app-sr">Ranking</h1>' + rankSeg('ranking') +
        '<div class="app-empty"><span class="app-empty__mark">' + DAG.mark() + '</span>' +
        '<p>Todavía no reseñaste nada. El primer cortado corre por tu cuenta.</p>' +
        '<a class="dag-btn" href="#/nueva">' + ic('plus') + 'Nueva review</a>' +
        (S.hasLegacy() ? '<button type="button" class="dag-btn dag-btn--secondary" id="rk-legacy">Subir lo que tenías en este navegador</button>' : '') +
        '</div>';
      var lg = view.querySelector('#rk-legacy');
      if (lg) lg.addEventListener('click', function () {
        try { S.importLegacy(); render(); toast('Listo: tus reviews ya están en tu cuenta.'); }
        catch (err) { toast('No pude leer lo que había en este navegador.'); }
      });
      view.querySelector('#rk-more').addEventListener('click', openSettings);
      return;
    }

    view.innerHTML = head + '<h1 class="app-sr">Ranking</h1>' + rankSeg('ranking') +
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

  // ---------- @usuario: campo con chequeo en vivo ----------
  function handleField(id, value, label) {
    return '<div class="dag-field"><label class="app-field-label" for="' + id + '">' + label + '</label>' +
      '<span class="app-handle"><span class="app-handle__at" aria-hidden="true">@</span><input class="dag-input" id="' + id + '" value="' + esc(value || '') + '"' +
      ' maxlength="21" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" aria-describedby="' + id + '-hint"></span>' +
      '<span class="dag-field__hint"><span id="' + id + '-hint" aria-live="polite">Único. Minúsculas, números, punto y guion bajo.</span></span></div>';
  }
  // Normaliza mientras escribís (sin @, minúsculas, espacios a _) y avisa si está libre.
  // Devuelve check(): Promise con el problema ('' si está bien). current = tu @ actual.
  function wireHandle(input, current) {
    var hint = document.getElementById(input.id + '-hint'), base = hint.textContent, timer = null, seq = 0;
    function say(msg, kind) { hint.textContent = msg || base; hint.setAttribute('data-state', kind || ''); }
    function check() {
      var u = S.USERNAME.clean(input.value), bad = S.USERNAME.problem(u);
      if (bad) return Promise.resolve(bad);
      if (u === current) return Promise.resolve('');
      // null = no se pudo saber: se deja seguir, la base igual rechaza un @ repetido
      return S.community.usernameAvailable(u).then(function (ok) { return ok === false ? '@' + u + ' ya está tomado.' : ''; });
    }
    input.addEventListener('input', function () {
      var c = input.value.replace(/^@+/, '').toLowerCase().replace(/\s/g, '_');
      if (c !== input.value) {
        var pos = Math.max(0, (input.selectionStart || 0) - (input.value.length - c.length));
        input.value = c; try { input.setSelectionRange(pos, pos); } catch (e) { /* nada */ }
      }
      clearTimeout(timer); seq++;
      if (!c || c.length < 3) { say(); return; }
      var bad = S.USERNAME.problem(c);
      if (bad) { say(bad, 'bad'); return; }
      if (c === current) { say('Es el tuyo.', 'ok'); return; }
      say('Fijándome si está libre…');
      var mine = seq;
      timer = setTimeout(function () {
        S.community.usernameAvailable(c).then(function (ok) {
          if (mine !== seq) return;
          if (ok === true) say('@' + c + ' está libre.', 'ok');
          else if (ok === false) say('@' + c + ' ya está tomado.', 'bad');
          else say();
        });
      }, 350);
    });
    return check;
  }
  function usernameError(err) {
    if (err.taken) return 'Ese @ ya está tomado. Probá otro.';
    if (err.invalid) return 'Ese @ no sirve: minúsculas, números, punto y guion bajo.';
    if (err.missing) return 'Falta activar la comunidad en Supabase (supabase/comunidad.sql).';
    return 'No pude guardarlo. Probá de nuevo.';
  }

  // Cuentas sin @ (las de antes, o si justo se lo ganaron al registrarse): se pide al entrar.
  function openUsernameSheet() {
    var u = S.auth.user(); if (!u) return;
    var sug = S.USERNAME.suggest((u.user_metadata || {}).username || (u.user_metadata || {}).name || '');
    openSheet('<h2 class="dag-title app-sheet-title">Elegí tu nombre de usuario</h2>' +
      '<p class="dag-muted app-sheet-text">Es único y con él te encuentran en Personas. Después lo podés cambiar en Ajustes.</p>' +
      '<form class="dag-stack" novalidate>' + handleField('us-user', sug, 'Nombre de usuario') +
      '<p class="app-error" role="alert" hidden></p><button type="submit" class="dag-btn dag-btn--block">Listo</button></form>',
      function (sheet, close) {
        var form = sheet.querySelector('form'), input = form.querySelector('#us-user'), check = wireHandle(input, '');
        if (sug) input.dispatchEvent(new Event('input'));
        wireAuthForm(form, 'Guardando…', function (fail) {
          check().then(function (bad) {
            if (bad) return fail(bad, input);
            S.community.setUsername(input.value).then(function (res) {
              if (res.error) return fail(usernameError(res.error), input);
              close(); render(); toast('Listo: sos @' + S.auth.username() + '.');
            });
          });
        });
      });
  }
  function maybeAskUsername() {
    if (S.community.needsUsername() && !document.querySelector('.app-overlay')) openUsernameSheet();
  }

  // ================= COMUNIDAD: ranking global, personas, perfil =================
  function logoHead() {
    return '<div class="dag-screen__head app-head">' +
      '<span class="dag-logo"><span class="dag-logo__mark" style="width:30px;height:30px">' + DAG.mark() + '</span>' +
      '<span class="dag-logo__word" style="font-size:20px">Directo <em>al</em> grano</span></span>' +
      '<button type="button" class="dag-btn dag-btn--ghost dag-btn--icon" data-settings aria-label="Ajustes">' + ic('more') + '</button></div>';
  }
  function bindSettings() {
    view.querySelectorAll('[data-settings]').forEach(function (b) { b.addEventListener('click', openSettings); });
  }
  function loadingLine(txt) { return '<p class="app-empty-line app-loading">' + txt + '</p>'; }
  function commError(box, err, retry) {
    box.innerHTML = '<div class="app-empty"><span class="app-empty__mark app-empty__mark--muted">' + DAG.mark() + '</span><p>' +
      (err && err.missing ? 'La comunidad todavía no está activada: falta correr <code>supabase/comunidad.sql</code> en Supabase.' : 'No pude traer el ranking. Revisá la conexión.') + '</p>' +
      (err && err.missing ? '' : '<button type="button" class="dag-btn dag-btn--secondary" data-retry>Reintentar</button>') + '</div>';
    var b = box.querySelector('[data-retry]');
    if (b) b.addEventListener('click', retry);
  }
  // fila de ranking de otra fuente (global o de otra persona). o: pos, name, meta (html), score, href | i, heroLabel
  function rankRow(o) {
    var open = o.href ? '<a href="' + o.href + '"' : '<button type="button" data-i="' + o.i + '"';
    var close = o.href ? '</a>' : '</button>';
    if (o.heroLabel) {
      return open + ' class="dag-hero app-rowbtn"><span class="dag-hero__bean">' + DAG.mark() + '</span>' +
        '<span class="dag-hero__crown">' + ic('crown') + o.heroLabel + '</span>' +
        '<span><p class="dag-hero__name">' + esc(o.name) + '</p><p class="dag-hero__meta">' + o.meta + '</p>' +
        '<p class="app-hero__band">' + DAG.bandWord(r1(o.score)) + '</p></span>' +
        '<span class="dag-hero__score" aria-label="Nota ' + num(o.score) + '">' + num(o.score) + '</span>' + close;
    }
    return open + ' class="dag-cafe app-rowbtn"><span class="dag-cafe__rank">' + o.pos + '</span>' +
      '<span class="dag-cafe__thumb">' + ic('cup') + '</span>' +
      '<span class="dag-cafe__info"><p class="dag-cafe__name">' + esc(o.name) + '</p><p class="dag-cafe__meta">' + o.meta + '</p></span>' +
      scoreCol(o.score) + close;
  }
  function placeFromRow(r) {
    return {
      name: r.name, barrio: r.barrio || '', address: r.address || '',
      lat: typeof r.lat === 'number' ? r.lat : null, lng: typeof r.lng === 'number' ? r.lng : null,
      placeId: /^[NWR]\d+$/.test(r.place_key || '') ? r.place_key : ''
    };
  }
  function findMine(pl) {
    var n = pl.name.trim().toLowerCase();
    return S.cafes().find(function (c) { return pl.placeId && c.placeId === pl.placeId; }) ||
      S.cafes().find(function (c) { return c.name.trim().toLowerCase() === n && (!hasLL(c) || !hasLL(pl) || Geo.km(c, pl) < 0.3); }) || null;
  }

  // Una cafetería de otro: reseñarla, guardarla, verla en el mapa o ir.
  function openPlaceSheet(pl, metaHtml, score) {
    var mine = findMine(pl);
    var wished = S.wishlist().some(function (w) { return w.name.trim().toLowerCase() === pl.name.trim().toLowerCase(); });
    var where = joinMeta([pl.address, pl.barrio]);
    openSheet('<div class="app-mapsheet__row">' + badge(score, 'dag-score--lg') +
      '<div class="app-mapsheet__info"><h2 class="dag-title">' + esc(pl.name) + '</h2><p class="dag-cafe__meta">' + metaHtml + '</p></div></div>' +
      (where ? '<p class="app-place-line">' + ic('map') + '<span>' + where + '</span></p>' : '') +
      '<div class="app-sheet-actions" style="margin-top:16px">' +
      (mine ? '<a class="dag-btn dag-btn--sm" href="#/cafe/' + mine.id + '">' + ic('cup') + 'Tu review</a>'
        : '<button type="button" class="dag-btn dag-btn--sm" data-review>' + ic('plus') + 'Reseñarla</button>') +
      (mine || wished ? '' : '<button type="button" class="dag-btn dag-btn--sm dag-btn--secondary" data-wish>' + ic('wishlist') + 'A la wishlist</button>') +
      (hasLL(pl) ? '<button type="button" class="dag-btn dag-btn--sm dag-btn--secondary" data-map>' + ic('map') + 'Ver en el mapa</button>' : '') +
      (hasLL(pl) || pl.address ? '<a class="dag-btn dag-btn--sm dag-btn--secondary" href="' + routeUrl(pl) + '" target="_blank" rel="noopener">' + ic('route') + 'Cómo llegar</a>' : '') +
      '</div>',
      function (sheet, close) {
        sheet.addEventListener('click', function (e) {
          if (e.target.closest('a[href^="#/"]')) { navigatedInApp = true; close(); return; }
          if (e.target.closest('[data-review]')) { close(); ui.pendingPlace = pl; go('#/nueva?lugar=1'); return; }
          if (e.target.closest('[data-map]')) {
            close(); ui.mapPlace = { name: pl.name, address: pl.address, barrio: pl.barrio, lat: pl.lat, lng: pl.lng, placeId: pl.placeId };
            ui.mapSel = 'place'; ui.mapFilter = 'todas'; go('#/mapa'); return;
          }
          var w = e.target.closest('[data-wish]');
          if (w) {
            S.addWish({ name: pl.name, barrio: pl.barrio, address: pl.address, lat: pl.lat, lng: pl.lng });
            w.remove(); toast('A la wishlist. Ahora no te la olvidás.');
          }
        });
      });
  }

  var screenId = 0; // sube en cada render: las respuestas que llegan tarde a otra pantalla se descartan
  var cache = { global: null };

  VIEWS.global = function () {
    view.innerHTML = logoHead() + '<h1 class="app-sr">Ranking</h1>' + rankSeg('global') +
      '<p class="dag-muted app-sub app-sub--top">Las cafeterías de toda la app. La nota es el promedio entre personas: cada una cuenta una vez, vaya una vez o veinte.</p>' +
      '<div id="gl-list"></div>';
    bindSettings();
    var box = view.querySelector('#gl-list'), my = screenId;
    function paint(rows) {
      if (!rows.length) { box.innerHTML = '<p class="app-empty-line">Todavía nadie reseñó nada. Arrancá vos.</p>'; return; }
      box.innerHTML = '<div class="dag-stack">' + rows.map(function (r, i) {
        var meta = joinMeta([r.barrio, plural(r.people, 'persona', 'personas'), r.my_score != null ? 'Tu nota ' + num(Number(r.my_score)) : '']);
        return rankRow({ pos: i + 1, name: r.name, meta: meta, score: Number(r.score), i: i, heroLabel: i === 0 ? 'La número 1 de la app' : '' });
      }).join('') + '</div>';
      box.querySelectorAll('[data-i]').forEach(function (b) {
        b.addEventListener('click', function () {
          var r = rows[+b.getAttribute('data-i')];
          openPlaceSheet(placeFromRow(r), joinMeta(['#' + (rows.indexOf(r) + 1) + ' de la app', plural(r.people, 'persona', 'personas'), plural(r.visits, 'visita', 'visitas')]), Number(r.score));
        });
      });
    }
    function load() {
      S.community.globalRanking().then(function (res) {
        if (my !== screenId) return;
        if (res.error) { if (!cache.global) commError(box, res.error, function () { box.innerHTML = loadingLine('Juntando las notas de todos…'); load(); }); return; }
        cache.global = res.data; paint(res.data);
      });
    }
    if (cache.global) paint(cache.global); else box.innerHTML = loadingLine('Juntando las notas de todos…');
    load();
  };

  VIEWS.personas = function () {
    var me = S.auth.user();
    view.innerHTML = logoHead() + '<h1 class="app-sr">Ranking</h1>' + rankSeg('personas') +
      '<label class="dag-search app-searchrow">' + ic('search') +
      '<input id="ps-q" type="search" placeholder="Buscá por @usuario" autocomplete="off" autocapitalize="none" spellcheck="false" aria-label="Buscar personas por nombre de usuario" value="' + esc(ui.peopleQuery || '') + '"></label>' +
      (S.community.needsUsername() ? '<p class="app-hint app-gap">Todavía no elegiste tu @, así que nadie te encuentra. <button type="button" class="app-linkbtn" data-username>Elegilo</button></p>' : '') +
      '<div id="ps-list"></div>';
    bindSettings();
    var ub = view.querySelector('[data-username]');
    if (ub) ub.addEventListener('click', openUsernameSheet);
    var box = view.querySelector('#ps-list'), input = view.querySelector('#ps-q'), my = screenId, seq = 0, timer = null;
    function load() {
      var q = input.value.trim(), mine = ++seq;
      S.community.searchUsers(q).then(function (res) {
        if (my !== screenId || mine !== seq) return;
        if (res.error) { commError(box, res.error, load); return; }
        var list = res.data;
        if (!list.length) {
          box.innerHTML = '<p class="app-empty-line">' + (q ? 'Nadie con “' + esc(q) + '”. Probá con otra parte del @.' : 'Todavía nadie eligió su @.') + '</p>';
          return;
        }
        box.innerHTML = (q ? '' : '<p class="dag-label app-gap">Los más activos</p>') + '<div class="dag-stack" style="gap:8px">' + list.map(function (u) {
          var isMe = me && u.id === me.id;
          return '<a class="dag-card app-person" href="#/persona/' + encodeURIComponent(u.id) + '"><span class="app-avatar" aria-hidden="true">' + esc(u.username.charAt(0).toUpperCase()) + '</span>' +
            '<span class="app-person__info"><b>@' + esc(u.username) + (isMe ? ' <span class="dag-muted">(vos)</span>' : '') + '</b>' +
            '<span class="dag-muted">' + plural(u.cafes, 'cafetería', 'cafeterías') + ' · ' + plural(u.visits, 'visita', 'visitas') + '</span></span>' +
            '<span class="app-person__go">' + ic('ranking') + '</span></a>';
        }).join('') + '</div>';
      });
    }
    input.addEventListener('input', function () {
      ui.peopleQuery = input.value;
      clearTimeout(timer); timer = setTimeout(load, 280);
    });
    cleanup.push(function () { clearTimeout(timer); });
    box.innerHTML = loadingLine('Buscando…');
    load();
  };

  VIEWS.persona = function (r) {
    view.innerHTML = topbar('', '') + '<div id="pp">' + loadingLine('Trayendo su ranking…') + '</div>';
    bindBack('#/personas');
    var box = view.querySelector('#pp'), my = screenId, me = S.auth.user();
    function load() {
      Promise.all([S.community.profile(r.id), S.community.userRanking(r.id)]).then(function (res) {
        if (my !== screenId) return;
        var prof = res[0], rk = res[1];
        if (prof.error || rk.error) { commError(box, prof.error || rk.error, load); return; }
        if (!prof.data) { box.innerHTML = '<div class="app-empty"><p>No encontramos a esa persona.</p><a class="dag-btn dag-btn--secondary" href="#/personas">Volver a Personas</a></div>'; return; }
        var rows = rk.data, name = prof.data.username ? '@' + prof.data.username : 'Sin usuario', isMe = me && me.id === r.id;
        var visits = rows.reduce(function (a, x) { return a + x.visits; }, 0);
        document.title = name + ' · Directo al grano';
        var html = '<div class="app-person-head"><span class="app-avatar app-avatar--lg" aria-hidden="true">' + esc((prof.data.username || '?').charAt(0).toUpperCase()) + '</span>' +
          '<div style="min-width:0"><h1 class="dag-title app-detail-name">' + esc(name) + '</h1><p class="dag-cafe__meta">' +
          (isMe ? 'Así te ven los demás · ' : '') + plural(rows.length, 'cafetería', 'cafeterías') + ' · ' + plural(visits, 'visita', 'visitas') + '</p></div></div>';
        if (!rows.length) html += '<p class="app-empty-line">Todavía no reseñó ninguna cafetería.</p>';
        else {
          html += '<div class="dag-stack">' + rows.map(function (x, i) {
            var meta = joinMeta([x.barrio, plural(x.visits, 'visita', 'visitas'), x.last_visit ? 'última ' + shortDate(x.last_visit) : '']);
            return rankRow({ pos: i + 1, name: x.name, meta: meta, score: Number(x.score), i: i, heroLabel: i === 0 ? (isMe ? 'Tu número 1' : 'Su número 1') : '' });
          }).join('') + '</div>';
        }
        box.innerHTML = html;
        box.querySelectorAll('[data-i]').forEach(function (b) {
          b.addEventListener('click', function () {
            var i = +b.getAttribute('data-i'), x = rows[i];
            openPlaceSheet(placeFromRow(x), joinMeta(['#' + (i + 1) + ' de ' + name, plural(x.visits, 'visita', 'visitas')]), Number(x.score));
          });
        });
      });
    }
    load();
  };

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
    var tags = last ? [last.drink, last.origin].filter(Boolean) : [];

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

  // ---------- Google Maps adentro de la app ----------
  // El mapa "embed" de Google es gratis y sin clave: muestra el lugar como figura en Maps (pin, nombre, dirección)
  // sin saltar a la app de Maps. No se puede leer lo que muestra: la ubicación se marca acá o se pega la dirección.
  function gmapsEmbedUrl(q) {
    var term = (q + ', Argentina').replace(/!/g, ' ');
    return 'https://www.google.com/maps/embed?origin=mfe&pb=!1m2!2m1!1s' + encodeURIComponent(term).replace(/%20/g, '+') + '!3m1!1ses!5m1!1ses';
  }
  function gmapsPanelHtml(id) {
    return '<button type="button" class="dag-btn dag-btn--ghost dag-btn--sm app-gmaps-btn" id="' + id + '-btn" aria-expanded="false" aria-controls="' + id + '" hidden>' + ic('map') + '<span class="app-gmaps-btn__txt">Ver en Google Maps</span></button>' +
      '<div class="app-gmaps" id="' + id + '" hidden><iframe title="Google Maps" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>' +
      '<p class="app-hint">Así figura en Google Maps. Copiá la dirección de ahí y pegala en Ubicación, o tocá «Marcar en el mapa» y poné el pin en el mismo lugar.</p></div>';
  }
  // Conecta el botón y el panel al campo de nombre. Devuelve show(q) para abrirlo desde la sugerencia.
  function wireGmaps(root, id, input) {
    var btn = root.querySelector('#' + id + '-btn'), panel = root.querySelector('#' + id), frame = panel.querySelector('iframe');
    var timer = null, shown = '';
    function query() { var v = input.value.trim(); return v.length >= 3 && !Geo.isMapsLink(v) ? v : ''; }
    function load(q) { if (q && q !== shown) { shown = q; frame.src = gmapsEmbedUrl(q); } }
    function set(open) {
      panel.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      btn.querySelector('.app-gmaps-btn__txt').textContent = open ? 'Ocultar Google Maps' : 'Ver en Google Maps';
      if (open) load(query());
    }
    function sync() {
      var q = query();
      btn.hidden = !q;
      if (!q) { set(false); return; }
      if (!panel.hidden) { clearTimeout(timer); timer = setTimeout(function () { load(query()); }, 700); }
    }
    input.addEventListener('input', sync);
    btn.addEventListener('click', function () { set(panel.hidden); });
    sync();
    return {
      show: function (q) {
        if (q && !input.value.trim()) input.value = q;
        sync(); set(true);
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      },
      destroy: function () { clearTimeout(timer); }
    };
  }

  /* Marcar a mano, a pantalla completa: el pin queda fijo en el centro y se mueve el mapa abajo.
     o: start {lat,lng}, zoom, pin (html), onPick({lat,lng}) */
  function openMapPicker(o) {
    var prevFocus = document.activeElement;
    var ov = document.createElement('div');
    ov.className = 'app-picker';
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Marcar la ubicación en el mapa');
    ov.innerHTML = '<div class="app-picker__stage"><div class="dag-map app-picker__map"></div>' +
      '<div class="app-picker__pin" aria-hidden="true">' + o.pin + '</div>' +
      '<div class="app-picker__top"><button type="button" class="dag-btn dag-btn--secondary dag-btn--icon app-picker__close" aria-label="Cancelar">' + ic('back') + '</button>' +
      '<div class="app-pop"><label class="dag-search app-search-input">' + ic('search') +
      '<input id="pk-q" type="search" placeholder="Ir a una calle o zona" autocomplete="off" aria-label="Ir a una calle o zona"></label>' +
      '<div id="pk-suggest" class="app-suggest app-suggest--pop" hidden></div></div></div></div>' +
      '<div class="app-picker__sheet"><p class="dag-label">Ubicación de la cafetería</p>' +
      '<p class="app-picker__addr" id="pk-addr" aria-live="polite">Mové el mapa hasta que el pin quede en la puerta.</p>' +
      '<div class="app-sheet-actions"><button type="button" class="dag-btn dag-btn--secondary" id="pk-here">' + ic('route') + 'Estoy acá</button>' +
      '<button type="button" class="dag-btn" id="pk-ok">' + ic('check') + 'Usar esta</button></div></div>';
    document.body.appendChild(ov);
    document.body.classList.add('has-modal');
    var addrEl = ov.querySelector('#pk-addr'), pinEl = ov.querySelector('.app-picker__pin');
    var start = o.start || Geo.BA;
    var m = MapView.mount(ov.querySelector('.app-picker__map'), { center: start, zoom: o.zoom || 16, wheel: true, zoomControl: true });
    var timer = null, asked = 0;

    function close() {
      document.removeEventListener('keydown', onKey);
      clearTimeout(timer);
      if (m) m.destroy();
      ov.remove();
      if (!document.querySelector('.app-overlay')) document.body.classList.remove('has-modal');
      if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true });
    }
    function onKey(e) { if (e.key === 'Escape' && ov.querySelector('#pk-suggest').hidden) close(); }
    document.addEventListener('keydown', onKey);

    // la dirección del punto del centro, cuando el mapa se queda quieto
    function lookup() {
      if (!m) return;
      var c = m.center(), mine = ++asked;
      addrEl.textContent = 'Buscando la dirección…';
      Geo.reverse(c.lat, c.lng).then(function (pl) {
        if (mine !== asked) return;
        var line = pl ? [pl.address || pl.name, pl.barrio].filter(Boolean).join(' · ') : '';
        addrEl.textContent = line || 'Sin dirección para este punto, pero la ubicación sirve igual.';
      }).catch(function () { if (mine === asked) addrEl.textContent = 'Sin conexión para la dirección; la ubicación sirve igual.'; });
    }
    if (m) {
      m.map.on('movestart', function () { pinEl.classList.add('is-moving'); clearTimeout(timer); asked++; });
      m.map.on('moveend', function () { pinEl.classList.remove('is-moving'); clearTimeout(timer); timer = setTimeout(lookup, 350); });
      requestAnimationFrame(function () { m.invalidate(); m.centerOn(start.lat, start.lng, o.zoom || 16); lookup(); });
    }

    var q = ov.querySelector('#pk-q');
    Geo.attach(q, {
      list: ov.querySelector('#pk-suggest'),
      near: function () { return m ? m.center() : Geo.BA; },
      onPick: function (pl) { q.value = ''; q.blur(); if (m) m.centerOn(pl.lat, pl.lng, 18); }
    });
    ov.querySelector('.app-picker__close').addEventListener('click', close);
    ov.querySelector('#pk-here').addEventListener('click', function () {
      var b = this;
      if (!navigator.geolocation) { addrEl.textContent = 'Este navegador no comparte la ubicación.'; return; }
      b.disabled = true; addrEl.textContent = 'Buscando dónde estás…';
      navigator.geolocation.getCurrentPosition(function (pos) {
        b.disabled = false;
        if (m) m.centerOn(pos.coords.latitude, pos.coords.longitude, 18);
      }, function (err) {
        b.disabled = false;
        addrEl.textContent = err && err.code === 1 ? 'No diste permiso de ubicación. Mové el mapa a mano.' : 'No pude saber dónde estás. Mové el mapa a mano.';
      }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
    });
    ov.querySelector('#pk-ok').addEventListener('click', function () {
      if (!m) { close(); return; }
      var c = m.center();
      close();
      o.onPick({ lat: c.lat, lng: c.lng });
    });
    ov.querySelector('#pk-ok').focus({ preventScroll: true });
  }

  /* cfg: mapEl, hintEl, addrInput, addrList, pin (html), point ({lat,lng,barrio,placeId} o null)
     El barrio ya no se escribe: sale solo del lugar elegido (o del punto tocado) y se guarda para las listas. */
  function placeFields(cfg) {
    var point = hasLL(cfg.point) ? { lat: cfg.point.lat, lng: cfg.point.lng } : null;
    var placeId = (cfg.point && cfg.point.placeId) || '', barrio = (cfg.point && cfg.point.barrio) || '';
    var addr = cfg.addrInput, addrTouched = !!addr.value;
    var m = MapView.mount(cfg.mapEl, { onTap: function (ll) { setPoint(ll); } });

    function hint() {
      if (!cfg.hintEl) return;
      cfg.hintEl.textContent = !m ? '' : point ? 'Listo. Si el pin no quedó justo, arrastralo o tocá el lugar exacto.'
        : 'Si no aparece por nombre: pegá arriba la dirección copiada de Google Maps, o marcala a mano en el mapa.';
    }
    // "Estoy acá": la ubicación del teléfono (para reseñar desde la cafetería)
    function here() {
      var b = cfg.hereBtn;
      function say(t) { if (cfg.hintEl) cfg.hintEl.textContent = t; }
      if (!navigator.geolocation) { say('Este navegador no comparte la ubicación. Tocá el lugar en el mapa.'); return; }
      b.disabled = true; say('Buscando dónde estás…');
      navigator.geolocation.getCurrentPosition(function (pos) {
        b.disabled = false;
        addrTouched = false; // que la dirección se complete sola
        setPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        if (m) m.centerOn(point.lat, point.lng, 17);
        var acc = Math.round(pos.coords.accuracy || 0);
        if (acc > 60) say('Ubicación aproximada (±' + acc + ' m). Si el pin no quedó en la puerta, arrastralo.');
      }, function (err) {
        b.disabled = false;
        say(err && err.code === 1 ? 'No diste permiso de ubicación. Activalo para este sitio en el navegador, o tocá el lugar en el mapa.'
          : 'No pude saber dónde estás. Probá de nuevo o tocá el lugar en el mapa.');
      }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
    }
    if (cfg.hereBtn) cfg.hereBtn.addEventListener('click', here);
    if (cfg.pickBtn) cfg.pickBtn.addEventListener('click', function () {
      openMapPicker({
        start: point || (m ? m.center() : Geo.BA), zoom: point ? 18 : 16, pin: cfg.pin,
        onPick: function (ll) {
          addrTouched = false; // la dirección sale del punto elegido
          setPoint(ll);
          if (m) m.centerOn(ll.lat, ll.lng, 17);
        }
      });
    });
    function sync(center) {
      if (m) m.setPin(point ? point.lat : null, point ? point.lng : null, cfg.pin, function (ll) { setPoint(ll, true); });
      if (m && center && point) m.centerOn(point.lat, point.lng, Math.max(16, m.map.getZoom()));
      hint();
    }
    // drag = corrección fina del pin: sigue siendo el mismo lugar
    function setPoint(ll, drag) {
      point = { lat: ll.lat, lng: ll.lng }; sync(false);
      if (drag && placeId) return;
      placeId = '';
      var asked = point;
      Geo.reverse(ll.lat, ll.lng).then(function (pl) {
        if (!pl || point !== asked) return;
        if (pl.barrio) barrio = pl.barrio;
        if (addrTouched && addr.value.trim()) return;
        var a = pl.address || pl.name;
        if (a) { addr.value = a; addrTouched = false; }
      }).catch(function () { /* sin conexión: queda el pin sin dirección */ });
    }
    function applyPlace(pl) {
      addr.value = pl.address || pl.name || ''; addrTouched = false;
      barrio = pl.barrio || barrio;
      placeId = pl.placeId || '';
      point = { lat: pl.lat, lng: pl.lng }; sync(true);
    }

    addr.addEventListener('input', function (e) { if (e.isTrusted) addrTouched = true; });
    Geo.attach(addr, {
      list: cfg.addrList,
      near: function () { return point || (m ? m.center() : Geo.BA); },
      onPick: applyPlace
    });

    if (m) { if (point) m.centerOn(point.lat, point.lng, 16); else defaultView(m); }
    sync(false);
    return {
      point: function () { return point; },
      placeId: function () { return placeId; },
      barrio: function () { return barrio; },
      applyPlace: applyPlace,
      clear: function () { point = null; placeId = ''; barrio = ''; addr.value = ''; addrTouched = false; sync(false); },
      setExisting: function (c) {
        addr.value = c.address || ''; addrTouched = !!c.address; placeId = c.placeId || ''; barrio = c.barrio || '';
        point = hasLL(c) ? { lat: c.lat, lng: c.lng } : null; sync(true);
      },
      near: function () { return point || (m ? m.center() : Geo.BA); },
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
      name: seed ? seed.name || '' : '', barrio: seed ? seed.barrio || '' : '', placeId: seed ? seed.placeId || '' : '',
      address: seed ? seed.address || '' : '', lat: seed ? seed.lat : null, lng: seed ? seed.lng : null
    };
    if (st.cafeId) { var c0 = S.cafe(st.cafeId); st.address = c0.address; st.lat = c0.lat; st.lng = c0.lng; st.barrio = c0.barrio; st.placeId = c0.placeId; }
    var food = v.food || null;
    // un origen viejo que ya no está en la lista se sigue mostrando, para no perderlo al editar
    var origins = !v.origin || S.BEAN.origin.indexOf(v.origin) >= 0 ? S.BEAN.origin : S.BEAN.origin.concat([v.origin]);

    var html = topbar(edit ? 'Editar visita' : 'Nueva review', '') +
      '<form id="rv" novalidate>' +
      // 1. nombre
      '<div class="dag-section"><p class="dag-label">Cafetería</p><div id="rv-cafe"></div></div>' +
      // 2. ubicación real
      '<div class="dag-section" id="rv-loc"><p class="dag-label">Ubicación</p><div class="app-pop"><label class="dag-search app-search-input">' + ic('map') +
      '<input id="rv-address" placeholder="Dirección o lugar" autocomplete="off" aria-label="Ubicación" value="' + esc(st.address || '') + '"></label>' +
      '<div id="rv-addr-suggest" class="app-suggest app-suggest--pop" hidden></div></div>' +
      '<div class="dag-map app-pickmap" id="rv-map" aria-label="Mapa: tocá para marcar el lugar"></div>' +
      '<div class="app-loc-actions"><button type="button" class="dag-btn dag-btn--secondary dag-btn--sm" id="rv-pick">' + ic('map') + 'Marcar en el mapa</button>' +
      '<button type="button" class="dag-btn dag-btn--secondary dag-btn--sm" id="rv-here">' + ic('route') + 'Estoy acá</button></div>' +
      '<p class="app-hint" id="rv-map-hint"></p></div>' +
      // 3. fecha
      '<div class="dag-section"><label class="dag-field"><span class="dag-label">Fecha</span><input class="dag-input" type="date" id="rv-date" value="' + esc(v.date || S.today()) + '" max="' + S.today() + '"></label></div>' +
      // 4. puntuación
      '<div class="dag-section" id="rv-score-sec"><p class="dag-label">Puntuación</p><div class="dag-picker" id="rv-score"><div class="dag-picker__readout">' +
      '<span class="dag-picker__value">' + (v.score || '–') + '</span><span class="dag-picker__of">/10</span>' +
      (v.score ? '<span class="dag-band-word" data-band-of="' + v.score + '"></span>' : '<span class="dag-band-word" data-band-of="0" hidden></span>') + '</div>' +
      pickerScale(v.score, 'Nota del 1 al 10') + '</div><p class="app-error" id="rv-score-err" hidden>Falta la nota.</p></div>' +
      // 5. aspectos
      '<div class="dag-section"><p class="dag-label">Aspectos <span class="app-label-opt">· opcional</span></p><div class="dag-card" style="padding:0 16px"><div class="dag-aspects">' +
      S.ASPECTS.map(function (a) {
        return '<div class="dag-aspect" data-aspect="' + a.key + '"><span class="dag-aspect__name">' + ic(a.icon) + a.name + '</span>' + beans((v.aspects && v.aspects[a.key]) || 0, a.name) + '</div>';
      }).join('') + '</div></div><p class="app-hint">No suman a la nota: la explican. Tocá el último grano otra vez para borrar.</p></div>' +

      '<div class="dag-section"><p class="dag-label">¿Qué tomaste?</p>' + chipGroup('drink', S.BEAN.drink, v.drink) + '</div>' +
      '<div class="dag-section"><p class="dag-label">Origen del grano</p>' + chipGroup('origin', origins, v.origin) + '</div>' +

      '<div class="dag-section"><label class="dag-field"><span class="dag-label">La review</span>' +
      '<textarea class="dag-textarea" id="rv-text" maxlength="600" placeholder="¿Cómo estuvo? Sin vueltas.">' + esc(v.text || '') + '</textarea>' +
      '<span class="dag-field__hint"><span>Opcional. Solo la ves vos.</span><span id="rv-count">' + (v.text || '').length + '/600</span></span></label></div>' +

      '<div class="dag-section"><div class="dag-card dag-food" data-open="' + !!food + '"><div class="dag-food__toggle">' + ic('food') +
      '<span class="dag-food__q" id="rv-food-q">¿Comiste algo?</span><button type="button" class="dag-switch" role="switch" aria-checked="' + !!food + '" aria-labelledby="rv-food-q"></button></div>' +
      '<div class="dag-food__body"><label class="dag-field"><span class="app-field-label">¿Qué comiste?</span><input class="dag-input" id="rv-food-name" placeholder="Medialuna, tostado, budín…" value="' + esc(food ? food.name : '') + '"></label>' +
      '<div class="dag-field"><span class="app-field-label">Nota de la comida</span><div class="dag-picker dag-picker--compact" id="rv-food-score">' + pickerScale(food ? food.score : 0, 'Nota de la comida del 1 al 10') + '</div></div>' +
      '<label class="dag-field"><span class="app-field-label">Comentario</span><input class="dag-input" id="rv-food-text" placeholder="Opcional" value="' + esc(food ? food.text : '') + '"></label></div></div></div>' +

      (edit ? '<button type="button" class="dag-btn dag-btn--ghost app-btn-danger-ghost" id="rv-delete">Borrar esta visita</button>' : '') +
      '<div class="app-savebar"><button type="submit" class="dag-btn dag-btn--block">' + ic('check') + (edit ? 'Guardar cambios' : 'Guardar review') + '</button></div>' +
      '</form>';
    view.innerHTML = html;
    bindBack(edit ? '#/cafe/' + v.cafeId : '#/ranking');

    var form = view.querySelector('#rv');

    // --- ubicación (va primero: el nombre la usa) ---
    var loc = placeFields({
      mapEl: form.querySelector('#rv-map'), hintEl: form.querySelector('#rv-map-hint'), hereBtn: form.querySelector('#rv-here'), pickBtn: form.querySelector('#rv-pick'),
      addrInput: form.querySelector('#rv-address'), addrList: form.querySelector('#rv-addr-suggest'),
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
        if (ch) ch.addEventListener('click', function () { st.cafeId = null; st.name = ''; loc.clear(); renderCafe(); box.querySelector('#rv-name').focus(); });
      } else {
        box.innerHTML = '<div class="app-pop"><label class="dag-field"><span class="app-field-label">Nombre</span>' +
          '<span class="dag-search app-search-input">' + ic('search') + '<input id="rv-name" placeholder="Buscala por nombre o pegá un link de Maps" autocomplete="off" value="' + esc(st.name) + '"></span></label>' +
          '<div id="rv-suggest" class="app-suggest app-suggest--pop" hidden></div></div>' +
          '<p class="app-error" id="rv-name-err" hidden>Poné el nombre de la cafetería.</p>' + gmapsPanelHtml('rv-gmaps');
        var name = box.querySelector('#rv-name');
        var gm = wireGmaps(box, 'rv-gmaps', name);
        cleanup.push(gm.destroy);
        name.addEventListener('input', function () { st.name = name.value; });
        Geo.attach(name, {
          list: box.querySelector('#rv-suggest'),
          near: loc.near,
          pasteWhere: 'en Ubicación',
          onGmaps: function (q) { gm.show(q); },
          local: function (q) {
            q = q.toLowerCase();
            var hits = q ? S.cafes().filter(function (c) { return c.name.toLowerCase().indexOf(q) >= 0; }).slice(0, 3) : [];
            return hits.length ? '<p class="app-suggest__head">Ya la tenés</p>' + hits.map(function (c) {
              return '<button type="button" class="app-suggest__item" data-local="' + c.id + '">' + ic('cup') + '<span class="app-suggest__txt"><b>' + esc(c.name) + '</b><span class="dag-muted">' + esc(joinMeta([c.address, c.barrio])) + '</span></span></button>';
            }).join('') : '';
          },
          onLocal: function (el) { pickExisting(S.cafe(el.getAttribute('data-local'))); },
          onPick: function (pl) {
            var mine = pl.name && S.cafes().find(function (c) {
              return (pl.placeId && c.placeId === pl.placeId) || (c.name.toLowerCase() === pl.name.toLowerCase() && (!hasLL(c) || Geo.km(c, pl) < 0.3));
            });
            if (mine) { pickExisting(mine); return; }
            // si pegaron una dirección en el nombre, se usa para la ubicación y el nombre queda por escribir
            if (pl.name) { name.value = pl.name; st.name = pl.name; } else { name.value = ''; st.name = ''; }
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
      var pt = loc.point(), placeId = loc.placeId(), barrio = loc.barrio();
      var cafeId = st.cafeId;
      if (!cafeId) {
        var existing = (placeId && S.cafes().find(function (c) { return c.placeId === placeId; })) || S.findCafeByName(st.name);
        if (existing) cafeId = existing.id;
        else cafeId = S.addCafe({ name: st.name, barrio: barrio, address: address, placeId: placeId, lat: pt ? pt.lat : null, lng: pt ? pt.lng : null }).id;
      }
      var patch = { address: address || undefined, barrio: barrio || undefined, placeId: placeId || undefined };
      if (pt) { patch.lat = Math.round(pt.lat * 1e6) / 1e6; patch.lng = Math.round(pt.lng * 1e6) / 1e6; }
      S.updateCafe(cafeId, patch);

      var data = {
        cafeId: cafeId, score: score, date: form.querySelector('#rv-date').value || S.today(),
        aspects: aspects, drink: chip('drink'), origin: chip('origin'),
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
      '<p class="app-error" id="wf-err" hidden>Poné el nombre.</p>' + gmapsPanelHtml('wf-gmaps').replace('pegala en Ubicación', 'pegala en Dirección') +
      '<label class="dag-field"><span class="app-field-label">¿Por qué?</span><input class="dag-input" id="wf-why" placeholder="Quién te la recomendó, qué tienen…"></label>' +
      '<div class="app-pop"><label class="dag-search app-search-input">' + ic('search') + '<input id="wf-address" placeholder="Dirección (opcional)" autocomplete="off"></label>' +
      '<div id="wf-addr-suggest" class="app-suggest app-suggest--pop" hidden></div></div>' +
      '<div class="dag-map app-pickmap app-pickmap--sm" id="wf-map" aria-label="Mapa: tocá para marcar el lugar"></div>' +
      '<div class="app-loc-actions app-loc-actions--one"><button type="button" class="dag-btn dag-btn--secondary dag-btn--sm" id="wf-pick">' + ic('map') + 'Marcar en el mapa</button></div>' +
      '<p class="app-hint" id="wf-hint"></p>' +
      '<button type="submit" class="dag-btn dag-btn--block">' + ic('wishlist') + 'Guardar en la wishlist</button></form>',
      function (sheet, done) {
        var loc = placeFields({
          mapEl: sheet.querySelector('#wf-map'), hintEl: sheet.querySelector('#wf-hint'), pickBtn: sheet.querySelector('#wf-pick'),
          addrInput: sheet.querySelector('#wf-address'), addrList: sheet.querySelector('#wf-addr-suggest'),
          pin: pinWish(), point: null
        });
        setTimeout(function () { loc.invalidate(); }, 220); // el sheet sube animado
        var name = sheet.querySelector('#wf-name');
        var wgm = wireGmaps(sheet, 'wf-gmaps', name);
        Geo.attach(name, {
          list: sheet.querySelector('#wf-suggest'), near: loc.near, pasteWhere: 'en Dirección',
          onGmaps: function (q) { wgm.show(q); },
          onPick: function (pl) { if (pl.name) name.value = pl.name; loc.applyPlace(pl); sheet.querySelector('#wf-err').hidden = true; }
        });
        sheet.querySelector('#wf').addEventListener('submit', function (e) {
          e.preventDefault();
          var n = name.value.trim();
          if (!n) { sheet.querySelector('#wf-err').hidden = false; name.focus(); return; }
          var pt = loc.point();
          S.addWish({ name: n, barrio: loc.barrio(), why: sheet.querySelector('#wf-why').value, address: sheet.querySelector('#wf-address').value, lat: pt ? pt.lat : null, lng: pt ? pt.lng : null });
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
      (S.community.profileReady() === 'missing' ? '' :
        '<div class="dag-section"><form class="dag-stack" id="st-user-form" novalidate>' + handleField('st-user', S.auth.username(), 'Nombre de usuario') +
        '<p class="app-error" role="alert" hidden></p><button type="submit" class="dag-btn dag-btn--secondary dag-btn--block">Guardar</button></form>' +
        '<p class="app-hint" style="margin-top:8px">Con tu @ te encuentran en Personas. Ven tu ranking y tus notas; tus textos y tu mail, no.</p></div>') +
      '<div class="dag-section"><p class="dag-label">Cuenta</p><p class="app-account">' +
      (S.auth.username() ? '<b>@' + esc(S.auth.username()) + '</b>' : '') + '<span>' + esc(S.auth.user() ? S.auth.user().email : '') + '</span></p>' +
      '<button type="button" class="dag-btn dag-btn--secondary dag-btn--block" id="st-logout">Cerrar sesión</button></div>' +
      '<div class="dag-section"><p class="dag-label">Tus datos</p><p class="app-hint" style="margin:0">Se guardan en tu cuenta y los ves desde cualquier dispositivo. Igual podés bajarte una copia.</p>' +
      '<div class="app-sheet-actions"><button type="button" class="dag-btn dag-btn--secondary" id="st-export"' + (hasData ? '' : ' disabled') + '>Exportar</button>' +
      '<label class="dag-btn dag-btn--secondary" tabindex="0">Importar<input type="file" accept="application/json,.json" id="st-import" hidden></label></div>' +
      (hasData ? '<button type="button" class="dag-btn dag-btn--ghost app-btn-danger-ghost" id="st-reset">Empezar de cero</button>' : '') + '</div>',
      function (sheet, close) {
        sheet.querySelector('#st-theme').addEventListener('click', function (e) {
          var c = e.target.closest('[data-t]'); if (!c) return;
          S.setPref('theme', c.getAttribute('data-t')); applyTheme();
        });
        var uf = sheet.querySelector('#st-user-form');
        if (uf) {
          var uin = uf.querySelector('#st-user'), mineNow = S.auth.username(), ucheck = wireHandle(uin, mineNow);
          wireAuthForm(uf, 'Guardando…', function (fail) {
            if (S.USERNAME.clean(uin.value) === mineNow) return fail('');
            ucheck().then(function (bad) {
              if (bad) return fail(bad, uin);
              S.community.setUsername(uin.value).then(function (res) {
                if (res.error) return fail(usernameError(res.error), uin);
                mineNow = S.auth.username(); fail('');
                toast('Listo: ahora sos @' + mineNow + '.');
              });
            });
          });
        }
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
      handleField('au-user', ui.authUser || '', 'Nombre de usuario') +
      field('au-email', 'Mail', 'type="email" autocomplete="email" inputmode="email" autocapitalize="none" spellcheck="false" required') +
      passField('au-pass', 'Contraseña', 'new-password', 'Mínimo ' + MIN_PASS + ' caracteres.') +
      '<p class="app-error" role="alert" hidden></p>' +
      '<button type="submit" class="dag-btn dag-btn--block">Crear cuenta</button></form>',
      '¿Ya tenés cuenta? <a href="#/entrar">Entrá</a>');
    var form = view.querySelector('form'); if (!form) return;
    var handle = form.querySelector('#au-user'), email = form.querySelector('#au-email'), pass = form.querySelector('#au-pass');
    var checkHandle = wireHandle(handle, '');
    if (ui.authEmail) email.value = ui.authEmail;
    wireAuthForm(form, 'Creando…', function (fail) {
      var em = email.value.trim(); ui.authEmail = em;
      if (!EMAIL_RE.test(em)) return fail('Ese mail no parece válido.', email);
      if (pass.value.length < MIN_PASS) return fail('La contraseña necesita al menos ' + MIN_PASS + ' caracteres.', pass);
      var un = S.USERNAME.clean(handle.value); ui.authUser = un;
      checkHandle().then(function (bad) {
        if (bad) return fail(bad, handle);
        return S.auth.signUp(em, pass.value, un);
      }).then(function (res) {
        if (!res) return; // ya se mostró el problema del @
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
  Geo.setLinkResolver(S.community.resolveMapsLink);
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
      if (S.auth.user() && !S.loadError()) toast(S.auth.username() ? 'Hola, @' + S.auth.username() + '.' : 'Adentro.');
    }
    if (S.auth.takeRecovery()) openNewPassword();
    else if (changed) maybeAskUsername();
  });

  S.auth.ready().then(function () {
    booted = true;
    var fromLink = S.auth.fromEmailLink(), type = S.auth.linkType();
    if (fromLink) setHash(S.auth.user() ? '#/ranking' : '#/entrar'); // saca los tokens de la URL
    render();
    if (S.auth.takeRecovery()) openNewPassword();
    else {
      if (fromLink && S.auth.user() && type === 'signup') toast('Mail confirmado. Ya estás adentro.');
      maybeAskUsername();
    }
  });
})();
