import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { AppButton } from '../components/AppButton';
import { AppScreen, appScreenStyles } from '../components/AppScreen';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import type { AuthenticatedStackParamList } from '../navigation/types';
import { addDays, endOfDay, formatTime, startOfDay } from '../schedule/dates';
import type { EventStaffAssignment, ScheduleEvent } from '../schedule/types';
import { useActiveTeam, type ActiveTeam } from '../teams/ActiveTeamContext';
import { colors, radii, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<AuthenticatedStackParamList, 'Dashboard'>;

type DashboardPlayer = {
  id: string;
  team_id: string;
  first_name: string;
  last_name: string;
  status: 'active' | 'injured' | 'suspended';
  status_note: string | null;
};

export function TeamTabScreen({ navigation }: Props) {
  const { i18n, t } = useTranslation();
  const { activeTeam, isLoadingTeams, role, setActiveTeam, teams, teamsError } = useActiveTeam();
  const dashboardTeams = role === 'director' ? teams : activeTeam ? [activeTeam] : [];
  const teamIds = dashboardTeams.map((team) => team.id);
  const key = teamIds.join(',');
  const playersQuery = useQuery({
    queryKey: ['dashboard', 'players', key],
    queryFn: async () => {
      if (teamIds.length === 0) return [] as DashboardPlayer[];
      const { data, error } = await supabase
        .from('players')
        .select('id, team_id, first_name, last_name, status, status_note')
        .in('team_id', teamIds)
        .order('last_name');
      if (error) throw error;
      return (data ?? []) as DashboardPlayer[];
    },
    enabled: teamIds.length > 0,
  });
  const rangeStart = startOfDay(new Date());
  const rangeEnd = endOfDay(addDays(rangeStart, 7));
  const eventsQuery = useQuery({
    queryKey: ['dashboard', 'events', key, rangeStart.toISOString()],
    queryFn: async () => {
      if (teamIds.length === 0) return [] as ScheduleEvent[];
      const { data, error } = await supabase
        .from('schedule_events')
        .select('*')
        .in('team_id', teamIds)
        .gte('starts_at', rangeStart.toISOString())
        .lt('starts_at', rangeEnd.toISOString())
        .order('starts_at');
      if (error) throw error;
      return (data ?? []) as ScheduleEvent[];
    },
    enabled: teamIds.length > 0,
  });
  const eventIds = (eventsQuery.data ?? []).map((event) => event.id);
  const staffQuery = useQuery({
    queryKey: ['dashboard', 'staff', eventIds.join(',')],
    queryFn: async () => {
      if (eventIds.length === 0) return [] as EventStaffAssignment[];
      const { data, error } = await supabase.rpc('get_schedule_event_staff', { check_event_ids: eventIds });
      if (error) throw error;
      return (data ?? []) as EventStaffAssignment[];
    },
    enabled: eventIds.length > 0,
  });
  const players = playersQuery.data ?? [];
  const events = eventsQuery.data ?? [];
  const staffByEvent = useMemo(() => {
    const map = new Map<string, EventStaffAssignment[]>();
    for (const row of staffQuery.data ?? []) map.set(row.event_id, [...(map.get(row.event_id) ?? []), row]);
    return map;
  }, [staffQuery.data]);

  function openEvent(event: ScheduleEvent) {
    const team = teams.find((candidate) => candidate.id === event.team_id);
    if (role !== 'director' && team) setActiveTeam(team);
    navigation.navigate('MainTabs', { screen: 'ScheduleTab', params: { eventId: event.id } });
  }

  function openPlayer(player: DashboardPlayer) {
    const team = teams.find((candidate) => candidate.id === player.team_id);
    if (team) setActiveTeam(team);
    navigation.navigate('PlayerForm', { playerId: player.id, readOnly: team?.membership_role === 'assistant_coach' });
  }

  const isLoading = isLoadingTeams || playersQuery.isLoading || eventsQuery.isLoading || staffQuery.isLoading;
  const hasError = teamsError || Boolean(playersQuery.error || eventsQuery.error || staffQuery.error);

  return (
    <AppScreen
      action={role === 'director' ? <AppButton icon="add-circle-outline" title={t('teamForm.addButton')} onPress={() => navigation.navigate('TeamForm')} /> : undefined}
      description={role === 'director' ? t('dashboard.directorDescription') : t('dashboard.coachDescription', { teamName: activeTeam?.name ?? '' })}
      title={t('dashboard.title')}
    >
      {isLoading ? <LoadingState /> : null}
      {hasError ? <Text style={appScreenStyles.error}>{t('dashboard.loadError')}</Text> : null}
      {role === 'super_admin' ? (
        <View style={appScreenStyles.card}>
          <Text style={appScreenStyles.cardTitle}>{t('home.superAdminTitle')}</Text>
          <Text style={appScreenStyles.cardDescription}>{t('home.superAdminDescription')}</Text>
          <AppButton icon="shield-checkmark-outline" title={t('superAdmin.openButton')} onPress={() => navigation.navigate('SuperAdmin')} />
        </View>
      ) : null}
      {!isLoading && role !== 'super_admin' && dashboardTeams.length === 0 ? <EmptyState icon="shield-outline" title={t('dashboard.noTeamTitle')} description={t('dashboard.noTeamDescription')} /> : null}
      {dashboardTeams.map((team) => (
        <TeamSummary
          events={events.filter((event) => event.team_id === team.id)}
          key={team.id}
          locale={i18n.language}
          players={players.filter((player) => player.team_id === team.id)}
          staffByEvent={staffByEvent}
          team={team}
          onOpenEvent={openEvent}
          onOpenPlayer={openPlayer}
        />
      ))}
    </AppScreen>
  );
}

function TeamSummary({ team, players, events, staffByEvent, locale, onOpenEvent, onOpenPlayer }: {
  team: ActiveTeam;
  players: DashboardPlayer[];
  events: ScheduleEvent[];
  staffByEvent: Map<string, EventStaffAssignment[]>;
  locale: string;
  onOpenEvent: (event: ScheduleEvent) => void;
  onOpenPlayer: (player: DashboardPlayer) => void;
}) {
  const { t } = useTranslation();
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const todayEvents = events.filter((event) => {
    const time = new Date(event.starts_at).getTime();
    return time >= todayStart.getTime() && time < todayEnd.getTime();
  });
  const weekGames = events.filter((event) => event.event_type === 'game');
  const unavailable = players.filter((player) => player.status !== 'active');

  return (
    <View style={appScreenStyles.card}>
      <View style={appScreenStyles.row}>
        <View style={styles.teamCopy}>
          <Text style={styles.teamName}>{team.name}</Text>
          <Text style={appScreenStyles.meta}>{[team.level, team.season].filter(Boolean).join(' / ')}</Text>
        </View>
        <View style={styles.countBadge}><Text style={styles.countText}>{t('dashboard.rosterCount', { count: players.length })}</Text></View>
      </View>
      <Text style={styles.sectionTitle}>{t('dashboard.todayTitle')}</Text>
      {todayEvents.length === 0 ? <Text style={appScreenStyles.note}>{t('dashboard.noEventsToday')}</Text> : todayEvents.map((event) => <DashboardEvent key={event.id} event={event} locale={locale} staff={staffByEvent.get(event.id) ?? []} onPress={() => onOpenEvent(event)} />)}
      {weekGames.length > 0 ? <><Text style={styles.sectionTitle}>{t('dashboard.gamesThisWeek')}</Text>{weekGames.map((event) => <DashboardEvent key={event.id} event={event} locale={locale} staff={staffByEvent.get(event.id) ?? []} onPress={() => onOpenEvent(event)} />)}</> : null}
      <Text style={styles.sectionTitle}>{t('dashboard.unavailableTitle')}</Text>
      {unavailable.length === 0 ? <Text style={appScreenStyles.note}>{t('dashboard.everyoneAvailable')}</Text> : unavailable.map((player) => (
        <AnimatedPressable accessibilityRole="button" key={player.id} onPress={() => onOpenPlayer(player)} style={styles.playerRow}>
          <View style={styles.teamCopy}>
            <Text style={styles.playerName}>{player.first_name} {player.last_name}</Text>
            <Text style={appScreenStyles.cardDescription}>{player.status_note || t('dashboard.noStatusNote')}</Text>
          </View>
          <Text style={styles.statusBadge}>{t(`playerForm.statuses.${player.status}`)}</Text>
        </AnimatedPressable>
      ))}
    </View>
  );
}

function DashboardEvent({ event, staff, locale, onPress }: { event: ScheduleEvent; staff: EventStaffAssignment[]; locale: string; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <AnimatedPressable accessibilityRole="button" onPress={onPress} style={styles.eventRow}>
      <View style={styles.eventTime}><Text style={styles.eventTimeText}>{formatTime(event.starts_at, locale)}</Text></View>
      <View style={styles.teamCopy}>
        <Text style={styles.playerName}>{event.title}</Text>
        <Text style={appScreenStyles.meta}>{t(`schedule.eventTypes.${event.event_type}`)} • {event.location || t('calendar.noLocation')}</Text>
        {event.event_type === 'practice' ? (
          <Text style={appScreenStyles.meta}>
            {t('schedule.goalieCoach', {
              value: event.goalie_coach_attending ? t('common.yes') : t('common.no'),
            })}
          </Text>
        ) : null}
        {staff.length > 0 ? <Text numberOfLines={1} style={appScreenStyles.meta}>{staff.map((row) => `${row.coach_name}: ${t(`schedule.statuses.${row.status}`)}`).join(' • ')}</Text> : null}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  countBadge: { backgroundColor: colors.cardPressed, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  countText: { color: colors.textPrimary, fontSize: 12, fontWeight: '800' },
  eventRow: { alignItems: 'flex-start', borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md },
  eventTime: { backgroundColor: colors.rinkNavy, borderRadius: radii.sm, padding: spacing.sm },
  eventTimeText: { color: colors.iceWhite, fontSize: 12, fontWeight: '800' },
  playerName: { color: colors.textPrimary, fontWeight: '800' },
  playerRow: { alignItems: 'center', borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md },
  sectionTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '900', marginTop: spacing.sm },
  statusBadge: { backgroundColor: colors.dangerSoft, borderRadius: radii.pill, color: colors.goalRed, fontSize: 11, fontWeight: '900', overflow: 'hidden', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  teamCopy: { flex: 1 },
  teamName: { color: colors.textPrimary, fontSize: 21, fontWeight: '900' },
});
