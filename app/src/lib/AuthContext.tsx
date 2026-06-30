import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type SessionContext = {
  user_id: string | null;
  email: string | null;
  role: 'anon' | 'customer' | 'admin' | 'super_admin';
  is_admin: boolean;
  is_super_admin: boolean;
  profile: Record<string, unknown> | null;
};

type AuthContextValue = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  context: SessionContext | null;
  refreshContext: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const anonContext: SessionContext = {
  user_id: null,
  email: null,
  role: 'anon',
  is_admin: false,
  is_super_admin: false,
  profile: null,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [context, setContext] = useState<SessionContext | null>(null);

  const refreshContext = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    setSession(session);

    if (!session?.user) {
      setContext(anonContext);
      return;
    }

    const { data, error } = await supabase.rpc('get_my_session_context');

    if (error) {
      console.error('Failed to load session context:', error);
      setContext({
        ...anonContext,
        user_id: session.user.id,
        email: session.user.email ?? null,
        role: 'customer',
      });
      return;
    }

    setContext(data as SessionContext);
  };

  useEffect(() => {
    let mounted = true;

    async function init() {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      setSession(session);

      if (session?.user) {
        const { data, error } = await supabase.rpc('get_my_session_context');

        if (!mounted) return;

        if (error) {
          console.error('Failed to load session context:', error);
          setContext({
            ...anonContext,
            user_id: session.user.id,
            email: session.user.email ?? null,
            role: 'customer',
          });
        } else {
          setContext(data as SessionContext);
        }
      } else {
        setContext(anonContext);
      }

      setLoading(false);
    }

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);

      if (!newSession?.user) {
        setContext(anonContext);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.rpc('get_my_session_context');

      if (error) {
        console.error('Failed to reload session context:', error);
        setContext({
          ...anonContext,
          user_id: newSession.user.id,
          email: newSession.user.email ?? null,
          role: 'customer',
        });
      } else {
        setContext(data as SessionContext);
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setContext(anonContext);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      context,
      refreshContext,
      signOut,
    }),
    [loading, session, context]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return value;
}