import { NavigationContainer } from '@react-navigation/native';
import { useState } from 'react';
import {
  ActivityIndicator,
  Button,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { AuthStack } from './AuthStack';

export function RootNavigator() {
  const { session, isLoading, isOnboarding, signOut } = useAuth();
  const [signOutError, setSignOutError] = useState('');

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

  async function handleSignOut() {
    setSignOutError('');

    try {
      await signOut();
    } catch (error) {
      setSignOutError(
        error instanceof Error ? error.message : 'Unable to sign out.',
      );
    }
  }

  return (
    <View style={styles.centered}>
      <Text style={styles.title}>You are signed in</Text>
      <Text style={styles.description}>
        Authenticated navigation arrives in the next frontend slice.
      </Text>
      <Button title="Sign Out" onPress={() => void handleSignOut()} />
      {signOutError ? <Text style={styles.error}>{signOutError}</Text> : null}
    </View>
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
  title: {
    color: '#15251f',
    fontSize: 28,
    fontWeight: '700',
  },
  description: {
    color: '#59636e',
    fontSize: 16,
    textAlign: 'center',
  },
  error: {
    color: '#b42318',
  },
});
