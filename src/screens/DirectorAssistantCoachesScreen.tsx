import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Alert,
  Button,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { getFunctionErrorMessage } from '../auth/onboarding';
import { AppScreen, appScreenStyles } from '../components/AppScreen';
import {
  FormField,
  authStyles,
} from '../components/AuthScreen';
import type { AuthenticatedStackParamList } from '../navigation/types';
import { colors, goalRed, slateGrey } from '../theme/theme';

type Props = NativeStackScreenProps<
  AuthenticatedStackParamList,
  'DirectorAssistantCoaches'
>;

type Profile = {
  id: string;
  email: string;
  name: string | null;
  role: 'super_admin' | 'director' | 'coach';
  school_id: string | null;
};

type Team = {
  id: string;
  name: string;
  level: string | null;
  season: string | null;
};

type TeamMembership = {
  user_id: string;
};

type AssignmentType = 'game' | 'practice';
type AssignmentStatus = 'pending' | 'confirmed';

type CoachAssignment = {
  id: string;
  school_id: string;
  team_id: string;
  assistant_coach_user_id: string;
  assignment_type: AssignmentType;
  scheduled_at: string;
  director_note: string;
  coach_note: string | null;
  status: AssignmentStatus;
  created_by: string;
  created_at: string;
};

const DEFAULT_ASSIGNMENT_TYPE: AssignmentType = 'practice';

export function DirectorAssistantCoachesScreen(_props: Props) {
  const { i18n, t } = useTranslation();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [selectedAssistantId, setSelectedAssistantId] = useState<string | null>(
    null,
  );
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [assignmentType, setAssignmentType] = useState<AssignmentType>(
    DEFAULT_ASSIGNMENT_TYPE,
  );
  const [scheduledDate, setScheduledDate] = useState(() =>
    formatDateInput(new Date()),
  );
  const [scheduledTime, setScheduledTime] = useState(() =>
    formatTimeInput(defaultScheduledAt()),
  );
  const [directorNote, setDirectorNote] = useState('');
  const [assignmentError, setAssignmentError] = useState('');
  const [assignmentMessage, setAssignmentMessage] = useState('');
  const [isSavingAssignment, setIsSavingAssignment] = useState(false);

  const profileQuery = useQuery({
    queryKey: ['profile', session?.user.id],
    queryFn: async () => {
      if (!session) {
        throw new Error(t('home.noSessionError'));
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, name, role, school_id')
        .eq('id', session.user.id)
        .single();

      if (error) {
        throw error;
      }

      return data as Profile;
    },
    enabled: Boolean(session),
  });

  const profile = profileQuery.data;
  const teamsQuery = useQuery({
    queryKey: ['director-teams', profile?.school_id],
    queryFn: async () => {
      if (!profile?.school_id) {
        throw new Error(t('directorAssistantCoaches.noSchoolError'));
      }

      const { data, error } = await supabase
        .from('teams')
        .select('id, name, level, season')
        .eq('school_id', profile.school_id)
        .order('name', { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []) as Team[];
    },
    enabled: profile?.role === 'director' && Boolean(profile.school_id),
  });

  const assistantsQuery = useQuery({
    queryKey: ['assistant-coaches', profile?.school_id],
    queryFn: async () => {
      if (!profile?.school_id) {
        throw new Error(t('directorAssistantCoaches.noSchoolError'));
      }

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, name, role, school_id')
        .eq('school_id', profile.school_id)
        .eq('role', 'coach')
        .order('email', { ascending: true });

      if (profilesError) {
        throw profilesError;
      }

      const { data: memberships, error: membershipsError } = await supabase
        .from('team_memberships')
        .select('user_id');

      if (membershipsError) {
        throw membershipsError;
      }

      const headCoachIds = new Set(
        ((memberships ?? []) as TeamMembership[]).map(
          (membership) => membership.user_id,
        ),
      );

      return ((profiles ?? []) as Profile[]).filter(
        (coach) => !headCoachIds.has(coach.id),
      );
    },
    enabled: profile?.role === 'director' && Boolean(profile.school_id),
  });

  const selectedAssistant =
    assistantsQuery.data?.find(
      (assistant) => assistant.id === selectedAssistantId,
    ) ?? null;
  const assignmentsQuery = useQuery({
    queryKey: ['coach-assignments', selectedAssistantId],
    queryFn: async () => {
      if (!selectedAssistantId) {
        throw new Error(t('directorAssistantCoaches.noAssistantSelectedError'));
      }

      const { data, error } = await supabase
        .from('coach_assignments')
        .select(
          'id, school_id, team_id, assistant_coach_user_id, assignment_type, scheduled_at, director_note, coach_note, status, created_by, created_at',
        )
        .eq('assistant_coach_user_id', selectedAssistantId)
        .order('scheduled_at', { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []) as CoachAssignment[];
    },
    enabled: Boolean(selectedAssistantId),
  });

  async function inviteAssistantCoach() {
    const email = inviteEmail.trim();

    if (!email) {
      setInviteError(t('directorAssistantCoaches.inviteRequiredError'));
      return;
    }

    if (!session) {
      setInviteError(t('home.noSessionError'));
      return;
    }

    setInviteError('');
    setInviteMessage('');
    setIsInviting(true);

    const { data, error } = await supabase.functions.invoke<{
      userId: string;
    }>('create-assistant-coach', {
      body: { email },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) {
      const message = await getFunctionErrorMessage(error);
      setInviteError(message ?? t('directorAssistantCoaches.inviteError'));
      setIsInviting(false);
      return;
    }

    setInviteEmail('');
    setInviteMessage(t('directorAssistantCoaches.inviteSuccess'));
    setSelectedAssistantId(data?.userId ?? selectedAssistantId);
    await queryClient.invalidateQueries({
      queryKey: ['assistant-coaches', profile?.school_id],
    });
    setIsInviting(false);
  }

  async function saveAssignment(skipConflictCheck = false) {
    if (!profile?.school_id || !session) {
      setAssignmentError(t('home.noSessionError'));
      return;
    }

    if (!selectedAssistant) {
      setAssignmentError(t('directorAssistantCoaches.noAssistantSelectedError'));
      return;
    }

    if (!selectedTeamId) {
      setAssignmentError(t('directorAssistantCoaches.assignmentRequiredError'));
      return;
    }

    const scheduledAt = parseScheduledAt(scheduledDate, scheduledTime);

    if (!scheduledAt) {
      setAssignmentError(t('directorAssistantCoaches.invalidDateTimeError'));
      return;
    }

    setAssignmentError('');
    setAssignmentMessage('');
    setIsSavingAssignment(true);

    if (!skipConflictCheck) {
      const { data: conflicts, error: conflictError } = await supabase
        .from('coach_assignments')
        .select('id')
        .eq('assistant_coach_user_id', selectedAssistant.id)
        .eq('scheduled_at', scheduledAt.toISOString())
        .limit(1);

      if (conflictError) {
        console.error('Unable to check assistant assignment conflicts:', conflictError);
        setAssignmentError(t('directorAssistantCoaches.conflictCheckError'));
        setIsSavingAssignment(false);
        return;
      }

      if ((conflicts ?? []).length > 0) {
        setIsSavingAssignment(false);
        Alert.alert(
          t('directorAssistantCoaches.conflictWarningTitle'),
          t('directorAssistantCoaches.conflictWarningDescription'),
          [
            {
              style: 'cancel',
              text: t('common.cancel'),
            },
            {
              text: t('directorAssistantCoaches.saveAnywayButton'),
              onPress: () => void saveAssignment(true),
            },
          ],
        );
        return;
      }
    }

    const { error } = await supabase.from('coach_assignments').insert({
      school_id: profile.school_id,
      team_id: selectedTeamId,
      assistant_coach_user_id: selectedAssistant.id,
      assignment_type: assignmentType,
      scheduled_at: scheduledAt.toISOString(),
      director_note: directorNote.trim(),
      created_by: session.user.id,
    });

    if (error) {
      console.error('Unable to save coach assignment:', error);
      setAssignmentError(t('directorAssistantCoaches.assignmentSaveError'));
      setIsSavingAssignment(false);
      return;
    }

    setDirectorNote('');
    setAssignmentType(DEFAULT_ASSIGNMENT_TYPE);
    setScheduledDate(formatDateInput(new Date()));
    setScheduledTime(formatTimeInput(defaultScheduledAt()));
    setAssignmentMessage(t('directorAssistantCoaches.assignmentSaveSuccess'));
    await queryClient.invalidateQueries({
      queryKey: ['coach-assignments', selectedAssistant.id],
    });
    setIsSavingAssignment(false);
  }

  if (profileQuery.isLoading) {
    return (
      <AppScreen title={t('directorAssistantCoaches.title')}>
        <Text style={appScreenStyles.note}>{t('common.loading')}</Text>
      </AppScreen>
    );
  }

  if (profile?.role !== 'director') {
    return (
      <AppScreen
        description={t('directorOnly.description')}
        title={t('directorOnly.title')}
      />
    );
  }

  return (
    <AppScreen
      description={t('directorAssistantCoaches.description')}
      title={t('directorAssistantCoaches.title')}
    >
      <View style={appScreenStyles.card}>
        <Text style={appScreenStyles.cardTitle}>
          {t('directorAssistantCoaches.inviteTitle')}
        </Text>
        <Text style={appScreenStyles.cardDescription}>
          {t('directorAssistantCoaches.inviteDescription')}
        </Text>
        <FormField
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          label={t('directorAssistantCoaches.emailLabel')}
          onChangeText={setInviteEmail}
          placeholder={t('directorAssistantCoaches.emailPlaceholder')}
          textContentType="emailAddress"
          value={inviteEmail}
        />
        {inviteError ? (
          <Text style={authStyles.error}>{inviteError}</Text>
        ) : null}
        {inviteMessage ? (
          <Text style={appScreenStyles.note}>{inviteMessage}</Text>
        ) : null}
        <Button
          color={goalRed}
          disabled={isInviting}
          title={
            isInviting
              ? t('directorAssistantCoaches.inviting')
              : t('directorAssistantCoaches.inviteButton')
          }
          onPress={() => void inviteAssistantCoach()}
        />
      </View>

      <View style={appScreenStyles.card}>
        <Text style={appScreenStyles.cardTitle}>
          {t('directorAssistantCoaches.listTitle')}
        </Text>
        <Text style={appScreenStyles.cardDescription}>
          {t('directorAssistantCoaches.listDescription')}
        </Text>
        {assistantsQuery.isLoading ? (
          <Text style={appScreenStyles.note}>{t('common.loading')}</Text>
        ) : null}
        {assistantsQuery.error ? (
          <Text style={appScreenStyles.error}>
            {t('directorAssistantCoaches.loadError')}
          </Text>
        ) : null}
        {!assistantsQuery.isLoading && assistantsQuery.data?.length === 0 ? (
          <Text style={appScreenStyles.note}>
            {t('directorAssistantCoaches.emptyAssistants')}
          </Text>
        ) : null}
        <View style={styles.assistantList}>
          {(assistantsQuery.data ?? []).map((assistant) => {
            const isSelected = assistant.id === selectedAssistantId;

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                key={assistant.id}
                onPress={() => setSelectedAssistantId(assistant.id)}
                style={[
                  styles.assistantButton,
                  isSelected && styles.selectedAssistantButton,
                ]}
              >
                <Text style={styles.assistantName}>
                  {formatCoachName(assistant)}
                </Text>
                <Text style={styles.assistantEmail}>{assistant.email}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {selectedAssistant ? (
        <View style={appScreenStyles.card}>
          <Text style={appScreenStyles.cardTitle}>
            {t('directorAssistantCoaches.assignmentTitle', {
              coachName: formatCoachName(selectedAssistant),
            })}
          </Text>
          <AssignmentForm
            assignmentError={assignmentError}
            assignmentMessage={assignmentMessage}
            assignmentType={assignmentType}
            directorNote={directorNote}
            isLoadingTeams={teamsQuery.isLoading}
            isSaving={isSavingAssignment}
            scheduledDate={scheduledDate}
            scheduledTime={scheduledTime}
            selectedTeamId={selectedTeamId}
            teams={teamsQuery.data ?? []}
            onAssignmentTypeChange={setAssignmentType}
            onDirectorNoteChange={setDirectorNote}
            onSave={() => void saveAssignment()}
            onScheduledDateChange={setScheduledDate}
            onScheduledTimeChange={setScheduledTime}
            onSelectedTeamIdChange={setSelectedTeamId}
          />
          <AssignmentList
            assignments={assignmentsQuery.data ?? []}
            isLoading={assignmentsQuery.isLoading}
            loadError={Boolean(assignmentsQuery.error)}
            locale={i18n.language}
            teams={teamsQuery.data ?? []}
          />
        </View>
      ) : null}
    </AppScreen>
  );
}

function AssignmentForm({
  assignmentError,
  assignmentMessage,
  assignmentType,
  directorNote,
  isLoadingTeams,
  isSaving,
  scheduledDate,
  scheduledTime,
  selectedTeamId,
  teams,
  onAssignmentTypeChange,
  onDirectorNoteChange,
  onSave,
  onScheduledDateChange,
  onScheduledTimeChange,
  onSelectedTeamIdChange,
}: {
  assignmentError: string;
  assignmentMessage: string;
  assignmentType: AssignmentType;
  directorNote: string;
  isLoadingTeams: boolean;
  isSaving: boolean;
  scheduledDate: string;
  scheduledTime: string;
  selectedTeamId: string;
  teams: Team[];
  onAssignmentTypeChange: (type: AssignmentType) => void;
  onDirectorNoteChange: (note: string) => void;
  onSave: () => void;
  onScheduledDateChange: (date: string) => void;
  onScheduledTimeChange: (time: string) => void;
  onSelectedTeamIdChange: (teamId: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.assignmentForm}>
      <Text style={styles.sectionLabel}>
        {t('directorAssistantCoaches.teamLabel')}
      </Text>
      {isLoadingTeams ? (
        <Text style={appScreenStyles.note}>{t('common.loading')}</Text>
      ) : null}
      {teams.length === 0 ? (
        <Text style={appScreenStyles.note}>
          {t('directorAssistantCoaches.noTeams')}
        </Text>
      ) : null}
      <View style={styles.choiceGrid}>
        {teams.map((team) => {
          const isSelected = team.id === selectedTeamId;

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              key={team.id}
              onPress={() => onSelectedTeamIdChange(team.id)}
              style={[styles.choiceButton, isSelected && styles.selectedChoice]}
            >
              <Text
                style={[
                  styles.choiceText,
                  isSelected && styles.selectedChoiceText,
                ]}
              >
                {team.name}
              </Text>
              <Text style={styles.choiceMeta}>{formatTeamMeta(team, t)}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>
        {t('directorAssistantCoaches.assignmentTypeLabel')}
      </Text>
      <View style={styles.segmentedControl}>
        {(['game', 'practice'] as AssignmentType[]).map((type) => {
          const isSelected = type === assignmentType;

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              key={type}
              onPress={() => onAssignmentTypeChange(type)}
              style={[styles.segmentButton, isSelected && styles.selectedChoice]}
            >
              <Text
                style={[
                  styles.choiceText,
                  isSelected && styles.selectedChoiceText,
                ]}
              >
                {t(`directorAssistantCoaches.assignmentTypes.${type}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.dateTimeRow}>
        <View style={styles.dateTimeField}>
          <FormField
            keyboardType="numbers-and-punctuation"
            label={t('directorAssistantCoaches.dateLabel')}
            onChangeText={onScheduledDateChange}
            placeholder={t('directorAssistantCoaches.datePlaceholder')}
            value={scheduledDate}
          />
        </View>
        <View style={styles.dateTimeField}>
          <FormField
            keyboardType="numbers-and-punctuation"
            label={t('directorAssistantCoaches.timeLabel')}
            onChangeText={onScheduledTimeChange}
            placeholder={t('directorAssistantCoaches.timePlaceholder')}
            value={scheduledTime}
          />
        </View>
      </View>

      <FormField
        autoCapitalize="sentences"
        label={t('directorAssistantCoaches.directorNoteLabel')}
        multiline
        onChangeText={onDirectorNoteChange}
        placeholder={t('directorAssistantCoaches.directorNotePlaceholder')}
        style={styles.multiline}
        value={directorNote}
      />
      {assignmentError ? (
        <Text style={authStyles.error}>{assignmentError}</Text>
      ) : null}
      {assignmentMessage ? (
        <Text style={appScreenStyles.note}>{assignmentMessage}</Text>
      ) : null}
      <Button
        color={goalRed}
        disabled={isSaving || teams.length === 0}
        title={
          isSaving
            ? t('directorAssistantCoaches.savingAssignment')
            : t('directorAssistantCoaches.saveAssignmentButton')
        }
        onPress={onSave}
      />
    </View>
  );
}

function AssignmentList({
  assignments,
  isLoading,
  loadError,
  locale,
  teams,
}: {
  assignments: CoachAssignment[];
  isLoading: boolean;
  loadError: boolean;
  locale: string;
  teams: Team[];
}) {
  const { t } = useTranslation();
  const teamById = new Map(teams.map((team) => [team.id, team]));

  return (
    <View style={styles.assignmentList}>
      <Text style={styles.sectionLabel}>
        {t('directorAssistantCoaches.assignmentsListTitle')}
      </Text>
      {isLoading ? (
        <Text style={appScreenStyles.note}>{t('common.loading')}</Text>
      ) : null}
      {loadError ? (
        <Text style={appScreenStyles.error}>
          {t('directorAssistantCoaches.assignmentsLoadError')}
        </Text>
      ) : null}
      {!isLoading && assignments.length === 0 ? (
        <Text style={appScreenStyles.note}>
          {t('directorAssistantCoaches.emptyAssignments')}
        </Text>
      ) : null}
      {assignments.map((assignment) => {
        const team = teamById.get(assignment.team_id);

        return (
          <View key={assignment.id} style={styles.assignmentCard}>
            <View style={appScreenStyles.row}>
              <Text style={styles.assignmentTeam}>
                {team?.name ?? t('directorAssistantCoaches.unknownTeam')}
              </Text>
              <Text style={styles.statusBadge}>
                {t(`directorAssistantCoaches.statuses.${assignment.status}`)}
              </Text>
            </View>
            <Text style={appScreenStyles.meta}>
              {t(`directorAssistantCoaches.assignmentTypes.${assignment.assignment_type}`)}
              {' / '}
              {formatDateTime(assignment.scheduled_at, locale)}
            </Text>
            <Text style={appScreenStyles.cardDescription}>
              {assignment.director_note ||
                t('directorAssistantCoaches.noDirectorNote')}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function defaultScheduledAt() {
  const date = new Date();
  date.setHours(16, 0, 0, 0);
  return date;
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatTimeInput(date: Date) {
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');

  return `${hour}:${minute}`;
}

function parseScheduledAt(dateValue: string, timeValue: string) {
  const dateMatch = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = timeValue.match(/^(\d{1,2}):(\d{2})$/);

  if (!dateMatch || !timeMatch) {
    return null;
  }

  const year = Number.parseInt(dateMatch[1], 10);
  const month = Number.parseInt(dateMatch[2], 10);
  const day = Number.parseInt(dateMatch[3], 10);
  const hour = Number.parseInt(timeMatch[1], 10);
  const minute = Number.parseInt(timeMatch[2], 10);
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    return null;
  }

  return date;
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

function formatCoachName(profile: Profile) {
  return profile.name?.trim() || profile.email;
}

function formatTeamMeta(
  team: Team,
  t: (key: string, values?: Record<string, unknown>) => string,
) {
  if (!team.level && !team.season) {
    return t('teamSwitcher.noDetails');
  }

  return t('directorAssistantCoaches.teamMeta', {
    level: team.level ?? t('common.notSet'),
    season: team.season ?? t('common.notSet'),
  });
}

const styles = StyleSheet.create({
  assistantButton: {
    backgroundColor: colors.fieldBackground,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 3,
    padding: 12,
  },
  assistantEmail: {
    color: slateGrey,
    fontSize: 13,
  },
  assistantList: {
    gap: 8,
  },
  assistantName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  assignmentCard: {
    backgroundColor: colors.fieldBackground,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  assignmentForm: {
    gap: 12,
  },
  assignmentList: {
    gap: 10,
    marginTop: 8,
  },
  assignmentTeam: {
    color: colors.textPrimary,
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
  },
  choiceButton: {
    backgroundColor: colors.fieldBackground,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  choiceGrid: {
    gap: 8,
  },
  choiceMeta: {
    color: slateGrey,
    fontSize: 12,
  },
  choiceText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  dateTimeField: {
    flex: 1,
    minWidth: 130,
  },
  dateTimeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  multiline: {
    minHeight: 92,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  sectionLabel: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  segmentedControl: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  segmentButton: {
    backgroundColor: colors.fieldBackground,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 112,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectedAssistantButton: {
    borderColor: goalRed,
  },
  selectedChoice: {
    backgroundColor: colors.cardPressed,
    borderColor: goalRed,
  },
  selectedChoiceText: {
    color: goalRed,
  },
  statusBadge: {
    color: goalRed,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
});
