import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { AppButton } from '../components/AppButton';
import { AppScreen, appScreenStyles } from '../components/AppScreen';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import type { AuthenticatedStackParamList } from '../navigation/types';
import { isLikelyNetworkError } from '../offline/cache';
import { useActiveTeam } from '../teams/ActiveTeamContext';
import { slateGrey, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<
  AuthenticatedStackParamList,
  'SchoolDrillLibrary'
>;

type SchoolDrillRow = {
  id: string;
  team_id: string;
  name: string;
  canvas_data: unknown;
  updated_at: string | null;
  created_at: string;
  teams: { name: string | null } | Array<{ name: string | null }> | null;
};

export function SchoolDrillLibraryScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const { activeTeam, isReadOnlyTeam } = useActiveTeam();
  const [duplicatingDrillId, setDuplicatingDrillId] = useState<string | null>(
    null,
  );
  const [duplicateError, setDuplicateError] = useState('');

  const drillsQuery = useQuery({
    queryKey: ['school-drills'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drills')
        .select(
          'id, team_id, name, canvas_data, updated_at, created_at, teams ( name )',
        )
        .eq('is_published', true)
        .order('updated_at', { ascending: false });

      if (error) {
        throw error;
      }

      return (data ?? []) as SchoolDrillRow[];
    },
  });

  async function duplicateDrill(drill: SchoolDrillRow) {
    if (!activeTeam || !session || isReadOnlyTeam || duplicatingDrillId) {
      return;
    }

    setDuplicateError('');
    setDuplicatingDrillId(drill.id);

    try {
      const { data, error } = await supabase
        .from('drills')
        .insert({
          canvas_data: drill.canvas_data,
          created_by_user_id: session.user.id,
          description: null,
          is_published: false,
          name: t('schoolDrillLibrary.duplicatedName', {
            name: drill.name,
          }),
          team_id: activeTeam.id,
        })
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      await queryClient.invalidateQueries({ queryKey: ['drills', activeTeam.id] });
      navigation.navigate('DrillEditor', { drillId: data.id });
    } catch (error) {
      console.error('Unable to duplicate drill:', error);
      setDuplicateError(
        isLikelyNetworkError(error)
          ? t('offline.writeBlocked')
          : t('schoolDrillLibrary.duplicateError'),
      );
    } finally {
      setDuplicatingDrillId(null);
    }
  }

  const drills = drillsQuery.data ?? [];

  return (
    <AppScreen
      description={t('schoolDrillLibrary.description')}
      title={t('schoolDrillLibrary.title')}
    >
      {drillsQuery.isLoading ? (
        <LoadingState />
      ) : null}
      {drillsQuery.error ? (
        <Text style={appScreenStyles.error}>
          {t('schoolDrillLibrary.loadError')}
        </Text>
      ) : null}
      {duplicateError ? (
        <Text style={appScreenStyles.error}>{duplicateError}</Text>
      ) : null}
      {!drillsQuery.isLoading && drills.length === 0 ? (
        <EmptyState
          description={t('schoolDrillLibrary.emptyDescription')}
          icon="school-outline"
          title={t('schoolDrillLibrary.emptyTitle')}
        />
      ) : null}
      <View style={appScreenStyles.list}>
        {drills.map((drill) => {
          const isOwnActiveTeamDrill = activeTeam?.id === drill.team_id;
          const canDuplicate = Boolean(activeTeam && session && !isReadOnlyTeam);

          return (
            <View key={drill.id} style={appScreenStyles.card}>
              <AnimatedPressable
                accessibilityRole="button"
                onPress={() =>
                  navigation.navigate('DrillEditor', {
                    drillId: drill.id,
                    readOnly: !isOwnActiveTeamDrill || isReadOnlyTeam,
                  })
                }
              >
                <Text style={appScreenStyles.cardTitle}>{drill.name}</Text>
                <Text style={appScreenStyles.cardDescription}>
                  {t('schoolDrillLibrary.drillMeta', {
                    count: countCanvasObjects(drill.canvas_data),
                    teamName: getDrillTeamName(drill),
                  })}
                </Text>
              </AnimatedPressable>
              <View style={styles.rowActions}>
                <AppButton
                  disabled={!canDuplicate || duplicatingDrillId === drill.id}
                  icon="copy-outline"
                  title={
                    duplicatingDrillId === drill.id
                      ? t('schoolDrillLibrary.duplicatingButton')
                      : t('schoolDrillLibrary.duplicateButton')
                  }
                  onPress={() => void duplicateDrill(drill)}
                />
                {isOwnActiveTeamDrill ? (
                  <Text style={styles.ownTeamLabel}>
                    {t('schoolDrillLibrary.ownTeamLabel')}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </AppScreen>
  );
}

function countCanvasObjects(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

function getDrillTeamName(drill: SchoolDrillRow) {
  const team = Array.isArray(drill.teams)
    ? drill.teams[0] ?? null
    : drill.teams;

  return team?.name ?? '';
}

const styles = StyleSheet.create({
  ownTeamLabel: {
    color: slateGrey,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  rowActions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
