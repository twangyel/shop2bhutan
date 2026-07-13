import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type AdminRole = 'anon' | 'customer' | 'admin' | 'super_admin';

type CustomerProfile = {
  id?: string | null;
  full_name?: string | null;
  name?: string | null;
  phone?: string | null;
  default_dzongkhag_id?: string | null;
  avatar_url?: string | null;
  account_status?: string | null;
  is_active?: boolean | null;
  deactivated_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

type SessionContext = {
  user_id: string | null;
  email: string | null;
  role: AdminRole;
  is_admin: boolean;
  is_super_admin: boolean;
  profile: CustomerProfile | null;
};

type AuthContextValue = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  context: SessionContext | null;
  refreshContext: () => Promise<void>;
  ensureGuestSession: () => Promise<Session>;
  signOut: () => Promise<void>;
  isGuest: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const AUTH_MESSAGE_STORAGE_KEY = 'shop2bhutan:auth-message';
const DEACTIVATED_ACCOUNT_MESSAGE =
  'Your account is deactivated. Please contact Shop2Bhutan admin to reactivate it.';

function rememberAuthMessage(message: string) {
  if (typeof window === 'undefined') return;

  window.sessionStorage.setItem(AUTH_MESSAGE_STORAGE_KEY, message);
}

const anonContext: SessionContext = {
  user_id: null,
  email: null,
  role: 'anon',
  is_admin: false,
  is_super_admin: false,
  profile: null,
};

function isAnonymousAuthUser(user?: User | null) {
  return Boolean((user as { is_anonymous?: boolean } | null)?.is_anonymous);
}

function isDeactivatedProfile(profile?: CustomerProfile | null) {
  const status = String(profile?.account_status ?? '').trim().toLowerCase();
  return status === 'deactivated' || profile?.is_active === false;
}

async function isAuthUserDeactivated(user: User) {
  if (!user.id || isAnonymousAuthUser(user)) return false;

  try {
    const rpcResult = await supabase.rpc('is_my_account_deactivated');

    if (!rpcResult.error) return Boolean(rpcResult.data);

    const { data, error } = await supabase
      .from('profiles')
      .select('account_status, is_active')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.warn(
        '[AuthContext] Deactivated account check skipped:',
        error.message,
      );
      return false;
    }

    return isDeactivatedProfile(data as CustomerProfile | null);
  } catch (error) {
    console.warn('[AuthContext] Deactivated account check deferred:', error);
    return false;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanString(value: unknown) {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildProfileInsert(user: User) {
  const metadata = user.user_metadata ?? {};

  const fullName =
    cleanString(metadata.full_name) ??
    cleanString(metadata.name) ??
    cleanString(user.email?.split('@')[0]) ??
    'Customer';

  const phone = cleanString(metadata.phone);
  const defaultDzongkhagId = cleanString(metadata.default_dzongkhag_id);
  const avatarUrl = cleanString(metadata.avatar_url) ?? cleanString(metadata.picture);

  const payload: Record<string, string> = {
    id: user.id,
    full_name: fullName,
  };

  if (phone) payload.phone = phone;
  if (defaultDzongkhagId && UUID_RE.test(defaultDzongkhagId)) {
    payload.default_dzongkhag_id = defaultDzongkhagId;
  }
  if (avatarUrl) payload.avatar_url = avatarUrl;

  return payload;
}

async function ensureProfileRow(user: User) {
  // Anonymous guest sessions are only for temporary parcel booking/tracking.
  // Do not create public.profiles rows for them, otherwise Admin Customers
  // gets filled with blank users named "Customer".
  if (isAnonymousAuthUser(user)) return;

  const payload = buildProfileInsert(user);

  try {
    const { error } = await supabase
      .from('profiles')
      .upsert(payload, {
        onConflict: 'id',
        ignoreDuplicates: true,
      });

    if (error) {
      console.warn('Profile sync skipped:', error.message);
    }
  } catch (error) {
    console.warn('[AuthContext] Profile sync deferred:', error);
  }
}

function buildFallbackContext(user: User): SessionContext {
  return {
    user_id: user.id,
    email: user.email ?? null,
    role: isAnonymousAuthUser(user) ? 'anon' : 'customer',
    is_admin: false,
    is_super_admin: false,
    profile: null,
  };
}

function shouldRefreshSession(activeSession: Session) {
  const expiresAt = Number(activeSession.expires_at ?? 0);
  if (!expiresAt) return false;

  return expiresAt <= Math.floor(Date.now() / 1000) + 90;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [context, setContext] = useState<SessionContext | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const hydrationVersionRef = useRef(0);
  const recoveryPromiseRef = useRef<Promise<void> | null>(null);
  const lastRecoveryAtRef = useRef(0);
  const hiddenAtRef = useRef<number | null>(null);

  const loadSessionContext = useCallback(
    async (activeSession: Session | null) => {
      const hydrationVersion = ++hydrationVersionRef.current;

      sessionRef.current = activeSession;
      setSession(activeSession);

      if (!activeSession?.user) {
        setContext(anonContext);
        return;
      }

      const activeUser = activeSession.user;
      const fallbackContext = buildFallbackContext(activeUser);

      setContext((current) =>
        current?.user_id === activeUser.id ? current : fallbackContext,
      );

      try {
        await ensureProfileRow(activeUser);

        if (await isAuthUserDeactivated(activeUser)) {
          rememberAuthMessage(DEACTIVATED_ACCOUNT_MESSAGE);
          await supabase.auth.signOut();

          if (hydrationVersion === hydrationVersionRef.current) {
            sessionRef.current = null;
            setSession(null);
            setContext(anonContext);
          }
          return;
        }

        const { data, error } = await supabase.rpc('get_my_session_context');

        if (hydrationVersion !== hydrationVersionRef.current) return;

        if (error) {
          console.warn(
            '[AuthContext] Full session context deferred:',
            error.message,
          );
          return;
        }

        const nextContext = data as SessionContext;

        if (isDeactivatedProfile(nextContext.profile)) {
          rememberAuthMessage(DEACTIVATED_ACCOUNT_MESSAGE);
          await supabase.auth.signOut();

          if (hydrationVersion === hydrationVersionRef.current) {
            sessionRef.current = null;
            setSession(null);
            setContext(anonContext);
          }
          return;
        }

        setContext(nextContext);
      } catch (error) {
        if (hydrationVersion !== hydrationVersionRef.current) return;

        console.warn('[AuthContext] Session context hydration deferred:', error);
        setContext((current) =>
          current?.user_id === activeUser.id ? current : fallbackContext,
        );
      }
    },
    [],
  );

  const recoverSession = useCallback(async () => {
    if (recoveryPromiseRef.current) {
      return recoveryPromiseRef.current;
    }

    const recovery = (async () => {
      try {
        const {
          data: { session: storedSession },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        let activeSession = storedSession;

        if (activeSession && shouldRefreshSession(activeSession)) {
          const {
            data: refreshData,
            error: refreshError,
          } = await supabase.auth.refreshSession();

          if (refreshError) {
            console.warn(
              '[AuthContext] Token refresh will retry automatically:',
              refreshError.message,
            );
          } else if (refreshData.session) {
            activeSession = refreshData.session;
          }
        }

        await loadSessionContext(activeSession);

        window.dispatchEvent(
          new CustomEvent('shop2bhutan:session-restored', {
            detail: { userId: activeSession?.user?.id ?? null },
          }),
        );
      } catch (error) {
        console.warn('[AuthContext] Session recovery skipped:', error);

        const currentSession = sessionRef.current;

        if (!currentSession?.user) {
          setSession(null);
          setContext(anonContext);
          return;
        }

        setSession(currentSession);
        setContext((current) =>
          current?.user_id === currentSession.user.id
            ? current
            : buildFallbackContext(currentSession.user),
        );
      } finally {
        recoveryPromiseRef.current = null;
      }
    })();

    recoveryPromiseRef.current = recovery;
    return recovery;
  }, [loadSessionContext]);

  const refreshContext = useCallback(async () => {
    await recoverSession();
  }, [recoverSession]);

  const ensureGuestSession = useCallback(async () => {
    const {
      data: { session: existingSession },
    } = await supabase.auth.getSession();

    if (existingSession?.user?.id) {
      await loadSessionContext(existingSession);
      return existingSession;
    }

    const { data, error } = await supabase.auth.signInAnonymously();

    if (error) {
      throw new Error(
        'Guest booking is not enabled yet. Please enable Anonymous Sign-Ins in Supabase Authentication settings.',
      );
    }

    if (!data.session?.user?.id) {
      throw new Error('Unable to start guest booking session. Please try again.');
    }

    await loadSessionContext(data.session);
    return data.session;
  }, [loadSessionContext]);

  useEffect(() => {
    let mounted = true;
    let recoveryTimer: number | undefined;

    async function init() {
      setLoading(true);

      try {
        await recoverSession();
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT') {
        hydrationVersionRef.current += 1;
        sessionRef.current = null;
        setSession(null);
        setContext(anonContext);
        setLoading(false);
        return;
      }

      window.setTimeout(() => {
        if (!mounted) return;

        void loadSessionContext(newSession).finally(() => {
          if (mounted) setLoading(false);
        });
      }, 0);
    });

    const requestRecovery = () => {
      if (!mounted || document.visibilityState === 'hidden') return;

      const now = Date.now();
      if (now - lastRecoveryAtRef.current < 1500) return;
      lastRecoveryAtRef.current = now;

      if (recoveryTimer !== undefined) {
        window.clearTimeout(recoveryTimer);
      }

      recoveryTimer = window.setTimeout(() => {
        if (mounted) void recoverSession();
      }, 120);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now();
        return;
      }

      const hiddenDuration =
        hiddenAtRef.current === null ? 0 : Date.now() - hiddenAtRef.current;
      hiddenAtRef.current = null;

      if (hiddenDuration >= 5000) requestRecovery();
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) requestRecovery();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('focus', requestRecovery);
    window.addEventListener('online', requestRecovery);

    return () => {
      mounted = false;

      if (recoveryTimer !== undefined) {
        window.clearTimeout(recoveryTimer);
      }

      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('focus', requestRecovery);
      window.removeEventListener('online', requestRecovery);
    };
  }, [loadSessionContext, recoverSession]);

  const signOut = useCallback(async () => {
    // Clear local auth state first so logout feels instant and predictable.
    sessionRef.current = null;
    setSession(null);
    setContext(anonContext);
    setLoading(false);

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.warn('[AuthContext] Sign out skipped:', error.message);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      context,
      refreshContext,
      ensureGuestSession,
      signOut,
      isGuest: isAnonymousAuthUser(session?.user ?? null),
    }),
    [loading, session, context, refreshContext, ensureGuestSession, signOut]
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
