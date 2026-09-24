import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { AuthenticatedTabs } from './AuthenticatedTabs';
import { DirectorAllTeamsScreen } from '../screens/DirectorAllTeamsScreen';
import { DirectorAssistantCoachesScreen } from '../screens/DirectorAssistantCoachesScreen';
import { DrillEditorScreen } from '../screens/DrillEditorScreen';
import { DrillLibraryScreen } from '../screens/DrillLibraryScreen';
import { GameFormScreen } from '../screens/GameFormScreen';
import { LineupBuilderScreen } from '../screens/LineupBuilderScreen';
import { DirectorSettingsScreen } from '../screens/DirectorSettingsScreen';
import { PlayerFormScreen } from '../screens/PlayerFormScreen';
import { PracticePlanDetailScreen } from '../screens/PracticePlanDetailScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { TeamFormScreen } from '../screens/TeamFormScreen';
import { SuperAdminScreen } from '../screens/SuperAdminScreen';
import { SchoolDrillLibraryScreen } from '../screens/SchoolDrillLibraryScreen';
import { ScheduleEventFormScreen } from '../screens/ScheduleEventFormScreen';
import { TeamTabScreen } from '../screens/TeamTabScreen';
import { fonts, iceWhite, rinkNavy } from '../theme/theme';
import type { AuthenticatedStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthenticatedStackParamList>();

export function AuthenticatedStack() {
  const { t } = useTranslation();

  return (
    <Stack.Navigator
      initialRouteName="MainTabs"
      screenOptions={{
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: rinkNavy },
        headerBackTitle: t('common.back'),
        headerShadowVisible: false,
        headerStyle: { backgroundColor: rinkNavy },
        headerTintColor: iceWhite,
        headerTitleStyle: { fontFamily: fonts.display },
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
        component={TeamTabScreen}
        name="Dashboard"
        options={{ title: t('dashboard.title') }}
      />
      <Stack.Screen
        component={TeamFormScreen}
        name="TeamForm"
        options={{ title: t('teamForm.headerTitle') }}
      />
      <Stack.Screen
        component={SuperAdminScreen}
        name="SuperAdmin"
        options={{ title: t('superAdmin.headerTitle') }}
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
        component={DirectorAssistantCoachesScreen}
        name="DirectorAssistantCoaches"
        options={{ title: t('directorAssistantCoaches.headerTitle') }}
      />
      <Stack.Screen
        component={ScheduleEventFormScreen}
        name="ScheduleEventForm"
        options={{ title: t('scheduleForm.title') }}
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
        component={DrillLibraryScreen}
        name="DrillLibrary"
        options={{ title: t('drillLibrary.headerTitle') }}
      />
      <Stack.Screen
        component={SchoolDrillLibraryScreen}
        name="SchoolDrillLibrary"
        options={{ title: t('schoolDrillLibrary.headerTitle') }}
      />
      <Stack.Screen
        component={DrillEditorScreen}
        name="DrillEditor"
        options={({ route }) => ({
          title: route.params?.drillId
            ? t('drillEditor.editHeaderTitle')
            : t('drillEditor.addHeaderTitle'),
        })}
      />
      <Stack.Screen
        component={PracticePlanDetailScreen}
        name="PracticePlanDetail"
        options={({ route }) => ({
          title: route.params?.practicePlanId
            ? t('practiceDetail.editHeaderTitle')
            : t('practiceDetail.addHeaderTitle'),
        })}
      />
    </Stack.Navigator>
  );
}
