export type GamePlanDetails = {
  dZonePlay: string;
  forecheck: string;
  oZonePlay: string;
  ppNotes: string;
  pkNotes: string;
  keyPoints: string[];
  outPlayers: string;
};

export type GamePlanPlayer = {
  id: string;
  first_name: string;
  last_name: string;
  jersey_number: number | null;
};

export type GamePlanGame = {
  id: string;
  game_date: string;
  opponent_name: string;
  result: 'win' | 'loss' | 'tie' | null;
};

export type GamePlanLineup = {
  lines: unknown;
  defense_pairs: unknown;
  goalies: unknown;
  special_teams: unknown;
};

type Translate = (key: string, values?: Record<string, unknown>) => string;

type ForwardLine = {
  line_number: number;
  left_wing_player_id: string | null;
  center_player_id: string | null;
  right_wing_player_id: string | null;
};

type DefensePair = {
  pair_number: number;
  left_d_player_id: string | null;
  right_d_player_id: string | null;
};

type GoalieAssignment = {
  player_id: string;
  is_starter: boolean;
};

export const EMPTY_GAME_PLAN_DETAILS: GamePlanDetails = {
  dZonePlay: '',
  forecheck: '',
  oZonePlay: '',
  ppNotes: '',
  pkNotes: '',
  keyPoints: [],
  outPlayers: '',
};

export function normalizeGamePlanDetails(value: unknown): GamePlanDetails {
  if (!isRecord(value)) {
    return { ...EMPTY_GAME_PLAN_DETAILS };
  }

  return {
    dZonePlay: stringValue(value.dZonePlay),
    forecheck: stringValue(value.forecheck),
    oZonePlay: stringValue(value.oZonePlay),
    ppNotes: stringValue(value.ppNotes),
    pkNotes: stringValue(value.pkNotes),
    keyPoints: Array.isArray(value.keyPoints)
      ? value.keyPoints.filter((point): point is string => typeof point === 'string').slice(0, 4)
      : [],
    outPlayers: stringValue(value.outPlayers),
  };
}

export function calculateTeamRecord(games: GamePlanGame[]) {
  return games.reduce(
    (record, game) => {
      if (game.result === 'win') record.wins += 1;
      else if (game.result === 'loss') record.losses += 1;
      else if (game.result === 'tie') record.ties += 1;
      return record;
    },
    { wins: 0, losses: 0, ties: 0 },
  );
}

export function getGameNumber(games: GamePlanGame[], gameId: string) {
  const sortedGames = [...games].sort((left, right) => {
    const dateDifference =
      new Date(left.game_date).getTime() - new Date(right.game_date).getTime();
    return dateDifference || left.id.localeCompare(right.id);
  });
  const index = sortedGames.findIndex((game) => game.id === gameId);
  return index >= 0 ? index + 1 : 1;
}

export function buildGamePlanPrintHtml({
  details,
  game,
  gameNumber,
  lineup,
  locale,
  logoUrl,
  players,
  record,
  teamName,
  t,
}: {
  details: GamePlanDetails;
  game: GamePlanGame;
  gameNumber: number;
  lineup: GamePlanLineup | null;
  locale: string;
  logoUrl: string | null;
  players: GamePlanPlayer[];
  record: { wins: number; losses: number; ties: number };
  teamName: string;
  t: Translate;
}) {
  const playerById = new Map(players.map((player) => [player.id, player]));
  const lines = normalizeForwardLines(lineup?.lines, 4);
  const defensePairs = normalizeDefensePairs(lineup?.defense_pairs, 3);
  const goalies = normalizeGoalies(lineup?.goalies);
  const specialTeams = normalizeSpecialTeams(lineup?.special_teams);
  const hasSpecialTeams = [...specialTeams.powerPlay, ...specialTeams.penaltyKill]
    .some((unit) => lineHasPlayers(unit.line) || pairHasPlayers(unit.pair));
  const formattedDate = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(game.game_date));
  const keyPoints = details.keyPoints
    .map((point) => point.trim())
    .filter(Boolean)
    .slice(0, 4);

  return `<!doctype html>
<html lang="${escapeAttribute(locale)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    @page { size: Letter landscape; margin: 0; }
    * { -webkit-print-color-adjust: exact; box-sizing: border-box; print-color-adjust: exact; }
    html, body { margin: 0; padding: 0; }
    body { color: #101820; font-family: Arial, Helvetica, sans-serif; }
    .page { background: #fff; height: 8.5in; overflow: hidden; padding: .28in .34in; page-break-after: always; width: 11in; }
    .page:last-child { page-break-after: auto; }
    .team-banner { background: #101820; color: #fff; font-size: 25px; font-style: italic; font-weight: 900; letter-spacing: .5px; padding: 8px 14px; text-transform: uppercase; }
    .header-row { display: grid; grid-template-columns: 1fr auto; gap: 10px; margin-top: 8px; }
    .match-meta { display: grid; gap: 6px; grid-template-columns: 2.05in 1fr; }
    .meta-box, .record-box, .game-number-box { border: 2px solid #101820; font-size: 15px; font-weight: 800; min-height: .48in; padding: 8px 10px; }
    .record-group { display: flex; gap: 6px; }
    .record-box { min-width: 1.25in; text-align: center; }
    .game-number-box { min-width: 1.1in; text-align: center; }
    .sheet-title { font-size: 30px; font-style: italic; font-weight: 900; letter-spacing: 1px; margin: 6px 0 7px; text-transform: uppercase; }
    .main-grid { display: grid; gap: 10px; grid-template-columns: 2fr 1fr; }
    .lineup-panel { min-width: 0; }
    .lineup-table { border-collapse: collapse; table-layout: fixed; width: 100%; }
    .lineup-table th { background: #101820; color: white; font-size: 9px; letter-spacing: .7px; padding: 4px 5px; text-transform: uppercase; }
    .lineup-table td { border: 1px solid #101820; font-size: 10px; font-weight: 700; height: .28in; overflow: hidden; padding: 3px 5px; text-overflow: ellipsis; white-space: nowrap; }
    .lineup-table .section-cell { background: #e4e8eb; font-size: 9px; font-weight: 900; letter-spacing: .5px; text-align: center; text-transform: uppercase; width: .6in; }
    .goalie-cell { position: relative; }
    .goalie-cell.starter { background: #fff0c9; box-shadow: inset 0 0 0 2px #d9a24a; }
    .starter-tag { background: #d9a24a; border-radius: 2px; color: #101820; float: right; font-size: 7px; font-weight: 900; margin-left: 4px; padding: 2px 4px; text-transform: uppercase; }
    .out-box { border: 2px solid #101820; display: grid; grid-template-columns: .62in 1fr; margin-top: 6px; min-height: .42in; }
    .out-label { align-items: center; background: #c23b41; color: white; display: flex; font-size: 12px; font-weight: 900; justify-content: center; letter-spacing: .7px; }
    .out-copy { font-size: 10px; font-weight: 700; padding: 7px; white-space: pre-wrap; }
    .notes-panel { border: 2px solid #101820; display: grid; grid-template-rows: repeat(5, 1fr); height: 4.31in; }
    .note-section { min-height: 0; padding: 0 7px 4px; }
    .note-section + .note-section { border-top: 2px solid #101820; }
    .note-label { background: #101820; color: white; display: inline-block; font-size: 9px; font-weight: 900; letter-spacing: .8px; margin-left: -7px; padding: 3px 8px; text-transform: uppercase; }
    .ruled-copy { background-image: repeating-linear-gradient(to bottom, transparent 0, transparent 15px, #c7cdd1 16px); font-size: 10px; line-height: 16px; min-height: .52in; overflow: hidden; padding-top: 2px; white-space: pre-wrap; }
    .bottom-grid { display: grid; gap: 12px; grid-template-columns: 1fr 1.3in; margin-top: 8px; }
    .key-heading { font-size: 18px; font-style: italic; font-weight: 900; margin-bottom: 4px; text-transform: uppercase; }
    .key-list { display: grid; gap: 4px; grid-template-columns: 1fr 1fr; }
    .key-point { border: 1.5px solid #101820; font-size: 10px; font-weight: 700; min-height: .35in; padding: 5px 7px 5px 24px; position: relative; }
    .key-point::before { color: #c23b41; content: '\u279C'; font-size: 17px; font-weight: 900; left: 6px; position: absolute; top: 2px; }
    .logo-wrap { align-items: center; display: flex; height: 1in; justify-content: center; }
    .team-logo { max-height: .95in; max-width: 1.2in; object-fit: contain; }
    .special-title { border-bottom: 4px solid #c23b41; font-size: 27px; font-style: italic; font-weight: 900; margin: 10px 0 14px; padding-bottom: 5px; text-transform: uppercase; }
    .units-grid { display: grid; gap: .2in; grid-template-columns: 1fr 1fr; }
    .unit { border: 2px solid #101820; break-inside: avoid; }
    .unit-title { background: #101820; color: #fff; font-size: 18px; font-weight: 900; padding: 6px 10px; }
    .unit-row { display: grid; }
    .unit-row.defense { grid-template-columns: 1fr 1fr; }
    .unit-row.forwards { grid-template-columns: 1fr 1fr 1fr; }
    .unit-slot { border-right: 1px solid #101820; border-top: 1px solid #101820; min-height: .65in; padding: 7px; }
    .unit-slot:last-child { border-right: 0; }
    .slot-label { color: #596873; font-size: 8px; font-weight: 900; letter-spacing: .6px; text-transform: uppercase; }
    .slot-player { font-size: 12px; font-weight: 800; margin-top: 8px; }
  </style>
</head>
<body>
  <section class="page">
    <div class="team-banner">${escapeHtml(teamName)}</div>
    <div class="header-row">
      <div class="match-meta">
        <div class="meta-box">${escapeHtml(formattedDate)}</div>
        <div class="meta-box">${escapeHtml(t('gamePlan.pdf.vs'))} ${escapeHtml(game.opponent_name)}</div>
      </div>
      <div class="record-group">
        <div class="record-box">${escapeHtml(t('gamePlan.recordShort', record))}</div>
        <div class="game-number-box">${escapeHtml(t('gamePlan.gameNumberShort', { number: gameNumber }))}</div>
      </div>
    </div>
    <div class="sheet-title">${escapeHtml(t('gamePlan.pdf.gamePlan'))}</div>
    <div class="main-grid">
      <div class="lineup-panel">
        ${renderMainLineup({ defensePairs, goalies, lines, playerById, t })}
        <div class="out-box"><div class="out-label">${escapeHtml(t('gamePlan.pdf.out'))}</div><div class="out-copy">${escapeHtml(details.outPlayers)}</div></div>
      </div>
      <div class="notes-panel">
        ${renderNoteSection(t('gamePlan.pdf.dZonePlay'), details.dZonePlay)}
        ${renderNoteSection(t('gamePlan.pdf.forecheck'), details.forecheck)}
        ${renderNoteSection(t('gamePlan.pdf.oZonePlay'), details.oZonePlay)}
        ${renderNoteSection(t('gamePlan.pdf.pp'), details.ppNotes)}
        ${renderNoteSection(t('gamePlan.pdf.pk'), details.pkNotes)}
      </div>
    </div>
    <div class="bottom-grid">
      <div><div class="key-heading">${escapeHtml(t('gamePlan.pdf.keyPoints'))}</div><div class="key-list">${renderKeyPoints(keyPoints)}</div></div>
      <div class="logo-wrap">${logoUrl ? `<img class="team-logo" src="${escapeAttribute(logoUrl)}" />` : ''}</div>
    </div>
  </section>
  ${hasSpecialTeams ? renderSpecialTeamsPage({ playerById, specialTeams, t, teamName }) : ''}
</body>
</html>`;
}

function renderMainLineup({
  defensePairs,
  goalies,
  lines,
  playerById,
  t,
}: {
  defensePairs: DefensePair[];
  goalies: GoalieAssignment[];
  lines: ForwardLine[];
  playerById: Map<string, GamePlanPlayer>;
  t: Translate;
}) {
  const goalieSlots = [goalies[0], goalies[1]];
  const defenseRows = [...defensePairs, emptyDefensePair(defensePairs.length + 1)];
  const forwardRows = [...lines, emptyForwardLine(lines.length + 1)];

  return `<table class="lineup-table">
    <thead><tr><th></th><th>${escapeHtml(t('gamePlan.pdf.left'))}</th><th>${escapeHtml(t('gamePlan.pdf.center'))}</th><th>${escapeHtml(t('gamePlan.pdf.right'))}</th></tr></thead>
    <tbody>
      <tr><td class="section-cell">${escapeHtml(t('gamePlan.pdf.goalies'))}</td>${goalieSlots.map((goalie) => renderGoalieCell(goalie, playerById, t)).join('')}<td></td></tr>
      ${defenseRows.map((pair, index) => `<tr><td class="section-cell">${index < defensePairs.length ? escapeHtml(t('gamePlan.pdf.defensePair', { number: index + 1 })) : ''}</td><td>${formatPlayer(pair.left_d_player_id, playerById)}</td><td></td><td>${formatPlayer(pair.right_d_player_id, playerById)}</td></tr>`).join('')}
      ${forwardRows.map((line, index) => `<tr><td class="section-cell">${index < lines.length ? escapeHtml(t('gamePlan.pdf.forwardLine', { number: index + 1 })) : ''}</td><td>${formatPlayer(line.left_wing_player_id, playerById)}</td><td>${formatPlayer(line.center_player_id, playerById)}</td><td>${formatPlayer(line.right_wing_player_id, playerById)}</td></tr>`).join('')}
    </tbody>
  </table>`;
}

function renderGoalieCell(
  goalie: GoalieAssignment | undefined,
  playerById: Map<string, GamePlanPlayer>,
  t: Translate,
) {
  const className = goalie?.is_starter ? 'goalie-cell starter' : 'goalie-cell';
  const starter = goalie?.is_starter
    ? `<span class="starter-tag">${escapeHtml(t('gamePlan.pdf.starter'))}</span>`
    : '';
  return `<td class="${className}">${starter}${formatPlayer(goalie?.player_id ?? null, playerById)}</td>`;
}

function renderNoteSection(label: string, value: string) {
  return `<div class="note-section"><div class="note-label">${escapeHtml(label)}</div><div class="ruled-copy">${escapeHtml(value)}</div></div>`;
}

function renderKeyPoints(points: string[]) {
  const entries = [...points];
  while (entries.length < 4) entries.push('');
  return entries.map((point) => `<div class="key-point">${escapeHtml(point)}</div>`).join('');
}

function renderSpecialTeamsPage({
  playerById,
  specialTeams,
  t,
  teamName,
}: {
  playerById: Map<string, GamePlanPlayer>;
  specialTeams: { powerPlay: SpecialUnit[]; penaltyKill: SpecialUnit[] };
  t: Translate;
  teamName: string;
}) {
  return `<section class="page">
    <div class="team-banner">${escapeHtml(teamName)}</div>
    <div class="special-title">${escapeHtml(t('gamePlan.pdf.specialTeams'))}</div>
    <div class="units-grid">
      ${renderUnit('PP1', specialTeams.powerPlay[0], playerById, t)}
      ${renderUnit('PP2', specialTeams.powerPlay[1], playerById, t)}
      ${renderUnit('PK1', specialTeams.penaltyKill[0], playerById, t)}
      ${renderUnit('PK2', specialTeams.penaltyKill[1], playerById, t)}
    </div>
  </section>`;
}

type SpecialUnit = { line: ForwardLine; pair: DefensePair };

function renderUnit(
  title: string,
  unit: SpecialUnit | undefined,
  playerById: Map<string, GamePlanPlayer>,
  t: Translate,
) {
  const line = unit?.line ?? emptyForwardLine(1);
  const pair = unit?.pair ?? emptyDefensePair(1);
  const slot = (label: string, playerId: string | null) =>
    `<div class="unit-slot"><div class="slot-label">${escapeHtml(label)}</div><div class="slot-player">${formatPlayer(playerId, playerById)}</div></div>`;
  return `<div class="unit"><div class="unit-title">${title}</div><div class="unit-row defense">${slot(t('gamePlan.pdf.ld'), pair.left_d_player_id)}${slot(t('gamePlan.pdf.rd'), pair.right_d_player_id)}</div><div class="unit-row forwards">${slot(t('gamePlan.pdf.lw'), line.left_wing_player_id)}${slot(t('gamePlan.pdf.c'), line.center_player_id)}${slot(t('gamePlan.pdf.rw'), line.right_wing_player_id)}</div></div>`;
}

function normalizeSpecialTeams(value: unknown) {
  const specialTeams = isRecord(value) ? value : {};
  return {
    powerPlay: makeSpecialUnits(specialTeams.power_play_units),
    penaltyKill: makeSpecialUnits(specialTeams.penalty_kill_units),
  };
}

function makeSpecialUnits(value: unknown): SpecialUnit[] {
  const values = Array.isArray(value) ? value : [];
  const lines = normalizeForwardLines(values, 2);
  const pairs = normalizeDefensePairs(values, 2);
  return [0, 1].map((index) => ({ line: lines[index], pair: pairs[index] }));
}

function normalizeForwardLines(value: unknown, minimumCount: number): ForwardLine[] {
  const values = Array.isArray(value) ? value : [];
  const highest = values.reduce(
    (maximum, candidate) =>
      isRecord(candidate) && typeof candidate.line_number === 'number'
        ? Math.max(maximum, candidate.line_number)
        : maximum,
    minimumCount,
  );
  return Array.from({ length: highest }, (_, index) => {
    const lineNumber = index + 1;
    const match = values.find(
      (candidate) => isRecord(candidate) && candidate.line_number === lineNumber,
    );
    return isRecord(match)
      ? {
          line_number: lineNumber,
          left_wing_player_id: stringOrNull(match.left_wing_player_id),
          center_player_id: stringOrNull(match.center_player_id),
          right_wing_player_id: stringOrNull(match.right_wing_player_id),
        }
      : emptyForwardLine(lineNumber);
  });
}

function normalizeDefensePairs(value: unknown, minimumCount: number): DefensePair[] {
  const values = Array.isArray(value) ? value : [];
  const highest = values.reduce(
    (maximum, candidate) =>
      isRecord(candidate) && typeof candidate.pair_number === 'number'
        ? Math.max(maximum, candidate.pair_number)
        : maximum,
    minimumCount,
  );
  return Array.from({ length: highest }, (_, index) => {
    const pairNumber = index + 1;
    const match = values.find(
      (candidate) => isRecord(candidate) && candidate.pair_number === pairNumber,
    );
    return isRecord(match)
      ? {
          pair_number: pairNumber,
          left_d_player_id: stringOrNull(match.left_d_player_id),
          right_d_player_id: stringOrNull(match.right_d_player_id),
        }
      : emptyDefensePair(pairNumber);
  });
}

function normalizeGoalies(value: unknown): GoalieAssignment[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((goalie) => isRecord(goalie) && typeof goalie.player_id === 'string')
    .map((goalie) => ({
      player_id: goalie.player_id as string,
      is_starter: Boolean(goalie.is_starter),
    }))
    .sort((left, right) => Number(right.is_starter) - Number(left.is_starter));
}

function emptyForwardLine(lineNumber: number): ForwardLine {
  return {
    line_number: lineNumber,
    left_wing_player_id: null,
    center_player_id: null,
    right_wing_player_id: null,
  };
}

function emptyDefensePair(pairNumber: number): DefensePair {
  return {
    pair_number: pairNumber,
    left_d_player_id: null,
    right_d_player_id: null,
  };
}

function lineHasPlayers(line: ForwardLine) {
  return Boolean(
    line.left_wing_player_id ||
      line.center_player_id ||
      line.right_wing_player_id,
  );
}

function pairHasPlayers(pair: DefensePair) {
  return Boolean(pair.left_d_player_id || pair.right_d_player_id);
}

function formatPlayer(
  playerId: string | null,
  playerById: Map<string, GamePlanPlayer>,
) {
  if (!playerId) return '';
  const player = playerById.get(playerId);
  if (!player) return '';
  const number = player.jersey_number == null ? '--' : String(player.jersey_number);
  return escapeHtml(`${number} ${player.first_name} ${player.last_name}`);
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function stringOrNull(value: unknown) {
  return typeof value === 'string' ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}
