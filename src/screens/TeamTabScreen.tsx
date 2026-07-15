import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Button, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { AppScreen, appScreenStyles } from '../components/AppScreen';
import type {
  AuthenticatedStackParamList,
  AuthenticatedTabParamList,
} from '../navigation/types';
import {
  type ActiveTeam,
  useActiveTeam,
} from '../teams/ActiveTeamContext';
import { formatGameDate } from './GameListScreen';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AuthenticatedTabParamList, 'TeamTab'>,
  NativeStackScreenProps<AuthenticatedStackParamList>
>;

type Profile = {
  id: string;
  email: string;
  name: string | null;
  role: 'super_admin' | 'director' | 'coach';
  school_id: string | null;
};

type MembershipRow = {
  team_id: string;
  teams: ActiveTeam | ActiveTeam[] | null;
};

type TeamGameSummary = {
  id: string;
  opponent_name: string;
  game_date: string;
  is_home: boolean;
  result: 'win' | 'loss' | 'tie' | null;
};

const EMPTY_TEAMS: ActiveTeam[] = [];

export function TeamTabScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const { activeTeam, setActiveTeam } = useActiveTeam();

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
  const directorTeamsQuery = useQuery({
    queryKey: ['director-teams', profile?.school_id],
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

      return (data ?? []) as ActiveTeam[];
    },
    enabled: profile?.role === 'director' && Boolean(profile.school_id),
  });

  const coachTeamsQuery = useQuery({
    queryKey: ['coach-teams', session?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_memberships')
        .select(
          'team_id, teams ( id, name, level, season, primary_color, secondary_color, tertiary_color, logo_url )',
        )
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      return ((data ?? []) as MembershipRow[])
        .map((row) => {
          const team = Array.isArray(row.teams) ? row.teams[0] : row.teams;
          return team ?? null;
        })
        .filter((team): team is ActiveTeam => Boolean(team));
    },
    enabled: profile?.role === 'coach',
  });

  const teams =
    profile?.role === 'director'
      ? directorTeamsQuery.data ?? EMPTY_TEAMS
      : coachTeamsQuery.data ?? EMPTY_TEAMS;
  const isLoading =
    profileQuery.isLoading ||
    directorTeamsQuery.isLoading ||
    coachTeamsQuery.isLoading;
  const hasError =
    Boolean(profileQuery.error) ||
    Boolean(directorTeamsQuery.error) ||
    Boolean(coachTeamsQuery.error);

  useEffect(() => {
    if (profile?.role === 'coach' && teams.length === 1) {
      setActiveTeam(teams[0]);
    }
  }, [profile?.role, setActiveTeam, teams]);

  useEffect(() => {
    if (!activeTeam || teams.length === 0) {
      return;
    }

    if (!teams.some((team) => team.id === activeTeam.id)) {
      setActiveTeam(null);
    }
  }, [activeTeam, setActiveTeam, teams]);

  return (
    <AppScreen
      description={t('teamTab.description')}
      title={t('teamTab.title')}
    >
      {isLoading ? (
        <Text style={appScreenStyles.note}>{t('common.loading')}</Text>
      ) : null}
      {hasError ? (
        <Text style={appScreenStyles.error}>{t('teamTab.loadError')}</Text>
      ) : null}
      {profile?.role === 'super_admin' ? (
        <View style={appScreenStyles.card}>
          <Text style={appScreenStyles.cardTitle}>
            {t('home.superAdminTitle')}
          </Text>
          <Text style={appScreenStyles.cardDescription}>
            {t('home.superAdminDescription')}
          </Text>
        </View>
      ) : null}
      {activeTeam ? (
        <TeamDashboard
          team={activeTeam}
          onOpenGame={(gameId) => navigation.navigate('GameForm', { gameId })}
        />
      ) : null}
      {(profile?.role === 'director' ||
        (profile?.role === 'coach' && teams.length > 1)) &&
      !isLoading ? (
        <View style={appScreenStyles.card}>
          <Text style={appScreenStyles.cardTitle}>
            {t('teamTab.teamListTitle')}
          </Text>
          <Text style={appScreenStyles.cardDescription}>
            {t('teamTab.teamListDescription')}
          </Text>
          <View style={styles.list}>
            {teams.map((team) => (
              <Pressable
                accessibilityRole="button"
                key={team.id}
                onPress={() => setActiveTeam(team)}
                style={[
                  styles.teamRow,
                  activeTeam?.id === team.id && styles.activeTeamRow,
                ]}
              >
                <Text
                  style={[
                    styles.teamName,
                    activeTeam?.id === team.id && styles.activeTeamName,
                  ]}
                >
                  {team.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
      {!isLoading && profile?.role !== 'super_admin' && teams.length === 0 ? (
        <View style={appScreenStyles.card}>
          <Text style={appScreenStyles.cardTitle}>
            {t('teamTab.emptyTitle')}
          </Text>
          <Text style={appScreenStyles.cardDescription}>
            {t('teamTab.emptyDescription')}
          </Text>
        </View>
      ) : null}
    </AppScreen>
  );
}

function TeamDashboard({
  team,
  onOpenGame,
}: {
  team: ActiveTeam;
  onOpenGame: (gameId: string) => void;
}) {
  const { t } = useTranslation();
  const playersCountQuery = useQuery({
    queryKey: ['team-dashboard-player-count', team.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('players')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', team.id);

      if (error) {
        throw error;
      }

      return count ?? 0;
    },
  });
  const gamesQuery = useQuery({
    queryKey: ['team-dashboard-games', team.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('games')
        .select('id, opponent_name, game_date, is_home, result')
        .eq('team_id', team.id)
        .order('game_date', { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []) as TeamGameSummary[];
    },
  });
  const games = gamesQuery.data ?? [];
  const record = games.reduce(
    (summary, game) => {
      if (game.result === 'win') {
        summary.wins += 1;
      } else if (game.result === 'loss') {
        summary.losses += 1;
      } else if (game.result === 'tie') {
        summary.ties += 1;
      }

      return summary;
    },
    { wins: 0, losses: 0, ties: 0 },
  );
  const now = Date.now();
  const nextGame = games.find(
    (game) => new Date(game.game_date).getTime() >= now,
  );
  const initials = getTeamInitials(team.name);

  return (
    <View style={appScreenStyles.card}>
      <View style={styles.dashboardHeader}>
        <View style={styles.logoFrame}>
          {team.logo_url ? (
            <Image
              source={{ uri: team.logo_url }}
              style={styles.logoImage}
            />
          ) : (
            <Text style={styles.logoPlaceholder}>{initials}</Text>
          )}
        </View>
        <View style={styles.dashboardTitleBlock}>
          <Text style={appScreenStyles.cardTitle}>{team.name}</Text>
          <Text style={appScreenStyles.meta}>
            {[team.level, team.season].filter(Boolean).join(' / ') ||
              t('teamSwitcher.noDetails')}
          </Text>
        </View>
      </View>
      {playersCountQuery.error || gamesQuery.error ? (
        <Text style={appScreenStyles.error}>
          {t('teamTab.dashboardLoadError')}
        </Text>
      ) : null}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {playersCountQuery.isLoading
              ? t('common.loading')
              : playersCountQuery.data ?? 0}
          </Text>
          <Text style={styles.statLabel}>{t('teamTab.rosterSizeLabel')}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {gamesQuery.isLoading
              ? t('common.loading')
              : t('teamTab.recordValue', record)}
          </Text>
          <Text style={styles.statLabel}>{t('teamTab.recordLabel')}</Text>
        </View>
      </View>
      <View style={styles.nextGameCard}>
        <Text style={styles.sectionTitle}>{t('teamTab.nextGameTitle')}</Text>
        {gamesQuery.isLoading ? (
          <Text style={appScreenStyles.note}>{t('common.loading')}</Text>
        ) : nextGame ? (
          <>
            <Text style={styles.nextGameOpponent}>
              {t('games.opponentTitle', {
                opponentName: nextGame.opponent_name,
              })}
            </Text>
            <Text style={appScreenStyles.meta}>
              {formatGameDate(nextGame.game_date)}
            </Text>
            <Text style={appScreenStyles.meta}>
              {nextGame.is_home
                ? t('games.homeBadge')
                : t('games.awayBadge')}
            </Text>
            <Button
              title={t('teamTab.openNextGameButton')}
              onPress={() => onOpenGame(nextGame.id)}
            />
          </>
        ) : games.length === 0 ? (
          <Text style={appScreenStyles.note}>
            {t('teamTab.noGamesDescription')}
          </Text>
        ) : (
          <Text style={appScreenStyles.note}>
            {t('teamTab.noUpcomingGameDescription')}
          </Text>
        )}
      </View>
    </View>
  );
}

function getTeamInitials(teamName: string) {
  const initials = teamName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('');

  return initials || 'CL';
}

const styles = StyleSheet.create({
  activeTeamName: {
    color: '#b8442f',
  },
  activeTeamRow: {
    backgroundColor: '#e7ede8',
    borderColor: '#b8442f',
  },
  dashboardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  dashboardTitleBlock: {
    flex: 1,
    gap: 4,
  },
  list: {
    gap: 10,
  },
  logoFrame: {
    alignItems: 'center',
    backgroundColor: '#e7ede8',
    borderColor: '#b8442f',
    borderRadius: 32,
    borderWidth: 2,
    height: 64,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 64,
  },
  logoImage: {
    height: '100%',
    width: '100%',
  },
  logoPlaceholder: {
    color: '#b8442f',
    fontSize: 20,
    fontWeight: '900',
  },
  nextGameCard: {
    borderColor: '#ccd3ce',
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
    padding: 12,
  },
  nextGameOpponent: {
    color: '#15251f',
    fontSize: 16,
    fontWeight: '800',
  },
  sectionTitle: {
    color: '#25332e',
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  statCard: {
    backgroundColor: '#f4f6f3',
    borderRadius: 10,
    flex: 1,
    gap: 4,
    padding: 12,
  },
  statLabel: {
    color: '#59636e',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statValue: {
    color: '#15251f',
    fontSize: 22,
    fontWeight: '900',
  },
  teamName: {
    color: '#15251f',
    fontSize: 16,
    fontWeight: '800',
  },
  teamRow: {
    borderColor: '#ccd3ce',
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
  },
});
