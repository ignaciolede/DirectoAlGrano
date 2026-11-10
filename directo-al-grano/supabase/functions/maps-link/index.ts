// Directo al grano — abre un link corto de Google Maps (maps.app.goo.gl, goo.gl/maps, share.google)
// y devuelve adónde lleva. El link largo final trae la ubicación (…/maps/place/Nombre/@lat,lng…!3dLAT!4dLNG);
// la app la lee de ahí. Desde el navegador no se puede seguir el redirect (Google no lo permite), por eso esto.
//
// Solo sigue redirects (no descarga páginas) y solo a dominios de Google: no sirve para abrir cualquier URL.
// Requiere sesión: la propia función le pregunta a Supabase Auth si el token es de un usuario
// (así anda igual tenga o no activado "Verify JWT").
//
// Deploy (una vez): Dashboard → Edge Functions → Deploy a new function → Via Editor,
// nombre "maps-link", pegá este archivo y Deploy. O con la CLI: supabase functions deploy maps-link

const HOSTS = /^(maps\.app\.goo\.gl|goo\.gl|share\.google|(www\.)?google\.[a-z.]{2,6}|maps\.google\.[a-z.]{2,6}|consent\.google\.[a-z.]{2,6})$/i;
const HAS_COORDS = /!3d-?\d|@-?\d+\.\d+,-?\d+\.\d+|[?&](q|query|ll|center)=-?\d+\.\d+(,|%2C)/i;
const MAX_HOPS = 6;

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  if (!(await signedIn(req))) return json({ error: 'auth' }, 401);

  let u: URL;
  try {
    const body = await req.json();
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
  return json({ url: u.toString(), chain });
});
