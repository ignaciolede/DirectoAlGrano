// Directo al grano — abre un link corto de Google Maps (maps.app.goo.gl, goo.gl/maps, share.google)
// y devuelve adónde lleva. El link largo final trae la ubicación (…/maps/place/Nombre/@lat,lng…!3dLAT!4dLNG);
// la app la lee de ahí. Desde el navegador no se puede seguir el redirect (Google no lo permite), por eso esto.
//
// Solo sigue redirects (no descarga páginas) y solo a dominios de Google: no sirve para abrir cualquier URL.
// Requiere sesión: la propia función le pregunta a Supabase Auth si el token es de un usuario
// (así anda igual tenga o no activado "Verify JWT").
//
// Ubicación real con Google Places (opcional): los links de share.google llevan a una búsqueda con el
// nombre y sin coordenadas. Si está el secreto GOOGLE_MAPS_KEY, la función busca ese nombre en Google Places
// y devuelve el lugar con su ubicación. También sirve para buscar por nombre ({ q }) lo que no está en OpenStreetMap.
// Con { refresh: [ids] } renueva la ubicación de lugares ya guardados (las condiciones de Google permiten guardar
// coordenadas hasta 30 días; el id del lugar, sin límite): pide solo `location` por id.
// La clave nunca llega al navegador. Configurarla: Dashboard → Edge Functions → Secrets → GOOGLE_MAPS_KEY.
//
// Deploy (una vez): Dashboard → Edge Functions → Deploy a new function → Via Editor,
// nombre "maps-link", pegá este archivo y Deploy. O con la CLI: supabase functions deploy maps-link

const HOSTS = /^(maps\.app\.goo\.gl|goo\.gl|share\.google|(www\.)?google\.[a-z.]{2,6}|maps\.google\.[a-z.]{2,6}|consent\.google\.[a-z.]{2,6})$/i;
const HAS_COORDS = /!3d-?\d|@-?\d+\.\d+,-?\d+\.\d+|[?&](q|query|ll|center)=-?\d+\.\d+(,|%2C)/i;
const MAX_HOPS = 6;
// Argentina (para que "Café X" no devuelva uno de otro país)
const AR = { low: { latitude: -55.2, longitude: -73.6 }, high: { latitude: -21.7, longitude: -53.5 } };

type Place = { name: string; address: string; barrio: string; city: string; lat: number; lng: number; gid: string };
type Near = { lat: number; lng: number } | null;

function nearFrom(v: unknown): Near {
  const o = v as { lat?: unknown; lng?: unknown } | null;
  const lat = Number(o?.lat), lng = Number(o?.lng);
  return o && isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

// Nombre del lugar en un link que lleva a una búsqueda (share.google → google.com/search?q=Nombre)
function nameFrom(chain: string[]): string {
  for (let i = chain.length - 1; i >= 0; i--) {
    try {
      const u = new URL(chain[i]);
      const q = u.searchParams.get('q') || u.searchParams.get('query') || '';
      if (q && !/^-?\d/.test(q) && /\/(search|maps)/.test(u.pathname)) return q.trim().slice(0, 200);
      const m = u.pathname.match(/\/maps\/(?:place|search)\/([^/@]+)/);
      if (m) { const n = decodeURIComponent(m[1].replace(/\+/g, ' ')).trim(); if (n && !/^-?\d/.test(n)) return n.slice(0, 200); }
    } catch { /* link raro: se saltea */ }
  }
  return '';
}

// Google Places (New) Text Search. Devuelve hasta `max` lugares de Argentina, cerca de `near` si viene.
async function placesSearch(text: string, near: Near, max: number): Promise<Place[] | null> {
  const key = Deno.env.get('GOOGLE_MAPS_KEY');
  if (!key) return null;
  const body: Record<string, unknown> = { textQuery: text, languageCode: 'es', regionCode: 'AR', pageSize: max };
  body.locationBias = near ? { circle: { center: { latitude: near.lat, longitude: near.lng }, radius: 50000 } } : { rectangle: AR };
  const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.shortFormattedAddress,places.location,places.addressComponents',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) { console.error('places', r.status, await r.text()); throw new Error('places ' + r.status); }
  const d = await r.json();
  // deno-lint-ignore no-explicit-any
  return (d.places || []).filter((p: any) => p.location).map((p: any): Place => {
    // deno-lint-ignore no-explicit-any
    const comp = (t: string) => (p.addressComponents || []).find((c: any) => (c.types || []).includes(t))?.longText || '';
    const street = [comp('route'), comp('street_number')].filter(Boolean).join(' ');
    return {
      name: p.displayName?.text || '',
      address: street || (p.shortFormattedAddress || p.formattedAddress || '').split(',')[0],
      barrio: comp('sublocality_level_1') || comp('neighborhood') || comp('sublocality'),
      city: comp('locality') || comp('administrative_area_level_2') || comp('administrative_area_level_1'),
      lat: p.location.latitude, lng: p.location.longitude,
      gid: p.id || '',
    };
  }).filter((p: Place) => p.lat >= -56 && p.lat <= -21 && p.lng >= -74 && p.lng <= -53);
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

// ¿El token es de un usuario con sesión? (la clave pública sola no alcanza)
async function signedIn(req: Request): Promise<boolean> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  const base = Deno.env.get('SUPABASE_URL');
  const apikey = req.headers.get('apikey') || Deno.env.get('SUPABASE_ANON_KEY') || '';
  if (!token || !base || !apikey || token === apikey) return false;
  try {
    const r = await fetch(base + '/auth/v1/user', {
      headers: { apikey, Authorization: 'Bearer ' + token },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) { await r.body?.cancel(); return false; }
    const u = await r.json();
    return !!u?.id;
  } catch {
    return false;
  }
}

// Ubicación actual de cada lugar por su id. null = ya no existe en Google; si falla, no viene (se reintenta).
async function placesRefresh(ids: string[]): Promise<Record<string, { lat: number; lng: number } | null> | null> {
  const key = Deno.env.get('GOOGLE_MAPS_KEY');
  if (!key) return null;
  const out: Record<string, { lat: number; lng: number } | null> = {};
  await Promise.all(ids.map(async (id) => {
    try {
      const r = await fetch('https://places.googleapis.com/v1/places/' + encodeURIComponent(id), {
        headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'location' },
        signal: AbortSignal.timeout(8000),
      });
      if (r.status === 404) { await r.body?.cancel(); out[id] = null; return; }
      if (!r.ok) { console.error('refresh', id, r.status, await r.text()); return; }
      const d = await r.json();
      if (d.location) out[id] = { lat: d.location.latitude, lng: d.location.longitude };
    } catch { /* se reintenta la próxima vez */ }
  }));
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  if (!(await signedIn(req))) return json({ error: 'auth' }, 401);

  let u: URL, near: Near = null;
  try {
    const body = await req.json();
    near = nearFrom(body?.near);
    // renovar ubicaciones guardadas
    if (Array.isArray(body?.refresh)) {
      const ids = body.refresh.filter((x: unknown) => typeof x === 'string' && /^[A-Za-z0-9_-]{10,300}$/.test(x)).slice(0, 20);
      const places = await placesRefresh(ids);
      return places === null ? json({ noKey: true }) : json({ places });
    }
    // búsqueda por nombre (lo que no aparece en OpenStreetMap)
    if (typeof body?.q === 'string') {
      const q = body.q.trim().slice(0, 200);
      if (q.length < 3) return json({ error: 'q' }, 400);
      try {
        const places = await placesSearch(q, near, 5);
        return places === null ? json({ places: [], noKey: true }) : json({ places });
      } catch {
        return json({ error: 'places' }, 502);
      }
    }
    const raw = String(body?.url ?? '').trim();
    if (raw.length > 2000) return json({ error: 'url' }, 400);
    u = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw);
  } catch {
    return json({ error: 'url' }, 400);
  }

  const chain: string[] = [u.toString()];
  for (let hop = 0; hop < MAX_HOPS; hop++) {
    if (!/^https?:$/.test(u.protocol) || !HOSTS.test(u.hostname)) return json({ error: 'host', chain }, 400);
    if (HAS_COORDS.test(u.href)) break; // ya trae la ubicación
    // página de consentimiento (Europa): el destino viene en ?continue=
    if (/^consent\./i.test(u.hostname)) {
      const next = u.searchParams.get('continue');
      if (!next) break;
      u = new URL(next); chain.push(u.toString());
      continue;
    }
    let res: Response;
    try {
      res = await fetch(u, {
        redirect: 'manual',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DirectoAlGrano/1.0)', 'Accept-Language': 'es-AR,es;q=0.9' },
        signal: AbortSignal.timeout(6000),
      });
    } catch {
      return json({ error: 'fetch', chain }, 502);
    }
    await res.body?.cancel();
    const loc = res.headers.get('location');
    if (res.status < 300 || res.status >= 400 || !loc) {
      // 422 y no 404: 404 queda para "la función no está deployada"
      if (res.status === 404) return json({ error: 'not_found', chain }, 422);
      break;
    }
    u = new URL(loc, u); chain.push(u.toString());
  }
  // sin coordenadas (share.google): se busca el nombre en Google Places
  if (!HAS_COORDS.test(u.href)) {
    const name = nameFrom(chain);
    if (name) {
      try {
        const places = await placesSearch(name, near, 3);
        return json({ url: u.toString(), chain, name, places: places || [], noKey: places === null });
      } catch {
        return json({ url: u.toString(), chain, name, places: [], placesError: true });
      }
    }
  }
  return json({ url: u.toString(), chain });
});
