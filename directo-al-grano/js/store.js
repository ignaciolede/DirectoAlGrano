/* Directo al grano — datos y cuenta.
   Los datos viven en Supabase (tablas cafes, visits, wishlist, una fila por usuario con RLS).
   Al entrar se traen todos a memoria; la app lee de ahí en forma sincrónica y cada cambio
   se aplica al toque en memoria y se manda a Supabase en una cola, en orden.
   El tema queda en este dispositivo (localStorage). */
(function () {
  var PREFS_KEY = 'directo-al-grano.prefs';
  var LEGACY_KEY = 'directo-al-grano.v1'; // versión anterior: todo en localStorage

  var ASPECTS = [
    { key: 'cafe', name: 'Café', icon: 'cup' },
    { key: 'lugar', name: 'Lugar', icon: 'place' },
    { key: 'atencion', name: 'Atención', icon: 'service' },
    { key: 'precio', name: 'Precio/calidad', icon: 'price' },
    { key: 'trabajo', name: 'Para trabajar', icon: 'laptop' }
  ];

  var BEAN = {
    drink: ['Espresso', 'Cortado', 'Flat white', 'Latte', 'Capuccino', 'Filtro', 'Cold brew'],
    origin: ['Etiopía', 'Colombia', 'Brasil', 'Blend', 'No sé'],
    roast: ['Claro', 'Medio', 'Oscuro'],
    method: ['Máquina', 'V60', 'Chemex', 'Aeropress', 'Cold brew']
  };

  // ---------- Supabase ----------
  var cfg = window.DAG_CONFIG || {};
  var configured = /^https:\/\/[^/]+/.test(cfg.supabaseUrl || '') && cfg.supabaseUrl.indexOf('TU-PROYECTO') < 0 &&
    !!cfg.supabaseAnonKey && cfg.supabaseAnonKey !== 'TU_ANON_KEY';
  var initialHash = location.hash; // antes de que Supabase lea (y limpie) el link del mail
  var sb = configured && window.supabase ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;

  function empty() { return { cafes: [], visits: [], wishlist: [] }; }
  var db = empty();
  var user = null;
  var loadError = null;

  // ---------- preferencias (por dispositivo) ----------
  function loadPrefs() {
    try {
      var p = JSON.parse(localStorage.getItem(PREFS_KEY));
      if (p) return p;
      var old = JSON.parse(localStorage.getItem(LEGACY_KEY));
      if (old && old.prefs) { localStorage.setItem(PREFS_KEY, JSON.stringify(old.prefs)); return old.prefs; }
    } catch (err) { /* sin storage */ }
    return { theme: 'system' };
  }
  var prefsObj = loadPrefs();
  function prefs() { return prefsObj; }
  function setPref(k, v) {
    prefsObj[k] = v;
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefsObj)); } catch (err) { /* bloqueado */ }
  }

  // ---------- filas <-> objetos de la app ----------
  function str(v) { return v == null ? '' : String(v); }
  function cafeRow(c) {
    return { id: c.id, name: c.name, barrio: str(c.barrio), address: str(c.address), lat: coord(c.lat), lng: coord(c.lng), created_at: c.createdAt || Date.now() };
  }
  function cafeFrom(r) {
    return { id: r.id, name: r.name, barrio: str(r.barrio), address: str(r.address), lat: r.lat, lng: r.lng, createdAt: Number(r.created_at) };
  }
  function visitRow(v) {
    return {
      id: v.id, cafe_id: v.cafeId, score: v.score, visited_on: v.date,
      drink: v.drink || null, origin: v.origin || null, roast: v.roast || null, method: v.method || null,
      aspects: v.aspects || {}, review: str(v.text), food: v.food || null, created_at: v.createdAt || Date.now()
    };
  }
  function visitFrom(r) {
    return {
      id: r.id, cafeId: r.cafe_id, score: r.score, date: r.visited_on,
      drink: str(r.drink), origin: str(r.origin), roast: str(r.roast), method: str(r.method),
      aspects: r.aspects || {}, text: str(r.review), food: r.food || null, createdAt: Number(r.created_at)
    };
  }
  function wishRow(w) {
    return {
      id: w.id, name: w.name, barrio: str(w.barrio), why: str(w.why), address: str(w.address),
      lat: coord(w.lat), lng: coord(w.lng), saved_at: w.savedAt || today(), created_at: w.createdAt || Date.now()
    };
  }
  function wishFrom(r) {
    return {
      id: r.id, name: r.name, barrio: str(r.barrio), why: str(r.why), address: str(r.address),
      lat: r.lat, lng: r.lng, savedAt: r.saved_at, createdAt: Number(r.created_at)
    };
  }
  var TO_ROW = { cafes: cafeRow, visits: visitRow, wishlist: wishRow };

  // ---------- cola de escrituras ----------
  var queue = Promise.resolve();
  var errorHandlers = [];
  function check(res) { if (res && res.error) throw res.error; return res; }
  function report(err) {
    console.error('[Directo al grano] Supabase:', err);
    errorHandlers.forEach(function (h) { try { h(err); } catch (e) { /* nada */ } });
  }
  // steps: funciones que devuelven una consulta de Supabase. Corren en orden; si una falla, se cortan las siguientes.
  function run(steps) {
    if (!sb || !user) return;
    queue = queue.then(function () {
      return steps.reduce(function (p, step) {
        return p.then(function () { return step(); }).then(check);
      }, Promise.resolve());
    }).catch(report);
  }

  function insert(table, obj) {
    var row = TO_ROW[table](obj);
    run([function () { return sb.from(table).insert(row); }]);
  }
  // Import: una tanda por tabla.
  function insertSteps(b) {
    return ['cafes', 'visits', 'wishlist'].filter(function (t) { return b[t].length; }).map(function (t) {
      return function () { return sb.from(t).insert(b[t].map(TO_ROW[t])); };
    });
  }

  function fetchAll(table) {
    return sb.from(table).select('*').order('created_at', { ascending: true }).range(0, 9999).then(check).then(function (res) { return res.data || []; });
  }
  function loadRemote() {
    return Promise.all([fetchAll('cafes'), fetchAll('visits'), fetchAll('wishlist')]).then(function (r) {
      db = {
        cafes: r[0].map(cafeFrom),
        visits: r[1].map(visitFrom),
        wishlist: r[2].map(wishFrom).sort(function (a, b) { return b.createdAt - a.createdAt; })
      };
      loadError = null;
    }, function (err) {
      db = empty();
      loadError = err;
      report(err);
    });
  }

  function migrate(d) {
    // v1 guardaba x/y de un mapa ilustrado: no se pueden pasar a coordenadas reales, se descartan (la dirección queda).
    d.cafes.concat(d.wishlist).forEach(function (o) {
      if ('x' in o || 'y' in o) { delete o.x; delete o.y; }
      if (typeof o.lat !== 'number' || typeof o.lng !== 'number') { o.lat = null; o.lng = null; }
    });
    return d;
  }
  function coord(v) { return typeof v === 'number' && isFinite(v) ? Math.round(v * 1e6) / 1e6 : null; }

  // Marca de tiempo que nunca se repite: ordena bien altas hechas en el mismo milisegundo.
  var lastStamp = 0;
  function stamp() { lastStamp = Math.max(Date.now(), lastStamp + 1); return lastStamp; }

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function today(offsetDays) {
    var d = new Date();
    if (offsetDays) d.setDate(d.getDate() - offsetDays);
    var m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function avg(list) {
    if (!list.length) return null;
    return list.reduce(function (a, b) { return a + b; }, 0) / list.length;
  }

  function byDateDesc(a, b) {
    return a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt || 0) - (a.createdAt || 0);
  }

  // ---------- lectura ----------
  function cafe(id) { return db.cafes.find(function (c) { return c.id === id; }) || null; }
  function visitsOf(id) { return db.visits.filter(function (v) { return v.cafeId === id; }).sort(byDateDesc); }
  function visit(id) { return db.visits.find(function (v) { return v.id === id; }) || null; }

  function stats(id) {
    var vs = visitsOf(id);
    var aspects = {};
    ASPECTS.forEach(function (a) {
      aspects[a.key] = avg(vs.map(function (v) { return v.aspects && v.aspects[a.key]; }).filter(Boolean));
    });
    var foods = vs.filter(function (v) { return v.food; });
    var drinks = {};
    vs.forEach(function (v) { if (v.drink) drinks[v.drink] = (drinks[v.drink] || 0) + 1; });
    var topDrink = Object.keys(drinks).sort(function (a, b) { return drinks[b] - drinks[a]; })[0] || '';
    return {
      n: vs.length,
      avg: avg(vs.map(function (v) { return v.score; })),
      aspects: aspects,
      food: avg(foods.map(function (v) { return v.food.score; }).filter(Boolean)),
      lastFood: foods[0] ? foods[0].food : null,
      last: vs[0] || null,
      drink: topDrink,
      visits: vs
    };
  }

  // key: 'general' | clave de aspecto | 'comida'
  function ranking(key) {
    var rows = db.cafes.map(function (c) {
      var s = stats(c.id);
      var value = key === 'general' ? s.avg : key === 'comida' ? s.food : s.aspects[key];
      return { cafe: c, stats: s, value: value };
    }).filter(function (r) { return r.stats.n > 0 && r.value != null; });
    rows.sort(function (a, b) {
      return (b.value - a.value) || (b.stats.avg - a.stats.avg) || (b.stats.n - a.stats.n) || a.cafe.name.localeCompare(b.cafe.name, 'es');
    });
    return rows;
  }

  function rankOf(id) {
    var r = ranking('general');
    for (var i = 0; i < r.length; i++) if (r[i].cafe.id === id) return { pos: i + 1, total: r.length };
    return null;
  }

  function findCafeByName(name) {
    var n = name.trim().toLowerCase();
    return db.cafes.find(function (c) { return c.name.trim().toLowerCase() === n; }) || null;
  }

  // ---------- escritura ----------
  function addCafe(data) {
    var c = { id: uid(), name: data.name.trim(), barrio: (data.barrio || '').trim(), address: (data.address || '').trim(), lat: coord(data.lat), lng: coord(data.lng), createdAt: stamp() };
    db.cafes.push(c); insert('cafes', c); return c;
  }
  function updateCafe(id, patch) {
    var c = cafe(id); if (!c) return null;
    Object.keys(patch).forEach(function (k) { if (patch[k] !== undefined) c[k] = patch[k]; });
    var row = cafeRow(c); delete row.id; delete row.created_at;
    run([function () { return sb.from('cafes').update(row).eq('id', id); }]);
    return c;
  }
  function addVisit(data) {
    var v = Object.assign({ id: uid(), createdAt: stamp() }, data);
    db.visits.push(v); insert('visits', v); return v;
  }
  function updateVisit(id, data) {
    var v = visit(id); if (!v) return null;
    Object.assign(v, data);
    var row = visitRow(v); delete row.id; delete row.created_at;
    run([function () { return sb.from('visits').update(row).eq('id', id); }]);
    return v;
  }
  // Borra la visita; si la cafetería queda sin visitas, se va también. Devuelve si se borró la cafetería.
  function deleteVisit(id) {
    var v = visit(id); if (!v) return false;
    db.visits = db.visits.filter(function (x) { return x.id !== id; });
    var gone = !db.visits.some(function (x) { return x.cafeId === v.cafeId; });
    if (gone) {
      db.cafes = db.cafes.filter(function (c) { return c.id !== v.cafeId; });
      run([function () { return sb.from('cafes').delete().eq('id', v.cafeId); }]); // arrastra la visita (on delete cascade)
    } else {
      run([function () { return sb.from('visits').delete().eq('id', id); }]);
    }
    return gone;
  }
  function deleteCafe(id) {
    db.visits = db.visits.filter(function (v) { return v.cafeId !== id; });
    db.cafes = db.cafes.filter(function (c) { return c.id !== id; });
    run([function () { return sb.from('cafes').delete().eq('id', id); }]);
  }

  function wish(id) { return db.wishlist.find(function (w) { return w.id === id; }) || null; }
  function addWish(data) {
    var w = { id: uid(), name: data.name.trim(), barrio: (data.barrio || '').trim(), why: (data.why || '').trim(), address: (data.address || '').trim(), lat: coord(data.lat), lng: coord(data.lng), savedAt: today(), createdAt: stamp() };
    db.wishlist.unshift(w); insert('wishlist', w); return w;
  }
  function deleteWish(id) {
    db.wishlist = db.wishlist.filter(function (w) { return w.id !== id; });
    run([function () { return sb.from('wishlist').delete().eq('id', id); }]);
  }

  function deleteAllSteps() {
    var uidv = user.id;
    return [
      function () { return sb.from('cafes').delete().eq('user_id', uidv); }, // las visitas se van en cascada
      function () { return sb.from('wishlist').delete().eq('user_id', uidv); }
    ];
  }

  function exportJSON() {
    return JSON.stringify({ app: 'directo-al-grano', version: 2, exportedAt: new Date().toISOString(), data: { cafes: db.cafes, visits: db.visits, wishlist: db.wishlist } }, null, 2);
  }
  // Reemplaza todo lo de la cuenta por el contenido del archivo.
  function importJSON(text) {
    var parsed = JSON.parse(text);
    var d = parsed && parsed.data ? parsed.data : parsed;
    if (!d || !Array.isArray(d.cafes) || !Array.isArray(d.visits)) throw new Error('formato');
    var next = migrate({ cafes: d.cafes.slice(), visits: d.visits.slice(), wishlist: Array.isArray(d.wishlist) ? d.wishlist.slice() : [] });
    var ids = {};
    next.cafes = next.cafes.filter(function (c) { return c && c.id && c.name; });
    next.cafes.forEach(function (c) { ids[c.id] = true; });
    next.visits = next.visits.filter(function (v) { return v && v.id && ids[v.cafeId] && v.score >= 1 && v.score <= 10 && v.date; });
    next.wishlist = next.wishlist.filter(function (w) { return w && w.id && w.name; });
    db = next;
    run(deleteAllSteps().concat(insertSteps(next)));
  }
  function reset() { db = empty(); run(deleteAllSteps()); }

  // ---------- datos de la versión anterior (solo en este navegador) ----------
  function legacyData() {
    try {
      var d = JSON.parse(localStorage.getItem(LEGACY_KEY));
      if (d && Array.isArray(d.cafes) && Array.isArray(d.visits) && (d.cafes.length || (d.wishlist && d.wishlist.length))) return d;
    } catch (err) { /* nada */ }
    return null;
  }
  function importLegacy() {
    var d = legacyData(); if (!d) return false;
    importJSON(JSON.stringify(d));
    try { // queda una copia por las dudas, pero no se vuelve a ofrecer
      localStorage.setItem(LEGACY_KEY + '.subido', localStorage.getItem(LEGACY_KEY));
      localStorage.removeItem(LEGACY_KEY);
    } catch (err) { /* nada */ }
    return true;
  }

  // ---------- cuenta ----------
  var authListeners = [];
  var readyResolve;
  var ready = new Promise(function (r) { readyResolve = r; });
  var loading = Promise.resolve();
  var recovery = /(^#|&)type=recovery(&|$)/.test(initialHash);

  function emit(event, changed) {
    authListeners.forEach(function (fn) { try { fn(event, changed); } catch (e) { console.error(e); } });
  }
  function handle(event, session) {
    var next = session ? session.user : null;
    var changed = (next ? next.id : null) !== (user ? user.id : null);
    user = next;
    if (event === 'PASSWORD_RECOVERY') recovery = true;
    if (changed) {
      db = empty(); loadError = null;
      queue = Promise.resolve();
      loading = next ? loadRemote() : Promise.resolve();
    }
    loading.then(function () { readyResolve(); emit(event, changed); });
  }
  if (sb) {
    // Supabase pide no llamar a otros métodos dentro del callback: se difiere.
    sb.auth.onAuthStateChange(function (event, session) { setTimeout(function () { handle(event, session); }, 0); });
  } else {
    readyResolve();
  }

  function redirectUrl() { return location.origin + location.pathname; }
  function urlError() {
    var m = initialHash.match(/(?:^#|&)error_description=([^&]*)/);
    return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '';
  }

  var Auth = {
    configured: function () { return !!sb; },
    ready: function () { return ready; },
    user: function () { return user; },
    name: function () { return user && user.user_metadata && user.user_metadata.name ? user.user_metadata.name : ''; },
    onChange: function (fn) { authListeners.push(fn); },
    fromEmailLink: function () { return /(^#|&)(access_token|error_description)=/.test(initialHash); },
    linkType: function () { var m = initialHash.match(/(?:^#|&)type=([a-z_]+)/); return m ? m[1] : ''; },
    urlError: urlError,
    takeRecovery: function () { var r = recovery; recovery = false; return r && !!user; },
    signIn: function (email, password) {
      return sb.auth.signInWithPassword({ email: email, password: password }).then(function (res) { return { error: res.error }; });
    },
    // Si el proyecto pide confirmar el mail, no hay sesión hasta que se toca el link.
    signUp: function (email, password, name) {
      return sb.auth.signUp({ email: email, password: password, options: { data: { name: name || '' }, emailRedirectTo: redirectUrl() } }).then(function (res) {
        if (res.error) return { error: res.error };
        var u = res.data && res.data.user;
        // Con confirmación activada, un mail ya registrado vuelve "ok" pero sin identidades.
        if (u && Array.isArray(u.identities) && u.identities.length === 0) return { error: { code: 'user_already_exists', message: 'User already registered' } };
        return { error: null, needsConfirm: !(res.data && res.data.session) };
      });
    },
    resetPassword: function (email) {
      return sb.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl() }).then(function (res) { return { error: res.error }; });
    },
    updatePassword: function (password) {
      return sb.auth.updateUser({ password: password }).then(function (res) { return { error: res.error }; });
    },
    // Espera que terminen de subir los cambios pendientes antes de cerrar.
    signOut: function () {
      return queue.then(function () { return sb.auth.signOut(); }).then(function (res) { return { error: res && res.error }; });
    }
  };

  window.Store = {
    ASPECTS: ASPECTS, BEAN: BEAN, today: today,
    cafes: function () { return db.cafes.slice(); },
    visits: function () { return db.visits.slice().sort(byDateDesc); },
    wishlist: function () { return db.wishlist.slice(); },
    cafe: cafe, visit: visit, visitsOf: visitsOf, stats: stats, ranking: ranking, rankOf: rankOf, findCafeByName: findCafeByName,
    addCafe: addCafe, updateCafe: updateCafe, addVisit: addVisit, updateVisit: updateVisit, deleteVisit: deleteVisit, deleteCafe: deleteCafe,
    wish: wish, addWish: addWish, deleteWish: deleteWish,
    prefs: prefs, setPref: setPref, exportJSON: exportJSON, importJSON: importJSON, reset: reset,
    hasLegacy: function () { return !!legacyData(); }, importLegacy: importLegacy,
    loadError: function () { return loadError; },
    reload: function () { loading = loadRemote(); return loading; },
    onError: function (fn) { errorHandlers.push(fn); },
    auth: Auth
  };
})();
