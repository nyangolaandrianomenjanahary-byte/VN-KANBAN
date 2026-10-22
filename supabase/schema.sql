-- =========================================================================
-- VN — Gestion de tâches : Schéma Supabase (PostgreSQL + Auth + Realtime + RLS)
-- Projet : unqfifaiywxuoqqtunya (eu-west-3)
-- =========================================================================

-- 1. Profils utilisateurs
create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text,
    full_name text,
    avatar_url text,
    locale text not null default 'fr',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 2. Espaces de travail (Kanban + Notes + Archive par utilisateur)
create table if not exists public.workspaces (
    user_id uuid primary key references auth.users(id) on delete cascade,
    data jsonb not null default '{}'::jsonb,
    archive jsonb not null default '[]'::jsonb,
    revision bigint not null default 0,
    initialized boolean not null default false,
    device_label text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 3. Journal d'événements de synchronisation
create table if not exists public.workspace_events (
    id bigint generated always as identity primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    action text not null,
    cards_count integer,
    source text,
    created_at timestamptz not null default now()
);

-- 4. Fonction de mise à jour automatique de updated_at
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists trg_workspaces_updated_at on public.workspaces;
create trigger trg_workspaces_updated_at
before update on public.workspaces
for each row execute function public.touch_updated_at();

-- 5. Provisionnement automatique à l'inscription (auth.users -> profiles + workspaces)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, email, full_name)
    values (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, ''), '@', 1))
    )
    on conflict (id) do nothing;

    insert into public.workspaces (user_id)
    values (new.id)
    on conflict (user_id) do nothing;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 6. Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_events enable row level security;

-- Policies : profiles
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
    for select to authenticated
    using (auth.uid() = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
    for insert to authenticated
    with check (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
    for update to authenticated
    using (auth.uid() = id)
    with check (auth.uid() = id);

-- Policies : workspaces
drop policy if exists workspaces_select_own on public.workspaces;
create policy workspaces_select_own on public.workspaces
    for select to authenticated
    using (auth.uid() = user_id);

drop policy if exists workspaces_insert_own on public.workspaces;
create policy workspaces_insert_own on public.workspaces
    for insert to authenticated
    with check (auth.uid() = user_id);

drop policy if exists workspaces_update_own on public.workspaces;
create policy workspaces_update_own on public.workspaces
    for update to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists workspaces_delete_own on public.workspaces;
create policy workspaces_delete_own on public.workspaces
    for delete to authenticated
    using (auth.uid() = user_id);

-- Policies : workspace_events
drop policy if exists events_select_own on public.workspace_events;
create policy events_select_own on public.workspace_events
    for select to authenticated
    using (auth.uid() = user_id);

drop policy if exists events_insert_own on public.workspace_events;
create policy events_insert_own on public.workspace_events
    for insert to authenticated
    with check (auth.uid() = user_id);

-- 7. Temps réel (Supabase Realtime)
alter table public.workspaces replica identity full;
do $$
begin
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'workspaces'
    ) then
        alter publication supabase_realtime add table public.workspaces;
    end if;
end
$$;
