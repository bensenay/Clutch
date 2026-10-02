import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Card } from '../components/Card';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { AppButton } from '../components/AppButton';
import { AppScreen, appScreenStyles } from '../components/AppScreen';
import { FormField, authStyles } from '../components/AuthScreen';
import type { AuthenticatedStackParamList } from '../navigation/types';
import {
  isLikelyNetworkError,
  makeTeamCacheKey,
  readCache,
  updateCachedListItem,
} from '../offline/cache';
import { useActiveTeam } from '../teams/ActiveTeamContext';
import {
  colors,
  fontSizes,
  goalRed,
  radii,
  sizes,
  slateGrey,
  spacing,
} from '../theme/theme';

type Props = NativeStackScreenProps<
  AuthenticatedStackParamList,
  'PracticePlanDetail'
>;

type SegmentForm = {
  order: number;
  drill_id: string | null;
  secondary_drill_id: string | null;
  secondary_notes: string;
  custom_title: string;
  duration_minutes: number;
  notes: string;
};

type DrillSlot = 'primary' | 'secondary';

type DrillOption = {
  id: string;
  team_id: string;
  name: string;
  description: string | null;
  canvas_data: unknown;
  source: 'team' | 'school';
  teamName: string;
};

type DrillRow = {
  id: string;
  team_id: string;
  name: string;
  description: string | null;
  canvas_data: unknown;
};

type SchoolDrillRow = DrillRow & {
  teams: { name: string | null } | Array<{ name: string | null }> | null;
};

type PracticePlan = {
  id: string;
  team_id: string;
  practice_date: string;
  segments: unknown;
};

const DEFAULT_SEGMENT_DURATION = 10;
const RINK_WIDTH = 1000;
const RINK_HEIGHT = 500;

export function PracticePlanDetailScreen({ navigation, route }: Props) {
  const { i18n, t } = useTranslation();
  const queryClient = useQueryClient();
  const { activeTeam, isReadOnlyTeam } = useActiveTeam();
  const practicePlanId = route.params?.practicePlanId;
  const scheduleEventId = route.params?.scheduleEventId;
  const isEditing = Boolean(practicePlanId);
  const isReadOnly = isReadOnlyTeam || Boolean(route.params?.readOnly);
  const [practiceDate, setPracticeDate] = useState(() =>
    makeDefaultPracticeDate(
      route.params?.scheduledAt ? new Date(route.params.scheduledAt) : new Date(),
    ),
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
  const [openDrillPicker, setOpenDrillPicker] = useState<{
    order: number;
    slot: DrillSlot;
  } | null>(null);

  const practiceQuery = useQuery({
    queryKey: ['practice-plan', practicePlanId],
    queryFn: async () => {
      if (!practicePlanId) {
        throw new Error(t('practiceDetail.missingPracticePlanError'));
      }

      try {
        const { data, error: loadError } = await supabase
          .from('practice_plans')
          .select('id, team_id, practice_date, segments')
          .eq('id', practicePlanId)
          .single();

        if (loadError) {
          throw loadError;
        }

        const practice = data as PracticePlan;
        if (activeTeam) {
          await updateCachedListItem(
            makeTeamCacheKey('practice-plans', activeTeam.id),
            practice,
          );
        }
        return practice;
      } catch (loadError) {
        if (activeTeam && isLikelyNetworkError(loadError)) {
          const cached = await readCache<PracticePlan[]>(
            makeTeamCacheKey('practice-plans', activeTeam.id),
          );
          const practice = cached?.data.find(
            (candidate) => candidate.id === practicePlanId,
          );

          if (practice) {
            return practice;
          }
        }

        throw loadError;
      }
    },
    enabled: isEditing,
  });

  const teamDrillsQuery = useQuery({
    queryKey: ['practice-plan-team-drills', activeTeam?.id],
    queryFn: async () => {
      if (!activeTeam) {
        throw new Error(t('practices.noActiveTeamTitle'));
      }

      const { data, error: loadError } = await supabase
        .from('drills')
        .select('id, team_id, name, description, canvas_data')
        .eq('team_id', activeTeam.id)
        .order('updated_at', { ascending: false });

      if (loadError) {
        throw loadError;
      }

      return (data ?? []) as DrillRow[];
    },
    enabled: Boolean(activeTeam),
  });

  const schoolDrillsQuery = useQuery({
    queryKey: ['practice-plan-school-drills', activeTeam?.id],
    queryFn: async () => {
      const { data, error: loadError } = await supabase
        .from('drills')
        .select('id, team_id, name, description, canvas_data, teams ( name )')
        .eq('is_published', true)
        .order('updated_at', { ascending: false });

      if (loadError) {
        throw loadError;
      }

      return (data ?? []) as SchoolDrillRow[];
    },
    enabled: Boolean(activeTeam),
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
  const teamDrillOptions: DrillOption[] = (teamDrillsQuery.data ?? []).map(
    (drill) => ({
      ...drill,
      source: 'team',
      teamName: activeTeam?.name ?? '',
    }),
  );
  const schoolDrillOptions: DrillOption[] = (schoolDrillsQuery.data ?? [])
    .filter((drill) => drill.team_id !== activeTeam?.id)
    .map((drill) => ({
      id: drill.id,
      team_id: drill.team_id,
      name: drill.name,
      description: drill.description,
      canvas_data: drill.canvas_data,
      source: 'school',
      teamName: getSchoolDrillTeamName(drill),
    }));
  const drillOptions = [...teamDrillOptions, ...schoolDrillOptions];
  const drillById = new Map(drillOptions.map((drill) => [drill.id, drill]));

  function updateSegment(
    order: number,
    updates: Partial<
      Pick<
        SegmentForm,
        | 'drill_id'
        | 'secondary_drill_id'
        | 'secondary_notes'
        | 'custom_title'
        | 'duration_minutes'
        | 'notes'
      >
    >,
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

  function selectSegmentDrill(
    order: number,
    drill: DrillOption,
    slot: DrillSlot,
  ) {
    setSegments((currentSegments) =>
      currentSegments.map((segment) =>
        segment.order === order
          ? {
              ...segment,
              ...(slot === 'primary'
                ? {
                    drill_id: drill.id,
                    custom_title: segment.custom_title.trim()
                      ? segment.custom_title
                      : drill.name,
                  }
                : { secondary_drill_id: drill.id }),
            }
          : segment,
      ),
    );
    setOpenDrillPicker(null);
  }

  function clearSegmentDrill(order: number, slot: DrillSlot) {
    updateSegment(
      order,
      slot === 'primary'
        ? { drill_id: null }
        : { secondary_drill_id: null, secondary_notes: '' },
    );
    setOpenDrillPicker(null);
  }

  function openSegmentDrill(drill: DrillOption) {
    navigation.navigate('DrillEditor', {
      drillId: drill.id,
      readOnly: isReadOnly || drill.team_id !== activeTeam?.id,
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
        drill_id: segment.drill_id,
        secondary_drill_id: segment.secondary_drill_id,
        secondary_notes: segment.secondary_notes.trim(),
        custom_title: segment.custom_title.trim(),
        duration_minutes: safeDuration(segment.duration_minutes),
        notes: segment.notes.trim(),
      })),
    );

    if (
      normalizedSegments.some(
        (segment) =>
          (!segment.custom_title && !segment.drill_id) ||
          segment.duration_minutes <= 0,
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
      setError(
        isLikelyNetworkError(saveResult.error)
          ? t('offline.writeBlocked')
          : t('practiceDetail.saveError'),
      );
      setIsSaving(false);
      return;
    }

    await queryClient.invalidateQueries({
      queryKey: ['practice-plans', activeTeam?.id],
    });
    await queryClient.invalidateQueries({
      queryKey: ['calendar-practice-plans'],
    });
    await queryClient.invalidateQueries({
      queryKey: ['practice-plan', practicePlanId],
    });
    setIsSaving(false);

    if (!isEditing && saveResult.data?.id) {
      if (scheduleEventId) {
        const { error: linkError } = await supabase
          .from('schedule_events')
          .update({ practice_plan_id: saveResult.data.id })
          .eq('id', scheduleEventId);

        if (linkError) {
          console.error('Unable to link practice plan to schedule event:', linkError);
          setError(t('practiceDetail.saveError'));
          return;
        }

        await queryClient.invalidateQueries({ queryKey: ['schedule-events'] });
        await queryClient.invalidateQueries({ queryKey: ['schedule-event', scheduleEventId] });
      }
      navigation.replace('PracticePlanDetail', {
        practicePlanId: saveResult.data.id,
      });
      return;
    }

    navigation.replace('MainTabs', { screen: 'PracticeTab' });
  }

  async function deletePracticePlan() {
    if (!practicePlanId) {
      return;
    }

    setError('');
    setIsSaving(true);
    const { error: deleteError } = await supabase
      .from('practice_plans')
      .delete()
      .eq('id', practicePlanId);

    if (deleteError) {
      setError(
        isLikelyNetworkError(deleteError)
          ? t('offline.writeBlocked')
          : t('practiceDetail.deleteError'),
      );
      setIsSaving(false);
      return;
    }

    await queryClient.invalidateQueries({
      queryKey: ['practice-plans', activeTeam?.id],
    });
    await queryClient.invalidateQueries({
      queryKey: ['calendar-practice-plans'],
    });
    setIsSaving(false);
    navigation.replace('MainTabs', { screen: 'PracticeTab' });
  }

  function confirmDeletePracticePlan() {
    Alert.alert(
      t('practiceDetail.deleteConfirmTitle'),
      t('practiceDetail.deleteConfirmDescription'),
      [
        { style: 'cancel', text: t('common.cancel') },
        {
          style: 'destructive',
          text: t('practiceDetail.deleteConfirmButton'),
          onPress: () => void deletePracticePlan(),
        },
      ],
    );
  }

  async function handleExport() {
    setExportError('');
    setIsExporting(true);

    try {
      const html = buildPracticePlanExportHtml({
        date: practiceDate,
        locale: i18n.language,
        drillById,
        segments: renumberSegments(segments),
        teamName: activeTeam?.name ?? '',
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
      {teamDrillsQuery.error || schoolDrillsQuery.error ? (
        <Text style={appScreenStyles.error}>
          {t('practiceDetail.drillsLoadError')}
        </Text>
      ) : null}
      <Card style={appScreenStyles.card}>
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
      </Card>
      <Card style={appScreenStyles.card}>
        <View style={appScreenStyles.row}>
          <Text style={appScreenStyles.cardTitle}>
            {t('practiceDetail.segmentsTitle')}
          </Text>
          {isReadOnly ? null : (
            <AppButton
              icon="add-circle-outline"
              title={t('practiceDetail.addSegmentButton')}
              onPress={addSegment}
              variant="secondary"
            />
          )}
        </View>
        {segments.map((segment, index) => (
          <SegmentEditor
            canMoveDown={index < segments.length - 1}
            canMoveUp={index > 0}
            drillOptions={drillOptions}
            openDrillPickerSlot={
              openDrillPicker?.order === segment.order
                ? openDrillPicker.slot
                : null
            }
            isReadOnly={isReadOnly}
            key={segment.order}
            segment={segment}
            selectedDrill={
              segment.drill_id ? drillById.get(segment.drill_id) ?? null : null
            }
            selectedSecondaryDrill={
              segment.secondary_drill_id
                ? drillById.get(segment.secondary_drill_id) ?? null
                : null
            }
            onClearDrill={(slot) => clearSegmentDrill(segment.order, slot)}
            onOpenDrill={openSegmentDrill}
            onMoveDown={() => moveSegment(segment.order, 1)}
            onMoveUp={() => moveSegment(segment.order, -1)}
            onRemove={() => removeSegment(segment.order)}
            onSelectDrill={(drill, slot) =>
              selectSegmentDrill(segment.order, drill, slot)
            }
            onToggleDrillPicker={(slot) =>
              setOpenDrillPicker((current) =>
                current?.order === segment.order && current.slot === slot
                  ? null
                  : { order: segment.order, slot },
              )
            }
            onUpdate={(updates) => updateSegment(segment.order, updates)}
          />
        ))}
      </Card>
      {error ? <Text style={authStyles.error}>{error}</Text> : null}
      {exportError ? <Text style={authStyles.error}>{exportError}</Text> : null}
      {isReadOnly ? (
        <Text style={appScreenStyles.note}>{t('common.readOnlyNotice')}</Text>
      ) : (
        <AppButton
          disabled={isSaving || practiceQuery.isLoading}
          icon="save-outline"
          title={
            isSaving ? t('practiceDetail.saving') : t('practiceDetail.saveButton')
          }
          onPress={() => void handleSave()}
        />
      )}
      {isEditing && !isReadOnly ? (
        <AppButton
          disabled={isSaving}
          icon="trash-outline"
          title={t('practiceDetail.deleteButton')}
          onPress={confirmDeletePracticePlan}
          variant="danger"
        />
      ) : null}
      <AppButton
        disabled={isSaving || isExporting || practiceQuery.isLoading}
        icon="download-outline"
        title={
          isExporting
            ? t('practiceDetail.exporting')
            : t('practiceDetail.exportButton')
        }
        onPress={() => void handleExport()}
        variant="secondary"
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
        <AppButton
          disabled={disabled}
          icon="chevron-back-outline"
          title={t('practiceDetail.previousMonthButton')}
          onPress={() => setCalendarMonth(addMonths(calendarMonth, -1))}
          variant="secondary"
        />
        <Text style={styles.monthTitle}>
          {formatMonth(calendarMonth, locale)}
        </Text>
        <AppButton
          disabled={disabled}
          icon="chevron-forward-outline"
          title={t('practiceDetail.nextMonthButton')}
          onPress={() => setCalendarMonth(addMonths(calendarMonth, 1))}
          variant="secondary"
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
          <AppButton
            disabled={disabled}
            icon="chevron-down-outline"
            title={t('practiceDetail.hourDownButton')}
            onPress={() => selectHour((selectedHour + 23) % 24)}
            variant="secondary"
          />
          <Text style={styles.timeSummary}>
            {formatTime(practiceDate, locale)}
          </Text>
          <AppButton
            disabled={disabled}
            icon="chevron-up-outline"
            title={t('practiceDetail.hourUpButton')}
            onPress={() => selectHour((selectedHour + 1) % 24)}
            variant="secondary"
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
  drillOptions,
  openDrillPickerSlot,
  isReadOnly,
  segment,
  selectedDrill,
  selectedSecondaryDrill,
  onClearDrill,
  onOpenDrill,
  onMoveDown,
  onMoveUp,
  onRemove,
  onSelectDrill,
  onToggleDrillPicker,
  onUpdate,
}: {
  canMoveDown: boolean;
  canMoveUp: boolean;
  drillOptions: DrillOption[];
  openDrillPickerSlot: DrillSlot | null;
  isReadOnly: boolean;
  segment: SegmentForm;
  selectedDrill: DrillOption | null;
  selectedSecondaryDrill: DrillOption | null;
  onClearDrill: (slot: DrillSlot) => void;
  onOpenDrill: (drill: DrillOption) => void;
  onMoveDown: () => void;
  onMoveUp: () => void;
  onRemove: () => void;
  onSelectDrill: (drill: DrillOption, slot: DrillSlot) => void;
  onToggleDrillPicker: (slot: DrillSlot) => void;
  onUpdate: (
    updates: Partial<
      Pick<
        SegmentForm,
        | 'drill_id'
        | 'secondary_drill_id'
        | 'secondary_notes'
        | 'custom_title'
        | 'duration_minutes'
        | 'notes'
      >
    >,
  ) => void;
}) {
  const { t } = useTranslation();
  const teamDrills = drillOptions.filter((drill) => drill.source === 'team');
  const schoolDrills = drillOptions.filter((drill) => drill.source === 'school');
  const dragGesture = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .onEnd((event) => {
      if (event.translationY < -24 && canMoveUp) {
        runOnJS(onMoveUp)();
      } else if (event.translationY > 24 && canMoveDown) {
        runOnJS(onMoveDown)();
      }
    });

  return (
    <View style={styles.segmentCard}>
      <View style={styles.segmentHeader}>
        <Text style={styles.segmentTitle}>
          {t('practiceDetail.segmentTitle', { number: segment.order })}
        </Text>
        {selectedDrill ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => onOpenDrill(selectedDrill)}
            style={styles.drillBadge}
          >
            <Text style={styles.drillBadgeText}>
              {t('practiceDetail.linkedDrillBadge')}
            </Text>
          </Pressable>
        ) : (
          <Text style={styles.textSegmentBadge}>
            {t('practiceDetail.textSegmentBadge')}
          </Text>
        )}
      </View>
      {isReadOnly ? null : (
        <GestureDetector gesture={dragGesture}>
          <View accessibilityLabel={t('practiceDetail.dragHandleLabel')} style={styles.dragHandle}>
            <Text style={styles.dragHandleIcon}>≡</Text>
            <Text style={styles.dragHandleText}>
              {t('practiceDetail.dragHandleLabel')}
            </Text>
          </View>
        </GestureDetector>
      )}
      {selectedDrill ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => onOpenDrill(selectedDrill)}
          style={styles.linkedDrillCard}
        >
          <Text style={styles.linkedDrillTitle}>{selectedDrill.name}</Text>
          <Text style={styles.linkedDrillMeta}>
            {selectedDrill.source === 'team'
              ? t('practiceDetail.teamDrillSource')
              : t('practiceDetail.schoolDrillSource', {
                  teamName: selectedDrill.teamName,
                })}
          </Text>
        </Pressable>
      ) : null}
      {isReadOnly ? null : (
        <View style={styles.drillPickerControls}>
          <AppButton
            icon={selectedDrill ? 'swap-horizontal-outline' : 'link-outline'}
            title={
              selectedDrill
                ? t('practiceDetail.changeDrillButton')
                : t('practiceDetail.linkDrillButton')
            }
            onPress={() => onToggleDrillPicker('primary')}
            variant="secondary"
          />
          {selectedDrill ? (
            <AppButton
              icon="close-outline"
              title={t('practiceDetail.clearDrillButton')}
              onPress={() => onClearDrill('primary')}
              variant="secondary"
            />
          ) : null}
        </View>
      )}
      {selectedSecondaryDrill ? (
        <View style={styles.concurrentDrillBlock}>
          <Text style={styles.concurrentDrillLabel}>
            {t('practiceDetail.concurrentDrillLabel')}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => onOpenDrill(selectedSecondaryDrill)}
            style={styles.linkedDrillCard}
          >
            <Text style={styles.linkedDrillTitle}>
              {selectedSecondaryDrill.name}
            </Text>
            <Text style={styles.linkedDrillMeta}>
              {selectedSecondaryDrill.source === 'team'
                ? t('practiceDetail.teamDrillSource')
                : t('practiceDetail.schoolDrillSource', {
                    teamName: selectedSecondaryDrill.teamName,
                  })}
            </Text>
          </Pressable>
          <FormField
            autoCapitalize="sentences"
            editable={!isReadOnly}
            label={t('practiceDetail.concurrentNotesLabel')}
            multiline
            onChangeText={(value) => onUpdate({ secondary_notes: value })}
            placeholder={t('practiceDetail.concurrentNotesPlaceholder')}
            style={styles.multiline}
            value={segment.secondary_notes}
          />
        </View>
      ) : null}
      {isReadOnly ? null : (
        <View style={styles.drillPickerControls}>
          <AppButton
            icon={selectedSecondaryDrill ? 'swap-horizontal-outline' : 'git-compare-outline'}
            title={
              selectedSecondaryDrill
                ? t('practiceDetail.changeConcurrentDrillButton')
                : t('practiceDetail.addConcurrentDrillButton')
            }
            onPress={() => onToggleDrillPicker('secondary')}
            variant="secondary"
          />
          {selectedSecondaryDrill ? (
            <AppButton
              icon="close-outline"
              title={t('practiceDetail.clearConcurrentDrillButton')}
              onPress={() => onClearDrill('secondary')}
              variant="secondary"
            />
          ) : null}
        </View>
      )}
      {openDrillPickerSlot && !isReadOnly ? (
        <View style={styles.drillPickerPanel}>
          <Text style={styles.drillPickerSlotTitle}>
            {openDrillPickerSlot === 'primary'
              ? t('practiceDetail.primaryDrillPickerTitle')
              : t('practiceDetail.concurrentDrillPickerTitle')}
          </Text>
          <DrillPickerSection
            drills={teamDrills}
            emptyLabel={t('practiceDetail.emptyTeamDrills')}
            selectedDrillId={
              openDrillPickerSlot === 'primary'
                ? segment.drill_id
                : segment.secondary_drill_id
            }
            title={t('practiceDetail.teamDrillsTitle')}
            onSelectDrill={(drill) =>
              onSelectDrill(drill, openDrillPickerSlot)
            }
          />
          <DrillPickerSection
            drills={schoolDrills}
            emptyLabel={t('practiceDetail.emptySchoolDrills')}
            selectedDrillId={
              openDrillPickerSlot === 'primary'
                ? segment.drill_id
                : segment.secondary_drill_id
            }
            title={t('practiceDetail.schoolDrillsTitle')}
            onSelectDrill={(drill) =>
              onSelectDrill(drill, openDrillPickerSlot)
            }
          />
        </View>
      ) : null}
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
        <AppButton
          disabled={!canMoveUp}
          icon="arrow-up-outline"
          title={t('practiceDetail.moveSegmentUpButton')}
          onPress={onMoveUp}
          variant="secondary"
        />
        <AppButton
          disabled={!canMoveDown}
          icon="arrow-down-outline"
          title={t('practiceDetail.moveSegmentDownButton')}
          onPress={onMoveDown}
          variant="secondary"
        />
        <AppButton
          icon="trash-outline"
          title={t('practiceDetail.removeSegmentButton')}
          onPress={onRemove}
          variant="danger"
        />
      </View>
      )}
    </View>
  );
}

function DrillPickerSection({
  drills,
  emptyLabel,
  selectedDrillId,
  title,
  onSelectDrill,
}: {
  drills: DrillOption[];
  emptyLabel: string;
  selectedDrillId: string | null;
  title: string;
  onSelectDrill: (drill: DrillOption) => void;
}) {
  return (
    <View style={styles.drillPickerSection}>
      <Text style={styles.drillPickerSectionTitle}>{title}</Text>
      {drills.length === 0 ? (
        <Text style={styles.drillPickerEmpty}>{emptyLabel}</Text>
      ) : null}
      {drills.map((drill) => {
        const isSelected = drill.id === selectedDrillId;

        return (
          <Pressable
            accessibilityRole="button"
            key={drill.id}
            onPress={() => onSelectDrill(drill)}
            style={[
              styles.drillPickerOption,
              isSelected && styles.drillPickerOptionSelected,
            ]}
          >
            <Text style={styles.drillPickerOptionTitle}>{drill.name}</Text>
            <Text style={styles.drillPickerOptionMeta}>
              {drill.source === 'team' ? drill.teamName : drill.teamName}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function buildPracticePlanExportHtml({
  date,
  drillById,
  locale,
  segments,
  teamName,
  t,
  totalDuration,
}: {
  date: Date;
  drillById: Map<string, DrillOption>;
  locale: string;
  segments: SegmentForm[];
  teamName: string;
  t: (key: string, values?: Record<string, unknown>) => string;
  totalDuration: number;
}) {
  let elapsedMinutes = 0;
  const rows = segments
    .map((segment) => {
      const linkedDrill = segment.drill_id
        ? drillById.get(segment.drill_id)
        : undefined;
      const segmentTitle =
        segment.custom_title ||
        linkedDrill?.name ||
        t('practiceDetail.segmentFallback', { number: segment.order });
      const drillDiagram = linkedDrill
        ? buildDrillExportSvg(linkedDrill.canvas_data)
        : '';
      const secondaryDrill = segment.secondary_drill_id
        ? drillById.get(segment.secondary_drill_id)
        : undefined;
      const secondaryDiagram = secondaryDrill
        ? buildDrillExportSvg(secondaryDrill.canvas_data)
        : '';
      const segmentStart = new Date(date.getTime() + elapsedMinutes * 60_000);
      elapsedMinutes += safeDuration(segment.duration_minutes);
      const segmentEnd = new Date(date.getTime() + elapsedMinutes * 60_000);
      const drillCards = [
        linkedDrill
          ? `<div class="drill-card"><p class="drill-meta">${escapeHtml(
              linkedDrill.name,
            )}</p>${drillDiagram}</div>`
          : '',
        secondaryDrill
          ? `<div class="drill-card"><p class="drill-meta">${escapeHtml(
              t('practiceDetail.concurrentDrillPdfLabel', {
                name: secondaryDrill.name,
              }),
            )}</p>${secondaryDiagram}${
              segment.secondary_notes
                ? `<div class="notes-block"><span class="notes-label">${escapeHtml(
                    t('practiceDetail.concurrentNotesLabel'),
                  )}</span><p>${escapeHtml(segment.secondary_notes)}</p></div>`
                : ''
            }</div>`
          : '',
      ].filter(Boolean).join('');

      return `
        <li>
          <strong>${escapeHtml(
            t('practiceDetail.exportSegmentTitle', {
              number: segment.order,
              title: segmentTitle,
            }),
          )}</strong>
          <span class="segment-time">${escapeHtml(
            `${formatTime(segmentStart, locale)} – ${formatTime(segmentEnd, locale)}`,
          )}</span>
          <span class="segment-duration">${escapeHtml(
            t('practiceDetail.totalDurationValue', {
              duration: safeDuration(segment.duration_minutes),
            }),
          )}</span>
          ${
            linkedDrill || secondaryDrill
              ? `<p class="drill-source">${escapeHtml(
                  t('practiceDetail.exportLinkedDrill', {
                    name: linkedDrill?.name ?? secondaryDrill?.name ?? '',
                    source:
                      (linkedDrill ?? secondaryDrill)?.source === 'team'
                        ? t('practiceDetail.teamDrillSource')
                        : t('practiceDetail.schoolDrillSource', {
                            teamName:
                              (linkedDrill ?? secondaryDrill)?.teamName ?? '',
                          }),
                  }),
                )}</p><div class="drill-grid">${drillCards}</div>`
              : `<p class="badge">${escapeHtml(t('practiceDetail.textSegmentBadge'))}</p>`
          }
          ${
            segment.notes
              ? `<div class="notes-block"><span class="notes-label">${escapeHtml(
                  t('practiceDetail.segmentNotesLabel'),
                )}</span><p>${escapeHtml(segment.notes)}</p></div>`
              : `<p class="muted">${escapeHtml(t('practiceDetail.exportNoNotes'))}</p>`
          }
        </li>
      `;
    })
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
            background: #f4f8fb;
            border: 1px solid #c7d6e0;
            border-left: 5px solid ${goalRed};
            border-radius: 10px;
            break-inside: avoid;
            list-style: none;
            margin: 16px 0;
            padding: 14px 16px;
          }
          strong { display: block; font-size: 16px; }
          span { color: ${slateGrey}; display: block; font-size: 13px; margin-top: 2px; }
          .segment-time { color: #254f6d; font-size: 14px; font-weight: 800; }
          .segment-duration { color: #4a6578; font-weight: 700; }
          p { margin: 8px 0 0; white-space: pre-wrap; }
          .badge, .drill-meta, .drill-source {
            color: ${goalRed};
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
          }
          .drill-grid { display: flex; gap: 12px; margin-top: 8px; width: 100%; }
          .drill-card { flex: 1; min-width: 0; }
          .drill-card .drill-meta { margin: 0 0 5px; }
          .notes-block {
            background: #ffffff;
            border: 1px solid #9fb3c1;
            border-radius: 7px;
            color: #0b1f33;
            margin-top: 10px;
            padding: 8px 10px;
          }
          .notes-block p { color: #0b1f33; font-size: 13px; font-weight: 600; margin: 3px 0 0; }
          .notes-label { color: #254f6d; font-size: 11px; font-weight: 800; text-transform: uppercase; }
          .rink-svg {
            border: 1px solid #d5e4ee;
            border-radius: 10px;
            display: block;
            margin-top: 10px;
            max-width: 100%;
            width: 100%;
          }
          .muted { color: ${slateGrey}; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(
          t('practiceDetail.exportTitleForTeam', { teamName }),
        )}</h1>
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
    secondary_drill_id: null,
    secondary_notes: '',
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
      drill_id: stringValue(segment.drill_id) || null,
      secondary_drill_id:
        stringValue(segment.secondary_drill_id) || null,
      secondary_notes: stringValue(segment.secondary_notes),
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
    drill_id: segment.drill_id,
    secondary_drill_id: segment.secondary_drill_id,
    secondary_notes: segment.secondary_notes,
    custom_title: segment.custom_title,
    duration_minutes: safeDuration(segment.duration_minutes),
    notes: segment.notes,
  }));
}

function buildDrillExportSvg(canvasData: unknown) {
  const objects = Array.isArray(canvasData) ? canvasData.filter(isRecord) : [];
  const renderedObjects = objects.map(renderDrillObjectSvg).join('');

  return `
    <svg class="rink-svg" viewBox="0 0 ${RINK_WIDTH} ${RINK_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect fill="#f7fbff" height="${RINK_HEIGHT - 18}" rx="70" stroke="#d5e4ee" stroke-width="10" width="${RINK_WIDTH - 18}" x="9" y="9" />
      <line stroke="#c63535" stroke-width="8" x1="500" x2="500" y1="16" y2="484" />
      <circle cx="500" cy="250" fill="none" r="72" stroke="#b9d0df" stroke-width="5" />
      <circle cx="500" cy="250" fill="#c63535" r="8" />
      <line stroke="#2f68ad" stroke-width="10" x1="390" x2="390" y1="16" y2="484" />
      <line stroke="#2f68ad" stroke-width="10" x1="610" x2="610" y1="16" y2="484" />
      <line stroke="#c63535" stroke-width="5" x1="115" x2="115" y1="16" y2="484" />
      <line stroke="#c63535" stroke-width="5" x1="885" x2="885" y1="16" y2="484" />
      <ellipse cx="225" cy="155" fill="none" rx="55" ry="48" stroke="#c63535" stroke-width="5" />
      <ellipse cx="225" cy="345" fill="none" rx="55" ry="48" stroke="#c63535" stroke-width="5" />
      <ellipse cx="775" cy="155" fill="none" rx="55" ry="48" stroke="#c63535" stroke-width="5" />
      <ellipse cx="775" cy="345" fill="none" rx="55" ry="48" stroke="#c63535" stroke-width="5" />
      <circle cx="225" cy="155" fill="#c63535" r="6" />
      <circle cx="225" cy="345" fill="#c63535" r="6" />
      <circle cx="775" cy="155" fill="#c63535" r="6" />
      <circle cx="775" cy="345" fill="#c63535" r="6" />
      <path d="M90 207 H66 C48 207 38 225 38 250 C38 275 48 293 66 293 H90 Z" fill="none" stroke="#8db0c7" stroke-linejoin="round" stroke-width="5" />
      <path d="M910 207 H934 C952 207 962 225 962 250 C962 275 952 293 934 293 H910 Z" fill="none" stroke="#8db0c7" stroke-linejoin="round" stroke-width="5" />
      ${renderedObjects}
    </svg>
  `;
}

function renderDrillObjectSvg(object: Record<string, unknown>) {
  const type = stringValue(object.type);
  const color = escapeSvgColor(stringValue(object.color) || goalRed);

  if (type === 'skate_path' || type === 'pass_line') {
    const points = normalizeSvgPoints(object.points);

    if (points.length < 2) {
      return '';
    }

    const pathData = makeSvgPathData(points);
    const arrowData = makeSvgArrowData(points);
    const dash = type === 'pass_line' ? ' stroke-dasharray="18 12"' : '';
    const ticks =
      type === 'skate_path' &&
      (stringValue(object.style) === 'backward' ||
        stringValue(object.style) === 'freehand_backward')
        ? makeSvgBackwardTicks(points, color)
        : '';

    return `<path d="${pathData}" fill="none" stroke="${color}"${dash} stroke-linecap="round" stroke-linejoin="round" stroke-width="8" />${ticks}${arrowData ? `<path d="${arrowData}" fill="${color}" />` : ''}`;
  }

  if (type === 'shaded_zone') {
    const points = normalizeSvgPoints(object.points);

    if (points.length < 3) {
      return '';
    }

    const opacity = numberValue(object.opacity) ?? 0.28;
    return `<polygon fill="${color}" fill-opacity="${clampNumber(opacity, 0.05, 0.8)}" points="${pointsToSvgValue(points)}" stroke="${color}" stroke-linejoin="round" stroke-width="3" />`;
  }

  const x = numberValue(object.x);
  const y = numberValue(object.y);

  if (x === null || y === null) {
    return '';
  }

  if (type === 'player_token') {
    return `<circle cx="${x}" cy="${y}" fill="${color}" r="20" stroke="#071723" stroke-width="3" /><text fill="#ffffff" font-size="22" font-weight="900" text-anchor="middle" x="${x}" y="${y + 8}">${escapeHtml(stringValue(object.label) || 'F')}</text>`;
  }

  if (type === 'puck') {
    if (stringValue(object.variant) === 'group') {
      return Array.from({ length: 11 }, (_, index) => {
        const offsetX = (index % 4) * 9 + (Math.floor(index / 4) % 2) * 4 - 16;
        const offsetY = Math.floor(index / 4) * 8 - 8;
        return `<circle cx="${x + offsetX}" cy="${y + offsetY}" fill="${color}" r="5" stroke="#000000" stroke-width="1.5" />`;
      }).join('');
    }
    return `<circle cx="${x}" cy="${y}" fill="${color}" r="8" stroke="#000000" stroke-width="2" />`;
  }

  if (type === 'cone') {
    return `<path d="M ${x} ${y - 18} L ${x + 16} ${y + 16} L ${x - 16} ${y + 16} Z" fill="${color}" stroke="#8a5a0a" stroke-linejoin="round" stroke-width="2" /><line stroke="#ffffff" stroke-width="3" x1="${x - 8}" x2="${x + 8}" y1="${y + 2}" y2="${y + 2}" />`;
  }

  if (type === 'net') {
    return `<path d="M ${x - 22} ${y - 18} V ${y + 18} H ${x - 7} C ${x + 14} ${y + 18} ${x + 22} ${y + 11} ${x + 22} ${y} C ${x + 22} ${y - 11} ${x + 14} ${y - 18} ${x - 7} ${y - 18} Z" fill="#ffffff" stroke="${color}" stroke-linejoin="round" stroke-width="4" /><path d="M ${x - 20} ${y - 9} H ${x + 12} M ${x - 20} ${y} H ${x + 21} M ${x - 20} ${y + 9} H ${x + 12}" fill="none" stroke="#9db2c1" stroke-width="2" /><rect fill="${color}" height="40" rx="3" width="7" x="${x - 25}" y="${y - 20}" />`;
  }

  if (type === 'text') {
    return `<text fill="${color}" font-size="22" font-weight="900" text-anchor="middle" x="${x}" y="${y}">${escapeHtml(stringValue(object.text))}</text>`;
  }

  return '';
}

function normalizeSvgPoints(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((point): Array<{ x: number; y: number }> => {
    if (!isRecord(point)) {
      return [];
    }

    const x = numberValue(point.x);
    const y = numberValue(point.y);

    if (x === null || y === null) {
      return [];
    }

    return [
      {
        x: clampNumber(x, 0, RINK_WIDTH),
        y: clampNumber(y, 0, RINK_HEIGHT),
      },
    ];
  });
}

function makeSvgPathData(points: Array<{ x: number; y: number }>) {
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let pathData = `M ${points[0].x} ${points[0].y}`;

  for (let index = 1; index < points.length - 1; index += 1) {
    const currentPoint = points[index];
    const nextPoint = points[index + 1];
    const midPoint = {
      x: (currentPoint.x + nextPoint.x) / 2,
      y: (currentPoint.y + nextPoint.y) / 2,
    };
    pathData += ` Q ${currentPoint.x} ${currentPoint.y} ${midPoint.x} ${midPoint.y}`;
  }

  const lastPoint = points[points.length - 1];
  return `${pathData} L ${lastPoint.x} ${lastPoint.y}`;
}

function makeSvgArrowData(points: Array<{ x: number; y: number }>) {
  if (points.length < 2) {
    return '';
  }

  const endPoint = points[points.length - 1];
  let startPoint = points[points.length - 2];

  for (let index = points.length - 2; index >= 0; index -= 1) {
    const candidate = points[index];
    if (Math.hypot(endPoint.x - candidate.x, endPoint.y - candidate.y) > 4) {
      startPoint = candidate;
      break;
    }
  }

  const angle = Math.atan2(endPoint.y - startPoint.y, endPoint.x - startPoint.x);
  const arrowLength = 24;
  const arrowWidth = 16;
  const baseX = endPoint.x - Math.cos(angle) * arrowLength;
  const baseY = endPoint.y - Math.sin(angle) * arrowLength;
  const perpendicularX = Math.cos(angle + Math.PI / 2) * arrowWidth * 0.5;
  const perpendicularY = Math.sin(angle + Math.PI / 2) * arrowWidth * 0.5;

  return [
    `M ${endPoint.x} ${endPoint.y}`,
    `L ${baseX + perpendicularX} ${baseY + perpendicularY}`,
    `L ${baseX - perpendicularX} ${baseY - perpendicularY}`,
    'Z',
  ].join(' ');
}

function makeSvgBackwardTicks(points: Array<{ x: number; y: number }>, color: string) {
  return points
    .map((point, index) => {
      if (index === 0 || index % 2 === 0) {
        return '';
      }

      const previousPoint = points[index - 1];
      const distance = Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y);

      if (distance < 1) {
        return '';
      }

      const midX = (previousPoint.x + point.x) / 2;
      const midY = (previousPoint.y + point.y) / 2;
      const normalX = -((point.y - previousPoint.y) / distance);
      const normalY = (point.x - previousPoint.x) / distance;
      const halfTick = 11;

      return `<line stroke="${color}" stroke-linecap="round" stroke-width="5" x1="${midX - normalX * halfTick}" x2="${midX + normalX * halfTick}" y1="${midY - normalY * halfTick}" y2="${midY + normalY * halfTick}" />`;
    })
    .join('');
}

function pointsToSvgValue(points: Array<{ x: number; y: number }>) {
  return points.map((point) => `${point.x},${point.y}`).join(' ');
}

function escapeSvgColor(value: string) {
  return /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : goalRed;
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
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsedValue = Number(value);
    return Number.isNaN(parsedValue) ? null : parsedValue;
  }

  return null;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getSchoolDrillTeamName(drill: SchoolDrillRow) {
  const team = Array.isArray(drill.teams)
    ? drill.teams[0] ?? null
    : drill.teams;

  return team?.name ?? '';
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
  concurrentDrillBlock: {
    backgroundColor: colors.warningSoft,
    borderRadius: radii.md,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  concurrentDrillLabel: {
    color: colors.textPrimary,
    fontSize: fontSizes.xs,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  datePicker: {
    gap: spacing.control,
  },
  dateSummary: {
    color: colors.textPrimary,
    fontSize: fontSizes.base,
    fontWeight: '700',
  },
  dayButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: sizes.touch,
    width: '13%',
  },
  dayButtonText: {
    color: colors.textPrimary,
    fontSize: fontSizes.md,
    fontWeight: '700',
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.formGap,
  },
  drillBadge: {
    backgroundColor: colors.cardPressed,
    borderColor: goalRed,
    borderRadius: radii.chip,
    borderWidth: 1,
    paddingHorizontal: spacing.control,
    paddingVertical: spacing.formGap,
  },
  drillBadgeText: {
    color: goalRed,
    fontSize: fontSizes.tiny,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  drillPickerControls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  drillPickerEmpty: {
    color: slateGrey,
    fontSize: fontSizes.sm,
  },
  drillPickerOption: {
    backgroundColor: colors.fieldBackground,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.xxs,
    padding: spacing.control,
  },
  drillPickerOptionMeta: {
    color: slateGrey,
    fontSize: fontSizes.xs,
    fontWeight: '700',
  },
  drillPickerOptionSelected: {
    borderColor: goalRed,
  },
  drillPickerOptionTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.md,
    fontWeight: '800',
  },
  drillPickerPanel: {
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.control,
  },
  drillPickerSection: {
    gap: spacing.sm,
  },
  drillPickerSectionTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.sm,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  drillPickerSlotTitle: {
    color: goalRed,
    fontSize: fontSizes.base,
    fontWeight: '900',
  },
  linkedDrillCard: {
    backgroundColor: colors.cardPressed,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.tight,
    padding: spacing.control,
  },
  linkedDrillMeta: {
    color: slateGrey,
    fontSize: fontSizes.xs,
    fontWeight: '700',
  },
  linkedDrillTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.base,
    fontWeight: '900',
  },
  monthHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  monthTitle: {
    color: colors.textPrimary,
    flex: 1,
    fontSize: fontSizes.lg,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  multiline: {
    minHeight: sizes.practiceMultiline,
    paddingTop: spacing.md,
    textAlignVertical: 'top',
  },
  segmentActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  segmentCard: {
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  segmentHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  segmentTitle: {
    color: colors.textPrimary,
    flexShrink: 1,
    fontSize: fontSizes.lg,
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
    fontSize: fontSizes.md,
    fontWeight: '600',
  },
  selectorOption: {
    backgroundColor: colors.fieldBackground,
    borderColor: colors.border,
    borderRadius: radii.chip,
    borderWidth: 1,
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.control,
  },
  selectorOptionText: {
    color: colors.textPrimary,
    fontSize: fontSizes.md,
    fontWeight: '700',
  },
  selectorOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  timePicker: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  timeSummary: {
    color: colors.textPrimary,
    fontSize: fontSizes.displaySm,
    fontWeight: '800',
  },
  timeSummaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
  },
  textSegmentBadge: {
    color: slateGrey,
    fontSize: fontSizes.tiny,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  totalCard: {
    backgroundColor: colors.cardPressed,
    borderRadius: radii.card,
    gap: spacing.xs,
    padding: spacing.md,
  },
  totalLabel: {
    color: slateGrey,
    fontSize: fontSizes.xs,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  totalValue: {
    color: colors.textPrimary,
    fontSize: fontSizes.displaySm,
    fontWeight: '900',
  },
  dragHandle: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.cardPressed,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  dragHandleIcon: {
    color: goalRed,
    fontSize: fontSizes.xl,
    fontWeight: '900',
  },
  dragHandleText: {
    color: colors.textPrimary,
    fontSize: fontSizes.xs,
    fontWeight: '700',
  },
  weekdayGrid: {
    flexDirection: 'row',
    gap: spacing.formGap,
  },
  weekdayLabel: {
    color: slateGrey,
    fontSize: fontSizes.xs,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase',
    width: '13%',
  },
});
