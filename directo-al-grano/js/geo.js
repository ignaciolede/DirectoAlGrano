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

  // El link tal cual lo pegaron (sin texto alrededor), con https://
  function cleanLink(u) {
    var m = String(u || '').trim().match(/^\S+/);
    if (!m) return '';
    var v = m[0];
    return ('https://' + v.replace(/^https?:\/\//i, '')).slice(0, 2000);
  }
  // El nombre del lugar en un link que lleva a una búsqueda (share.google → google.com/search?q=Nombre)
  function linkName(chain) {
    var name = '';
    chain.slice().reverse().some(function (u) {
      var m = /\/(search|maps)/.test(u) && u.match(/[?&]q=([^&]+)/);
      if (m && !/^-?\d/.test(m[1])) { name = words(m[1]); return true; }
      m = u.match(/\/maps\/(?:place|search)\/([^/@?]+)/);
      if (m && !/^-?\d/.test(m[1])) { name = words(m[1]); return true; }
      return false;
    });
    return name.slice(0, 120);
  }

  // quién abre los links cortos y busca en Google (lo pone la app: necesita Supabase).
  // fn({ url, near } | { q, near }) → Promise<{ chain, name, places, noKey }>
  var linkResolver = null;
  function setLinkResolver(fn) { linkResolver = fn; }

  function fmtKm(d) {
    if (d == null || d >= 100) return ''; // lejos: el país/ciudad ya lo dice
    if (d < 1) return 'a ' + Math.max(50, Math.round(d * 1000 / 50) * 50) + ' m';
    return 'a ' + String(Math.round(d * 10) / 10).replace('.', ',') + ' km';
  }

  /* Conecta un input a una lista de resultados.
     opts.list: contenedor; opts.near(): {lat,lng}; opts.local(q): html de resultados propios (opcional);
     opts.onPick(place); opts.onLocal(el) para clicks en ítems propios. */
  function attach(input, opts) {
    var list = opts.list, timer = null, last = '', results = [], linkMsg = '', keep = null;
    var where = opts.pasteWhere || 'acá'; // dónde pegar una dirección copiada de Maps
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function icon(n) { return '<span class="dag-icon">' + window.DirectoAlGrano.icon(n) + '</span>'; }
    function placeBtn(pl, i) {
      return '<button type="button" class="app-suggest__item" data-place="' + i + '">' + icon(pl.food ? 'cup' : 'map') +
        '<span class="app-suggest__txt"><b>' + esc(pl.name || pl.address) + '</b><span class="dag-muted">' + esc(pl.name ? sub(pl) : [pl.barrio, pl.city].filter(Boolean).join(', ')) + '</span></span>' +
        '<span class="app-suggest__km">' + fmtKm(pl.km) + '</span></button>';
    }
    function paint(state) {
      var q = input.value.trim();
      var local = opts.local ? opts.local(q) : '';
      var remote = '';
      var gmaps = opts.onGmaps
        ? '<button type="button" class="app-suggest__item app-suggest__gmaps" data-gmaps>' + icon('map') +
          '<span class="app-suggest__txt"><b>Ver en Google Maps</b><span class="dag-muted">Sin salir de la app: mirá cómo figura y dónde queda.</span></span></button>'
        : '<a class="app-suggest__item app-suggest__gmaps" href="' + esc(mapsSearchUrl(q, opts.near ? opts.near() : null)) + '" target="_blank" rel="noopener">' + icon('route') +
          '<span class="app-suggest__txt"><b>Abrir en Google Maps</b><span class="dag-muted">Tocá la dirección del lugar para copiarla y pegala ' + where + '.</span></span></a>';
      // buscar el nombre en Google (con ubicación real): solo si está la función del servidor
      var gsearch = linkResolver && q.length >= 3
        ? '<button type="button" class="app-suggest__item app-suggest__gmaps" data-gsearch>' + icon('search') +
          '<span class="app-suggest__txt"><b>Buscar «' + esc(q.length > 40 ? q.slice(0, 40) + '…' : q) + '» en Google</b><span class="dag-muted">La ubica con la dirección de Google Maps.</span></span></button>'
        : '';
      if (state === 'link') remote = linkMsg;
      else if (state === 'picking') remote = '<p class="app-suggest__state">Ubicándola…</p>';
      else if (state === 'loading') remote = '<p class="app-suggest__state">Buscando en el mapa…</p>';
      else if (state === 'gloading') remote = '<p class="app-suggest__state">Buscando en Google…</p>';
      else if (state === 'error') remote = '<p class="app-suggest__state">No pude buscar en el mapa. ¿Tenés conexión?</p>' + gsearch + gmaps;
      else if (state === 'done' && !results.length) remote = '<p class="app-suggest__state">No aparece en el mapa.' + (gsearch ? '' : ' Copiá su dirección desde Google Maps y pegala ' + where + ': las direcciones sí las encuentra.') + '</p>' + gsearch + gmaps;
      else if (state === 'done') {
        var src = results[0].src;
        remote = '<p class="app-suggest__head">' + (src === 'link' ? 'Del link de Google Maps' : src === 'google' ? 'En Google Maps' : 'En el mapa') + '</p>' + results.map(placeBtn).join('') +
          (src === 'link' ? '' : '<p class="app-suggest__head">¿No es ninguna?</p>' + (src === 'google' ? '' : gsearch) + gmaps);
      }
      list.innerHTML = local + remote;
      list.hidden = !(local || remote);
    }
    // Pegaron un link de Google Maps: se lee el link en vez de buscar.
    var linkSeq = 0;
    function showLinkPlace(pl, url) {
      results = [{ name: pl.name, address: '', barrio: '', city: '', country: '', lat: pl.lat, lng: pl.lng, kind: 'link', food: 3, placeId: '', fromLink: true, src: 'link', mapsUrl: cleanLink(url), km: null }];
      paint('done');
    }
    // Lugares de Google Places (los devuelve la función del servidor): nombre, dirección y ubicación reales.
    function googlePlaces(list, url) {
      var near = opts.near ? opts.near() : null;
      return list.map(function (p) {
        return {
          name: p.name || '', address: p.address || '', barrio: p.barrio || '', city: p.city || '', country: 'Argentina',
          lat: p.lat, lng: p.lng, kind: 'google', food: 3, placeId: '', gid: p.gid || '', fromLink: true, google: true, src: 'google',
          mapsUrl: url ? cleanLink(url) : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.name || p.address) + (p.gid ? '&query_place_id=' + encodeURIComponent(p.gid) : ''),
          km: near ? km(near, p) : null
        };
      });
    }
    // Buscar por nombre en Google lo que OpenStreetMap no tiene
    function googleSearch(q) {
      clearTimeout(timer); if (ctrl) ctrl.abort();
      var mine = ++linkSeq;
      results = []; paint('gloading');
      linkResolver({ q: q, near: opts.near ? opts.near() : null }).then(function (d) {
        if (mine !== linkSeq || input.value.trim() !== q) return;
        if (d.places && d.places.length) { results = googlePlaces(d.places); paint('done'); return; }
        linkMsg = '<p class="app-suggest__state">' + (d.noKey
          ? 'La búsqueda en Google todavía no está activada (falta la clave GOOGLE_MAPS_KEY en Supabase). ' + COPY_TIP
          : 'Google tampoco la encontró. Probá con otro nombre o ' + COPY_TIP.charAt(0).toLowerCase() + COPY_TIP.slice(1)) + '</p>';
        paint('link');
      }, function (err) {
        if (mine !== linkSeq || input.value.trim() !== q) return;
        linkMsg = '<p class="app-suggest__state">' + (err && err.missing ? 'Falta activar la función maps-link en Supabase. '
          : err && err.auth ? 'Tu sesión venció. Cerrá sesión y volvé a entrar. ' : 'No pude buscar en Google. ¿Tenés conexión? ') + '</p>';
        paint('link');
      });
    }
    // El link no trae la ubicación (share.google, o no se pudo abrir): igual se puede guardar.
    // Queda en la cafetería para abrirla en Google Maps; la ubicación se marca a mano.
    function keepButton(name) {
      return '<button type="button" class="app-suggest__item app-suggest__gmaps" data-keeplink>' + icon('map') +
        '<span class="app-suggest__txt"><b>' + (name ? 'Usar «' + esc(name) + '» con este link' : 'Guardar este link') + '</b>' +
        '<span class="dag-muted">Queda guardado para abrirla en Google Maps. Después marcá dónde queda.</span></span></button>';
    }
    // share.google con la ubicación que encontró Google: se elige el lugar (o se guarda solo el link)
    function linkGoogle(places, url, name) {
      results = googlePlaces(places, url);
      keep = { name: name || '', mapsUrl: cleanLink(url) };
      linkMsg = '<p class="app-suggest__head">Del link de Google Maps</p>' + results.map(placeBtn).join('') +
        '<p class="app-suggest__head">¿No es ninguna?</p>' + keepButton(name);
      paint('link');
    }
    function linkFail(text, url, name) {
      results = [];
      keep = { name: name || '', mapsUrl: cleanLink(url) };
      var keepBtn = keepButton(name);
      linkMsg = keepBtn + '<p class="app-suggest__state">' + text + '</p>';
      paint('link');
      // con el nombre se busca en el mapa: si aparece, sale con ubicación y todo (y con el link)
      if (name && name.length >= 3) {
        var mine = linkSeq;
        search(name, opts.near ? opts.near() : null).then(function (r) {
          if (mine !== linkSeq || !r.length) return;
          r.forEach(function (pl) { pl.mapsUrl = keep.mapsUrl; });
          results = r;
          linkMsg = '<p class="app-suggest__head">¿Es alguna de estas?</p>' + results.map(placeBtn).join('') +
            '<p class="app-suggest__head">¿No es ninguna?</p>' + keepBtn;
          paint('link');
        }).catch(function () { /* queda la opción de guardar el link */ });
      }
    }
    var COPY_TIP = 'En Maps tocá la dirección del lugar para copiarla y pegala ' + where + ', o marcala con «Marcar en el mapa».';
    function fromLink(q) {
      clearTimeout(timer); if (ctrl) ctrl.abort(); last = ''; keep = null;
      var mine = ++linkSeq;
      var pl = parseMapsLink(q);
      if (pl) { showLinkPlace(pl, q); return; }
      if (!SHORT_LINK.test(q) || !linkResolver) { linkFail('Ese link no trae la ubicación. ' + COPY_TIP, q, linkName([q])); return; }
      // link corto (maps.app.goo.gl…): se abre del lado del servidor y se lee adónde lleva
      results = []; linkMsg = '<p class="app-suggest__state">Abriendo el link…</p>'; paint('link');
      linkResolver({ url: q, near: opts.near ? opts.near() : null }).then(function (d) {
        if (mine !== linkSeq || input.value.trim() !== q) return;
        var chain = d.chain && d.chain.length ? d.chain : d.url ? [d.url] : [];
        for (var i = chain.length - 1; i >= 0; i--) { var p = parseMapsLink(chain[i]); if (p) { showLinkPlace(p, q); return; } }
        // share.google y similares: llevan a una búsqueda con el nombre; la ubicación la busca Google Places
        var name = d.name || linkName(chain);
        if (d.places && d.places.length) { linkGoogle(d.places, q, name); return; }
        linkFail(name ? 'Ese link trae el nombre pero no la ubicación' + (d.noKey ? ' (para ubicarla sola falta la clave GOOGLE_MAPS_KEY en Supabase)' : '') +
            '. Guardalo igual y marcá dónde queda con «Marcar en el mapa», o pegá la dirección ' + where + '.'
          : 'No encontré la ubicación en ese link. ' + COPY_TIP, q, name);
      }, function (err) {
        if (mine !== linkSeq || input.value.trim() !== q) return;
        if (err && err.notFound) { results = []; keep = null; linkMsg = '<p class="app-suggest__state">Ese link no existe o venció. Compartí el lugar de nuevo desde Maps.</p>'; paint('link'); return; }
        linkFail(err && err.missing ? 'Para leer links cortos falta activar la función maps-link en Supabase. ' + COPY_TIP
          : err && err.auth ? 'Tu sesión venció. Cerrá sesión y volvé a entrar para leer links.'
          : 'No pude abrir el link. ¿Tenés conexión? ' + COPY_TIP, q, '');
      });
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
        var done = function () { close(); input.value = ''; opts.onPick(pl); };
        if (pl.google && pl.address) { done(); return; } // Google ya trae la dirección
        // del link: nombre y punto exactos; dirección y barrio los completa OpenStreetMap
        paint('picking');
        reverse(pl.lat, pl.lng).then(function (r) {
          if (r) { pl.address = pl.address || r.address || (pl.name ? '' : r.name) || ''; pl.barrio = pl.barrio || r.barrio; pl.city = pl.city || r.city; }
        }).catch(function () { /* sin dirección, igual sirve */ }).then(done);
        return;
      }
      if (e.target.closest('[data-keeplink]') && keep) {
        var k = keep; close(); input.value = '';
        opts.onPick({ name: k.name, address: '', barrio: '', city: '', lat: null, lng: null, placeId: '', mapsUrl: k.mapsUrl, linkOnly: true });
        return;
      }
      if (e.target.closest('[data-gsearch]') && linkResolver) { googleSearch(input.value.trim()); return; }
      if (e.target.closest('[data-gmaps]') && opts.onGmaps) { var gq = input.value.trim(); close(); opts.onGmaps(gq); return; }
      var l = e.target.closest('[data-local]');
      if (l && opts.onLocal) { close(); opts.onLocal(l); }
    });
    input.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !list.hidden) { e.stopPropagation(); close(); } });
    function close() { clearTimeout(timer); list.hidden = true; list.innerHTML = ''; }
    return { close: close };
  }

  window.Geo = { BA: BA, search: search, setLinkResolver: setLinkResolver, isMapsLink: isMapsLink, parseMapsLink: parseMapsLink, cleanLink: cleanLink, mapsSearchUrl: mapsSearchUrl, reverse: reverse, attach: attach, km: km, fmtKm: fmtKm, sub: sub };
})();
