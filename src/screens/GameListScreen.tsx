import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Button, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { AppScreen, appScreenStyles } from '../components/AppScreen';
import type { AuthenticatedStackParamList } from '../navigation/types';
import { useActiveTeam } from '../teams/ActiveTeamContext';

type Props = NativeStackScreenProps<AuthenticatedStackParamList, 'Games'>;

export type Game = {
  id: string;
  team_id: string;
  opponent_name: string;
  game_date: string;
  location: string | null;
  is_home: boolean;
  opponent_scouting_notes: string | null;
  pre_game_plan: string | null;
  post_game_notes: string | null;
  created_at: string;
};

function sortGames(games: Game[]) {
  const now = Date.now();

  return [...games].sort((left, right) => {
    const leftTime = new Date(left.game_date).getTime();
    const rightTime = new Date(right.game_date).getTime();
    const leftIsUpcoming = leftTime >= now;
    const rightIsUpcoming = rightTime >= now;

    if (leftIsUpcoming && !rightIsUpcoming) {
      return -1;
    }

    if (!leftIsUpcoming && rightIsUpcoming) {
      return 1;
    }

    return leftIsUpcoming ? leftTime - rightTime : rightTime - leftTime;
  });
}

export function GameListScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { activeTeam } = useActiveTeam();

  const gamesQuery = useQuery({
    queryKey: ['games', activeTeam?.id],
    queryFn: async () => {
      if (!activeTeam) {
        throw new Error(t('games.noActiveTeamTitle'));
      }

      const { data, error } = await supabase
        .from('games')
        .select(
          'id, team_id, opponent_name, game_date, location, is_home, opponent_scouting_notes, pre_game_plan, post_game_notes, created_at',
        )
        .eq('team_id', activeTeam.id)
        .order('game_date', { ascending: true });

      if (error) {
        throw error;
      }

      return sortGames((data ?? []) as Game[]);
    },
    enabled: Boolean(activeTeam),
  });

  if (!activeTeam) {
    return (
      <AppScreen
        description={t('games.noActiveTeamDescription')}
        title={t('games.noActiveTeamTitle')}
      />
    );
  }

  const games = gamesQuery.data ?? [];

  return (
    <AppScreen
      action={
        <Button
          title={t('games.addGameButton')}
          onPress={() => navigation.navigate('GameForm')}
        />
      }
      description={t('games.description', { teamName: activeTeam.name })}
      title={t('games.title')}
    >
      {gamesQuery.isLoading ? (
        <Text style={appScreenStyles.note}>{t('common.loading')}</Text>
      ) : null}
      {gamesQuery.error ? (
        <Text style={appScreenStyles.error}>{t('games.loadError')}</Text>
      ) : null}
      {!gamesQuery.isLoading && games.length === 0 ? (
        <View style={appScreenStyles.card}>
          <Text style={appScreenStyles.cardTitle}>
            {t('games.emptyTitle')}
          </Text>
          <Text style={appScreenStyles.cardDescription}>
            {t('games.emptyDescription')}
          </Text>
          <Button
            title={t('games.addFirstGameButton')}
            onPress={() => navigation.navigate('GameForm')}
          />
        </View>
      ) : null}
      <View style={appScreenStyles.list}>
        {games.map((game) => (
          <View key={game.id} style={appScreenStyles.card}>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                navigation.navigate('GameForm', { gameId: game.id })
              }
              style={({ pressed }) => pressed && styles.pressed}
            >
              <View style={appScreenStyles.row}>
                <View style={styles.details}>
                  <Text style={appScreenStyles.cardTitle}>
                    {t('games.opponentTitle', {
                      opponentName: game.opponent_name,
                    })}
                  </Text>
                  <Text style={appScreenStyles.meta}>
                    {formatGameDate(game.game_date)}
                  </Text>
                  {game.location ? (
                    <Text style={appScreenStyles.meta}>{game.location}</Text>
                  ) : null}
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {game.is_home
                      ? t('games.homeBadge')
                      : t('games.awayBadge')}
                  </Text>
                </View>
              </View>
            </Pressable>
            <Button
              title={t('gameForm.lineupButton')}
              onPress={() =>
                navigation.navigate('LineupBuilder', { gameId: game.id })
              }
            />
          </View>
        ))}
      </View>
    </AppScreen>
  );
}

export function formatGameDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: '#e7ede8',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    color: '#276749',
    fontSize: 12,
    fontWeight: '700',
  },
  details: {
    flex: 1,
    gap: 4,
  },
  pressed: {
    backgroundColor: '#e7ede8',
  },
});
