import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import type { MarkedDates } from 'react-native-calendars/src/types';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { AppButton } from '../components/AppButton';
import { AppIcon } from '../components/AppIcon';
import { AppScreen, appScreenStyles } from '../components/AppScreen';
import { FormField } from '../components/AuthScreen';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { fetchWithCache, makeTeamCacheKey } from '../offline/cache';
import { OfflineNotice } from '../offline/OfflineNotice';
import type {
  AuthenticatedStackParamList,
  AuthenticatedTabParamList,
} from '../navigation/types';
import {
  addDays,
  addMonths,
  formatDate,
  formatMonth,
  formatTime,
  fromDateKey,
  getWeekDays,
  isOnDate,
  toDateKey,
} from '../schedule/dates';
import type {
  EventPrivateNote,
  EventStaffAssignment,
  ScheduleEvent,
} from '../schedule/types';
import { useActiveTeam } from '../teams/ActiveTeamContext';
import {
  colors,
  fontSizes,
  hornAmber,
  radii,
  spacing,
} from '../theme/theme';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AuthenticatedTabParamList, 'ScheduleTab'>,
  NativeStackScreenProps<AuthenticatedStackParamList>
>;

type ScheduleView = 'day' | 'week' | 'month';
type TypeFilter = 'all' | 'game' | 'practice';

const HOURS = Array.from({ length: 24 }, (_, index) => index);

export function ScheduleScreen({ navigation, route }: Props) {
  const { i18n, t } = useTranslation();
  const { session } = useAuth();
  const { activeTeam, isAllTeams, role, setActiveTeam, teams } = useActiveTeam();
  const [view, setView] = useState<ScheduleView>('day');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [coachFilter, setCoachFilter] = useState('all');
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()));
  const [selectedEventId, setSelectedEventId] = useState<string | null>(route.params?.eventId ?? null);
  const [exporting, setExporting] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);

  useEffect(() => {
    if (route.params?.eventId) setSelectedEventId(route.params.eventId);
  }, [route.params?.eventId]);
  const teamIds = useMemo(
    () => isAllTeams ? teams.map((team) => team.id) : activeTeam ? [activeTeam.id] : [],
    [activeTeam, isAllTeams, teams],
  );
  const teamIdsKey = teamIds.join(',');
  const eventsQuery = useQuery({
    queryKey: ['schedule-events', session?.user.id, teamIdsKey],
    queryFn: async () => {
      if (teamIds.length === 0) return [] as ScheduleEvent[];
      const fetcher = async () => {
        const { data, error } = await supabase
          .from('schedule_events')
          .select('*')
          .in('team_id', teamIds)
          .order('starts_at');
        if (error) throw error;
        return (data ?? []) as ScheduleEvent[];
      };
      if (teamIds.length === 1) {
        return fetchWithCache({
          cacheKey: makeTeamCacheKey('schedule-events', teamIds[0]),
          fetcher,
          onCacheFallback: setCachedAt,
          onNetworkSuccess: () => setCachedAt(null),
        });
      }
      setCachedAt(null);
      return fetcher();
    },
    enabled: teamIds.length > 0,
  });
  const refetchEvents = eventsQuery.refetch;
  useFocusEffect(useCallback(() => { void refetchEvents(); }, [refetchEvents]));

  const allEvents = eventsQuery.data ?? [];
  const eventIds = allEvents.map((event) => event.id);
  const staffQuery = useQuery({
    queryKey: ['schedule-event-staff-list', eventIds.join(',')],
    queryFn: async () => {
      if (eventIds.length === 0) return [] as EventStaffAssignment[];
      const { data, error } = await supabase.rpc('get_schedule_event_staff', {
        check_event_ids: eventIds,
      });
      if (error) throw error;
      return (data ?? []) as EventStaffAssignment[];
    },
    enabled: eventIds.length > 0,
  });
  const staff = staffQuery.data ?? [];
  const staffByEvent = useMemo(() => groupStaff(staff), [staff]);
  const filteredEvents = allEvents.filter((event) => {
    if (typeFilter !== 'all' && event.event_type !== typeFilter) return false;
    if (coachFilter !== 'all' && !staffByEvent.get(event.id)?.some((row) => row.coach_user_id === coachFilter)) return false;
    return true;
  });
  const weekDays = getWeekDays(fromDateKey(selectedDateKey));
  const selectedEvent = allEvents.find((event) => event.id === selectedEventId) ?? null;
  const canCreate = role === 'director' || activeTeam?.membership_role === 'head_coach';

  function moveDate(direction: -1 | 1) {
    const current = fromDateKey(selectedDateKey);
    const next = view === 'day'
      ? addDays(current, direction)
      : view === 'week'
        ? addDays(current, direction * 7)
        : addMonths(current, direction);
    setSelectedDateKey(toDateKey(next));
  }

  function createAt(dateKey = selectedDateKey, hour?: number) {
    navigation.navigate('ScheduleEventForm', {
      defaultDate: dateKey,
      defaultHour: hour,
      teamId: activeTeam?.id,
    });
  }

  async function exportSchedule() {
    if (view === 'day') return;
    setExporting(true);
    try {
      const visible = view === 'week'
        ? filteredEvents.filter((event) => weekDays.some((day) => isOnDate(event.starts_at, day.dateKey)))
        : filteredEvents.filter((event) => {
          const date = new Date(event.starts_at);
          const selected = fromDateKey(selectedDateKey);
          return date.getFullYear() === selected.getFullYear() && date.getMonth() === selected.getMonth();
        });
      const html = buildExportHtml(visible, teams, i18n.language, {
        title: t('schedule.title'),
        date: t('schedule.export.date'),
        time: t('schedule.export.time'),
        event: t('schedule.export.event'),
        team: t('schedule.export.team'),
        location: t('schedule.export.location'),
      });
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { UTI: 'com.adobe.pdf', mimeType: 'application/pdf' });
      }
    } finally {
      setExporting(false);
    }
  }

  if (teamIds.length === 0) {
    return (
      <AppScreen title={t('schedule.title')} description={t('schedule.noTeamDescription')}>
        <EmptyState icon="calendar-outline" title={t('schedule.noTeamTitle')} description={t('schedule.noTeamDescription')} />
      </AppScreen>
    );
  }

  return (
    <AppScreen
      title={t('schedule.title')}
      description={isAllTeams ? t('schedule.allTeamsDescription') : t('schedule.teamDescription', { teamName: activeTeam?.name })}
      action={canCreate ? <AppButton icon="add-circle-outline" title={t('schedule.addEvent')} onPress={() => createAt()} /> : undefined}
    >
      <SegmentedControl options={['day', 'week', 'month']} value={view} onChange={setView} label={(value) => t(`schedule.views.${value}`)} />
      <View style={styles.dateNavigation}>
        <Pressable accessibilityLabel={t('schedule.previous')} onPress={() => moveDate(-1)} style={styles.iconButton}>
          <AppIcon color={colors.iceWhite} name="chevron-back" />
        </Pressable>
        <Pressable onPress={() => setSelectedDateKey(toDateKey(new Date()))} style={styles.todayButton}>
          <Text style={styles.todayText}>{t('schedule.today')}</Text>
        </Pressable>
        <Text style={styles.periodLabel} numberOfLines={1}>
          {view === 'month' ? formatMonth(fromDateKey(selectedDateKey), i18n.language) : formatDate(fromDateKey(selectedDateKey), i18n.language)}
        </Text>
        <Pressable accessibilityLabel={t('schedule.next')} onPress={() => moveDate(1)} style={styles.iconButton}>
          <AppIcon color={colors.iceWhite} name="chevron-forward" />
        </Pressable>
      </View>
      <SegmentedControl options={['all', 'game', 'practice']} value={typeFilter} onChange={setTypeFilter} label={(value) => t(`schedule.filters.${value}`)} />
      <StaffFilterControl
        currentUserId={session?.user.id ?? ''}
        role={role}
        staff={staff}
        value={coachFilter}
        onChange={setCoachFilter}
      />
      {view !== 'day' ? (
        <AppButton
          disabled={exporting}
          icon="download-outline"
          title={exporting ? t('calendar.exporting') : t('calendar.exportButton')}
          onPress={() => void exportSchedule()}
          variant="secondary"
        />
      ) : null}
      {eventsQuery.isLoading || staffQuery.isLoading ? <LoadingState /> : null}
      {eventsQuery.error || staffQuery.error ? <Text style={appScreenStyles.error}>{t('schedule.loadError')}</Text> : null}
      <OfflineNotice cachedAt={cachedAt} />
      {view === 'day' ? (
        <DayGrid
          canCreate={canCreate}
          dateKey={selectedDateKey}
          events={filteredEvents.filter((event) => isOnDate(event.starts_at, selectedDateKey))}
          locale={i18n.language}
          staffByEvent={staffByEvent}
          teams={teams}
          onCreate={createAt}
          onEdit={(event) => canCreate && navigation.navigate('ScheduleEventForm', { eventId: event.id })}
          onOpen={(event) => setSelectedEventId(event.id)}
        />
      ) : null}
      {view === 'week' ? (
        <WeekGrid
          canCreate={canCreate}
          days={weekDays}
          events={filteredEvents}
          locale={i18n.language}
          teams={teams}
          onCreate={createAt}
          onEdit={(event) => canCreate && navigation.navigate('ScheduleEventForm', { eventId: event.id })}
          onOpen={(event) => setSelectedEventId(event.id)}
          onSelectDate={setSelectedDateKey}
        />
      ) : null}
      {view === 'month' ? (
        <MonthGrid
          events={filteredEvents}
          selectedDateKey={selectedDateKey}
          staffByEvent={staffByEvent}
          teams={teams}
          onEdit={(event) => canCreate && navigation.navigate('ScheduleEventForm', { eventId: event.id })}
          onOpen={(event) => setSelectedEventId(event.id)}
          onSelectDate={setSelectedDateKey}
        />
      ) : null}
      <EventDetailModal
        event={selectedEvent}
        staff={selectedEvent ? staffByEvent.get(selectedEvent.id) ?? [] : []}
        teamName={teams.find((team) => team.id === selectedEvent?.team_id)?.name ?? ''}
        onClose={() => setSelectedEventId(null)}
        onEdit={() => selectedEvent && navigation.navigate('ScheduleEventForm', { eventId: selectedEvent.id })}
        onOpenGame={() => selectedEvent?.game_id && navigation.navigate('GameForm', { gameId: selectedEvent.game_id, readOnly: role === 'coach' && activeTeam?.membership_role === 'assistant_coach' })}
        onOpenPlan={() => {
          if (!selectedEvent) return;
          const eventTeam = teams.find((team) => team.id === selectedEvent.team_id);
          if (eventTeam) setActiveTeam(eventTeam);
          navigation.navigate('PracticePlanDetail', selectedEvent.practice_plan_id
            ? { practicePlanId: selectedEvent.practice_plan_id, readOnly: role === 'coach' && activeTeam?.membership_role === 'assistant_coach' }
            : { scheduleEventId: selectedEvent.id, scheduledAt: selectedEvent.starts_at });
        }}
      />
    </AppScreen>
  );
}

function DayGrid({ canCreate, dateKey, events, locale, staffByEvent, teams, onCreate, onEdit, onOpen }: {
  canCreate: boolean;
  dateKey: string;
  events: ScheduleEvent[];
  locale: string;
  staffByEvent: Map<string, EventStaffAssignment[]>;
  teams: ReturnType<typeof useActiveTeam>['teams'];
  onCreate: (dateKey: string, hour: number) => void;
  onEdit: (event: ScheduleEvent) => void;
  onOpen: (event: ScheduleEvent) => void;
}) {
  return (
    <View style={styles.gridCard}>
      {HOURS.map((hour) => {
        const hourEvents = events.filter((event) => new Date(event.starts_at).getHours() === hour);
        return (
          <Pressable
            accessibilityRole="button"
            disabled={!canCreate}
            key={hour}
            onPress={() => hourEvents.length === 0 && onCreate(dateKey, hour)}
            style={styles.hourRow}
          >
            <Text style={styles.hourLabel}>{formatHour(hour, locale)}</Text>
            <View style={styles.hourContent}>
              {hourEvents.map((event) => (
                <EventBlock
                  event={event}
                  key={event.id}
                  staff={staffByEvent.get(event.id) ?? []}
                  teamName={teams.find((team) => team.id === event.team_id)?.name ?? ''}
                  onLongPress={() => onEdit(event)}
                  onPress={() => onOpen(event)}
                />
              ))}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function WeekGrid({ canCreate, days, events, locale, teams, onCreate, onEdit, onOpen, onSelectDate }: {
  canCreate: boolean;
  days: ReturnType<typeof getWeekDays>;
  events: ScheduleEvent[];
  locale: string;
  teams: ReturnType<typeof useActiveTeam>['teams'];
  onCreate: (dateKey: string, hour: number) => void;
  onEdit: (event: ScheduleEvent) => void;
  onOpen: (event: ScheduleEvent) => void;
  onSelectDate: (dateKey: string) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator>
      <View style={styles.weekGrid}>
        <View style={styles.weekHeaderRow}>
          <View style={styles.weekTimeColumn} />
          {days.map((day) => (
            <Pressable key={day.dateKey} onPress={() => onSelectDate(day.dateKey)} style={styles.weekDayHeader}>
              <Text style={styles.weekDayText}>{new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(day.date)}</Text>
              <Text style={styles.weekDayNumber}>{day.date.getDate()}</Text>
            </Pressable>
          ))}
        </View>
        {HOURS.map((hour) => (
          <View key={hour} style={styles.weekHourRow}>
            <Text style={styles.weekTimeColumn}>{formatHour(hour, locale)}</Text>
            {days.map((day) => {
              const slotEvents = events.filter((event) => isOnDate(event.starts_at, day.dateKey) && new Date(event.starts_at).getHours() === hour);
              return (
                <Pressable
                  disabled={!canCreate}
                  key={day.dateKey}
                  onPress={() => slotEvents.length === 0 && onCreate(day.dateKey, hour)}
                  style={styles.weekSlot}
                >
                  {slotEvents.map((event) => (
                    <Pressable key={event.id} onPress={() => onOpen(event)} onLongPress={() => onEdit(event)} style={[styles.weekEvent, { borderLeftColor: teamColor(event.team_id, teams) }]}>
                      <Text numberOfLines={1} style={styles.weekEventText}>{event.title}</Text>
                      <Text numberOfLines={1} style={styles.weekEventMeta}>
                        {teams.find((team) => team.id === event.team_id)?.name ?? ''}
                      </Text>
                    </Pressable>
                  ))}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function MonthGrid({ events, selectedDateKey, staffByEvent, teams, onSelectDate, onOpen, onEdit }: {
  events: ScheduleEvent[];
  selectedDateKey: string;
  staffByEvent: Map<string, EventStaffAssignment[]>;
  teams: ReturnType<typeof useActiveTeam>['teams'];
  onSelectDate: (value: string) => void;
  onOpen: (event: ScheduleEvent) => void;
  onEdit: (event: ScheduleEvent) => void;
}) {
  const markedDates: MarkedDates = {};
  for (const event of events) {
    const key = toDateKey(new Date(event.starts_at));
    markedDates[key] = { marked: true, dotColor: event.event_type === 'game' ? colors.goalRed : hornAmber };
  }
  markedDates[selectedDateKey] = { ...(markedDates[selectedDateKey] ?? {}), selected: true, selectedColor: colors.frostSteel };
  const selectedEvents = events.filter((event) => isOnDate(event.starts_at, selectedDateKey));
  return (
    <View style={styles.monthStack}>
      <View style={styles.calendarCard}>
        <Calendar markedDates={markedDates} onDayPress={(day) => onSelectDate(day.dateString)} />
      </View>
      {selectedEvents.length === 0 ? <Text style={appScreenStyles.note}>—</Text> : selectedEvents.map((event) => (
        <EventBlock
          event={event}
          key={event.id}
          staff={staffByEvent.get(event.id) ?? []}
          teamName={teams.find((team) => team.id === event.team_id)?.name ?? ''}
          onLongPress={() => onEdit(event)}
          onPress={() => onOpen(event)}
        />
      ))}
    </View>
  );
}

function EventBlock({ event, staff, teamName, onPress, onLongPress }: {
  event: ScheduleEvent;
  staff: EventStaffAssignment[];
  teamName: string;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const { i18n, t } = useTranslation();
  return (
    <AnimatedPressable accessibilityRole="button" onLongPress={onLongPress} onPress={onPress} style={[styles.eventBlock, event.event_type === 'game' ? styles.gameBlock : styles.practiceBlock]}>
      <View style={styles.eventHeading}>
        <Text numberOfLines={1} style={styles.eventTitle}>{event.title}</Text>
        <Text style={styles.eventTypeText}>{t(`schedule.eventTypes.${event.event_type}`).toLocaleUpperCase(i18n.language)}</Text>
      </View>
      <Text style={styles.eventMeta}>{formatTime(event.starts_at, i18n.language)}–{formatTime(event.ends_at, i18n.language)}{teamName ? ` • ${teamName}` : ''}</Text>
      {event.location ? <Text numberOfLines={1} style={styles.eventMeta}>{event.location}</Text> : null}
      {staff.length > 0 ? <Text numberOfLines={1} style={styles.eventMeta}>{staff.map((row) => `${row.coach_name} (${t(`schedule.statuses.${row.status}`)})`).join(', ')}</Text> : null}
    </AnimatedPressable>
  );
}

function EventDetailModal({ event, staff, teamName, onClose, onEdit, onOpenGame, onOpenPlan }: {
  event: ScheduleEvent | null;
  staff: EventStaffAssignment[];
  teamName: string;
  onClose: () => void;
  onEdit: () => void;
  onOpenGame: () => void;
  onOpenPlan: () => void;
}) {
  const { i18n, t } = useTranslation();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { activeTeam, role } = useActiveTeam();
  const [coachNote, setCoachNote] = useState('');
  const [message, setMessage] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const notesQuery = useQuery({
    queryKey: ['event-private-notes', event?.id],
    queryFn: async () => {
      if (!event) return [] as EventPrivateNote[];
      const { data, error } = await supabase.rpc('get_event_private_notes', { check_event_id: event.id });
      if (error) throw error;
      return (data ?? []) as EventPrivateNote[];
    },
    enabled: Boolean(event),
  });
  if (!event) return null;
  const eventId = event.id;
  const myAssignment = staff.find((row) => row.coach_user_id === session?.user.id);
  const canEdit = role === 'director' || activeTeam?.membership_role === 'head_coach';
  const recipients = staff.filter((row) => row.coach_user_id !== session?.user.id && (role === 'director' || row.coach_role === 'assistant_coach'));

  async function respond(status: 'confirmed' | 'declined') {
    if (!myAssignment) return;
    const { error } = await supabase.from('event_staff_assignments').update({
      status,
      decline_reason: status === 'declined' ? coachNote.trim() || null : null,
      coach_note: coachNote.trim() || null,
    }).eq('id', myAssignment.id);
    if (!error) {
      await queryClient.invalidateQueries({ queryKey: ['schedule-event-staff-list'] });
    }
  }

  async function sendMessage() {
    if (!session || !recipientId || !message.trim()) return;
    const { error } = await supabase.from('event_private_notes').insert({
      event_id: eventId,
      sender_user_id: session.user.id,
      recipient_user_id: recipientId,
      body: message.trim(),
    });
    if (!error) {
      setMessage('');
      await queryClient.invalidateQueries({ queryKey: ['event-private-notes', eventId] });
    }
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible>
      <SafeAreaView style={styles.detailRoot}>
        <Pressable onPress={onClose} style={styles.detailBackdrop} />
        <ScrollView contentContainerStyle={styles.detailCard}>
          <View style={styles.detailHeader}>
            <View style={styles.detailHeaderCopy}>
              <Text style={appScreenStyles.cardTitle}>{event.title}</Text>
              <Text style={appScreenStyles.meta}>{teamName} • {t(`schedule.eventTypes.${event.event_type}`)}</Text>
            </View>
            <Pressable accessibilityLabel={t('common.close')} onPress={onClose}><AppIcon name="close" /></Pressable>
          </View>
          <Text style={appScreenStyles.cardDescription}>{formatDate(event.starts_at, i18n.language)} • {formatTime(event.starts_at, i18n.language)}–{formatTime(event.ends_at, i18n.language)}</Text>
          <Text style={appScreenStyles.cardDescription}>{event.location || t('calendar.noLocation')}</Text>
          {event.event_type === 'game' ? <Text style={appScreenStyles.cardDescription}>{event.is_home ? t('schedule.home') : t('schedule.away')} • {event.opponent_name}</Text> : <Text style={appScreenStyles.cardDescription}>{t('schedule.goalieCoach', { value: event.goalie_coach_attending ? t('common.yes') : t('common.no') })}</Text>}
          <Text style={styles.sectionTitle}>{t('schedule.staffTitle')}</Text>
          {staff.map((assignment) => (
            <View key={assignment.id} style={styles.staffRow}>
              <View style={styles.staffCopy}>
                <Text style={styles.staffName}>{assignment.coach_name}</Text>
                <Text style={appScreenStyles.meta}>{t(`schedule.staffRoles.${assignment.coach_role}`)}</Text>
              </View>
              <Text style={[styles.statusBadge, assignment.status === 'declined' && styles.declinedBadge]}>{t(`schedule.statuses.${assignment.status}`)}</Text>
            </View>
          ))}
          {myAssignment ? (
            <View style={styles.responseBox}>
              <FormField label={t('schedule.ownNoteLabel')} multiline onChangeText={setCoachNote} value={coachNote} />
              <View style={styles.actionRow}>
                <AppButton icon="checkmark-circle-outline" title={t('schedule.accept')} onPress={() => void respond('confirmed')} />
                <AppButton icon="close-circle-outline" title={t('schedule.decline')} onPress={() => void respond('declined')} variant="secondary" />
              </View>
            </View>
          ) : null}
          {(notesQuery.data ?? []).map((note) => (
            <View key={note.id} style={styles.noteCard}>
              <Text style={styles.staffName}>{note.sender_name} → {note.recipient_name}</Text>
              <Text style={appScreenStyles.cardDescription}>{note.body}</Text>
            </View>
          ))}
          {recipients.length > 0 ? (
            <View style={styles.responseBox}>
              <Text style={styles.sectionTitle}>{t('schedule.privateMessageTitle')}</Text>
              <View style={styles.actionRow}>
                {recipients.map((recipient) => (
                  <Pressable key={recipient.coach_user_id} onPress={() => setRecipientId(recipient.coach_user_id)} style={[styles.recipientChip, recipientId === recipient.coach_user_id && styles.recipientChipActive]}>
                    <Text style={styles.recipientText}>{recipient.coach_name}</Text>
                  </Pressable>
                ))}
              </View>
              <FormField label={t('schedule.messageLabel')} multiline onChangeText={setMessage} value={message} />
              <AppButton disabled={!recipientId || !message.trim()} icon="send-outline" title={t('schedule.send')} onPress={() => void sendMessage()} />
            </View>
          ) : null}
          <View style={styles.actionRow}>
            {canEdit ? <AppButton icon="create-outline" title={t('common.edit')} onPress={onEdit} /> : null}
            {event.event_type === 'game' ? (
              <AppButton icon="list-outline" title={t('schedule.openGame')} onPress={onOpenGame} variant="secondary" />
            ) : event.practice_plan_id || canEdit ? (
              <AppButton icon="clipboard-outline" title={event.practice_plan_id ? t('schedule.openPlan') : t('schedule.createPlan')} onPress={onOpenPlan} variant="secondary" />
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function SegmentedControl<T extends string>({ options, value, onChange, label }: { options: T[]; value: T; onChange: (value: T) => void; label: (value: T) => string }) {
  return <View style={styles.segmented}>{options.map((option) => <Pressable accessibilityRole="button" accessibilityState={{ selected: value === option }} key={option} onPress={() => onChange(option)} style={[styles.segment, value === option && styles.segmentActive]}><Text style={styles.segmentText}>{label(option)}</Text></Pressable>)}</View>;
}

function StaffFilterControl({ currentUserId, role, staff, value, onChange }: {
  currentUserId: string;
  role: ReturnType<typeof useActiveTeam>['role'];
  staff: EventStaffAssignment[];
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const unique = new Map<string, string>();
  for (const assignment of staff) unique.set(assignment.coach_user_id, assignment.coach_name);
  const options = role === 'director'
    ? Array.from(unique, ([id, label]) => ({ id, label }))
    : unique.has(currentUserId)
      ? [{ id: currentUserId, label: t('schedule.assignmentFilters.mine') }]
      : [];
  return (
    <View style={styles.staffFilter}>
      <Text style={styles.staffFilterLabel}>{t('schedule.assignedCoachFilter')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.actionRow}>
          {[{ id: 'all', label: t('schedule.assignmentFilters.all') }, ...options].map((option) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: option.id === value }}
              key={option.id}
              onPress={() => onChange(option.id)}
              style={[styles.recipientChip, option.id === value && styles.recipientChipActive]}
            >
              <Text style={styles.staffFilterText}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function groupStaff(rows: EventStaffAssignment[]) {
  const grouped = new Map<string, EventStaffAssignment[]>();
  for (const row of rows) grouped.set(row.event_id, [...(grouped.get(row.event_id) ?? []), row]);
  return grouped;
}

function teamColor(teamId: string, teams: ReturnType<typeof useActiveTeam>['teams']) {
  const color = teams.find((team) => team.id === teamId)?.primary_color;
  return color && /^#[0-9a-f]{6}$/i.test(color) ? color : colors.frostSteel;
}

function formatHour(hour: number, locale: string) {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return formatTime(date, locale);
}

function buildExportHtml(events: ScheduleEvent[], teams: ReturnType<typeof useActiveTeam>['teams'], locale: string, labels: { title: string; date: string; time: string; event: string; team: string; location: string }) {
  const rows = events.map((event) => `<tr><td>${escapeHtml(formatDate(event.starts_at, locale))}</td><td>${escapeHtml(formatTime(event.starts_at, locale))}</td><td>${escapeHtml(event.title)}</td><td>${escapeHtml(teams.find((team) => team.id === event.team_id)?.name ?? '')}</td><td>${escapeHtml(event.location ?? '')}</td></tr>`).join('');
  return `<html><body><h1>${escapeHtml(labels.title)}</h1><table><thead><tr><th>${escapeHtml(labels.date)}</th><th>${escapeHtml(labels.time)}</th><th>${escapeHtml(labels.event)}</th><th>${escapeHtml(labels.team)}</th><th>${escapeHtml(labels.location)}</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

const styles = StyleSheet.create({
  actionRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  calendarCard: { backgroundColor: colors.card, borderRadius: radii.lg, overflow: 'hidden' },
  dateNavigation: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  declinedBadge: { backgroundColor: colors.dangerSoft, color: colors.goalRed },
  detailBackdrop: { backgroundColor: 'rgba(3,13,24,0.7)', bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  detailCard: { backgroundColor: colors.card, borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, gap: spacing.md, marginTop: 80, minHeight: '70%', padding: spacing.xl },
  detailHeader: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  detailHeaderCopy: { flex: 1 },
  detailRoot: { flex: 1, justifyContent: 'flex-end' },
  eventBlock: { borderLeftWidth: 5, borderRadius: radii.sm, gap: spacing.xs, padding: spacing.md },
  eventHeading: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  eventMeta: { color: colors.slateGrey, fontSize: fontSizes.sm },
  eventTitle: { color: colors.textPrimary, flex: 1, fontWeight: '800' },
  eventTypeText: { color: colors.textPrimary, fontSize: 10, fontWeight: '900' },
  gameBlock: { backgroundColor: colors.dangerSoft, borderLeftColor: colors.goalRed },
  gridCard: { backgroundColor: colors.card, borderRadius: radii.lg, overflow: 'hidden' },
  hourContent: { flex: 1, gap: spacing.xs, minHeight: 58, padding: spacing.xs },
  hourLabel: { color: colors.slateGrey, fontSize: 11, paddingTop: spacing.sm, textAlign: 'center', width: 58 },
  hourRow: { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', minHeight: 64 },
  iconButton: { padding: spacing.sm },
  monthStack: { gap: spacing.md },
  noteCard: { backgroundColor: colors.cardPressed, borderRadius: radii.md, gap: spacing.xs, padding: spacing.md },
  periodLabel: { color: colors.iceWhite, flex: 1, fontWeight: '700', textAlign: 'center' },
  practiceBlock: { backgroundColor: colors.warningSoft, borderLeftColor: hornAmber },
  recipientChip: { borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  recipientChipActive: { backgroundColor: colors.cardPressed, borderColor: colors.goalRed },
  recipientText: { color: colors.textPrimary, fontWeight: '700' },
  responseBox: { borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, gap: spacing.md, padding: spacing.md },
  sectionTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '800' },
  segment: { alignItems: 'center', borderRadius: radii.md, flex: 1, padding: spacing.control },
  segmentActive: { backgroundColor: colors.goalRed },
  segmentText: { color: colors.iceWhite, fontSize: 13, fontWeight: '800' },
  segmented: { backgroundColor: colors.rinkSurface, borderRadius: radii.md, flexDirection: 'row', padding: spacing.xs },
  staffCopy: { flex: 1 },
  staffFilter: { gap: spacing.sm },
  staffFilterLabel: { color: colors.iceWhite, fontSize: 13, fontWeight: '800' },
  staffFilterText: { color: colors.iceWhite, fontWeight: '700' },
  staffName: { color: colors.textPrimary, fontWeight: '700' },
  staffRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  statusBadge: { backgroundColor: colors.warningSoft, borderRadius: radii.pill, color: colors.textPrimary, fontSize: 12, fontWeight: '800', overflow: 'hidden', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  todayButton: { borderColor: colors.frostSteel, borderRadius: radii.pill, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  todayText: { color: colors.iceWhite, fontWeight: '700' },
  weekDayHeader: { alignItems: 'center', borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, padding: spacing.sm, width: 104 },
  weekDayNumber: { color: colors.textPrimary, fontSize: 18, fontWeight: '800' },
  weekDayText: { color: colors.slateGrey, fontSize: 12 },
  weekEvent: { backgroundColor: colors.cardPressed, borderLeftWidth: 4, borderRadius: radii.xs, padding: spacing.xs },
  weekEventMeta: { color: colors.slateGrey, fontSize: 9 },
  weekEventText: { color: colors.textPrimary, fontSize: 11, fontWeight: '700' },
  weekGrid: { backgroundColor: colors.card, borderRadius: radii.lg, minWidth: 786, overflow: 'hidden' },
  weekHeaderRow: { flexDirection: 'row' },
  weekHourRow: { flexDirection: 'row', minHeight: 58 },
  weekSlot: { borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, gap: 2, minHeight: 58, padding: 2, width: 104 },
  weekTimeColumn: { color: colors.slateGrey, fontSize: 10, paddingTop: spacing.sm, textAlign: 'center', width: 58 },
});
