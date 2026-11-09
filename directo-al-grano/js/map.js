/* Directo al grano — mapa real con Leaflet + tiles de OpenStreetMap,
   teñidos hacia los tokens map-* con un filtro CSS (ver app.css). Pines = componentes dag-pin. */
(function () {
  // Tiles estándar de OpenStreetMap (sin clave; uso personal, con atribución).
  // El tono Crema / Espresso sale de un filtro CSS sobre los tiles: ver --map-tiles-filter en app.css.
  var TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  var ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

  function ok() { return !!window.L; }

  function icon(html) {
    return L.divIcon({ className: 'app-pinicon', html: html, iconSize: [0, 0], iconAnchor: [0, 0] });
  }

  /* opts: center {lat,lng}, zoom, onTap(latlng), wheel (zoom con la rueda), zoomControl */
  function mount(el, opts) {
    opts = opts || {};
    if (!ok()) {
      el.innerHTML = '<p class="app-map-off">El mapa no cargó. Revisá la conexión y volvé a entrar.</p>';
      return null;
    }
    var c = opts.center || window.Geo.BA;
    var map = L.map(el, {
      center: [c.lat, c.lng], zoom: opts.zoom || 13, zoomControl: !!opts.zoomControl,
      scrollWheelZoom: !!opts.wheel, attributionControl: true, tap: false
    });
    if (opts.zoomControl) map.zoomControl.setPosition('bottomright');
    map.attributionControl.setPrefix(false);
    L.tileLayer(TILE_URL, { attribution: ATTR, maxZoom: 19 }).addTo(map);
    if (opts.onTap) map.on('click', function (e) { opts.onTap({ lat: e.latlng.lat, lng: e.latlng.lng }); });

    var markers = [], single = null;

    // list: [{lat, lng, html, onClick}]
    function setPins(list) {
      markers.forEach(function (m) { m.remove(); });
      markers = list.map(function (p) {
        var m = L.marker([p.lat, p.lng], { icon: icon(p.html), keyboard: false, riseOnHover: true, zIndexOffset: p.z || 0 }).addTo(map);
        if (p.onClick) m.on('click', function () { p.onClick(); });
        return m;
      });
    }
    // un único pin movible (formularios)
    function setPin(lat, lng, html, onMove) {
      if (single) single.remove();
      single = null;
      if (lat == null) return;
      single = L.marker([lat, lng], { icon: icon(html), draggable: !!onMove, keyboard: false }).addTo(map);
      if (onMove) single.on('dragend', function () { var p = single.getLatLng(); onMove({ lat: p.lat, lng: p.lng }); });
    }
    // dy: corrimiento vertical en px (positivo = el punto queda más arriba), para dejar lugar a sheets
    function centerOn(lat, lng, zoom, dy) {
      map.setView([lat, lng], zoom || map.getZoom(), { animate: false });
      if (dy) map.panBy([0, dy], { animate: false });
    }
    function fit(points, pad) {
      if (!points.length) return false;
      if (points.length === 1) { centerOn(points[0].lat, points[0].lng, 15); return true; }
      pad = pad || {};
      map.fitBounds(points.map(function (p) { return [p.lat, p.lng]; }), {
        paddingTopLeft: [24, pad.top || 24], paddingBottomRight: [24, pad.bottom || 24], maxZoom: 15, animate: false
      });
      return true;
    }
    function center() { var c = map.getCenter(); return { lat: c.lat, lng: c.lng }; }
    function destroy() { map.remove(); }

    return { map: map, setPins: setPins, setPin: setPin, centerOn: centerOn, fit: fit, center: center, invalidate: function () { map.invalidateSize(); }, destroy: destroy };
  }

  window.MapView = { mount: mount, ok: ok };
})();
