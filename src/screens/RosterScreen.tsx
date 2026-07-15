import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Button, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { AppScreen, appScreenStyles } from '../components/AppScreen';
import type { AuthenticatedStackParamList } from '../navigation/types';
import { useActiveTeam } from '../teams/ActiveTeamContext';

type Props = NativeStackScreenProps<AuthenticatedStackParamList, 'Roster'>;

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
  const { activeTeam } = useActiveTeam();

  const playersQuery = useQuery({
    queryKey: ['players', activeTeam?.id],
    queryFn: async () => {
      if (!activeTeam) {
        throw new Error(t('roster.noActiveTeamTitle'));
      }

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
    enabled: Boolean(activeTeam),
  });

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
        <Button
          title={t('roster.addPlayerButton')}
          onPress={() => navigation.navigate('PlayerForm')}
        />
      }
      description={t('roster.description', { teamName: activeTeam.name })}
      title={t('roster.title')}
    >
      {playersQuery.isLoading ? (
        <Text style={appScreenStyles.note}>{t('common.loading')}</Text>
      ) : null}
      {playersQuery.error ? (
        <Text style={appScreenStyles.error}>{t('roster.loadError')}</Text>
      ) : null}
      {!playersQuery.isLoading && players.length === 0 ? (
        <View style={appScreenStyles.card}>
          <Text style={appScreenStyles.cardTitle}>
            {t('roster.emptyTitle')}
          </Text>
          <Text style={appScreenStyles.cardDescription}>
            {t('roster.emptyDescription')}
          </Text>
          <Button
            title={t('roster.addFirstPlayerButton')}
            onPress={() => navigation.navigate('PlayerForm')}
          />
        </View>
      ) : null}
      <View style={appScreenStyles.list}>
        {players.map((player) => (
          <Pressable
            accessibilityRole="button"
            key={player.id}
            onPress={() =>
              navigation.navigate('PlayerForm', { playerId: player.id })
            }
            style={({ pressed }) => [
              appScreenStyles.card,
              pressed && styles.pressed,
            ]}
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
          </Pressable>
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
    backgroundColor: '#e7ede8',
  },
  activeBadgeText: {
    color: '#276749',
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  identity: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  injuredBadge: {
    backgroundColor: '#fff3cd',
  },
  injuredBadgeText: {
    color: '#8a5a00',
  },
  jersey: {
    color: '#15251f',
    fontSize: 18,
    fontWeight: '800',
    minWidth: 44,
  },
  nameBlock: {
    flex: 1,
    gap: 2,
  },
  pressed: {
    backgroundColor: '#e7ede8',
  },
  suspendedBadge: {
    backgroundColor: '#fde2e1',
  },
  suspendedBadgeText: {
    color: '#b42318',
  },
});
