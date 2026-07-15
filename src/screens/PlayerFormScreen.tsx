import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { AppScreen, appScreenStyles } from '../components/AppScreen';
import {
  FormField,
  authStyles,
} from '../components/AuthScreen';
import type { AuthenticatedStackParamList } from '../navigation/types';
import { useActiveTeam } from '../teams/ActiveTeamContext';
import { colors, goalRed } from '../theme/theme';
import type {
  NaturalPosition,
  Player,
  PlayerStatus,
} from './RosterScreen';

type Props = NativeStackScreenProps<AuthenticatedStackParamList, 'PlayerForm'>;

type PlayerPayload = {
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
};

const POSITIONS: NaturalPosition[] = ['F', 'D', 'G'];
const STATUSES: PlayerStatus[] = ['active', 'injured', 'suspended'];

export function PlayerFormScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { activeTeam } = useActiveTeam();
  const playerId = route.params?.playerId;
  const isEditing = Boolean(playerId);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [jerseyNumber, setJerseyNumber] = useState('');
  const [naturalPosition, setNaturalPosition] =
    useState<NaturalPosition | null>(null);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [status, setStatus] = useState<PlayerStatus>('active');
  const [statusNote, setStatusNote] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const playerQuery = useQuery({
    queryKey: ['player', playerId],
    queryFn: async () => {
      if (!playerId) {
        throw new Error(t('playerForm.missingPlayerError'));
      }

      const { data, error: loadError } = await supabase
        .from('players')
        .select(
          'id, team_id, first_name, last_name, jersey_number, natural_position, height, weight, status, status_note, parent_name, parent_phone, emergency_contact_name, emergency_contact_phone, medical_notes, created_at',
        )
        .eq('id', playerId)
        .single();

      if (loadError) {
        throw loadError;
      }

      return data as Player;
    },
    enabled: isEditing,
  });

  useEffect(() => {
    const player = playerQuery.data;

    if (!player) {
      return;
    }

    setFirstName(player.first_name);
    setLastName(player.last_name);
    setJerseyNumber(
      player.jersey_number === null ? '' : String(player.jersey_number),
    );
    setNaturalPosition(player.natural_position);
    setHeight(player.height ?? '');
    setWeight(player.weight ?? '');
    setStatus(player.status);
    setStatusNote(player.status_note ?? '');
    setParentName(player.parent_name ?? '');
    setParentPhone(player.parent_phone ?? '');
    setEmergencyContactName(player.emergency_contact_name ?? '');
    setEmergencyContactPhone(player.emergency_contact_phone ?? '');
    setMedicalNotes(player.medical_notes ?? '');
  }, [playerQuery.data]);

  function nullableText(value: string) {
    const trimmedValue = value.trim();
    return trimmedValue ? trimmedValue : null;
  }

  function buildPayload() {
    if (!activeTeam) {
      setError(t('roster.noActiveTeamTitle'));
      return null;
    }

    if (!firstName.trim() || !lastName.trim() || !naturalPosition) {
      setError(t('playerForm.requiredError'));
      return null;
    }

    const parsedJerseyNumber = jerseyNumber.trim()
      ? Number(jerseyNumber.trim())
      : null;

    if (
      parsedJerseyNumber !== null &&
      (!Number.isInteger(parsedJerseyNumber) ||
        parsedJerseyNumber < 1 ||
        parsedJerseyNumber > 99)
    ) {
      setError(t('playerForm.jerseyNumberError'));
      return null;
    }

    const payload: PlayerPayload = {
      team_id: activeTeam.id,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      jersey_number: parsedJerseyNumber,
      natural_position: naturalPosition,
      height: nullableText(height),
      weight: nullableText(weight),
      status,
      status_note: nullableText(statusNote),
      parent_name: nullableText(parentName),
      parent_phone: nullableText(parentPhone),
      emergency_contact_name: nullableText(emergencyContactName),
      emergency_contact_phone: nullableText(emergencyContactPhone),
      medical_notes: nullableText(medicalNotes),
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

    const { error: saveError } = isEditing && playerId
      ? await supabase.from('players').update(payload).eq('id', playerId)
      : await supabase.from('players').insert(payload);

    if (saveError) {
      if (saveError.code === '23505') {
        setError(t('playerForm.duplicateJerseyError'));
      } else {
        setError(t('playerForm.saveError'));
      }

      setIsSubmitting(false);
      return;
    }

    await queryClient.invalidateQueries({
      queryKey: ['players', activeTeam?.id],
    });
    await queryClient.invalidateQueries({
      queryKey: ['team-dashboard-player-count', activeTeam?.id],
    });
    await queryClient.invalidateQueries({
      queryKey: ['player', playerId],
    });
    setIsSubmitting(false);
    navigation.replace('MainTabs', { screen: 'RosterTab' });
  }

  async function removePlayer() {
    if (!playerId) {
      return;
    }

    setError('');
    setIsSubmitting(true);

    const { error: deleteError } = await supabase
      .from('players')
      .delete()
      .eq('id', playerId);

    if (deleteError) {
      setError(t('playerForm.deleteError'));
      setIsSubmitting(false);
      return;
    }

    await queryClient.invalidateQueries({
      queryKey: ['players', activeTeam?.id],
    });
    await queryClient.invalidateQueries({
      queryKey: ['team-dashboard-player-count', activeTeam?.id],
    });
    setIsSubmitting(false);
    navigation.replace('MainTabs', { screen: 'RosterTab' });
  }

  function confirmRemove() {
    Alert.alert(
      t('playerForm.removeConfirmTitle'),
      t('playerForm.removeConfirmDescription'),
      [
        {
          style: 'cancel',
          text: t('common.cancel'),
        },
        {
          style: 'destructive',
          text: t('playerForm.removeConfirmButton'),
          onPress: () => void removePlayer(),
        },
      ],
    );
  }

  if (!activeTeam) {
    return (
      <AppScreen
        description={t('roster.noActiveTeamDescription')}
        title={t('roster.noActiveTeamTitle')}
      />
    );
  }

  return (
    <AppScreen
      description={t('playerForm.description', {
        teamName: activeTeam.name,
      })}
      title={isEditing ? t('playerForm.editTitle') : t('playerForm.addTitle')}
    >
      {playerQuery.isLoading ? (
        <Text style={appScreenStyles.note}>{t('common.loading')}</Text>
      ) : null}
      {playerQuery.error ? (
        <Text style={appScreenStyles.error}>{t('playerForm.loadError')}</Text>
      ) : null}
      <View style={appScreenStyles.card}>
        <FormField
          autoCapitalize="words"
          label={t('playerForm.firstNameLabel')}
          onChangeText={setFirstName}
          placeholder={t('playerForm.firstNamePlaceholder')}
          value={firstName}
        />
        <FormField
          autoCapitalize="words"
          label={t('playerForm.lastNameLabel')}
          onChangeText={setLastName}
          placeholder={t('playerForm.lastNamePlaceholder')}
          value={lastName}
        />
        <FormField
          keyboardType="number-pad"
          label={t('playerForm.jerseyNumberLabel')}
          onChangeText={setJerseyNumber}
          placeholder={t('playerForm.jerseyNumberPlaceholder')}
          value={jerseyNumber}
        />
        <Selector
          label={t('playerForm.naturalPositionLabel')}
          options={POSITIONS}
          renderLabel={(option) => t(`playerForm.positions.${option}`)}
          value={naturalPosition}
          onChange={setNaturalPosition}
        />
        <FormField
          autoCapitalize="words"
          label={t('playerForm.heightLabel')}
          onChangeText={setHeight}
          placeholder={t('playerForm.heightPlaceholder')}
          value={height}
        />
        <FormField
          autoCapitalize="words"
          label={t('playerForm.weightLabel')}
          onChangeText={setWeight}
          placeholder={t('playerForm.weightPlaceholder')}
          value={weight}
        />
        <Selector
          label={t('playerForm.statusLabel')}
          options={STATUSES}
          renderLabel={(option) => t(`playerForm.statuses.${option}`)}
          value={status}
          onChange={setStatus}
        />
        <FormField
          label={t('playerForm.statusNoteLabel')}
          multiline
          onChangeText={setStatusNote}
          placeholder={t('playerForm.statusNotePlaceholder')}
          style={styles.multiline}
          value={statusNote}
        />
        <FormField
          autoCapitalize="words"
          label={t('playerForm.parentNameLabel')}
          onChangeText={setParentName}
          placeholder={t('playerForm.parentNamePlaceholder')}
          value={parentName}
        />
        <FormField
          keyboardType="phone-pad"
          label={t('playerForm.parentPhoneLabel')}
          onChangeText={setParentPhone}
          placeholder={t('playerForm.parentPhonePlaceholder')}
          value={parentPhone}
        />
        <FormField
          autoCapitalize="words"
          label={t('playerForm.emergencyContactNameLabel')}
          onChangeText={setEmergencyContactName}
          placeholder={t('playerForm.emergencyContactNamePlaceholder')}
          value={emergencyContactName}
        />
        <FormField
          keyboardType="phone-pad"
          label={t('playerForm.emergencyContactPhoneLabel')}
          onChangeText={setEmergencyContactPhone}
          placeholder={t('playerForm.emergencyContactPhonePlaceholder')}
          value={emergencyContactPhone}
        />
        <FormField
          label={t('playerForm.medicalNotesLabel')}
          multiline
          onChangeText={setMedicalNotes}
          placeholder={t('playerForm.medicalNotesPlaceholder')}
          style={styles.multiline}
          value={medicalNotes}
        />
        {error ? <Text style={authStyles.error}>{error}</Text> : null}
        <Button
          color={goalRed}
          disabled={isSubmitting || playerQuery.isLoading}
          title={
            isSubmitting
              ? t('playerForm.saving')
              : t('playerForm.saveButton')
          }
          onPress={() => void handleSave()}
        />
        {isEditing ? (
          <Button
            color={goalRed}
            disabled={isSubmitting}
            title={t('playerForm.removeButton')}
            onPress={confirmRemove}
          />
        ) : null}
      </View>
    </AppScreen>
  );
}

type SelectorProps<T extends string> = {
  label: string;
  options: T[];
  value: T | null;
  renderLabel: (value: T) => string;
  onChange: (value: T) => void;
};

function Selector<T extends string>({
  label,
  options,
  value,
  renderLabel,
  onChange,
}: SelectorProps<T>) {
  return (
    <View style={styles.selectorGroup}>
      <Text style={styles.selectorLabel}>{label}</Text>
      <View style={styles.selectorOptions}>
        {options.map((option) => {
          const isSelected = value === option;

          return (
            <Pressable
              accessibilityRole="button"
              key={option}
              onPress={() => onChange(option)}
              style={[styles.selectorOption, isSelected && styles.selected]}
            >
              <Text
                style={[
                  styles.selectorOptionText,
                  isSelected && styles.selectedText,
                ]}
              >
                {renderLabel(option)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  multiline: {
    minHeight: 96,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  selected: {
    backgroundColor: colors.cardPressed,
    borderColor: goalRed,
  },
  selectedText: {
    color: goalRed,
  },
  selectorGroup: {
    gap: 7,
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
  selectorOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectorOptionText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
});
