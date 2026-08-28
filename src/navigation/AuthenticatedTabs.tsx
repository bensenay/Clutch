import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { AppIcon } from '../components/AppIcon';
import { GameListScreen } from '../screens/GameListScreen';
import { PracticesScreen } from '../screens/PracticesScreen';
import { RosterScreen } from '../screens/RosterScreen';
import { TeamTabScreen } from '../screens/TeamTabScreen';
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
        component={TeamTabScreen}
        name="TeamTab"
        options={{
          tabBarIcon: ({ color, size }) => (
            <AppIcon color={color} name="shield-outline" size={size} />
          ),
          tabBarLabel: t('tabs.team'),
          title: t('tabs.team'),
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
        component={GameListScreen}
        name="GameDayTab"
        options={{
          tabBarIcon: ({ color, size }) => (
            <AppIcon color={color} name="calendar-outline" size={size} />
          ),
          tabBarLabel: t('tabs.gameDay'),
          title: t('tabs.gameDay'),
        }}
      />
      <Tab.Screen
        component={PracticesScreen}
        name="PracticesTab"
        options={{
          tabBarIcon: ({ color, size }) => (
            <AppIcon color={color} name="clipboard-outline" size={size} />
          ),
          tabBarLabel: t('tabs.practices'),
          title: t('tabs.practices'),
        }}
      />
    </Tab.Navigator>
  );
}
