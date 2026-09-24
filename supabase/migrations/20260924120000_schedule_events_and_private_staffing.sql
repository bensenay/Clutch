create table if not exists public.schedule_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  event_type text not null check (event_type in ('game', 'practice')),
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text,
  opponent_name text,
  is_home boolean,
  goalie_coach_attending boolean,
  game_id uuid unique references public.games (id) on delete cascade,
  practice_plan_id uuid unique references public.practice_plans (id) on delete set null,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_events_title_not_blank check (btrim(title) <> ''),
  constraint schedule_events_valid_interval check (ends_at > starts_at),
  constraint schedule_events_game_shape check (
    (event_type = 'game' and game_id is not null and opponent_name is not null
      and is_home is not null and goalie_coach_attending is null)
    or
    (event_type = 'practice' and game_id is null and opponent_name is null
      and is_home is null and goalie_coach_attending is not null)
  )
);

create index if not exists schedule_events_school_starts_idx
  on public.schedule_events (school_id, starts_at);
create index if not exists schedule_events_team_starts_idx
  on public.schedule_events (team_id, starts_at);

create table if not exists public.event_staff_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.schedule_events (id) on delete cascade,
  coach_user_id uuid not null references public.profiles (id) on delete cascade,
  coach_role text not null check (coach_role in ('head_coach', 'assistant_coach')),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'declined')),
  decline_reason text,
  coach_note text,
  assigned_by uuid not null references public.profiles (id) on delete restrict,
  legacy_assignment_id uuid unique references public.coach_assignments (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_staff_event_coach_key unique (event_id, coach_user_id)
);

create index if not exists event_staff_coach_idx
  on public.event_staff_assignments (coach_user_id, event_id);
create index if not exists event_staff_event_idx
  on public.event_staff_assignments (event_id, coach_role);

create table if not exists public.event_private_notes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.schedule_events (id) on delete cascade,
  sender_user_id uuid not null references public.profiles (id) on delete cascade,
  recipient_user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (btrim(body) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_private_notes_distinct_people
    check (sender_user_id <> recipient_user_id)
);

create index if not exists event_private_notes_event_idx
  on public.event_private_notes (event_id, created_at);
create index if not exists event_private_notes_recipient_idx
  on public.event_private_notes (recipient_user_id, event_id);

alter table public.coach_assignments
  add column if not exists event_id uuid references public.schedule_events (id) on delete set null,
  add column if not exists migration_status text not null default 'not_attempted'
    check (migration_status in ('not_attempted', 'matched', 'ambiguous', 'unmatched'));

insert into public.schedule_events (
  school_id,
  team_id,
  event_type,
  title,
  starts_at,
  ends_at,
  location,
  opponent_name,
  is_home,
  goalie_coach_attending,
  game_id,
  created_by,
  created_at,
  updated_at
)
select
  t.school_id,
  g.team_id,
  'game',
  g.opponent_name,
  g.game_date,
  g.game_date + interval '2 hours',
  g.location,
  g.opponent_name,
  g.is_home,
  null,
  g.id,
  coalesce(
    (
      select tm.user_id
      from public.team_memberships tm
      where tm.team_id = g.team_id
        and tm.membership_role = 'head_coach'
      order by tm.created_at
      limit 1
    ),
    (
      select p.id
      from public.profiles p
      where p.school_id = t.school_id and p.role = 'director'
      order by p.created_at
      limit 1
    )
  ),
  g.created_at,
  g.created_at
from public.games g
join public.teams t on t.id = g.team_id
where not exists (
  select 1 from public.schedule_events se where se.game_id = g.id
)
and exists (
  select 1
  from public.profiles p
  where p.id = coalesce(
    (
      select tm.user_id
      from public.team_memberships tm
      where tm.team_id = g.team_id
        and tm.membership_role = 'head_coach'
      order by tm.created_at
      limit 1
    ),
    (
      select p2.id
      from public.profiles p2
      where p2.school_id = t.school_id and p2.role = 'director'
      order by p2.created_at
      limit 1
    )
  )
);

insert into public.schedule_events (
  school_id,
  team_id,
  event_type,
  title,
  starts_at,
  ends_at,
  location,
  goalie_coach_attending,
  practice_plan_id,
  created_by,
  created_at,
  updated_at
)
select
  t.school_id,
  pp.team_id,
  'practice',
  'Practice',
  pp.practice_date,
  pp.practice_date + interval '90 minutes',
  null,
  false,
  pp.id,
  coalesce(
    (
      select tm.user_id
      from public.team_memberships tm
      where tm.team_id = pp.team_id
        and tm.membership_role = 'head_coach'
      order by tm.created_at
      limit 1
    ),
    (
      select p.id
      from public.profiles p
      where p.school_id = t.school_id and p.role = 'director'
      order by p.created_at
      limit 1
    )
  ),
  pp.created_at,
  pp.updated_at
from public.practice_plans pp
join public.teams t on t.id = pp.team_id
where not exists (
  select 1 from public.schedule_events se where se.practice_plan_id = pp.id
)
and exists (
  select 1
  from public.profiles p
  where p.id = coalesce(
    (
      select tm.user_id
      from public.team_memberships tm
      where tm.team_id = pp.team_id
        and tm.membership_role = 'head_coach'
      order by tm.created_at
      limit 1
    ),
    (
      select p2.id
      from public.profiles p2
      where p2.school_id = t.school_id and p2.role = 'director'
      order by p2.created_at
      limit 1
    )
  )
);

with candidate_matches as (
  select
    ca.id as assignment_id,
    (array_agg(se.id order by se.id))[1] as event_id,
    count(*) as match_count
  from public.coach_assignments ca
  join public.schedule_events se
    on se.team_id = ca.team_id
   and se.event_type = ca.assignment_type
   and se.starts_at::date = ca.scheduled_at::date
  group by ca.id
)
update public.coach_assignments ca
set
  event_id = case when cm.match_count = 1 then cm.event_id else null end,
  migration_status = case when cm.match_count = 1 then 'matched' else 'ambiguous' end
from candidate_matches cm
where ca.id = cm.assignment_id;

update public.coach_assignments ca
set migration_status = 'unmatched'
where ca.migration_status = 'not_attempted';

insert into public.event_staff_assignments (
  event_id,
  coach_user_id,
  coach_role,
  status,
  coach_note,
  assigned_by,
  legacy_assignment_id,
  created_at,
  updated_at
)
select
  ca.event_id,
  ca.assistant_coach_user_id,
  'assistant_coach',
  ca.status,
  ca.coach_note,
  ca.created_by,
  ca.id,
  ca.created_at,
  ca.created_at
from public.coach_assignments ca
where ca.event_id is not null
on conflict (event_id, coach_user_id) do nothing;

insert into public.event_private_notes (
  event_id,
  sender_user_id,
  recipient_user_id,
  body,
  created_at,
  updated_at
)
select
  ca.event_id,
  ca.created_by,
  ca.assistant_coach_user_id,
  ca.director_note,
  ca.created_at,
  ca.created_at
from public.coach_assignments ca
where ca.event_id is not null
  and btrim(ca.director_note) <> '';

alter table public.schedule_events enable row level security;
alter table public.event_staff_assignments enable row level security;
alter table public.event_private_notes enable row level security;

revoke all on table public.schedule_events from anon;
revoke all on table public.event_staff_assignments from anon;
revoke all on table public.event_private_notes from anon;
grant select, insert, update, delete on table public.schedule_events to authenticated;
grant select, insert, update, delete on table public.event_staff_assignments to authenticated;
grant select, insert, update, delete on table public.event_private_notes to authenticated;

create or replace function public.can_read_schedule_event(check_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.schedule_events se
    where se.id = check_event_id
      and (
        public.get_my_role() = 'super_admin'::public.user_role
        or (
          public.is_my_school_active()
          and (
            (
              public.get_my_role() = 'director'::public.user_role
              and se.school_id = public.get_my_school_id()
            )
            or public.is_head_coach_of_team(se.team_id)
            or exists (
              select 1
              from public.event_staff_assignments esa
              where esa.event_id = se.id
                and esa.coach_user_id = auth.uid()
            )
          )
        )
      )
  );
$$;

create or replace function public.can_manage_schedule_team(check_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.get_my_role() = 'super_admin'::public.user_role
    or (
      public.is_my_school_active()
      and (
        (
          public.get_my_role() = 'director'::public.user_role
          and exists (
            select 1 from public.teams t
            where t.id = check_team_id
              and t.school_id = public.get_my_school_id()
          )
        )
        or public.is_head_coach_of_team(check_team_id)
      )
    );
$$;

create or replace function public.is_schedule_event_participant(check_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.event_staff_assignments esa
    where esa.event_id = check_event_id and esa.coach_user_id = auth.uid()
  );
$$;

drop policy if exists schedule_events_select on public.schedule_events;
create policy schedule_events_select on public.schedule_events
  for select to authenticated
  using (public.can_read_schedule_event(id));

drop policy if exists schedule_events_insert on public.schedule_events;
create policy schedule_events_insert on public.schedule_events
  for insert to authenticated
  with check (
    public.can_manage_schedule_team(team_id)
    and created_by = auth.uid()
    and exists (
      select 1 from public.teams t
      where t.id = schedule_events.team_id
        and t.school_id = schedule_events.school_id
    )
  );

drop policy if exists schedule_events_update on public.schedule_events;
create policy schedule_events_update on public.schedule_events
  for update to authenticated
  using (public.can_manage_schedule_team(team_id))
  with check (
    public.can_manage_schedule_team(team_id)
    and exists (
      select 1 from public.teams t
      where t.id = schedule_events.team_id
        and t.school_id = schedule_events.school_id
    )
  );

drop policy if exists schedule_events_delete on public.schedule_events;
create policy schedule_events_delete on public.schedule_events
  for delete to authenticated
  using (public.can_manage_schedule_team(team_id));

drop policy if exists event_staff_select on public.event_staff_assignments;
create policy event_staff_select on public.event_staff_assignments
  for select to authenticated
  using (
    public.can_read_schedule_event(event_id)
    and (
      public.get_my_role() in (
        'director'::public.user_role,
        'super_admin'::public.user_role
      )
      or public.is_schedule_event_participant(event_id)
      or exists (
        select 1 from public.schedule_events se
        where se.id = event_staff_assignments.event_id
          and public.is_head_coach_of_team(se.team_id)
      )
    )
  );

drop policy if exists event_staff_director_manage on public.event_staff_assignments;
drop policy if exists event_staff_director_insert on public.event_staff_assignments;
create policy event_staff_director_insert on public.event_staff_assignments
  for insert to authenticated
  with check (
    public.get_my_role() = 'super_admin'::public.user_role
    or (
      public.get_my_role() = 'director'::public.user_role
      and exists (
        select 1 from public.schedule_events se
        where se.id = event_staff_assignments.event_id
          and se.school_id = public.get_my_school_id()
      )
    )
    and exists (
      select 1
      from public.schedule_events se
      join public.team_memberships tm
        on tm.team_id = se.team_id
       and tm.user_id = event_staff_assignments.coach_user_id
       and tm.membership_role = event_staff_assignments.coach_role
      where se.id = event_staff_assignments.event_id
    )
    and (public.get_my_role() = 'super_admin'::public.user_role or assigned_by = auth.uid())
  );

drop policy if exists event_staff_director_update on public.event_staff_assignments;
create policy event_staff_director_update on public.event_staff_assignments
  for update to authenticated
  using (
    public.get_my_role() = 'super_admin'::public.user_role
    or (
      public.get_my_role() = 'director'::public.user_role
      and exists (
        select 1 from public.schedule_events se
        where se.id = event_staff_assignments.event_id
          and se.school_id = public.get_my_school_id()
      )
    )
  )
  with check (
    public.get_my_role() = 'super_admin'::public.user_role
    or (
      public.get_my_role() = 'director'::public.user_role
      and exists (
        select 1
        from public.schedule_events se
        join public.team_memberships tm
          on tm.team_id = se.team_id
         and tm.user_id = event_staff_assignments.coach_user_id
         and tm.membership_role = event_staff_assignments.coach_role
        where se.id = event_staff_assignments.event_id
          and se.school_id = public.get_my_school_id()
      )
    )
  );

drop policy if exists event_staff_director_delete on public.event_staff_assignments;
create policy event_staff_director_delete on public.event_staff_assignments
  for delete to authenticated
  using (
    public.get_my_role() = 'super_admin'::public.user_role
    or (
      public.get_my_role() = 'director'::public.user_role
      and exists (
        select 1 from public.schedule_events se
        where se.id = event_staff_assignments.event_id
          and se.school_id = public.get_my_school_id()
      )
    )
  );

drop policy if exists event_staff_head_self_insert on public.event_staff_assignments;
create policy event_staff_head_self_insert on public.event_staff_assignments
  for insert to authenticated
  with check (
    coach_user_id = auth.uid()
    and assigned_by = auth.uid()
    and coach_role = 'head_coach'
    and status = 'confirmed'
    and exists (
      select 1
      from public.schedule_events se
      where se.id = event_staff_assignments.event_id
        and se.created_by = auth.uid()
        and public.is_head_coach_of_team(se.team_id)
    )
  );

drop policy if exists event_staff_self_update on public.event_staff_assignments;
create policy event_staff_self_update on public.event_staff_assignments
  for update to authenticated
  using (coach_user_id = auth.uid() and public.can_read_schedule_event(event_id))
  with check (coach_user_id = auth.uid() and public.can_read_schedule_event(event_id));

create or replace function public.protect_event_staff_assignment_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  if new.assigned_by is distinct from old.assigned_by
    and public.get_my_role() <> 'super_admin'::public.user_role then
    raise exception 'The assignment creator cannot be changed.' using errcode = '42501';
  end if;
  if public.get_my_role() = 'coach'::public.user_role and (
    new.id is distinct from old.id
    or new.event_id is distinct from old.event_id
    or new.coach_user_id is distinct from old.coach_user_id
    or new.coach_role is distinct from old.coach_role
    or new.legacy_assignment_id is distinct from old.legacy_assignment_id
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Coaches may only update their response and own note.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_event_staff_assignment_fields
  on public.event_staff_assignments;
create trigger protect_event_staff_assignment_fields
before update on public.event_staff_assignments
for each row execute function public.protect_event_staff_assignment_fields();

create or replace function public.validate_schedule_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.teams t
    where t.id = new.team_id and t.school_id = new.school_id
  ) then
    raise exception 'The event team must belong to the selected organization.'
      using errcode = '23514';
  end if;

  if new.game_id is not null and not exists (
    select 1
    from public.games g
    where g.id = new.game_id and g.team_id = new.team_id
  ) then
    raise exception 'The linked game must belong to the event team.'
      using errcode = '23514';
  end if;

  if new.practice_plan_id is not null and not exists (
    select 1
    from public.practice_plans pp
    where pp.id = new.practice_plan_id and pp.team_id = new.team_id
  ) then
    raise exception 'The linked practice plan must belong to the event team.'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and new.created_by is distinct from old.created_by then
    raise exception 'The event creator cannot be changed.' using errcode = '42501';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists validate_schedule_event on public.schedule_events;
create trigger validate_schedule_event
before insert or update on public.schedule_events
for each row execute function public.validate_schedule_event();

create or replace function public.protect_event_private_note_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id is distinct from old.id
    or new.event_id is distinct from old.event_id
    or new.sender_user_id is distinct from old.sender_user_id
    or new.recipient_user_id is distinct from old.recipient_user_id
    or new.created_at is distinct from old.created_at then
    raise exception 'A private note audience cannot be changed.' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists protect_event_private_note_fields
  on public.event_private_notes;
create trigger protect_event_private_note_fields
before update on public.event_private_notes
for each row execute function public.protect_event_private_note_fields();

drop policy if exists event_notes_select on public.event_private_notes;
create policy event_notes_select on public.event_private_notes
  for select to authenticated
  using (sender_user_id = auth.uid() or recipient_user_id = auth.uid());

drop policy if exists event_notes_insert on public.event_private_notes;
create policy event_notes_insert on public.event_private_notes
  for insert to authenticated
  with check (
    sender_user_id = auth.uid()
    and public.is_my_school_active()
    and exists (
      select 1
      from public.schedule_events se
      where se.id = event_private_notes.event_id
        and (
          (
            public.get_my_role() = 'director'::public.user_role
            and se.school_id = public.get_my_school_id()
          )
          or (
            public.is_head_coach_of_team(se.team_id)
            and exists (
              select 1 from public.event_staff_assignments sender_assignment
              where sender_assignment.event_id = se.id
                and sender_assignment.coach_user_id = auth.uid()
                and sender_assignment.coach_role = 'head_coach'
            )
          )
        )
        and exists (
          select 1 from public.event_staff_assignments recipient_assignment
          where recipient_assignment.event_id = se.id
            and recipient_assignment.coach_user_id = event_private_notes.recipient_user_id
            and (
              public.get_my_role() = 'director'::public.user_role
              or recipient_assignment.coach_role = 'assistant_coach'
            )
        )
    )
  );

drop policy if exists event_notes_update on public.event_private_notes;
create policy event_notes_update on public.event_private_notes
  for update to authenticated
  using (
    sender_user_id = auth.uid()
    and public.can_read_schedule_event(event_id)
  )
  with check (
    sender_user_id = auth.uid()
    and public.can_read_schedule_event(event_id)
  );

drop policy if exists event_notes_delete on public.event_private_notes;
create policy event_notes_delete on public.event_private_notes
  for delete to authenticated
  using (
    sender_user_id = auth.uid()
    and public.can_read_schedule_event(event_id)
  );

create or replace function public.has_assignment_for_game(check_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.schedule_events se
    join public.event_staff_assignments esa on esa.event_id = se.id
    where se.game_id = check_game_id
      and esa.coach_user_id = auth.uid()
  );
$$;

create or replace function public.has_assignment_for_practice_plan(
  check_practice_plan_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.schedule_events se
    join public.event_staff_assignments esa on esa.event_id = se.id
    where se.practice_plan_id = check_practice_plan_id
      and esa.coach_user_id = auth.uid()
  );
$$;

create or replace function public.get_schedule_event_staff(check_event_ids uuid[])
returns table (
  id uuid,
  event_id uuid,
  coach_user_id uuid,
  coach_name text,
  coach_email text,
  coach_role text,
  status text,
  decline_reason text,
  coach_note text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    esa.id,
    esa.event_id,
    esa.coach_user_id,
    coalesce(nullif(btrim(p.name), ''), split_part(p.email, '@', 1), 'Coach'),
    p.email,
    esa.coach_role,
    esa.status,
    esa.decline_reason,
    case when esa.coach_user_id = auth.uid()
      or public.get_my_role() = 'director'::public.user_role
      then esa.coach_note else null end
  from public.event_staff_assignments esa
  join public.profiles p on p.id = esa.coach_user_id
  where esa.event_id = any(check_event_ids)
    and public.can_read_schedule_event(esa.event_id)
  order by esa.coach_role desc, 4;
$$;

create or replace function public.get_event_private_notes(check_event_id uuid)
returns table (
  id uuid,
  event_id uuid,
  sender_user_id uuid,
  sender_name text,
  recipient_user_id uuid,
  recipient_name text,
  body text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    n.id,
    n.event_id,
    n.sender_user_id,
    coalesce(nullif(btrim(sender.name), ''), split_part(sender.email, '@', 1), 'Coach'),
    n.recipient_user_id,
    coalesce(nullif(btrim(recipient.name), ''), split_part(recipient.email, '@', 1), 'Coach'),
    n.body,
    n.created_at,
    n.updated_at
  from public.event_private_notes n
  join public.profiles sender on sender.id = n.sender_user_id
  join public.profiles recipient on recipient.id = n.recipient_user_id
  where n.event_id = check_event_id
    and (n.sender_user_id = auth.uid() or n.recipient_user_id = auth.uid())
  order by n.created_at;
$$;

revoke all on function public.can_read_schedule_event(uuid) from public;
revoke all on function public.can_manage_schedule_team(uuid) from public;
revoke all on function public.is_schedule_event_participant(uuid) from public;
revoke all on function public.get_schedule_event_staff(uuid[]) from public;
revoke all on function public.get_event_private_notes(uuid) from public;
grant execute on function public.can_read_schedule_event(uuid) to authenticated;
grant execute on function public.can_manage_schedule_team(uuid) to authenticated;
grant execute on function public.is_schedule_event_participant(uuid) to authenticated;
grant execute on function public.get_schedule_event_staff(uuid[]) to authenticated;
grant execute on function public.get_event_private_notes(uuid) to authenticated;

drop policy if exists "Directors update memberships in their school"
  on public.team_memberships;
create policy "Directors update memberships in their school"
  on public.team_memberships
  for update
  to authenticated
  using (
    public.get_my_role() = 'director'::public.user_role
    and public.is_my_school_active()
    and exists (
      select 1 from public.teams t
      where t.id = team_memberships.team_id
        and t.school_id = public.get_my_school_id()
    )
  )
  with check (
    public.get_my_role() = 'director'::public.user_role
    and public.is_my_school_active()
    and exists (
      select 1 from public.teams t
      where t.id = team_memberships.team_id
        and t.school_id = public.get_my_school_id()
    )
    and exists (
      select 1 from public.profiles p
      where p.id = team_memberships.user_id
        and p.role = 'coach'::public.user_role
        and p.school_id = public.get_my_school_id()
    )
  );

create or replace function public.sync_future_event_staff_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.membership_role is distinct from old.membership_role then
    update public.event_staff_assignments esa
    set coach_role = new.membership_role, updated_at = now()
    from public.schedule_events se
    where esa.event_id = se.id
      and se.team_id = new.team_id
      and se.starts_at >= now()
      and esa.coach_user_id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_future_event_staff_role on public.team_memberships;
create trigger sync_future_event_staff_role
after update of membership_role on public.team_memberships
for each row execute function public.sync_future_event_staff_role();

create or replace function public.remove_coach_membership(
  target_user_id uuid,
  target_team_id uuid default null,
  remove_from_organization boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_school_id uuid;
  target_school_id uuid;
begin
  select p.school_id into caller_school_id
  from public.profiles p
  join public.schools s on s.id = p.school_id
  where p.id = auth.uid() and p.role = 'director' and s.status = 'active';

  if caller_school_id is null then
    raise exception 'Only an active organization director can remove coaches.';
  end if;

  select p.school_id into target_school_id
  from public.profiles p
  where p.id = target_user_id and p.role = 'coach';

  if target_school_id is distinct from caller_school_id then
    raise exception 'The coach does not belong to this organization.';
  end if;

  if remove_from_organization then
    delete from public.event_private_notes n
    using public.schedule_events se
    where n.event_id = se.id
      and se.school_id = caller_school_id
      and (n.sender_user_id = target_user_id or n.recipient_user_id = target_user_id);

    delete from public.event_staff_assignments esa
    using public.schedule_events se
    where esa.event_id = se.id
      and se.school_id = caller_school_id
      and esa.coach_user_id = target_user_id;

    delete from public.coach_assignments ca
    where ca.assistant_coach_user_id = target_user_id
      and ca.school_id = caller_school_id;

    delete from public.team_memberships tm
    using public.teams t
    where tm.user_id = target_user_id
      and tm.team_id = t.id
      and t.school_id = caller_school_id;

    update public.profiles set school_id = null
    where id = target_user_id and role = 'coach' and school_id = caller_school_id;
    return;
  end if;

  if target_team_id is null or not exists (
    select 1 from public.teams t
    where t.id = target_team_id and t.school_id = caller_school_id
  ) then
    raise exception 'A team in this organization is required.';
  end if;

  delete from public.event_private_notes n
  using public.schedule_events se
  where n.event_id = se.id
    and se.team_id = target_team_id
    and (n.sender_user_id = target_user_id or n.recipient_user_id = target_user_id);

  delete from public.event_staff_assignments esa
  using public.schedule_events se
  where esa.event_id = se.id
    and se.team_id = target_team_id
    and esa.coach_user_id = target_user_id;

  delete from public.coach_assignments ca
  where ca.assistant_coach_user_id = target_user_id
    and ca.team_id = target_team_id;

  delete from public.team_memberships tm
  where tm.user_id = target_user_id and tm.team_id = target_team_id;
end;
$$;
