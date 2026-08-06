import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Button, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { getFunctionErrorMessage } from '../auth/onboarding';
import { pendingOnboarding } from '../auth/pendingOnboarding';
import {
  AuthFooterLink,
  AuthScreen,
  FormField,
  authStyles,
} from '../components/AuthScreen';
import type { AuthStackParamList } from '../navigation/types';
import { goalRed } from '../theme/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'AssistantCoachSignup'>;

export function AssistantCoachSignupScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const {
    session,
    beginOnboarding,
    endOnboarding,
  } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [teamJoinCode, setTeamJoinCode] = useState('');
  const [error, setError] = useState('');
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasPendingConfirmation = Boolean(confirmationMessage);

  async function handleContinue() {
    const trimmedEmail = email.trim();
    const trimmedTeamJoinCode = teamJoinCode.trim();

    if (!trimmedEmail || !password || !trimmedTeamJoinCode) {
      setError(t('assistantCoachSignup.requiredError'));
      return;
    }

    setError('');
    setConfirmationMessage('');
    setIsSubmitting(true);
    beginOnboarding();

    let activeSession = session;

    if (!activeSession) {
      const { data, error: signupError } = await supabase.auth.signUp({
        email: trimmedEmail,
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
          type: 'assistant_join_team',
          payload: { teamJoinCode: trimmedTeamJoinCode },
        });
      } catch {
        setError(t('common.pendingOnboardingSaveError'));
        setIsSubmitting(false);
        endOnboarding();
        return;
      }

      setConfirmationMessage(
        t('assistantCoachSignup.confirmationPendingMessage'),
      );
      setIsSubmitting(false);
      endOnboarding();
      return;
    }

    const { error: functionError } = await supabase.functions.invoke(
      'join-team-as-assistant',
      {
        body: { team_join_code: trimmedTeamJoinCode },
        headers: {
          Authorization: `Bearer ${activeSession.access_token}`,
        },
      },
    );

    if (functionError) {
      const message = await getFunctionErrorMessage(functionError);

      if (message === 'Invalid team join code.') {
        setError(t('assistantCoachSignup.invalidCodeError'));
      } else {
        setError(message ?? t('assistantCoachSignup.onboardingError'));
      }

      setIsSubmitting(false);
      return;
    }

    endOnboarding();
  }

  return (
    <AuthScreen
      description={t('assistantCoachSignup.description')}
      footer={
        <AuthFooterLink onPress={() => navigation.navigate('SignIn')} />
      }
      title={t('assistantCoachSignup.title')}
    >
      <FormField
        autoComplete="email"
        keyboardType="email-address"
        label={t('assistantCoachSignup.emailLabel')}
        onChangeText={setEmail}
        placeholder={t('assistantCoachSignup.emailPlaceholder')}
        textContentType="emailAddress"
        value={email}
      />
      <FormField
        autoComplete="new-password"
        label={t('assistantCoachSignup.passwordLabel')}
        onChangeText={setPassword}
        placeholder={t('assistantCoachSignup.passwordPlaceholder')}
        secureTextEntry
        textContentType="newPassword"
        value={password}
      />
      <FormField
        autoCapitalize="characters"
        label={t('assistantCoachSignup.teamJoinCodeLabel')}
        onChangeText={setTeamJoinCode}
        placeholder={t('assistantCoachSignup.teamJoinCodePlaceholder')}
        value={teamJoinCode}
      />
      {error ? <Text style={authStyles.error}>{error}</Text> : null}
      {confirmationMessage ? (
        <Text style={authStyles.note}>{confirmationMessage}</Text>
      ) : null}
      <Button
        color={goalRed}
        disabled={isSubmitting}
        title={
          hasPendingConfirmation
            ? t('authFooter.signIn')
            : isSubmitting
            ? t('assistantCoachSignup.submitting')
            : t('assistantCoachSignup.submit')
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
