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
  select p.school_id
    into caller_school_id
  from public.profiles p
  join public.schools s on s.id = p.school_id
  where p.id = auth.uid()
    and p.role = 'director'
    and s.status = 'active';

  if caller_school_id is null then
    raise exception 'Only an active organization director can remove coaches.';
  end if;

  select p.school_id
    into target_school_id
  from public.profiles p
  where p.id = target_user_id
    and p.role = 'coach';

  if target_school_id is distinct from caller_school_id then
    raise exception 'The coach does not belong to this organization.';
  end if;

  if remove_from_organization then
    delete from public.coach_assignments ca
    where ca.assistant_coach_user_id = target_user_id
      and ca.school_id = caller_school_id;

    delete from public.team_memberships tm
    using public.teams t
    where tm.user_id = target_user_id
      and tm.team_id = t.id
      and t.school_id = caller_school_id;

    update public.profiles
    set school_id = null
    where id = target_user_id
      and role = 'coach'
      and school_id = caller_school_id;
    return;
  end if;

  if target_team_id is null or not exists (
    select 1
    from public.teams t
    where t.id = target_team_id
      and t.school_id = caller_school_id
  ) then
    raise exception 'A team in this organization is required.';
  end if;

  delete from public.coach_assignments ca
  where ca.assistant_coach_user_id = target_user_id
    and ca.team_id = target_team_id;

  delete from public.team_memberships tm
  where tm.user_id = target_user_id
    and tm.team_id = target_team_id;
end;
$$;

revoke all on function public.remove_coach_membership(uuid, uuid, boolean)
  from public;
grant execute on function public.remove_coach_membership(uuid, uuid, boolean)
  to authenticated;
