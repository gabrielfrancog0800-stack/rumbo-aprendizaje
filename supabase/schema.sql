create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text not null default '',
  position text not null default '',
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists full_name text not null default '';
alter table public.profiles add column if not exists position text not null default '';

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Mi aprendizaje' check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'collaborator')),
  position text not null default '' check (char_length(position) <= 100),
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id),
  unique (user_id)
);

create table if not exists public.team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  token text not null unique check (char_length(token) between 24 and 80),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz
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
alter table public.private_states enable row level security;
alter table public.shared_states enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_invites enable row level security;

create or replace function public.is_workspace_owner(target_workspace_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspaces
    where id = target_workspace_id and owner_id = auth.uid()
  );
$$;

revoke all on function public.is_workspace_owner(uuid) from public;
revoke all on function public.is_workspace_owner(uuid) from anon;
grant execute on function public.is_workspace_owner(uuid) to authenticated;

create or replace function public.is_team_admin(target_team_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.team_members
    where team_id = target_team_id and user_id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_team_colleague(target_user_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.team_members admin_member
    join public.team_members target_member using (team_id)
    where admin_member.user_id = auth.uid()
      and admin_member.role = 'admin'
      and target_member.user_id = target_user_id
  );
$$;

create or replace function public.can_admin_view_workspace(target_workspace_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.workspaces w
    join public.team_members collaborator on collaborator.user_id = w.owner_id and collaborator.role = 'collaborator'
    join public.team_members admin_member on admin_member.team_id = collaborator.team_id
    where w.id = target_workspace_id and admin_member.user_id = auth.uid() and admin_member.role = 'admin'
  );
$$;

revoke all on function public.is_team_admin(uuid) from public, anon;
revoke all on function public.is_team_colleague(uuid) from public, anon;
revoke all on function public.can_admin_view_workspace(uuid) from public, anon;
grant execute on function public.is_team_admin(uuid) to authenticated;
grant execute on function public.is_team_colleague(uuid) to authenticated;
grant execute on function public.can_admin_view_workspace(uuid) to authenticated;

drop policy if exists "profiles self read" on public.profiles;
drop policy if exists "profiles self update" on public.profiles;
drop policy if exists "workspace owner read" on public.workspaces;
drop policy if exists "workspace owner insert" on public.workspaces;
drop policy if exists "workspace owner update" on public.workspaces;
drop policy if exists "workspace owner delete" on public.workspaces;
drop policy if exists "owner private state" on public.private_states;
drop policy if exists "owner shared state" on public.shared_states;
drop policy if exists "team admin profile read" on public.profiles;
drop policy if exists "team member read" on public.teams;
drop policy if exists "team admin update" on public.teams;
drop policy if exists "member reads membership" on public.team_members;
drop policy if exists "admin manages membership" on public.team_members;
drop policy if exists "admin manages invites" on public.team_invites;
drop policy if exists "team admin shared state read" on public.shared_states;

create policy "profiles self read" on public.profiles for select using (id = auth.uid());
create policy "team admin profile read" on public.profiles for select using (public.is_team_colleague(id));

create policy "workspace owner read" on public.workspaces for select using (owner_id = auth.uid());
create policy "workspace owner insert" on public.workspaces for insert with check (owner_id = auth.uid());
create policy "workspace owner update" on public.workspaces for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "workspace owner delete" on public.workspaces for delete using (owner_id = auth.uid());

create policy "owner private state" on public.private_states for all
using (public.is_workspace_owner(workspace_id))
with check (public.is_workspace_owner(workspace_id));

create policy "owner shared state" on public.shared_states for all
using (public.is_workspace_owner(workspace_id))
with check (public.is_workspace_owner(workspace_id));
create policy "team admin shared state read" on public.shared_states for select using (public.can_admin_view_workspace(workspace_id));

create policy "team member read" on public.teams for select using (
  exists (select 1 from public.team_members m where m.team_id = id and m.user_id = auth.uid())
);
create policy "team admin update" on public.teams for update using (public.is_team_admin(id)) with check (public.is_team_admin(id));

create policy "member reads membership" on public.team_members for select using (user_id = auth.uid());
create policy "admin manages membership" on public.team_members for all
using (public.is_team_admin(team_id)) with check (public.is_team_admin(team_id));

create policy "admin manages invites" on public.team_invites for all
using (public.is_team_admin(team_id)) with check (public.is_team_admin(team_id));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, position)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''), coalesce(new.raw_user_meta_data ->> 'position', ''))
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
    position = coalesce(nullif(excluded.position, ''), public.profiles.position);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert or update of email on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.join_team(invite_token text, member_position text default '')
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  target_invite public.team_invites%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into target_invite from public.team_invites
  where token = invite_token and claimed_at is null and expires_at > now()
  for update;
  if target_invite.id is null then raise exception 'INVALID_INVITE'; end if;
  insert into public.team_members (team_id, user_id, role, position)
  values (target_invite.team_id, auth.uid(), 'collaborator', coalesce(nullif(trim(member_position), ''), (select position from public.profiles where id = auth.uid()), ''))
  on conflict (team_id, user_id) do update set position = excluded.position;
  update public.team_invites set claimed_by = auth.uid(), claimed_at = now() where id = target_invite.id;
  return target_invite.team_id;
end;
$$;

create or replace function public.update_my_profile(new_full_name text, new_position text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  clean_name text := trim(new_full_name);
  clean_position text := trim(new_position);
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if char_length(clean_name) < 2 or char_length(clean_name) > 100 then raise exception 'INVALID_NAME'; end if;
  if char_length(clean_position) < 2 or char_length(clean_position) > 100 then raise exception 'INVALID_POSITION'; end if;

  update public.profiles
  set full_name = clean_name, position = clean_position
  where id = auth.uid();

  update public.team_members
  set position = clean_position
  where user_id = auth.uid();

  return jsonb_build_object('full_name', clean_name, 'position', clean_position);
end;
$$;

create or replace function public.admin_dashboard()
returns table (
  user_id uuid,
  full_name text,
  email text,
  "position" text,
  workspace_id uuid,
  data jsonb,
  updated_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select member.user_id, profile.full_name, profile.email, member.position,
         workspace.id, shared.data, shared.updated_at
  from public.team_members admin_member
  join public.team_members member on member.team_id = admin_member.team_id and member.role = 'collaborator'
  join public.profiles profile on profile.id = member.user_id
  left join public.workspaces workspace on workspace.owner_id = member.user_id
  left join public.shared_states shared on shared.workspace_id = workspace.id
  where admin_member.user_id = auth.uid() and admin_member.role = 'admin'
  order by profile.full_name, profile.email;
$$;

revoke all on function public.join_team(text, text) from public, anon;
revoke all on function public.update_my_profile(text, text) from public, anon;
revoke all on function public.admin_dashboard() from public, anon;
grant execute on function public.join_team(text, text) to authenticated;
grant execute on function public.update_my_profile(text, text) to authenticated;
grant execute on function public.admin_dashboard() to authenticated;
grant select on public.teams, public.team_members to authenticated;
grant select, insert, update, delete on public.team_invites to authenticated;
