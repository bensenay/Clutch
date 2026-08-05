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
  PlayerForm: { playerId?: string; readOnly?: boolean } | undefined;
  GameForm: { gameId?: string; readOnly?: boolean } | undefined;
  LineupBuilder: { gameId: string; readOnly?: boolean };
  PracticePlanDetail:
    | { practicePlanId?: string; readOnly?: boolean }
    | undefined;
  DirectorAllTeams: undefined;
  DirectorSettings: undefined;
  DirectorAssistantCoaches: undefined;
};

export type AuthenticatedTabParamList = {
  TeamTab: undefined;
  RosterTab: undefined;
  GameDayTab: undefined;
  PracticesTab: undefined;
};
