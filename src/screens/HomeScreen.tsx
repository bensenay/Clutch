import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Button, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { AppScreen, appScreenStyles } from '../components/AppScreen';
import { TeamSwitcher } from '../components/TeamSwitcher';
import type { AuthenticatedStackParamList } from '../navigation/types';
import {
  type ActiveTeam,
  useActiveTeam,
} from '../teams/ActiveTeamContext';

type Props = NativeStackScreenProps<AuthenticatedStackParamList, 'Home'>;

type Profile = {
  id: string;
  email: string;
  name: string | null;
  role: 'super_admin' | 'director' | 'coach';
  school_id: string | null;
};

type MembershipRow = {
  team_id: string;
  teams:
    | {
        id: string;
        name: string;
        level: string | null;
        season: string | null;
        primary_color: string | null;
      }
    | {
        id: string;
        name: string;
        level: string | null;
        season: string | null;
        primary_color: string | null;
      }[]
    | null;
};

export function HomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { session, signOut } = useAuth();
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
  const teamsQuery = useQuery({
    queryKey: ['coach-teams', session?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_memberships')
        .select('team_id, teams ( id, name, level, season, primary_color )')
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      return ((data ?? []) as MembershipRow[])
        .map((row) => {
          const team = Array.isArray(row.teams) ? row.teams[0] : row.teams;

          if (!team) {
            return null;
          }

          return {
            id: team.id,
            name: team.name,
            level: team.level,
            season: team.season,
            primary_color: team.primary_color,
          };
        })
        .filter((team): team is ActiveTeam => Boolean(team));
    },
    enabled: profile?.role === 'coach',
  });

  const coachTeams = teamsQuery.data ?? [];

  useEffect(() => {
    if (profile?.role && profile.role !== 'coach') {
      setActiveTeam(null);
    }
  }, [profile?.role, setActiveTeam]);

  useEffect(() => {
    if (profile?.role !== 'coach') {
      return;
    }

    if (!coachTeams.length) {
      setActiveTeam(null);
      return;
    }

    if (!activeTeam || !coachTeams.some((team) => team.id === activeTeam.id)) {
      setActiveTeam(coachTeams[0]);
    }
  }, [activeTeam, coachTeams, profile?.role, setActiveTeam]);

  async function handleSignOut() {
    try {
      setActiveTeam(null);
      await signOut();
    } catch (error) {
      console.error('Unable to sign out:', error);
    }
  }

  const displayName = profile?.name || profile?.email || t('home.fallbackUser');

  return (
    <AppScreen
      description={t('home.description', { name: displayName })}
      title={t('home.title')}
    >
      {profileQuery.isLoading ? (
        <Text style={appScreenStyles.note}>{t('common.loading')}</Text>
      ) : null}
      {profileQuery.error ? (
        <Text style={appScreenStyles.error}>{t('home.profileError')}</Text>
      ) : null}
      {profile?.role === 'director' ? (
        <View style={appScreenStyles.list}>
          <View style={appScreenStyles.card}>
            <Text style={appScreenStyles.cardTitle}>
              {t('home.directorTitle')}
            </Text>
            <Text style={appScreenStyles.cardDescription}>
              {t('home.directorDescription')}
            </Text>
            <Button
              title={t('home.allTeamsButton')}
              onPress={() => navigation.navigate('DirectorAllTeams')}
            />
            <Button
              title={t('home.settingsButton')}
              onPress={() => navigation.navigate('DirectorSettings')}
            />
          </View>
        </View>
      ) : null}
      {profile?.role === 'coach' ? (
        <View style={appScreenStyles.list}>
          {teamsQuery.isLoading ? (
            <Text style={appScreenStyles.note}>
              {t('teamSwitcher.loading')}
            </Text>
          ) : null}
          {teamsQuery.error ? (
            <Text style={appScreenStyles.error}>
              {t('teamSwitcher.error')}
            </Text>
          ) : null}
          <TeamSwitcher teams={coachTeams} />
          <View style={appScreenStyles.card}>
            <Text style={appScreenStyles.cardTitle}>
              {t('home.activeTeamTitle')}
            </Text>
            <Text style={appScreenStyles.cardDescription}>
              {activeTeam
                ? t('home.activeTeamDescription', {
                    teamName: activeTeam.name,
                  })
                : t('home.noActiveTeamDescription')}
            </Text>
            {activeTeam ? (
              <>
                <Button
                  title={t('home.rosterButton')}
                  onPress={() => navigation.navigate('Roster')}
                />
                <Button
                  title={t('home.gamesButton')}
                  onPress={() => navigation.navigate('Games')}
                />
              </>
            ) : null}
          </View>
        </View>
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
      <Button title={t('common.signOut')} onPress={() => void handleSignOut()} />
    </AppScreen>
  );
}
