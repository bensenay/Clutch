import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { DirectorAllTeamsScreen } from '../screens/DirectorAllTeamsScreen';
import { GameFormScreen } from '../screens/GameFormScreen';
import { GameListScreen } from '../screens/GameListScreen';
import { LineupBuilderScreen } from '../screens/LineupBuilderScreen';
import { DirectorSettingsScreen } from '../screens/DirectorSettingsScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { PlayerFormScreen } from '../screens/PlayerFormScreen';
import { RosterScreen } from '../screens/RosterScreen';
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
      <Stack.Screen
        component={RosterScreen}
        name="Roster"
        options={{ title: t('roster.title') }}
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
        component={GameListScreen}
        name="Games"
        options={{ title: t('games.title') }}
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
    </Stack.Navigator>
  );
}
