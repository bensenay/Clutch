import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { AppButton } from '../components/AppButton';
import { AppScreen, appScreenStyles } from '../components/AppScreen';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import type { AuthenticatedStackParamList } from '../navigation/types';
import { fetchWithCache, makeTeamCacheKey } from '../offline/cache';
import { OfflineNotice } from '../offline/OfflineNotice';
import { useActiveTeam } from '../teams/ActiveTeamContext';

type Props = NativeStackScreenProps<
  AuthenticatedStackParamList,
  'DrillLibrary'
>;

type DrillLibraryRow = {
  id: string;
  team_id: string;
  name: string;
  description: string | null;
  is_published: boolean;
  canvas_data: unknown;
  updated_at: string | null;
  created_at: string;
};

export function DrillLibraryScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { activeTeam, isReadOnlyTeam } = useActiveTeam();
  const [cachedAt, setCachedAt] = useState<string | null>(null);

  const drillsQuery = useQuery({
    queryKey: ['drills', activeTeam?.id],
    queryFn: async () => {
      if (!activeTeam) {
        throw new Error(t('practices.noActiveTeamTitle'));
      }

      return fetchWithCache<DrillLibraryRow[]>({
        cacheKey: makeTeamCacheKey('drills', activeTeam.id),
        fetcher: async () => {
          const { data, error } = await supabase
            .from('drills')
            .select(
              'id, team_id, name, description, is_published, canvas_data, updated_at, created_at',
            )
            .eq('team_id', activeTeam.id)
            .order('updated_at', { ascending: false });

          if (error) {
            throw error;
          }

          return (data ?? []) as DrillLibraryRow[];
        },
        onCacheFallback: setCachedAt,
        onNetworkSuccess: () => setCachedAt(null),
      });
    },
    enabled: Boolean(activeTeam),
  });
  const refetchDrills = drillsQuery.refetch;

  useFocusEffect(
    useCallback(() => {
      if (activeTeam) {
        void refetchDrills();
      }
    }, [activeTeam?.id, refetchDrills]),
  );

  if (!activeTeam) {
    return (
      <AppScreen
        description={t('practices.noActiveTeamDescription')}
        title={t('practices.noActiveTeamTitle')}
      />
    );
  }

  const drills = drillsQuery.data ?? [];

  return (
    <AppScreen
      action={
        isReadOnlyTeam ? undefined : (
          <AppButton
            icon="add-circle-outline"
            title={t('drillLibrary.addDrillButton')}
            onPress={() => navigation.navigate('DrillEditor')}
          />
        )
      }
      description={t('drillLibrary.description', { teamName: activeTeam.name })}
      title={t('drillLibrary.title')}
    >
      {drillsQuery.isLoading ? (
        <LoadingState />
      ) : null}
      {drillsQuery.error ? (
        <Text style={appScreenStyles.error}>{t('drillLibrary.loadError')}</Text>
      ) : null}
      <OfflineNotice cachedAt={cachedAt} />
      {!drillsQuery.isLoading && !drillsQuery.error && drills.length === 0 ? (
        <EmptyState
          description={t('drillLibrary.emptyDescription')}
          icon="library-outline"
          title={t('drillLibrary.emptyTitle')}
        />
      ) : null}
      <View style={appScreenStyles.list}>
        {drills.map((drill) => (
          <AnimatedPressable
            accessibilityRole="button"
            key={drill.id}
            onPress={() =>
              navigation.navigate('DrillEditor', {
                drillId: drill.id,
                readOnly: isReadOnlyTeam,
              })
            }
            style={appScreenStyles.card}
          >
            <Text style={appScreenStyles.cardTitle}>{drill.name}</Text>
            <Text style={appScreenStyles.cardDescription}>
              {t('drillLibrary.objectCount', {
                count: countCanvasObjects(drill.canvas_data),
              })}
            </Text>
            {drill.description ? (
              <Text style={appScreenStyles.meta}>{drill.description}</Text>
            ) : null}
          </AnimatedPressable>
        ))}
      </View>
    </AppScreen>
  );
}

function countCanvasObjects(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}
