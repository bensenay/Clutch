import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import type {
  AuthenticatedStackParamList,
  AuthenticatedTabParamList,
} from '../navigation/types';
import {
  type ActiveTeam,
  useActiveTeam,
} from '../teams/ActiveTeamContext';
import { colors, goalRed, slateGrey, spacing } from '../theme/theme';
import { AnimatedPressable } from './AnimatedPressable';
import { AppButton } from './AppButton';
import { appScreenStyles } from './AppScreen';
import { FormField, authStyles } from './AuthScreen';
import { EmptyState } from './EmptyState';
import { LoadingState } from './LoadingState';

type Navigation = CompositeNavigationProp<
  BottomTabNavigationProp<AuthenticatedTabParamList, 'ScheduleTab'>,
  NativeStackNavigationProp<AuthenticatedStackParamList>
>;

type Props = {
  navigation: Navigation;
  userId: string;
};

type AssignmentType = 'game' | 'practice';
type AssignmentStatus = 'pending' | 'confirmed';

type TeamRelation = ActiveTeam | ActiveTeam[] | null;

type AssignmentRow = {
  id: string;
  team_id: string;
  assignment_type: AssignmentType;
  scheduled_at: string;
  director_note: string;
  coach_note: string | null;
  status: AssignmentStatus;
  teams: TeamRelation;
};

type GameMatch = {
  id: string;
  team_id: string;
  game_date: string;
};

type PracticeMatch = {
  id: string;
  team_id: string;
  practice_date: string;
};

const EMPTY_ASSIGNMENTS: AssignmentRow[] = [];

export function AssistantAssignmentSchedule({ navigation, userId }: Props) {
  const { i18n, t } = useTranslation();
  const queryClient = useQueryClient();
  const { setActiveTeam } = useActiveTeam();
  const [notesByAssignmentId, setNotesByAssignmentId] = useState<
    Record<string, string>
  >({});
  const [savingAssignmentId, setSavingAssignmentId] = useState<string | null>(
    null,
  );
  const [errorByAssignmentId, setErrorByAssignmentId] = useState<
    Record<string, string>
  >({});
  const weekRange = useMemo(() => getCurrentWeekRange(), []);
  const assignmentsQuery = useQuery({
    queryKey: [
      'assistant-weekly-assignments',
      userId,
      weekRange.start.toISOString(),
    ],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coach_assignments')
        .select(
          'id, team_id, assignment_type, scheduled_at, director_note, coach_note, status, teams ( id, name, level, season, primary_color, secondary_color, tertiary_color, logo_url )',
        )
        .eq('assistant_coach_user_id', userId)
        .gte('scheduled_at', weekRange.start.toISOString())
        .lt('scheduled_at', weekRange.end.toISOString())
        .order('scheduled_at', { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []) as AssignmentRow[];
    },
  });
  const assignments = assignmentsQuery.data ?? EMPTY_ASSIGNMENTS;
  const teamIds = useMemo(
    () => Array.from(new Set(assignments.map((assignment) => assignment.team_id))),
    [assignments],
  );
  const gamesQuery = useQuery({
    queryKey: [
      'assistant-weekly-game-matches',
      userId,
      weekRange.start.toISOString(),
      teamIds.join(','),
    ],
    queryFn: async () => {
      if (teamIds.length === 0) {
        return [] as GameMatch[];
      }

      const { data, error } = await supabase
        .from('games')
        .select('id, team_id, game_date')
        .in('team_id', teamIds)
        .gte('game_date', weekRange.start.toISOString())
        .lt('game_date', weekRange.end.toISOString());

      if (error) {
        throw error;
      }

      return (data ?? []) as GameMatch[];
    },
    enabled: assignments.length > 0,
  });
  const practicesQuery = useQuery({
    queryKey: [
      'assistant-weekly-practice-matches',
      userId,
      weekRange.start.toISOString(),
      teamIds.join(','),
    ],
    queryFn: async () => {
      if (teamIds.length === 0) {
        return [] as PracticeMatch[];
      }

      const { data, error } = await supabase
        .from('practice_plans')
        .select('id, team_id, practice_date')
        .in('team_id', teamIds)
        .gte('practice_date', weekRange.start.toISOString())
        .lt('practice_date', weekRange.end.toISOString());

      if (error) {
        throw error;
      }

      return (data ?? []) as PracticeMatch[];
    },
    enabled: assignments.length > 0,
  });

  useEffect(() => {
    setNotesByAssignmentId((currentNotes) => {
      const nextNotes = { ...currentNotes };
      let hasChanges = false;

      for (const assignment of assignments) {
        if (!(assignment.id in nextNotes)) {
          nextNotes[assignment.id] = assignment.coach_note ?? '';
          hasChanges = true;
        }
      }

      return hasChanges ? nextNotes : currentNotes;
    });
  }, [assignments]);

  async function updateAssignment(
    assignment: AssignmentRow,
    updates: { status?: AssignmentStatus; coach_note?: string | null },
  ) {
    setSavingAssignmentId(assignment.id);
    setErrorByAssignmentId((currentErrors) => ({
      ...currentErrors,
      [assignment.id]: '',
    }));

    const { error } = await supabase
      .from('coach_assignments')
      .update(updates)
      .eq('id', assignment.id);

    if (error) {
      console.error('Unable to update assistant assignment:', error);
      setErrorByAssignmentId((currentErrors) => ({
        ...currentErrors,
        [assignment.id]: t('assistantSchedule.updateError'),
      }));
      setSavingAssignmentId(null);
      return;
    }

    await queryClient.invalidateQueries({
      queryKey: [
        'assistant-weekly-assignments',
        userId,
        weekRange.start.toISOString(),
      ],
    });
    setSavingAssignmentId(null);
  }

  function activateAssignmentTeam(assignment: AssignmentRow) {
    setActiveTeam(normalizeAssignmentTeam(assignment, t), {
      mode: 'assignment',
      assignmentId: assignment.id,
      assignmentType: assignment.assignment_type,
      scheduledAt: assignment.scheduled_at,
    });
  }

  function openAssignment(assignment: AssignmentRow) {
    activateAssignmentTeam(assignment);

    if (assignment.assignment_type === 'game') {
      const game = findMatchingGame(assignment, gamesQuery.data ?? []);

      if (game) {
        navigation.navigate('GameForm', { gameId: game.id, readOnly: true });
      }

      return;
    }

    const practice = findMatchingPractice(
      assignment,
      practicesQuery.data ?? [],
    );

    if (practice) {
      navigation.navigate('PracticePlanDetail', {
        practicePlanId: practice.id,
        readOnly: true,
      });
    }
  }

  function openRoster(assignment: AssignmentRow) {
    activateAssignmentTeam(assignment);
    navigation.navigate('MainTabs', { screen: 'RosterTab' });
  }

  return (
    <View style={appScreenStyles.card}>
      <Text style={appScreenStyles.cardTitle}>
        {t('assistantSchedule.title')}
      </Text>
      <Text style={appScreenStyles.cardDescription}>
        {t('assistantSchedule.weekRange', {
          range: formatWeekRange(weekRange.start, weekRange.end, i18n.language),
        })}
      </Text>
      {assignmentsQuery.isLoading ? (
        <LoadingState />
      ) : null}
      {assignmentsQuery.error || gamesQuery.error || practicesQuery.error ? (
        <Text style={appScreenStyles.error}>
          {t('assistantSchedule.loadError')}
        </Text>
      ) : null}
      {!assignmentsQuery.isLoading && assignments.length === 0 ? (
        <EmptyState
          description={t('assistantSchedule.emptyWeek')}
          icon="calendar-outline"
          title={t('assistantSchedule.title')}
        />
      ) : null}
      <View style={styles.assignmentList}>
        {assignments.map((assignment) => {
          const game = findMatchingGame(assignment, gamesQuery.data ?? []);
          const practice = findMatchingPractice(
            assignment,
            practicesQuery.data ?? [],
          );
          const hasMatch =
            assignment.assignment_type === 'game' ? Boolean(game) : Boolean(practice);
          const coachNote = notesByAssignmentId[assignment.id] ?? '';
          const isSaving = savingAssignmentId === assignment.id;

          return (
            <View key={assignment.id} style={styles.assignmentCard}>
              <AnimatedPressable
                accessibilityRole="button"
                onPress={() => openAssignment(assignment)}
              >
                <View style={appScreenStyles.row}>
                  <Text style={styles.assignmentTitle}>
                    {normalizeAssignmentTeam(assignment, t).name}
                  </Text>
                  <Text style={styles.statusBadge}>
                    {t(`assistantSchedule.statuses.${assignment.status}`)}
                  </Text>
                </View>
                <Text style={appScreenStyles.meta}>
                  {t(`assistantSchedule.assignmentTypes.${assignment.assignment_type}`)}
                  {' / '}
                  {formatDateTime(assignment.scheduled_at, i18n.language)}
                </Text>
                <Text style={appScreenStyles.cardDescription}>
                  {assignment.director_note ||
                    t('assistantSchedule.noDirectorNote')}
                </Text>
                {!hasMatch ? (
                  <Text style={appScreenStyles.note}>
                    {t('assistantSchedule.noMatchingPlan')}
                  </Text>
                ) : null}
              </AnimatedPressable>
              <FormField
                autoCapitalize="sentences"
                label={t('assistantSchedule.coachNoteLabel')}
                multiline
                onChangeText={(value) =>
                  setNotesByAssignmentId((currentNotes) => ({
                    ...currentNotes,
                    [assignment.id]: value,
                  }))
                }
                placeholder={t('assistantSchedule.coachNotePlaceholder')}
                style={styles.multiline}
                value={coachNote}
              />
              {errorByAssignmentId[assignment.id] ? (
                <Text style={authStyles.error}>
                  {errorByAssignmentId[assignment.id]}
                </Text>
              ) : null}
              <View style={styles.actionRow}>
                {assignment.status !== 'confirmed' ? (
                  <AppButton
                    disabled={isSaving}
                    icon="checkmark-circle-outline"
                    title={t('assistantSchedule.confirmButton')}
                    onPress={() =>
                      void updateAssignment(assignment, {
                        status: 'confirmed',
                        coach_note: coachNote.trim() || null,
                      })
                    }
                  />
                ) : null}
                <AppButton
                  disabled={isSaving}
                  icon="save-outline"
                  title={t('assistantSchedule.saveNoteButton')}
                  onPress={() =>
                    void updateAssignment(assignment, {
                      coach_note: coachNote.trim() || null,
                    })
                  }
                />
                {hasMatch ? (
                  <AppButton
                    icon={
                      assignment.assignment_type === 'game'
                        ? 'calendar-outline'
                        : 'clipboard-outline'
                    }
                    title={
                      assignment.assignment_type === 'game'
                        ? t('assistantSchedule.openGameButton')
                        : t('assistantSchedule.openPracticeButton')
                    }
                    onPress={() => openAssignment(assignment)}
                  />
                ) : null}
                <AppButton
                  icon="people-outline"
                  title={t('assistantSchedule.openRosterButton')}
                  onPress={() => openRoster(assignment)}
                />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function normalizeAssignmentTeam(
  assignment: AssignmentRow,
  t: (key: string) => string,
): ActiveTeam {
  const team = Array.isArray(assignment.teams)
    ? assignment.teams[0]
    : assignment.teams;

  return (
    team ?? {
      id: assignment.team_id,
      name: t('assistantSchedule.assignedTeamFallback'),
      level: null,
      season: null,
      primary_color: null,
      secondary_color: null,
      tertiary_color: null,
      logo_url: null,
    }
  );
}

function findMatchingGame(assignment: AssignmentRow, games: GameMatch[]) {
  if (assignment.assignment_type !== 'game') {
    return null;
  }

  const assignmentDateKey = toDateKey(new Date(assignment.scheduled_at));

  return (
    games.find(
      (game) =>
        game.team_id === assignment.team_id &&
        toDateKey(new Date(game.game_date)) === assignmentDateKey,
    ) ?? null
  );
}

function findMatchingPractice(
  assignment: AssignmentRow,
  practices: PracticeMatch[],
) {
  if (assignment.assignment_type !== 'practice') {
    return null;
  }

  const assignmentDateKey = toDateKey(new Date(assignment.scheduled_at));

  return (
    practices.find(
      (practice) =>
        practice.team_id === assignment.team_id &&
        toDateKey(new Date(practice.practice_date)) === assignmentDateKey,
    ) ?? null
  );
}

function getCurrentWeekRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());

  const end = new Date(start);
  end.setDate(start.getDate() + 7);

  return { start, end };
}

function formatWeekRange(start: Date, end: Date, locale: string) {
  const endInclusive = new Date(end);
  endInclusive.setDate(endInclusive.getDate() - 1);
  const formatter = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
  });

  return `${formatter.format(start)} - ${formatter.format(endInclusive)}`;
}

function formatDateTime(value: string, locale: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  assignmentCard: {
    backgroundColor: colors.fieldBackground,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  assignmentList: {
    gap: spacing.sm,
  },
  assignmentTitle: {
    color: colors.textPrimary,
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
  },
  multiline: {
    minHeight: 78,
    paddingTop: spacing.md,
    textAlignVertical: 'top',
  },
  statusBadge: {
    color: goalRed,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
});
