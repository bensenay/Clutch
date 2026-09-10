import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
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
import { colors, radii, sizes } from '../theme/theme';

type Props = NativeStackScreenProps<
  AuthenticatedStackParamList,
  'SchoolDrillLibrary'
>;

type SchoolDrillRow = {
  id: string;
  team_id: string;
  name: string;
  description: string | null;
  canvas_data: unknown;
  updated_at: string | null;
  created_at: string;
  team_name: string;
  creator_name: string;
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
  const [search, setSearch] = useState('');

  const drillsQuery = useQuery({
    queryKey: ['school-drills', activeTeam?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_school_drill_library');

      if (error) {
        throw error;
      }

      return (data ?? []) as SchoolDrillRow[];
    },
    enabled: Boolean(activeTeam),
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
          description: drill.description,
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
  const filteredDrills = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();

    if (!needle) {
      return drills;
    }

    return drills.filter((drill) =>
      [drill.name, drill.team_name, drill.creator_name]
        .join(' ')
        .toLocaleLowerCase()
        .includes(needle),
    );
  }, [drills, search]);

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
      <View style={styles.searchCard}>
        <Text style={styles.searchLabel}>
          {t('schoolDrillLibrary.searchLabel')}
        </Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setSearch}
          placeholder={t('schoolDrillLibrary.searchPlaceholder')}
          placeholderTextColor={slateGrey}
          style={styles.searchInput}
          value={search}
        />
      </View>
      {!drillsQuery.isLoading && drills.length === 0 ? (
        <EmptyState
          description={t('schoolDrillLibrary.emptyDescription')}
          icon="school-outline"
          title={t('schoolDrillLibrary.emptyTitle')}
        />
      ) : null}
      {!drillsQuery.isLoading && drills.length > 0 && filteredDrills.length === 0 ? (
        <EmptyState
          description={t('schoolDrillLibrary.noResultsDescription')}
          icon="search-outline"
          title={t('schoolDrillLibrary.noResultsTitle')}
        />
      ) : null}
      <View style={appScreenStyles.list}>
        {filteredDrills.map((drill) => {
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
                    teamName: drill.team_name,
                  })}
                </Text>
                <Text style={appScreenStyles.meta}>
                  {t('schoolDrillLibrary.creatorMeta', {
                    creatorName: drill.creator_name,
                  })}
                </Text>
                {drill.description ? (
                  <Text style={appScreenStyles.cardDescription}>
                    {drill.description}
                  </Text>
                ) : null}
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
  searchCard: {
    gap: spacing.sm,
  },
  searchInput: {
    backgroundColor: colors.fieldBackground,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.textPrimary,
    minHeight: sizes.input,
    paddingHorizontal: spacing.gutter,
  },
  searchLabel: {
    color: colors.textOnDark,
    fontSize: 13,
    fontWeight: '700',
  },
});
