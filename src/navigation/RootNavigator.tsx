import { NavigationContainer } from '@react-navigation/native';
import {
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { ActiveTeamProvider } from '../teams/ActiveTeamContext';
import { AuthenticatedStack } from './AuthenticatedStack';
import { AuthStack } from './AuthStack';

export function RootNavigator() {
  const { session, isLoading, isOnboarding } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#b8442f" size="large" />
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
      <NavigationContainer>
        <AuthenticatedStack />
      </NavigationContainer>
    </ActiveTeamProvider>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    backgroundColor: '#f4f6f3',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 24,
  },
});
