import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import type { MarkedDates } from 'react-native-calendars/src/types';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { AppScreen, appScreenStyles } from '../components/AppScreen';
import type {
  AuthenticatedStackParamList,
  AuthenticatedTabParamList,
} from '../navigation/types';
import { useActiveTeam } from '../teams/ActiveTeamContext';
import {
  colors,
  fonts,
  goalRed,
  rinkNavy,
  slateGrey,
} from '../theme/theme';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AuthenticatedTabParamList, 'GameDayTab'>,
  NativeStackScreenProps<AuthenticatedStackParamList>
>;

type ScheduleView = 'list' | 'week' | 'month';
type ScheduleFilter = 'all' | 'games' | 'practices';
type ScheduleEventType = 'home_game' | 'away_game' | 'practice';
type TeamFilterValue = 'all' | string;
type MembershipRole = 'head_coach' | 'assistant_coach';

type Profile = {
  role: 'super_admin' | 'director' | 'coach';
  school_id: string | null;
};

type CalendarTeam = {
  id: string;
  name: string;
  level: string | null;
  season: string | null;
  membership_role?: MembershipRole | null;
  primary_color: string | null;
  secondary_color: string | null;
  tertiary_color: string | null;
  logo_url: string | null;
  access: 'full' | 'assignment';
};

type TeamRelation = CalendarTeam | CalendarTeam[] | null;

type MembershipRow = {
  team_id: string;
  membership_role: MembershipRole;
  teams: TeamRelation;
};

type AssignmentRow = {
  id: string;
  team_id: string;
  assignment_type: 'game' | 'practice';
  scheduled_at: string;
  teams: TeamRelation;
};

export type Game = {
  id: string;
  team_id: string;
  opponent_name: string;
  game_date: string;
  location: string | null;
  is_home: boolean;
  result: 'win' | 'loss' | 'tie' | null;
  opponent_scouting_notes: string | null;
  pre_game_plan: string | null;
  post_game_notes: string | null;
  created_at: string;
};

type PracticePlan = {
  id: string;
  team_id: string;
  practice_date: string;
  segments: unknown;
  created_at: string;
  updated_at: string | null;
};

type ScheduleEvent = {
  id: string;
  type: ScheduleEventType;
  date: Date;
  dateKey: string;
  color: string;
  label: string;
  detailLabel: string;
  teamId: string;
  teamName: string;
  isReadOnly: boolean;
  sortTime: number;
};

const ALL_TEAMS_FILTER = 'all';
const VIEW_OPTIONS: ScheduleView[] = ['list', 'week', 'month'];
const FILTER_OPTIONS: ScheduleFilter[] = ['all', 'games', 'practices'];
const NEUTRAL_EVENT_COLOR = slateGrey;

function sortGames(games: Game[]) {
  const now = Date.now();

  return [...games].sort((left, right) => {
    const leftTime = new Date(left.game_date).getTime();
    const rightTime = new Date(right.game_date).getTime();
    const leftIsUpcoming = leftTime >= now;
    const rightIsUpcoming = rightTime >= now;

    if (leftIsUpcoming && !rightIsUpcoming) {
      return -1;
    }

    if (!leftIsUpcoming && rightIsUpcoming) {
      return 1;
    }

    return leftIsUpcoming ? leftTime - rightTime : rightTime - leftTime;
  });
}

export function GameListScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const { activeTeam } = useActiveTeam();
  const [activeView, setActiveView] = useState<ScheduleView>('list');
  const [activeFilter, setActiveFilter] = useState<ScheduleFilter>('all');
  const [teamFilter, setTeamFilter] =
    useState<TeamFilterValue>(ALL_TEAMS_FILTER);
  const [selectedDateKey, setSelectedDateKey] = useState(() =>
    toDateKey(new Date()),
  );
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [exportError, setExportError] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const profileQuery = useQuery({
    queryKey: ['profile', session?.user.id],
    queryFn: async () => {
      if (!session) {
        throw new Error(t('home.noSessionError'));
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('role, school_id')
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
  const directorTeamsQuery = useQuery({
    queryKey: ['calendar-director-teams', profile?.school_id],
    queryFn: async () => {
      if (!profile?.school_id) {
        throw new Error(t('directorAllTeams.noSchoolError'));
      }

      const { data, error } = await supabase
        .from('teams')
        .select(
          'id, name, level, season, primary_color, secondary_color, tertiary_color, logo_url',
        )
        .eq('school_id', profile.school_id)
        .order('name', { ascending: true });

      if (error) {
        throw error;
      }

      return ((data ?? []) as CalendarTeam[]).map((team) => ({
        ...team,
        access: 'full' as const,
      }));
    },
    enabled: profile?.role === 'director' && Boolean(profile.school_id),
  });
  const coachMembershipsQuery = useQuery({
    queryKey: ['calendar-coach-memberships', session?.user.id],
    queryFn: async () => {
      if (!session) {
        throw new Error(t('home.noSessionError'));
      }

      const { data, error } = await supabase
        .from('team_memberships')
        .select(
          'team_id, membership_role, teams ( id, name, level, season, primary_color, secondary_color, tertiary_color, logo_url )',
        )
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      const membershipTeams: CalendarTeam[] = [];

      for (const membership of (data ?? []) as MembershipRow[]) {
        const team = normalizeTeamRelation(membership.teams);

        if (team) {
          membershipTeams.push({
            ...team,
            access:
              membership.membership_role === 'head_coach'
                ? ('full' as const)
                : ('assignment' as const),
            membership_role: membership.membership_role,
          });
        }
      }

      return membershipTeams;
    },
    enabled: profile?.role === 'coach' && Boolean(session),
  });
  const coachAssignmentsQuery = useQuery({
    queryKey: ['calendar-coach-assignments', session?.user.id],
    queryFn: async () => {
      if (!session) {
        throw new Error(t('home.noSessionError'));
      }

      const { data, error } = await supabase
        .from('coach_assignments')
        .select(
          'id, team_id, assignment_type, scheduled_at, teams ( id, name, level, season, primary_color, secondary_color, tertiary_color, logo_url )',
        )
        .eq('assistant_coach_user_id', session.user.id)
        .order('scheduled_at', { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []) as AssignmentRow[];
    },
    enabled: profile?.role === 'coach' && Boolean(session),
  });
  const calendarTeams = useMemo(() => {
    if (profile?.role === 'director') {
      return directorTeamsQuery.data ?? [];
    }

    const assignmentTeams: CalendarTeam[] = [];

    for (const assignment of coachAssignmentsQuery.data ?? []) {
      const team = normalizeTeamRelation(assignment.teams);

      if (team) {
        assignmentTeams.push({
          ...team,
          access: 'assignment',
        });
      }
    }

    return mergeCalendarTeams([
      ...(coachMembershipsQuery.data ?? []),
      ...assignmentTeams,
    ]);
  }, [
    coachAssignmentsQuery.data,
    coachMembershipsQuery.data,
    directorTeamsQuery.data,
    profile?.role,
  ]);
  const calendarTeamIdsKey = calendarTeams.map((team) => team.id).join(',');

  useEffect(() => {
    if (calendarTeams.length === 0) {
      return;
    }

    const defaultFilter =
      calendarTeams.length > 1
        ? ALL_TEAMS_FILTER
        : calendarTeams[0]?.id ?? ALL_TEAMS_FILTER;

    setTeamFilter((currentFilter) => {
      if (
        currentFilter === ALL_TEAMS_FILTER &&
        calendarTeams.length > 1
      ) {
        return currentFilter;
      }

      if (calendarTeams.some((team) => team.id === currentFilter)) {
        return currentFilter;
      }

      return defaultFilter;
    });
  }, [calendarTeamIdsKey, calendarTeams]);

  const selectedTeamIds = useMemo(
    () =>
      teamFilter === ALL_TEAMS_FILTER
        ? calendarTeams.map((team) => team.id)
        : [teamFilter],
    [calendarTeams, teamFilter],
  );
  const selectedTeamIdsKey = selectedTeamIds.join(',');
  const gamesQuery = useQuery({
    queryKey: ['calendar-games', selectedTeamIdsKey],
    queryFn: async () => {
      if (selectedTeamIds.length === 0) {
        return [] as Game[];
      }

      const { data, error } = await supabase
        .from('games')
        .select(
          'id, team_id, opponent_name, game_date, location, is_home, result, opponent_scouting_notes, pre_game_plan, post_game_notes, created_at',
        )
        .in('team_id', selectedTeamIds)
        .order('game_date', { ascending: true });

      if (error) {
        throw error;
      }

      return sortGames((data ?? []) as Game[]);
    },
    enabled: selectedTeamIds.length > 0,
  });
  const practicesQuery = useQuery({
    queryKey: ['calendar-practice-plans', selectedTeamIdsKey],
    queryFn: async () => {
      if (selectedTeamIds.length === 0) {
        return [] as PracticePlan[];
      }

      const { data, error } = await supabase
        .from('practice_plans')
        .select('id, team_id, practice_date, segments, created_at, updated_at')
        .in('team_id', selectedTeamIds)
        .order('practice_date', { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []) as PracticePlan[];
    },
    enabled: selectedTeamIds.length > 0,
  });

  const games = gamesQuery.data ?? [];
  const practices = practicesQuery.data ?? [];
  const teamById = useMemo(
    () => new Map(calendarTeams.map((team) => [team.id, team])),
    [calendarTeams],
  );
  const isAllTeamsSelected = teamFilter === ALL_TEAMS_FILTER;
  const allEvents = useMemo(
    () =>
      makeScheduleEvents({
        games,
        isAllTeamsSelected,
        practices,
        t,
        teamById,
      }),
    [games, isAllTeamsSelected, practices, t, teamById],
  );
  const filteredEvents = useMemo(
    () => filterEvents(allEvents, activeFilter),
    [activeFilter, allEvents],
  );
  const selectedDateEvents = filteredEvents.filter(
    (event) => event.dateKey === selectedDateKey,
  );
  const weekDays = getWeekDays(new Date(`${selectedDateKey}T12:00:00`));
  const weekEvents = filteredEvents.filter((event) =>
    weekDays.some((day) => day.dateKey === event.dateKey),
  );
  const monthEvents = filteredEvents.filter((event) =>
    isSameMonth(event.date, visibleMonth),
  );
  const markedDates = makeMarkedDates(filteredEvents, selectedDateKey);

  function navigateToEvent(event: ScheduleEvent) {
    if (event.type === 'practice') {
      navigation.navigate('PracticePlanDetail', {
        practicePlanId: event.id,
        readOnly: event.isReadOnly,
      });
      return;
    }

    navigation.navigate('GameForm', {
      gameId: event.id,
      readOnly: event.isReadOnly,
    });
  }

  async function exportCurrentView() {
    const eventsToExport = activeView === 'week' ? weekEvents : monthEvents;

    if (activeView === 'list') {
      return;
    }

    setExportError('');
    setIsExporting(true);

    try {
      const html = buildScheduleExportHtml({
        emptyLabel: t('calendar.noEvents'),
        events: eventsToExport,
        subtitle:
          activeView === 'week'
            ? formatWeekRange(weekDays)
            : formatMonthLabel(visibleMonth),
        title: t(`calendar.views.${activeView}`),
      });
      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();

      if (!canShare) {
        setExportError(t('calendar.exportUnavailable'));
        return;
      }

      await Sharing.shareAsync(uri, {
        UTI: 'com.adobe.pdf',
        mimeType: 'application/pdf',
      });
    } catch (error) {
      console.error('Unable to export schedule:', error);
      setExportError(t('calendar.exportError'));
    } finally {
      setIsExporting(false);
    }
  }

  const isLoadingCalendarAccess =
    profileQuery.isLoading ||
    directorTeamsQuery.isLoading ||
    coachMembershipsQuery.isLoading ||
    coachAssignmentsQuery.isLoading;
  const hasCalendarAccessError =
    Boolean(profileQuery.error) ||
    Boolean(directorTeamsQuery.error) ||
    Boolean(coachMembershipsQuery.error) ||
    Boolean(coachAssignmentsQuery.error);
  const selectedTeam = teamById.get(
    teamFilter === ALL_TEAMS_FILTER ? '' : teamFilter,
  );
  const selectedTeamName =
    teamFilter === ALL_TEAMS_FILTER
      ? t('calendar.allTeams')
      : selectedTeam?.name ?? activeTeam?.name ?? t('calendar.selectedTeamFallback');
  const canAddGame =
    activeView === 'list' &&
    activeTeam &&
    teamFilter !== ALL_TEAMS_FILTER &&
    activeTeam.id === teamFilter &&
    selectedTeam?.access === 'full';

  if (!isLoadingCalendarAccess && calendarTeams.length === 0) {
    return (
      <AppScreen
        description={t('games.noActiveTeamDescription')}
        title={t('games.noActiveTeamTitle')}
      />
    );
  }

  return (
    <AppScreen
      action={
        <View style={styles.headerActions}>
          {activeView === 'list' ? (
            canAddGame ? (
              <Button
                color={goalRed}
                title={t('games.addGameButton')}
                onPress={() => navigation.navigate('GameForm')}
              />
            ) : null
          ) : (
            <Button
              color={goalRed}
              disabled={isExporting}
              title={
                isExporting
                  ? t('calendar.exporting')
                  : t('calendar.exportButton')
              }
              onPress={() => void exportCurrentView()}
            />
          )}
        </View>
      }
      description={t('games.description', { teamName: selectedTeamName })}
      title={t('games.title')}
    >
      <SegmentedControl
        options={VIEW_OPTIONS}
        renderLabel={(view) => t(`calendar.views.${view}`)}
        value={activeView}
        onChange={setActiveView}
      />
      {calendarTeams.length > 1 ? (
        <TeamFilterControl
          options={calendarTeams}
          value={teamFilter}
          onChange={setTeamFilter}
        />
      ) : null}
      {activeView !== 'list' ? (
        <SegmentedControl
          options={FILTER_OPTIONS}
          renderLabel={(filter) => t(`calendar.filters.${filter}`)}
          value={activeFilter}
          onChange={setActiveFilter}
        />
      ) : null}
      {isLoadingCalendarAccess ||
      gamesQuery.isLoading ||
      practicesQuery.isLoading ? (
        <Text style={appScreenStyles.note}>{t('common.loading')}</Text>
      ) : null}
      {hasCalendarAccessError || gamesQuery.error || practicesQuery.error ? (
        <Text style={appScreenStyles.error}>{t('games.loadError')}</Text>
      ) : null}
      {exportError ? (
        <Text style={appScreenStyles.error}>{exportError}</Text>
      ) : null}
      {activeView === 'list' ? (
        <GameScheduleList
          events={filterEvents(allEvents, 'games')}
          isLoading={gamesQuery.isLoading}
          navigateToGame={navigateToEvent}
          navigateToLineup={(event) =>
            navigation.navigate('LineupBuilder', {
              gameId: event.id,
              readOnly: event.isReadOnly,
            })
          }
          navigateToNewGame={() => navigation.navigate('GameForm')}
          showTeamName={teamFilter === ALL_TEAMS_FILTER}
          canAddGame={Boolean(canAddGame)}
        />
      ) : null}
      {activeView === 'month' ? (
        <MonthScheduleView
          events={selectedDateEvents}
          markedDates={markedDates}
          selectedDateKey={selectedDateKey}
          onMonthChange={(dateString) => {
            setSelectedDateKey(dateString);
            setVisibleMonth(startOfMonth(new Date(`${dateString}T12:00:00`)));
          }}
          onOpenEvent={navigateToEvent}
          onSelectDate={setSelectedDateKey}
        />
      ) : null}
      {activeView === 'week' ? (
        <WeekScheduleView
          events={filteredEvents}
          selectedDateEvents={selectedDateEvents}
          selectedDateKey={selectedDateKey}
          weekDays={weekDays}
          onOpenEvent={navigateToEvent}
          onSelectDate={setSelectedDateKey}
        />
      ) : null}
    </AppScreen>
  );
}

function GameScheduleList({
  canAddGame,
  events,
  isLoading,
  navigateToGame,
  navigateToLineup,
  navigateToNewGame,
  showTeamName,
}: {
  canAddGame: boolean;
  events: ScheduleEvent[];
  isLoading: boolean;
  navigateToGame: (event: ScheduleEvent) => void;
  navigateToLineup: (event: ScheduleEvent) => void;
  navigateToNewGame: () => void;
  showTeamName: boolean;
}) {
  const { t } = useTranslation();

  return (
    <>
      {!isLoading && events.length === 0 ? (
        <View style={appScreenStyles.card}>
          <Text style={appScreenStyles.cardTitle}>
            {t('games.emptyTitle')}
          </Text>
          <Text style={appScreenStyles.cardDescription}>
            {t('games.emptyDescription')}
          </Text>
          {canAddGame ? (
            <Button
              color={goalRed}
              title={t('games.addFirstGameButton')}
              onPress={navigateToNewGame}
            />
          ) : null}
        </View>
      ) : null}
      <View style={appScreenStyles.list}>
        {events.map((event) => (
          <View key={`${event.type}-${event.id}`} style={appScreenStyles.card}>
            <Pressable
              accessibilityRole="button"
              onPress={() => navigateToGame(event)}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <View style={appScreenStyles.row}>
                <View style={styles.details}>
                  <Text style={appScreenStyles.cardTitle}>
                    {event.label}
                  </Text>
                  {showTeamName ? (
                    <Text style={appScreenStyles.meta}>{event.teamName}</Text>
                  ) : null}
                  <Text style={appScreenStyles.meta}>
                    {formatDateOnly(event.dateKey)}
                  </Text>
                  <Text style={appScreenStyles.meta}>{event.detailLabel}</Text>
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {event.type === 'home_game'
                      ? t('games.homeBadge')
                      : t('games.awayBadge')}
                  </Text>
                </View>
              </View>
            </Pressable>
            <Button
              color={goalRed}
              title={
                event.isReadOnly
                  ? t('gameForm.viewLineupButton')
                  : t('gameForm.lineupButton')
              }
              onPress={() => navigateToLineup(event)}
            />
          </View>
        ))}
      </View>
    </>
  );
}

function MonthScheduleView({
  events,
  markedDates,
  selectedDateKey,
  onMonthChange,
  onOpenEvent,
  onSelectDate,
}: {
  events: ScheduleEvent[];
  markedDates: MarkedDates;
  selectedDateKey: string;
  onMonthChange: (dateString: string) => void;
  onOpenEvent: (event: ScheduleEvent) => void;
  onSelectDate: (dateString: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.calendarStack}>
      <View style={styles.calendarCard}>
        <Calendar
          markingType="multi-dot"
          markedDates={markedDates}
          onDayPress={(day) => onSelectDate(day.dateString)}
          onMonthChange={(month) => onMonthChange(month.dateString)}
        />
      </View>
      <View style={appScreenStyles.card}>
        <Text style={appScreenStyles.cardTitle}>
          {t('calendar.selectedDayTitle', {
            date: formatDateOnly(selectedDateKey),
          })}
        </Text>
        <EventList
          emptyLabel={t('calendar.noEventsForDay')}
          events={events}
          onOpenEvent={onOpenEvent}
        />
      </View>
    </View>
  );
}

function WeekScheduleView({
  events,
  selectedDateEvents,
  selectedDateKey,
  weekDays,
  onOpenEvent,
  onSelectDate,
}: {
  events: ScheduleEvent[];
  selectedDateEvents: ScheduleEvent[];
  selectedDateKey: string;
  weekDays: Array<{ date: Date; dateKey: string }>;
  onOpenEvent: (event: ScheduleEvent) => void;
  onSelectDate: (dateString: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.calendarStack}>
      <View style={appScreenStyles.card}>
        <Text style={appScreenStyles.cardTitle}>
          {t('calendar.weekTitle', { range: formatWeekRange(weekDays) })}
        </Text>
        <View style={styles.weekStack}>
          {weekDays.map((day) => {
            const dayEvents = events.filter(
              (event) => event.dateKey === day.dateKey,
            );

            return (
              <Pressable
                accessibilityRole="button"
                key={day.dateKey}
                onPress={() => onSelectDate(day.dateKey)}
                style={[
                  styles.weekDay,
                  selectedDateKey === day.dateKey && styles.weekDaySelected,
                ]}
              >
                <View style={styles.weekDayDate}>
                  <Text style={styles.weekDayLabel}>
                    {formatWeekday(day.date)}
                  </Text>
                  <Text style={styles.weekDayNumber}>{day.date.getDate()}</Text>
                  <EventDots events={dayEvents} />
                </View>
                <View style={styles.weekEventSummary}>
                  {dayEvents.length > 0 ? (
                    <>
                      <Text style={styles.weekEventText}>
                        {t('calendar.dayEventCount', {
                          count: dayEvents.length,
                        })}
                      </Text>
                      <Text style={styles.moreEventsText}>
                        {dayEvents[0]?.label}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.emptyDayText}>
                      {t('calendar.emptyDay')}
                    </Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={appScreenStyles.card}>
        <Text style={appScreenStyles.cardTitle}>
          {t('calendar.selectedDayTitle', {
            date: formatDateOnly(selectedDateKey),
          })}
        </Text>
        <EventList
          emptyLabel={t('calendar.noEventsForDay')}
          events={selectedDateEvents}
          onOpenEvent={onOpenEvent}
        />
      </View>
    </View>
  );
}

function EventList({
  emptyLabel,
  events,
  onOpenEvent,
}: {
  emptyLabel: string;
  events: ScheduleEvent[];
  onOpenEvent: (event: ScheduleEvent) => void;
}) {
  if (events.length === 0) {
    return <Text style={appScreenStyles.note}>{emptyLabel}</Text>;
  }

  return (
    <View style={styles.eventList}>
      {events.map((event) => (
        <Pressable
          accessibilityRole="button"
          key={`${event.type}-${event.id}`}
          onPress={() => onOpenEvent(event)}
          style={[styles.eventRow, { borderLeftColor: event.color }]}
        >
          <Text style={styles.eventTeamText}>{event.teamName}</Text>
          <Text style={styles.eventText}>{event.label}</Text>
          <Text style={appScreenStyles.meta}>{event.detailLabel}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function EventDots({ events }: { events: ScheduleEvent[] }) {
  if (events.length === 0) {
    return null;
  }

  return (
    <View style={styles.eventDots}>
      {events.slice(0, 5).map((event) => (
        <View
          key={`${event.type}-${event.id}`}
          style={[styles.eventDot, { backgroundColor: event.color }]}
        />
      ))}
    </View>
  );
}

function TeamFilterControl({
  options,
  value,
  onChange,
}: {
  options: CalendarTeam[];
  value: TeamFilterValue;
  onChange: (value: TeamFilterValue) => void;
}) {
  const { t } = useTranslation();
  const filterOptions = [
    { id: ALL_TEAMS_FILTER, name: t('calendar.allTeams'), meta: '' },
    ...options.map((team) => ({
      id: team.id,
      name: team.name,
      meta: formatTeamMeta(team, t),
    })),
  ];

  return (
    <View style={styles.teamFilterCard}>
      <Text style={styles.teamFilterLabel}>{t('calendar.teamFilterLabel')}</Text>
      <View style={styles.teamFilterOptions}>
        {filterOptions.map((option) => {
          const isSelected = option.id === value;

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              key={option.id}
              onPress={() => onChange(option.id)}
              style={[
                styles.teamFilterOption,
                isSelected && styles.teamFilterOptionSelected,
              ]}
            >
              <Text
                style={[
                  styles.teamFilterOptionText,
                  isSelected && styles.teamFilterOptionTextSelected,
                ]}
              >
                {option.name}
              </Text>
              {option.meta ? (
                <Text style={styles.teamFilterOptionMeta}>{option.meta}</Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function SegmentedControl<T extends string>({
  options,
  renderLabel,
  value,
  onChange,
}: {
  options: T[];
  renderLabel: (option: T) => string;
  value: T;
  onChange: (option: T) => void;
}) {
  return (
    <View style={styles.segmentedControl}>
      {options.map((option) => {
        const isActive = option === value;

        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            key={option}
            onPress={() => onChange(option)}
            style={[
              styles.segmentedOption,
              isActive && styles.segmentedOptionActive,
            ]}
          >
            <Text
              style={[
                styles.segmentedOptionText,
                isActive && styles.segmentedOptionTextActive,
              ]}
            >
              {renderLabel(option)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function makeScheduleEvents({
  games,
  isAllTeamsSelected,
  practices,
  t,
  teamById,
}: {
  games: Game[];
  isAllTeamsSelected: boolean;
  practices: PracticePlan[];
  t: (key: string, values?: Record<string, unknown>) => string;
  teamById: Map<string, CalendarTeam>;
}) {
  const gameEvents: ScheduleEvent[] = games.map((game) => {
    const date = parseDate(game.game_date);
    const team = teamById.get(game.team_id);
    const teamName = team?.name ?? t('calendar.selectedTeamFallback');
    const location = game.location?.trim();
    const time = formatTimeOnly(date);

    return {
      color: getEventColor({
        eventType: game.is_home ? 'home_game' : 'away_game',
        isAllTeamsSelected,
        team,
      }),
      date,
      dateKey: toDateKey(date),
      detailLabel: t('calendar.gameEventDetail', {
        location: location || t('calendar.noLocation'),
        time,
        type: game.is_home ? t('games.homeBadge') : t('games.awayBadge'),
      }),
      id: game.id,
      isReadOnly: team?.access !== 'full',
      label: t('calendar.gameEventLabel', {
        opponentName: game.opponent_name,
        time,
      }),
      sortTime: date.getTime(),
      teamId: game.team_id,
      teamName,
      type: game.is_home ? 'home_game' : 'away_game',
    };
  });
  const practiceEvents: ScheduleEvent[] = practices.map((practice) => {
    const date = parseDate(practice.practice_date);
    const team = teamById.get(practice.team_id);
    const teamName = team?.name ?? t('calendar.selectedTeamFallback');
    const time = formatTimeOnly(date);

    return {
      color: getEventColor({
        eventType: 'practice',
        isAllTeamsSelected,
        team,
      }),
      date,
      dateKey: toDateKey(date),
      detailLabel: t('calendar.practiceEventDetail', {
        time,
        type: t('calendar.practiceTypeLabel'),
      }),
      id: practice.id,
      isReadOnly: team?.access !== 'full',
      label: t('calendar.practiceEventLabel', {
        time,
      }),
      sortTime: date.getTime(),
      teamId: practice.team_id,
      teamName,
      type: 'practice',
    };
  });

  return [...gameEvents, ...practiceEvents].sort(
    (left, right) => left.sortTime - right.sortTime,
  );
}

function filterEvents(events: ScheduleEvent[], filter: ScheduleFilter) {
  if (filter === 'games') {
    return events.filter((event) => event.type !== 'practice');
  }

  if (filter === 'practices') {
    return events.filter((event) => event.type === 'practice');
  }

  return events;
}

function getEventColor({
  eventType,
  isAllTeamsSelected,
  team,
}: {
  eventType: ScheduleEventType;
  isAllTeamsSelected: boolean;
  team?: CalendarTeam;
}) {
  if (isAllTeamsSelected) {
    return team?.primary_color ?? goalRed;
  }

  if (eventType === 'home_game') {
    return team?.primary_color ?? goalRed;
  }

  if (eventType === 'away_game') {
    return team?.secondary_color ?? rinkNavy;
  }

  return team?.tertiary_color ?? NEUTRAL_EVENT_COLOR;
}

function makeMarkedDates(events: ScheduleEvent[], selectedDateKey: string) {
  const markedDates: MarkedDates = {};

  events.forEach((event) => {
    const current = markedDates[event.dateKey] ?? { dots: [] };
    const dots = current.dots ?? [];

    dots.push({
      color: event.color,
      key: `${event.type}-${event.id}`,
    });

    markedDates[event.dateKey] = { ...current, dots };
  });

  markedDates[selectedDateKey] = {
    ...(markedDates[selectedDateKey] ?? {}),
    selected: true,
    selectedColor: colors.cardPressed,
  };

  return markedDates;
}

function buildScheduleExportHtml({
  emptyLabel,
  events,
  subtitle,
  title,
}: {
  emptyLabel: string;
  events: ScheduleEvent[];
  subtitle: string;
  title: string;
}) {
  const rows =
    events.length === 0
      ? `<p>${escapeHtml(emptyLabel)}</p>`
      : events
          .map(
            (event) =>
              `<li><strong>${escapeHtml(formatDateOnly(event.dateKey))}</strong> - ${escapeHtml(event.label)}</li>`,
          )
          .join('');

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { color: ${rinkNavy}; font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 28px; }
          h1 { margin-bottom: 4px; }
          h2 { color: ${slateGrey}; font-size: 16px; margin-top: 0; }
          li { border-left: 5px solid ${goalRed}; list-style: none; margin: 12px 0; padding: 10px 12px; }
          ul { margin: 0; padding: 0; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <h2>${escapeHtml(subtitle)}</h2>
        <ul>${rows}</ul>
      </body>
    </html>
  `;
}

function normalizeTeamRelation(teamRelation: TeamRelation) {
  return Array.isArray(teamRelation) ? teamRelation[0] ?? null : teamRelation;
}

function mergeCalendarTeams(teams: CalendarTeam[]) {
  const teamsById = new Map<string, CalendarTeam>();

  for (const team of teams) {
    const existingTeam = teamsById.get(team.id);

    if (!existingTeam) {
      teamsById.set(team.id, team);
      continue;
    }

    teamsById.set(team.id, {
      ...existingTeam,
      ...team,
      access:
        existingTeam.access === 'full' || team.access === 'full'
          ? 'full'
          : 'assignment',
      membership_role: existingTeam.membership_role ?? team.membership_role,
    });
  }

  return Array.from(teamsById.values()).sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

function formatTeamMeta(
  team: Pick<CalendarTeam, 'level' | 'season'>,
  t: (key: string, values?: Record<string, unknown>) => string,
) {
  if (!team.level && !team.season) {
    return t('teamSwitcher.noDetails');
  }

  return [team.level, team.season].filter(Boolean).join(' / ');
}

function getWeekDays(date: Date) {
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  start.setHours(12, 0, 0, 0);

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);

    return {
      date: day,
      dateKey: toDateKey(day),
    };
  });
}

function parseDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function isSameMonth(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth()
  );
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateOnly(dateKey: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  }).format(new Date(`${dateKey}T12:00:00`));
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatTimeOnly(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatWeekday(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
  }).format(date);
}

function formatWeekRange(weekDays: Array<{ date: Date; dateKey: string }>) {
  const first = weekDays[0]?.dateKey ?? toDateKey(new Date());
  const last = weekDays[weekDays.length - 1]?.dateKey ?? first;

  return `${formatDateOnly(first)} - ${formatDateOnly(last)}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function formatGameDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.successSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '700',
  },
  calendarCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  calendarStack: {
    gap: 16,
  },
  details: {
    flex: 1,
    gap: 4,
  },
  emptyDayText: {
    color: slateGrey,
    fontSize: 12,
    lineHeight: 16,
  },
  eventList: {
    gap: 10,
  },
  eventDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  eventDots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    justifyContent: 'center',
    marginTop: 4,
  },
  eventRow: {
    backgroundColor: colors.cardPressed,
    borderLeftWidth: 5,
    borderRadius: 10,
    padding: 12,
  },
  eventText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  eventTeamText: {
    color: goalRed,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  headerActions: {
    alignItems: 'flex-start',
  },
  moreEventsText: {
    color: slateGrey,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  pressed: {
    backgroundColor: colors.cardPressed,
  },
  segmentedControl: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  segmentedOption: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  segmentedOptionActive: {
    backgroundColor: colors.cardPressed,
    borderColor: goalRed,
  },
  segmentedOptionText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  segmentedOptionTextActive: {
    color: goalRed,
  },
  teamFilterCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  teamFilterLabel: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  teamFilterOption: {
    backgroundColor: colors.fieldBackground,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  teamFilterOptionMeta: {
    color: slateGrey,
    fontSize: 12,
  },
  teamFilterOptions: {
    gap: 8,
  },
  teamFilterOptionSelected: {
    backgroundColor: colors.cardPressed,
    borderColor: goalRed,
  },
  teamFilterOptionText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  teamFilterOptionTextSelected: {
    color: goalRed,
  },
  weekDay: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 54,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  weekDayDate: {
    alignItems: 'center',
    width: 46,
  },
  weekDayLabel: {
    color: slateGrey,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  weekDayNumber: {
    color: colors.textPrimary,
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: '900',
  },
  weekDaySelected: {
    borderColor: goalRed,
  },
  weekEventSummary: {
    backgroundColor: colors.cardPressed,
    borderRadius: 8,
    flex: 1,
    gap: 2,
    padding: 8,
  },
  weekEventText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  weekStack: {
    gap: 10,
    paddingVertical: 4,
  },
});
