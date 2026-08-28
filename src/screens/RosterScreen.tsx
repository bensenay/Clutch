import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
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
import { colors, fonts, goalRed, spacing } from '../theme/theme';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AuthenticatedTabParamList, 'RosterTab'>,
  NativeStackScreenProps<AuthenticatedStackParamList>
>;

export type PlayerStatus = 'active' | 'injured' | 'suspended';
export type NaturalPosition = 'F' | 'D' | 'G';

export type Player = {
  id: string;
  team_id: string;
  first_name: string;
  last_name: string;
  jersey_number: number | null;
  natural_position: NaturalPosition;
  height: string | null;
  weight: string | null;
  status: PlayerStatus;
  status_note: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  medical_notes: string | null;
  created_at: string;
};

export function RosterScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { activeTeam, isReadOnlyTeam } = useActiveTeam();
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const isAssistantCoachRoster =
    activeTeam?.membership_role === 'assistant_coach';
  const isReadOnlyRoster = isReadOnlyTeam || isAssistantCoachRoster;

  const playersQuery = useQuery({
    queryKey: ['players', activeTeam?.id],
    queryFn: async () => {
      if (!activeTeam) {
        throw new Error(t('roster.noActiveTeamTitle'));
      }

      return fetchWithCache<Player[]>({
        cacheKey: makeTeamCacheKey('players', activeTeam.id),
        fetcher: async () => {
          const { data, error } = await supabase
            .from('players')
            .select(
              'id, team_id, first_name, last_name, jersey_number, natural_position, height, weight, status, status_note, parent_name, parent_phone, emergency_contact_name, emergency_contact_phone, medical_notes, created_at',
            )
            .eq('team_id', activeTeam.id)
            .order('jersey_number', { ascending: true, nullsFirst: false })
            .order('last_name', { ascending: true })
            .order('first_name', { ascending: true });

          if (error) {
            throw error;
          }

          return (data ?? []) as Player[];
        },
        onCacheFallback: setCachedAt,
        onNetworkSuccess: () => setCachedAt(null),
      });
    },
    enabled: Boolean(activeTeam),
  });
  const refetchPlayers = playersQuery.refetch;

  useFocusEffect(
    useCallback(() => {
      if (activeTeam) {
        void refetchPlayers();
      }
    }, [activeTeam?.id, refetchPlayers]),
  );

  if (!activeTeam) {
    return (
      <AppScreen
        description={t('roster.noActiveTeamDescription')}
        title={t('roster.noActiveTeamTitle')}
      />
    );
  }

  const players = playersQuery.data ?? [];

  return (
    <AppScreen
      action={
        isReadOnlyRoster ? undefined : (
          <AppButton
            icon="person-add-outline"
            title={t('roster.addPlayerButton')}
            onPress={() => navigation.navigate('PlayerForm')}
          />
        )
      }
      description={t('roster.description', { teamName: activeTeam.name })}
      title={t('roster.title')}
    >
      {playersQuery.isLoading ? (
        <LoadingState />
      ) : null}
      {playersQuery.error ? (
        <Text style={appScreenStyles.error}>{t('roster.loadError')}</Text>
      ) : null}
      <OfflineNotice cachedAt={cachedAt} />
      {!playersQuery.isLoading && !playersQuery.error && players.length === 0 ? (
        <EmptyState
          description={t('roster.emptyDescription')}
          icon="people-outline"
          title={t('roster.emptyTitle')}
          action={
            isReadOnlyRoster ? undefined : (
              <AppButton
                icon="person-add-outline"
                title={t('roster.addFirstPlayerButton')}
                onPress={() => navigation.navigate('PlayerForm')}
              />
            )
          }
        />
      ) : null}
      <View style={appScreenStyles.list}>
        {players.map((player) => (
          <AnimatedPressable
            accessibilityRole="button"
            key={player.id}
            onPress={() =>
              navigation.navigate('PlayerForm', {
                playerId: player.id,
                readOnly: isReadOnlyRoster,
              })
            }
            style={appScreenStyles.card}
          >
            <View style={appScreenStyles.row}>
              <View style={styles.identity}>
                <Text style={styles.jersey}>
                  {player.jersey_number
                    ? t('roster.jerseyNumber', {
                        number: player.jersey_number,
                      })
                    : t('roster.noJerseyNumber')}
                </Text>
                <View style={styles.nameBlock}>
                  <Text style={appScreenStyles.cardTitle}>
                    {player.first_name} {player.last_name}
                  </Text>
                  <Text style={appScreenStyles.meta}>
                    {t(`playerForm.positions.${player.natural_position}`)}
                  </Text>
                </View>
              </View>
              <StatusBadge status={player.status} />
            </View>
          </AnimatedPressable>
        ))}
      </View>
    </AppScreen>
  );
}

function StatusBadge({ status }: { status: PlayerStatus }) {
  const { t } = useTranslation();

  return (
    <View style={[styles.badge, styles[`${status}Badge`]]}>
      <Text style={[styles.badgeText, styles[`${status}BadgeText`]]}>
        {t(`playerForm.statuses.${status}`)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  activeBadge: {
    backgroundColor: colors.successSoft,
  },
  activeBadgeText: {
    color: colors.success,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  identity: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
  },
  injuredBadge: {
    backgroundColor: colors.dangerSoft,
  },
  injuredBadgeText: {
    color: goalRed,
  },
  jersey: {
    color: colors.textPrimary,
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '800',
    minWidth: 44,
  },
  nameBlock: {
    flex: 1,
    gap: 2,
  },
  suspendedBadge: {
    backgroundColor: colors.dangerSoft,
  },
  suspendedBadgeText: {
    color: goalRed,
  },
});
