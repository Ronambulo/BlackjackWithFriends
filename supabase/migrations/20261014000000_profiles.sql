-- Perfiles de jugador: uno por usuario de Supabase Auth, creado automáticamente.
-- Ejecútalo en Supabase → SQL Editor (o con `supabase db push`).

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  -- null hasta que el jugador lo elige al entrar por primera vez
  nombre text check (nombre is null or char_length(btrim(nombre)) between 2 and 20),
  avatar_url text,
  idioma text not null default 'es' check (idioma in ('es', 'en')),
  -- solo el servidor las cambia (premios, tienda)
  monedas integer not null default 0 check (monedas >= 0),
  estilos_equipados jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- De momento cada uno solo ve su perfil; con los grupos (fase 4) se abrirá a los compañeros.
create policy "Ver mi perfil" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "Editar mi perfil" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- La app solo puede leer y cambiar nombre, avatar e idioma. Monedas y estilos, solo el backend.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (nombre, avatar_url, idioma) on public.profiles to authenticated;

-- Crea el perfil al registrarse. El idioma llega en los metadatos del registro.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, idioma)
  values (
    new.id,
    case when new.raw_user_meta_data ->> 'idioma' = 'en' then 'en' else 'es' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Usuarios que ya existían antes de esta migración.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;
