import { useState } from 'react';
import { Button, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { getFunctionErrorMessage } from '../auth/onboarding';
import { AppScreen, appScreenStyles } from '../components/AppScreen';
import {
  FormField,
  authStyles,
} from '../components/AuthScreen';
import { ChoiceButton } from '../components/ChoiceButton';

type OnboardingMode = 'join' | 'independent' | null;

type CompleteCoachOnboardingScreenProps = {
  onCompleted: () => void;
};

export function CompleteCoachOnboardingScreen({
  onCompleted,
}: CompleteCoachOnboardingScreenProps) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const [mode, setMode] = useState<OnboardingMode>(null);
  const [joinCode, setJoinCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleJoinOrganization() {
    if (!joinCode.trim() || !teamName.trim()) {
      setError(t('completeCoachOnboarding.joinRequiredError'));
      return;
    }

    if (!session) {
      setError(t('home.noSessionError'));
      return;
    }

    setError('');
    setIsSubmitting(true);

    const { error: functionError } = await supabase.functions.invoke(
      'join-organization',
      {
        body: {
          joinCode: joinCode.trim(),
          teamName: teamName.trim(),
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      },
    );

    if (functionError) {
      const message = await getFunctionErrorMessage(functionError);

      if (message === 'Invalid organization join code.') {
        setError(t('completeCoachOnboarding.invalidCodeError'));
      } else if (message === 'This organization is currently suspended.') {
        setError(t('completeCoachOnboarding.suspendedError'));
      } else {
        setError(message ?? t('completeCoachOnboarding.joinError'));
      }

      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    onCompleted();
  }

  async function handleCreateIndependentTeam() {
    if (!teamName.trim()) {
      setError(t('completeCoachOnboarding.independentRequiredError'));
      return;
    }

    if (!session) {
      setError(t('home.noSessionError'));
      return;
    }

    setError('');
    setIsSubmitting(true);

    const { error: functionError } = await supabase.functions.invoke(
      'create-independent-coach',
      {
        body: { teamName: teamName.trim() },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      },
    );

    if (functionError) {
      const message = await getFunctionErrorMessage(functionError);
      setError(message ?? t('completeCoachOnboarding.independentError'));
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    onCompleted();
  }

  function resetChoice() {
    setMode(null);
    setError('');
    setJoinCode('');
    setTeamName('');
  }

  return (
    <AppScreen
      description={t('completeCoachOnboarding.description')}
      title={t('completeCoachOnboarding.title')}
    >
      {!mode ? (
        <View style={appScreenStyles.list}>
          <ChoiceButton
            description={t('completeCoachOnboarding.joinDescription')}
            title={t('completeCoachOnboarding.joinTitle')}
            onPress={() => setMode('join')}
          />
          <ChoiceButton
            description={t('completeCoachOnboarding.independentDescription')}
            title={t('completeCoachOnboarding.independentTitle')}
            onPress={() => setMode('independent')}
          />
        </View>
      ) : null}
      {mode === 'join' ? (
        <View style={appScreenStyles.card}>
          <Text style={appScreenStyles.cardTitle}>
            {t('completeCoachOnboarding.joinTitle')}
          </Text>
          <Text style={appScreenStyles.cardDescription}>
            {t('completeCoachOnboarding.joinFormDescription')}
          </Text>
          <FormField
            autoCapitalize="characters"
            label={t('completeCoachOnboarding.joinCodeLabel')}
            onChangeText={setJoinCode}
            placeholder={t('completeCoachOnboarding.joinCodePlaceholder')}
            value={joinCode}
          />
          <FormField
            autoCapitalize="words"
            label={t('completeCoachOnboarding.teamNameLabel')}
            onChangeText={setTeamName}
            placeholder={t('completeCoachOnboarding.teamNamePlaceholder')}
            value={teamName}
          />
          {error ? <Text style={authStyles.error}>{error}</Text> : null}
          <Button
            disabled={isSubmitting}
            title={
              isSubmitting
                ? t('completeCoachOnboarding.joinSubmitting')
                : t('completeCoachOnboarding.joinSubmit')
            }
            onPress={() => void handleJoinOrganization()}
          />
          <Button
            disabled={isSubmitting}
            title={t('common.back')}
            onPress={resetChoice}
          />
        </View>
      ) : null}
      {mode === 'independent' ? (
        <View style={appScreenStyles.card}>
          <Text style={appScreenStyles.cardTitle}>
            {t('completeCoachOnboarding.independentTitle')}
          </Text>
          <Text style={appScreenStyles.cardDescription}>
            {t('completeCoachOnboarding.independentFormDescription')}
          </Text>
          <FormField
            autoCapitalize="words"
            label={t('completeCoachOnboarding.teamNameLabel')}
            onChangeText={setTeamName}
            placeholder={t('completeCoachOnboarding.independentTeamPlaceholder')}
            value={teamName}
          />
          {error ? <Text style={authStyles.error}>{error}</Text> : null}
          <Button
            disabled={isSubmitting}
            title={
              isSubmitting
                ? t('completeCoachOnboarding.independentSubmitting')
                : t('completeCoachOnboarding.independentSubmit')
            }
            onPress={() => void handleCreateIndependentTeam()}
          />
          <Button
            disabled={isSubmitting}
            title={t('common.back')}
            onPress={resetChoice}
          />
        </View>
      ) : null}
    </AppScreen>
  );
}
