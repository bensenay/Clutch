import { SteelBar } from '../components/SteelBar';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '../components/AppIcon';
import {
  HeaderMenuButton,
  HeaderSettingsButton,
  HeaderTeamSelector,
} from '../components/AppHeader';
import { PracticesScreen } from '../screens/PracticesScreen';
import { RosterScreen } from '../screens/RosterScreen';
import { ScheduleScreen } from '../screens/ScheduleScreen';
import {
  fonts,
  frostSteel,
  iceWhite,
  rinkNavy,
} from '../theme/theme';
import type {
  AuthenticatedTabParamList,
} from './types';

const Tab = createBottomTabNavigator<AuthenticatedTabParamList>();

export function AuthenticatedTabs() {
  const { t } = useTranslation();

  return (
    <Tab.Navigator
      screenOptions={{
        headerLeft: () => <HeaderMenuButton />,
        headerTitle: () => <HeaderTeamSelector />,
        headerRight: () => <HeaderSettingsButton />,
        headerShadowVisible: false,
        headerBackground: () => <SteelBar />,
        headerStyle: { backgroundColor: rinkNavy },
        headerTintColor: iceWhite,
        headerTitleStyle: { fontFamily: fonts.display },
        tabBarActiveTintColor: iceWhite,
        tabBarInactiveTintColor: frostSteel,
        tabBarBackground: () => <SteelBar edge="top" />,
        tabBarStyle: {
          backgroundColor: rinkNavy,
          borderTopWidth: 0,
        },
      }}
    >
      <Tab.Screen
        component={ScheduleScreen}
        name="ScheduleTab"
        options={{
          tabBarIcon: ({ color, size }) => (
            <AppIcon color={color} name="calendar-outline" size={size} />
          ),
          tabBarLabel: t('tabs.schedule'),
          title: t('tabs.schedule'),
        }}
      />
      <Tab.Screen
        component={RosterScreen}
        name="RosterTab"
        options={{
          tabBarIcon: ({ color, size }) => (
            <AppIcon color={color} name="people-outline" size={size} />
          ),
          tabBarLabel: t('tabs.roster'),
          title: t('tabs.roster'),
        }}
      />
      <Tab.Screen
        component={PracticesScreen}
        name="PracticeTab"
        options={{
          tabBarIcon: ({ color, size }) => (
            <AppIcon color={color} name="clipboard-outline" size={size} />
          ),
          tabBarLabel: t('tabs.practice'),
          title: t('tabs.practice'),
        }}
      />
    </Tab.Navigator>
  );
}
