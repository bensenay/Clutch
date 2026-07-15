import { NavigationContainer } from '@react-navigation/native';
import type { Session } from '@supabase/supabase-js';
import {
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { AppScreen, appScreenStyles } from '../components/AppScreen';
import { CompleteCoachOnboardingScreen } from '../screens/CompleteCoachOnboardingScreen';
import { ActiveTeamProvider } from '../teams/ActiveTeamContext';
import { goalRed, rinkNavy } from '../theme/theme';
import { AuthenticatedStack } from './AuthenticatedStack';
import { AuthStack } from './AuthStack';

type ProfileGate = {
  role: 'super_admin' | 'director' | 'coach';
  school_id: string | null;
};

export function RootNavigator() {
  const { session, isLoading, isOnboarding } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={goalRed} size="large" />
      </View>
    );
  }

  if (!session || isOnboarding) {
    return (
      <NavigationContainer>
        <AuthStack />
      </NavigationContainer>
    );
  }

  return (
    <ActiveTeamProvider>
      <AuthenticatedGate session={session} />
    </ActiveTeamProvider>
  );
}

function AuthenticatedGate({ session }: { session: Session }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const profileQuery = useQuery({
    queryKey: ['profile-gate', session.user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('role, school_id')
        .eq('id', session.user.id)
        .single();

      if (error) {
        throw error;
      }

      return data as ProfileGate;
    },
  });

  if (profileQuery.isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={goalRed} size="large" />
      </View>
    );
  }

  if (profileQuery.error || !profileQuery.data) {
    return (
      <AppScreen title={t('home.title')}>
        <Text style={appScreenStyles.error}>{t('home.profileError')}</Text>
      </AppScreen>
    );
  }

  if (
    profileQuery.data.role === 'coach' &&
    profileQuery.data.school_id === null
  ) {
    return (
      <CompleteCoachOnboardingScreen
        onCompleted={() => {
          void queryClient.invalidateQueries({
            queryKey: ['profile-gate', session.user.id],
          });
        }}
      />
    );
  }

  return (
    <NavigationContainer>
      <AuthenticatedStack />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    backgroundColor: rinkNavy,
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 24,
  },
});
