import { Oswald_700Bold, useFonts } from '@expo-google-fonts/oswald';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/auth/AuthProvider';
import { AnimatedLaunchScreen } from './src/components/AnimatedLaunchScreen';
import { RinkWatermark } from './src/components/RinkWatermark';
import { RootNavigator } from './src/navigation/RootNavigator';
import { goalRed, rinkNavy } from './src/theme/theme';

const queryClient = new QueryClient();

void SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded] = useFonts({
    Oswald_700Bold,
  });
  const [showLaunchScreen, setShowLaunchScreen] = useState(true);
  const finishLaunchSequence = useCallback(() => {
    setShowLaunchScreen(false);
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <View style={styles.root}>
            <StatusBar style="light" />
            {fontsLoaded ? (
              <RootNavigator />
            ) : (
              <View style={styles.loading}>
                <RinkWatermark />
                <ActivityIndicator color={goalRed} size="large" />
              </View>
            )}
            {showLaunchScreen ? (
              <AnimatedLaunchScreen
                onFinished={finishLaunchSequence}
                useBrandFont={fontsLoaded}
              />
            ) : null}
          </View>
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loading: {
    alignItems: 'center',
    backgroundColor: rinkNavy,
    flex: 1,
    justifyContent: 'center',
  },
});
