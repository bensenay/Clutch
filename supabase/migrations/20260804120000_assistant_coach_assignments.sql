create table if not exists public.coach_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  assistant_coach_user_id uuid not null references public.profiles (id) on delete cascade,
  assignment_type text not null,
  scheduled_at timestamptz not null,
  director_note text not null,
  coach_note text,
  status text not null default 'pending',
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint coach_assignments_assignment_type_check
    check (assignment_type in ('game', 'practice')),
  constraint coach_assignments_status_check
    check (status in ('pending', 'confirmed'))
);

create index if not exists coach_assignments_school_id_idx
  on public.coach_assignments (school_id);

create index if not exists coach_assignments_team_schedule_idx
  on public.coach_assignments (team_id, assignment_type, scheduled_at);

create index if not exists coach_assignments_assistant_coach_user_id_idx
  on public.coach_assignments (assistant_coach_user_id);

alter table public.coach_assignments enable row level security;

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
    where g.id = check_game_id
      and ca.assistant_coach_user_id = auth.uid()
  );
$$;

create or replace function public.has_assignment_for_practice_plan(check_practice_plan_id uuid)
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
    where pp.id = check_practice_plan_id
      and ca.assistant_coach_user_id = auth.uid()
  );
$$;

grant delete on table public.coach_assignments to anon;
grant insert on table public.coach_assignments to anon;
grant select on table public.coach_assignments to anon;
grant update on table public.coach_assignments to anon;

grant delete on table public.coach_assignments to authenticated;
grant insert on table public.coach_assignments to authenticated;
grant select on table public.coach_assignments to authenticated;
grant update on table public.coach_assignments to authenticated;

grant delete on table public.coach_assignments to service_role;
grant insert on table public.coach_assignments to service_role;
grant select on table public.coach_assignments to service_role;
grant update on table public.coach_assignments to service_role;

drop policy if exists "Super admins manage all coach assignments"
  on public.coach_assignments;
create policy "Super admins manage all coach assignments"
  on public.coach_assignments
  as permissive
  for all
  to public
  using (public.get_my_role() = 'super_admin'::public.user_role)
  with check (public.get_my_role() = 'super_admin'::public.user_role);

drop policy if exists "Directors manage coach assignments in their school"
  on public.coach_assignments;
create policy "Directors manage coach assignments in their school"
  on public.coach_assignments
  as permissive
  for all
  to public
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
      from public.profiles p
      where p.id = coach_assignments.assistant_coach_user_id
        and p.school_id = public.get_my_school_id()
        and p.role = 'coach'::public.user_role
    )
    and exists (
      select 1
      from public.profiles p
      where p.id = coach_assignments.created_by
        and p.school_id = public.get_my_school_id()
        and p.role = 'director'::public.user_role
    )
  );

drop policy if exists "Assistant coaches see own assignments"
  on public.coach_assignments;
create policy "Assistant coaches see own assignments"
  on public.coach_assignments
  as permissive
  for select
  to public
  using (
    public.get_my_role() = 'coach'::public.user_role
    and public.is_my_school_active()
    and assistant_coach_user_id = auth.uid()
  );

drop policy if exists "Assistant coaches update own assignments"
  on public.coach_assignments;
create policy "Assistant coaches update own assignments"
  on public.coach_assignments
  as permissive
  for update
  to public
  using (
    public.get_my_role() = 'coach'::public.user_role
    and public.is_my_school_active()
    and assistant_coach_user_id = auth.uid()
  )
  with check (
    public.get_my_role() = 'coach'::public.user_role
    and public.is_my_school_active()
    and assistant_coach_user_id = auth.uid()
  );

drop policy if exists "Assistant coaches read assigned games"
  on public.games;
create policy "Assistant coaches read assigned games"
  on public.games
  as permissive
  for select
  to public
  using (
    public.get_my_role() = 'coach'::public.user_role
    and public.is_my_school_active()
    and public.has_assignment_for_game(id)
  );

drop policy if exists "Assistant coaches read lineups for assigned games"
  on public.lineups;
create policy "Assistant coaches read lineups for assigned games"
  on public.lineups
  as permissive
  for select
  to public
  using (
    public.get_my_role() = 'coach'::public.user_role
    and public.is_my_school_active()
    and public.has_assignment_for_game(game_id)
  );

drop policy if exists "Assistant coaches read assigned practice plans"
  on public.practice_plans;
create policy "Assistant coaches read assigned practice plans"
  on public.practice_plans
  as permissive
  for select
  to public
  using (
    public.get_my_role() = 'coach'::public.user_role
    and public.is_my_school_active()
    and public.has_assignment_for_practice_plan(id)
  );
