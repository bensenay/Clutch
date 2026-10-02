alter table public.games
  add column if not exists game_plan_details jsonb;

comment on column public.games.game_plan_details is
  'Printable coaching-sheet details: dZonePlay, forecheck, oZonePlay, ppNotes, pkNotes, keyPoints (maximum four strings), and outPlayers.';

alter table public.games
  drop constraint if exists games_game_plan_details_shape_check;

alter table public.games
  add constraint games_game_plan_details_shape_check
  check (
    game_plan_details is null
    or (
      jsonb_typeof(game_plan_details) = 'object'
      and game_plan_details ?& array[
        'dZonePlay',
        'forecheck',
        'oZonePlay',
        'ppNotes',
        'pkNotes',
        'keyPoints',
        'outPlayers'
      ]
      and game_plan_details - array[
        'dZonePlay',
        'forecheck',
        'oZonePlay',
        'ppNotes',
        'pkNotes',
        'keyPoints',
        'outPlayers'
      ] = '{}'::jsonb
      and jsonb_typeof(game_plan_details -> 'dZonePlay') = 'string'
      and jsonb_typeof(game_plan_details -> 'forecheck') = 'string'
      and jsonb_typeof(game_plan_details -> 'oZonePlay') = 'string'
      and jsonb_typeof(game_plan_details -> 'ppNotes') = 'string'
      and jsonb_typeof(game_plan_details -> 'pkNotes') = 'string'
      and jsonb_typeof(game_plan_details -> 'keyPoints') = 'array'
      and jsonb_array_length(game_plan_details -> 'keyPoints') <= 4
      and not jsonb_path_exists(
        game_plan_details,
        '$.keyPoints[*] ? (@.type() != "string")'
      )
      and jsonb_typeof(game_plan_details -> 'outPlayers') = 'string'
    )
  );
