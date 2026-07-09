drop policy "drills_coach_member_team_manage" on "public"."drills";

drop policy "drills_director_same_school" on "public"."drills";

drop policy "drills_school_library_read" on "public"."drills";

drop policy "drills_super_admin_all" on "public"."drills";

drop policy "games_coach_member_team" on "public"."games";

drop policy "games_director_same_school" on "public"."games";

drop policy "games_super_admin_all" on "public"."games";

drop policy "lineups_coach_member_team" on "public"."lineups";

drop policy "lineups_director_same_school" on "public"."lineups";

drop policy "lineups_super_admin_all" on "public"."lineups";

drop policy "players_coach_member_team" on "public"."players";

drop policy "players_director_same_school" on "public"."players";

drop policy "players_super_admin_all" on "public"."players";

drop policy "practice_plans_coach_member_team" on "public"."practice_plans";

drop policy "practice_plans_director_same_school" on "public"."practice_plans";

drop policy "practice_plans_super_admin_all" on "public"."practice_plans";

drop policy "profiles_director_same_school" on "public"."profiles";

drop policy "profiles_self_read_update" on "public"."profiles";

drop policy "profiles_self_update" on "public"."profiles";

drop policy "profiles_super_admin_all" on "public"."profiles";

drop policy "schools_director_update_active" on "public"."schools";

drop policy "schools_org_read_active" on "public"."schools";

drop policy "schools_super_admin_all" on "public"."schools";

drop policy "team_memberships_coach_read_self" on "public"."team_memberships";

drop policy "team_memberships_director_same_school" on "public"."team_memberships";

drop policy "team_memberships_super_admin_all" on "public"."team_memberships";

drop policy "teams_coach_member_team" on "public"."teams";

drop policy "teams_director_same_school" on "public"."teams";

drop policy "teams_super_admin_all" on "public"."teams";

alter table "public"."drills" drop constraint "drills_canvas_data_is_array_check";

alter table "public"."drills" drop constraint "drills_name_not_blank_check";

alter table "public"."games" drop constraint "games_opponent_name_not_blank_check";

alter table "public"."lineups" drop constraint "lineups_defense_pairs_is_array_check";

alter table "public"."lineups" drop constraint "lineups_goalies_is_array_check";

alter table "public"."lineups" drop constraint "lineups_lines_is_array_check";

alter table "public"."lineups" drop constraint "lineups_special_teams_is_object_check";

alter table "public"."players" drop constraint "players_first_name_not_blank_check";

alter table "public"."players" drop constraint "players_jersey_number_check";

alter table "public"."players" drop constraint "players_last_name_not_blank_check";

alter table "public"."players" drop constraint "players_team_jersey_key";

alter table "public"."practice_plans" drop constraint "practice_plans_segments_is_array_check";

alter table "public"."practice_plans" drop constraint "practice_plans_team_date_key";

alter table "public"."profiles" drop constraint "profiles_email_key";

alter table "public"."profiles" drop constraint "profiles_super_admin_school_check";

alter table "public"."schools" drop constraint "schools_join_code_check";

alter table "public"."team_memberships" drop constraint "team_memberships_user_team_key";

alter table "public"."teams" drop constraint "teams_name_not_blank_check";

alter table "public"."teams" drop constraint "teams_primary_color_check";

alter table "public"."teams" drop constraint "teams_school_name_key";

alter table "public"."profiles" drop constraint "profiles_school_id_fkey";

alter table "public"."team_memberships" drop constraint "team_memberships_team_id_fkey";

alter table "public"."team_memberships" drop constraint "team_memberships_user_id_fkey";

alter table "public"."teams" drop constraint "teams_school_id_fkey";

drop function if exists "public"."is_member_of_team"(target_team_id uuid);

drop index if exists "public"."drills_created_by_user_id_idx";

drop index if exists "public"."drills_school_library_idx";

drop index if exists "public"."games_team_id_date_idx";

drop index if exists "public"."lineups_game_id_idx";

drop index if exists "public"."players_team_jersey_key";

drop index if exists "public"."practice_plans_team_date_key";

drop index if exists "public"."profiles_email_key";

drop index if exists "public"."profiles_school_id_idx";

drop index if exists "public"."team_memberships_team_id_idx";

drop index if exists "public"."team_memberships_user_id_idx";

drop index if exists "public"."team_memberships_user_team_key";

drop index if exists "public"."teams_school_id_idx";

drop index if exists "public"."teams_school_name_key";

drop index if exists "public"."schools_join_code_key";

alter table "public"."profiles" alter column "role" drop default;

alter table "public"."profiles" alter column role type "public"."user_role" using role::text::"public"."user_role";

alter table "public"."profiles" alter column "role" set default null;

alter table "public"."drills" add column "updated_at" timestamp with time zone not null default now();

alter table "public"."drills" alter column "created_at" set default now();

alter table "public"."drills" alter column "id" set default gen_random_uuid();

alter table "public"."games" drop column "date";

alter table "public"."games" add column "game_date" timestamp with time zone not null;

alter table "public"."games" alter column "created_at" set default now();

alter table "public"."games" alter column "id" set default gen_random_uuid();

alter table "public"."lineups" add column "updated_at" timestamp with time zone not null default now();

alter table "public"."lineups" alter column "created_at" set default now();

alter table "public"."lineups" alter column "id" set default gen_random_uuid();

alter table "public"."lineups" alter column "special_teams" set default '{"power_play_units": [], "penalty_kill_units": []}'::jsonb;

alter table "public"."players" alter column "created_at" set default now();

alter table "public"."players" alter column "id" set default gen_random_uuid();

alter table "public"."players" alter column "jersey_number" drop not null;

alter table "public"."practice_plans" drop column "date";

alter table "public"."practice_plans" add column "practice_date" timestamp with time zone not null;

alter table "public"."practice_plans" add column "updated_at" timestamp with time zone not null default now();

alter table "public"."practice_plans" alter column "created_at" set default now();

alter table "public"."practice_plans" alter column "id" set default gen_random_uuid();

alter table "public"."profiles" alter column "created_at" set default now();

alter table "public"."profiles" alter column "role" set default 'coach'::public.user_role;

alter table "public"."schools" alter column "created_at" set default now();

alter table "public"."schools" alter column "id" set default gen_random_uuid();

alter table "public"."team_memberships" alter column "created_at" set default now();

alter table "public"."team_memberships" alter column "id" set default gen_random_uuid();

alter table "public"."teams" alter column "created_at" set default now();

alter table "public"."teams" alter column "id" set default gen_random_uuid();

CREATE INDEX drills_published_idx ON public.drills USING btree (is_published);

CREATE INDEX games_game_date_idx ON public.games USING btree (game_date);

CREATE UNIQUE INDEX players_team_jersey_unique ON public.players USING btree (team_id, jersey_number) WHERE (jersey_number IS NOT NULL);

CREATE INDEX practice_plans_date_idx ON public.practice_plans USING btree (practice_date);

CREATE UNIQUE INDEX team_memberships_user_id_team_id_key ON public.team_memberships USING btree (user_id, team_id);

CREATE UNIQUE INDEX schools_join_code_key ON public.schools USING btree (join_code);

alter table "public"."drills" add constraint "drills_canvas_data_check" CHECK ((jsonb_typeof(canvas_data) = 'array'::text)) not valid;

alter table "public"."drills" validate constraint "drills_canvas_data_check";

alter table "public"."lineups" add constraint "lineups_defense_pairs_check" CHECK ((jsonb_typeof(defense_pairs) = 'array'::text)) not valid;

alter table "public"."lineups" validate constraint "lineups_defense_pairs_check";

alter table "public"."lineups" add constraint "lineups_goalies_check" CHECK ((jsonb_typeof(goalies) = 'array'::text)) not valid;

alter table "public"."lineups" validate constraint "lineups_goalies_check";

alter table "public"."lineups" add constraint "lineups_lines_check" CHECK ((jsonb_typeof(lines) = 'array'::text)) not valid;

alter table "public"."lineups" validate constraint "lineups_lines_check";

alter table "public"."lineups" add constraint "lineups_special_teams_check" CHECK ((jsonb_typeof(special_teams) = 'object'::text)) not valid;

alter table "public"."lineups" validate constraint "lineups_special_teams_check";

alter table "public"."practice_plans" add constraint "practice_plans_segments_check" CHECK ((jsonb_typeof(segments) = 'array'::text)) not valid;

alter table "public"."practice_plans" validate constraint "practice_plans_segments_check";

alter table "public"."schools" add constraint "personal_school_has_no_join_code" CHECK (((is_personal = false) OR (join_code IS NULL))) not valid;

alter table "public"."schools" validate constraint "personal_school_has_no_join_code";

alter table "public"."schools" add constraint "schools_join_code_key" UNIQUE using index "schools_join_code_key";

alter table "public"."team_memberships" add constraint "team_memberships_user_id_team_id_key" UNIQUE using index "team_memberships_user_id_team_id_key";

alter table "public"."profiles" add constraint "profiles_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) not valid;

alter table "public"."profiles" validate constraint "profiles_school_id_fkey";

alter table "public"."team_memberships" add constraint "team_memberships_team_id_fkey" FOREIGN KEY (team_id) REFERENCES public.teams(id) not valid;

alter table "public"."team_memberships" validate constraint "team_memberships_team_id_fkey";

alter table "public"."team_memberships" add constraint "team_memberships_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) not valid;

alter table "public"."team_memberships" validate constraint "team_memberships_user_id_fkey";

alter table "public"."teams" add constraint "teams_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) not valid;

alter table "public"."teams" validate constraint "teams_school_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.is_member_of_team(check_team_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select exists (
    select 1 from team_memberships
    where team_id = check_team_id and user_id = auth.uid()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_role()
 RETURNS public.user_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select role from profiles where id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_school_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select school_id from profiles where id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.is_my_school_active()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from schools
    where id = get_my_school_id()
      and status = 'active'
  );
$function$
;

grant delete on table "public"."drills" to "anon";

grant insert on table "public"."drills" to "anon";

grant select on table "public"."drills" to "anon";

grant update on table "public"."drills" to "anon";

grant delete on table "public"."drills" to "authenticated";

grant insert on table "public"."drills" to "authenticated";

grant select on table "public"."drills" to "authenticated";

grant update on table "public"."drills" to "authenticated";

grant delete on table "public"."drills" to "service_role";

grant insert on table "public"."drills" to "service_role";

grant select on table "public"."drills" to "service_role";

grant update on table "public"."drills" to "service_role";

grant delete on table "public"."games" to "anon";

grant insert on table "public"."games" to "anon";

grant select on table "public"."games" to "anon";

grant update on table "public"."games" to "anon";

grant delete on table "public"."games" to "authenticated";

grant insert on table "public"."games" to "authenticated";

grant select on table "public"."games" to "authenticated";

grant update on table "public"."games" to "authenticated";

grant delete on table "public"."games" to "service_role";

grant insert on table "public"."games" to "service_role";

grant select on table "public"."games" to "service_role";

grant update on table "public"."games" to "service_role";

grant delete on table "public"."lineups" to "anon";

grant insert on table "public"."lineups" to "anon";

grant select on table "public"."lineups" to "anon";

grant update on table "public"."lineups" to "anon";

grant delete on table "public"."lineups" to "authenticated";

grant insert on table "public"."lineups" to "authenticated";

grant select on table "public"."lineups" to "authenticated";

grant update on table "public"."lineups" to "authenticated";

grant delete on table "public"."lineups" to "service_role";

grant insert on table "public"."lineups" to "service_role";

grant select on table "public"."lineups" to "service_role";

grant update on table "public"."lineups" to "service_role";

grant delete on table "public"."players" to "anon";

grant insert on table "public"."players" to "anon";

grant select on table "public"."players" to "anon";

grant update on table "public"."players" to "anon";

grant delete on table "public"."players" to "authenticated";

grant insert on table "public"."players" to "authenticated";

grant select on table "public"."players" to "authenticated";

grant update on table "public"."players" to "authenticated";

grant delete on table "public"."players" to "service_role";

grant insert on table "public"."players" to "service_role";

grant select on table "public"."players" to "service_role";

grant update on table "public"."players" to "service_role";

grant delete on table "public"."practice_plans" to "anon";

grant insert on table "public"."practice_plans" to "anon";

grant select on table "public"."practice_plans" to "anon";

grant update on table "public"."practice_plans" to "anon";

grant delete on table "public"."practice_plans" to "authenticated";

grant insert on table "public"."practice_plans" to "authenticated";

grant select on table "public"."practice_plans" to "authenticated";

grant update on table "public"."practice_plans" to "authenticated";

grant delete on table "public"."practice_plans" to "service_role";

grant insert on table "public"."practice_plans" to "service_role";

grant select on table "public"."practice_plans" to "service_role";

grant update on table "public"."practice_plans" to "service_role";

grant delete on table "public"."profiles" to "anon";

grant insert on table "public"."profiles" to "anon";

grant select on table "public"."profiles" to "anon";

grant update on table "public"."profiles" to "anon";

grant delete on table "public"."profiles" to "authenticated";

grant insert on table "public"."profiles" to "authenticated";

grant select on table "public"."profiles" to "authenticated";

grant update on table "public"."profiles" to "authenticated";

grant delete on table "public"."profiles" to "service_role";

grant insert on table "public"."profiles" to "service_role";

grant select on table "public"."profiles" to "service_role";

grant update on table "public"."profiles" to "service_role";

grant delete on table "public"."schools" to "anon";

grant insert on table "public"."schools" to "anon";

grant select on table "public"."schools" to "anon";

grant update on table "public"."schools" to "anon";

grant delete on table "public"."schools" to "authenticated";

grant insert on table "public"."schools" to "authenticated";

grant select on table "public"."schools" to "authenticated";

grant update on table "public"."schools" to "authenticated";

grant delete on table "public"."schools" to "service_role";

grant insert on table "public"."schools" to "service_role";

grant select on table "public"."schools" to "service_role";

grant update on table "public"."schools" to "service_role";

grant delete on table "public"."team_memberships" to "anon";

grant insert on table "public"."team_memberships" to "anon";

grant select on table "public"."team_memberships" to "anon";

grant update on table "public"."team_memberships" to "anon";

grant delete on table "public"."team_memberships" to "authenticated";

grant insert on table "public"."team_memberships" to "authenticated";

grant select on table "public"."team_memberships" to "authenticated";

grant update on table "public"."team_memberships" to "authenticated";

grant delete on table "public"."team_memberships" to "service_role";

grant insert on table "public"."team_memberships" to "service_role";

grant select on table "public"."team_memberships" to "service_role";

grant update on table "public"."team_memberships" to "service_role";

grant delete on table "public"."teams" to "anon";

grant insert on table "public"."teams" to "anon";

grant select on table "public"."teams" to "anon";

grant update on table "public"."teams" to "anon";

grant delete on table "public"."teams" to "authenticated";

grant insert on table "public"."teams" to "authenticated";

grant select on table "public"."teams" to "authenticated";

grant update on table "public"."teams" to "authenticated";

grant delete on table "public"."teams" to "service_role";

grant insert on table "public"."teams" to "service_role";

grant select on table "public"."teams" to "service_role";

grant update on table "public"."teams" to "service_role";


  create policy "Coaches and directors manage accessible drills"
  on "public"."drills"
  as permissive
  for all
  to public
using ((public.is_my_school_active() AND (EXISTS ( SELECT 1
   FROM public.teams t
  WHERE ((t.id = drills.team_id) AND (((public.get_my_role() = 'coach'::public.user_role) AND public.is_member_of_team(t.id)) OR ((public.get_my_role() = 'director'::public.user_role) AND (t.school_id = public.get_my_school_id()))))))))
with check ((public.is_my_school_active() AND (EXISTS ( SELECT 1
   FROM public.teams t
  WHERE ((t.id = drills.team_id) AND (((public.get_my_role() = 'coach'::public.user_role) AND public.is_member_of_team(t.id) AND (drills.created_by_user_id = auth.uid())) OR ((public.get_my_role() = 'director'::public.user_role) AND (t.school_id = public.get_my_school_id()))))))));



  create policy "Super admins manage all drills"
  on "public"."drills"
  as permissive
  for all
  to public
using ((public.get_my_role() = 'super_admin'::public.user_role))
with check ((public.get_my_role() = 'super_admin'::public.user_role));



  create policy "Users see published drills in their school"
  on "public"."drills"
  as permissive
  for select
  to public
using ((public.is_my_school_active() AND (is_published = true) AND (EXISTS ( SELECT 1
   FROM public.teams t
  WHERE ((t.id = drills.team_id) AND (t.school_id = public.get_my_school_id()))))));



  create policy "Coaches manage games on assigned teams"
  on "public"."games"
  as permissive
  for all
  to public
using ((public.is_my_school_active() AND (EXISTS ( SELECT 1
   FROM public.teams t
  WHERE ((t.id = games.team_id) AND (((public.get_my_role() = 'coach'::public.user_role) AND public.is_member_of_team(t.id)) OR ((public.get_my_role() = 'director'::public.user_role) AND (t.school_id = public.get_my_school_id()))))))))
with check ((public.is_my_school_active() AND (EXISTS ( SELECT 1
   FROM public.teams t
  WHERE ((t.id = games.team_id) AND (((public.get_my_role() = 'coach'::public.user_role) AND public.is_member_of_team(t.id)) OR ((public.get_my_role() = 'director'::public.user_role) AND (t.school_id = public.get_my_school_id()))))))));



  create policy "Super admins manage all games"
  on "public"."games"
  as permissive
  for all
  to public
using ((public.get_my_role() = 'super_admin'::public.user_role))
with check ((public.get_my_role() = 'super_admin'::public.user_role));



  create policy "Coaches manage lineups for accessible games"
  on "public"."lineups"
  as permissive
  for all
  to public
using ((public.is_my_school_active() AND (EXISTS ( SELECT 1
   FROM (public.games g
     JOIN public.teams t ON ((t.id = g.team_id)))
  WHERE ((g.id = lineups.game_id) AND (((public.get_my_role() = 'coach'::public.user_role) AND public.is_member_of_team(t.id)) OR ((public.get_my_role() = 'director'::public.user_role) AND (t.school_id = public.get_my_school_id()))))))))
with check ((public.is_my_school_active() AND (EXISTS ( SELECT 1
   FROM (public.games g
     JOIN public.teams t ON ((t.id = g.team_id)))
  WHERE ((g.id = lineups.game_id) AND (((public.get_my_role() = 'coach'::public.user_role) AND public.is_member_of_team(t.id)) OR ((public.get_my_role() = 'director'::public.user_role) AND (t.school_id = public.get_my_school_id()))))))));



  create policy "Super admins manage all lineups"
  on "public"."lineups"
  as permissive
  for all
  to public
using ((public.get_my_role() = 'super_admin'::public.user_role))
with check ((public.get_my_role() = 'super_admin'::public.user_role));



  create policy "Coaches manage players on assigned teams"
  on "public"."players"
  as permissive
  for all
  to public
using ((public.is_my_school_active() AND (EXISTS ( SELECT 1
   FROM public.teams t
  WHERE ((t.id = players.team_id) AND (((public.get_my_role() = 'coach'::public.user_role) AND public.is_member_of_team(t.id)) OR ((public.get_my_role() = 'director'::public.user_role) AND (t.school_id = public.get_my_school_id()))))))))
with check ((public.is_my_school_active() AND (EXISTS ( SELECT 1
   FROM public.teams t
  WHERE ((t.id = players.team_id) AND (((public.get_my_role() = 'coach'::public.user_role) AND public.is_member_of_team(t.id)) OR ((public.get_my_role() = 'director'::public.user_role) AND (t.school_id = public.get_my_school_id()))))))));



  create policy "Super admins manage all players"
  on "public"."players"
  as permissive
  for all
  to public
using ((public.get_my_role() = 'super_admin'::public.user_role))
with check ((public.get_my_role() = 'super_admin'::public.user_role));



  create policy "Coaches manage practice plans on assigned teams"
  on "public"."practice_plans"
  as permissive
  for all
  to public
using ((public.is_my_school_active() AND (EXISTS ( SELECT 1
   FROM public.teams t
  WHERE ((t.id = practice_plans.team_id) AND (((public.get_my_role() = 'coach'::public.user_role) AND public.is_member_of_team(t.id)) OR ((public.get_my_role() = 'director'::public.user_role) AND (t.school_id = public.get_my_school_id()))))))))
with check ((public.is_my_school_active() AND (EXISTS ( SELECT 1
   FROM public.teams t
  WHERE ((t.id = practice_plans.team_id) AND (((public.get_my_role() = 'coach'::public.user_role) AND public.is_member_of_team(t.id)) OR ((public.get_my_role() = 'director'::public.user_role) AND (t.school_id = public.get_my_school_id()))))))));



  create policy "Super admins manage all practice plans"
  on "public"."practice_plans"
  as permissive
  for all
  to public
using ((public.get_my_role() = 'super_admin'::public.user_role))
with check ((public.get_my_role() = 'super_admin'::public.user_role));



  create policy "Directors see profiles in their school"
  on "public"."profiles"
  as permissive
  for select
  to public
using (((public.get_my_role() = 'director'::public.user_role) AND (school_id = public.get_my_school_id()) AND public.is_my_school_active()));



  create policy "Super admins see all profiles"
  on "public"."profiles"
  as permissive
  for select
  to public
using ((public.get_my_role() = 'super_admin'::public.user_role));



  create policy "Users see own profile"
  on "public"."profiles"
  as permissive
  for select
  to public
using ((id = auth.uid()));



  create policy "Users update own profile"
  on "public"."profiles"
  as permissive
  for update
  to public
using ((id = auth.uid()))
with check (((id = auth.uid()) AND (role = public.get_my_role()) AND (NOT (school_id IS DISTINCT FROM public.get_my_school_id()))));



  create policy "Super admins see all schools"
  on "public"."schools"
  as permissive
  for select
  to public
using ((public.get_my_role() = 'super_admin'::public.user_role));



  create policy "Super admins update schools"
  on "public"."schools"
  as permissive
  for update
  to public
using ((public.get_my_role() = 'super_admin'::public.user_role))
with check ((public.get_my_role() = 'super_admin'::public.user_role));



  create policy "Users see their own school"
  on "public"."schools"
  as permissive
  for select
  to public
using ((id = public.get_my_school_id()));



  create policy "Coaches see own memberships"
  on "public"."team_memberships"
  as permissive
  for select
  to public
using (((user_id = auth.uid()) AND public.is_my_school_active()));



  create policy "Directors create memberships in their school"
  on "public"."team_memberships"
  as permissive
  for insert
  to public
with check (((public.get_my_role() = 'director'::public.user_role) AND public.is_my_school_active() AND (team_id IN ( SELECT teams.id
   FROM public.teams
  WHERE (teams.school_id = public.get_my_school_id())))));



  create policy "Directors delete memberships in their school"
  on "public"."team_memberships"
  as permissive
  for delete
  to public
using (((public.get_my_role() = 'director'::public.user_role) AND public.is_my_school_active() AND (team_id IN ( SELECT teams.id
   FROM public.teams
  WHERE (teams.school_id = public.get_my_school_id())))));



  create policy "Directors see memberships in their school"
  on "public"."team_memberships"
  as permissive
  for select
  to public
using (((public.get_my_role() = 'director'::public.user_role) AND public.is_my_school_active() AND (team_id IN ( SELECT teams.id
   FROM public.teams
  WHERE (teams.school_id = public.get_my_school_id())))));



  create policy "Coaches see only their assigned teams"
  on "public"."teams"
  as permissive
  for select
  to public
using (((public.get_my_role() = 'coach'::public.user_role) AND public.is_my_school_active() AND public.is_member_of_team(id)));



  create policy "Directors create teams in their school"
  on "public"."teams"
  as permissive
  for insert
  to public
with check (((public.get_my_role() = 'director'::public.user_role) AND (school_id = public.get_my_school_id()) AND public.is_my_school_active()));



  create policy "Directors delete teams in their school"
  on "public"."teams"
  as permissive
  for delete
  to public
using (((public.get_my_role() = 'director'::public.user_role) AND (school_id = public.get_my_school_id()) AND public.is_my_school_active()));



  create policy "Directors see all teams in their school"
  on "public"."teams"
  as permissive
  for select
  to public
using (((public.get_my_role() = 'director'::public.user_role) AND (school_id = public.get_my_school_id()) AND public.is_my_school_active()));



  create policy "Directors update teams in their school"
  on "public"."teams"
  as permissive
  for update
  to public
using (((public.get_my_role() = 'director'::public.user_role) AND (school_id = public.get_my_school_id()) AND public.is_my_school_active()))
with check (((public.get_my_role() = 'director'::public.user_role) AND (school_id = public.get_my_school_id()) AND public.is_my_school_active()));



