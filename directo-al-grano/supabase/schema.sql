-- Directo al grano — esquema de Supabase.
-- Correlo una vez en el SQL Editor del proyecto (Dashboard → SQL Editor → New query → Run).
-- Cada fila pertenece a un usuario (user_id) y Row Level Security hace que cada uno vea y toque solo lo suyo.

-- ---------- cafeterías ----------
create table if not exists public.cafes (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id         text not null,
  name       text not null check (char_length(name) between 1 and 200),
  barrio     text not null default '',
  address    text not null default '',
  lat        double precision,
  lng        double precision,
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint,
  primary key (user_id, id)
);

-- ---------- visitas (cada review) ----------
create table if not exists public.visits (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id         text not null,
  cafe_id    text not null,
  score      smallint not null check (score between 1 and 10),
  visited_on date not null,
  drink      text,
  origin     text,
  roast      text,
  method     text,
  aspects    jsonb not null default '{}'::jsonb,
  review     text not null default '',
  food       jsonb,
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint,
  primary key (user_id, id),
  -- borrar una cafetería borra sus visitas
  foreign key (user_id, cafe_id) references public.cafes (user_id, id) on delete cascade
);
create index if not exists visits_cafe_idx on public.visits (user_id, cafe_id);

-- ---------- wishlist ----------
create table if not exists public.wishlist (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id         text not null,
  name       text not null check (char_length(name) between 1 and 200),
  barrio     text not null default '',
  why        text not null default '',
  address    text not null default '',
  lat        double precision,
  lng        double precision,
  saved_at   date not null default current_date,
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint,
  primary key (user_id, id)
);

-- ---------- seguridad: cada usuario, lo suyo ----------
alter table public.cafes    enable row level security;
alter table public.visits   enable row level security;
alter table public.wishlist enable row level security;

drop policy if exists "cafes: dueño" on public.cafes;
create policy "cafes: dueño" on public.cafes for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "visits: dueño" on public.visits;
create policy "visits: dueño" on public.visits for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "wishlist: dueño" on public.wishlist;
create policy "wishlist: dueño" on public.wishlist for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.cafes, public.visits, public.wishlist to authenticated;
revoke all on public.cafes, public.visits, public.wishlist from anon;
