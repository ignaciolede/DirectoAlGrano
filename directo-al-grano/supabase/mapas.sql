-- Directo al grano — ubicaciones de Google Maps
-- Correlo una vez en Supabase → SQL Editor → New query → pegar todo → Run. Se puede correr de nuevo sin problema.
-- Requiere haber corrido antes supabase/schema.sql (tablas cafes y wishlist).

-- link de Google Maps que pegaron (share.google, maps.app.goo.gl…): para abrirla en Maps aunque no tenga ubicación
alter table public.cafes    add column if not exists maps_url text;
alter table public.wishlist add column if not exists maps_url text;

-- id del lugar en Google Places (se puede guardar sin límite) y cuándo se pidió su ubicación por última vez.
-- Las condiciones de Google permiten guardar las coordenadas hasta 30 días: la app las renueva solas cada 25.
alter table public.cafes    add column if not exists google_place_id text;
alter table public.cafes    add column if not exists google_checked_at bigint;
alter table public.wishlist add column if not exists google_place_id text;
alter table public.wishlist add column if not exists google_checked_at bigint;

-- que la API de Supabase vea las columnas nuevas ya mismo
notify pgrst, 'reload schema';
