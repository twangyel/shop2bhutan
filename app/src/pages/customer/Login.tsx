import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, Mail, Lock, Eye, EyeOff, User, Phone, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import BrandLogo from '@/components/BrandLogo';


const AUTH_MESSAGE_STORAGE_KEY = 'shop2bhutan:auth-message';
const DEACTIVATED_ACCOUNT_MESSAGE =
  'Your account is deactivated. Please contact Shop2Bhutan admin to reactivate it.';

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function normalizeBhutanPhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  let phone8 = digits;
  if (digits.startsWith('975')) {
    phone8 = digits.slice(3);
  }
  if (!/^(17|77)\d{6}$/.test(phone8)) {
    return null;
  }
  return phone8;
}

function isEmailIdentifier(value: string) {
  return value.includes('@');
}

type LoginRouteState = {
  returnTo?: string;
} | null;

function getSafeReturnTo(value: unknown) {
  if (typeof value !== 'string') return '/';
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  if (value.startsWith('/login') || value.startsWith('/register')) return '/';
  return value;
}

async function isLoginEmailDeactivated(loginEmail: string) {
  const cleanEmail = loginEmail.trim().toLowerCase();
  if (!cleanEmail) return false;

  const { data, error } = await supabase.rpc('is_login_account_deactivated', {
    p_login_email: cleanEmail,
  });

  if (error) {
    console.warn('[Login] Pre-login deactivated check skipped:', error.message);
    return false;
  }

  return Boolean(data);
}

async function isDeactivatedLoginUser(userId?: string | null) {
  if (!userId) return false;

  const rpcResult = await supabase.rpc('is_my_account_deactivated');

  if (!rpcResult.error) return Boolean(rpcResult.data);

  const { data, error } = await supabase
    .from('profiles')
    .select('account_status, is_active')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.warn('[Login] Deactivated account check skipped:', error.message);
    return false;
  }

  const status = String(data?.account_status ?? '').trim().toLowerCase();
  return status === 'deactivated' || data?.is_active === false;
}

async function getPostLoginDestination(returnTo: string) {
  const { data, error } = await supabase.rpc('get_my_session_context');

  if (error) {
    console.warn('[Login] Post-login role check skipped:', error.message);
    return returnTo;
  }

  const row = (data && typeof data === 'object' ? data : {}) as {
    role?: string | null;
    is_admin?: boolean | null;
    is_super_admin?: boolean | null;
  };

  const isAdmin = Boolean(
    row.is_admin ||
      row.is_super_admin ||
      row.role === 'admin' ||
      row.role === 'super_admin',
  );

  if (returnTo.startsWith('/admin')) {
    return isAdmin ? returnTo : '/';
  }

  // Admin accounts should land in the admin dashboard even from the normal login page.
  if (isAdmin && returnTo === '/') return '/admin';

  return returnTo;
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshContext, ensureGuestSession } = useAuth();

  const routeState = location.state as LoginRouteState;
  const queryReturnTo = new URLSearchParams(location.search).get('returnTo');
  const returnTo = getSafeReturnTo(routeState?.returnTo ?? queryReturnTo);
  const isAdminLogin = returnTo.startsWith('/admin');

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [transitionMessage, setTransitionMessage] = useState('');

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    const storedMessage = window.sessionStorage.getItem(AUTH_MESSAGE_STORAGE_KEY);

    if (!storedMessage) return;

    window.sessionStorage.removeItem(AUTH_MESSAGE_STORAGE_KEY);
    setSubmitError(storedMessage);
  }, []);

  const resolveLoginEmail = async (cleanIdentifier: string) => {
    if (isEmailIdentifier(cleanIdentifier)) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanIdentifier)) {
        throw new Error('Invalid email format');
      }
      return cleanIdentifier.toLowerCase();
    }

    const normalizedPhone = normalizeBhutanPhone(cleanIdentifier);
    if (!normalizedPhone) {
      throw new Error('Enter a valid email or Bhutan mobile number.');
    }

    const { data, error } = await supabase.rpc('get_login_email_by_phone', {
      p_phone: normalizedPhone,
    });

    if (error) {
      throw new Error('Phone login is not ready. Please sign in with email.');
    }

    if (!data) {
      throw new Error('Invalid login details. Please check your phone/email and password.');
    }

    return String(data).toLowerCase();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    const cleanIdentifier = identifier.trim();

    if (!cleanIdentifier) {
      newErrors.identifier = 'Email or phone number is required';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Min 6 characters';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    setTransitionMessage('Checking account...');
    setSubmitError('');

    let loginEmail = '';

    try {
      loginEmail = await resolveLoginEmail(cleanIdentifier);
    } catch (err) {
      setSubmitting(false);
      setTransitionMessage('');
      setSubmitError(err instanceof Error ? err.message : 'Unable to sign in.');
      return;
    }

    const preLoginDeactivated = await isLoginEmailDeactivated(loginEmail);

    if (preLoginDeactivated) {
      setSubmitting(false);
      setTransitionMessage('');
      setSubmitError(DEACTIVATED_ACCOUNT_MESSAGE);
      return;
    }

    setTransitionMessage('Signing you in...');

    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    });

    if (error) {
      setSubmitting(false);
      setTransitionMessage('');
      setSubmitError('Invalid login details. Please check your email/phone and password.');
      return;
    }

    const deactivated = await isDeactivatedLoginUser(data.user?.id);

    if (deactivated) {
      await supabase.auth.signOut();
      setSubmitting(false);
      setTransitionMessage('');
      setSubmitError(DEACTIVATED_ACCOUNT_MESSAGE);
      return;
    }

    setTransitionMessage('Preparing your account...');
    let destination = returnTo;

    try {
      await refreshContext();
      destination = await getPostLoginDestination(returnTo);
    } catch (contextError) {
      console.warn('[Login] Context refresh skipped:', contextError);
    }

    setTransitionMessage(
      destination.startsWith('/admin') ? 'Opening admin panel...' : 'Welcome back',
    );
    await wait(180);
    setSubmitting(false);
    navigate(destination, { replace: true });
  };

  const handleGuestContinue = async () => {
    setSubmitting(true);
    setTransitionMessage('Starting guest session...');
    setSubmitError('');

    try {
      await ensureGuestSession();
      setTransitionMessage('Opening Shop2Bhutan...');
      await wait(160);
      navigate(returnTo, { replace: true });
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Unable to continue as guest. Please try again.',
      );
      setTransitionMessage('');
      setSubmitting(false);
    }
  };



  return (
    <div className="min-h-[100dvh] bg-white px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))]">
      <div className="relative mx-auto flex min-h-[calc(100dvh-3.25rem)] w-full max-w-md flex-col">
        <div className="flex justify-center">
          <div className="origin-center scale-[0.8]">
            <BrandLogo variant="full" className="justify-center" />
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-[30px] border border-neutral-100 bg-white shadow-[0_22px_65px_rgba(15,23,42,0.08)]">
          <div className="border-b border-neutral-100 bg-white px-6 py-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-orange-500">
                  {isAdminLogin ? 'Secure administration' : 'Shop2Bhutan account'}
                </p>
                <h1 className="mt-1 text-[26px] font-black tracking-tight text-neutral-950">
                  {isAdminLogin ? 'Admin sign in' : 'Welcome back'}
                </h1>
                <p className="mt-2 max-w-xs text-sm leading-6 text-neutral-500">
                  {isAdminLogin
                    ? 'Sign in with your authorized account to open the administration panel.'
                    : 'Sign in using your registered email or Bhutan mobile number.'}
                </p>
              </div>

              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-white text-orange-500 shadow-sm ring-1 ring-orange-100">
                {isAdminLogin ? (
                  <ShieldCheck size={24} strokeWidth={2.1} />
                ) : (
                  <User size={24} strokeWidth={2.1} />
                )}
              </div>
            </div>
          </div>

          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {submitError && (
                <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                    <AlertCircle size={16} strokeWidth={2.5} />
                  </div>
                  <p className="text-sm font-medium leading-5 text-red-700">
                    {submitError}
                  </p>
                </div>
              )}

              <div>
                <label
                  htmlFor="login-identifier"
                  className="mb-2 block text-[13px] font-bold text-neutral-800"
                >
                  Email or phone number
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
                    {identifier.includes('@') ? (
                      <Mail size={18} strokeWidth={1.9} />
                    ) : (
                      <Phone size={18} strokeWidth={1.9} />
                    )}
                  </div>
                  <input
                    id="login-identifier"
                    type="text"
                    value={identifier}
                    autoComplete="username"
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      setErrors((previous) => ({ ...previous, identifier: '' }));
                      setSubmitError('');
                    }}
                    placeholder="Email address or 17/77 mobile number"
                    className={`h-[52px] w-full rounded-2xl border bg-white pl-11 pr-4 text-[15px] font-medium text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:bg-white focus:ring-[3px] ${
                      errors.identifier
                        ? 'border-red-400 bg-red-50/50 focus:border-red-400 focus:ring-red-500/10'
                        : 'border-neutral-200 focus:border-orange-500 focus:ring-orange-500/10'
                    }`}
                  />
                </div>
                {errors.identifier && (
                  <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-red-500">
                    <AlertCircle size={12} strokeWidth={2.5} />
                    {errors.identifier}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="mb-2 block text-[13px] font-bold text-neutral-800"
                >
                  Password
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
                    <Lock size={18} strokeWidth={1.9} />
                  </div>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    autoComplete="current-password"
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrors((previous) => ({ ...previous, password: '' }));
                      setSubmitError('');
                    }}
                    placeholder="Enter your password"
                    className={`h-[52px] w-full rounded-2xl border bg-white pl-11 pr-12 text-[15px] font-medium text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:bg-white focus:ring-[3px] ${
                      errors.password
                        ? 'border-red-400 bg-red-50/50 focus:border-red-400 focus:ring-red-500/10'
                        : 'border-neutral-200 focus:border-orange-500 focus:ring-orange-500/10'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-2.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600 active:scale-95"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff size={18} strokeWidth={1.9} />
                    ) : (
                      <Eye size={18} strokeWidth={1.9} />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-red-500">
                    <AlertCircle size={12} strokeWidth={2.5} />
                    {errors.password}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between gap-4">
                <label className="flex cursor-pointer items-center gap-2.5">
                  <div className="relative flex shrink-0">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border-[1.5px] border-neutral-300 bg-neutral-50 transition checked:border-orange-500 checked:bg-orange-500 focus:outline-none focus:ring-[3px] focus:ring-orange-500/20"
                    />
                    <svg
                      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 transition-opacity peer-checked:opacity-100"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <span className="text-[13px] font-medium text-neutral-600">
                    Remember me
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="text-[13px] font-extrabold text-orange-500 transition hover:text-orange-600"
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 text-[15px] font-extrabold text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-600 hover:shadow-orange-500/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
              >
                {submitting && <Loader2 size={18} strokeWidth={2.5} className="animate-spin" />}
                {submitting
                  ? 'Signing in...'
                  : isAdminLogin
                    ? 'Sign In to Admin Panel'
                    : 'Sign In'}
              </button>
            </form>

            {!isAdminLogin && (
              <>
                <div className="my-6 flex items-center gap-3">
                  <div className="h-px flex-1 bg-neutral-200" />
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-neutral-400">
                    or continue without account
                  </span>
                  <div className="h-px flex-1 bg-neutral-200" />
                </div>

                <button
                  type="button"
                  onClick={handleGuestContinue}
                  disabled={submitting}
                  className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 text-sm font-bold text-neutral-700 transition hover:bg-neutral-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <Loader2 size={18} strokeWidth={2.5} className="animate-spin text-neutral-400" />
                  ) : (
                    <User size={18} strokeWidth={1.9} className="text-neutral-500" />
                  )}
                  Continue as Guest
                </button>

                <div className="mt-6 rounded-2xl border border-neutral-100 bg-white px-4 py-3 text-center">
                  <p className="text-sm font-medium text-neutral-600">
                    New to Shop2Bhutan?{' '}
                    <button
                      type="button"
                      onClick={() => navigate('/register', { state: { returnTo } })}
                      className="font-extrabold text-orange-500 transition hover:text-orange-600"
                    >
                      Create an account
                    </button>
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-auto flex items-center justify-center gap-1.5 pt-5 text-[11px] font-medium text-neutral-400">
          <ShieldCheck size={13} strokeWidth={2} />
          Secure login with encrypted connection
        </div>
      </div>

      {submitting && transitionMessage && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/95 px-6 backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <div className="relative flex h-16 w-16 items-center justify-center">
            <div
              className="absolute inset-0 animate-pulse rounded-[22px] bg-orange-100"
              style={{ animationDuration: '1.8s' }}
            />
            <div className="relative flex h-12 w-12 items-center justify-center rounded-[18px] bg-white shadow-lg ring-1 ring-orange-100">
              <Loader2 size={26} strokeWidth={2.2} className="animate-spin text-orange-500" />
            </div>
          </div>

          <h3 className="mt-5 text-base font-extrabold text-neutral-900">
            {transitionMessage}
          </h3>
          <p className="mt-1 text-center text-[13px] font-medium text-neutral-400">
            {transitionMessage === 'Welcome back'
              ? 'Good to see you again'
              : transitionMessage === 'Opening admin panel...'
                ? 'Taking you to your dashboard'
                : transitionMessage === 'Opening Shop2Bhutan...'
                  ? "Let's get shopping"
                  : 'This will only take a moment'}
          </p>
        </div>
      )}
    </div>
  );
}
