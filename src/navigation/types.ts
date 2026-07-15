export type AuthStackParamList = {
  Landing: undefined;
  SignIn: undefined;
  AccountType: undefined;
  CoachSignup: undefined;
  DirectorSignup: undefined;
};

export type AuthenticatedStackParamList = {
  Home: undefined;
  DirectorAllTeams: undefined;
  DirectorSettings: undefined;
  Roster: undefined;
  PlayerForm: { playerId?: string } | undefined;
  Games: undefined;
  GameForm: { gameId?: string } | undefined;
  LineupBuilder: { gameId: string };
};
