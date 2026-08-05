import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { Button, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { AppScreen, appScreenStyles } from '../components/AppScreen';
import {
  FormField,
  authStyles,
} from '../components/AuthScreen';
import type { AuthenticatedStackParamList } from '../navigation/types';
import { useActiveTeam } from '../teams/ActiveTeamContext';
import { colors, goalRed, slateGrey } from '../theme/theme';
import type { Game } from './GameListScreen';
import type { Player } from './RosterScreen';

type Props = NativeStackScreenProps<AuthenticatedStackParamList, 'GameForm'>;

type GamePayload = {
  team_id: string;
  opponent_name: string;
  game_date: string;
  location: string | null;
  is_home: boolean;
  result: GameResult;
  opponent_scouting_notes: string | null;
  pre_game_plan: string | null;
  post_game_notes: string | null;
};

type GameResult = Game['result'];

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

type SpecialTeams = {
  power_play_units?: unknown;
  penalty_kill_units?: unknown;
};

type LineupExportRow = {
  lines: unknown;
  defense_pairs: unknown;
  goalies: unknown;
  special_teams: SpecialTeams | null;
};

const RESULT_OPTIONS: GameResult[] = [null, 'win', 'loss', 'tie'];

export function GameFormScreen({ navigation, route }: Props) {
  const { i18n, t } = useTranslation();
  const queryClient = useQueryClient();
  const { activeTeam, isReadOnlyTeam } = useActiveTeam();
  const gameId = route.params?.gameId;
  const isEditing = Boolean(gameId);
  const isReadOnly = isReadOnlyTeam || Boolean(route.params?.readOnly);
  const [opponentName, setOpponentName] = useState('');
  const [gameDate, setGameDate] = useState<Date | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() =>
    startOfMonth(new Date()),
  );
  const [location, setLocation] = useState('');
  const [isHome, setIsHome] = useState(true);
  const [result, setResult] = useState<GameResult>(null);
  const [opponentScoutingNotes, setOpponentScoutingNotes] = useState('');
  const [preGamePlan, setPreGamePlan] = useState('');
  const [postGameNotes, setPostGameNotes] = useState('');
  const [error, setError] = useState('');
  const [exportError, setExportError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const gameQuery = useQuery({
    queryKey: ['game', gameId],
    queryFn: async () => {
      if (!gameId) {
        throw new Error(t('gameForm.missingGameError'));
      }

      const { data, error: loadError } = await supabase
        .from('games')
        .select(
          'id, team_id, opponent_name, game_date, location, is_home, result, opponent_scouting_notes, pre_game_plan, post_game_notes, created_at',
        )
        .eq('id', gameId)
        .single();

      if (loadError) {
        throw loadError;
      }

      return data as Game;
    },
    enabled: isEditing,
  });

  useEffect(() => {
    const game = gameQuery.data;

    if (!game) {
      return;
    }

    setOpponentName(game.opponent_name);
    const parsedGameDate = parseStoredDate(game.game_date);
    setGameDate(parsedGameDate);
    setCalendarMonth(startOfMonth(parsedGameDate));
    setLocation(game.location ?? '');
    setIsHome(game.is_home);
    setResult(game.result);
    setOpponentScoutingNotes(game.opponent_scouting_notes ?? '');
    setPreGamePlan(game.pre_game_plan ?? '');
    setPostGameNotes(game.post_game_notes ?? '');
  }, [gameQuery.data]);

  function nullableText(value: string) {
    const trimmedValue = value.trim();
    return trimmedValue ? trimmedValue : null;
  }

  function buildPayload() {
    if (!activeTeam) {
      setError(t('games.noActiveTeamTitle'));
      return null;
    }

    if (!opponentName.trim() || !gameDate) {
      setError(t('gameForm.requiredError'));
      return null;
    }

    const payload: GamePayload = {
      team_id: activeTeam.id,
      opponent_name: opponentName.trim(),
      game_date: gameDate.toISOString(),
      location: nullableText(location),
      is_home: isHome,
      result,
      opponent_scouting_notes: nullableText(opponentScoutingNotes),
      pre_game_plan: nullableText(preGamePlan),
      post_game_notes: nullableText(postGameNotes),
    };

    return payload;
  }

  async function handleExport() {
    if (!gameId || !activeTeam || !gameDate) {
      return;
    }

    setExportError('');
    setIsExporting(true);

    try {
      const [{ data: lineupData, error: lineupError }, { data: playerData, error: playersError }] =
        await Promise.all([
          supabase
            .from('lineups')
            .select('lines, defense_pairs, goalies, special_teams')
            .eq('game_id', gameId)
            .maybeSingle(),
          supabase
            .from('players')
            .select(
              'id, team_id, first_name, last_name, jersey_number, natural_position, height, weight, status, status_note, parent_name, parent_phone, emergency_contact_name, emergency_contact_phone, medical_notes, created_at',
            )
            .eq('team_id', activeTeam.id),
        ]);

      if (lineupError) {
        throw lineupError;
      }

      if (playersError) {
        throw playersError;
      }

      const html = buildGamePlanExportHtml({
        t,
        locale: i18n.language,
        game: {
          opponentName: opponentName.trim(),
          gameDate,
          location: nullableText(location),
          isHome,
          opponentScoutingNotes: nullableText(opponentScoutingNotes),
          preGamePlan: nullableText(preGamePlan),
          postGameNotes: nullableText(postGameNotes),
        },
        lineup: lineupData as LineupExportRow | null,
        players: (playerData ?? []) as Player[],
      });
      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();

      if (!canShare) {
        setExportError(t('gameForm.exportUnavailable'));
        return;
      }

      await Sharing.shareAsync(uri, {
        UTI: 'com.adobe.pdf',
        mimeType: 'application/pdf',
      });
    } catch (exportErrorValue) {
      console.error('Unable to export game plan:', exportErrorValue);
      setExportError(t('gameForm.exportError'));
    } finally {
      setIsExporting(false);
    }
  }

  async function handleSave() {
    const payload = buildPayload();

    if (!payload) {
      return;
    }

    setError('');
    setIsSubmitting(true);

    const saveResult = isEditing && gameId
      ? await supabase.from('games').update(payload).eq('id', gameId)
      : await supabase.from('games').insert(payload).select('id').single();

    if (saveResult.error) {
      setError(t('gameForm.saveError'));
      setIsSubmitting(false);
      return;
    }

    await queryClient.invalidateQueries({
      queryKey: ['games', activeTeam?.id],
    });
    await queryClient.invalidateQueries({
      queryKey: ['team-dashboard-games', activeTeam?.id],
    });
    await queryClient.invalidateQueries({
      queryKey: ['game', gameId],
    });
    setIsSubmitting(false);

    if (!isEditing && saveResult.data?.id) {
      navigation.replace('LineupBuilder', { gameId: saveResult.data.id });
      return;
    }

    navigation.replace('MainTabs', { screen: 'GameDayTab' });
  }

  if (!activeTeam) {
    return (
      <AppScreen
        description={t('games.noActiveTeamDescription')}
        title={t('games.noActiveTeamTitle')}
      />
    );
  }

  return (
    <AppScreen
      description={t('gameForm.description', { teamName: activeTeam.name })}
      title={
        isReadOnly
          ? t('gameForm.readOnlyTitle')
          : isEditing
            ? t('gameForm.editTitle')
            : t('gameForm.addTitle')
      }
    >
      {gameQuery.isLoading ? (
        <Text style={appScreenStyles.note}>{t('common.loading')}</Text>
      ) : null}
      {gameQuery.error ? (
        <Text style={appScreenStyles.error}>{t('gameForm.loadError')}</Text>
      ) : null}
      <View style={appScreenStyles.card}>
        <FormField
          autoCapitalize="words"
          label={t('gameForm.opponentNameLabel')}
          onChangeText={setOpponentName}
          placeholder={t('gameForm.opponentNamePlaceholder')}
          editable={!isReadOnly}
          value={opponentName}
        />
        <GameDateTimePicker
          calendarMonth={calendarMonth}
          disabled={isReadOnly}
          gameDate={gameDate}
          locale={i18n.language}
          setCalendarMonth={setCalendarMonth}
          setGameDate={setGameDate}
        />
        <FormField
          autoCapitalize="words"
          label={t('gameForm.locationLabel')}
          onChangeText={setLocation}
          placeholder={t('gameForm.locationPlaceholder')}
          editable={!isReadOnly}
          value={location}
        />
        <FormField
          label={t('gameForm.opponentScoutingNotesLabel')}
          multiline
          onChangeText={setOpponentScoutingNotes}
          placeholder={t('gameForm.opponentScoutingNotesPlaceholder')}
          style={styles.multiline}
          editable={!isReadOnly}
          value={opponentScoutingNotes}
        />
        <FormField
          label={t('gameForm.preGamePlanLabel')}
          multiline
          onChangeText={setPreGamePlan}
          placeholder={t('gameForm.preGamePlanPlaceholder')}
          style={styles.multiline}
          editable={!isReadOnly}
          value={preGamePlan}
        />
        <FormField
          label={t('gameForm.postGameNotesLabel')}
          multiline
          onChangeText={setPostGameNotes}
          placeholder={t('gameForm.postGameNotesPlaceholder')}
          style={styles.multiline}
          editable={!isReadOnly}
          value={postGameNotes}
        />
        <View style={styles.selectorGroup}>
          <Text style={styles.selectorLabel}>
            {t('gameForm.homeAwayLabel')}
          </Text>
          <View style={styles.selectorOptions}>
            <Pressable
              accessibilityRole="button"
              disabled={isReadOnly}
              onPress={() => setIsHome(true)}
              style={[styles.selectorOption, isHome && styles.selected]}
            >
              <Text
                style={[
                  styles.selectorOptionText,
                  isHome && styles.selectedText,
                ]}
              >
                {t('gameForm.homeOption')}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isReadOnly}
              onPress={() => setIsHome(false)}
              style={[styles.selectorOption, !isHome && styles.selected]}
            >
              <Text
                style={[
                  styles.selectorOptionText,
                  !isHome && styles.selectedText,
                ]}
              >
                {t('gameForm.awayOption')}
              </Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.selectorGroup}>
          <Text style={styles.selectorLabel}>
            {t('gameForm.resultLabel')}
          </Text>
          <View style={styles.selectorOptions}>
            {RESULT_OPTIONS.map((option) => (
              <Pressable
                accessibilityRole="button"
                disabled={isReadOnly}
                key={option ?? 'not-played'}
                onPress={() => setResult(option)}
                style={[
                  styles.selectorOption,
                  result === option && styles.selected,
                ]}
              >
                <Text
                  style={[
                    styles.selectorOptionText,
                    result === option && styles.selectedText,
                  ]}
                >
                  {t(`gameForm.results.${option ?? 'notPlayed'}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        {error ? <Text style={authStyles.error}>{error}</Text> : null}
        {exportError ? (
          <Text style={authStyles.error}>{exportError}</Text>
        ) : null}
        {isReadOnly ? (
          <Text style={appScreenStyles.note}>{t('common.readOnlyNotice')}</Text>
        ) : (
          <Button
            color={goalRed}
            disabled={isSubmitting || gameQuery.isLoading}
            title={
              isSubmitting ? t('gameForm.saving') : t('gameForm.saveButton')
            }
            onPress={() => void handleSave()}
          />
        )}
        {gameId ? (
          <>
            <Button
              color={goalRed}
              disabled={isSubmitting || gameQuery.isLoading || isExporting}
              title={
                isReadOnly
                  ? t('gameForm.viewLineupButton')
                  : t('gameForm.lineupButton')
              }
              onPress={() =>
                navigation.navigate('LineupBuilder', {
                  gameId,
                  readOnly: isReadOnly,
                })
              }
            />
            <Button
              color={goalRed}
              disabled={isSubmitting || gameQuery.isLoading || isExporting}
              title={
                isExporting
                  ? t('gameForm.exporting')
                  : t('gameForm.exportButton')
              }
              onPress={() => void handleExport()}
            />
          </>
        ) : null}
      </View>
    </AppScreen>
  );
}

function GameDateTimePicker({
  calendarMonth,
  disabled = false,
  gameDate,
  locale,
  setCalendarMonth,
  setGameDate,
}: {
  calendarMonth: Date;
  disabled?: boolean;
  gameDate: Date | null;
  locale: string;
  setCalendarMonth: (date: Date) => void;
  setGameDate: (date: Date) => void;
}) {
  const { t } = useTranslation();
  const days = getCalendarDays(calendarMonth);
  const displayDate = gameDate ?? makeDefaultGameDate(new Date());
  const selectedDayKey = gameDate ? toDateKey(gameDate) : '';
  const selectedHour = displayDate.getHours();
  const selectedMinute = displayDate.getMinutes();

  function selectDay(day: Date) {
    const nextDate = new Date(day);
    nextDate.setHours(selectedHour, selectedMinute, 0, 0);
    setGameDate(nextDate);
  }

  function selectHour(hour: number) {
    const nextDate = new Date(displayDate);
    nextDate.setHours(hour, selectedMinute, 0, 0);
    setGameDate(nextDate);
    setCalendarMonth(startOfMonth(nextDate));
  }

  function selectMinute(minute: number) {
    const nextDate = new Date(displayDate);
    nextDate.setHours(selectedHour, minute, 0, 0);
    setGameDate(nextDate);
    setCalendarMonth(startOfMonth(nextDate));
  }

  return (
    <View style={styles.datePicker}>
      <Text style={styles.selectorLabel}>{t('gameForm.dateLabel')}</Text>
      <Text style={styles.dateSummary}>
        {gameDate
          ? formatSelectedDateTime(gameDate, locale)
          : t('gameForm.dateEmpty')}
      </Text>
      <View style={styles.monthHeader}>
        <Button
          color={goalRed}
          disabled={disabled}
          title={t('gameForm.previousMonthButton')}
          onPress={() =>
            setCalendarMonth(addMonths(calendarMonth, -1))
          }
        />
        <Text style={styles.monthTitle}>
          {formatMonth(calendarMonth, locale)}
        </Text>
        <Button
          color={goalRed}
          disabled={disabled}
          title={t('gameForm.nextMonthButton')}
          onPress={() => setCalendarMonth(addMonths(calendarMonth, 1))}
        />
      </View>
      <View style={styles.weekdayGrid}>
        {getWeekdayLabels(locale).map((label) => (
          <Text key={label} style={styles.weekdayLabel}>
            {label}
          </Text>
        ))}
      </View>
      <View style={styles.dayGrid}>
        {days.map((day, index) =>
          day ? (
            <Pressable
              accessibilityRole="button"
              disabled={disabled}
              key={toDateKey(day)}
              onPress={() => selectDay(day)}
              style={[
                styles.dayButton,
                selectedDayKey === toDateKey(day) && styles.selected,
              ]}
            >
              <Text
                style={[
                  styles.dayButtonText,
                  selectedDayKey === toDateKey(day) && styles.selectedText,
                ]}
              >
                {day.getDate()}
              </Text>
            </Pressable>
          ) : (
            <View key={`empty-${index}`} style={styles.dayButton} />
          ),
        )}
      </View>
      <View style={styles.timePicker}>
        <Text style={styles.selectorLabel}>{t('gameForm.timeLabel')}</Text>
        <View style={styles.timeSummaryRow}>
          <Button
            color={goalRed}
            disabled={disabled}
            title={t('gameForm.hourDownButton')}
            onPress={() => selectHour((selectedHour + 23) % 24)}
          />
          <Text style={styles.timeSummary}>
            {formatTime(displayDate, locale)}
          </Text>
          <Button
            color={goalRed}
            disabled={disabled}
            title={t('gameForm.hourUpButton')}
            onPress={() => selectHour((selectedHour + 1) % 24)}
          />
        </View>
        <View style={styles.selectorOptions}>
          {[0, 15, 30, 45].map((minute) => (
            <Pressable
              accessibilityRole="button"
              disabled={disabled}
              key={minute}
              onPress={() => selectMinute(minute)}
              style={[
                styles.selectorOption,
                selectedMinute === minute && styles.selected,
              ]}
            >
              <Text
                style={[
                  styles.selectorOptionText,
                  selectedMinute === minute && styles.selectedText,
                ]}
              >
                {t('gameForm.minuteOption', {
                  minute: String(minute).padStart(2, '0'),
                })}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

function buildGamePlanExportHtml({
  t,
  locale,
  game,
  lineup,
  players,
}: {
  t: (key: string, values?: Record<string, unknown>) => string;
  locale: string;
  game: {
    opponentName: string;
    gameDate: Date;
    location: string | null;
    isHome: boolean;
    opponentScoutingNotes: string | null;
    preGamePlan: string | null;
    postGameNotes: string | null;
  };
  lineup: LineupExportRow | null;
  players: Player[];
}) {
  const playerById = new Map(players.map((player) => [player.id, player]));
  const lineupHtml = lineup
    ? renderLineupExportSections({ lineup, playerById, t })
    : `<p class="muted">${escapeHtml(t('gameForm.exportNoLineup'))}</p>`;
  const location = game.location ?? t('common.notSet');

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body {
            color: ${colors.textPrimary};
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            line-height: 1.45;
            padding: 28px;
          }
          h1 { color: ${colors.textPrimary}; margin: 0 0 4px; }
          h2 {
            border-bottom: 2px solid ${goalRed};
            color: ${colors.textPrimary};
            font-size: 18px;
            margin: 24px 0 8px;
            padding-bottom: 4px;
          }
          h3 { color: ${colors.textPrimary}; font-size: 15px; margin: 14px 0 6px; }
          .meta { color: ${slateGrey}; margin: 0 0 4px; }
          .note {
            background: ${colors.cardPressed};
            border-left: 5px solid ${goalRed};
            border-radius: 8px;
            margin: 8px 0 12px;
            padding: 10px 12px;
            white-space: pre-wrap;
          }
          .muted { color: ${slateGrey}; }
          ul { margin: 0; padding-left: 18px; }
          li { margin: 4px 0; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(t('games.opponentTitle', { opponentName: game.opponentName }))}</h1>
        <p class="meta">${escapeHtml(formatSelectedDateTime(game.gameDate, locale))}</p>
        <p class="meta">${escapeHtml(game.isHome ? t('games.homeBadge') : t('games.awayBadge'))}</p>
        <p class="meta">${escapeHtml(t('gameForm.exportLocation', { location }))}</p>

        <h2>${escapeHtml(t('gameForm.exportLineupTitle'))}</h2>
        ${lineupHtml}

        <h2>${escapeHtml(t('gameForm.opponentScoutingNotesLabel'))}</h2>
        ${renderNote(game.opponentScoutingNotes, t)}

        <h2>${escapeHtml(t('gameForm.preGamePlanLabel'))}</h2>
        ${renderNote(game.preGamePlan, t)}

        <h2>${escapeHtml(t('gameForm.postGameNotesLabel'))}</h2>
        ${renderNote(game.postGameNotes, t)}
      </body>
    </html>
  `;
}

function renderLineupExportSections({
  lineup,
  playerById,
  t,
}: {
  lineup: LineupExportRow;
  playerById: Map<string, Player>;
  t: (key: string, values?: Record<string, unknown>) => string;
}) {
  const forwardLines = normalizeForwardLines(lineup.lines, 4).filter(
    lineHasPlayers,
  );
  const defensePairs = normalizeDefensePairs(lineup.defense_pairs, 3).filter(
    pairHasPlayers,
  );
  const goalies = normalizeGoalies(lineup.goalies).filter((goalie) =>
    playerById.has(goalie.player_id),
  );
  const powerPlayUnits = splitSpecialUnits(
    lineup.special_teams?.power_play_units,
  );
  const penaltyKillUnits = splitSpecialUnits(
    lineup.special_teams?.penalty_kill_units,
  );
  const sections = [
    renderForwardLines(forwardLines, playerById, t),
    renderDefensePairs(defensePairs, playerById, t),
    renderGoalies(goalies, playerById, t),
    renderSpecialTeams(
      t('lineup.powerPlayUnitsTitle'),
      powerPlayUnits.lines,
      powerPlayUnits.pairs,
      playerById,
      t,
    ),
    renderSpecialTeams(
      t('lineup.penaltyKillUnitsTitle'),
      penaltyKillUnits.lines,
      penaltyKillUnits.pairs,
      playerById,
      t,
    ),
  ].filter(Boolean);

  if (sections.length === 0) {
    return `<p class="muted">${escapeHtml(t('gameForm.exportNoLineup'))}</p>`;
  }

  return sections.join('');
}

function renderForwardLines(
  lines: ForwardLine[],
  playerById: Map<string, Player>,
  t: (key: string, values?: Record<string, unknown>) => string,
) {
  if (lines.length === 0) {
    return '';
  }

  return `
    <h3>${escapeHtml(t('lineup.forwardLinesTitle'))}</h3>
    <ul>
      ${lines
        .map(
          (line) =>
            `<li><strong>${escapeHtml(t('lineup.lineLabel', { number: line.line_number }))}</strong>: ${escapeHtml(formatForwardLine(line, playerById, t))}</li>`,
        )
        .join('')}
    </ul>
  `;
}

function renderDefensePairs(
  pairs: DefensePair[],
  playerById: Map<string, Player>,
  t: (key: string, values?: Record<string, unknown>) => string,
) {
  if (pairs.length === 0) {
    return '';
  }

  return `
    <h3>${escapeHtml(t('lineup.defensePairsTitle'))}</h3>
    <ul>
      ${pairs
        .map(
          (pair) =>
            `<li><strong>${escapeHtml(t('lineup.pairLabel', { number: pair.pair_number }))}</strong>: ${escapeHtml(formatDefensePair(pair, playerById, t))}</li>`,
        )
        .join('')}
    </ul>
  `;
}

function renderGoalies(
  goalies: GoalieAssignment[],
  playerById: Map<string, Player>,
  t: (key: string, values?: Record<string, unknown>) => string,
) {
  if (goalies.length === 0) {
    return '';
  }

  return `
    <h3>${escapeHtml(t('lineup.goaliesTitle'))}</h3>
    <ul>
      ${goalies
        .map((goalie) => {
          const starterLabel = goalie.is_starter
            ? ` (${t('lineup.starterGoalie')})`
            : '';
          return `<li>${escapeHtml(`${formatPlayer(goalie.player_id, playerById, t)}${starterLabel}`)}</li>`;
        })
        .join('')}
    </ul>
  `;
}

function renderSpecialTeams(
  title: string,
  lines: ForwardLine[],
  pairs: DefensePair[],
  playerById: Map<string, Player>,
  t: (key: string, values?: Record<string, unknown>) => string,
) {
  const unitNumbers = Array.from(
    new Set([
      ...lines.filter(lineHasPlayers).map((line) => line.line_number),
      ...pairs.filter(pairHasPlayers).map((pair) => pair.pair_number),
    ]),
  ).sort((left, right) => left - right);

  if (unitNumbers.length === 0) {
    return '';
  }

  return `
    <h3>${escapeHtml(title)}</h3>
    <ul>
      ${unitNumbers
        .map((unitNumber) => {
          const line = lines.find(
            (candidate) => candidate.line_number === unitNumber,
          );
          const pair = pairs.find(
            (candidate) => candidate.pair_number === unitNumber,
          );
          const pieces = [
            line ? formatForwardLine(line, playerById, t) : '',
            pair ? formatDefensePair(pair, playerById, t) : '',
          ].filter(Boolean);

          return `<li><strong>${escapeHtml(t('lineup.unitLabel', { number: unitNumber }))}</strong>: ${escapeHtml(pieces.join(' / '))}</li>`;
        })
        .join('')}
    </ul>
  `;
}

function formatForwardLine(
  line: ForwardLine,
  playerById: Map<string, Player>,
  t: (key: string, values?: Record<string, unknown>) => string,
) {
  return [
    `${t('lineup.slots.leftWing')}: ${formatPlayer(line.left_wing_player_id, playerById, t)}`,
    `${t('lineup.slots.center')}: ${formatPlayer(line.center_player_id, playerById, t)}`,
    `${t('lineup.slots.rightWing')}: ${formatPlayer(line.right_wing_player_id, playerById, t)}`,
  ].join(' / ');
}

function formatDefensePair(
  pair: DefensePair,
  playerById: Map<string, Player>,
  t: (key: string, values?: Record<string, unknown>) => string,
) {
  return [
    `${t('lineup.slots.leftDefense')}: ${formatPlayer(pair.left_d_player_id, playerById, t)}`,
    `${t('lineup.slots.rightDefense')}: ${formatPlayer(pair.right_d_player_id, playerById, t)}`,
  ].join(' / ');
}

function formatPlayer(
  playerId: string | null,
  playerById: Map<string, Player>,
  t: (key: string, values?: Record<string, unknown>) => string,
) {
  if (!playerId) {
    return t('gameForm.exportEmptySlot');
  }

  const player = playerById.get(playerId);

  if (!player) {
    return t('gameForm.exportUnknownPlayer');
  }

  const jerseyNumber = player.jersey_number
    ? `#${player.jersey_number} `
    : '';

  return `${jerseyNumber}${player.first_name} ${player.last_name}`;
}

function renderNote(
  value: string | null,
  t: (key: string, values?: Record<string, unknown>) => string,
) {
  if (!value) {
    return `<p class="muted">${escapeHtml(t('gameForm.exportNoNotes'))}</p>`;
  }

  return `<div class="note">${escapeHtml(value)}</div>`;
}

function normalizeForwardLines(value: unknown, count: number): ForwardLine[] {
  const incomingLines = Array.isArray(value) ? value : [];
  const defaults = Array.from({ length: count }, (_, index) => ({
    line_number: index + 1,
    left_wing_player_id: null,
    center_player_id: null,
    right_wing_player_id: null,
  }));

  return defaults.map((line) => {
    const match = incomingLines.find(
      (candidate) =>
        isRecord(candidate) && candidate.line_number === line.line_number,
    );

    if (!isRecord(match)) {
      return line;
    }

    return {
      line_number: line.line_number,
      left_wing_player_id: stringOrNull(match.left_wing_player_id),
      center_player_id: stringOrNull(match.center_player_id),
      right_wing_player_id: stringOrNull(match.right_wing_player_id),
    };
  });
}

function normalizeDefensePairs(value: unknown, count: number): DefensePair[] {
  const incomingPairs = Array.isArray(value) ? value : [];
  const defaults = Array.from({ length: count }, (_, index) => ({
    pair_number: index + 1,
    left_d_player_id: null,
    right_d_player_id: null,
  }));

  return defaults.map((pair) => {
    const match = incomingPairs.find(
      (candidate) =>
        isRecord(candidate) && candidate.pair_number === pair.pair_number,
    );

    if (!isRecord(match)) {
      return pair;
    }

    return {
      pair_number: pair.pair_number,
      left_d_player_id: stringOrNull(match.left_d_player_id),
      right_d_player_id: stringOrNull(match.right_d_player_id),
    };
  });
}

function normalizeGoalies(value: unknown): GoalieAssignment[] {
  const incomingGoalies = Array.isArray(value) ? value : [];

  return incomingGoalies
    .filter(
      (goalie) =>
        isRecord(goalie) && typeof goalie.player_id === 'string',
    )
    .map((goalie) => ({
      player_id: goalie.player_id as string,
      is_starter: Boolean(goalie.is_starter),
    }));
}

function splitSpecialUnits(value: unknown) {
  const units = Array.isArray(value) ? value : [];

  return {
    lines: normalizeForwardLines(
      units.filter(
        (unit) => isRecord(unit) && typeof unit.line_number === 'number',
      ),
      2,
    ),
    pairs: normalizeDefensePairs(
      units.filter(
        (unit) => isRecord(unit) && typeof unit.pair_number === 'number',
      ),
      2,
    ),
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

function stringOrNull(value: unknown) {
  return typeof value === 'string' ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function parseStoredDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? makeDefaultGameDate(new Date()) : date;
}

function makeDefaultGameDate(baseDate: Date) {
  const date = new Date(baseDate);
  date.setHours(19, 0, 0, 0);
  return date;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function getCalendarDays(month: Date) {
  const firstDay = startOfMonth(month);
  const daysInMonth = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const blanks = firstDay.getDay();
  const days: Array<Date | null> = Array.from({ length: blanks }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push(new Date(month.getFullYear(), month.getMonth(), day));
  }

  return days;
}

function getWeekdayLabels(locale: string) {
  const sunday = new Date(2026, 0, 4);

  return Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(
      new Date(2026, 0, sunday.getDate() + index),
    ),
  );
}

function formatMonth(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatSelectedDateTime(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(date);
}

function formatTime(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const styles = StyleSheet.create({
  datePicker: {
    gap: 10,
  },
  dateSummary: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  dayButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 42,
    width: '13%',
  },
  dayButtonText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  monthHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  monthTitle: {
    color: colors.textPrimary,
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  multiline: {
    minHeight: 110,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  selected: {
    backgroundColor: colors.cardPressed,
    borderColor: goalRed,
  },
  selectedText: {
    color: goalRed,
  },
  selectorGroup: {
    gap: 7,
  },
  selectorLabel: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  selectorOption: {
    backgroundColor: colors.fieldBackground,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  selectorOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectorOptionText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  timePicker: {
    gap: 8,
    marginTop: 4,
  },
  timeSummary: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  timeSummaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  weekdayGrid: {
    flexDirection: 'row',
    gap: 5,
  },
  weekdayLabel: {
    color: slateGrey,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase',
    width: '13%',
  },
});
