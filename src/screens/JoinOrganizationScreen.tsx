import { useState } from 'react';
import { Button, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { getFunctionErrorMessage } from '../auth/onboarding';
import { pendingOnboarding } from '../auth/pendingOnboarding';
import {
  AuthScreen,
  FormField,
  authStyles,
} from '../components/AuthScreen';

export function JoinOrganizationScreen() {
  const { t } = useTranslation();
  const {
    session,
    beginOnboarding,
    endOnboarding,
  } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [error, setError] = useState('');
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleContinue() {
    if (
      !name.trim() ||
      !email.trim() ||
      !password ||
      !joinCode.trim() ||
      !teamName.trim()
    ) {
      setError(t('joinOrganization.requiredError'));
      return;
    }

    setError('');
    setConfirmationMessage('');
    setIsSubmitting(true);
    beginOnboarding();

    let activeSession = session;

    if (!activeSession) {
      const { data, error: signupError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (signupError) {
        setError(signupError.message);
        setIsSubmitting(false);
        endOnboarding();
        return;
      }

      activeSession = data.session;
    }

    if (!activeSession) {
      try {
        await pendingOnboarding.save({
          type: 'join',
          payload: {
            joinCode: joinCode.trim(),
            teamName: teamName.trim(),
          },
        });
      } catch {
        setError(t('common.pendingOnboardingSaveError'));
        setIsSubmitting(false);
        endOnboarding();
        return;
      }

      setConfirmationMessage(
        t('joinOrganization.confirmationPendingMessage'),
      );
      setIsSubmitting(false);
      endOnboarding();
      return;
    }

    const { error: functionError } = await supabase.functions.invoke(
      'join-organization',
      {
        body: {
          joinCode: joinCode.trim(),
          teamName: teamName.trim(),
        },
        headers: {
          Authorization: `Bearer ${activeSession.access_token}`,
        },
      },
    );

    if (functionError) {
      const message = await getFunctionErrorMessage(functionError);

      if (message === 'Invalid organization join code.') {
        setError(t('joinOrganization.invalidCodeError'));
      } else if (message === 'This organization is currently suspended.') {
        setError(t('joinOrganization.suspendedError'));
      } else {
        setError(message ?? t('joinOrganization.onboardingError'));
      }

      setIsSubmitting(false);
      return;
    }

    endOnboarding();
  }

  return (
    <AuthScreen
      description={t('joinOrganization.description')}
      title={t('joinOrganization.title')}
    >
      <FormField
        autoCapitalize="words"
        autoComplete="name"
        label={t('joinOrganization.nameLabel')}
        onChangeText={setName}
        placeholder={t('joinOrganization.namePlaceholder')}
        textContentType="name"
        value={name}
      />
      <FormField
        autoComplete="email"
        keyboardType="email-address"
        label={t('joinOrganization.emailLabel')}
        onChangeText={setEmail}
        placeholder={t('joinOrganization.emailPlaceholder')}
        textContentType="emailAddress"
        value={email}
      />
      <FormField
        autoComplete="new-password"
        label={t('joinOrganization.passwordLabel')}
        onChangeText={setPassword}
        placeholder={t('joinOrganization.passwordPlaceholder')}
        secureTextEntry
        textContentType="newPassword"
        value={password}
      />
      <FormField
        autoCapitalize="characters"
        label={t('joinOrganization.joinCodeLabel')}
        onChangeText={setJoinCode}
        placeholder={t('joinOrganization.joinCodePlaceholder')}
        value={joinCode}
      />
      <FormField
        autoCapitalize="words"
        label={t('joinOrganization.teamNameLabel')}
        onChangeText={setTeamName}
        placeholder={t('joinOrganization.teamNamePlaceholder')}
        value={teamName}
      />
      {error ? <Text style={authStyles.error}>{error}</Text> : null}
      {confirmationMessage ? (
        <Text style={authStyles.note}>{confirmationMessage}</Text>
      ) : null}
      <Button
        disabled={isSubmitting}
        title={
          isSubmitting
            ? t('joinOrganization.submitting')
            : t('joinOrganization.submit')
        }
        onPress={() => void handleContinue()}
      />
    </AuthScreen>
  );
}
