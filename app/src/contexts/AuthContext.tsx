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

async function isCurrentAuthUserDeactivated() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id || isAnonymousAuthUser(user)) return false;

  const rpcResult = await supabase.rpc('is_my_account_deactivated');

  if (!rpcResult.error) return Boolean(rpcResult.data);

  const { data, error } = await supabase
    .from('profiles')
    .select('account_status, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.warn('[AuthContext] Deactivated account check skipped:', error.message);
    return false;
  }

  return isDeactivatedProfile(data as CustomerProfile | null);
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
  // Anonymous guest sessions are only for temporary parcel/order tracking.
  // Do not create public.profiles rows for them, otherwise Admin Customers
  // gets filled with blank users named "Customer".
  if (isAnonymousAuthUser(user)) return;

  const payload = buildProfileInsert(user);

  const { error } = await supabase
    .from('profiles')
    .upsert(payload, {
      onConflict: 'id',
      ignoreDuplicates: true,
    });

  if (error) {
    console.warn('Profile sync skipped:', error.message);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [context, setContext] = useState<SessionContext | null>(null);
  const sessionRef = useRef<Session | null>(null);

  const loadSessionContext = async (activeSession: Session | null) => {
    sessionRef.current = activeSession;
    setSession(activeSession);

    if (!activeSession?.user) {
      setContext(anonContext);
      return;
    }

    await ensureProfileRow(activeSession.user);

    if (await isCurrentAuthUserDeactivated()) {
      rememberAuthMessage(DEACTIVATED_ACCOUNT_MESSAGE);
      await supabase.auth.signOut();
      setSession(null);
      setContext(anonContext);
      return;
    }

    const { data, error } = await supabase.rpc('get_my_session_context');

    if (error) {
      console.error('Failed to load session context:', error);

      setContext({
        ...anonContext,
        user_id: activeSession.user.id,
        email: activeSession.user.email ?? null,
        role: 'customer',
      });

      return;
    }

    const nextContext = data as SessionContext;

    if (isDeactivatedProfile(nextContext.profile)) {
      rememberAuthMessage(DEACTIVATED_ACCOUNT_MESSAGE);
      await supabase.auth.signOut();
      setSession(null);
      setContext(anonContext);
      return;
    }

    setContext(nextContext);
  };

  const refreshContext = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    await loadSessionContext(session);
  }, []);

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
  }, []);

  useEffect(() => {
    let mounted = true;

    async function init() {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      await loadSessionContext(session);

      if (mounted) {
        setLoading(false);
      }
    }

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;

      // Keep the current screen mounted during normal auth changes.
      // Login, logout, token refresh, and password updates are handled with
      // local button/overlay states so the app does not flash a global loader.
      if (event === 'SIGNED_OUT') {
        sessionRef.current = null;
        setSession(null);
        setContext(anonContext);
        setLoading(false);
        return;
      }

      await loadSessionContext(newSession);

      if (mounted) {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

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
