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
import { goalRed } from '../theme/theme';

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
  const [teamOptions, setTeamOptions] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);

  async function loadOrganizationTeams() {
    if (!joinCode.trim()) {
      setError(t('completeCoachOnboarding.codeRequiredError'));
      return;
    }

    if (!session) {
      setError(t('home.noSessionError'));
      return;
    }

    setError('');
    setIsLoadingTeams(true);
    const { data, error: functionError } = await supabase.functions.invoke<{
      teams: string[];
    }>('join-organization', {
      body: { action: 'list_teams', joinCode: joinCode.trim() },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (functionError) {
      const message = await getFunctionErrorMessage(functionError);
      setError(
        message === 'Invalid organization join code.'
          ? t('completeCoachOnboarding.invalidCodeError')
          : message ?? t('completeCoachOnboarding.teamsLoadError'),
      );
      setIsLoadingTeams(false);
      return;
    }

    setTeamOptions(data?.teams ?? []);
    setIsLoadingTeams(false);
  }

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
    setTeamOptions([]);
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
            onChangeText={(value) => {
              setJoinCode(value);
              setTeamOptions([]);
            }}
            placeholder={t('completeCoachOnboarding.joinCodePlaceholder')}
            value={joinCode}
          />
          <Button
            color={goalRed}
            disabled={isLoadingTeams || isSubmitting}
            title={
              isLoadingTeams
                ? t('common.loading')
                : t('completeCoachOnboarding.findTeamsButton')
            }
            onPress={() => void loadOrganizationTeams()}
          />
          {teamOptions.length > 0 ? (
            <View style={appScreenStyles.list}>
              <Text style={appScreenStyles.cardDescription}>
                {t('completeCoachOnboarding.existingTeamsLabel')}
              </Text>
              {teamOptions.map((option) => (
                <ChoiceButton
                  description={
                    option === teamName
                      ? t('completeCoachOnboarding.selectedTeamDescription')
                      : t('completeCoachOnboarding.existingTeamDescription')
                  }
                  key={option}
                  title={option}
                  onPress={() => setTeamName(option)}
                />
              ))}
            </View>
          ) : null}
          <FormField
            autoCapitalize="words"
            label={t('completeCoachOnboarding.teamNameLabel')}
            onChangeText={setTeamName}
            placeholder={t('completeCoachOnboarding.teamNamePlaceholder')}
            value={teamName}
          />
          {error ? <Text style={authStyles.error}>{error}</Text> : null}
          <Button
            color={goalRed}
            disabled={isSubmitting}
            title={
              isSubmitting
                ? t('completeCoachOnboarding.joinSubmitting')
                : t('completeCoachOnboarding.joinSubmit')
            }
            onPress={() => void handleJoinOrganization()}
          />
          <Button
            color={goalRed}
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
            color={goalRed}
            disabled={isSubmitting}
            title={
              isSubmitting
                ? t('completeCoachOnboarding.independentSubmitting')
                : t('completeCoachOnboarding.independentSubmit')
            }
            onPress={() => void handleCreateIndependentTeam()}
          />
          <Button
            color={goalRed}
            disabled={isSubmitting}
            title={t('common.back')}
            onPress={resetChoice}
          />
        </View>
      ) : null}
    </AppScreen>
  );
}
