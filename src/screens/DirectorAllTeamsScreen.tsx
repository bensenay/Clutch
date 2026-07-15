import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Button, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { AppScreen, appScreenStyles } from '../components/AppScreen';
import type { AuthenticatedStackParamList } from '../navigation/types';
import { useActiveTeam } from '../teams/ActiveTeamContext';
import { goalRed } from '../theme/theme';

type Props = NativeStackScreenProps<
  AuthenticatedStackParamList,
  'DirectorAllTeams'
>;

type Profile = {
  role: 'super_admin' | 'director' | 'coach';
  school_id: string | null;
};

type Team = {
  id: string;
  name: string;
  level: string | null;
  season: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  tertiary_color: string | null;
  logo_url: string | null;
};

export function DirectorAllTeamsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const { setActiveTeam } = useActiveTeam();

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
  const teamsQuery = useQuery({
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

      return (data ?? []) as Team[];
    },
    enabled: profile?.role === 'director' && Boolean(profile.school_id),
  });

  if (profileQuery.isLoading) {
    return (
      <AppScreen title={t('directorAllTeams.title')}>
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
      description={t('directorAllTeams.description')}
      title={t('directorAllTeams.title')}
    >
      {teamsQuery.isLoading ? (
        <Text style={appScreenStyles.note}>{t('common.loading')}</Text>
      ) : null}
      {teamsQuery.error ? (
        <Text style={appScreenStyles.error}>
          {t('directorAllTeams.error')}
        </Text>
      ) : null}
      {!teamsQuery.isLoading && teamsQuery.data?.length === 0 ? (
        <View style={appScreenStyles.card}>
          <Text style={appScreenStyles.cardTitle}>
            {t('directorAllTeams.emptyTitle')}
          </Text>
          <Text style={appScreenStyles.cardDescription}>
            {t('directorAllTeams.emptyDescription')}
          </Text>
        </View>
      ) : null}
      <View style={appScreenStyles.list}>
        {(teamsQuery.data ?? []).map((team) => (
          <View key={team.id} style={appScreenStyles.card}>
            <Text style={appScreenStyles.cardTitle}>{team.name}</Text>
            <Text style={appScreenStyles.meta}>
              {t('directorAllTeams.teamMeta', {
                level: team.level || t('common.notSet'),
                season: team.season || t('common.notSet'),
              })}
            </Text>
            <Button
              color={goalRed}
              title={t('directorAllTeams.viewRosterButton')}
              onPress={() => {
                setActiveTeam(team);
                navigation.navigate('MainTabs', { screen: 'RosterTab' });
              }}
            />
            <Button
              color={goalRed}
              title={t('directorAllTeams.viewGamesButton')}
              onPress={() => {
                setActiveTeam(team);
                navigation.navigate('MainTabs', { screen: 'GameDayTab' });
              }}
            />
          </View>
        ))}
      </View>
    </AppScreen>
  );
}
