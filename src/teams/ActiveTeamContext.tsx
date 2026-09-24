import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';

export type AppRole = 'super_admin' | 'director' | 'coach';

export type ActiveTeam = {
  id: string;
  name: string;
  level: string | null;
  season: string | null;
  membership_role?: 'head_coach' | 'assistant_coach' | null;
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
  teams: ActiveTeam[];
  role: AppRole | null;
  schoolId: string | null;
  isLoadingTeams: boolean;
  teamsError: boolean;
  isAllTeams: boolean;
  isReadOnlyTeam: boolean;
  setActiveTeam: (
    team: ActiveTeam | null,
    access?: ActiveTeamAccess,
  ) => void;
  selectAllTeams: () => void;
};

const ActiveTeamContext = createContext<ActiveTeamContextValue | undefined>(
  undefined,
);

export function ActiveTeamProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
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
  const profileQuery = useQuery({
    queryKey: ['active-team-profile', session?.user.id],
    queryFn: async () => {
      if (!session) {
        throw new Error('Missing session.');
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('role, school_id')
        .eq('id', session.user.id)
        .single();

      if (error) {
        throw error;
      }

      return data as { role: AppRole; school_id: string | null };
    },
    enabled: Boolean(session),
  });
  const profile = profileQuery.data;
  const teamsQuery = useQuery({
    queryKey: ['accessible-teams', session?.user.id, profile?.role, profile?.school_id],
    queryFn: async () => {
      if (!session || !profile) {
        return [] as ActiveTeam[];
      }

      if (profile.role === 'director') {
        if (!profile.school_id) {
          return [] as ActiveTeam[];
        }

        const { data, error } = await supabase
          .from('teams')
          .select('id, name, level, season, primary_color, secondary_color, tertiary_color, logo_url')
          .eq('school_id', profile.school_id)
          .order('name');

        if (error) {
          throw error;
        }

        return (data ?? []) as ActiveTeam[];
      }

      if (profile.role !== 'coach') {
        return [] as ActiveTeam[];
      }

      const { data, error } = await supabase
        .from('team_memberships')
        .select(
          'membership_role, teams ( id, name, level, season, primary_color, secondary_color, tertiary_color, logo_url )',
        )
        .eq('user_id', session.user.id)
        .order('created_at');

      if (error) {
        throw error;
      }

      const accessibleTeams: ActiveTeam[] = [];

      for (const row of data ?? []) {
        const relation = row.teams;
        const team = Array.isArray(relation) ? relation[0] : relation;

        if (team) {
          accessibleTeams.push({
            ...(team as Omit<ActiveTeam, 'membership_role'>),
            membership_role: row.membership_role as ActiveTeam['membership_role'],
          });
        }
      }

      return accessibleTeams;
    },
    enabled: Boolean(session && profile),
  });
  const teams = teamsQuery.data ?? [];

  // Directors intentionally start in organization-wide mode. Coaches always
  // need a concrete team because their roster and planner are team-scoped.
  useEffect(() => {
    if (
      profile?.role === 'coach' &&
      teams.length > 0 &&
      !activeTeam &&
      activeTeamAccess.mode === 'membership'
    ) {
      setActiveTeamWithAccess(teams[0]);
    }
  }, [
    activeTeam,
    activeTeamAccess.mode,
    profile?.role,
    setActiveTeamWithAccess,
    teams,
  ]);

  useEffect(() => {
    if (!activeTeam || teamsQuery.isLoading) return;
    if (teams.some((team) => team.id === activeTeam.id)) return;
    setActiveTeamWithAccess(profile?.role === 'coach' ? teams[0] ?? null : null);
  }, [activeTeam, profile?.role, setActiveTeamWithAccess, teams, teamsQuery.isLoading]);

  const selectAllTeams = useCallback(() => {
    setActiveTeamWithAccess(null);
  }, [setActiveTeamWithAccess]);
  const value = useMemo(
    () => ({
      activeTeam,
      activeTeamAccess,
      teams,
      role: profile?.role ?? null,
      schoolId: profile?.school_id ?? null,
      isLoadingTeams: profileQuery.isLoading || teamsQuery.isLoading,
      teamsError: Boolean(profileQuery.error || teamsQuery.error),
      isAllTeams: profile?.role === 'director' && activeTeam === null,
      isReadOnlyTeam:
        activeTeamAccess.mode === 'assignment' ||
        activeTeam?.membership_role === 'assistant_coach',
      setActiveTeam: setActiveTeamWithAccess,
      selectAllTeams,
    }),
    [
      activeTeam,
      activeTeamAccess,
      profile?.role,
      profile?.school_id,
      profileQuery.error,
      profileQuery.isLoading,
      selectAllTeams,
      setActiveTeamWithAccess,
      teams,
      teamsQuery.error,
      teamsQuery.isLoading,
    ],
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
