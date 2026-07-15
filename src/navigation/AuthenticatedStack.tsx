import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { AuthenticatedTabs } from './AuthenticatedTabs';
import { DirectorAllTeamsScreen } from '../screens/DirectorAllTeamsScreen';
import { GameFormScreen } from '../screens/GameFormScreen';
import { LineupBuilderScreen } from '../screens/LineupBuilderScreen';
import { DirectorSettingsScreen } from '../screens/DirectorSettingsScreen';
import { PlayerFormScreen } from '../screens/PlayerFormScreen';
import { PracticePlanDetailScreen } from '../screens/PracticePlanDetailScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import type { AuthenticatedStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthenticatedStackParamList>();

export function AuthenticatedStack() {
  const { t } = useTranslation();

  return (
    <Stack.Navigator
      initialRouteName="MainTabs"
      screenOptions={{
        contentStyle: { backgroundColor: '#f4f6f3' },
        headerBackTitle: t('common.back'),
        headerShadowVisible: false,
        headerStyle: { backgroundColor: '#f4f6f3' },
        headerTintColor: '#15251f',
      }}
    >
      <Stack.Screen
        component={AuthenticatedTabs}
        name="MainTabs"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        component={SettingsScreen}
        name="Settings"
        options={{ title: t('settings.title') }}
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
      <Stack.Screen
        component={PlayerFormScreen}
        name="PlayerForm"
        options={({ route }) => ({
          title: route.params?.playerId
            ? t('playerForm.editHeaderTitle')
            : t('playerForm.addHeaderTitle'),
        })}
      />
      <Stack.Screen
        component={GameFormScreen}
        name="GameForm"
        options={({ route }) => ({
          title: route.params?.gameId
            ? t('gameForm.editHeaderTitle')
            : t('gameForm.addHeaderTitle'),
        })}
      />
      <Stack.Screen
        component={LineupBuilderScreen}
        name="LineupBuilder"
        options={{ title: t('lineup.title') }}
      />
      <Stack.Screen
        component={PracticePlanDetailScreen}
        name="PracticePlanDetail"
        options={{ title: t('practiceDetail.title') }}
      />
    </Stack.Navigator>
  );
}
