import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
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
import { colors, goalRed, slateGrey } from '../theme/theme';

type Props = NativeStackScreenProps<
  AuthenticatedStackParamList,
  'PracticePlanDetail'
>;

type SegmentForm = {
  order: number;
  drill_id: string | null;
  custom_title: string;
  duration_minutes: number;
  notes: string;
};

type PracticePlan = {
  id: string;
  team_id: string;
  practice_date: string;
  segments: unknown;
};

const DEFAULT_SEGMENT_DURATION = 10;

export function PracticePlanDetailScreen({ navigation, route }: Props) {
  const { i18n, t } = useTranslation();
  const queryClient = useQueryClient();
  const { activeTeam, isReadOnlyTeam } = useActiveTeam();
  const practicePlanId = route.params?.practicePlanId;
  const isEditing = Boolean(practicePlanId);
  const isReadOnly = isReadOnlyTeam || Boolean(route.params?.readOnly);
  const [practiceDate, setPracticeDate] = useState(() =>
    makeDefaultPracticeDate(new Date()),
  );
  const [calendarMonth, setCalendarMonth] = useState(() =>
    startOfMonth(new Date()),
  );
  const [segments, setSegments] = useState<SegmentForm[]>(() => [
    makeBlankSegment(1),
  ]);
  const [error, setError] = useState('');
  const [exportError, setExportError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const practiceQuery = useQuery({
    queryKey: ['practice-plan', practicePlanId],
    queryFn: async () => {
      if (!practicePlanId) {
        throw new Error(t('practiceDetail.missingPracticePlanError'));
      }

      const { data, error: loadError } = await supabase
        .from('practice_plans')
        .select('id, team_id, practice_date, segments')
        .eq('id', practicePlanId)
        .single();

      if (loadError) {
        throw loadError;
      }

      return data as PracticePlan;
    },
    enabled: isEditing,
  });

  useEffect(() => {
    const practice = practiceQuery.data;

    if (!practice) {
      return;
    }

    const parsedPracticeDate = parseStoredDate(practice.practice_date);
    setPracticeDate(parsedPracticeDate);
    setCalendarMonth(startOfMonth(parsedPracticeDate));
    setSegments(normalizeSegments(practice.segments));
  }, [practiceQuery.data]);

  const totalDuration = segments.reduce(
    (sum, segment) => sum + safeDuration(segment.duration_minutes),
    0,
  );

  function updateSegment(
    order: number,
    updates: Partial<Pick<SegmentForm, 'custom_title' | 'duration_minutes' | 'notes'>>,
  ) {
    setSegments((currentSegments) =>
      currentSegments.map((segment) =>
        segment.order === order ? { ...segment, ...updates } : segment,
      ),
    );
  }

  function addSegment() {
    setSegments((currentSegments) =>
      renumberSegments([
        ...currentSegments,
        makeBlankSegment(currentSegments.length + 1),
      ]),
    );
  }

  function removeSegment(order: number) {
    setSegments((currentSegments) => {
      const nextSegments = currentSegments.filter(
        (segment) => segment.order !== order,
      );

      return renumberSegments(
        nextSegments.length > 0 ? nextSegments : [makeBlankSegment(1)],
      );
    });
  }

  function moveSegment(order: number, direction: -1 | 1) {
    setSegments((currentSegments) => {
      const currentIndex = currentSegments.findIndex(
        (segment) => segment.order === order,
      );
      const nextIndex = currentIndex + direction;

      if (
        currentIndex < 0 ||
        nextIndex < 0 ||
        nextIndex >= currentSegments.length
      ) {
        return currentSegments;
      }

      const nextSegments = [...currentSegments];
      const [segment] = nextSegments.splice(currentIndex, 1);
      nextSegments.splice(nextIndex, 0, segment);

      return renumberSegments(nextSegments);
    });
  }

  function buildPayload() {
    if (!activeTeam) {
      setError(t('practices.noActiveTeamTitle'));
      return null;
    }

    const normalizedSegments = renumberSegments(
      segments.map((segment) => ({
        order: segment.order,
        drill_id: null,
        custom_title: segment.custom_title.trim(),
        duration_minutes: safeDuration(segment.duration_minutes),
        notes: segment.notes.trim(),
      })),
    );

    if (
      normalizedSegments.some(
        (segment) => !segment.custom_title || segment.duration_minutes <= 0,
      )
    ) {
      setError(t('practiceDetail.requiredError'));
      return null;
    }

    return {
      team_id: activeTeam.id,
      practice_date: practiceDate.toISOString(),
      segments: normalizedSegments,
    };
  }

  async function handleSave() {
    const payload = buildPayload();

    if (!payload) {
      return;
    }

    setError('');
    setExportError('');
    setIsSaving(true);

    const saveResult = isEditing && practicePlanId
      ? await supabase
          .from('practice_plans')
          .update(payload)
          .eq('id', practicePlanId)
      : await supabase
          .from('practice_plans')
          .insert(payload)
          .select('id')
          .single();

    if (saveResult.error) {
      console.error('Unable to save practice plan:', saveResult.error);
      setError(t('practiceDetail.saveError'));
      setIsSaving(false);
      return;
    }

    await queryClient.invalidateQueries({
      queryKey: ['practice-plans', activeTeam?.id],
    });
    await queryClient.invalidateQueries({
      queryKey: ['practice-plan', practicePlanId],
    });
    setIsSaving(false);

    if (!isEditing && saveResult.data?.id) {
      navigation.replace('PracticePlanDetail', {
        practicePlanId: saveResult.data.id,
      });
      return;
    }

    navigation.replace('MainTabs', { screen: 'PracticesTab' });
  }

  async function handleExport() {
    setExportError('');
    setIsExporting(true);

    try {
      const html = buildPracticePlanExportHtml({
        date: practiceDate,
        locale: i18n.language,
        segments: renumberSegments(segments),
        t,
        totalDuration,
      });
      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();

      if (!canShare) {
        setExportError(t('practiceDetail.exportUnavailable'));
        return;
      }

      await Sharing.shareAsync(uri, {
        UTI: 'com.adobe.pdf',
        mimeType: 'application/pdf',
      });
    } catch (exportErrorValue) {
      console.error('Unable to export practice plan:', exportErrorValue);
      setExportError(t('practiceDetail.exportError'));
    } finally {
      setIsExporting(false);
    }
  }

  if (!activeTeam) {
    return (
      <AppScreen
        description={t('practices.noActiveTeamDescription')}
        title={t('practices.noActiveTeamTitle')}
      />
    );
  }

  return (
    <AppScreen
      description={t('practiceDetail.description', {
        teamName: activeTeam.name,
      })}
      title={
        isReadOnly
          ? t('practiceDetail.readOnlyTitle')
          : isEditing
            ? t('practiceDetail.editTitle')
            : t('practiceDetail.addTitle')
      }
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
        <PracticeDateTimePicker
          calendarMonth={calendarMonth}
          disabled={isReadOnly}
          locale={i18n.language}
          practiceDate={practiceDate}
          setCalendarMonth={setCalendarMonth}
          setPracticeDate={setPracticeDate}
        />
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>
            {t('practiceDetail.totalDurationLabel')}
          </Text>
          <Text style={styles.totalValue}>
            {t('practiceDetail.totalDurationValue', {
              duration: totalDuration,
            })}
          </Text>
        </View>
      </View>
      <View style={appScreenStyles.card}>
        <View style={appScreenStyles.row}>
          <Text style={appScreenStyles.cardTitle}>
            {t('practiceDetail.segmentsTitle')}
          </Text>
          {isReadOnly ? null : (
            <Button
              color={goalRed}
              title={t('practiceDetail.addSegmentButton')}
              onPress={addSegment}
            />
          )}
        </View>
        {segments.map((segment, index) => (
          <SegmentEditor
            canMoveDown={index < segments.length - 1}
            canMoveUp={index > 0}
            isReadOnly={isReadOnly}
            key={segment.order}
            segment={segment}
            onMoveDown={() => moveSegment(segment.order, 1)}
            onMoveUp={() => moveSegment(segment.order, -1)}
            onRemove={() => removeSegment(segment.order)}
            onUpdate={(updates) => updateSegment(segment.order, updates)}
          />
        ))}
      </View>
      {error ? <Text style={authStyles.error}>{error}</Text> : null}
      {exportError ? <Text style={authStyles.error}>{exportError}</Text> : null}
      {isReadOnly ? (
        <Text style={appScreenStyles.note}>{t('common.readOnlyNotice')}</Text>
      ) : (
        <Button
          color={goalRed}
          disabled={isSaving || practiceQuery.isLoading}
          title={
            isSaving ? t('practiceDetail.saving') : t('practiceDetail.saveButton')
          }
          onPress={() => void handleSave()}
        />
      )}
      <Button
        color={goalRed}
        disabled={isSaving || isExporting || practiceQuery.isLoading}
        title={
          isExporting
            ? t('practiceDetail.exporting')
            : t('practiceDetail.exportButton')
        }
        onPress={() => void handleExport()}
      />
    </AppScreen>
  );
}

function PracticeDateTimePicker({
  calendarMonth,
  disabled = false,
  locale,
  practiceDate,
  setCalendarMonth,
  setPracticeDate,
}: {
  calendarMonth: Date;
  disabled?: boolean;
  locale: string;
  practiceDate: Date;
  setCalendarMonth: (date: Date) => void;
  setPracticeDate: (date: Date) => void;
}) {
  const { t } = useTranslation();
  const days = getCalendarDays(calendarMonth);
  const selectedDayKey = toDateKey(practiceDate);
  const selectedHour = practiceDate.getHours();
  const selectedMinute = practiceDate.getMinutes();

  function selectDay(day: Date) {
    const nextDate = new Date(day);
    nextDate.setHours(selectedHour, selectedMinute, 0, 0);
    setPracticeDate(nextDate);
  }

  function selectHour(hour: number) {
    const nextDate = new Date(practiceDate);
    nextDate.setHours(hour, selectedMinute, 0, 0);
    setPracticeDate(nextDate);
    setCalendarMonth(startOfMonth(nextDate));
  }

  function selectMinute(minute: number) {
    const nextDate = new Date(practiceDate);
    nextDate.setHours(selectedHour, minute, 0, 0);
    setPracticeDate(nextDate);
    setCalendarMonth(startOfMonth(nextDate));
  }

  return (
    <View style={styles.datePicker}>
      <Text style={styles.selectorLabel}>{t('practiceDetail.dateLabel')}</Text>
      <Text style={styles.dateSummary}>
        {formatSelectedDateTime(practiceDate, locale)}
      </Text>
      <View style={styles.monthHeader}>
        <Button
          color={goalRed}
          disabled={disabled}
          title={t('practiceDetail.previousMonthButton')}
          onPress={() => setCalendarMonth(addMonths(calendarMonth, -1))}
        />
        <Text style={styles.monthTitle}>
          {formatMonth(calendarMonth, locale)}
        </Text>
        <Button
          color={goalRed}
          disabled={disabled}
          title={t('practiceDetail.nextMonthButton')}
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
              disabled={disabled}
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
        <Text style={styles.selectorLabel}>{t('practiceDetail.timeLabel')}</Text>
        <View style={styles.timeSummaryRow}>
          <Button
            color={goalRed}
            disabled={disabled}
            title={t('practiceDetail.hourDownButton')}
            onPress={() => selectHour((selectedHour + 23) % 24)}
          />
          <Text style={styles.timeSummary}>
            {formatTime(practiceDate, locale)}
          </Text>
          <Button
            color={goalRed}
            disabled={disabled}
            title={t('practiceDetail.hourUpButton')}
            onPress={() => selectHour((selectedHour + 1) % 24)}
          />
        </View>
        <View style={styles.selectorOptions}>
          {[0, 15, 30, 45].map((minute) => (
            <Pressable
              accessibilityRole="button"
              disabled={disabled}
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
                {t('practiceDetail.minuteOption', {
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

function SegmentEditor({
  canMoveDown,
  canMoveUp,
  isReadOnly,
  segment,
  onMoveDown,
  onMoveUp,
  onRemove,
  onUpdate,
}: {
  canMoveDown: boolean;
  canMoveUp: boolean;
  isReadOnly: boolean;
  segment: SegmentForm;
  onMoveDown: () => void;
  onMoveUp: () => void;
  onRemove: () => void;
  onUpdate: (
    updates: Partial<Pick<SegmentForm, 'custom_title' | 'duration_minutes' | 'notes'>>,
  ) => void;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.segmentCard}>
      <Text style={styles.segmentTitle}>
        {t('practiceDetail.segmentTitle', { number: segment.order })}
      </Text>
      <FormField
        autoCapitalize="sentences"
        label={t('practiceDetail.segmentNameLabel')}
        onChangeText={(value) => onUpdate({ custom_title: value })}
        placeholder={t('practiceDetail.segmentNamePlaceholder')}
        editable={!isReadOnly}
        value={segment.custom_title}
      />
      <FormField
        keyboardType="number-pad"
        label={t('practiceDetail.segmentDurationLabel')}
        onChangeText={(value) =>
          onUpdate({ duration_minutes: Number.parseInt(value, 10) || 0 })
        }
        placeholder={t('practiceDetail.segmentDurationPlaceholder')}
        editable={!isReadOnly}
        value={String(segment.duration_minutes || '')}
      />
      <FormField
        autoCapitalize="sentences"
        label={t('practiceDetail.segmentNotesLabel')}
        multiline
        onChangeText={(value) => onUpdate({ notes: value })}
        placeholder={t('practiceDetail.segmentNotesPlaceholder')}
        style={styles.multiline}
        editable={!isReadOnly}
        value={segment.notes}
      />
      {isReadOnly ? null : (
      <View style={styles.segmentActions}>
        <Button
          color={goalRed}
          disabled={!canMoveUp}
          title={t('practiceDetail.moveSegmentUpButton')}
          onPress={onMoveUp}
        />
        <Button
          color={goalRed}
          disabled={!canMoveDown}
          title={t('practiceDetail.moveSegmentDownButton')}
          onPress={onMoveDown}
        />
        <Button
          color={goalRed}
          title={t('practiceDetail.removeSegmentButton')}
          onPress={onRemove}
        />
      </View>
      )}
    </View>
  );
}

function buildPracticePlanExportHtml({
  date,
  locale,
  segments,
  t,
  totalDuration,
}: {
  date: Date;
  locale: string;
  segments: SegmentForm[];
  t: (key: string, values?: Record<string, unknown>) => string;
  totalDuration: number;
}) {
  const rows = segments
    .map(
      (segment) => `
        <li>
          <strong>${escapeHtml(
            t('practiceDetail.exportSegmentTitle', {
              number: segment.order,
              title: segment.custom_title || t('practiceDetail.segmentFallback', { number: segment.order }),
            }),
          )}</strong>
          <span>${escapeHtml(
            t('practiceDetail.totalDurationValue', {
              duration: safeDuration(segment.duration_minutes),
            }),
          )}</span>
          ${
            segment.notes
              ? `<p>${escapeHtml(segment.notes)}</p>`
              : `<p class="muted">${escapeHtml(t('practiceDetail.exportNoNotes'))}</p>`
          }
        </li>
      `,
    )
    .join('');

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body {
            color: ${colors.textPrimary};
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            line-height: 1.45;
            padding: 28px;
          }
          h1 { margin: 0 0 4px; }
          h2 { color: ${slateGrey}; font-size: 16px; margin: 0 0 20px; }
          ul { margin: 0; padding: 0; }
          li {
            border-left: 5px solid ${goalRed};
            list-style: none;
            margin: 12px 0;
            padding: 10px 12px;
          }
          strong { display: block; font-size: 16px; }
          span { color: ${slateGrey}; display: block; font-size: 13px; margin-top: 2px; }
          p { margin: 8px 0 0; white-space: pre-wrap; }
          .muted { color: ${slateGrey}; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(t('practiceDetail.exportTitle'))}</h1>
        <h2>${escapeHtml(formatSelectedDateTime(date, locale))} / ${escapeHtml(
          t('practiceDetail.totalDurationValue', { duration: totalDuration }),
        )}</h2>
        <ul>${rows}</ul>
      </body>
    </html>
  `;
}

function makeBlankSegment(order: number): SegmentForm {
  return {
    order,
    drill_id: null,
    custom_title: '',
    duration_minutes: DEFAULT_SEGMENT_DURATION,
    notes: '',
  };
}

function normalizeSegments(value: unknown): SegmentForm[] {
  const segments = Array.isArray(value) ? value : [];
  const normalizedSegments = segments
    .filter(isRecord)
    .map((segment, index) => ({
      order: numberValue(segment.order) ?? index + 1,
      drill_id: null,
      custom_title: stringValue(segment.custom_title),
      duration_minutes:
        numberValue(segment.duration_minutes) ?? DEFAULT_SEGMENT_DURATION,
      notes: stringValue(segment.notes),
    }))
    .sort((left, right) => left.order - right.order);

  return renumberSegments(
    normalizedSegments.length > 0 ? normalizedSegments : [makeBlankSegment(1)],
  );
}

function renumberSegments(segments: SegmentForm[]): SegmentForm[] {
  return segments.map((segment, index) => ({
    order: index + 1,
    drill_id: null,
    custom_title: segment.custom_title,
    duration_minutes: safeDuration(segment.duration_minutes),
    notes: segment.notes,
  }));
}

function safeDuration(value: number) {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

function parseStoredDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? makeDefaultPracticeDate(new Date())
    : date;
}

function makeDefaultPracticeDate(baseDate: Date) {
  const date = new Date(baseDate);
  date.setHours(16, 0, 0, 0);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function numberValue(value: unknown) {
  return typeof value === 'number' ? value : null;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

const styles = StyleSheet.create({
  datePicker: {
    gap: 10,
  },
  dateSummary: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  dayButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 42,
    width: '13%',
  },
  dayButtonText: {
    color: colors.textPrimary,
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
    color: colors.textPrimary,
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  multiline: {
    minHeight: 88,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  segmentActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  segmentCard: {
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    padding: 12,
  },
  segmentTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  selected: {
    backgroundColor: colors.cardPressed,
    borderColor: goalRed,
  },
  selectedText: {
    color: goalRed,
  },
  selectorLabel: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  selectorOption: {
    backgroundColor: colors.fieldBackground,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  selectorOptionText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  selectorOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timePicker: {
    gap: 8,
    marginTop: 4,
  },
  timeSummary: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  timeSummaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  totalCard: {
    backgroundColor: colors.cardPressed,
    borderRadius: 12,
    gap: 4,
    padding: 12,
  },
  totalLabel: {
    color: slateGrey,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  totalValue: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '900',
  },
  weekdayGrid: {
    flexDirection: 'row',
    gap: 5,
  },
  weekdayLabel: {
    color: slateGrey,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase',
    width: '13%',
  },
});
