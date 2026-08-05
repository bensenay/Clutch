import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

export type ActiveTeam = {
  id: string;
  name: string;
  level: string | null;
  season: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  tertiary_color: string | null;
  logo_url: string | null;
};

export type ActiveTeamAccess =
  | { mode: 'membership' }
  | {
      mode: 'assignment';
      assignmentId: string;
      assignmentType: 'game' | 'practice';
      scheduledAt: string;
    };

type ActiveTeamContextValue = {
  activeTeam: ActiveTeam | null;
  activeTeamAccess: ActiveTeamAccess;
  isReadOnlyTeam: boolean;
  setActiveTeam: (
    team: ActiveTeam | null,
    access?: ActiveTeamAccess,
  ) => void;
};

const ActiveTeamContext = createContext<ActiveTeamContextValue | undefined>(
  undefined,
);

export function ActiveTeamProvider({ children }: PropsWithChildren) {
  const [activeTeam, setActiveTeam] = useState<ActiveTeam | null>(null);
  const [activeTeamAccess, setActiveTeamAccess] = useState<ActiveTeamAccess>({
    mode: 'membership',
  });
  const setActiveTeamWithAccess = useCallback(
    (team: ActiveTeam | null, access?: ActiveTeamAccess) => {
      setActiveTeam(team);
      setActiveTeamAccess(team ? access ?? { mode: 'membership' } : { mode: 'membership' });
    },
    [],
  );
  const value = useMemo(
    () => ({
      activeTeam,
      activeTeamAccess,
      isReadOnlyTeam: activeTeamAccess.mode === 'assignment',
      setActiveTeam: setActiveTeamWithAccess,
    }),
    [activeTeam, activeTeamAccess, setActiveTeamWithAccess],
  );

  return (
    <ActiveTeamContext.Provider value={value}>
      {children}
    </ActiveTeamContext.Provider>
  );
}

export function useActiveTeam() {
  const context = useContext(ActiveTeamContext);

  if (!context) {
    throw new Error('useActiveTeam must be used within an ActiveTeamProvider.');
  }

  return context;
}
