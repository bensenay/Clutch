import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { supabase } from '../../lib/supabase';
import i18n from '../i18n';
import { getFunctionErrorMessage } from './onboarding';
import { pendingOnboarding } from './pendingOnboarding';

type AuthContextValue = {
  session: Session | null;
  isLoading: boolean;
  isOnboarding: boolean;
  isResolvingOnboarding: boolean;
  onboardingError: string;
  beginOnboarding: () => void;
  endOnboarding: () => void;
  clearOnboardingError: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [isResolvingOnboarding, setIsResolvingOnboarding] = useState(false);
  const [onboardingError, setOnboardingError] = useState('');
  const isOnboardingRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    let activeResolution:
      | {
          accessToken: string;
          promise: Promise<void>;
        }
      | undefined;

    async function completePendingOnboarding(nextSession: Session) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('school_id')
        .eq('id', nextSession.user.id)
        .maybeSingle();

      if (profileError) {
        throw new Error(i18n.t('common.profileLoadError'));
      }

      if (!profile) {
        throw new Error(i18n.t('common.profileMissingError'));
      }

      if (profile.school_id) {
        return;
      }

      const intent = await pendingOnboarding.load();

      if (!intent) {
        return;
      }

      const functionName =
        intent.type === 'director'
          ? 'create-organization'
          : intent.type === 'join'
            ? 'join-organization'
            : 'create-independent-coach';
      const { error } = await supabase.functions.invoke(functionName, {
        body: intent.payload,
        headers: {
          Authorization: `Bearer ${nextSession.access_token}`,
        },
      });

      if (error) {
        const message = await getFunctionErrorMessage(error);

        if (message === 'Invalid organization join code.') {
          throw new Error(i18n.t('joinOrganization.invalidCodeError'));
        }

        if (message === 'This organization is currently suspended.') {
          throw new Error(i18n.t('joinOrganization.suspendedError'));
        }

        throw new Error(
          message ?? i18n.t('common.pendingOnboardingCompletionError'),
        );
      }

      await pendingOnboarding.clear();
    }

    function getResolution(nextSession: Session) {
      if (activeResolution?.accessToken === nextSession.access_token) {
        return activeResolution.promise;
      }

      const promise = completePendingOnboarding(nextSession).finally(() => {
        if (activeResolution?.promise === promise) {
          activeResolution = undefined;
        }
      });

      activeResolution = {
        accessToken: nextSession.access_token,
        promise,
      };

      return promise;
    }

    async function applySession(
      nextSession: Session | null,
      isInitialSession = false,
    ) {
      if (!nextSession) {
        if (isMounted) {
          setSession(null);
          setIsResolvingOnboarding(false);

          if (isInitialSession) {
            setIsLoading(false);
          }
        }

        return;
      }

      if (isOnboardingRef.current) {
        if (isMounted) {
          setSession(nextSession);

          if (isInitialSession) {
            setIsLoading(false);
          }
        }

        return;
      }

      if (isMounted) {
        setIsResolvingOnboarding(true);
      }

      try {
        await getResolution(nextSession);

        if (isMounted) {
          setOnboardingError('');
          setSession(nextSession);
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : i18n.t('common.pendingOnboardingCompletionError');

        await supabase.auth.signOut();

        if (isMounted) {
          setSession(null);
          setOnboardingError(message);
        }
      } finally {
        if (isMounted) {
          setIsResolvingOnboarding(false);

          if (isInitialSession) {
            setIsLoading(false);
          }
        }
      }
    }

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error('Unable to restore Supabase session:', error.message);
      }

      void applySession(data.session, true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void applySession(nextSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }
  }

  function beginOnboarding() {
    isOnboardingRef.current = true;
    setIsOnboarding(true);
  }

  function endOnboarding() {
    isOnboardingRef.current = false;
    setIsOnboarding(false);
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        isLoading,
        isOnboarding,
        isResolvingOnboarding,
        onboardingError,
        beginOnboarding,
        endOnboarding,
        clearOnboardingError: () => setOnboardingError(''),
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }

  return context;
}
