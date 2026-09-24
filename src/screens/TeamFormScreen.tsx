import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { AppButton } from '../components/AppButton';
import { AppScreen, appScreenStyles } from '../components/AppScreen';
import { FormField, authStyles } from '../components/AuthScreen';
import type { AuthenticatedStackParamList } from '../navigation/types';
import { isLikelyNetworkError } from '../offline/cache';
import { useActiveTeam, type ActiveTeam } from '../teams/ActiveTeamContext';

type Props = NativeStackScreenProps<AuthenticatedStackParamList, 'TeamForm'>;

type DirectorProfile = {
  role: 'super_admin' | 'director' | 'coach';
  school_id: string | null;
};

export function TeamFormScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const { setActiveTeam } = useActiveTeam();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [level, setLevel] = useState('');
  const [season, setSeason] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const profileQuery = useQuery({
    queryKey: ['team-form-profile', session?.user.id],
    queryFn: async () => {
      if (!session) {
        throw new Error(t('home.noSessionError'));
      }

      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('role, school_id')
        .eq('id', session.user.id)
        .single();

      if (profileError) {
        throw profileError;
      }

      return data as DirectorProfile;
    },
    enabled: Boolean(session),
  });

  async function createTeam() {
    const profile = profileQuery.data;

    if (profile?.role !== 'director' || !profile.school_id) {
      setError(t('teamForm.directorOnlyError'));
      return;
    }

    if (!name.trim()) {
      setError(t('teamForm.nameRequiredError'));
      return;
    }

    setError('');
    setIsSaving(true);

    const { data, error: saveError } = await supabase
      .from('teams')
      .insert({
        school_id: profile.school_id,
        name: name.trim(),
        level: level.trim() || null,
        season: season.trim() || null,
      })
      .select(
        'id, name, level, season, primary_color, secondary_color, tertiary_color, logo_url',
      )
      .single();

    if (saveError) {
      setError(
        isLikelyNetworkError(saveError)
          ? t('offline.writeBlocked')
          : saveError.code === '23505'
            ? t('teamForm.duplicateNameError')
            : t('teamForm.saveError'),
      );
      setIsSaving(false);
      return;
    }

    setActiveTeam(data as ActiveTeam);
    await queryClient.invalidateQueries({ queryKey: ['director-teams'] });
    setIsSaving(false);
    navigation.replace('Dashboard');
  }

  if (profileQuery.isLoading) {
    return (
      <AppScreen title={t('teamForm.title')}>
        <Text style={appScreenStyles.note}>{t('common.loading')}</Text>
      </AppScreen>
    );
  }

  if (profileQuery.data?.role !== 'director') {
    return (
      <AppScreen
        description={t('directorOnly.description')}
        title={t('directorOnly.title')}
      />
    );
  }

  return (
    <AppScreen
      description={t('teamForm.description')}
      title={t('teamForm.title')}
    >
      <View style={appScreenStyles.card}>
        <FormField
          autoCapitalize="words"
          label={t('teamForm.nameLabel')}
          onChangeText={setName}
          placeholder={t('teamForm.namePlaceholder')}
          value={name}
        />
        <FormField
          autoCapitalize="words"
          label={t('teamForm.levelLabel')}
          onChangeText={setLevel}
          placeholder={t('teamForm.levelPlaceholder')}
          value={level}
        />
        <FormField
          autoCapitalize="words"
          label={t('teamForm.seasonLabel')}
          onChangeText={setSeason}
          placeholder={t('teamForm.seasonPlaceholder')}
          value={season}
        />
        {error ? <Text style={authStyles.error}>{error}</Text> : null}
        <AppButton
          disabled={isSaving}
          icon="shield-checkmark-outline"
          title={isSaving ? t('teamForm.saving') : t('teamForm.saveButton')}
          onPress={() => void createTeam()}
        />
      </View>
    </AppScreen>
  );
}
