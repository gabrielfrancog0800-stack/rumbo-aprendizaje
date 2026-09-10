create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Mi aprendizaje' check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_invites (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  share_code text not null unique check (char_length(share_code) between 8 and 32),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role = 'viewer'),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.private_states (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.shared_states (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.workspace_members enable row level security;
alter table public.private_states enable row level security;
alter table public.shared_states enable row level security;

create or replace function public.is_workspace_owner(target_workspace_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspaces
    where id = target_workspace_id and owner_id = auth.uid()
  );
$$;

revoke all on function public.is_workspace_owner(uuid) from public;
grant execute on function public.is_workspace_owner(uuid) to authenticated;

drop policy if exists "profiles self read" on public.profiles;
drop policy if exists "profiles self update" on public.profiles;
drop policy if exists "workspace owner read" on public.workspaces;
drop policy if exists "workspace member read" on public.workspaces;
drop policy if exists "workspace owner insert" on public.workspaces;
drop policy if exists "workspace owner update" on public.workspaces;
drop policy if exists "workspace owner delete" on public.workspaces;
drop policy if exists "owner invite access" on public.workspace_invites;
drop policy if exists "member self read" on public.workspace_members;
drop policy if exists "owner reads members" on public.workspace_members;
drop policy if exists "owner removes members" on public.workspace_members;
drop policy if exists "owner private state" on public.private_states;
drop policy if exists "owner shared state" on public.shared_states;
drop policy if exists "member shared state read" on public.shared_states;

create policy "profiles self read" on public.profiles for select using (id = auth.uid());
create policy "profiles self update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "workspace owner read" on public.workspaces for select using (owner_id = auth.uid());
create policy "workspace member read" on public.workspaces for select using (
  exists (select 1 from public.workspace_members m where m.workspace_id = id and m.user_id = auth.uid())
);
create policy "workspace owner insert" on public.workspaces for insert with check (owner_id = auth.uid());
create policy "workspace owner update" on public.workspaces for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "workspace owner delete" on public.workspaces for delete using (owner_id = auth.uid());

create policy "owner invite access" on public.workspace_invites for all
using (public.is_workspace_owner(workspace_id))
with check (public.is_workspace_owner(workspace_id));

create policy "member self read" on public.workspace_members for select using (user_id = auth.uid());
create policy "owner reads members" on public.workspace_members for select using (public.is_workspace_owner(workspace_id));
create policy "owner removes members" on public.workspace_members for delete using (public.is_workspace_owner(workspace_id));

create policy "owner private state" on public.private_states for all
using (public.is_workspace_owner(workspace_id))
with check (public.is_workspace_owner(workspace_id));

create policy "owner shared state" on public.shared_states for all
using (public.is_workspace_owner(workspace_id))
with check (public.is_workspace_owner(workspace_id));
create policy "member shared state read" on public.shared_states for select using (
  exists (select 1 from public.workspace_members m where m.workspace_id = workspace_id and m.user_id = auth.uid())
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert or update of email on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.join_workspace(invite_code text)
returns table (workspace_id uuid, workspace_name text)
language plpgsql security definer set search_path = public as $$
declare
  target_workspace_id uuid;
  target_owner_id uuid;
  target_name text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select w.id, w.owner_id, w.name into target_workspace_id, target_owner_id, target_name
  from public.workspace_invites i
  join public.workspaces w on w.id = i.workspace_id
  where upper(i.share_code) = upper(trim(invite_code));
  if target_workspace_id is null then raise exception 'INVALID_CODE'; end if;
  if target_owner_id = auth.uid() then raise exception 'ALREADY_OWNER'; end if;
  insert into public.workspace_members (workspace_id, user_id, role)
  values (target_workspace_id, auth.uid(), 'viewer') on conflict do nothing;
  return query select target_workspace_id, target_name;
end;
$$;

revoke all on function public.join_workspace(text) from public;
grant execute on function public.join_workspace(text) to authenticated;
