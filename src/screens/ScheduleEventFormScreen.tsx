import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { AppButton } from '../components/AppButton';
import { AppScreen, appScreenStyles } from '../components/AppScreen';
import { FormField, authStyles } from '../components/AuthScreen';
import { LoadingState } from '../components/LoadingState';
import type { AuthenticatedStackParamList } from '../navigation/types';
import { formatDate, formatTime, overlaps } from '../schedule/dates';
import type {
  EventStaffAssignment,
  ScheduleEvent,
  ScheduleEventType,
  StaffRole,
} from '../schedule/types';
import { useActiveTeam } from '../teams/ActiveTeamContext';
import { colors, radii, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<AuthenticatedStackParamList, 'ScheduleEventForm'>;

type CoachOption = {
  id: string;
  name: string;
  email: string;
  membershipRole: StaffRole;
};

type MembershipRow = {
  user_id: string;
  membership_role: StaffRole;
};

export function ScheduleEventFormScreen({ navigation, route }: Props) {
  const { i18n, t } = useTranslation();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { activeTeam, role, schoolId, teams } = useActiveTeam();
  const eventId = route.params?.eventId;
  const [eventType, setEventType] = useState<ScheduleEventType>('practice');
  const [teamId, setTeamId] = useState(route.params?.teamId ?? activeTeam?.id ?? '');
  const [title, setTitle] = useState('');
  const [opponentName, setOpponentName] = useState('');
  const [location, setLocation] = useState('');
  const [isHome, setIsHome] = useState(true);
  const [goalieCoachAttending, setGoalieCoachAttending] = useState(false);
  const [startsAt, setStartsAt] = useState(() => makeInitialStart(route.params));
  const [endsAt, setEndsAt] = useState(() => {
    const value = makeInitialStart(route.params);
    value.setMinutes(value.getMinutes() + 90);
    return value;
  });
  const [openPicker, setOpenPicker] = useState<'date' | 'start' | 'end' | null>(null);
  const [selectedCoachIds, setSelectedCoachIds] = useState<string[]>([]);
  const [directorNotes, setDirectorNotes] = useState<Record<string, string>>({});
  const [shareWithAll, setShareWithAll] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const eventQuery = useQuery({
    queryKey: ['schedule-event', eventId],
    queryFn: async () => {
      if (!eventId) {
        throw new Error(t('scheduleForm.missingEvent'));
      }
      const { data, error: loadError } = await supabase
        .from('schedule_events')
        .select('*')
        .eq('id', eventId)
        .single();
      if (loadError) throw loadError;
      return data as ScheduleEvent;
    },
    enabled: Boolean(eventId),
  });
  const existingEvent = eventQuery.data;

  useEffect(() => {
    if (!existingEvent) return;
    setEventType(existingEvent.event_type);
    setTeamId(existingEvent.team_id);
    setTitle(existingEvent.event_type === 'practice' ? existingEvent.title : '');
    setOpponentName(existingEvent.opponent_name ?? '');
    setLocation(existingEvent.location ?? '');
    setIsHome(existingEvent.is_home ?? true);
    setGoalieCoachAttending(existingEvent.goalie_coach_attending ?? false);
    setStartsAt(new Date(existingEvent.starts_at));
    setEndsAt(new Date(existingEvent.ends_at));
  }, [existingEvent]);

  const membershipQuery = useQuery({
    queryKey: ['schedule-team-coaches', teamId],
    queryFn: async () => {
      const { data: memberships, error: membershipError } = await supabase
        .from('team_memberships')
        .select('user_id, membership_role')
        .eq('team_id', teamId);
      if (membershipError) throw membershipError;
      const rows = (memberships ?? []) as MembershipRow[];
      if (rows.length === 0) return [] as CoachOption[];
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', rows.map((row) => row.user_id));
      if (profileError) throw profileError;
      const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
      return rows.flatMap((membership) => {
        const profile = profileById.get(membership.user_id);
        if (!profile) return [];
        return [{
          id: profile.id,
          name: profile.name?.trim() || profile.email.split('@')[0],
          email: profile.email,
          membershipRole: membership.membership_role,
        }];
      });
    },
    enabled: Boolean(teamId && role === 'director'),
  });
  const coachOptions = membershipQuery.data ?? [];

  useEffect(() => {
    const requestedCoachId = route.params?.coachId;
    if (
      requestedCoachId &&
      coachOptions.some((coach) => coach.id === requestedCoachId)
    ) {
      setSelectedCoachIds((current) =>
        current.includes(requestedCoachId) ? current : [...current, requestedCoachId],
      );
    }
  }, [coachOptions, route.params?.coachId]);

  const staffQuery = useQuery({
    queryKey: ['schedule-event-staff', eventId],
    queryFn: async () => {
      if (!eventId) return [] as EventStaffAssignment[];
      const { data, error: staffError } = await supabase.rpc('get_schedule_event_staff', {
        check_event_ids: [eventId],
      });
      if (staffError) throw staffError;
      return (data ?? []) as EventStaffAssignment[];
    },
    enabled: Boolean(eventId && role === 'director'),
  });

  useEffect(() => {
    if (!staffQuery.data) return;
    setSelectedCoachIds(staffQuery.data.map((assignment) => assignment.coach_user_id));
  }, [staffQuery.data]);

  const selectedCoaches = useMemo(
    () => coachOptions.filter((coach) => selectedCoachIds.includes(coach.id)),
    [coachOptions, selectedCoachIds],
  );
  const canManageStaff = role === 'director';
  const canSave = Boolean(teamId && schoolId && session && endsAt > startsAt);

  function changePicker(event: DateTimePickerEvent, value?: Date) {
    if (Platform.OS !== 'ios') setOpenPicker(null);
    if (event.type === 'dismissed' || !value || !openPicker) return;
    if (openPicker === 'date') {
      setStartsAt(mergeDateAndTime(value, startsAt));
      setEndsAt(mergeDateAndTime(value, endsAt));
    } else if (openPicker === 'start') {
      const nextStart = mergeDateAndTime(startsAt, value);
      const duration = Math.max(30 * 60_000, endsAt.getTime() - startsAt.getTime());
      setStartsAt(nextStart);
      setEndsAt(new Date(nextStart.getTime() + duration));
    } else {
      setEndsAt(mergeDateAndTime(startsAt, value));
    }
  }

  async function save(skipConflictWarning = false) {
    if (!canSave || !session || !schoolId) {
      setError(t('scheduleForm.requiredError'));
      return;
    }
    if (eventType === 'practice' && !title.trim()) {
      setError(t('scheduleForm.practiceTitleRequired'));
      return;
    }
    if (eventType === 'game' && !opponentName.trim()) {
      setError(t('scheduleForm.opponentRequired'));
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (canManageStaff && !skipConflictWarning && selectedCoachIds.length > 0) {
        const conflicts = await findConflicts(selectedCoachIds, startsAt, endsAt, eventId);
        if (conflicts.length > 0) {
          setSaving(false);
          Alert.alert(
            t('scheduleForm.conflictTitle'),
            t('scheduleForm.conflictDescription', { count: conflicts.length }),
            [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('scheduleForm.saveAnyway'), onPress: () => void save(true) },
            ],
          );
          return;
        }
      }

      let gameId = existingEvent?.game_id ?? null;
      if (eventType === 'game') {
        const gamePayload = {
          team_id: teamId,
          opponent_name: opponentName.trim(),
          game_date: startsAt.toISOString(),
          location: location.trim() || null,
          is_home: isHome,
        };
        if (gameId) {
          const { error: gameError } = await supabase.from('games').update(gamePayload).eq('id', gameId);
          if (gameError) throw gameError;
        } else {
          const { data, error: gameError } = await supabase
            .from('games')
            .insert(gamePayload)
            .select('id')
            .single();
          if (gameError) throw gameError;
          gameId = data.id;
        }
      }

      const payload = {
        school_id: schoolId,
        team_id: teamId,
        event_type: eventType,
        title: eventType === 'game' ? opponentName.trim() : title.trim(),
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        location: location.trim() || null,
        opponent_name: eventType === 'game' ? opponentName.trim() : null,
        is_home: eventType === 'game' ? isHome : null,
        goalie_coach_attending: eventType === 'practice' ? goalieCoachAttending : null,
        game_id: eventType === 'game' ? gameId : null,
      };
      let savedEventId = eventId;
      if (eventId) {
        const { error: eventError } = await supabase.from('schedule_events').update(payload).eq('id', eventId);
        if (eventError) throw eventError;
        if (eventType === 'practice' && existingEvent?.practice_plan_id) {
          const { error: planDateError } = await supabase
            .from('practice_plans')
            .update({ practice_date: startsAt.toISOString() })
            .eq('id', existingEvent.practice_plan_id);
          if (planDateError) throw planDateError;
        }
      } else {
        const { data, error: eventError } = await supabase
          .from('schedule_events')
          .insert({ ...payload, created_by: session.user.id })
          .select('id')
          .single();
        if (eventError) throw eventError;
        savedEventId = data.id;
      }
      if (!savedEventId) throw new Error(t('scheduleForm.saveError'));

      if (canManageStaff) {
        await syncStaff(savedEventId, selectedCoaches, staffQuery.data ?? [], session.user.id);
        const notes = selectedCoaches.flatMap((coach) => {
          const body = (directorNotes[coach.id] || shareWithAll).trim();
          return body ? [{
            event_id: savedEventId,
            sender_user_id: session.user.id,
            recipient_user_id: coach.id,
            body,
          }] : [];
        });
        if (notes.length > 0) {
          const { error: noteError } = await supabase.from('event_private_notes').insert(notes);
          if (noteError) throw noteError;
        }
      } else if (!eventId && role === 'coach') {
        const { error: selfAssignError } = await supabase.from('event_staff_assignments').insert({
          event_id: savedEventId,
          coach_user_id: session.user.id,
          coach_role: 'head_coach',
          status: 'confirmed',
          assigned_by: session.user.id,
        });
        if (selfAssignError) throw selfAssignError;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['schedule-events'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['schedule-event', savedEventId] }),
        queryClient.invalidateQueries({ queryKey: ['schedule-event-staff', savedEventId] }),
        queryClient.invalidateQueries({ queryKey: ['games'] }),
      ]);
      navigation.goBack();
    } catch (saveError) {
      console.error('Unable to save schedule event:', saveError);
      setError(t('scheduleForm.saveError'));
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (!existingEvent) return;
    Alert.alert(
      t('scheduleForm.deleteTitle'),
      t('scheduleForm.deleteDescription'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('scheduleForm.deleteButton'),
          style: 'destructive',
          onPress: () => void deleteEvent(),
        },
      ],
    );
  }

  async function deleteEvent() {
    if (!existingEvent) return;
    setSaving(true);
    setError('');
    const { error: deleteError } = await supabase
      .from('schedule_events')
      .delete()
      .eq('id', existingEvent.id);
    if (deleteError) {
      setError(t('scheduleForm.deleteError'));
      setSaving(false);
      return;
    }
    if (existingEvent.game_id) {
      const { error: gameDeleteError } = await supabase
        .from('games')
        .delete()
        .eq('id', existingEvent.game_id);
      if (gameDeleteError) {
        console.error('Scheduled event removed but game cleanup failed:', gameDeleteError);
      }
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['schedule-events'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['games'] }),
    ]);
    navigation.goBack();
  }

  if (eventQuery.isLoading) {
    return <AppScreen title={t('scheduleForm.title')}><LoadingState /></AppScreen>;
  }

  return (
    <AppScreen
      description={t('scheduleForm.description')}
      title={eventId ? t('scheduleForm.editTitle') : t('scheduleForm.addTitle')}
    >
      <Text style={styles.label}>{t('scheduleForm.typeLabel')}</Text>
      <View style={styles.segmented}>
        {(['practice', 'game'] as ScheduleEventType[]).map((type) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: eventType === type }}
            disabled={Boolean(eventId)}
            key={type}
            onPress={() => setEventType(type)}
            style={[styles.segment, eventType === type && styles.segmentActive]}
          >
            <Text style={styles.segmentText}>{t(`schedule.eventTypes.${type}`)}</Text>
          </Pressable>
        ))}
      </View>

      {role === 'director' ? (
        <ChoiceSection
          label={t('scheduleForm.teamLabel')}
          options={teams.map((team) => ({ id: team.id, label: team.name }))}
          selected={[teamId]}
          onToggle={(id) => setTeamId(id)}
          single
        />
      ) : null}

      {eventType === 'practice' ? (
        <FormField label={t('scheduleForm.practiceTitleLabel')} onChangeText={setTitle} value={title} />
      ) : (
        <>
          <FormField label={t('scheduleForm.opponentLabel')} onChangeText={setOpponentName} value={opponentName} />
          <View style={styles.switchRow}>
            <Text style={styles.label}>{t('scheduleForm.homeGameLabel')}</Text>
            <Switch value={isHome} onValueChange={setIsHome} />
          </View>
        </>
      )}
      <FormField label={t('scheduleForm.locationLabel')} onChangeText={setLocation} value={location} />

      <View style={styles.dateRow}>
        <DateButton label={t('scheduleForm.dateLabel')} value={formatDate(startsAt, i18n.language)} onPress={() => setOpenPicker('date')} />
        <DateButton label={t('scheduleForm.startLabel')} value={formatTime(startsAt, i18n.language)} onPress={() => setOpenPicker('start')} />
        <DateButton label={t('scheduleForm.endLabel')} value={formatTime(endsAt, i18n.language)} onPress={() => setOpenPicker('end')} />
      </View>
      {openPicker ? (
        <View style={styles.pickerCard}>
          <DateTimePicker
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            mode={openPicker === 'date' ? 'date' : 'time'}
            onChange={changePicker}
            value={openPicker === 'end' ? endsAt : startsAt}
          />
          {Platform.OS === 'ios' ? (
            <AppButton title={t('common.done')} onPress={() => setOpenPicker(null)} variant="secondary" />
          ) : null}
        </View>
      ) : null}

      {eventType === 'practice' ? (
        <View style={styles.switchRow}>
          <Text style={styles.label}>{t('scheduleForm.goalieCoachLabel')}</Text>
          <Switch value={goalieCoachAttending} onValueChange={setGoalieCoachAttending} />
        </View>
      ) : null}

      {canManageStaff ? (
        <>
          <ChoiceSection
            label={t('scheduleForm.staffLabel')}
            options={coachOptions.map((coach) => ({
              id: coach.id,
              label: coach.name,
              meta: t(`schedule.staffRoles.${coach.membershipRole}`),
            }))}
            selected={selectedCoachIds}
            onToggle={(id) => setSelectedCoachIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])}
          />
          <FormField
            label={t('scheduleForm.shareAllNoteLabel')}
            multiline
            onChangeText={setShareWithAll}
            value={shareWithAll}
          />
          {selectedCoaches.map((coach) => (
            <FormField
              key={coach.id}
              label={t('scheduleForm.privateNoteLabel', { name: coach.name })}
              multiline
              onChangeText={(value) => setDirectorNotes((current) => ({ ...current, [coach.id]: value }))}
              value={directorNotes[coach.id] ?? ''}
            />
          ))}
        </>
      ) : null}

      {membershipQuery.error || eventQuery.error || staffQuery.error ? (
        <Text style={appScreenStyles.error}>{t('scheduleForm.loadError')}</Text>
      ) : null}
      {error ? <Text style={authStyles.error}>{error}</Text> : null}
      <AppButton
        disabled={!canSave || saving}
        icon="save-outline"
        title={saving ? t('common.saving') : t('common.save')}
        onPress={() => void save()}
      />
      {existingEvent ? (
        <AppButton
          disabled={saving}
          icon="trash-outline"
          title={t('scheduleForm.deleteButton')}
          onPress={confirmDelete}
          variant="danger"
        />
      ) : null}
    </AppScreen>
  );
}

function DateButton({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.dateButton}>
      <Text style={styles.dateButtonLabel}>{label}</Text>
      <Text style={styles.dateButtonValue}>{value}</Text>
    </Pressable>
  );
}

function ChoiceSection({ label, options, selected, onToggle, single = false }: {
  label: string;
  options: Array<{ id: string; label: string; meta?: string }>;
  selected: string[];
  onToggle: (id: string) => void;
  single?: boolean;
}) {
  return (
    <View style={styles.choiceSection}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.choiceGrid}>
        {options.map((option) => {
          const active = selected.includes(option.id);
          return (
            <Pressable
              accessibilityRole={single ? 'radio' : 'checkbox'}
              accessibilityState={{ checked: active }}
              key={option.id}
              onPress={() => onToggle(option.id)}
              style={[styles.choice, active && styles.choiceActive]}
            >
              <Text style={styles.choiceText}>{option.label}</Text>
              {option.meta ? <Text style={styles.choiceMeta}>{option.meta}</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

async function findConflicts(coachIds: string[], startsAt: Date, endsAt: Date, eventId?: string) {
  const { data: assignments, error } = await supabase
    .from('event_staff_assignments')
    .select('event_id, coach_user_id')
    .in('coach_user_id', coachIds);
  if (error) throw error;
  const eventIds = Array.from(new Set((assignments ?? []).map((row) => row.event_id))).filter((id) => id !== eventId);
  if (eventIds.length === 0) return [];
  const { data: events, error: eventError } = await supabase
    .from('schedule_events')
    .select('id, starts_at, ends_at')
    .in('id', eventIds);
  if (eventError) throw eventError;
  return (events ?? []).filter((event) => overlaps(startsAt, endsAt, event.starts_at, event.ends_at));
}

async function syncStaff(eventId: string, selected: CoachOption[], existing: EventStaffAssignment[], assignedBy: string) {
  const selectedIds = new Set(selected.map((coach) => coach.id));
  const removedIds = existing.filter((row) => !selectedIds.has(row.coach_user_id)).map((row) => row.id);
  if (removedIds.length > 0) {
    const { error } = await supabase.from('event_staff_assignments').delete().in('id', removedIds);
    if (error) throw error;
  }
  for (const coach of selected) {
    const current = existing.find((row) => row.coach_user_id === coach.id);
    if (!current) {
      const { error } = await supabase.from('event_staff_assignments').insert({
        event_id: eventId,
        coach_user_id: coach.id,
        coach_role: coach.membershipRole,
        assigned_by: assignedBy,
      });
      if (error) throw error;
    } else if (current.coach_role !== coach.membershipRole) {
      const { error } = await supabase.from('event_staff_assignments').update({ coach_role: coach.membershipRole }).eq('id', current.id);
      if (error) throw error;
    }
  }
}

function makeInitialStart(params: Props['route']['params']) {
  const base = params?.defaultDate ? new Date(`${params.defaultDate}T12:00:00`) : new Date();
  base.setHours(params?.defaultHour ?? Math.max(8, base.getHours() + 1), 0, 0, 0);
  return base;
}

function mergeDateAndTime(datePart: Date, timePart: Date) {
  const result = new Date(datePart);
  result.setHours(timePart.getHours(), timePart.getMinutes(), 0, 0);
  return result;
}

const styles = StyleSheet.create({
  choice: {
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    minWidth: 130,
    padding: spacing.md,
  },
  choiceActive: { backgroundColor: colors.cardPressed, borderColor: colors.goalRed },
  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choiceMeta: { color: colors.slateGrey, fontSize: 12, marginTop: spacing.xs },
  choiceSection: { gap: spacing.sm },
  choiceText: { color: colors.textPrimary, fontWeight: '700' },
  dateButton: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexGrow: 1,
    minWidth: 100,
    padding: spacing.md,
  },
  dateButtonLabel: { color: colors.slateGrey, fontSize: 12 },
  dateButtonValue: { color: colors.textPrimary, fontWeight: '700', marginTop: spacing.xs },
  dateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  label: { color: colors.iceWhite, fontSize: 15, fontWeight: '700' },
  pickerCard: { backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.md },
  segment: { alignItems: 'center', borderRadius: radii.md, flex: 1, padding: spacing.md },
  segmentActive: { backgroundColor: colors.goalRed },
  segmentText: { color: colors.iceWhite, fontWeight: '700' },
  segmented: { backgroundColor: colors.rinkSurface, borderRadius: radii.md, flexDirection: 'row', padding: spacing.xs },
  switchRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
});
