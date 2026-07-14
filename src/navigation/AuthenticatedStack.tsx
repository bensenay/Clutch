import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { DirectorAllTeamsScreen } from '../screens/DirectorAllTeamsScreen';
import { DirectorSettingsScreen } from '../screens/DirectorSettingsScreen';
import { HomeScreen } from '../screens/HomeScreen';
import type { AuthenticatedStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthenticatedStackParamList>();

export function AuthenticatedStack() {
  const { t } = useTranslation();

  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        contentStyle: { backgroundColor: '#f4f6f3' },
        headerBackTitle: t('common.back'),
        headerShadowVisible: false,
        headerStyle: { backgroundColor: '#f4f6f3' },
        headerTintColor: '#15251f',
      }}
    >
      <Stack.Screen
        component={HomeScreen}
        name="Home"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        component={DirectorAllTeamsScreen}
        name="DirectorAllTeams"
        options={{ title: t('directorAllTeams.title') }}
      />
      <Stack.Screen
        component={DirectorSettingsScreen}
        name="DirectorSettings"
        options={{ title: t('directorSettings.title') }}
      />
    </Stack.Navigator>
  );
}
