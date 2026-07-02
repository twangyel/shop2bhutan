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

type AdminRole = 'anon' | 'customer' | 'admin' | 'super_admin';

type CustomerProfile = {
  id?: string | null;
  full_name?: string | null;
  name?: string | null;
  phone?: string | null;
  default_dzongkhag_id?: string | null;
  avatar_url?: string | null;
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

  const loadSessionContext = async (activeSession: Session | null) => {
    setSession(activeSession);

    if (!activeSession?.user) {
      setContext(anonContext);
      return;
    }

    await ensureProfileRow(activeSession.user);

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

    setContext(data as SessionContext);
  };

  const refreshContext = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    await loadSessionContext(session);
  };

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
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;

      setLoading(true);
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
