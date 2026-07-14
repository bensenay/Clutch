import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { AccountTypeScreen } from '../screens/AccountTypeScreen';
import { CoachSignupScreen } from '../screens/CoachSignupScreen';
import { DirectorSignupScreen } from '../screens/DirectorSignupScreen';
import { LandingScreen } from '../screens/LandingScreen';
import { SignInScreen } from '../screens/SignInScreen';
import type { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthStack() {
  const { t } = useTranslation();

  return (
    <Stack.Navigator
      initialRouteName="Landing"
      screenOptions={{
        contentStyle: { backgroundColor: '#f4f6f3' },
        headerBackTitle: t('common.back'),
        headerShadowVisible: false,
        headerStyle: { backgroundColor: '#f4f6f3' },
        headerTintColor: '#15251f',
      }}
    >
      <Stack.Screen
        component={LandingScreen}
        name="Landing"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        component={SignInScreen}
        name="SignIn"
        options={{ title: t('signIn.submit') }}
      />
      <Stack.Screen
        component={AccountTypeScreen}
        name="AccountType"
        options={{ title: t('landing.createAccount') }}
      />
      <Stack.Screen
        component={CoachSignupScreen}
        name="CoachSignup"
        options={{ title: t('coachSignup.headerTitle') }}
      />
      <Stack.Screen
        component={DirectorSignupScreen}
        name="DirectorSignup"
        options={{ title: t('directorSignup.headerTitle') }}
      />
    </Stack.Navigator>
  );
}
