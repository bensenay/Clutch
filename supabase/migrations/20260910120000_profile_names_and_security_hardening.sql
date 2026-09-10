create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'name', '')), '')
  );
  return new;
end;
$$;

-- Anonymous callers have no legitimate direct table access. RLS already
-- rejected them, but removing the grants makes that boundary explicit.
revoke all on table public.schools from anon;
revoke all on table public.profiles from anon;
revoke all on table public.teams from anon;
revoke all on table public.team_memberships from anon;
revoke all on table public.players from anon;
revoke all on table public.games from anon;
revoke all on table public.lineups from anon;
revoke all on table public.drills from anon;
revoke all on table public.practice_plans from anon;
revoke all on table public.coach_assignments from anon;

create or replace function public.has_assignment_for_game(check_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.games g
    join public.coach_assignments ca
      on ca.team_id = g.team_id
     and ca.assignment_type = 'game'
     and ca.scheduled_at::date = g.game_date::date
    join public.team_memberships tm
      on tm.team_id = g.team_id
     and tm.user_id = ca.assistant_coach_user_id
     and tm.membership_role = 'assistant_coach'
    where g.id = check_game_id
      and ca.assistant_coach_user_id = auth.uid()
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
    from public.practice_plans pp
    join public.coach_assignments ca
      on ca.team_id = pp.team_id
     and ca.assignment_type = 'practice'
     and ca.scheduled_at::date = pp.practice_date::date
    join public.team_memberships tm
      on tm.team_id = pp.team_id
     and tm.user_id = ca.assistant_coach_user_id
     and tm.membership_role = 'assistant_coach'
    where pp.id = check_practice_plan_id
      and ca.assistant_coach_user_id = auth.uid()
  );
$$;

create or replace function public.protect_assignment_director_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.get_my_role() = 'coach'::public.user_role and (
    new.id is distinct from old.id
    or new.school_id is distinct from old.school_id
    or new.team_id is distinct from old.team_id
    or new.assistant_coach_user_id is distinct from old.assistant_coach_user_id
    or new.assignment_type is distinct from old.assignment_type
    or new.scheduled_at is distinct from old.scheduled_at
    or new.director_note is distinct from old.director_note
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Assistant coaches may only update their note and confirmation status.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_assignment_director_fields
  on public.coach_assignments;
create trigger protect_assignment_director_fields
before update on public.coach_assignments
for each row execute function public.protect_assignment_director_fields();

drop policy if exists "Directors manage coach assignments in their school"
  on public.coach_assignments;
create policy "Directors manage coach assignments in their school"
  on public.coach_assignments
  as permissive
  for all
  to authenticated
  using (
    public.get_my_role() = 'director'::public.user_role
    and public.is_my_school_active()
    and school_id = public.get_my_school_id()
  )
  with check (
    public.get_my_role() = 'director'::public.user_role
    and public.is_my_school_active()
    and school_id = public.get_my_school_id()
    and exists (
      select 1
      from public.teams t
      where t.id = coach_assignments.team_id
        and t.school_id = public.get_my_school_id()
    )
    and exists (
      select 1
      from public.team_memberships tm
      where tm.team_id = coach_assignments.team_id
        and tm.user_id = coach_assignments.assistant_coach_user_id
        and tm.membership_role = 'assistant_coach'
    )
    and created_by = auth.uid()
  );

create or replace function public.get_school_drill_library()
returns table (
  id uuid,
  team_id uuid,
  name text,
  description text,
  canvas_data jsonb,
  updated_at timestamptz,
  created_at timestamptz,
  team_name text,
  creator_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    d.id,
    d.team_id,
    d.name,
    d.description,
    d.canvas_data,
    d.updated_at,
    d.created_at,
    t.name as team_name,
    coalesce(nullif(btrim(p.name), ''), split_part(p.email, '@', 1), 'Coach')
      as creator_name
  from public.drills d
  join public.teams t on t.id = d.team_id
  join public.profiles p on p.id = d.created_by_user_id
  where d.is_published = true
    and t.school_id = public.get_my_school_id()
    and public.is_my_school_active()
    and public.get_my_role() in (
      'coach'::public.user_role,
      'director'::public.user_role
    )
  order by d.updated_at desc nulls last, d.created_at desc;
$$;

revoke all on function public.get_school_drill_library() from public;
grant execute on function public.get_school_drill_library() to authenticated;
