/* Directo al grano — búsqueda de lugares reales con Photon (OpenStreetMap). Sin clave.
   https://photon.komoot.io — uso razonable: búsqueda con espera de 350 ms, mínimo 3 letras, una consulta a la vez. */
(function () {
  var API = 'https://photon.komoot.io';
  var BA = { lat: -34.6037, lng: -58.4180 }; // centro por defecto: Buenos Aires
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
      food: FOOD[p.osm_value] || 0
    };
  }

  function sub(pl) {
    return [pl.address, pl.barrio, pl.city !== pl.barrio ? pl.city : ''].filter(Boolean).join(', ');
  }

  var ctrl = null;
  // near: {lat, lng}. Devuelve lugares ordenados: cercanos primero y, entre ellos, cafeterías primero.
  function search(q, near) {
    if (ctrl) ctrl.abort();
    ctrl = window.AbortController ? new AbortController() : null;
    near = near || BA;
    var url = API + '/api/?q=' + encodeURIComponent(q) + '&limit=12&zoom=12&location_bias_scale=0.1&lat=' + near.lat.toFixed(4) + '&lon=' + near.lng.toFixed(4);
    return fetch(url, ctrl ? { signal: ctrl.signal } : {}).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    }).then(function (d) {
      var seen = {};
      return (d.features || []).map(toPlace).filter(function (pl) {
        var k = (pl.name + '|' + pl.address + '|' + pl.lat.toFixed(4)).toLowerCase();
        if (seen[k] || (!pl.name && !pl.address)) return false;
        seen[k] = 1; return true;
      }).map(function (pl, i) {
        pl.km = km(near, pl);
        // los primeros puestos de Photon valen, pero lo cercano y las cafeterías pesan más
        pl.rank = i + (pl.km > 60 ? 40 : pl.km > 15 ? 8 : 0) - pl.food * 1.5;
        return pl;
      }).sort(function (a, b) { return a.rank - b.rank; }).slice(0, 6);
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
      pl.lat = lat; pl.lng = lng;
      return pl;
    });
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
    var list = opts.list, timer = null, last = '', results = [];
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function icon(n) { return '<span class="dag-icon">' + window.DirectoAlGrano.icon(n) + '</span>'; }
    function paint(state) {
      var q = input.value.trim();
      var local = opts.local ? opts.local(q) : '';
      var remote = '';
      if (state === 'loading') remote = '<p class="app-suggest__state">Buscando en el mapa…</p>';
      else if (state === 'error') remote = '<p class="app-suggest__state">No pude buscar en el mapa. ¿Tenés conexión?</p>';
      else if (state === 'done' && !results.length) remote = '<p class="app-suggest__state">En el mapa no aparece. Marcala tocando el mapa.</p>';
      else if (state === 'done') {
        remote = '<p class="app-suggest__head">En el mapa</p>' + results.map(function (pl, i) {
          return '<button type="button" class="app-suggest__item" data-place="' + i + '">' + icon(pl.food ? 'cup' : 'map') +
            '<span class="app-suggest__txt"><b>' + esc(pl.name || pl.address) + '</b><span class="dag-muted">' + esc(pl.name ? sub(pl) : [pl.barrio, pl.city].filter(Boolean).join(', ')) + '</span></span>' +
            '<span class="app-suggest__km">' + fmtKm(pl.km) + '</span></button>';
        }).join('');
      }
      list.innerHTML = local + remote;
      list.hidden = !(local || remote);
    }
    input.addEventListener('input', function () {
      var q = input.value.trim();
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
      if (b) { var pl = results[+b.getAttribute('data-place')]; close(); opts.onPick(pl); return; }
      var l = e.target.closest('[data-local]');
      if (l && opts.onLocal) { close(); opts.onLocal(l); }
    });
    input.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !list.hidden) { e.stopPropagation(); close(); } });
    function close() { clearTimeout(timer); list.hidden = true; list.innerHTML = ''; }
    return { close: close };
  }

  window.Geo = { BA: BA, search: search, reverse: reverse, attach: attach, km: km, fmtKm: fmtKm, sub: sub };
})();
