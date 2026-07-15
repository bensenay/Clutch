import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Button, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import {
  AuthScreen,
  FormField,
  authStyles,
} from '../components/AuthScreen';
import type { AuthStackParamList } from '../navigation/types';
import { goalRed } from '../theme/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;

export function SignInScreen(_props: Props) {
  const { t } = useTranslation();
  const {
    isResolvingOnboarding,
    onboardingError,
    clearOnboardingError,
  } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSignIn() {
    const normalizedEmail = email.trim();

    if (!normalizedEmail || !password) {
      setError(t('signIn.missingCredentialsError'));
      return;
    }

    setError('');
    clearOnboardingError();
    setIsSubmitting(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (signInError) {
      setError(signInError.message);
    }

    setIsSubmitting(false);
  }

  return (
    <AuthScreen
      description={t('signIn.description')}
      title={t('signIn.title')}
    >
      <FormField
        autoComplete="email"
        keyboardType="email-address"
        label={t('signIn.emailLabel')}
        onChangeText={setEmail}
        placeholder={t('signIn.emailPlaceholder')}
        textContentType="emailAddress"
        value={email}
      />
      <FormField
        autoComplete="current-password"
        label={t('signIn.passwordLabel')}
        onChangeText={setPassword}
        placeholder={t('signIn.passwordPlaceholder')}
        secureTextEntry
        textContentType="password"
        value={password}
      />
      {error ? <Text style={authStyles.error}>{error}</Text> : null}
      {!error && onboardingError ? (
        <Text style={authStyles.error}>{onboardingError}</Text>
      ) : null}
      <Button
        color={goalRed}
        disabled={isSubmitting || isResolvingOnboarding}
        title={
          isSubmitting || isResolvingOnboarding
            ? t('signIn.submitting')
            : t('signIn.submit')
        }
        onPress={() => void handleSignIn()}
      />
    </AuthScreen>
  );
}
