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

export function IndependentCoachSignupScreen() {
  const { t } = useTranslation();
  const {
    session,
    beginOnboarding,
    endOnboarding,
  } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [teamName, setTeamName] = useState('');
  const [error, setError] = useState('');
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleContinue() {
    if (!name.trim() || !email.trim() || !password || !teamName.trim()) {
      setError(t('independentCoachSignup.requiredError'));
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
          type: 'independent',
          payload: { teamName: teamName.trim() },
        });
      } catch {
        setError(t('common.pendingOnboardingSaveError'));
        setIsSubmitting(false);
        endOnboarding();
        return;
      }

      setConfirmationMessage(
        t('independentCoachSignup.confirmationPendingMessage'),
      );
      setIsSubmitting(false);
      endOnboarding();
      return;
    }

    const { error: functionError } = await supabase.functions.invoke(
      'create-independent-coach',
      {
        body: { teamName: teamName.trim() },
        headers: {
          Authorization: `Bearer ${activeSession.access_token}`,
        },
      },
    );

    if (functionError) {
      const message = await getFunctionErrorMessage(functionError);
      setError(message ?? t('independentCoachSignup.onboardingError'));
      setIsSubmitting(false);
      return;
    }

    endOnboarding();
  }

  return (
    <AuthScreen
      description={t('independentCoachSignup.description')}
      title={t('independentCoachSignup.title')}
    >
      <FormField
        autoCapitalize="words"
        autoComplete="name"
        label={t('independentCoachSignup.nameLabel')}
        onChangeText={setName}
        placeholder={t('independentCoachSignup.namePlaceholder')}
        textContentType="name"
        value={name}
      />
      <FormField
        autoComplete="email"
        keyboardType="email-address"
        label={t('independentCoachSignup.emailLabel')}
        onChangeText={setEmail}
        placeholder={t('independentCoachSignup.emailPlaceholder')}
        textContentType="emailAddress"
        value={email}
      />
      <FormField
        autoComplete="new-password"
        label={t('independentCoachSignup.passwordLabel')}
        onChangeText={setPassword}
        placeholder={t('independentCoachSignup.passwordPlaceholder')}
        secureTextEntry
        textContentType="newPassword"
        value={password}
      />
      <FormField
        autoCapitalize="words"
        label={t('independentCoachSignup.teamNameLabel')}
        onChangeText={setTeamName}
        placeholder={t('independentCoachSignup.teamNamePlaceholder')}
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
            ? t('independentCoachSignup.submitting')
            : t('independentCoachSignup.submit')
        }
        onPress={() => void handleContinue()}
      />
    </AuthScreen>
  );
}
