-- INSERT ... RETURNING evaluates the SELECT policy before the new row is
-- visible to helper functions that query schedule_events again. The original
-- policy called can_read_schedule_event(id), whose self-lookup therefore
-- returned false for an otherwise-authorized newly inserted event.
--
-- Evaluate authorization directly against the candidate row instead. Related
-- assignment access remains encapsulated in a security-definer helper and
-- does not recurse through schedule_events RLS.
drop policy if exists schedule_events_select on public.schedule_events;
create policy schedule_events_select on public.schedule_events
  for select
  to authenticated
  using (
    public.get_my_role() = 'super_admin'::public.user_role
    or (
      public.is_my_school_active()
      and (
        (
          public.get_my_role() = 'director'::public.user_role
          and school_id = public.get_my_school_id()
        )
        or public.is_head_coach_of_team(team_id)
        or public.is_schedule_event_participant(id)
      )
    )
  );
