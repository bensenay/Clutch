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

export function DirectorSignupScreen() {
  const { t } = useTranslation();
  const {
    session,
    beginOnboarding,
    endOnboarding,
  } = useAuth();
  const [name, setName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleContinue() {
    if (!name.trim() || !organizationName.trim() || !email.trim() || !password) {
      setError(t('directorSignup.requiredError'));
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
          type: 'director',
          payload: { organizationName: organizationName.trim() },
        });
      } catch {
        setError(t('common.pendingOnboardingSaveError'));
        setIsSubmitting(false);
        endOnboarding();
        return;
      }

      setConfirmationMessage(t('directorSignup.confirmationPendingMessage'));
      setIsSubmitting(false);
      endOnboarding();
      return;
    }

    const { error: functionError } = await supabase.functions.invoke(
      'create-organization',
      {
        body: { organizationName: organizationName.trim() },
        headers: {
          Authorization: `Bearer ${activeSession.access_token}`,
        },
      },
    );

    if (functionError) {
      const message = await getFunctionErrorMessage(functionError);
      setError(message ?? t('directorSignup.onboardingError'));
      setIsSubmitting(false);
      return;
    }

    endOnboarding();
  }

  return (
    <AuthScreen
      description={t('directorSignup.description')}
      title={t('directorSignup.title')}
    >
      <FormField
        autoCapitalize="words"
        autoComplete="name"
        label={t('directorSignup.nameLabel')}
        onChangeText={setName}
        placeholder={t('directorSignup.namePlaceholder')}
        textContentType="name"
        value={name}
      />
      <FormField
        autoCapitalize="words"
        label={t('directorSignup.organizationLabel')}
        onChangeText={setOrganizationName}
        placeholder={t('directorSignup.organizationPlaceholder')}
        value={organizationName}
      />
      <FormField
        autoComplete="email"
        keyboardType="email-address"
        label={t('directorSignup.emailLabel')}
        onChangeText={setEmail}
        placeholder={t('directorSignup.emailPlaceholder')}
        textContentType="emailAddress"
        value={email}
      />
      <FormField
        autoComplete="new-password"
        label={t('directorSignup.passwordLabel')}
        onChangeText={setPassword}
        placeholder={t('directorSignup.passwordPlaceholder')}
        secureTextEntry
        textContentType="newPassword"
        value={password}
      />
      {error ? <Text style={authStyles.error}>{error}</Text> : null}
      {confirmationMessage ? (
        <Text style={authStyles.note}>{confirmationMessage}</Text>
      ) : null}
      <Button
        disabled={isSubmitting}
        title={
          isSubmitting
            ? t('directorSignup.submitting')
            : t('directorSignup.submit')
        }
        onPress={() => void handleContinue()}
      />
    </AuthScreen>
  );
}
