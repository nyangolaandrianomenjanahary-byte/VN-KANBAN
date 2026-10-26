-- ============================================================
-- VN KANBAN — Schéma Kanban + photos de tâches
-- Base de données du projet distant (ancien prototype)
-- Idempotent : peut être rejoué sans erreur.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. Colonnes du tableau
-- ------------------------------------------------------------
create table if not exists public.board_columns (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 60),
  accent      text not null default 'navy',
  position    integer not null default 0,
  is_done     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists board_columns_user_idx
  on public.board_columns (user_id, position);

-- ------------------------------------------------------------
-- 2. Tâches
-- ------------------------------------------------------------
create table if not exists public.tasks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  column_id     uuid not null references public.board_columns (id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 200),
  description   text,
  priority      text not null default 'normal'
                check (priority in ('low', 'normal', 'high', 'urgent')),
  due_date      date,
  labels        text[] not null default '{}',
  position      integer not null default 0,
  completed_at  timestamptz,
  cover_photo_id uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists tasks_user_idx on public.tasks (user_id);
create index if not exists tasks_column_idx on public.tasks (column_id, position);

-- ------------------------------------------------------------
-- 3. Photos attachées aux tâches (métadonnées)
--    Les fichiers vivent dans le bucket Storage « task-photos ».
-- ------------------------------------------------------------
create table if not exists public.task_photos (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null references public.tasks (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  storage_path  text not null unique,
  url           text not null,
  file_name     text,
  mime_type     text,
  size_bytes    bigint,
  width         integer,
  height        integer,
  caption       text,
  position      integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists task_photos_task_idx
  on public.task_photos (task_id, position);
create index if not exists task_photos_user_idx
  on public.task_photos (user_id);

-- cover_photo_id -> task_photos (ajouté après la création de task_photos)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tasks_cover_photo_fk'
  ) then
    alter table public.tasks
      add constraint tasks_cover_photo_fk
      foreign key (cover_photo_id) references public.task_photos (id)
      on delete set null;
  end if;
end $$;

-- ------------------------------------------------------------
-- 4. updated_at automatique (réutilise touch_updated_at si présent)
-- ------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists board_columns_touch on public.board_columns;
create trigger board_columns_touch before update on public.board_columns
  for each row execute function public.touch_updated_at();

drop trigger if exists tasks_touch on public.tasks;
create trigger tasks_touch before update on public.tasks
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- 5. RLS — chaque utilisateur ne voit que ses données
-- ------------------------------------------------------------
alter table public.board_columns enable row level security;
alter table public.tasks enable row level security;
alter table public.task_photos enable row level security;

drop policy if exists board_columns_own on public.board_columns;
create policy board_columns_own on public.board_columns
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists tasks_own on public.tasks;
create policy tasks_own on public.tasks
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists task_photos_own on public.task_photos;
create policy task_photos_own on public.task_photos
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 6. Storage : bucket public « task-photos », écriture par dossier user
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'task-photos',
  'task-photos',
  true,
  10485760, -- 10 Mo
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists task_photos_read on storage.objects;
create policy task_photos_read on storage.objects
  for select to public
  using (bucket_id = 'task-photos');

drop policy if exists task_photos_insert on storage.objects;
create policy task_photos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'task-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists task_photos_update on storage.objects;
create policy task_photos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'task-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'task-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists task_photos_delete on storage.objects;
create policy task_photos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'task-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ------------------------------------------------------------
-- 7. Colonnes par défaut pour chaque nouvel utilisateur
-- ------------------------------------------------------------
create or replace function public.seed_default_board()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.board_columns (user_id, title, accent, position, is_done)
  values
    (new.id, 'À faire',   'navy',   0, false),
    (new.id, 'En cours',  'amber',  1, false),
    (new.id, 'En révision','teal',  2, false),
    (new.id, 'Terminé',   'green',  3, true);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_board on auth.users;
create trigger on_auth_user_created_board
  after insert on auth.users
  for each row execute function public.seed_default_board();

-- Rattrapage : utilisateurs existants sans colonnes
insert into public.board_columns (user_id, title, accent, position, is_done)
select u.id, c.title, c.accent, c.position, c.is_done
from auth.users u
cross join (values
  ('À faire', 'navy', 0, false),
  ('En cours', 'amber', 1, false),
  ('En révision', 'teal', 2, false),
  ('Terminé', 'green', 3, true)
) as c(title, accent, position, is_done)
where not exists (
  select 1 from public.board_columns bc where bc.user_id = u.id
);
