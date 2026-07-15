import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { AppScreen, appScreenStyles } from '../components/AppScreen';
import type { AuthenticatedStackParamList } from '../navigation/types';
import { formatGameDate } from './GameListScreen';

type Props = NativeStackScreenProps<
  AuthenticatedStackParamList,
  'PracticePlanDetail'
>;

type PracticePlan = {
  id: string;
  team_id: string;
  practice_date: string;
  segments: unknown;
  created_at: string;
  updated_at: string | null;
};

export function PracticePlanDetailScreen({ route }: Props) {
  const { t } = useTranslation();
  const { practicePlanId } = route.params;
  const practiceQuery = useQuery({
    queryKey: ['practice-plan', practicePlanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('practice_plans')
        .select('id, team_id, practice_date, segments, created_at, updated_at')
        .eq('id', practicePlanId)
        .single();

      if (error) {
        throw error;
      }

      return data as PracticePlan;
    },
  });
  const practice = practiceQuery.data;
  const segments = Array.isArray(practice?.segments)
    ? practice.segments
    : [];

  return (
    <AppScreen
      description={
        practice
          ? formatGameDate(practice.practice_date)
          : t('practiceDetail.description')
      }
      title={t('practiceDetail.title')}
    >
      {practiceQuery.isLoading ? (
        <Text style={appScreenStyles.note}>{t('common.loading')}</Text>
      ) : null}
      {practiceQuery.error ? (
        <Text style={appScreenStyles.error}>
          {t('practiceDetail.loadError')}
        </Text>
      ) : null}
      <View style={appScreenStyles.card}>
        <Text style={appScreenStyles.cardTitle}>
          {t('practiceDetail.segmentsTitle')}
        </Text>
        {segments.length === 0 ? (
          <Text style={appScreenStyles.note}>
            {t('practiceDetail.noSegments')}
          </Text>
        ) : (
          segments.map((segment, index) => (
            <Text key={index} style={appScreenStyles.cardDescription}>
              {formatSegment(segment, index, t)}
            </Text>
          ))
        )}
      </View>
    </AppScreen>
  );
}

function formatSegment(
  segment: unknown,
  index: number,
  t: (key: string, values?: Record<string, unknown>) => string,
) {
  if (!isRecord(segment)) {
    return t('practiceDetail.segmentFallback', { number: index + 1 });
  }

  const title =
    stringValue(segment.custom_title) ||
    stringValue(segment.title) ||
    t('practiceDetail.segmentFallback', { number: index + 1 });
  const duration = numberValue(segment.duration_minutes);

  return duration
    ? t('practiceDetail.segmentWithDuration', { title, duration })
    : title;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function numberValue(value: unknown) {
  return typeof value === 'number' ? value : null;
}
