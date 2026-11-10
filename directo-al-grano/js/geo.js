/* Directo al grano — búsqueda de lugares reales con Photon (OpenStreetMap). Sin clave.
   https://photon.komoot.io — uso razonable: búsqueda con espera de 350 ms, mínimo 3 letras, una consulta a la vez. */
(function () {
  var API = 'https://photon.komoot.io';
  var BA = { lat: -34.6037, lng: -58.4180 }; // centro por defecto: Buenos Aires
  // Argentina entera (minLon,minLat,maxLon,maxLat): los resultados de afuera no se piden.
  var AR_BBOX = '-73.6,-55.2,-53.5,-21.7';
  var FOOD = { cafe: 3, coffee_shop: 3, coffee: 3, bakery: 2, restaurant: 1, fast_food: 1, ice_cream: 1, pastry: 2, deli: 1 };

  function km(a, b) {
    var R = 6371, toR = Math.PI / 180;
    var dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function toPlace(f) {
    var p = f.properties || {}, c = f.geometry.coordinates;
    var street = [p.street, p.housenumber].filter(Boolean).join(' ');
    var barrio = p.district || p.locality || p.suburb || '';
    var isAddress = p.osm_key === 'place' && (p.type === 'house' || p.osm_value === 'house');
    var name = isAddress ? '' : (p.name || '');
    return {
      name: name,
      address: street || (isAddress ? p.name || '' : ''),
      barrio: barrio,
      city: p.city || p.county || p.state || '',
      country: p.country || '',
      lat: c[1], lng: c[0],
      kind: p.osm_value || '',
      countrycode: (p.countrycode || '').toUpperCase(),
      // id estable del lugar en OpenStreetMap: junta las reviews de todos sobre la misma cafetería
      placeId: !isAddress && p.osm_type && p.osm_id ? p.osm_type + p.osm_id : '',
      food: FOOD[p.osm_value] || 0
    };
  }

  function sub(pl) {
    return [pl.address, pl.barrio, pl.city !== pl.barrio ? pl.city : ''].filter(Boolean).join(', ');
  }

  var ctrl = null;
  function query(q, near, extra, signal) {
    var url = API + '/api/?q=' + encodeURIComponent(q) + '&limit=10&bbox=' + AR_BBOX +
      '&lat=' + near.lat.toFixed(4) + '&lon=' + near.lng.toFixed(4) + '&zoom=13&location_bias_scale=0.3' + (extra || '');
    return fetch(url, signal ? { signal: signal } : {}).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    }).then(function (d) { return d.features || []; });
  }
  // near: {lat, lng}. Solo Argentina. Dos consultas a la vez: una solo de cafeterías (para que el nombre
  // de un café le gane a una calle que se llama parecido) y una general (direcciones y lo demás).
  function search(q, near) {
    if (ctrl) ctrl.abort();
    ctrl = window.AbortController ? new AbortController() : null;
    var signal = ctrl ? ctrl.signal : null;
    near = near || BA;
    // si falla una de las dos, alcanza con la otra; si fallan las dos, error
    var failed = 0, lastErr = null;
    function soft(p) {
      return p.catch(function (err) {
        if (err && err.name === 'AbortError') throw err;
        failed++; lastErr = err; return [];
      });
    }
    var cafes = soft(query(q, near, '&osm_tag=amenity:cafe&osm_tag=shop:coffee', signal));
    return Promise.all([cafes, soft(query(q, near, '', signal))]).then(function (r) {
      if (failed === 2) throw lastErr;
      var seen = {};
      return r[0].concat(r[1]).map(toPlace).filter(function (pl) {
        if (pl.countrycode && pl.countrycode !== 'AR') return false;
        var k = pl.placeId || (pl.name + '|' + pl.address + '|' + pl.lat.toFixed(4)).toLowerCase();
        if (seen[k] || (!pl.name && !pl.address)) return false;
        seen[k] = 1; return true;
      }).map(function (pl, i) {
        pl.km = km(near, pl);
        // el orden de Photon vale, pero las cafeterías y lo cercano pesan más
        pl.rank = i + (pl.km > 300 ? 12 : pl.km > 40 ? 5 : 0) - pl.food * 3;
        return pl;
      }).sort(function (a, b) { return a.rank - b.rank; }).slice(0, 7);
    });
  }

  function reverse(lat, lng) {
    return fetch(API + '/reverse?lat=' + lat.toFixed(6) + '&lon=' + lng.toFixed(6) + '&limit=1').then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    }).then(function (d) {
      var f = (d.features || [])[0];
      if (!f) return null;
      var pl = toPlace(f);
      pl.lat = lat; pl.lng = lng; pl.placeId = ''; // un toque en el mapa no identifica la cafetería
      return pl;
    });
  }

  // ---------- links de Google Maps ----------
  // Los largos (google.com/maps/place/Nombre/@lat,lng…!3dLAT!4dLNG) traen nombre y ubicación: se leen acá, sin pedir nada.
  // Los cortos (maps.app.goo.gl, share.google) no la traen sin abrirlos, y desde la página no se pueden abrir.
  var MAPS_LINK = /^\s*(https?:\/\/)?((www\.|maps\.)?google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps|share\.google)/i;
  var SHORT_LINK = /^\s*(https?:\/\/)?(maps\.app\.goo\.gl|goo\.gl\/maps|share\.google)/i;
  function isMapsLink(q) { return MAPS_LINK.test(q); }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : null; }
  function okLL(lat, lng) { return lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0); }
  function words(v) { try { return decodeURIComponent(v.replace(/\+/g, ' ')).trim(); } catch (e) { return v.replace(/\+/g, ' ').trim(); } }
  // Devuelve { name, lat, lng } o null si el link no trae ubicación.
  function parseMapsLink(url) {
    url = url.trim();
    var lat = null, lng = null, name = '', m;
    // 1) la del lugar en sí (lo más exacto)
    if ((m = url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/))) { lat = num(m[1]); lng = num(m[2]); }
    // 2) q / query / ll / center con coordenadas
    if (!okLL(lat, lng) && (m = url.match(/[?&](?:q|query|ll|center|destination)=(-?\d+(?:\.\d+)?)(?:,|%2C)\s*(-?\d+(?:\.\d+)?)/i))) { lat = num(m[1]); lng = num(m[2]); }
    // 3) el centro del mapa (@lat,lng,zoom): cerca del lugar cuando el link es de un lugar
    if (!okLL(lat, lng) && (m = url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/))) { lat = num(m[1]); lng = num(m[2]); }
    if (!okLL(lat, lng)) return null;
    if ((m = url.match(/\/maps\/place\/([^/@?]+)/))) name = words(m[1]);
    else if ((m = url.match(/[?&](?:q|query)=([^&]+)/)) && !/^-?\d+(\.\d+)?(,|%2C)/i.test(m[1])) name = words(m[1]);
    if (/^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(name)) name = ''; // "/place/-34.6,-58.4" no es un nombre
    return { name: name, lat: lat, lng: lng };
  }
  // Link para buscar en Google Maps lo que no aparece acá (cerca de donde estás mirando).
  function mapsSearchUrl(q, near) {
    var u = 'https://www.google.com/maps/search/' + encodeURIComponent(q + ', Argentina');
    return near ? u + '/@' + near.lat.toFixed(5) + ',' + near.lng.toFixed(5) + ',13z' : u;
  }

  function fmtKm(d) {
    if (d == null || d >= 100) return ''; // lejos: el país/ciudad ya lo dice
    if (d < 1) return 'a ' + Math.max(50, Math.round(d * 1000 / 50) * 50) + ' m';
    return 'a ' + String(Math.round(d * 10) / 10).replace('.', ',') + ' km';
  }

  /* Conecta un input a una lista de resultados.
     opts.list: contenedor; opts.near(): {lat,lng}; opts.local(q): html de resultados propios (opcional);
     opts.onPick(place); opts.onLocal(el) para clicks en ítems propios. */
  function attach(input, opts) {
    var list = opts.list, timer = null, last = '', results = [], linkMsg = '';
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function icon(n) { return '<span class="dag-icon">' + window.DirectoAlGrano.icon(n) + '</span>'; }
    function paint(state) {
      var q = input.value.trim();
      var local = opts.local ? opts.local(q) : '';
      var remote = '';
      var gmaps = '<a class="app-suggest__item app-suggest__gmaps" href="' + esc(mapsSearchUrl(q, opts.near ? opts.near() : null)) + '" target="_blank" rel="noopener">' + icon('route') +
        '<span class="app-suggest__txt"><b>Abrir en Google Maps</b><span class="dag-muted">Fijate dónde queda y tocá ese punto en el mapa de acá.</span></span></a>';
      if (state === 'link') remote = linkMsg;
      else if (state === 'picking') remote = '<p class="app-suggest__state">Ubicándola…</p>';
      else if (state === 'loading') remote = '<p class="app-suggest__state">Buscando en el mapa…</p>';
      else if (state === 'error') remote = '<p class="app-suggest__state">No pude buscar en el mapa. ¿Tenés conexión?</p>' + gmaps;
      else if (state === 'done' && !results.length) remote = '<p class="app-suggest__state">No aparece en el mapa. Buscala en Google Maps, o pegá acá el link largo de Maps (el de la barra del navegador).</p>' + gmaps;
      else if (state === 'done') {
        remote = '<p class="app-suggest__head">' + (results[0].fromLink ? 'Del link de Google Maps' : 'En el mapa') + '</p>' + results.map(function (pl, i) {
          return '<button type="button" class="app-suggest__item" data-place="' + i + '">' + icon(pl.food ? 'cup' : 'map') +
            '<span class="app-suggest__txt"><b>' + esc(pl.name || pl.address) + '</b><span class="dag-muted">' + esc(pl.name ? sub(pl) : [pl.barrio, pl.city].filter(Boolean).join(', ')) + '</span></span>' +
            '<span class="app-suggest__km">' + fmtKm(pl.km) + '</span></button>';
        }).join('') + (results[0].fromLink ? '' : '<p class="app-suggest__head">¿No es ninguna?</p>' + gmaps);
      }
      list.innerHTML = local + remote;
      list.hidden = !(local || remote);
    }
    // Pegaron un link de Google Maps: se lee el link en vez de buscar.
    function fromLink(q) {
      clearTimeout(timer); if (ctrl) ctrl.abort(); last = '';
      var pl = parseMapsLink(q);
      if (pl) {
        results = [{ name: pl.name, address: '', barrio: '', city: '', country: '', lat: pl.lat, lng: pl.lng, kind: 'link', food: 3, placeId: '', fromLink: true, km: null }];
        paint('done');
        return;
      }
      results = [];
      linkMsg = '<p class="app-suggest__state">' + (SHORT_LINK.test(q)
        ? 'Ese link corto no trae la ubicación. Abrilo, y copiá el link largo de la barra del navegador (el que dice google.com/maps/place/…). O tocá el lugar en el mapa.'
        : 'Ese link de Google Maps no trae la ubicación. Abrí el lugar en Maps y copiá el link de la barra del navegador.') + '</p>';
      paint('link');
    }
    input.addEventListener('input', function () {
      var q = input.value.trim();
      if (isMapsLink(q)) { fromLink(q); return; }
      clearTimeout(timer);
      if (q.length < 3) { results = []; last = ''; if (ctrl) ctrl.abort(); paint(''); return; }
      paint(q === last ? 'done' : 'loading');
      if (q === last) return;
      timer = setTimeout(function () {
        search(q, opts.near ? opts.near() : null).then(function (r) {
          if (input.value.trim() !== q) return;
          results = r; last = q; paint('done');
        }).catch(function (err) {
          if (err && err.name === 'AbortError') return;
          if (input.value.trim() === q) paint('error');
        });
      }, 350);
    });
    list.addEventListener('click', function (e) {
      var b = e.target.closest('[data-place]');
      if (b) {
        var pl = results[+b.getAttribute('data-place')];
        if (!pl.fromLink) { close(); opts.onPick(pl); return; }
        // del link: nombre y punto exactos; dirección y barrio los completa OpenStreetMap
        paint('picking');
        var done = function () { close(); input.value = ''; opts.onPick(pl); };
        reverse(pl.lat, pl.lng).then(function (r) {
          if (r) { pl.address = r.address || (pl.name ? '' : r.name) || ''; pl.barrio = r.barrio; pl.city = r.city; }
        }).catch(function () { /* sin dirección, igual sirve */ }).then(done);
        return;
      }
      var l = e.target.closest('[data-local]');
      if (l && opts.onLocal) { close(); opts.onLocal(l); }
    });
    input.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !list.hidden) { e.stopPropagation(); close(); } });
    function close() { clearTimeout(timer); list.hidden = true; list.innerHTML = ''; }
    return { close: close };
  }

  window.Geo = { BA: BA, search: search, parseMapsLink: parseMapsLink, mapsSearchUrl: mapsSearchUrl, reverse: reverse, attach: attach, km: km, fmtKm: fmtKm, sub: sub };
})();
