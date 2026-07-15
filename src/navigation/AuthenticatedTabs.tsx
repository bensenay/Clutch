import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GameListScreen } from '../screens/GameListScreen';
import { PracticesScreen } from '../screens/PracticesScreen';
import { RosterScreen } from '../screens/RosterScreen';
import { TeamTabScreen } from '../screens/TeamTabScreen';
import { colors, fonts, frostSteel, iceWhite, rinkNavy } from '../theme/theme';
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
          <Pressable
            accessibilityLabel={t('settings.openLabel')}
            accessibilityRole="button"
            onPress={() => navigation.navigate('Settings')}
            style={{ paddingHorizontal: 16, paddingVertical: 8 }}
          >
            <Text style={{ color: iceWhite, fontSize: 22 }}>⚙</Text>
          </Pressable>
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
        options={{ tabBarLabel: t('tabs.team'), title: t('tabs.team') }}
      />
      <Tab.Screen
        component={RosterScreen}
        name="RosterTab"
        options={{ tabBarLabel: t('tabs.roster'), title: t('tabs.roster') }}
      />
      <Tab.Screen
        component={GameListScreen}
        name="GameDayTab"
        options={{
          tabBarLabel: t('tabs.gameDay'),
          title: t('tabs.gameDay'),
        }}
      />
      <Tab.Screen
        component={PracticesScreen}
        name="PracticesTab"
        options={{
          tabBarLabel: t('tabs.practices'),
          title: t('tabs.practices'),
        }}
      />
    </Tab.Navigator>
  );
}
