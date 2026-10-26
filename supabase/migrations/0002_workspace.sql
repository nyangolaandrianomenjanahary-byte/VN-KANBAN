-- Preserve the supplied application's full data model without altering old tables.
create table if not exists public.vn_workspaces (
 user_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null,
 archive jsonb not null default '[]',
 revision integer not null default 1,
 updated_at timestamptz not null default now()
);
alter table public.vn_workspaces enable row level security;
create policy workspace_select on public.vn_workspaces for select to authenticated using (auth.uid() = user_id);
create policy workspace_insert on public.vn_workspaces for insert to authenticated with check (auth.uid() = user_id);
create policy workspace_update on public.vn_workspaces for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('vn-task-images','vn-task-images',false,9437184,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy vn_images_read on storage.objects for select to authenticated using (bucket_id='vn-task-images' and (storage.foldername(name))[1]=auth.uid()::text);
create policy vn_images_insert on storage.objects for insert to authenticated with check (bucket_id='vn-task-images' and (storage.foldername(name))[1]=auth.uid()::text);
create policy vn_images_delete on storage.objects for delete to authenticated using (bucket_id='vn-task-images' and (storage.foldername(name))[1]=auth.uid()::text);
