import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Landing: undefined;
  SignIn: undefined;
  AccountType: undefined;
  AssistantCoachSignup: undefined;
  CoachSignup: undefined;
  DirectorSignup: undefined;
};

export type AuthenticatedStackParamList = {
  MainTabs: NavigatorScreenParams<AuthenticatedTabParamList> | undefined;
  Dashboard: undefined;
  Settings: undefined;
  TeamForm: undefined;
  SuperAdmin: undefined;
  PlayerForm: { playerId?: string; readOnly?: boolean } | undefined;
  GameForm: { gameId?: string; readOnly?: boolean } | undefined;
  LineupBuilder: { gameId: string; readOnly?: boolean };
  DrillLibrary: undefined;
  SchoolDrillLibrary: undefined;
  DrillEditor: { drillId?: string; readOnly?: boolean } | undefined;
  PracticePlanDetail:
    | {
        practicePlanId?: string;
        readOnly?: boolean;
        scheduleEventId?: string;
        scheduledAt?: string;
      }
    | undefined;
  DirectorAllTeams: undefined;
  DirectorSettings: undefined;
  DirectorAssistantCoaches: undefined;
  ScheduleEventForm:
    | {
        eventId?: string;
        defaultDate?: string;
        defaultHour?: number;
        teamId?: string;
        coachId?: string;
      }
    | undefined;
};

export type AuthenticatedTabParamList = {
  ScheduleTab: { eventId?: string } | undefined;
  RosterTab: undefined;
  PracticeTab: undefined;
};
