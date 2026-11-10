-- Directo al grano — comunidad: buscar personas, ver su ranking y el ranking global.
-- Correlo una vez en el SQL Editor (Dashboard → SQL Editor → New query → Run), después de schema.sql.
-- Se puede correr de nuevo sin romper nada.
--
-- Qué queda a la vista de otros usuarios con sesión: tu @usuario y, por cada cafetería que reseñaste,
-- nombre, barrio, dirección, ubicación, tu nota promedio y cantidad de visitas.
-- Lo que NO se ve: tu mail, el texto de tus reviews, la comida, los aspectos y tu wishlist.
-- Las tablas siguen privadas (RLS de schema.sql); solo estas funciones leen lo de todos.

-- ---------- perfil público: @usuario único ----------
-- Formato: 3 a 20 caracteres; minúsculas, números, punto y guion bajo; no empieza ni termina en punto.
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text,
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists username text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_username_format') then
    alter table public.profiles add constraint profiles_username_format
      check (username ~ '^[a-z0-9_][a-z0-9_.]{1,18}[a-z0-9_]$');
  end if;
end $$;
create unique index if not exists profiles_username_key on public.profiles (username);
alter table public.profiles enable row level security;

drop policy if exists "profiles: leer" on public.profiles;
create policy "profiles: leer" on public.profiles for select to authenticated using (true);
drop policy if exists "profiles: crear el propio" on public.profiles;
create policy "profiles: crear el propio" on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);
drop policy if exists "profiles: editar el propio" on public.profiles;
create policy "profiles: editar el propio" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

grant select, insert, update on public.profiles to authenticated;
revoke all on public.profiles from anon;

-- cada cuenta nueva arranca con su perfil y el @ que eligió al registrarse
-- (si justo se lo ganó otro, queda sin @ y la app se lo pide al entrar)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare u text := lower(new.raw_user_meta_data ->> 'username');
begin
  if u is null or u !~ '^[a-z0-9_][a-z0-9_.]{1,18}[a-z0-9_]$' then u := null; end if;
  begin
    insert into public.profiles (id, username) values (new.id, u) on conflict (id) do nothing;
  exception when unique_violation then
    insert into public.profiles (id, username) values (new.id, null) on conflict (id) do nothing;
  end;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- las cuentas que ya existían (sin @: lo eligen al entrar)
insert into public.profiles (id) select id from auth.users on conflict (id) do nothing;

-- ¿está libre? (se usa al registrarse, todavía sin sesión)
create or replace function public.username_available(u text)
returns boolean language sql stable security definer set search_path = '' as $$
  select lower(u) ~ '^[a-z0-9_][a-z0-9_.]{1,18}[a-z0-9_]$'
    and not exists (select 1 from public.profiles p where p.username = lower(u) and p.id is distinct from (select auth.uid()));
$$;
revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

-- ---------- misma cafetería entre usuarios ----------
-- id del lugar en OpenStreetMap (lo guarda la app cuando la elegís del buscador)
alter table public.cafes add column if not exists place_id text;

-- clave para juntar la misma cafetería de distintas personas:
-- el id de OpenStreetMap si lo hay; si no, el nombre + la ubicación redondeada (~100 m)
create or replace function public.cafe_key(p_place_id text, p_name text, p_lat double precision, p_lng double precision)
returns text language sql immutable set search_path = '' as $$
  select coalesce(
    nullif(p_place_id, ''),
    lower(trim(p_name)) || '@' || coalesce(round(p_lat::numeric, 3)::text || ',' || round(p_lng::numeric, 3)::text, '')
  );
$$;

-- ---------- buscar personas por @ ----------
-- q vacío: las más activas. Primero el @ exacto, después los que empiezan así.
drop function if exists public.search_users(text);
create function public.search_users(q text)
returns table (id uuid, username text, cafes int, visits int)
language sql stable security definer set search_path = '' as $$
  with t as (select lower(ltrim(trim(coalesce(q, '')), '@')) as q)
  select p.id, p.username,
    (select count(*)::int from public.cafes c where c.user_id = p.id) as cafes,
    (select count(*)::int from public.visits v where v.user_id = p.id) as visits
  from public.profiles p, t
  where p.username is not null
    and p.username like '%' || replace(replace(replace(t.q, '\', '\'), '%', '\%'), '_', '\_') || '%'
  order by (p.username = t.q) desc, (p.username like replace(replace(replace(t.q, '\', '\'), '%', '\%'), '_', '\_') || '%') desc, visits desc, p.username
  limit 30;
$$;

-- ---------- ranking de una persona ----------
create or replace function public.user_ranking(uid uuid)
returns table (cafe_id text, place_key text, name text, barrio text, address text, lat double precision, lng double precision,
               score numeric, visits int, last_visit date)
language sql stable security definer set search_path = '' as $$
  select c.id, public.cafe_key(c.place_id, c.name, c.lat, c.lng), c.name, c.barrio, c.address, c.lat, c.lng,
    round(avg(v.score), 2), count(*)::int, max(v.visited_on)
  from public.cafes c
  join public.visits v on v.user_id = c.user_id and v.cafe_id = c.id
  where c.user_id = uid
  group by c.user_id, c.id
  order by avg(v.score) desc, count(*) desc, c.name;
$$;

-- ---------- ranking global ----------
-- Nota de cada cafetería = promedio de las notas de cada persona (cada persona pesa uno, vaya una vez o veinte).
create or replace function public.global_ranking()
returns table (place_key text, name text, barrio text, address text, lat double precision, lng double precision,
               score numeric, people int, visits int, my_cafe_id text, my_score numeric)
language sql stable security definer set search_path = '' as $$
  with per_user as (
    select public.cafe_key(c.place_id, c.name, c.lat, c.lng) as k,
      c.user_id, c.id, c.name, c.barrio, c.address, c.lat, c.lng,
      avg(v.score) as s, count(*) as n
    from public.cafes c
    join public.visits v on v.user_id = c.user_id and v.cafe_id = c.id
    group by c.user_id, c.id
  )
  select k,
    (array_agg(name order by n desc))[1],
    (array_agg(barrio order by (barrio = ''), n desc))[1],
    (array_agg(address order by (address = ''), n desc))[1],
    avg(lat), avg(lng),
    round(avg(s), 2), count(distinct user_id)::int, sum(n)::int,
    (array_agg(id) filter (where user_id = (select auth.uid())))[1],
    round(avg(s) filter (where user_id = (select auth.uid())), 2)
  from per_user
  group by k
  order by avg(s) desc, count(distinct user_id) desc, sum(n) desc, 2
  limit 200;
$$;

revoke all on function public.search_users(text), public.user_ranking(uuid), public.global_ranking() from public, anon;
grant execute on function public.search_users(text), public.user_ranking(uuid), public.global_ranking() to authenticated;
