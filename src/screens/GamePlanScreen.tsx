import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { AppButton } from '../components/AppButton';
import { AppIcon } from '../components/AppIcon';
import { AppScreen, appScreenStyles } from '../components/AppScreen';
import { FormField } from '../components/AuthScreen';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import {
  buildGamePlanPrintHtml,
  calculateTeamRecord,
  EMPTY_GAME_PLAN_DETAILS,
  getGameNumber,
  normalizeGamePlanDetails,
  type GamePlanDetails,
  type GamePlanGame,
  type GamePlanLineup,
  type GamePlanPlayer,
} from '../gamePlan/gamePlanExport';
import type { AuthenticatedStackParamList } from '../navigation/types';
import { isLikelyNetworkError } from '../offline/cache';
import { useActiveTeam } from '../teams/ActiveTeamContext';
import {
  colors,
  fontSizes,
  fonts,
  radii,
  selectionStyles,
  spacing,
} from '../theme/theme';

type Props = NativeStackScreenProps<AuthenticatedStackParamList, 'GamePlan'>;

type EditorGame = GamePlanGame & {
  game_plan_details: unknown;
};

const TACTICAL_FIELDS: Array<
  keyof Pick<
    GamePlanDetails,
    'dZonePlay' | 'forecheck' | 'oZonePlay' | 'ppNotes' | 'pkNotes'
  >
> = ['dZonePlay', 'forecheck', 'oZonePlay', 'ppNotes', 'pkNotes'];

export function GamePlanScreen({ route }: Props) {
  const { i18n, t } = useTranslation();
  const queryClient = useQueryClient();
  const { activeTeam, isReadOnlyTeam } = useActiveTeam();
  const [selectedGameId, setSelectedGameId] = useState<string | null>(
    route.params?.gameId ?? null,
  );
  const [details, setDetails] = useState<GamePlanDetails>({
    ...EMPTY_GAME_PLAN_DETAILS,
  });
  const [pickerVisible, setPickerVisible] = useState(false);
  const [initializedGameId, setInitializedGameId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const gamesQuery = useQuery({
    queryKey: ['game-plan-games', activeTeam?.id],
    queryFn: async () => {
      if (!activeTeam) return [] as EditorGame[];
      const { data, error: loadError } = await supabase
        .from('games')
        .select('id, opponent_name, game_date, result, game_plan_details')
        .eq('team_id', activeTeam.id)
        .order('game_date', { ascending: true });

      if (loadError) throw loadError;
      return (data ?? []) as EditorGame[];
    },
    enabled: Boolean(activeTeam),
  });
  const games = gamesQuery.data ?? [];
  const selectedGame = games.find((game) => game.id === selectedGameId) ?? null;

  useEffect(() => {
    setInitializedGameId(null);
    setSelectedGameId(route.params?.gameId ?? null);
    setDetails({ ...EMPTY_GAME_PLAN_DETAILS });
  }, [activeTeam?.id, route.params?.gameId]);

  useEffect(() => {
    if (
      games.length === 0 ||
      (selectedGameId && games.some((game) => game.id === selectedGameId))
    ) {
      return;
    }
    const now = Date.now();
    const nextGame = games.find(
      (game) => new Date(game.game_date).getTime() >= now,
    );
    setSelectedGameId((nextGame ?? games[games.length - 1]).id);
  }, [games, selectedGameId]);

  useEffect(() => {
    if (!selectedGame || initializedGameId === selectedGame.id) return;
    setDetails(normalizeGamePlanDetails(selectedGame.game_plan_details));
    setInitializedGameId(selectedGame.id);
    setError('');
    setSuccess('');
  }, [initializedGameId, selectedGame]);

  const selectedGameLabel = useMemo(
    () =>
      selectedGame
        ? t('gamePlan.gameOption', {
            date: formatGameDate(selectedGame.game_date, i18n.language),
            opponent: selectedGame.opponent_name,
          })
        : t('gamePlan.selectGamePlaceholder'),
    [i18n.language, selectedGame, t],
  );

  function selectGame(gameId: string) {
    setInitializedGameId(null);
    setSelectedGameId(gameId);
    setPickerVisible(false);
  }

  function updateField(
    field: keyof Omit<GamePlanDetails, 'keyPoints'>,
    value: string,
  ) {
    setDetails((current) => ({ ...current, [field]: value }));
  }

  function updateKeyPoint(index: number, value: string) {
    setDetails((current) => {
      const keyPoints = Array.from(
        { length: 4 },
        (_, pointIndex) => current.keyPoints[pointIndex] ?? '',
      );
      keyPoints[index] = value;
      return { ...current, keyPoints };
    });
  }

  function makePayload(): GamePlanDetails {
    return {
      dZonePlay: details.dZonePlay.trim(),
      forecheck: details.forecheck.trim(),
      oZonePlay: details.oZonePlay.trim(),
      ppNotes: details.ppNotes.trim(),
      pkNotes: details.pkNotes.trim(),
      keyPoints: details.keyPoints
        .map((point) => point.trim())
        .filter(Boolean)
        .slice(0, 4),
      outPlayers: details.outPlayers.trim(),
    };
  }

  async function saveGamePlan() {
    if (!selectedGame || isReadOnlyTeam) return;
    setError('');
    setSuccess('');
    setIsSaving(true);

    const payload = makePayload();
    const { error: saveError } = await supabase
      .from('games')
      .update({ game_plan_details: payload })
      .eq('id', selectedGame.id);

    if (saveError) {
      setError(
        isLikelyNetworkError(saveError)
          ? t('offline.writeBlocked')
          : t('gamePlan.saveError'),
      );
      setIsSaving(false);
      return;
    }

    setDetails(payload);
    await queryClient.invalidateQueries({
      queryKey: ['game-plan-games', activeTeam?.id],
    });
    await queryClient.invalidateQueries({ queryKey: ['calendar-games'] });
    await queryClient.invalidateQueries({ queryKey: ['game', selectedGame.id] });
    setSuccess(t('gamePlan.saveSuccess'));
    setIsSaving(false);
  }

  async function exportGamePlan() {
    if (!activeTeam || !selectedGame) return;
    setError('');
    setSuccess('');
    setIsExporting(true);

    try {
      const [lineupResult, playersResult] = await Promise.all([
        supabase
          .from('lineups')
          .select('lines, defense_pairs, goalies, special_teams')
          .eq('game_id', selectedGame.id)
          .maybeSingle(),
        supabase
          .from('players')
          .select('id, first_name, last_name, jersey_number')
          .eq('team_id', activeTeam.id)
          .order('jersey_number', { ascending: true, nullsFirst: false }),
      ]);

      if (lineupResult.error) throw lineupResult.error;
      if (playersResult.error) throw playersResult.error;

      const html = buildGamePlanPrintHtml({
        details: makePayload(),
        game: selectedGame,
        gameNumber: getGameNumber(games, selectedGame.id),
        lineup: lineupResult.data as GamePlanLineup | null,
        locale: i18n.language,
        logoUrl: activeTeam.logo_url,
        players: (playersResult.data ?? []) as GamePlanPlayer[],
        record: calculateTeamRecord(games),
        teamName: activeTeam.name,
        t,
      });
      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();

      if (!canShare) {
        setError(t('gamePlan.exportUnavailable'));
        return;
      }

      await Sharing.shareAsync(uri, {
        UTI: 'com.adobe.pdf',
        mimeType: 'application/pdf',
      });
    } catch (exportError) {
      console.error('Unable to export printable game plan:', exportError);
      setError(t('gamePlan.exportError'));
    } finally {
      setIsExporting(false);
    }
  }

  if (!activeTeam) {
    return (
      <AppScreen
        description={t('gamePlan.noActiveTeamDescription')}
        title={t('gamePlan.title')}
      >
        <EmptyState
          description={t('gamePlan.noActiveTeamDescription')}
          icon="shield-outline"
          title={t('games.noActiveTeamTitle')}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen
      description={t('gamePlan.description', { teamName: activeTeam.name })}
      title={t('gamePlan.title')}
    >
      {gamesQuery.isLoading ? (
        <Text style={appScreenStyles.note}>{t('common.loading')}</Text>
      ) : null}
      {gamesQuery.error ? (
        <Text style={appScreenStyles.error}>{t('gamePlan.loadError')}</Text>
      ) : null}
      {!gamesQuery.isLoading && !gamesQuery.error && games.length === 0 ? (
        <EmptyState
          description={t('gamePlan.noGamesDescription')}
          icon="calendar-outline"
          title={t('gamePlan.noGamesTitle')}
        />
      ) : null}
      {games.length > 0 ? (
        <>
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>{t('gamePlan.gamePickerLabel')}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setPickerVisible(true)}
              style={styles.pickerButton}
            >
              <Text numberOfLines={2} style={styles.pickerText}>
                {selectedGameLabel}
              </Text>
              <AppIcon name="chevron-down" size={18} />
            </Pressable>
          </Card>

          {selectedGame ? (
            <Card style={styles.card}>
              <Text style={styles.sectionTitle}>{t('gamePlan.tacticalTitle')}</Text>
              {TACTICAL_FIELDS.map((field) => (
                <FormField
                  editable={!isReadOnlyTeam}
                  key={field}
                  label={t(`gamePlan.fields.${field}.label`)}
                  multiline
                  onChangeText={(value) => updateField(field, value)}
                  placeholder={t(`gamePlan.fields.${field}.placeholder`)}
                  style={styles.multiline}
                  value={details[field]}
                />
              ))}
              <Text style={styles.subsectionTitle}>{t('gamePlan.keyPointsTitle')}</Text>
              {Array.from({ length: 4 }, (_, index) => (
                <FormField
                  editable={!isReadOnlyTeam}
                  key={`key-point-${index}`}
                  label={t('gamePlan.keyPointLabel', { number: index + 1 })}
                  onChangeText={(value) => updateKeyPoint(index, value)}
                  placeholder={t('gamePlan.keyPointPlaceholder')}
                  value={details.keyPoints[index] ?? ''}
                />
              ))}
              <FormField
                editable={!isReadOnlyTeam}
                label={t('gamePlan.outPlayersLabel')}
                multiline
                onChangeText={(value) => updateField('outPlayers', value)}
                placeholder={t('gamePlan.outPlayersPlaceholder')}
                style={styles.multilineSmall}
                value={details.outPlayers}
              />
              {isReadOnlyTeam ? (
                <Text style={appScreenStyles.note}>{t('common.readOnlyNotice')}</Text>
              ) : (
                <AppButton
                  disabled={isSaving || isExporting}
                  icon="save-outline"
                  onPress={() => void saveGamePlan()}
                  title={isSaving ? t('common.saving') : t('gamePlan.saveButton')}
                />
              )}
              <AppButton
                disabled={isSaving || isExporting}
                icon="download-outline"
                onPress={() => void exportGamePlan()}
                title={
                  isExporting
                    ? t('gamePlan.exporting')
                    : t('gamePlan.exportButton')
                }
                variant="secondary"
              />
              {success ? <Text style={styles.success}>{success}</Text> : null}
              {error ? <Text style={appScreenStyles.error}>{error}</Text> : null}
            </Card>
          ) : null}
        </>
      ) : null}

      <Modal
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}
        transparent
        visible={pickerVisible}
      >
        <SafeAreaView style={styles.modalRoot}>
          <Pressable
            accessibilityLabel={t('common.close')}
            onPress={() => setPickerVisible(false)}
            style={styles.backdrop}
          />
          <View accessibilityViewIsModal style={styles.pickerPanel}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('gamePlan.gamePickerLabel')}</Text>
              <Pressable
                accessibilityLabel={t('common.close')}
                accessibilityRole="button"
                hitSlop={10}
                onPress={() => setPickerVisible(false)}
              >
                <AppIcon name="close" />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.gameOptions}>
              {games.map((game) => {
                const selected = game.id === selectedGameId;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={game.id}
                    onPress={() => selectGame(game.id)}
                    style={[styles.gameOption, selected && styles.gameOptionSelected]}
                  >
                    <Text
                      style={[
                        styles.gameOptionOpponent,
                        selected && styles.gameOptionTextSelected,
                      ]}
                    >
                      {t('gamePlan.vsOpponent', { opponent: game.opponent_name })}
                    </Text>
                    <Text
                      style={[
                        styles.gameOptionDate,
                        selected && styles.gameOptionTextSelected,
                      ]}
                    >
                      {formatGameDate(game.game_date, i18n.language)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    </AppScreen>
  );
}

function formatGameDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(3, 13, 24, 0.72)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  card: {
    gap: spacing.lg,
  },
  gameOption: {
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  gameOptionDate: {
    color: colors.slateGrey,
    fontSize: fontSizes.sm,
  },
  gameOptionOpponent: {
    color: colors.textPrimary,
    fontSize: fontSizes.lg,
    fontWeight: '800',
  },
  gameOptionSelected: {
    ...selectionStyles.active,
  },
  gameOptionTextSelected: {
    ...selectionStyles.activeText,
  },
  gameOptions: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalRoot: {
    flex: 1,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.display,
    fontSize: fontSizes.displayMd,
  },
  multiline: {
    minHeight: 92,
    paddingTop: spacing.md,
    textAlignVertical: 'top',
  },
  multilineSmall: {
    minHeight: 72,
    paddingTop: spacing.md,
    textAlignVertical: 'top',
  },
  pickerButton: {
    alignItems: 'center',
    backgroundColor: colors.fieldBackground,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  pickerPanel: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    bottom: 0,
    gap: spacing.lg,
    maxHeight: '78%',
    padding: spacing.xl,
    position: 'absolute',
    width: '100%',
  },
  pickerText: {
    color: colors.textPrimary,
    flex: 1,
    fontSize: fontSizes.base,
    fontWeight: '700',
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.display,
    fontSize: fontSizes.displayMd,
  },
  subsectionTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.lg,
    fontWeight: '900',
  },
  success: {
    color: colors.success,
    fontSize: fontSizes.md,
    fontWeight: '700',
  },
});
