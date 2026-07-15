import {
  createContext,
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
};

type ActiveTeamContextValue = {
  activeTeam: ActiveTeam | null;
  setActiveTeam: (team: ActiveTeam | null) => void;
};

const ActiveTeamContext = createContext<ActiveTeamContextValue | undefined>(
  undefined,
);

export function ActiveTeamProvider({ children }: PropsWithChildren) {
  const [activeTeam, setActiveTeam] = useState<ActiveTeam | null>(null);
  const value = useMemo(
    () => ({
      activeTeam,
      setActiveTeam,
    }),
    [activeTeam],
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
