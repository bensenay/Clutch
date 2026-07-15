import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Landing: undefined;
  SignIn: undefined;
  AccountType: undefined;
  CoachSignup: undefined;
  DirectorSignup: undefined;
};

export type AuthenticatedStackParamList = {
  MainTabs: NavigatorScreenParams<AuthenticatedTabParamList> | undefined;
  Settings: undefined;
  PlayerForm: { playerId?: string } | undefined;
  GameForm: { gameId?: string } | undefined;
  LineupBuilder: { gameId: string };
  PracticePlanDetail: { practicePlanId: string };
  DirectorAllTeams: undefined;
  DirectorSettings: undefined;
};

export type AuthenticatedTabParamList = {
  TeamTab: undefined;
  RosterTab: undefined;
  GameDayTab: undefined;
  PracticesTab: undefined;
};
