alter table public.games
  add column if not exists players_to_watch text,
  add column if not exists what_worked text,
  add column if not exists what_to_fix text;

comment on column public.games.players_to_watch is
  'Structured pre-game notes for opposing players and matchups to monitor.';
comment on column public.games.what_worked is
  'Structured post-game notes for successful systems, combinations, and habits.';
comment on column public.games.what_to_fix is
  'Structured post-game notes for the next coaching priorities.';
