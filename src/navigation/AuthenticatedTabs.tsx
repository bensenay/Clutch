import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { AppIcon } from '../components/AppIcon';
import { HeaderMenuButton, HeaderTeamSelector } from '../components/AppHeader';
import { PracticesScreen } from '../screens/PracticesScreen';
import { RosterScreen } from '../screens/RosterScreen';
import { ScheduleScreen } from '../screens/ScheduleScreen';
import {
  colors,
  fonts,
  frostSteel,
  iceWhite,
  rinkNavy,
  spacing,
} from '../theme/theme';
import type {
  AuthenticatedStackParamList,
  AuthenticatedTabParamList,
} from './types';

const Tab = createBottomTabNavigator<AuthenticatedTabParamList>();

type AuthenticatedTabsProps = {
  navigation: NativeStackNavigationProp<
    AuthenticatedStackParamList,
    'MainTabs'
  >;
};

export function AuthenticatedTabs({ navigation }: AuthenticatedTabsProps) {
  const { t } = useTranslation();

  return (
    <Tab.Navigator
      screenOptions={{
        headerLeft: () => <HeaderMenuButton />,
        headerTitle: () => <HeaderTeamSelector />,
        headerRight: () => (
          <AnimatedPressable
            accessibilityLabel={t('settings.openLabel')}
            accessibilityRole="button"
            onPress={() => navigation.navigate('Settings')}
            style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}
          >
            <AppIcon color={iceWhite} name="settings-outline" size={23} />
          </AnimatedPressable>
        ),
        headerShadowVisible: false,
        headerStyle: { backgroundColor: rinkNavy },
        headerTintColor: iceWhite,
        headerTitleStyle: { fontFamily: fonts.display },
        tabBarActiveTintColor: iceWhite,
        tabBarInactiveTintColor: frostSteel,
        tabBarStyle: {
          backgroundColor: rinkNavy,
          borderTopColor: colors.rinkSurface,
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
