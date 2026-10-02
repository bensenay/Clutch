import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { AppButton } from '../components/AppButton';
import { AppScreen, appScreenStyles } from '../components/AppScreen';
import { EmptyState } from '../components/EmptyState';
import { LockerStall } from '../components/LockerStall';
import { LoadingState } from '../components/LoadingState';
import type {
  AuthenticatedStackParamList,
  AuthenticatedTabParamList,
} from '../navigation/types';
import { fetchWithCache, makeTeamCacheKey } from '../offline/cache';
import { OfflineNotice } from '../offline/OfflineNotice';
import { useActiveTeam } from '../teams/ActiveTeamContext';
import { spacing } from '../theme/theme';

const ROSTER_MAX_WIDTH = 900;
const ROSTER_SCREEN_PADDING = spacing.xl * 2;
const MAX_STALL_WIDTH = 220;

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
  const { width: screenWidth } = useWindowDimensions();
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
  const availableWidth = Math.min(
    Math.max(screenWidth - ROSTER_SCREEN_PADDING, 0),
    ROSTER_MAX_WIDTH,
  );
  const stallGap = screenWidth < 400 ? spacing.xs : spacing.md;
  const stallWidth = Math.min(
    (availableWidth - stallGap * 2) / 3,
    MAX_STALL_WIDTH,
  );
  const formationWidth = stallWidth * 3 + stallGap * 2;
  const playersByPosition: Array<{
    columns: number;
    players: Player[];
    position: NaturalPosition;
  }> = [
    {
      columns: 3,
      players: players.filter((player) => player.natural_position === 'F'),
      position: 'F',
    },
    {
      columns: 2,
      players: players.filter((player) => player.natural_position === 'D'),
      position: 'D',
    },
    {
      columns: 1,
      players: players.filter((player) => player.natural_position === 'G'),
      position: 'G',
    },
  ];

  const renderStall = (player: Player) => {
    const playerName = `${player.first_name} ${player.last_name}`;
    const statusLabel = t(`playerForm.statuses.${player.status}`);

    return (
      <LockerStall
        accessibilityLabel={t('roster.openPlayerDetailsAccessibility', {
          name: playerName,
          number: player.jersey_number ?? '--',
          status: statusLabel,
        })}
        detailsLabel={t('roster.viewDetails')}
        firstName={player.first_name}
        jerseyNumber={player.jersey_number}
        key={player.id}
        lastName={player.last_name}
        positionLabel={t(`playerForm.positions.${player.natural_position}`)}
        primaryColor={activeTeam.primary_color}
        secondaryColor={activeTeam.secondary_color}
        status={player.status}
        statusLabel={statusLabel}
        tertiaryColor={activeTeam.tertiary_color}
        width={stallWidth}
        onPress={() =>
          navigation.navigate('PlayerForm', {
            playerId: player.id,
            readOnly: isReadOnlyRoster,
          })
        }
      />
    );
  };

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
      contentMaxWidth={ROSTER_MAX_WIDTH}
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
                variant="secondary"
              />
            )
          }
        />
      ) : null}
      {players.length > 0 ? (
        <View style={[styles.formation, { width: formationWidth }]}>
          {playersByPosition.map((group) =>
            group.players.length > 0 ? (
              <View key={group.position} style={styles.positionSection}>
                <Text style={styles.positionHeading}>
                  {t(`roster.positionGroups.${group.position}`)}
                </Text>
                <View
                  style={[
                    styles.positionGrid,
                    {
                      gap: stallGap,
                      width:
                        stallWidth * group.columns +
                        stallGap * (group.columns - 1),
                    },
                  ]}
                >
                  {group.players.map(renderStall)}
                </View>
              </View>
            ) : null,
          )}
        </View>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  formation: {
    alignSelf: 'center',
    gap: spacing.xl,
    paddingBottom: spacing.sm,
    paddingTop: spacing.xs,
  },
  positionGrid: {
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  positionHeading: {
    color: '#E4E8EB',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  positionSection: {
    gap: spacing.md,
  },
});
