import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Button, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { AppScreen, appScreenStyles } from '../components/AppScreen';
import {
  FormField,
  authStyles,
} from '../components/AuthScreen';
import type { AuthenticatedStackParamList } from '../navigation/types';
import { useActiveTeam } from '../teams/ActiveTeamContext';
import type { Game } from './GameListScreen';

type Props = NativeStackScreenProps<AuthenticatedStackParamList, 'GameForm'>;

type GamePayload = {
  team_id: string;
  opponent_name: string;
  game_date: string;
  location: string | null;
  is_home: boolean;
};

export function GameFormScreen({ navigation, route }: Props) {
  const { i18n, t } = useTranslation();
  const queryClient = useQueryClient();
  const { activeTeam } = useActiveTeam();
  const gameId = route.params?.gameId;
  const isEditing = Boolean(gameId);
  const [opponentName, setOpponentName] = useState('');
  const [gameDate, setGameDate] = useState<Date | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() =>
    startOfMonth(new Date()),
  );
  const [location, setLocation] = useState('');
  const [isHome, setIsHome] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const gameQuery = useQuery({
    queryKey: ['game', gameId],
    queryFn: async () => {
      if (!gameId) {
        throw new Error(t('gameForm.missingGameError'));
      }

      const { data, error: loadError } = await supabase
        .from('games')
        .select(
          'id, team_id, opponent_name, game_date, location, is_home, opponent_scouting_notes, pre_game_plan, post_game_notes, created_at',
        )
        .eq('id', gameId)
        .single();

      if (loadError) {
        throw loadError;
      }

      return data as Game;
    },
    enabled: isEditing,
  });

  useEffect(() => {
    const game = gameQuery.data;

    if (!game) {
      return;
    }

    setOpponentName(game.opponent_name);
    const parsedGameDate = parseStoredDate(game.game_date);
    setGameDate(parsedGameDate);
    setCalendarMonth(startOfMonth(parsedGameDate));
    setLocation(game.location ?? '');
    setIsHome(game.is_home);
  }, [gameQuery.data]);

  function nullableText(value: string) {
    const trimmedValue = value.trim();
    return trimmedValue ? trimmedValue : null;
  }

  function buildPayload() {
    if (!activeTeam) {
      setError(t('games.noActiveTeamTitle'));
      return null;
    }

    if (!opponentName.trim() || !gameDate) {
      setError(t('gameForm.requiredError'));
      return null;
    }

    const payload: GamePayload = {
      team_id: activeTeam.id,
      opponent_name: opponentName.trim(),
      game_date: gameDate.toISOString(),
      location: nullableText(location),
      is_home: isHome,
    };

    return payload;
  }

  async function handleSave() {
    const payload = buildPayload();

    if (!payload) {
      return;
    }

    setError('');
    setIsSubmitting(true);

    const saveResult = isEditing && gameId
      ? await supabase.from('games').update(payload).eq('id', gameId)
      : await supabase.from('games').insert(payload).select('id').single();

    if (saveResult.error) {
      setError(t('gameForm.saveError'));
      setIsSubmitting(false);
      return;
    }

    await queryClient.invalidateQueries({
      queryKey: ['games', activeTeam?.id],
    });
    await queryClient.invalidateQueries({
      queryKey: ['game', gameId],
    });
    setIsSubmitting(false);

    if (!isEditing && saveResult.data?.id) {
      navigation.replace('LineupBuilder', { gameId: saveResult.data.id });
      return;
    }

    navigation.replace('Games');
  }

  if (!activeTeam) {
    return (
      <AppScreen
        description={t('games.noActiveTeamDescription')}
        title={t('games.noActiveTeamTitle')}
      />
    );
  }

  return (
    <AppScreen
      description={t('gameForm.description', { teamName: activeTeam.name })}
      title={isEditing ? t('gameForm.editTitle') : t('gameForm.addTitle')}
    >
      {gameQuery.isLoading ? (
        <Text style={appScreenStyles.note}>{t('common.loading')}</Text>
      ) : null}
      {gameQuery.error ? (
        <Text style={appScreenStyles.error}>{t('gameForm.loadError')}</Text>
      ) : null}
      <View style={appScreenStyles.card}>
        <FormField
          autoCapitalize="words"
          label={t('gameForm.opponentNameLabel')}
          onChangeText={setOpponentName}
          placeholder={t('gameForm.opponentNamePlaceholder')}
          value={opponentName}
        />
        <GameDateTimePicker
          calendarMonth={calendarMonth}
          gameDate={gameDate}
          locale={i18n.language}
          setCalendarMonth={setCalendarMonth}
          setGameDate={setGameDate}
        />
        <FormField
          autoCapitalize="words"
          label={t('gameForm.locationLabel')}
          onChangeText={setLocation}
          placeholder={t('gameForm.locationPlaceholder')}
          value={location}
        />
        <View style={styles.selectorGroup}>
          <Text style={styles.selectorLabel}>
            {t('gameForm.homeAwayLabel')}
          </Text>
          <View style={styles.selectorOptions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setIsHome(true)}
              style={[styles.selectorOption, isHome && styles.selected]}
            >
              <Text
                style={[
                  styles.selectorOptionText,
                  isHome && styles.selectedText,
                ]}
              >
                {t('gameForm.homeOption')}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setIsHome(false)}
              style={[styles.selectorOption, !isHome && styles.selected]}
            >
              <Text
                style={[
                  styles.selectorOptionText,
                  !isHome && styles.selectedText,
                ]}
              >
                {t('gameForm.awayOption')}
              </Text>
            </Pressable>
          </View>
        </View>
        {error ? <Text style={authStyles.error}>{error}</Text> : null}
        <Button
          disabled={isSubmitting || gameQuery.isLoading}
          title={
            isSubmitting ? t('gameForm.saving') : t('gameForm.saveButton')
          }
          onPress={() => void handleSave()}
        />
        {gameId ? (
          <Button
            disabled={isSubmitting || gameQuery.isLoading}
            title={t('gameForm.lineupButton')}
            onPress={() => navigation.navigate('LineupBuilder', { gameId })}
          />
        ) : null}
      </View>
    </AppScreen>
  );
}

function GameDateTimePicker({
  calendarMonth,
  gameDate,
  locale,
  setCalendarMonth,
  setGameDate,
}: {
  calendarMonth: Date;
  gameDate: Date | null;
  locale: string;
  setCalendarMonth: (date: Date) => void;
  setGameDate: (date: Date) => void;
}) {
  const { t } = useTranslation();
  const days = getCalendarDays(calendarMonth);
  const displayDate = gameDate ?? makeDefaultGameDate(new Date());
  const selectedDayKey = gameDate ? toDateKey(gameDate) : '';
  const selectedHour = displayDate.getHours();
  const selectedMinute = displayDate.getMinutes();

  function selectDay(day: Date) {
    const nextDate = new Date(day);
    nextDate.setHours(selectedHour, selectedMinute, 0, 0);
    setGameDate(nextDate);
  }

  function selectHour(hour: number) {
    const nextDate = new Date(displayDate);
    nextDate.setHours(hour, selectedMinute, 0, 0);
    setGameDate(nextDate);
    setCalendarMonth(startOfMonth(nextDate));
  }

  function selectMinute(minute: number) {
    const nextDate = new Date(displayDate);
    nextDate.setHours(selectedHour, minute, 0, 0);
    setGameDate(nextDate);
    setCalendarMonth(startOfMonth(nextDate));
  }

  return (
    <View style={styles.datePicker}>
      <Text style={styles.selectorLabel}>{t('gameForm.dateLabel')}</Text>
      <Text style={styles.dateSummary}>
        {gameDate
          ? formatSelectedDateTime(gameDate, locale)
          : t('gameForm.dateEmpty')}
      </Text>
      <View style={styles.monthHeader}>
        <Button
          title={t('gameForm.previousMonthButton')}
          onPress={() =>
            setCalendarMonth(addMonths(calendarMonth, -1))
          }
        />
        <Text style={styles.monthTitle}>
          {formatMonth(calendarMonth, locale)}
        </Text>
        <Button
          title={t('gameForm.nextMonthButton')}
          onPress={() => setCalendarMonth(addMonths(calendarMonth, 1))}
        />
      </View>
      <View style={styles.weekdayGrid}>
        {getWeekdayLabels(locale).map((label) => (
          <Text key={label} style={styles.weekdayLabel}>
            {label}
          </Text>
        ))}
      </View>
      <View style={styles.dayGrid}>
        {days.map((day, index) =>
          day ? (
            <Pressable
              accessibilityRole="button"
              key={toDateKey(day)}
              onPress={() => selectDay(day)}
              style={[
                styles.dayButton,
                selectedDayKey === toDateKey(day) && styles.selected,
              ]}
            >
              <Text
                style={[
                  styles.dayButtonText,
                  selectedDayKey === toDateKey(day) && styles.selectedText,
                ]}
              >
                {day.getDate()}
              </Text>
            </Pressable>
          ) : (
            <View key={`empty-${index}`} style={styles.dayButton} />
          ),
        )}
      </View>
      <View style={styles.timePicker}>
        <Text style={styles.selectorLabel}>{t('gameForm.timeLabel')}</Text>
        <View style={styles.timeSummaryRow}>
          <Button
            title={t('gameForm.hourDownButton')}
            onPress={() => selectHour((selectedHour + 23) % 24)}
          />
          <Text style={styles.timeSummary}>
            {formatTime(displayDate, locale)}
          </Text>
          <Button
            title={t('gameForm.hourUpButton')}
            onPress={() => selectHour((selectedHour + 1) % 24)}
          />
        </View>
        <View style={styles.selectorOptions}>
          {[0, 15, 30, 45].map((minute) => (
            <Pressable
              accessibilityRole="button"
              key={minute}
              onPress={() => selectMinute(minute)}
              style={[
                styles.selectorOption,
                selectedMinute === minute && styles.selected,
              ]}
            >
              <Text
                style={[
                  styles.selectorOptionText,
                  selectedMinute === minute && styles.selectedText,
                ]}
              >
                {t('gameForm.minuteOption', {
                  minute: String(minute).padStart(2, '0'),
                })}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

function parseStoredDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? makeDefaultGameDate(new Date()) : date;
}

function makeDefaultGameDate(baseDate: Date) {
  const date = new Date(baseDate);
  date.setHours(19, 0, 0, 0);
  return date;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function getCalendarDays(month: Date) {
  const firstDay = startOfMonth(month);
  const daysInMonth = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const blanks = firstDay.getDay();
  const days: Array<Date | null> = Array.from({ length: blanks }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push(new Date(month.getFullYear(), month.getMonth(), day));
  }

  return days;
}

function getWeekdayLabels(locale: string) {
  const sunday = new Date(2026, 0, 4);

  return Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(
      new Date(2026, 0, sunday.getDate() + index),
    ),
  );
}

function formatMonth(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatSelectedDateTime(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(date);
}

function formatTime(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const styles = StyleSheet.create({
  datePicker: {
    gap: 10,
  },
  dateSummary: {
    color: '#15251f',
    fontSize: 15,
    fontWeight: '700',
  },
  dayButton: {
    alignItems: 'center',
    borderColor: '#ccd3ce',
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 42,
    width: '13%',
  },
  dayButtonText: {
    color: '#25332e',
    fontSize: 14,
    fontWeight: '700',
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  monthHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  monthTitle: {
    color: '#15251f',
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  selected: {
    backgroundColor: '#e7ede8',
    borderColor: '#b8442f',
  },
  selectedText: {
    color: '#b8442f',
  },
  selectorGroup: {
    gap: 7,
  },
  selectorLabel: {
    color: '#25332e',
    fontSize: 14,
    fontWeight: '600',
  },
  selectorOption: {
    backgroundColor: '#ffffff',
    borderColor: '#ccd3ce',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  selectorOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectorOptionText: {
    color: '#25332e',
    fontSize: 14,
    fontWeight: '700',
  },
  timePicker: {
    gap: 8,
    marginTop: 4,
  },
  timeSummary: {
    color: '#15251f',
    fontSize: 20,
    fontWeight: '800',
  },
  timeSummaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  weekdayGrid: {
    flexDirection: 'row',
    gap: 5,
  },
  weekdayLabel: {
    color: '#59636e',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase',
    width: '13%',
  },
});
