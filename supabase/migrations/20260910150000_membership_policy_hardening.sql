-- A director must not be able to attach an account from another school to a
-- team merely by knowing its user UUID. Keep both sides of the membership in
-- the director's active school.
drop policy if exists team_memberships_director_same_school
  on public.team_memberships;
drop policy if exists "Directors create memberships in their school"
  on public.team_memberships;
drop policy if exists "Directors delete memberships in their school"
  on public.team_memberships;
drop policy if exists "Directors see memberships in their school"
  on public.team_memberships;

create policy "Directors read memberships in their school"
  on public.team_memberships
  for select
  to authenticated
  using (
    public.get_my_role() = 'director'::public.user_role
    and public.is_my_school_active()
    and exists (
      select 1
      from public.teams t
      where t.id = team_memberships.team_id
        and t.school_id = public.get_my_school_id()
    )
  );

create policy "Directors create same-school coach memberships"
  on public.team_memberships
  for insert
  to authenticated
  with check (
    public.get_my_role() = 'director'::public.user_role
    and public.is_my_school_active()
    and exists (
      select 1
      from public.teams t
      where t.id = team_memberships.team_id
        and t.school_id = public.get_my_school_id()
    )
    and exists (
      select 1
      from public.profiles p
      where p.id = team_memberships.user_id
        and p.role = 'coach'::public.user_role
        and p.school_id = public.get_my_school_id()
    )
  );

create policy "Directors delete memberships in their school"
  on public.team_memberships
  for delete
  to authenticated
  using (
    public.get_my_role() = 'director'::public.user_role
    and public.is_my_school_active()
    and exists (
      select 1
      from public.teams t
      where t.id = team_memberships.team_id
        and t.school_id = public.get_my_school_id()
    )
  );
