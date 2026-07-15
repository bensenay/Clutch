import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useMemo, useState } from 'react';
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
import { AppScreen, appScreenStyles } from '../components/AppScreen';
import type {
  AuthenticatedStackParamList,
  AuthenticatedTabParamList,
} from '../navigation/types';
import { useActiveTeam } from '../teams/ActiveTeamContext';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AuthenticatedTabParamList, 'GameDayTab'>,
  NativeStackScreenProps<AuthenticatedStackParamList>
>;

type ScheduleView = 'list' | 'week' | 'month';
type ScheduleFilter = 'all' | 'games' | 'practices';
type ScheduleEventType = 'home_game' | 'away_game' | 'practice';

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
  sortTime: number;
};

const VIEW_OPTIONS: ScheduleView[] = ['list', 'week', 'month'];
const FILTER_OPTIONS: ScheduleFilter[] = ['all', 'games', 'practices'];
const NEUTRAL_EVENT_COLOR = '#59636e';

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
  const { activeTeam } = useActiveTeam();
  const [activeView, setActiveView] = useState<ScheduleView>('list');
  const [activeFilter, setActiveFilter] = useState<ScheduleFilter>('all');
  const [selectedDateKey, setSelectedDateKey] = useState(() =>
    toDateKey(new Date()),
  );
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [exportError, setExportError] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const gamesQuery = useQuery({
    queryKey: ['games', activeTeam?.id],
    queryFn: async () => {
      if (!activeTeam) {
        throw new Error(t('games.noActiveTeamTitle'));
      }

      const { data, error } = await supabase
        .from('games')
        .select(
          'id, team_id, opponent_name, game_date, location, is_home, result, opponent_scouting_notes, pre_game_plan, post_game_notes, created_at',
        )
        .eq('team_id', activeTeam.id)
        .order('game_date', { ascending: true });

      if (error) {
        throw error;
      }

      return sortGames((data ?? []) as Game[]);
    },
    enabled: Boolean(activeTeam),
  });
  const practicesQuery = useQuery({
    queryKey: ['practice-plans', activeTeam?.id],
    queryFn: async () => {
      if (!activeTeam) {
        throw new Error(t('games.noActiveTeamTitle'));
      }

      const { data, error } = await supabase
        .from('practice_plans')
        .select('id, team_id, practice_date, segments, created_at, updated_at')
        .eq('team_id', activeTeam.id)
        .order('practice_date', { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []) as PracticePlan[];
    },
    enabled: Boolean(activeTeam),
  });

  const games = gamesQuery.data ?? [];
  const practices = practicesQuery.data ?? [];
  const eventColors = {
    home: activeTeam?.primary_color ?? '#b8442f',
    away: activeTeam?.secondary_color ?? '#15251f',
    practice: activeTeam?.tertiary_color ?? NEUTRAL_EVENT_COLOR,
  };
  const allEvents = useMemo(
    () =>
      makeScheduleEvents({
        eventColors,
        games,
        practices,
        t,
      }),
    [eventColors.away, eventColors.home, eventColors.practice, games, practices, t],
  );
  const filteredEvents = useMemo(
    () => filterEvents(allEvents, activeFilter),
    [activeFilter, allEvents],
  );
  const selectedDateEvents = filteredEvents.filter(
    (event) => event.dateKey === selectedDateKey,
  );
  const eventsByDate = useMemo(
    () => groupEventsByDate(filteredEvents),
    [filteredEvents],
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
      navigation.navigate('PracticePlanDetail', { practicePlanId: event.id });
      return;
    }

    navigation.navigate('GameForm', { gameId: event.id });
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
      action={
        <View style={styles.headerActions}>
          {activeView === 'list' ? (
            <Button
              title={t('games.addGameButton')}
              onPress={() => navigation.navigate('GameForm')}
            />
          ) : (
            <Button
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
      description={t('games.description', { teamName: activeTeam.name })}
      title={t('games.title')}
    >
      <SegmentedControl
        options={VIEW_OPTIONS}
        renderLabel={(view) => t(`calendar.views.${view}`)}
        value={activeView}
        onChange={setActiveView}
      />
      {activeView !== 'list' ? (
        <SegmentedControl
          options={FILTER_OPTIONS}
          renderLabel={(filter) => t(`calendar.filters.${filter}`)}
          value={activeFilter}
          onChange={setActiveFilter}
        />
      ) : null}
      {gamesQuery.isLoading || practicesQuery.isLoading ? (
        <Text style={appScreenStyles.note}>{t('common.loading')}</Text>
      ) : null}
      {gamesQuery.error || practicesQuery.error ? (
        <Text style={appScreenStyles.error}>{t('games.loadError')}</Text>
      ) : null}
      {exportError ? (
        <Text style={appScreenStyles.error}>{exportError}</Text>
      ) : null}
      {activeView === 'list' ? (
        <GameScheduleList
          games={games}
          isLoading={gamesQuery.isLoading}
          navigateToGame={(gameId) => navigation.navigate('GameForm', { gameId })}
          navigateToLineup={(gameId) =>
            navigation.navigate('LineupBuilder', { gameId })
          }
          navigateToNewGame={() => navigation.navigate('GameForm')}
        />
      ) : null}
      {activeView === 'month' ? (
        <MonthScheduleView
          events={selectedDateEvents}
          markedDates={markedDates}
          eventsByDate={eventsByDate}
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
  games,
  isLoading,
  navigateToGame,
  navigateToLineup,
  navigateToNewGame,
}: {
  games: Game[];
  isLoading: boolean;
  navigateToGame: (gameId: string) => void;
  navigateToLineup: (gameId: string) => void;
  navigateToNewGame: () => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      {!isLoading && games.length === 0 ? (
        <View style={appScreenStyles.card}>
          <Text style={appScreenStyles.cardTitle}>
            {t('games.emptyTitle')}
          </Text>
          <Text style={appScreenStyles.cardDescription}>
            {t('games.emptyDescription')}
          </Text>
          <Button
            title={t('games.addFirstGameButton')}
            onPress={navigateToNewGame}
          />
        </View>
      ) : null}
      <View style={appScreenStyles.list}>
        {games.map((game) => (
          <View key={game.id} style={appScreenStyles.card}>
            <Pressable
              accessibilityRole="button"
              onPress={() => navigateToGame(game.id)}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <View style={appScreenStyles.row}>
                <View style={styles.details}>
                  <Text style={appScreenStyles.cardTitle}>
                    {t('games.opponentTitle', {
                      opponentName: game.opponent_name,
                    })}
                  </Text>
                  <Text style={appScreenStyles.meta}>
                    {formatGameDate(game.game_date)}
                  </Text>
                  {game.location ? (
                    <Text style={appScreenStyles.meta}>{game.location}</Text>
                  ) : null}
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {game.is_home
                      ? t('games.homeBadge')
                      : t('games.awayBadge')}
                  </Text>
                </View>
              </View>
            </Pressable>
            <Button
              title={t('gameForm.lineupButton')}
              onPress={() => navigateToLineup(game.id)}
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
  eventsByDate,
  selectedDateKey,
  onMonthChange,
  onOpenEvent,
  onSelectDate,
}: {
  events: ScheduleEvent[];
  markedDates: MarkedDates;
  eventsByDate: Map<string, ScheduleEvent[]>;
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
          dayComponent={({ date, state }) => {
            const dateString = date?.dateString ?? '';
            const dayEvents = eventsByDate.get(dateString) ?? [];
            const primaryEvent = dayEvents[0];
            const isSelected = dateString === selectedDateKey;
            const isDisabled = state === 'disabled';

            return (
              <Pressable
                accessibilityRole="button"
                disabled={!dateString}
                onPress={() => onSelectDate(dateString)}
                style={[
                  styles.monthDayBox,
                  primaryEvent && {
                    backgroundColor: primaryEvent.color,
                    borderColor: primaryEvent.color,
                  },
                  isSelected && styles.monthDayBoxSelected,
                  isDisabled && styles.monthDayBoxDisabled,
                ]}
              >
                <Text
                  style={[
                    styles.monthDayText,
                    primaryEvent && {
                      color: getReadableTextColor(primaryEvent.color),
                    },
                    isDisabled && styles.monthDayTextDisabled,
                  ]}
                >
                  {date?.day}
                </Text>
                {dayEvents.length > 1 ? (
                  <Text
                    style={[
                      styles.monthDayCount,
                      primaryEvent && {
                        color: getReadableTextColor(primaryEvent.color),
                      },
                    ]}
                  >
                    {dayEvents.length}
                  </Text>
                ) : null}
              </Pressable>
            );
          }}
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
  selectedDateKey,
  weekDays,
  onOpenEvent,
  onSelectDate,
}: {
  events: ScheduleEvent[];
  selectedDateKey: string;
  weekDays: Array<{ date: Date; dateKey: string }>;
  onOpenEvent: (event: ScheduleEvent) => void;
  onSelectDate: (dateString: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <View style={appScreenStyles.card}>
      <Text style={appScreenStyles.cardTitle}>
        {t('calendar.weekTitle', { range: formatWeekRange(weekDays) })}
      </Text>
      <View style={styles.weekStack}>
        {weekDays.map((day) => {
          const dayEvents = events.filter(
            (event) => event.dateKey === day.dateKey,
          );
          const primaryEvent = dayEvents[0];

          return (
            <Pressable
              accessibilityRole="button"
              key={day.dateKey}
              onPress={() => {
                onSelectDate(day.dateKey);

                if (primaryEvent) {
                  onOpenEvent(primaryEvent);
                }
              }}
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
              </View>
              {primaryEvent ? (
                <View
                  style={[
                    styles.weekEvent,
                    { borderLeftColor: primaryEvent.color },
                  ]}
                >
                  <Text style={styles.weekEventText}>
                    {primaryEvent.label}
                  </Text>
                  {dayEvents.length > 1 ? (
                    <Text style={styles.moreEventsText}>
                      {t('calendar.moreEvents', {
                        count: dayEvents.length - 1,
                      })}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <Text style={styles.emptyDayText}>
                  {t('calendar.emptyDay')}
                </Text>
              )}
            </Pressable>
          );
        })}
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
          <Text style={styles.eventText}>{event.label}</Text>
        </Pressable>
      ))}
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
  eventColors,
  games,
  practices,
  t,
}: {
  eventColors: { home: string; away: string; practice: string };
  games: Game[];
  practices: PracticePlan[];
  t: (key: string, values?: Record<string, unknown>) => string;
}) {
  const gameEvents: ScheduleEvent[] = games.map((game) => {
    const date = parseDate(game.game_date);

    return {
      color: game.is_home ? eventColors.home : eventColors.away,
      date,
      dateKey: toDateKey(date),
      id: game.id,
      label: t('calendar.gameEventLabel', {
        opponentName: game.opponent_name,
        time: formatTimeOnly(date),
      }),
      sortTime: date.getTime(),
      type: game.is_home ? 'home_game' : 'away_game',
    };
  });
  const practiceEvents: ScheduleEvent[] = practices.map((practice) => {
    const date = parseDate(practice.practice_date);

    return {
      color: eventColors.practice,
      date,
      dateKey: toDateKey(date),
      id: practice.id,
      label: t('calendar.practiceEventLabel', {
        time: formatTimeOnly(date),
      }),
      sortTime: date.getTime(),
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

function makeMarkedDates(events: ScheduleEvent[], selectedDateKey: string) {
  const markedDates: MarkedDates = {};

  events.forEach((event) => {
    const current = markedDates[event.dateKey] ?? { dots: [] };
    const dots = current.dots ?? [];

    if (!dots.some((dot) => dot.key === event.type)) {
      dots.push({ color: event.color, key: event.type });
    }

    markedDates[event.dateKey] = { ...current, dots };
  });

  markedDates[selectedDateKey] = {
    ...(markedDates[selectedDateKey] ?? {}),
    selected: true,
    selectedColor: '#e7ede8',
  };

  return markedDates;
}

function groupEventsByDate(events: ScheduleEvent[]) {
  const eventsByDate = new Map<string, ScheduleEvent[]>();

  events.forEach((event) => {
    const existingEvents = eventsByDate.get(event.dateKey) ?? [];
    eventsByDate.set(event.dateKey, [...existingEvents, event]);
  });

  return eventsByDate;
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
          body { color: #15251f; font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 28px; }
          h1 { margin-bottom: 4px; }
          h2 { color: #59636e; font-size: 16px; margin-top: 0; }
          li { border-left: 5px solid #b8442f; list-style: none; margin: 12px 0; padding: 10px 12px; }
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

function getReadableTextColor(backgroundColor: string) {
  const normalized = backgroundColor.replace('#', '');

  if (normalized.length !== 6) {
    return '#ffffff';
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;

  return luminance > 0.62 ? '#15251f' : '#ffffff';
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
    backgroundColor: '#e7ede8',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    color: '#276749',
    fontSize: 12,
    fontWeight: '700',
  },
  calendarCard: {
    backgroundColor: '#ffffff',
    borderColor: '#ccd3ce',
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
    color: '#8f9a94',
    fontSize: 12,
    lineHeight: 16,
  },
  eventList: {
    gap: 10,
  },
  eventRow: {
    backgroundColor: '#f4f6f3',
    borderLeftWidth: 5,
    borderRadius: 10,
    padding: 12,
  },
  eventText: {
    color: '#15251f',
    fontSize: 14,
    fontWeight: '800',
  },
  headerActions: {
    alignItems: 'flex-start',
  },
  moreEventsText: {
    color: '#59636e',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  monthDayBox: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#d6deda',
    borderRadius: 8,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    marginVertical: 1,
    position: 'relative',
    width: 38,
  },
  monthDayBoxDisabled: {
    opacity: 0.35,
  },
  monthDayBoxSelected: {
    borderColor: '#b8442f',
    borderWidth: 2,
  },
  monthDayCount: {
    bottom: 2,
    fontSize: 9,
    fontWeight: '900',
    position: 'absolute',
    right: 4,
  },
  monthDayText: {
    color: '#15251f',
    fontSize: 14,
    fontWeight: '800',
  },
  monthDayTextDisabled: {
    color: '#8f9a94',
  },
  pressed: {
    backgroundColor: '#e7ede8',
  },
  segmentedControl: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  segmentedOption: {
    backgroundColor: '#ffffff',
    borderColor: '#ccd3ce',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  segmentedOptionActive: {
    backgroundColor: '#e7ede8',
    borderColor: '#b8442f',
  },
  segmentedOptionText: {
    color: '#25332e',
    fontSize: 14,
    fontWeight: '700',
  },
  segmentedOptionTextActive: {
    color: '#b8442f',
  },
  weekDay: {
    alignItems: 'center',
    borderColor: '#ccd3ce',
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
    color: '#59636e',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  weekDayNumber: {
    color: '#15251f',
    fontSize: 20,
    fontWeight: '900',
  },
  weekDaySelected: {
    borderColor: '#b8442f',
  },
  weekEvent: {
    backgroundColor: '#f4f6f3',
    borderLeftWidth: 5,
    borderRadius: 8,
    flex: 1,
    padding: 8,
  },
  weekEventText: {
    color: '#15251f',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  weekStack: {
    gap: 10,
    paddingVertical: 4,
  },
});
