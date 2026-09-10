import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { AppButton } from '../components/AppButton';
import { AppScreen, appScreenStyles } from '../components/AppScreen';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import type {
  AuthenticatedStackParamList,
  AuthenticatedTabParamList,
} from '../navigation/types';
import { fetchWithCache, makeTeamCacheKey } from '../offline/cache';
import { OfflineNotice } from '../offline/OfflineNotice';
import { useActiveTeam } from '../teams/ActiveTeamContext';
import { spacing } from '../theme/theme';
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
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const practicePlansQuery = useQuery({
    queryKey: ['practice-plans', activeTeam?.id],
    queryFn: async () => {
      if (!activeTeam) {
        throw new Error(t('practices.noActiveTeamTitle'));
      }

      return fetchWithCache<PracticePlan[]>({
        cacheKey: makeTeamCacheKey('practice-plans', activeTeam.id),
        fetcher: async () => {
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
        onCacheFallback: setCachedAt,
        onNetworkSuccess: () => setCachedAt(null),
      });
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
          <AppButton
            icon="add-circle-outline"
            title={t('practices.addPracticePlanButton')}
            onPress={() => navigation.navigate('PracticePlanDetail')}
          />
        )
      }
      description={t('practices.description', { teamName: activeTeam.name })}
      title={t('practices.title')}
    >
      {practicePlansQuery.isLoading ? (
        <LoadingState />
      ) : null}
      {practicePlansQuery.error ? (
        <Text style={appScreenStyles.error}>{t('practices.loadError')}</Text>
      ) : null}
      <OfflineNotice cachedAt={cachedAt} />
      <View style={appScreenStyles.card}>
        <View style={appScreenStyles.row}>
          <View style={styles.drillHeaderCopy}>
            <Text style={appScreenStyles.cardTitle}>
              {t('practices.drillsTitle')}
            </Text>
            <Text style={appScreenStyles.cardDescription}>
              {t('practices.drillsDescription')}
            </Text>
          </View>
        </View>
        <View style={styles.drillActions}>
          <AppButton
            icon="library-outline"
            title={t('practices.openDrillLibraryButton')}
            onPress={() => navigation.navigate('DrillLibrary')}
          />
          <AppButton
            icon="school-outline"
            title={t('practices.openSchoolDrillLibraryButton')}
            onPress={() => navigation.navigate('SchoolDrillLibrary')}
          />
          {isReadOnlyTeam ? null : (
            <AppButton
              icon="add-circle-outline"
              title={t('practices.addDrillButton')}
              onPress={() => navigation.navigate('DrillEditor')}
            />
          )}
        </View>
      </View>
      {!practicePlansQuery.isLoading && plans.length === 0 ? (
        <EmptyState
          description={t('practices.emptyDescription')}
          icon="clipboard-outline"
          title={t('practices.emptyTitle')}
          action={
            isReadOnlyTeam ? undefined : (
              <AppButton
                icon="add-circle-outline"
                title={t('practices.addFirstPracticePlanButton')}
                onPress={() => navigation.navigate('PracticePlanDetail')}
              />
            )
          }
        />
      ) : null}
      <View style={appScreenStyles.list}>
        {plans.map((plan) => (
          <AnimatedPressable
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
          </AnimatedPressable>
        ))}
      </View>
    </AppScreen>
  );
}

function countSegments(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

const styles = StyleSheet.create({
  drillActions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  drillHeaderCopy: {
    flex: 1,
    flexShrink: 1,
  },
});
