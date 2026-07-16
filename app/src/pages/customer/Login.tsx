import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { AlertCircle, Loader2, Mail, Lock, Eye, EyeOff, User, Phone, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import BrandLogo from '@/components/BrandLogo';
import { useAppToast } from '@/components/shared/AppToast';


const AUTH_MESSAGE_STORAGE_KEY = 'shop2bhutan:auth-message';
const GOOGLE_OAUTH_PENDING_KEY = 'shop2bhutan:google-oauth-pending';
const GOOGLE_OAUTH_RETURN_TO_KEY = 'shop2bhutan:google-oauth-return-to';
const GOOGLE_AUTH_ENABLED =
  String(import.meta.env.VITE_GOOGLE_AUTH_ENABLED ?? '')
    .trim()
    .toLowerCase() === 'true';

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

function getOAuthErrorMessage() {
  if (typeof window === 'undefined') return '';

  const queryParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

  const message =
    queryParams.get('error_description') ??
    queryParams.get('error') ??
    hashParams.get('error_description') ??
    hashParams.get('error');

  return message ? message.replace(/\+/g, ' ') : '';
}

function getGoogleRedirectUrl(returnTo: string) {
  const callbackUrl = Capacitor.isNativePlatform()
    ? new URL('com.shop2bhutan.app://login')
    : new URL('/login', window.location.origin);

  callbackUrl.searchParams.set('oauth', 'google');
  callbackUrl.searchParams.set('returnTo', returnTo);
  return callbackUrl.toString();
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
  const { showToast } = useAppToast();
  const location = useLocation();
  const {
    loading: authLoading,
    user,
    isGuest,
    refreshContext,
    ensureGuestSession,
  } = useAuth();

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

  useEffect(() => {
    if (!submitError) return;

    const normalized = submitError.toLowerCase();
    const title = normalized.includes('deactivated')
      ? 'Account deactivated'
      : normalized.includes('google')
        ? 'Google sign-in failed'
        : normalized.includes('invalid login')
          ? 'Sign in failed'
          : 'Unable to sign in';

    showToast({
      type: 'error',
      title,
      message: submitError,
    });
  }, [showToast, submitError]);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [transitionMessage, setTransitionMessage] = useState('');
  const oauthHandledRef = useRef(false);
  const busy = submitting || googleSubmitting;

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    const storedMessage = window.sessionStorage.getItem(AUTH_MESSAGE_STORAGE_KEY);

    if (!storedMessage) return;

    window.sessionStorage.removeItem(AUTH_MESSAGE_STORAGE_KEY);
    setSubmitError(storedMessage);
  }, []);

  useEffect(() => {
    const oauthError = getOAuthErrorMessage();

    if (!oauthError) return;

    window.sessionStorage.removeItem(GOOGLE_OAUTH_PENDING_KEY);
    window.sessionStorage.removeItem(GOOGLE_OAUTH_RETURN_TO_KEY);
    setGoogleSubmitting(false);
    setTransitionMessage('');
    setSubmitError(`Google sign-in failed: ${oauthError}`);
  }, []);

  useEffect(() => {
    if (
      !GOOGLE_AUTH_ENABLED ||
      authLoading ||
      !user?.id ||
      isGuest ||
      oauthHandledRef.current
    ) {
      return;
    }

    const queryParams = new URLSearchParams(location.search);
    const isGoogleCallback =
      queryParams.get('oauth') === 'google' ||
      window.sessionStorage.getItem(GOOGLE_OAUTH_PENDING_KEY) === 'true';

    if (!isGoogleCallback) return;

    oauthHandledRef.current = true;
    setGoogleSubmitting(true);
    setTransitionMessage('Finishing Google sign in...');
    setSubmitError('');

    void (async () => {
      try {
        const deactivated = await isDeactivatedLoginUser(user.id);

        if (deactivated) {
          await supabase.auth.signOut();
          window.sessionStorage.removeItem(GOOGLE_OAUTH_PENDING_KEY);
          window.sessionStorage.removeItem(GOOGLE_OAUTH_RETURN_TO_KEY);
          setGoogleSubmitting(false);
          setTransitionMessage('');
          setSubmitError(DEACTIVATED_ACCOUNT_MESSAGE);
          oauthHandledRef.current = false;
          return;
        }

        await refreshContext();

        const savedReturnTo = getSafeReturnTo(
          window.sessionStorage.getItem(GOOGLE_OAUTH_RETURN_TO_KEY),
        );
        const requestedReturnTo =
          savedReturnTo !== '/' ? savedReturnTo : returnTo;
        const destination = await getPostLoginDestination(requestedReturnTo);

        window.sessionStorage.removeItem(GOOGLE_OAUTH_PENDING_KEY);
        window.sessionStorage.removeItem(GOOGLE_OAUTH_RETURN_TO_KEY);

        setTransitionMessage(
          destination.startsWith('/admin')
            ? 'Opening admin panel...'
            : 'Welcome to Shop2Bhutan',
        );
        await wait(180);
        showToast({
          type: 'success',
          title: destination.startsWith('/admin')
            ? 'Admin access ready'
            : 'Welcome back',
          message: destination.startsWith('/admin')
            ? 'Opening your Shop2Bhutan administration panel.'
            : 'You have signed in successfully.',
        });
        navigate(destination, { replace: true });
      } catch (error) {
        console.error('[Login] Google sign-in completion failed:', error);
        window.sessionStorage.removeItem(GOOGLE_OAUTH_PENDING_KEY);
        window.sessionStorage.removeItem(GOOGLE_OAUTH_RETURN_TO_KEY);
        setGoogleSubmitting(false);
        setTransitionMessage('');
        setSubmitError('Google sign-in could not be completed. Please try again.');
        oauthHandledRef.current = false;
      }
    })();
  }, [
    authLoading,
    isGuest,
    location.search,
    navigate,
    refreshContext,
    returnTo,
    showToast,
    user?.id,
  ]);

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


  const handleGoogleLogin = async () => {
    if (!GOOGLE_AUTH_ENABLED || busy) return;

    setGoogleSubmitting(true);
    setTransitionMessage('Opening Google sign in...');
    setSubmitError('');

    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      const isAnonymousSession = Boolean(
        (currentSession?.user as { is_anonymous?: boolean } | undefined)
          ?.is_anonymous,
      );

      if (isAnonymousSession) {
        await supabase.auth.signOut();
      }

      window.sessionStorage.setItem(GOOGLE_OAUTH_PENDING_KEY, 'true');
      window.sessionStorage.setItem(GOOGLE_OAUTH_RETURN_TO_KEY, returnTo);

      const isNative = Capacitor.isNativePlatform();

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getGoogleRedirectUrl(returnTo),
          skipBrowserRedirect: isNative,
          queryParams: {
            prompt: 'select_account',
          },
        },
      });

      if (error) throw error;

      if (isNative) {
        if (!data.url) {
          throw new Error('Google sign-in URL was not created.');
        }

        await Browser.open({ url: data.url });
      }
    } catch (error) {
      console.error('[Login] Google sign-in failed:', error);
      window.sessionStorage.removeItem(GOOGLE_OAUTH_PENDING_KEY);
      window.sessionStorage.removeItem(GOOGLE_OAUTH_RETURN_TO_KEY);
      setGoogleSubmitting(false);
      setTransitionMessage('');
      setSubmitError(
        error instanceof Error
          ? error.message
          : 'Unable to open Google sign-in. Please try again.',
      );
    }
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
      showToast({
        type: 'warning',
        title: 'Check your sign-in details',
        message: 'Enter your registered email or Bhutan phone number and password.',
      });
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
    showToast({
      type: 'success',
      title: destination.startsWith('/admin')
        ? 'Admin access ready'
        : 'Welcome back',
      message: destination.startsWith('/admin')
        ? 'Opening your Shop2Bhutan administration panel.'
        : 'You have signed in successfully.',
    });
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
    <div className="min-h-[100dvh] bg-white px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] sm:px-5">
      <div className="mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-md flex-col">
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-orange-100 bg-orange-50">
              <div className="origin-center scale-[0.62]">
                <BrandLogo variant="mark" />
              </div>
            </div>

            <div className="min-w-0">
              <p className="truncate text-[15px] font-black tracking-tight text-neutral-950">
                Shop2Bhutan
              </p>
              <p className="truncate text-[11px] font-semibold text-neutral-400">
                {isAdminLogin ? 'Secure administration' : 'Secure account access'}
              </p>
            </div>
          </div>

          {!isAdminLogin && (
            <button
              type="button"
              onClick={() => navigate('/register', { state: { returnTo } })}
              className="shrink-0 rounded-full border border-neutral-200 bg-white px-3.5 py-2 text-xs font-extrabold text-neutral-700 transition hover:bg-neutral-50 active:scale-[0.97]"
            >
              Create account
            </button>
          )}
        </header>

        <main className="flex flex-1 items-start py-7 sm:items-center sm:py-10">
          <div className="w-full">
            <div className="px-1">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-orange-500">
                {isAdminLogin ? 'Authorized access only' : 'Welcome back'}
              </p>
              <h1 className="mt-1 text-[30px] font-black tracking-[-0.035em] text-neutral-950">
                {isAdminLogin ? 'Admin sign in' : 'Sign in to continue'}
              </h1>
              <p className="mt-2 max-w-sm text-sm leading-6 text-neutral-500">
                {isAdminLogin
                  ? 'Use your authorized account to open the Shop2Bhutan administration panel.'
                  : 'Access your quotations, payments, orders, parcels, and account updates.'}
              </p>
            </div>

            <div className="mt-5 rounded-[28px] border border-neutral-100 bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.07)] sm:p-6">
              {!isAdminLogin && GOOGLE_AUTH_ENABLED && (
                <>
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={busy}
                    className="flex h-[50px] w-full items-center justify-center gap-3 rounded-2xl border border-neutral-200 bg-white text-[14px] font-extrabold text-neutral-800 transition hover:bg-neutral-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {googleSubmitting ? (
                      <Loader2
                        size={18}
                        strokeWidth={2.4}
                        className="animate-spin text-neutral-500"
                      />
                    ) : (
                      <svg
                        width="19"
                        height="19"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          fill="#4285F4"
                          d="M21.35 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.24a4.48 4.48 0 0 1-1.94 2.94v2.52h3.14c1.84-1.69 2.91-4.18 2.91-7.29Z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 21.75c2.62 0 4.82-.87 6.43-2.36l-3.14-2.52c-.87.58-1.99.93-3.29.93-2.53 0-4.68-1.71-5.45-4.01H3.31v2.6A9.72 9.72 0 0 0 12 21.75Z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M6.55 13.79A5.84 5.84 0 0 1 6.25 12c0-.62.11-1.22.3-1.79v-2.6H3.31A9.75 9.75 0 0 0 2.25 12c0 1.57.38 3.05 1.06 4.39l3.24-2.6Z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 6.2c1.43 0 2.72.49 3.73 1.45l2.79-2.79A9.37 9.37 0 0 0 12 2.25a9.72 9.72 0 0 0-8.69 5.36l3.24 2.6C7.32 7.91 9.47 6.2 12 6.2Z"
                        />
                      </svg>
                    )}
                    {googleSubmitting
                      ? 'Connecting to Google...'
                      : 'Continue with Google'}
                  </button>

                  <div className="my-4 flex items-center gap-3">
                    <div className="h-px flex-1 bg-neutral-200" />
                    <span className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-neutral-400">
                      or use your account
                    </span>
                    <div className="h-px flex-1 bg-neutral-200" />
                  </div>
                </>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="login-identifier"
                    className="mb-1.5 block text-[13px] font-bold text-neutral-800"
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
                      onChange={(event) => {
                        setIdentifier(event.target.value);
                        setErrors((previous) => ({
                          ...previous,
                          identifier: '',
                        }));
                        setSubmitError('');
                      }}
                      placeholder="Email or 17/77 mobile number"
                      className={`h-[50px] w-full rounded-2xl border bg-white pl-11 pr-4 text-[15px] font-medium text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:ring-[3px] ${
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
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <label
                      htmlFor="login-password"
                      className="text-[13px] font-bold text-neutral-800"
                    >
                      Password
                    </label>

                    <button
                      type="button"
                      onClick={() => navigate('/forgot-password')}
                      className="text-xs font-extrabold text-orange-500 transition hover:text-orange-600"
                    >
                      Forgot password?
                    </button>
                  </div>

                  <div className="relative">
                    <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
                      <Lock size={18} strokeWidth={1.9} />
                    </div>

                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      autoComplete="current-password"
                      onChange={(event) => {
                        setPassword(event.target.value);
                        setErrors((previous) => ({
                          ...previous,
                          password: '',
                        }));
                        setSubmitError('');
                      }}
                      placeholder="Enter your password"
                      className={`h-[50px] w-full rounded-2xl border bg-white pl-11 pr-12 text-[15px] font-medium text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:ring-[3px] ${
                        errors.password
                          ? 'border-red-400 bg-red-50/50 focus:border-red-400 focus:ring-red-500/10'
                          : 'border-neutral-200 focus:border-orange-500 focus:ring-orange-500/10'
                      }`}
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute right-2.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600 active:scale-95"
                      aria-label={
                        showPassword ? 'Hide password' : 'Show password'
                      }
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

                <label className="inline-flex cursor-pointer items-center gap-2.5">
                  <span className="relative flex shrink-0">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(event) =>
                        setRememberMe(event.target.checked)
                      }
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
                  </span>

                  <span className="text-[13px] font-medium text-neutral-600">
                    Keep me signed in
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={busy}
                  className="flex h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 text-[15px] font-extrabold text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
                >
                  {submitting && (
                    <Loader2
                      size={18}
                      strokeWidth={2.5}
                      className="animate-spin"
                    />
                  )}
                  {submitting
                    ? 'Signing in...'
                    : isAdminLogin
                      ? 'Sign In to Admin Panel'
                      : 'Sign In'}
                </button>
              </form>

              {!isAdminLogin && (
                <>
                  <div className="my-4 h-px bg-neutral-100" />

                  <button
                    type="button"
                    onClick={handleGuestContinue}
                    disabled={busy}
                    className="flex h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-neutral-50 text-sm font-bold text-neutral-700 transition hover:bg-neutral-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? (
                      <Loader2
                        size={18}
                        strokeWidth={2.5}
                        className="animate-spin text-neutral-400"
                      />
                    ) : (
                      <User
                        size={18}
                        strokeWidth={1.9}
                        className="text-neutral-500"
                      />
                    )}
                    Continue as Guest
                  </button>

                  <p className="mt-4 text-center text-sm font-medium text-neutral-500">
                    New to Shop2Bhutan?{' '}
                    <button
                      type="button"
                      onClick={() =>
                        navigate('/register', { state: { returnTo } })
                      }
                      className="font-extrabold text-orange-500 transition hover:text-orange-600"
                    >
                      Create an account
                    </button>
                  </p>
                </>
              )}
            </div>
          </div>
        </main>

        <footer className="flex items-center justify-center gap-1.5 pb-1 text-[11px] font-medium text-neutral-400">
          <ShieldCheck size={13} strokeWidth={2} />
          Secure login with encrypted connection
        </footer>
      </div>

      {busy && transitionMessage && (
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
              <Loader2
                size={26}
                strokeWidth={2.2}
                className="animate-spin text-orange-500"
              />
            </div>
          </div>

          <h3 className="mt-5 text-base font-extrabold text-neutral-900">
            {transitionMessage}
          </h3>
          <p className="mt-1 text-center text-[13px] font-medium text-neutral-400">
            {transitionMessage === 'Welcome back'
              ? 'Good to see you again'
              : transitionMessage === 'Welcome to Shop2Bhutan'
                ? 'Your account is ready'
                : transitionMessage === 'Finishing Google sign in...'
                  ? 'Securely preparing your account'
                  : transitionMessage === 'Opening Google sign in...'
                    ? 'Choose your Google account'
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
