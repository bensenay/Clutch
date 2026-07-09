import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AccountTypeScreen } from '../screens/AccountTypeScreen';
import { CoachPathScreen } from '../screens/CoachPathScreen';
import { DirectorSignupScreen } from '../screens/DirectorSignupScreen';
import { IndependentCoachSignupScreen } from '../screens/IndependentCoachSignupScreen';
import { JoinOrganizationScreen } from '../screens/JoinOrganizationScreen';
import { LandingScreen } from '../screens/LandingScreen';
import { SignInScreen } from '../screens/SignInScreen';
import type { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthStack() {
  return (
    <Stack.Navigator
      initialRouteName="Landing"
      screenOptions={{
        contentStyle: { backgroundColor: '#f4f6f3' },
        headerBackTitle: 'Back',
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
        options={{ title: 'Sign In' }}
      />
      <Stack.Screen
        component={AccountTypeScreen}
        name="AccountType"
        options={{ title: 'Create Account' }}
      />
      <Stack.Screen
        component={CoachPathScreen}
        name="CoachPath"
        options={{ title: 'Coach Account' }}
      />
      <Stack.Screen
        component={DirectorSignupScreen}
        name="DirectorSignup"
        options={{ title: 'Director Signup' }}
      />
      <Stack.Screen
        component={JoinOrganizationScreen}
        name="JoinOrganization"
        options={{ title: 'Join Organization' }}
      />
      <Stack.Screen
        component={IndependentCoachSignupScreen}
        name="IndependentCoachSignup"
        options={{ title: 'Independent Coach' }}
      />
    </Stack.Navigator>
  );
}
