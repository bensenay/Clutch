import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Button, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { AppScreen, appScreenStyles } from '../components/AppScreen';
import type {
  AuthenticatedStackParamList,
  AuthenticatedTabParamList,
} from '../navigation/types';
import { useActiveTeam } from '../teams/ActiveTeamContext';
import { goalRed } from '../theme/theme';
import { formatGameDate } from './GameListScreen';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AuthenticatedTabParamList, 'PracticesTab'>,
  NativeStackScreenProps<AuthenticatedStackParamList>
>;

export type PracticePlan = {
  id: string;
  team_id: string;
  practice_date: string;
  segments: unknown;
};

export function PracticesScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { activeTeam, isReadOnlyTeam } = useActiveTeam();
  const practicePlansQuery = useQuery({
    queryKey: ['practice-plans', activeTeam?.id],
    queryFn: async () => {
      if (!activeTeam) {
        throw new Error(t('practices.noActiveTeamTitle'));
      }

      const { data, error } = await supabase
        .from('practice_plans')
        .select('id, team_id, practice_date, segments')
        .eq('team_id', activeTeam.id)
        .order('practice_date', { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []) as PracticePlan[];
    },
    enabled: Boolean(activeTeam),
  });

  if (!activeTeam) {
    return (
      <AppScreen
        description={t('practices.noActiveTeamDescription')}
        title={t('practices.noActiveTeamTitle')}
      />
    );
  }

  const plans = practicePlansQuery.data ?? [];

  return (
    <AppScreen
      action={
        isReadOnlyTeam ? undefined : (
          <Button
            color={goalRed}
            title={t('practices.addPracticePlanButton')}
            onPress={() => navigation.navigate('PracticePlanDetail')}
          />
        )
      }
      description={t('practices.description', { teamName: activeTeam.name })}
      title={t('practices.title')}
    >
      {practicePlansQuery.isLoading ? (
        <Text style={appScreenStyles.note}>{t('common.loading')}</Text>
      ) : null}
      {practicePlansQuery.error ? (
        <Text style={appScreenStyles.error}>{t('practices.loadError')}</Text>
      ) : null}
      {!practicePlansQuery.isLoading && plans.length === 0 ? (
        <View style={appScreenStyles.card}>
          <Text style={appScreenStyles.cardTitle}>
            {t('practices.emptyTitle')}
          </Text>
          <Text style={appScreenStyles.cardDescription}>
            {t('practices.emptyDescription')}
          </Text>
          {isReadOnlyTeam ? null : (
            <Button
              color={goalRed}
              title={t('practices.addFirstPracticePlanButton')}
              onPress={() => navigation.navigate('PracticePlanDetail')}
            />
          )}
        </View>
      ) : null}
      <View style={appScreenStyles.list}>
        {plans.map((plan) => (
          <Pressable
            accessibilityRole="button"
            key={plan.id}
            onPress={() =>
              navigation.navigate('PracticePlanDetail', {
                practicePlanId: plan.id,
                readOnly: isReadOnlyTeam,
              })
            }
            style={appScreenStyles.card}
          >
            <Text style={appScreenStyles.cardTitle}>
              {formatGameDate(plan.practice_date)}
            </Text>
            <Text style={appScreenStyles.cardDescription}>
              {t('practices.segmentCount', {
                count: countSegments(plan.segments),
              })}
            </Text>
          </Pressable>
        ))}
      </View>
    </AppScreen>
  );
}

function countSegments(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}
