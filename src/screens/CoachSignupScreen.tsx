import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Button, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import {
  AuthFooterLink,
  AuthScreen,
  FormField,
  authStyles,
} from '../components/AuthScreen';
import type { AuthStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'CoachSignup'>;

export function CoachSignupScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasPendingConfirmation = Boolean(confirmationMessage);

  async function handleContinue() {
    if (!email.trim() || !password) {
      setError(t('coachSignup.requiredError'));
      return;
    }

    setError('');
    setConfirmationMessage('');
    setIsSubmitting(true);

    const { data, error: signupError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (signupError) {
      setError(signupError.message);
      setIsSubmitting(false);
      return;
    }

    if (!data.session) {
      setConfirmationMessage(t('coachSignup.confirmationPendingMessage'));
    }

    setIsSubmitting(false);
  }

  return (
    <AuthScreen
      description={t('coachSignup.description')}
      footer={
        <AuthFooterLink onPress={() => navigation.navigate('SignIn')} />
      }
      title={t('coachSignup.title')}
    >
      <FormField
        autoComplete="email"
        keyboardType="email-address"
        label={t('coachSignup.emailLabel')}
        onChangeText={setEmail}
        placeholder={t('coachSignup.emailPlaceholder')}
        textContentType="emailAddress"
        value={email}
      />
      <FormField
        autoComplete="new-password"
        label={t('coachSignup.passwordLabel')}
        onChangeText={setPassword}
        placeholder={t('coachSignup.passwordPlaceholder')}
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
          hasPendingConfirmation
            ? t('authFooter.signIn')
            : isSubmitting
            ? t('coachSignup.submitting')
            : t('coachSignup.submit')
        }
        onPress={() => {
          if (hasPendingConfirmation) {
            navigation.navigate('SignIn');
            return;
          }

          void handleContinue();
        }}
      />
    </AuthScreen>
  );
}
