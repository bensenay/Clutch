import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Button, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { AppScreen, appScreenStyles } from '../components/AppScreen';

type Profile = {
  role: 'super_admin' | 'director' | 'coach';
  school_id: string | null;
};

type School = {
  id: string;
  name: string | null;
  join_code: string | null;
};

const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateJoinCode() {
  return Array.from({ length: 8 }, () =>
    JOIN_CODE_ALPHABET[Math.floor(Math.random() * JOIN_CODE_ALPHABET.length)],
  ).join('');
}

function isDuplicateJoinCodeError(error: { code?: string; message?: string }) {
  return (
    error.code === '23505' ||
    error.message?.toLowerCase().includes('duplicate') ||
    error.message?.toLowerCase().includes('unique')
  );
}

export function DirectorSettingsScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const profileQuery = useQuery({
    queryKey: ['profile', session?.user.id],
    queryFn: async () => {
      if (!session) {
        throw new Error(t('home.noSessionError'));
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('role, school_id')
        .eq('id', session.user.id)
        .single();

      if (error) {
        throw error;
      }

      return data as Profile;
    },
    enabled: Boolean(session),
  });

  const profile = profileQuery.data;
  const schoolQuery = useQuery({
    queryKey: ['school', profile?.school_id],
    queryFn: async () => {
      if (!profile?.school_id) {
        throw new Error(t('directorSettings.noSchoolError'));
      }

      const { data, error } = await supabase
        .from('schools')
        .select('id, name, join_code')
        .eq('id', profile.school_id)
        .single();

      if (error) {
        throw error;
      }

      return data as School;
    },
    enabled: profile?.role === 'director' && Boolean(profile.school_id),
  });

  async function regenerateCode() {
    if (!schoolQuery.data) {
      return;
    }

    setIsRegenerating(true);
    setMessage('');
    setErrorMessage('');

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const nextCode = generateJoinCode();
      const { data, error } = await supabase
        .from('schools')
        .update({ join_code: nextCode })
        .eq('id', schoolQuery.data.id)
        .select('id, name, join_code')
        .single();

      if (!error) {
        queryClient.setQueryData(['school', schoolQuery.data.id], data);
        await queryClient.invalidateQueries({
          queryKey: ['school', schoolQuery.data.id],
        });
        setMessage(t('directorSettings.regenerateSuccess'));
        setIsRegenerating(false);
        return;
      }

      if (!isDuplicateJoinCodeError(error)) {
        setErrorMessage(t('directorSettings.regenerateError'));
        setIsRegenerating(false);
        return;
      }
    }

    setErrorMessage(t('directorSettings.regenerateDuplicateError'));
    setIsRegenerating(false);
  }

  function confirmRegenerate() {
    Alert.alert(
      t('directorSettings.confirmTitle'),
      t('directorSettings.confirmDescription'),
      [
        {
          style: 'cancel',
          text: t('common.cancel'),
        },
        {
          style: 'destructive',
          text: t('directorSettings.confirmButton'),
          onPress: () => void regenerateCode(),
        },
      ],
    );
  }

  if (profileQuery.isLoading) {
    return (
      <AppScreen title={t('directorSettings.title')}>
        <Text style={appScreenStyles.note}>{t('common.loading')}</Text>
      </AppScreen>
    );
  }

  if (profile?.role !== 'director') {
    return (
      <AppScreen
        description={t('directorOnly.description')}
        title={t('directorOnly.title')}
      />
    );
  }

  return (
    <AppScreen
      description={t('directorSettings.description')}
      title={t('directorSettings.title')}
    >
      {schoolQuery.isLoading ? (
        <Text style={appScreenStyles.note}>{t('common.loading')}</Text>
      ) : null}
      {schoolQuery.error ? (
        <Text style={appScreenStyles.error}>
          {t('directorSettings.loadError')}
        </Text>
      ) : null}
      {schoolQuery.data ? (
        <View style={appScreenStyles.card}>
          <Text style={appScreenStyles.cardTitle}>
            {t('directorSettings.joinCodeTitle')}
          </Text>
          <Text style={appScreenStyles.cardDescription}>
            {t('directorSettings.joinCodeDescription')}
          </Text>
          <Text style={appScreenStyles.cardTitle}>
            {schoolQuery.data.join_code ?? t('common.notSet')}
          </Text>
          {message ? (
            <Text style={appScreenStyles.note}>{message}</Text>
          ) : null}
          {errorMessage ? (
            <Text style={appScreenStyles.error}>{errorMessage}</Text>
          ) : null}
          <Button
            disabled={isRegenerating}
            title={
              isRegenerating
                ? t('directorSettings.regenerating')
                : t('directorSettings.regenerateButton')
            }
            onPress={confirmRegenerate}
          />
        </View>
      ) : null}
    </AppScreen>
  );
}
