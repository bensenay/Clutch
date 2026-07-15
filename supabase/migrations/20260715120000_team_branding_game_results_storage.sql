alter table "public"."teams"
  add column if not exists "secondary_color" text,
  add column if not exists "tertiary_color" text,
  add column if not exists "logo_url" text;

alter table "public"."games"
  add column if not exists "result" text;

alter table "public"."games"
  drop constraint if exists "games_result_check";

alter table "public"."games"
  add constraint "games_result_check"
  check (
    result is null
    or result in ('win', 'loss', 'tie')
  );

create or replace function public.team_logo_team_id(object_name text)
returns uuid
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare
  maybe_team_id text;
begin
  maybe_team_id := (storage.foldername(object_name))[1];
  return maybe_team_id::uuid;
exception
  when others then
    return null;
end;
$$;

insert into storage.buckets (id, name, public)
values ('team-logos', 'team-logos', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "Public read team logos" on storage.objects;
create policy "Public read team logos"
  on storage.objects
  as permissive
  for select
  to public
  using (bucket_id = 'team-logos');

drop policy if exists "Coaches and directors upload team logos" on storage.objects;
create policy "Coaches and directors upload team logos"
  on storage.objects
  as permissive
  for insert
  to public
  with check (
    bucket_id = 'team-logos'
    and (
      (
        public.get_my_role() = 'coach'::public.user_role
        and public.is_my_school_active()
        and public.is_member_of_team(public.team_logo_team_id(name))
      )
      or (
        public.get_my_role() = 'director'::public.user_role
        and public.is_my_school_active()
        and exists (
          select 1
          from public.teams t
          where t.id = public.team_logo_team_id(name)
            and t.school_id = public.get_my_school_id()
        )
      )
    )
  );

drop policy if exists "Coaches and directors update team logos" on storage.objects;
create policy "Coaches and directors update team logos"
  on storage.objects
  as permissive
  for update
  to public
  using (
    bucket_id = 'team-logos'
    and (
      (
        public.get_my_role() = 'coach'::public.user_role
        and public.is_my_school_active()
        and public.is_member_of_team(public.team_logo_team_id(name))
      )
      or (
        public.get_my_role() = 'director'::public.user_role
        and public.is_my_school_active()
        and exists (
          select 1
          from public.teams t
          where t.id = public.team_logo_team_id(name)
            and t.school_id = public.get_my_school_id()
        )
      )
    )
  )
  with check (
    bucket_id = 'team-logos'
    and (
      (
        public.get_my_role() = 'coach'::public.user_role
        and public.is_my_school_active()
        and public.is_member_of_team(public.team_logo_team_id(name))
      )
      or (
        public.get_my_role() = 'director'::public.user_role
        and public.is_my_school_active()
        and exists (
          select 1
          from public.teams t
          where t.id = public.team_logo_team_id(name)
            and t.school_id = public.get_my_school_id()
        )
      )
    )
  );

drop policy if exists "Coaches and directors delete team logos" on storage.objects;
create policy "Coaches and directors delete team logos"
  on storage.objects
  as permissive
  for delete
  to public
  using (
    bucket_id = 'team-logos'
    and (
      (
        public.get_my_role() = 'coach'::public.user_role
        and public.is_my_school_active()
        and public.is_member_of_team(public.team_logo_team_id(name))
      )
      or (
        public.get_my_role() = 'director'::public.user_role
        and public.is_my_school_active()
        and exists (
          select 1
          from public.teams t
          where t.id = public.team_logo_team_id(name)
            and t.school_id = public.get_my_school_id()
        )
      )
    )
  );

drop policy if exists "Coaches update assigned team branding" on "public"."teams";
create policy "Coaches update assigned team branding"
  on "public"."teams"
  as permissive
  for update
  to public
  using (
    (
      public.get_my_role() = 'coach'::public.user_role
      and public.is_my_school_active()
      and public.is_member_of_team(id)
    )
  )
  with check (
    (
      public.get_my_role() = 'coach'::public.user_role
      and public.is_my_school_active()
      and public.is_member_of_team(id)
    )
  );
