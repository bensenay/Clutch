alter table public.team_memberships
  add column if not exists membership_role text not null default 'head_coach';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'team_memberships_membership_role_check'
      and conrelid = 'public.team_memberships'::regclass
  ) then
    alter table public.team_memberships
      add constraint team_memberships_membership_role_check
      check (membership_role in ('head_coach', 'assistant_coach'));
  end if;
end
$$;

create index if not exists team_memberships_team_user_role_idx
  on public.team_memberships (team_id, user_id, membership_role);

create or replace function public.generate_team_join_code()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i integer;
begin
  loop
    code := '';

    for i in 1..8 loop
      code := code || substr(
        alphabet,
        (get_byte(extensions.gen_random_bytes(1), 0) % length(alphabet)) + 1,
        1
      );
    end loop;

    exit when not exists (
      select 1
      from public.teams t
      where t.join_code = code
    );
  end loop;

  return code;
end;
$$;

alter table public.teams
  add column if not exists join_code text;

alter table public.teams
  alter column join_code set default public.generate_team_join_code();

do $$
declare
  target_team_id uuid;
begin
  loop
    select t.id
    into target_team_id
    from public.teams t
    where t.join_code is null
    limit 1;

    exit when target_team_id is null;

    update public.teams
    set join_code = public.generate_team_join_code()
    where id = target_team_id;
  end loop;
end
$$;

create unique index if not exists teams_join_code_key
  on public.teams (join_code);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'teams_join_code_key'
      and conrelid = 'public.teams'::regclass
  ) then
    alter table public.teams
      add constraint teams_join_code_key
      unique using index teams_join_code_key;
  end if;
end
$$;

create or replace function public.is_head_coach_of_team(check_team_id uuid)
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
      and tm.team_id = check_team_id
      and tm.membership_role = 'head_coach'
  );
$$;

drop policy if exists "Coaches and directors manage accessible drills"
  on public.drills;
drop policy if exists drills_coach_member_team_manage
  on public.drills;
create policy "Coaches and directors manage accessible drills"
  on public.drills
  as permissive
  for all
  to public
  using (
    public.is_my_school_active()
    and exists (
      select 1
      from public.teams t
      where t.id = drills.team_id
        and (
          (
            public.get_my_role() = 'coach'::public.user_role
            and public.is_head_coach_of_team(t.id)
          )
          or (
            public.get_my_role() = 'director'::public.user_role
            and t.school_id = public.get_my_school_id()
          )
        )
    )
  )
  with check (
    public.is_my_school_active()
    and exists (
      select 1
      from public.teams t
      where t.id = drills.team_id
        and (
          (
            public.get_my_role() = 'coach'::public.user_role
            and public.is_head_coach_of_team(t.id)
            and drills.created_by_user_id = auth.uid()
          )
          or (
            public.get_my_role() = 'director'::public.user_role
            and t.school_id = public.get_my_school_id()
          )
        )
    )
  );

drop policy if exists "Coaches manage games on assigned teams"
  on public.games;
drop policy if exists games_coach_member_team
  on public.games;
create policy "Coaches manage games on assigned teams"
  on public.games
  as permissive
  for all
  to public
  using (
    public.is_my_school_active()
    and exists (
      select 1
      from public.teams t
      where t.id = games.team_id
        and (
          (
            public.get_my_role() = 'coach'::public.user_role
            and public.is_head_coach_of_team(t.id)
          )
          or (
            public.get_my_role() = 'director'::public.user_role
            and t.school_id = public.get_my_school_id()
          )
        )
    )
  )
  with check (
    public.is_my_school_active()
    and exists (
      select 1
      from public.teams t
      where t.id = games.team_id
        and (
          (
            public.get_my_role() = 'coach'::public.user_role
            and public.is_head_coach_of_team(t.id)
          )
          or (
            public.get_my_role() = 'director'::public.user_role
            and t.school_id = public.get_my_school_id()
          )
        )
    )
  );

drop policy if exists "Coaches manage lineups for accessible games"
  on public.lineups;
drop policy if exists lineups_coach_member_team
  on public.lineups;
create policy "Coaches manage lineups for accessible games"
  on public.lineups
  as permissive
  for all
  to public
  using (
    public.is_my_school_active()
    and exists (
      select 1
      from public.games g
      join public.teams t on t.id = g.team_id
      where g.id = lineups.game_id
        and (
          (
            public.get_my_role() = 'coach'::public.user_role
            and public.is_head_coach_of_team(t.id)
          )
          or (
            public.get_my_role() = 'director'::public.user_role
            and t.school_id = public.get_my_school_id()
          )
        )
    )
  )
  with check (
    public.is_my_school_active()
    and exists (
      select 1
      from public.games g
      join public.teams t on t.id = g.team_id
      where g.id = lineups.game_id
        and (
          (
            public.get_my_role() = 'coach'::public.user_role
            and public.is_head_coach_of_team(t.id)
          )
          or (
            public.get_my_role() = 'director'::public.user_role
            and t.school_id = public.get_my_school_id()
          )
        )
    )
  );

drop policy if exists "Coaches manage players on assigned teams"
  on public.players;
drop policy if exists players_coach_member_team
  on public.players;
create policy "Coaches manage players on assigned teams"
  on public.players
  as permissive
  for all
  to public
  using (
    public.is_my_school_active()
    and exists (
      select 1
      from public.teams t
      where t.id = players.team_id
        and (
          (
            public.get_my_role() = 'coach'::public.user_role
            and public.is_head_coach_of_team(t.id)
          )
          or (
            public.get_my_role() = 'director'::public.user_role
            and t.school_id = public.get_my_school_id()
          )
        )
    )
  )
  with check (
    public.is_my_school_active()
    and exists (
      select 1
      from public.teams t
      where t.id = players.team_id
        and (
          (
            public.get_my_role() = 'coach'::public.user_role
            and public.is_head_coach_of_team(t.id)
          )
          or (
            public.get_my_role() = 'director'::public.user_role
            and t.school_id = public.get_my_school_id()
          )
        )
    )
  );

drop policy if exists "Assistant coaches read players on their teams"
  on public.players;
create policy "Assistant coaches read players on their teams"
  on public.players
  as permissive
  for select
  to public
  using (
    public.get_my_role() = 'coach'::public.user_role
    and public.is_my_school_active()
    and exists (
      select 1
      from public.team_memberships tm
      where tm.user_id = auth.uid()
        and tm.team_id = players.team_id
        and tm.membership_role = 'assistant_coach'
    )
  );

drop policy if exists "Coaches manage practice plans on assigned teams"
  on public.practice_plans;
drop policy if exists practice_plans_coach_member_team
  on public.practice_plans;
create policy "Coaches manage practice plans on assigned teams"
  on public.practice_plans
  as permissive
  for all
  to public
  using (
    public.is_my_school_active()
    and exists (
      select 1
      from public.teams t
      where t.id = practice_plans.team_id
        and (
          (
            public.get_my_role() = 'coach'::public.user_role
            and public.is_head_coach_of_team(t.id)
          )
          or (
            public.get_my_role() = 'director'::public.user_role
            and t.school_id = public.get_my_school_id()
          )
        )
    )
  )
  with check (
    public.is_my_school_active()
    and exists (
      select 1
      from public.teams t
      where t.id = practice_plans.team_id
        and (
          (
            public.get_my_role() = 'coach'::public.user_role
            and public.is_head_coach_of_team(t.id)
          )
          or (
            public.get_my_role() = 'director'::public.user_role
            and t.school_id = public.get_my_school_id()
          )
        )
    )
  );
