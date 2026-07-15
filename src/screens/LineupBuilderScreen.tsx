import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { AppScreen, appScreenStyles } from '../components/AppScreen';
import type { AuthenticatedStackParamList } from '../navigation/types';
import { useActiveTeam } from '../teams/ActiveTeamContext';
import { formatGameDate } from './GameListScreen';
import type { Player } from './RosterScreen';

type Props = NativeStackScreenProps<
  AuthenticatedStackParamList,
  'LineupBuilder'
>;

type LineupView = 'lines' | 'power_play' | 'penalty_kill';

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
  power_play_units: Array<ForwardLine | DefensePair>;
  penalty_kill_units: Array<ForwardLine | DefensePair>;
};

type LineupRow = {
  id: string;
  game_id: string;
  lines: ForwardLine[];
  defense_pairs: DefensePair[];
  goalies: GoalieAssignment[];
  special_teams: SpecialTeams;
  created_at: string;
  updated_at: string;
};

type SavedLineupRow = LineupRow & {
  games:
    | {
        opponent_name: string;
        game_date: string;
        is_home: boolean;
      }
    | {
        opponent_name: string;
        game_date: string;
        is_home: boolean;
      }[]
    | null;
};

const DEFAULT_TEAM_COLOR = '#b8442f';
const EMPTY_PLAYERS: Player[] = [];
const VIEW_ORDER: LineupView[] = ['lines', 'power_play', 'penalty_kill'];
const FOURTH_FORWARD_LINE_NUMBER = 4;

export function LineupBuilderScreen({ route }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { activeTeam } = useActiveTeam();
  const { gameId } = route.params;
  const [activeView, setActiveView] = useState<LineupView>('lines');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [removeSlotKey, setRemoveSlotKey] = useState<string | null>(null);
  const [lines, setLines] = useState(() => makeForwardLines(4));
  const [showFourthForwardLine, setShowFourthForwardLine] = useState(false);
  const [defensePairs, setDefensePairs] = useState(() => makeDefensePairs(3));
  const [goalies, setGoalies] = useState<GoalieAssignment[]>([]);
  const [powerPlayLines, setPowerPlayLines] = useState(() =>
    makeForwardLines(2),
  );
  const [powerPlayPairs, setPowerPlayPairs] = useState(() =>
    makeDefensePairs(2),
  );
  const [penaltyKillLines, setPenaltyKillLines] = useState(() =>
    makeForwardLines(2),
  );
  const [penaltyKillPairs, setPenaltyKillPairs] = useState(() =>
    makeDefensePairs(2),
  );
  const [savedLineupId, setSavedLineupId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const playersQuery = useQuery({
    queryKey: ['players', activeTeam?.id],
    queryFn: async () => {
      if (!activeTeam) {
        throw new Error(t('roster.noActiveTeamTitle'));
      }

      const { data, error: loadError } = await supabase
        .from('players')
        .select(
          'id, team_id, first_name, last_name, jersey_number, natural_position, height, weight, status, status_note, parent_name, parent_phone, emergency_contact_name, emergency_contact_phone, medical_notes, created_at',
        )
        .eq('team_id', activeTeam.id)
        .order('jersey_number', { ascending: true, nullsFirst: false })
        .order('last_name', { ascending: true })
        .order('first_name', { ascending: true });

      if (loadError) {
        throw loadError;
      }

      return (data ?? []) as Player[];
    },
    enabled: Boolean(activeTeam),
  });

  const lineupQuery = useQuery({
    queryKey: ['lineup', gameId],
    queryFn: async () => {
      const { data, error: loadError } = await supabase
        .from('lineups')
        .select(
          'id, game_id, lines, defense_pairs, goalies, special_teams, created_at, updated_at',
        )
        .eq('game_id', gameId)
        .maybeSingle();

      if (loadError) {
        throw loadError;
      }

      return data as LineupRow | null;
    },
  });

  const savedLineupsQuery = useQuery({
    queryKey: ['saved-lineups', activeTeam?.id, gameId],
    queryFn: async () => {
      if (!activeTeam) {
        throw new Error(t('roster.noActiveTeamTitle'));
      }

      const { data, error: loadError } = await supabase
        .from('lineups')
        .select(
          'id, game_id, lines, defense_pairs, goalies, special_teams, created_at, updated_at, games!inner ( opponent_name, game_date, is_home, team_id )',
        )
        .eq('games.team_id', activeTeam.id)
        .neq('game_id', gameId)
        .order('updated_at', { ascending: false });

      if (loadError) {
        throw loadError;
      }

      return (data ?? []) as SavedLineupRow[];
    },
    enabled: Boolean(activeTeam),
  });

  const players = playersQuery.data ?? EMPTY_PLAYERS;
  const playerById = useMemo(
    () => new Map(players.map((player) => [player.id, player])),
    [players],
  );
  const selectedPlayer = selectedPlayerId
    ? playerById.get(selectedPlayerId) ?? null
    : null;
  const currentPlacedPlayerIds = useMemo(
    () =>
      getPlacedPlayerIdsForView({
        view: activeView,
        lines,
        defensePairs,
        goalies,
        powerPlayLines,
        powerPlayPairs,
        penaltyKillLines,
        penaltyKillPairs,
      }),
    [
      activeView,
      defensePairs,
      goalies,
      lines,
      penaltyKillLines,
      penaltyKillPairs,
      powerPlayLines,
      powerPlayPairs,
    ],
  );
  const poolPlayers = players.filter(
    (player) =>
      player.natural_position !== 'G' && !currentPlacedPlayerIds.has(player.id),
  );
  const teamColor = activeTeam?.primary_color ?? DEFAULT_TEAM_COLOR;

  useEffect(() => {
    const lineup = lineupQuery.data;

    if (lineup) {
      setSavedLineupId(lineup.id);
      const normalizedLines = normalizeForwardLines(lineup.lines, 4);
      setLines(normalizedLines);
      setShowFourthForwardLine(
        lineHasPlayers(normalizedLines[FOURTH_FORWARD_LINE_NUMBER - 1]),
      );
      setDefensePairs(normalizeDefensePairs(lineup.defense_pairs, 3));

      const splitPowerPlay = splitSpecialUnits(
        lineup.special_teams?.power_play_units,
      );
      const splitPenaltyKill = splitSpecialUnits(
        lineup.special_teams?.penalty_kill_units,
      );

      setPowerPlayLines(normalizeForwardLines(splitPowerPlay.lines, 2));
      setPowerPlayPairs(normalizeDefensePairs(splitPowerPlay.pairs, 2));
      setPenaltyKillLines(
        normalizeForwardLines(splitPenaltyKill.lines, 2).map((line) => ({
          ...line,
          center_player_id: null,
        })),
      );
      setPenaltyKillPairs(normalizeDefensePairs(splitPenaltyKill.pairs, 2));
    }

    const savedGoalies = lineup?.goalies ?? [];
    const goaliePlayers = players.filter(
      (player) => player.natural_position === 'G',
    );

    setGoalies(
      goaliePlayers.map((player) => ({
        player_id: player.id,
        is_starter:
          savedGoalies.find((goalie) => goalie.player_id === player.id)
            ?.is_starter ?? false,
      })),
    );
  }, [lineupQuery.data, players]);

  function changeView(nextView: LineupView) {
    setActiveView(nextView);
    setSelectedPlayerId(null);
    setRemoveSlotKey(null);
  }

  function assignSelectedPlayer(assign: (playerId: string) => void) {
    if (!selectedPlayer) {
      return;
    }

    if (selectedPlayer.natural_position === 'G') {
      setError(t('lineup.goalieSkaterSlotError'));
      return;
    }

    const doAssign = () => {
      setError('');
      setSuccessMessage('');
      assign(selectedPlayer.id);
      setSelectedPlayerId(null);
      setRemoveSlotKey(null);
    };

    if (selectedPlayer.status !== 'active') {
      Alert.alert(
        t('lineup.statusWarningTitle'),
        t('lineup.statusWarningDescription', {
          playerName: `${selectedPlayer.first_name} ${selectedPlayer.last_name}`,
          status: t(`playerForm.statuses.${selectedPlayer.status}`),
        }),
        [
          {
            style: 'cancel',
            text: t('common.cancel'),
          },
          {
            text: t('lineup.placeAnywayButton'),
            onPress: doAssign,
          },
        ],
      );
      return;
    }

    doAssign();
  }

  function resetCurrentView() {
    const reset = () => {
      if (activeView === 'lines') {
        setLines(makeForwardLines(4));
        setShowFourthForwardLine(false);
        setDefensePairs(makeDefensePairs(3));
        setGoalies((currentGoalies) =>
          currentGoalies.map((goalie) => ({ ...goalie, is_starter: false })),
        );
      } else if (activeView === 'power_play') {
        setPowerPlayLines(makeForwardLines(2));
        setPowerPlayPairs(makeDefensePairs(2));
      } else {
        setPenaltyKillLines(makeForwardLines(2));
        setPenaltyKillPairs(makeDefensePairs(2));
      }

      setSelectedPlayerId(null);
      setRemoveSlotKey(null);
    };

    Alert.alert(
      t('lineup.resetConfirmTitle'),
      t('lineup.resetConfirmDescription'),
      [
        {
          style: 'cancel',
          text: t('common.cancel'),
        },
        {
          style: 'destructive',
          text: t('lineup.resetConfirmButton'),
          onPress: reset,
        },
      ],
    );
  }

  function applySavedLineup(savedLineup: SavedLineupRow) {
    const unavailablePlayers = getUnavailablePlayers(savedLineup, playerById);

    setError('');
    setSuccessMessage('');

    if (unavailablePlayers.length > 0) {
      setError(
        t('lineup.applyUnavailableError', {
          players: unavailablePlayers
            .map(
              (player) =>
                `${player.first_name} ${player.last_name} (${t(
                  `playerForm.statuses.${player.status}`,
                )})`,
            )
            .join(', '),
        }),
      );
      return;
    }

    const normalizedLines = normalizeForwardLines(savedLineup.lines, 4);
    const splitPowerPlay = splitSpecialUnits(
      savedLineup.special_teams?.power_play_units,
    );
    const splitPenaltyKill = splitSpecialUnits(
      savedLineup.special_teams?.penalty_kill_units,
    );
    const savedGoalies = savedLineup.goalies ?? [];
    const goaliePlayers = players.filter(
      (player) => player.natural_position === 'G',
    );

    setLines(normalizedLines);
    setShowFourthForwardLine(
      lineHasPlayers(normalizedLines[FOURTH_FORWARD_LINE_NUMBER - 1]),
    );
    setDefensePairs(normalizeDefensePairs(savedLineup.defense_pairs, 3));
    setPowerPlayLines(normalizeForwardLines(splitPowerPlay.lines, 2));
    setPowerPlayPairs(normalizeDefensePairs(splitPowerPlay.pairs, 2));
    setPenaltyKillLines(
      normalizeForwardLines(splitPenaltyKill.lines, 2).map((line) => ({
        ...line,
        center_player_id: null,
      })),
    );
    setPenaltyKillPairs(normalizeDefensePairs(splitPenaltyKill.pairs, 2));
    setGoalies(
      goaliePlayers.map((player) => ({
        player_id: player.id,
        is_starter:
          savedGoalies.find((goalie) => goalie.player_id === player.id)
            ?.is_starter ?? false,
      })),
    );
    setSelectedPlayerId(null);
    setRemoveSlotKey(null);
    setSuccessMessage(t('lineup.applySuccess'));
  }

  async function handleSave() {
    setError('');
    setSuccessMessage('');
    setIsSaving(true);

    const lineupPayload = {
      game_id: gameId,
      lines: showFourthForwardLine ? lines : lines.slice(0, 3),
      defense_pairs: defensePairs,
      goalies,
      special_teams: {
        power_play_units: [...powerPlayLines, ...powerPlayPairs],
        penalty_kill_units: [
          ...penaltyKillLines.map((line) => ({
            ...line,
            center_player_id: null,
          })),
          ...penaltyKillPairs,
        ],
      },
      updated_at: new Date().toISOString(),
    };

    const lineupId = savedLineupId ?? lineupQuery.data?.id ?? null;
    const saveResult = lineupId
      ? await supabase
          .from('lineups')
          .update(lineupPayload)
          .eq('id', lineupId)
      : await supabase.from('lineups').insert(lineupPayload).select('id').single();

    if (saveResult.error) {
      console.error('Unable to save lineup:', saveResult.error);
      setError(t('lineup.saveError'));
      setIsSaving(false);
      return;
    }

    if (!lineupId && saveResult.data?.id) {
      setSavedLineupId(saveResult.data.id);
    }

    await queryClient.invalidateQueries({ queryKey: ['lineup', gameId] });
    setSuccessMessage(t('lineup.saveSuccess'));
    setIsSaving(false);
  }

  if (!activeTeam) {
    return (
      <AppScreen
        description={t('roster.noActiveTeamDescription')}
        title={t('roster.noActiveTeamTitle')}
      />
    );
  }

  return (
    <AppScreen
      description={t('lineup.description', { teamName: activeTeam.name })}
      title={t('lineup.title')}
    >
      {playersQuery.isLoading || lineupQuery.isLoading ? (
        <Text style={appScreenStyles.note}>{t('common.loading')}</Text>
      ) : null}
      {playersQuery.error || lineupQuery.error ? (
        <Text style={appScreenStyles.error}>{t('lineup.loadError')}</Text>
      ) : null}
      <View style={styles.switcher}>
        {VIEW_ORDER.map((view) => (
          <Pressable
            accessibilityRole="button"
            key={view}
            onPress={() => changeView(view)}
            style={[
              styles.switcherOption,
              activeView === view && styles.switcherOptionActive,
            ]}
          >
            <Text
              style={[
                styles.switcherText,
                activeView === view && styles.switcherTextActive,
              ]}
            >
              {t(`lineup.views.${view}`)}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={appScreenStyles.card}>
        <Text style={appScreenStyles.cardTitle}>
          {t('lineup.playerPoolTitle')}
        </Text>
        <Text style={appScreenStyles.cardDescription}>
          {t('lineup.playerPoolDescription')}
        </Text>
        {poolPlayers.length === 0 ? (
          <Text style={appScreenStyles.note}>
            {t('lineup.emptyPlayerPool')}
          </Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.poolScroller}
          >
            <View style={styles.pool}>
              {poolPlayers.map((player) => (
                <PlayerChip
                  isSelected={selectedPlayerId === player.id}
                  key={player.id}
                  player={player}
                  teamColor={teamColor}
                  onPress={() => {
                    setSelectedPlayerId(player.id);
                    setRemoveSlotKey(null);
                  }}
                />
              ))}
            </View>
          </ScrollView>
        )}
      </View>
      <SavedLineupPicker
        isLoading={savedLineupsQuery.isLoading}
        lineups={savedLineupsQuery.data ?? []}
        loadError={Boolean(savedLineupsQuery.error)}
        onApply={applySavedLineup}
      />
      {activeView === 'lines' ? (
        <>
          {renderForwardLineSection({
            title: t('lineup.forwardLinesTitle'),
            lines: showFourthForwardLine ? lines : lines.slice(0, 3),
            showFourthForwardLine,
            playerById,
            removeSlotKey,
            setRemoveSlotKey,
            assignSelectedPlayer,
            updateLineSlot: (lineNumber, slot, playerId) =>
              setLines((currentLines) =>
                updateLineSlot(currentLines, lineNumber, slot, playerId),
              ),
            t,
            toggleFourthLine: () => {
              setSelectedPlayerId(null);
              setRemoveSlotKey(null);
              setShowFourthForwardLine((currentValue) => {
                if (currentValue) {
                  setLines((currentLines) =>
                    updateLineByNumber(
                      currentLines,
                      FOURTH_FORWARD_LINE_NUMBER,
                      makeForwardLines(4)[FOURTH_FORWARD_LINE_NUMBER - 1],
                    ),
                  );
                }

                return !currentValue;
              });
            },
          })}
          {renderDefensePairSection({
            title: t('lineup.defensePairsTitle'),
            pairs: defensePairs,
            playerById,
            removeSlotKey,
            setRemoveSlotKey,
            assignSelectedPlayer,
            updatePairSlot: (pairNumber, slot, playerId) =>
              setDefensePairs((currentPairs) =>
                updatePairSlot(currentPairs, pairNumber, slot, playerId),
              ),
            t,
          })}
          <GoalieSection
            goalies={goalies}
            playerById={playerById}
            onSetStarter={(playerId) =>
              setGoalies((currentGoalies) =>
                currentGoalies.map((goalie) => ({
                  ...goalie,
                  is_starter: goalie.player_id === playerId,
                })),
              )
            }
          />
        </>
      ) : null}
      {activeView === 'power_play' ? (
        <SpecialTeamsUnitsSection
          lines={powerPlayLines}
          pairs={powerPlayPairs}
          playerById={playerById}
          removeSlotKey={removeSlotKey}
          setRemoveSlotKey={setRemoveSlotKey}
          title={t('lineup.powerPlayUnitsTitle')}
          updateLineSlot={(lineNumber, slot, playerId) =>
            setPowerPlayLines((currentLines) =>
              updateLineSlot(currentLines, lineNumber, slot, playerId),
            )
          }
          updatePairSlot={(pairNumber, slot, playerId) =>
            setPowerPlayPairs((currentPairs) =>
              updatePairSlot(currentPairs, pairNumber, slot, playerId),
            )
          }
          assignSelectedPlayer={assignSelectedPlayer}
        />
      ) : null}
      {activeView === 'penalty_kill' ? (
        <SpecialTeamsUnitsSection
          isPenaltyKill
          lines={penaltyKillLines}
          pairs={penaltyKillPairs}
          playerById={playerById}
          removeSlotKey={removeSlotKey}
          setRemoveSlotKey={setRemoveSlotKey}
          title={t('lineup.penaltyKillUnitsTitle')}
          updateLineSlot={(lineNumber, slot, playerId) =>
            setPenaltyKillLines((currentLines) =>
              updateLineSlot(currentLines, lineNumber, slot, playerId),
            )
          }
          updatePairSlot={(pairNumber, slot, playerId) =>
            setPenaltyKillPairs((currentPairs) =>
              updatePairSlot(currentPairs, pairNumber, slot, playerId),
            )
          }
          assignSelectedPlayer={assignSelectedPlayer}
        />
      ) : null}
      {error ? <Text style={appScreenStyles.error}>{error}</Text> : null}
      {successMessage ? (
        <Text style={styles.successMessage}>{successMessage}</Text>
      ) : null}
      <Button title={t('lineup.resetButton')} onPress={resetCurrentView} />
      <Button
        disabled={isSaving}
        title={isSaving ? t('lineup.saving') : t('lineup.saveButton')}
        onPress={() => void handleSave()}
      />
    </AppScreen>
  );
}

function PlayerChip({
  player,
  teamColor,
  isSelected,
  onPress,
}: {
  player: Player;
  teamColor: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.playerChip,
        { backgroundColor: teamColor },
        isSelected && styles.selectedPlayerChip,
      ]}
    >
      <Text style={styles.playerChipNumber}>
        {player.jersey_number ?? '--'}
      </Text>
      <Text style={styles.playerChipName}>{player.last_name}</Text>
    </Pressable>
  );
}

function SavedLineupPicker({
  lineups,
  isLoading,
  loadError,
  onApply,
}: {
  lineups: SavedLineupRow[];
  isLoading: boolean;
  loadError: boolean;
  onApply: (lineup: SavedLineupRow) => void;
}) {
  const { t } = useTranslation();

  return (
    <View style={appScreenStyles.card}>
      <Text style={appScreenStyles.cardTitle}>
        {t('lineup.applySavedTitle')}
      </Text>
      <Text style={appScreenStyles.cardDescription}>
        {t('lineup.applySavedDescription')}
      </Text>
      {isLoading ? (
        <Text style={appScreenStyles.note}>{t('common.loading')}</Text>
      ) : null}
      {loadError ? (
        <Text style={appScreenStyles.error}>
          {t('lineup.applySavedLoadError')}
        </Text>
      ) : null}
      {!isLoading && lineups.length === 0 ? (
        <Text style={appScreenStyles.note}>
          {t('lineup.applySavedEmpty')}
        </Text>
      ) : null}
      {lineups.map((lineup) => {
        const game = Array.isArray(lineup.games)
          ? lineup.games[0]
          : lineup.games;

        return (
          <View key={lineup.id} style={styles.savedLineupRow}>
            <View style={styles.savedLineupDetails}>
              <Text style={styles.savedLineupTitle}>
                {game?.opponent_name
                  ? t('games.opponentTitle', {
                      opponentName: game.opponent_name,
                    })
                  : t('lineup.savedLineupFallbackTitle')}
              </Text>
              {game?.game_date ? (
                <Text style={appScreenStyles.meta}>
                  {formatGameDate(game.game_date)}
                </Text>
              ) : null}
            </View>
            <Button
              title={t('lineup.applySavedButton')}
              onPress={() => onApply(lineup)}
            />
          </View>
        );
      })}
    </View>
  );
}

function SlotView({
  label,
  slotKey,
  playerId,
  playerById,
  removeSlotKey,
  setRemoveSlotKey,
  onPlace,
  onRemove,
}: {
  label: string;
  slotKey: string;
  playerId: string | null;
  playerById: Map<string, Player>;
  removeSlotKey: string | null;
  setRemoveSlotKey: (slotKey: string | null) => void;
  onPlace: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const player = playerId ? playerById.get(playerId) : null;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        if (player) {
          setRemoveSlotKey(removeSlotKey === slotKey ? null : slotKey);
          return;
        }

        onPlace();
      }}
      style={[styles.slot, player && styles.filledSlot]}
    >
      <Text style={styles.slotLabel}>{label}</Text>
      <Text style={styles.slotValue}>
        {player
          ? `${player.jersey_number ?? '--'} ${player.first_name} ${
              player.last_name
            }`
          : t('lineup.emptySlot')}
      </Text>
      {player && removeSlotKey === slotKey ? (
        <Button title={t('lineup.removeSlotButton')} onPress={onRemove} />
      ) : null}
    </Pressable>
  );
}

function GoalieSection({
  goalies,
  playerById,
  onSetStarter,
}: {
  goalies: GoalieAssignment[];
  playerById: Map<string, Player>;
  onSetStarter: (playerId: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <View style={appScreenStyles.card}>
      <Text style={appScreenStyles.cardTitle}>
        {t('lineup.goaliesTitle')}
      </Text>
      {goalies.length === 0 ? (
        <Text style={appScreenStyles.note}>{t('lineup.noGoalies')}</Text>
      ) : null}
      {goalies.map((goalie) => {
        const player = playerById.get(goalie.player_id);

        if (!player) {
          return null;
        }

        return (
          <Pressable
            accessibilityRole="button"
            key={goalie.player_id}
            onPress={() => onSetStarter(goalie.player_id)}
            style={[styles.goalieRow, goalie.is_starter && styles.starterRow]}
          >
            <Text style={styles.goalieName}>
              {player.jersey_number ?? '--'} {player.first_name}{' '}
              {player.last_name}
            </Text>
            <Text style={styles.starterText}>
              {goalie.is_starter
                ? t('lineup.starterGoalie')
                : t('lineup.markStarter')}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function renderForwardLineSection({
  title,
  lines,
  showFourthForwardLine,
  playerById,
  removeSlotKey,
  setRemoveSlotKey,
  assignSelectedPlayer,
  updateLineSlot,
  t,
  toggleFourthLine,
}: {
  title: string;
  lines: ForwardLine[];
  showFourthForwardLine: boolean;
  playerById: Map<string, Player>;
  removeSlotKey: string | null;
  setRemoveSlotKey: (slotKey: string | null) => void;
  assignSelectedPlayer: (assign: (playerId: string) => void) => void;
  updateLineSlot: (
    lineNumber: number,
    slot: keyof Pick<
      ForwardLine,
      'left_wing_player_id' | 'center_player_id' | 'right_wing_player_id'
    >,
    playerId: string | null,
  ) => void;
  t: (key: string, values?: Record<string, unknown>) => string;
  toggleFourthLine: () => void;
}) {
  return (
    <View style={[appScreenStyles.card, styles.compactCard]}>
      <Text style={appScreenStyles.cardTitle}>{title}</Text>
      {lines.map((line) => (
        <View key={line.line_number} style={styles.unit}>
          <Text style={styles.unitTitle}>
            {t('lineup.lineLabel', { number: line.line_number })}
          </Text>
          <View style={styles.slotGrid}>
            <SlotView
              label={t('lineup.slots.leftWing')}
              playerById={playerById}
              playerId={line.left_wing_player_id}
              removeSlotKey={removeSlotKey}
              setRemoveSlotKey={setRemoveSlotKey}
              slotKey={`line-${line.line_number}-lw`}
              onPlace={() =>
                assignSelectedPlayer((playerId) =>
                  updateLineSlot(
                    line.line_number,
                    'left_wing_player_id',
                    playerId,
                  ),
                )
              }
              onRemove={() =>
                updateLineSlot(line.line_number, 'left_wing_player_id', null)
              }
            />
            <SlotView
              label={t('lineup.slots.center')}
              playerById={playerById}
              playerId={line.center_player_id}
              removeSlotKey={removeSlotKey}
              setRemoveSlotKey={setRemoveSlotKey}
              slotKey={`line-${line.line_number}-c`}
              onPlace={() =>
                assignSelectedPlayer((playerId) =>
                  updateLineSlot(line.line_number, 'center_player_id', playerId),
                )
              }
              onRemove={() =>
                updateLineSlot(line.line_number, 'center_player_id', null)
              }
            />
            <SlotView
              label={t('lineup.slots.rightWing')}
              playerById={playerById}
              playerId={line.right_wing_player_id}
              removeSlotKey={removeSlotKey}
              setRemoveSlotKey={setRemoveSlotKey}
              slotKey={`line-${line.line_number}-rw`}
              onPlace={() =>
                assignSelectedPlayer((playerId) =>
                  updateLineSlot(
                    line.line_number,
                    'right_wing_player_id',
                    playerId,
                  ),
                )
              }
              onRemove={() =>
                updateLineSlot(line.line_number, 'right_wing_player_id', null)
              }
            />
          </View>
        </View>
      ))}
      <Button
        title={
          showFourthForwardLine
            ? t('lineup.removeFourthLineButton')
            : t('lineup.addFourthLineButton')
        }
        onPress={toggleFourthLine}
      />
    </View>
  );
}

function SpecialTeamsUnitsSection({
  title,
  lines,
  pairs,
  playerById,
  removeSlotKey,
  setRemoveSlotKey,
  assignSelectedPlayer,
  updateLineSlot,
  updatePairSlot,
  isPenaltyKill = false,
}: {
  title: string;
  lines: ForwardLine[];
  pairs: DefensePair[];
  playerById: Map<string, Player>;
  removeSlotKey: string | null;
  setRemoveSlotKey: (slotKey: string | null) => void;
  assignSelectedPlayer: (assign: (playerId: string) => void) => void;
  updateLineSlot: (
    lineNumber: number,
    slot: keyof Pick<
      ForwardLine,
      'left_wing_player_id' | 'center_player_id' | 'right_wing_player_id'
    >,
    playerId: string | null,
  ) => void;
  updatePairSlot: (
    pairNumber: number,
    slot: keyof Pick<DefensePair, 'left_d_player_id' | 'right_d_player_id'>,
    playerId: string | null,
  ) => void;
  isPenaltyKill?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <View style={appScreenStyles.card}>
      <Text style={appScreenStyles.cardTitle}>{title}</Text>
      {lines.map((line) => {
        const pair = pairs.find(
          (candidatePair) => candidatePair.pair_number === line.line_number,
        );

        return (
          <View key={line.line_number} style={styles.specialTeamUnit}>
            <Text style={styles.unitTitle}>
              {t('lineup.unitLabel', { number: line.line_number })}
            </Text>
            <View style={styles.slotGrid}>
              <SlotView
                label={
                  isPenaltyKill
                    ? t('lineup.slots.forwardOne')
                    : t('lineup.slots.leftWing')
                }
                playerById={playerById}
                playerId={line.left_wing_player_id}
                removeSlotKey={removeSlotKey}
                setRemoveSlotKey={setRemoveSlotKey}
                slotKey={`special-line-${line.line_number}-lw`}
                onPlace={() =>
                  assignSelectedPlayer((playerId) =>
                    updateLineSlot(
                      line.line_number,
                      'left_wing_player_id',
                      playerId,
                    ),
                  )
                }
                onRemove={() =>
                  updateLineSlot(line.line_number, 'left_wing_player_id', null)
                }
              />
              {isPenaltyKill ? null : (
                <SlotView
                  label={t('lineup.slots.center')}
                  playerById={playerById}
                  playerId={line.center_player_id}
                  removeSlotKey={removeSlotKey}
                  setRemoveSlotKey={setRemoveSlotKey}
                  slotKey={`special-line-${line.line_number}-c`}
                  onPlace={() =>
                    assignSelectedPlayer((playerId) =>
                      updateLineSlot(
                        line.line_number,
                        'center_player_id',
                        playerId,
                      ),
                    )
                  }
                  onRemove={() =>
                    updateLineSlot(line.line_number, 'center_player_id', null)
                  }
                />
              )}
              <SlotView
                label={
                  isPenaltyKill
                    ? t('lineup.slots.forwardTwo')
                    : t('lineup.slots.rightWing')
                }
                playerById={playerById}
                playerId={line.right_wing_player_id}
                removeSlotKey={removeSlotKey}
                setRemoveSlotKey={setRemoveSlotKey}
                slotKey={`special-line-${line.line_number}-rw`}
                onPlace={() =>
                  assignSelectedPlayer((playerId) =>
                    updateLineSlot(
                      line.line_number,
                      'right_wing_player_id',
                      playerId,
                    ),
                  )
                }
                onRemove={() =>
                  updateLineSlot(line.line_number, 'right_wing_player_id', null)
                }
              />
            </View>
            <View style={styles.slotGrid}>
              <SlotView
                label={t('lineup.slots.leftDefense')}
                playerById={playerById}
                playerId={pair?.left_d_player_id ?? null}
                removeSlotKey={removeSlotKey}
                setRemoveSlotKey={setRemoveSlotKey}
                slotKey={`special-pair-${line.line_number}-ld`}
                onPlace={() =>
                  assignSelectedPlayer((playerId) =>
                    updatePairSlot(
                      line.line_number,
                      'left_d_player_id',
                      playerId,
                    ),
                  )
                }
                onRemove={() =>
                  updatePairSlot(line.line_number, 'left_d_player_id', null)
                }
              />
              <SlotView
                label={t('lineup.slots.rightDefense')}
                playerById={playerById}
                playerId={pair?.right_d_player_id ?? null}
                removeSlotKey={removeSlotKey}
                setRemoveSlotKey={setRemoveSlotKey}
                slotKey={`special-pair-${line.line_number}-rd`}
                onPlace={() =>
                  assignSelectedPlayer((playerId) =>
                    updatePairSlot(
                      line.line_number,
                      'right_d_player_id',
                      playerId,
                    ),
                  )
                }
                onRemove={() =>
                  updatePairSlot(line.line_number, 'right_d_player_id', null)
                }
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function renderDefensePairSection({
  title,
  pairs,
  playerById,
  removeSlotKey,
  setRemoveSlotKey,
  assignSelectedPlayer,
  updatePairSlot,
  t,
}: {
  title: string;
  pairs: DefensePair[];
  playerById: Map<string, Player>;
  removeSlotKey: string | null;
  setRemoveSlotKey: (slotKey: string | null) => void;
  assignSelectedPlayer: (assign: (playerId: string) => void) => void;
  updatePairSlot: (
    pairNumber: number,
    slot: keyof Pick<DefensePair, 'left_d_player_id' | 'right_d_player_id'>,
    playerId: string | null,
  ) => void;
  t: (key: string, values?: Record<string, unknown>) => string;
}) {
  return (
    <View style={appScreenStyles.card}>
      <Text style={appScreenStyles.cardTitle}>{title}</Text>
      {pairs.map((pair) => (
        <View key={pair.pair_number} style={styles.unit}>
          <Text style={styles.unitTitle}>
            {t('lineup.pairLabel', { number: pair.pair_number })}
          </Text>
          <View style={styles.slotGrid}>
            <SlotView
              label={t('lineup.slots.leftDefense')}
              playerById={playerById}
              playerId={pair.left_d_player_id}
              removeSlotKey={removeSlotKey}
              setRemoveSlotKey={setRemoveSlotKey}
              slotKey={`pair-${pair.pair_number}-ld`}
              onPlace={() =>
                assignSelectedPlayer((playerId) =>
                  updatePairSlot(pair.pair_number, 'left_d_player_id', playerId),
                )
              }
              onRemove={() =>
                updatePairSlot(pair.pair_number, 'left_d_player_id', null)
              }
            />
            <SlotView
              label={t('lineup.slots.rightDefense')}
              playerById={playerById}
              playerId={pair.right_d_player_id}
              removeSlotKey={removeSlotKey}
              setRemoveSlotKey={setRemoveSlotKey}
              slotKey={`pair-${pair.pair_number}-rd`}
              onPlace={() =>
                assignSelectedPlayer((playerId) =>
                  updatePairSlot(
                    pair.pair_number,
                    'right_d_player_id',
                    playerId,
                  ),
                )
              }
              onRemove={() =>
                updatePairSlot(pair.pair_number, 'right_d_player_id', null)
              }
            />
          </View>
        </View>
      ))}
    </View>
  );
}

function makeForwardLines(count: number): ForwardLine[] {
  return Array.from({ length: count }, (_, index) => ({
    line_number: index + 1,
    left_wing_player_id: null,
    center_player_id: null,
    right_wing_player_id: null,
  }));
}

function makeDefensePairs(count: number): DefensePair[] {
  return Array.from({ length: count }, (_, index) => ({
    pair_number: index + 1,
    left_d_player_id: null,
    right_d_player_id: null,
  }));
}

function normalizeForwardLines(
  value: unknown,
  count: number,
): ForwardLine[] {
  const incomingLines = Array.isArray(value) ? value : [];
  const defaults = makeForwardLines(count);

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

function normalizeDefensePairs(
  value: unknown,
  count: number,
): DefensePair[] {
  const incomingPairs = Array.isArray(value) ? value : [];
  const defaults = makeDefensePairs(count);

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

function splitSpecialUnits(value: unknown) {
  const units = Array.isArray(value) ? value : [];

  return {
    lines: units.filter(
      (unit) => isRecord(unit) && typeof unit.line_number === 'number',
    ),
    pairs: units.filter(
      (unit) => isRecord(unit) && typeof unit.pair_number === 'number',
    ),
  };
}

function lineHasPlayers(line?: ForwardLine) {
  return Boolean(
    line?.left_wing_player_id ||
      line?.center_player_id ||
      line?.right_wing_player_id,
  );
}

function updateLineByNumber(
  lines: ForwardLine[],
  lineNumber: number,
  nextLine: ForwardLine,
) {
  return lines.map((line) =>
    line.line_number === lineNumber ? nextLine : line,
  );
}

function updateLineSlot(
  lines: ForwardLine[],
  lineNumber: number,
  slot: keyof Pick<
    ForwardLine,
    'left_wing_player_id' | 'center_player_id' | 'right_wing_player_id'
  >,
  playerId: string | null,
) {
  return lines.map((line) =>
    line.line_number === lineNumber ? { ...line, [slot]: playerId } : line,
  );
}

function updatePairSlot(
  pairs: DefensePair[],
  pairNumber: number,
  slot: keyof Pick<DefensePair, 'left_d_player_id' | 'right_d_player_id'>,
  playerId: string | null,
) {
  return pairs.map((pair) =>
    pair.pair_number === pairNumber ? { ...pair, [slot]: playerId } : pair,
  );
}

function getPlacedPlayerIdsForView({
  view,
  lines,
  defensePairs,
  goalies,
  powerPlayLines,
  powerPlayPairs,
  penaltyKillLines,
  penaltyKillPairs,
}: {
  view: LineupView;
  lines: ForwardLine[];
  defensePairs: DefensePair[];
  goalies: GoalieAssignment[];
  powerPlayLines: ForwardLine[];
  powerPlayPairs: DefensePair[];
  penaltyKillLines: ForwardLine[];
  penaltyKillPairs: DefensePair[];
}) {
  const ids = new Set<string>();
  const targetLines =
    view === 'lines'
      ? lines
      : view === 'power_play'
        ? powerPlayLines
        : penaltyKillLines;
  const targetPairs =
    view === 'lines'
      ? defensePairs
      : view === 'power_play'
        ? powerPlayPairs
        : penaltyKillPairs;

  targetLines.forEach((line) => {
    addId(ids, line.left_wing_player_id);
    addId(ids, line.center_player_id);
    addId(ids, line.right_wing_player_id);
  });
  targetPairs.forEach((pair) => {
    addId(ids, pair.left_d_player_id);
    addId(ids, pair.right_d_player_id);
  });

  if (view === 'lines') {
    goalies.forEach((goalie) => addId(ids, goalie.player_id));
  }

  return ids;
}

function getUnavailablePlayers(
  lineup: LineupRow,
  playerById: Map<string, Player>,
) {
  const playerIds = getAllLineupPlayerIds(lineup);
  const unavailablePlayers: Player[] = [];

  playerIds.forEach((playerId) => {
    const player = playerById.get(playerId);

    if (player && player.status !== 'active') {
      unavailablePlayers.push(player);
    }
  });

  return unavailablePlayers;
}

function getAllLineupPlayerIds(lineup: LineupRow) {
  const ids = new Set<string>();

  normalizeForwardLines(lineup.lines, 4).forEach((line) => {
    addId(ids, line.left_wing_player_id);
    addId(ids, line.center_player_id);
    addId(ids, line.right_wing_player_id);
  });
  normalizeDefensePairs(lineup.defense_pairs, 3).forEach((pair) => {
    addId(ids, pair.left_d_player_id);
    addId(ids, pair.right_d_player_id);
  });
  (lineup.goalies ?? []).forEach((goalie) => addId(ids, goalie.player_id));

  const splitPowerPlay = splitSpecialUnits(
    lineup.special_teams?.power_play_units,
  );
  const splitPenaltyKill = splitSpecialUnits(
    lineup.special_teams?.penalty_kill_units,
  );

  normalizeForwardLines(splitPowerPlay.lines, 2).forEach((line) => {
    addId(ids, line.left_wing_player_id);
    addId(ids, line.center_player_id);
    addId(ids, line.right_wing_player_id);
  });
  normalizeDefensePairs(splitPowerPlay.pairs, 2).forEach((pair) => {
    addId(ids, pair.left_d_player_id);
    addId(ids, pair.right_d_player_id);
  });
  normalizeForwardLines(splitPenaltyKill.lines, 2).forEach((line) => {
    addId(ids, line.left_wing_player_id);
    addId(ids, line.center_player_id);
    addId(ids, line.right_wing_player_id);
  });
  normalizeDefensePairs(splitPenaltyKill.pairs, 2).forEach((pair) => {
    addId(ids, pair.left_d_player_id);
    addId(ids, pair.right_d_player_id);
  });

  return ids;
}

function addId(ids: Set<string>, id: string | null) {
  if (id) {
    ids.add(id);
  }
}

function stringOrNull(value: unknown) {
  return typeof value === 'string' ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const styles = StyleSheet.create({
  compactCard: {
    gap: 6,
    padding: 12,
  },
  filledSlot: {
    backgroundColor: '#f4f6f3',
    borderColor: '#b8442f',
  },
  goalieName: {
    color: '#15251f',
    fontSize: 15,
    fontWeight: '700',
  },
  goalieRow: {
    alignItems: 'center',
    borderColor: '#ccd3ce',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
  },
  playerChip: {
    borderRadius: 12,
    gap: 2,
    minWidth: 78,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  playerChipName: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  playerChipNumber: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  pool: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
  },
  poolScroller: {
    marginTop: 4,
  },
  savedLineupDetails: {
    flex: 1,
    gap: 3,
  },
  savedLineupRow: {
    alignItems: 'center',
    borderColor: '#ccd3ce',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    padding: 10,
  },
  savedLineupTitle: {
    color: '#15251f',
    fontSize: 14,
    fontWeight: '800',
  },
  selectedPlayerChip: {
    borderColor: '#15251f',
    borderWidth: 3,
  },
  slot: {
    borderColor: '#ccd3ce',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    minWidth: 0,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  slotLabel: {
    color: '#59636e',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  slotValue: {
    color: '#15251f',
    fontSize: 12,
    fontWeight: '700',
  },
  specialTeamUnit: {
    gap: 8,
  },
  starterRow: {
    backgroundColor: '#e7ede8',
    borderColor: '#b8442f',
  },
  starterText: {
    color: '#b8442f',
    fontSize: 13,
    fontWeight: '700',
  },
  switcher: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  switcherOption: {
    backgroundColor: '#ffffff',
    borderColor: '#ccd3ce',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  switcherOptionActive: {
    backgroundColor: '#e7ede8',
    borderColor: '#b8442f',
  },
  switcherText: {
    color: '#25332e',
    fontSize: 14,
    fontWeight: '700',
  },
  switcherTextActive: {
    color: '#b8442f',
  },
  successMessage: {
    color: '#276749',
    fontWeight: '700',
    lineHeight: 20,
  },
  unit: {
    gap: 5,
  },
  unitTitle: {
    color: '#25332e',
    fontSize: 14,
    fontWeight: '800',
  },
});
