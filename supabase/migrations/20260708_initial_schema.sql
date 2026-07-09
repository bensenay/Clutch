-- Baseline schema reconstruction for the Week 1 Supabase setup described in
-- hockey-coach-app-spec.md and the current app repo.
--
-- Important:
-- - This file is documentation/baseline only and was not executed.
-- - It intentionally does not include deployment commands.
-- - A few details were not recoverable from repo history; see assumptions in
--   the final report.

create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'user_role'
  ) then
    create type public.user_role as enum ('super_admin', 'director', 'coach');
  end if;
end
$$;

create table if not exists public.schools (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  status text not null default 'active',
  join_code text,
  is_personal boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  constraint schools_status_check
    check (status in ('active', 'suspended')),
  constraint schools_join_code_check
    check (
      (is_personal = true and join_code is null)
      or (is_personal = false and join_code is not null)
    )
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  name text,
  role public.user_role not null,
  school_id uuid references public.schools (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint profiles_super_admin_school_check
    check (
      (role = 'super_admin' and school_id is null)
      or (role in ('director', 'coach') and school_id is not null)
    )
);

create table if not exists public.teams (
  id uuid primary key default extensions.gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  level text,
  season text,
  primary_color text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint teams_name_not_blank_check
    check (btrim(name) <> ''),
  constraint teams_primary_color_check
    check (
      primary_color is null
      or primary_color ~ '^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$'
    ),
  constraint teams_school_name_key unique (school_id, name)
);

create table if not exists public.team_memberships (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  constraint team_memberships_user_team_key unique (user_id, team_id)
);

create table if not exists public.players (
  id uuid primary key default extensions.gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  jersey_number integer not null,
  natural_position text not null,
  height text,
  weight text,
  status text not null default 'active',
  status_note text,
  parent_name text,
  parent_phone text,
  emergency_contact_name text,
  emergency_contact_phone text,
  medical_notes text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint players_first_name_not_blank_check
    check (btrim(first_name) <> ''),
  constraint players_last_name_not_blank_check
    check (btrim(last_name) <> ''),
  constraint players_jersey_number_check
    check (jersey_number > 0 and jersey_number <= 99),
  constraint players_natural_position_check
    check (natural_position in ('F', 'D', 'G')),
  constraint players_status_check
    check (status in ('active', 'injured', 'suspended')),
  constraint players_team_jersey_key unique (team_id, jersey_number)
);

create table if not exists public.games (
  id uuid primary key default extensions.gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  opponent_name text not null,
  date timestamptz not null,
  location text,
  is_home boolean not null default true,
  opponent_scouting_notes text,
  pre_game_plan text,
  post_game_notes text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint games_opponent_name_not_blank_check
    check (btrim(opponent_name) <> '')
);

create table if not exists public.lineups (
  id uuid primary key default extensions.gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  lines jsonb not null default '[]'::jsonb,
  defense_pairs jsonb not null default '[]'::jsonb,
  goalies jsonb not null default '[]'::jsonb,
  special_teams jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint lineups_game_id_key unique (game_id),
  constraint lineups_lines_is_array_check
    check (jsonb_typeof(lines) = 'array'),
  constraint lineups_defense_pairs_is_array_check
    check (jsonb_typeof(defense_pairs) = 'array'),
  constraint lineups_goalies_is_array_check
    check (jsonb_typeof(goalies) = 'array'),
  constraint lineups_special_teams_is_object_check
    check (jsonb_typeof(special_teams) = 'object')
);

create table if not exists public.drills (
  id uuid primary key default extensions.gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  created_by_user_id uuid not null references public.profiles (id) on delete restrict,
  name text not null,
  description text,
  is_published boolean not null default false,
  canvas_data jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint drills_name_not_blank_check
    check (btrim(name) <> ''),
  constraint drills_canvas_data_is_array_check
    check (jsonb_typeof(canvas_data) = 'array')
);

create table if not exists public.practice_plans (
  id uuid primary key default extensions.gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  date date not null,
  segments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint practice_plans_segments_is_array_check
    check (jsonb_typeof(segments) = 'array'),
  constraint practice_plans_team_date_key unique (team_id, date)
);

create unique index if not exists schools_join_code_key
  on public.schools (join_code)
  where join_code is not null;

create index if not exists profiles_school_id_idx
  on public.profiles (school_id);

create index if not exists teams_school_id_idx
  on public.teams (school_id);

create index if not exists team_memberships_user_id_idx
  on public.team_memberships (user_id);

create index if not exists team_memberships_team_id_idx
  on public.team_memberships (team_id);

create index if not exists players_team_id_idx
  on public.players (team_id);

create index if not exists games_team_id_idx
  on public.games (team_id);

create index if not exists games_team_id_date_idx
  on public.games (team_id, date desc);

create index if not exists lineups_game_id_idx
  on public.lineups (game_id);

create index if not exists drills_team_id_idx
  on public.drills (team_id);

create index if not exists drills_created_by_user_id_idx
  on public.drills (created_by_user_id);

create index if not exists drills_school_library_idx
  on public.drills (is_published, team_id);

create index if not exists practice_plans_team_id_idx
  on public.practice_plans (team_id);

create or replace function public.get_my_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
$$;

create or replace function public.get_my_school_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.school_id
  from public.profiles p
  where p.id = auth.uid()
$$;

create or replace function public.is_member_of_team(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_memberships tm
    where tm.user_id = auth.uid()
      and tm.team_id = target_team_id
  )
$$;

create or replace function public.is_my_school_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select s.status = 'active'
      from public.schools s
      where s.id = public.get_my_school_id()
    ),
    false
  )
$$;

alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_memberships enable row level security;
alter table public.players enable row level security;
alter table public.games enable row level security;
alter table public.lineups enable row level security;
alter table public.drills enable row level security;
alter table public.practice_plans enable row level security;

drop policy if exists schools_super_admin_all on public.schools;
create policy schools_super_admin_all
  on public.schools
  for all
  to authenticated
  using (public.get_my_role() = 'super_admin')
  with check (public.get_my_role() = 'super_admin');

drop policy if exists schools_org_read_active on public.schools;
create policy schools_org_read_active
  on public.schools
  for select
  to authenticated
  using (
    public.get_my_role() in ('director', 'coach')
    and public.is_my_school_active()
    and id = public.get_my_school_id()
  );

drop policy if exists schools_director_update_active on public.schools;
create policy schools_director_update_active
  on public.schools
  for update
  to authenticated
  using (
    public.get_my_role() = 'director'
    and public.is_my_school_active()
    and id = public.get_my_school_id()
  )
  with check (
    public.get_my_role() = 'director'
    and public.is_my_school_active()
    and id = public.get_my_school_id()
  );

drop policy if exists profiles_super_admin_all on public.profiles;
create policy profiles_super_admin_all
  on public.profiles
  for all
  to authenticated
  using (public.get_my_role() = 'super_admin')
  with check (public.get_my_role() = 'super_admin');

drop policy if exists profiles_director_same_school on public.profiles;
create policy profiles_director_same_school
  on public.profiles
  for all
  to authenticated
  using (
    public.get_my_role() = 'director'
    and public.is_my_school_active()
    and school_id = public.get_my_school_id()
  )
  with check (
    public.get_my_role() = 'director'
    and public.is_my_school_active()
    and school_id = public.get_my_school_id()
  );

drop policy if exists profiles_self_read_update on public.profiles;
create policy profiles_self_read_update
  on public.profiles
  for select
  to authenticated
  using (
    id = auth.uid()
    and (
      public.get_my_role() = 'super_admin'
      or public.is_my_school_active()
    )
  );

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update
  on public.profiles
  for update
  to authenticated
  using (
    id = auth.uid()
    and (
      public.get_my_role() = 'super_admin'
      or public.is_my_school_active()
    )
  )
  with check (
    id = auth.uid()
    and (
      public.get_my_role() = 'super_admin'
      or (
        public.is_my_school_active()
        and school_id = public.get_my_school_id()
      )
    )
  );

drop policy if exists teams_super_admin_all on public.teams;
create policy teams_super_admin_all
  on public.teams
  for all
  to authenticated
  using (public.get_my_role() = 'super_admin')
  with check (public.get_my_role() = 'super_admin');

drop policy if exists teams_director_same_school on public.teams;
create policy teams_director_same_school
  on public.teams
  for all
  to authenticated
  using (
    public.get_my_role() = 'director'
    and public.is_my_school_active()
    and school_id = public.get_my_school_id()
  )
  with check (
    public.get_my_role() = 'director'
    and public.is_my_school_active()
    and school_id = public.get_my_school_id()
  );

drop policy if exists teams_coach_member_team on public.teams;
create policy teams_coach_member_team
  on public.teams
  for all
  to authenticated
  using (
    public.get_my_role() = 'coach'
    and public.is_my_school_active()
    and public.is_member_of_team(id)
  )
  with check (
    public.get_my_role() = 'coach'
    and public.is_my_school_active()
    and school_id = public.get_my_school_id()
    and public.is_member_of_team(id)
  );

drop policy if exists team_memberships_super_admin_all on public.team_memberships;
create policy team_memberships_super_admin_all
  on public.team_memberships
  for all
  to authenticated
  using (public.get_my_role() = 'super_admin')
  with check (public.get_my_role() = 'super_admin');

drop policy if exists team_memberships_director_same_school on public.team_memberships;
create policy team_memberships_director_same_school
  on public.team_memberships
  for all
  to authenticated
  using (
    public.get_my_role() = 'director'
    and public.is_my_school_active()
    and exists (
      select 1
      from public.teams t
      where t.id = team_id
        and t.school_id = public.get_my_school_id()
    )
  )
  with check (
    public.get_my_role() = 'director'
    and public.is_my_school_active()
    and exists (
      select 1
      from public.teams t
      where t.id = team_id
        and t.school_id = public.get_my_school_id()
    )
  );

drop policy if exists team_memberships_coach_read_self on public.team_memberships;
create policy team_memberships_coach_read_self
  on public.team_memberships
  for select
  to authenticated
  using (
    public.get_my_role() = 'coach'
    and public.is_my_school_active()
    and user_id = auth.uid()
  );

drop policy if exists players_super_admin_all on public.players;
create policy players_super_admin_all
  on public.players
  for all
  to authenticated
  using (public.get_my_role() = 'super_admin')
  with check (public.get_my_role() = 'super_admin');

drop policy if exists players_director_same_school on public.players;
create policy players_director_same_school
  on public.players
  for all
  to authenticated
  using (
    public.get_my_role() = 'director'
    and public.is_my_school_active()
    and exists (
      select 1
      from public.teams t
      where t.id = team_id
        and t.school_id = public.get_my_school_id()
    )
  )
  with check (
    public.get_my_role() = 'director'
    and public.is_my_school_active()
    and exists (
      select 1
      from public.teams t
      where t.id = team_id
        and t.school_id = public.get_my_school_id()
    )
  );

drop policy if exists players_coach_member_team on public.players;
create policy players_coach_member_team
  on public.players
  for all
  to authenticated
  using (
    public.get_my_role() = 'coach'
    and public.is_my_school_active()
    and public.is_member_of_team(team_id)
  )
  with check (
    public.get_my_role() = 'coach'
    and public.is_my_school_active()
    and public.is_member_of_team(team_id)
  );

drop policy if exists games_super_admin_all on public.games;
create policy games_super_admin_all
  on public.games
  for all
  to authenticated
  using (public.get_my_role() = 'super_admin')
  with check (public.get_my_role() = 'super_admin');

drop policy if exists games_director_same_school on public.games;
create policy games_director_same_school
  on public.games
  for all
  to authenticated
  using (
    public.get_my_role() = 'director'
    and public.is_my_school_active()
    and exists (
      select 1
      from public.teams t
      where t.id = team_id
        and t.school_id = public.get_my_school_id()
    )
  )
  with check (
    public.get_my_role() = 'director'
    and public.is_my_school_active()
    and exists (
      select 1
      from public.teams t
      where t.id = team_id
        and t.school_id = public.get_my_school_id()
    )
  );

drop policy if exists games_coach_member_team on public.games;
create policy games_coach_member_team
  on public.games
  for all
  to authenticated
  using (
    public.get_my_role() = 'coach'
    and public.is_my_school_active()
    and public.is_member_of_team(team_id)
  )
  with check (
    public.get_my_role() = 'coach'
    and public.is_my_school_active()
    and public.is_member_of_team(team_id)
  );

drop policy if exists lineups_super_admin_all on public.lineups;
create policy lineups_super_admin_all
  on public.lineups
  for all
  to authenticated
  using (public.get_my_role() = 'super_admin')
  with check (public.get_my_role() = 'super_admin');

drop policy if exists lineups_director_same_school on public.lineups;
create policy lineups_director_same_school
  on public.lineups
  for all
  to authenticated
  using (
    public.get_my_role() = 'director'
    and public.is_my_school_active()
    and exists (
      select 1
      from public.games g
      join public.teams t on t.id = g.team_id
      where g.id = game_id
        and t.school_id = public.get_my_school_id()
    )
  )
  with check (
    public.get_my_role() = 'director'
    and public.is_my_school_active()
    and exists (
      select 1
      from public.games g
      join public.teams t on t.id = g.team_id
      where g.id = game_id
        and t.school_id = public.get_my_school_id()
    )
  );

drop policy if exists lineups_coach_member_team on public.lineups;
create policy lineups_coach_member_team
  on public.lineups
  for all
  to authenticated
  using (
    public.get_my_role() = 'coach'
    and public.is_my_school_active()
    and exists (
      select 1
      from public.games g
      where g.id = game_id
        and public.is_member_of_team(g.team_id)
    )
  )
  with check (
    public.get_my_role() = 'coach'
    and public.is_my_school_active()
    and exists (
      select 1
      from public.games g
      where g.id = game_id
        and public.is_member_of_team(g.team_id)
    )
  );

drop policy if exists drills_super_admin_all on public.drills;
create policy drills_super_admin_all
  on public.drills
  for all
  to authenticated
  using (public.get_my_role() = 'super_admin')
  with check (public.get_my_role() = 'super_admin');

drop policy if exists drills_director_same_school on public.drills;
create policy drills_director_same_school
  on public.drills
  for all
  to authenticated
  using (
    public.get_my_role() = 'director'
    and public.is_my_school_active()
    and exists (
      select 1
      from public.teams t
      where t.id = team_id
        and t.school_id = public.get_my_school_id()
    )
  )
  with check (
    public.get_my_role() = 'director'
    and public.is_my_school_active()
    and exists (
      select 1
      from public.teams t
      where t.id = team_id
        and t.school_id = public.get_my_school_id()
    )
  );

drop policy if exists drills_coach_member_team_manage on public.drills;
create policy drills_coach_member_team_manage
  on public.drills
  for all
  to authenticated
  using (
    public.get_my_role() = 'coach'
    and public.is_my_school_active()
    and public.is_member_of_team(team_id)
  )
  with check (
    public.get_my_role() = 'coach'
    and public.is_my_school_active()
    and public.is_member_of_team(team_id)
    and created_by_user_id = auth.uid()
  );

drop policy if exists drills_school_library_read on public.drills;
create policy drills_school_library_read
  on public.drills
  for select
  to authenticated
  using (
    public.get_my_role() in ('director', 'coach')
    and public.is_my_school_active()
    and is_published = true
    and exists (
      select 1
      from public.teams t
      where t.id = team_id
        and t.school_id = public.get_my_school_id()
    )
  );

drop policy if exists practice_plans_super_admin_all on public.practice_plans;
create policy practice_plans_super_admin_all
  on public.practice_plans
  for all
  to authenticated
  using (public.get_my_role() = 'super_admin')
  with check (public.get_my_role() = 'super_admin');

drop policy if exists practice_plans_director_same_school on public.practice_plans;
create policy practice_plans_director_same_school
  on public.practice_plans
  for all
  to authenticated
  using (
    public.get_my_role() = 'director'
    and public.is_my_school_active()
    and exists (
      select 1
      from public.teams t
      where t.id = team_id
        and t.school_id = public.get_my_school_id()
    )
  )
  with check (
    public.get_my_role() = 'director'
    and public.is_my_school_active()
    and exists (
      select 1
      from public.teams t
      where t.id = team_id
        and t.school_id = public.get_my_school_id()
    )
  );

drop policy if exists practice_plans_coach_member_team on public.practice_plans;
create policy practice_plans_coach_member_team
  on public.practice_plans
  for all
  to authenticated
  using (
    public.get_my_role() = 'coach'
    and public.is_my_school_active()
    and public.is_member_of_team(team_id)
  )
  with check (
    public.get_my_role() = 'coach'
    and public.is_my_school_active()
    and public.is_member_of_team(team_id)
  );
