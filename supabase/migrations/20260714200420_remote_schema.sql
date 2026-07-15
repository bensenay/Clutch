CREATE UNIQUE INDEX players_team_jersey_key ON public.players USING btree (team_id, jersey_number);

alter table "public"."players" add constraint "players_team_jersey_key" UNIQUE using index "players_team_jersey_key";


