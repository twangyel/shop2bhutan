import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle, Loader2, Mail, Lock, Eye, EyeOff, User, Phone, ShieldCheck } from 'lucide-react';
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

  const isSuccessState =
    transitionMessage === 'Welcome back' ||
    transitionMessage === 'Opening admin panel...' ||
    transitionMessage === 'Opening Shop2Bhutan...';

  return (
    <div className="relative min-h-screen overflow-hidden bg-white flex flex-col">
      {/* Header Area */}
      <div className="flex flex-col items-center pt-12 pb-8 px-6">
  <BrandLogo
    variant="full"
    className="justify-center"
    imgClassName="h-20 w-auto max-w-[240px]"
  />

  <h1 className="text-2xl font-bold text-neutral-900 mt-5">
    {isAdminLogin ? 'Admin Sign In' : 'Welcome Back'}
  </h1>
        <p className="text-sm text-neutral-500 mt-1.5 text-center">
          {isAdminLogin
            ? 'Sign in to continue to the admin panel'
            : 'Sign in with email or Bhutan mobile number'}
        </p>
      </div>

      {/* Form Area */}
      <div className="flex-1 px-6 pb-8">
        <div className="mx-auto w-full max-w-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            {submitError && (
              <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                {submitError}
              </div>
            )}

            {/* Email/Phone Input */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-neutral-700">
                Email or phone number
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
                  {identifier.includes('@') ? (
                    <Mail size={18} />
                  ) : (
                    <Phone size={18} />
                  )}
                </div>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    setErrors((p) => ({ ...p, identifier: '' }));
                    setSubmitError('');
                  }}
                  placeholder="your@email.com or 17123456"
                  className={`h-12 w-full rounded-2xl border bg-neutral-50 pl-11 pr-4 text-sm outline-none transition focus:border-orange-500 focus:bg-white focus:ring-2 focus:ring-orange-500/10 ${
                    errors.identifier ? 'border-red-400' : 'border-neutral-200'
                  }`}
                />
              </div>
              {errors.identifier && (
                <p className="mt-1.5 text-xs text-red-500">{errors.identifier}</p>
              )}
            </div>

            {/* Password Input */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-neutral-700">
                Password
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrors((p) => ({ ...p, password: '' }));
                    setSubmitError('');
                  }}
                  placeholder="Enter your password"
                  className={`h-12 w-full rounded-2xl border bg-neutral-50 pl-11 pr-11 text-sm outline-none transition focus:border-orange-500 focus:bg-white focus:ring-2 focus:ring-orange-500/10 ${
                    errors.password ? 'border-red-400' : 'border-neutral-200'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs text-red-500">{errors.password}</p>
              )}
            </div>

            {/* Remember Me / Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-5 w-5 rounded border-neutral-300 text-orange-500 focus:ring-orange-500"
                />
                <span className="text-sm text-neutral-600">Remember me</span>
              </label>
              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="text-sm font-semibold text-neutral-500 hover:text-orange-600 transition"
              >
                Forgot Password?
              </button>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={submitting}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 font-bold text-white shadow-sm transition hover:bg-orange-600 active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Signing in...
                </>
              ) : isAdminLogin ? (
                'Sign In to Admin Panel'
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {!isAdminLogin && (
            <>
              {/* Divider */}
              <div className="flex items-center gap-3 my-6">
                <div className="h-px flex-1 bg-neutral-100" />
                <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">or</span>
                <div className="h-px flex-1 bg-neutral-100" />
              </div>

              {/* Guest Button */}
              <button
                type="button"
                onClick={handleGuestContinue}
                disabled={submitting}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 font-semibold text-neutral-700 transition hover:bg-neutral-100 active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
              >
                {submitting ? <Loader2 size={18} className="animate-spin" /> : <User size={18} />}
                <span className="text-sm">Continue as Guest</span>
              </button>

              {/* Register Link */}
              <p className="mt-6 text-center text-sm text-neutral-500">
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => navigate('/register', { state: { returnTo } })}
                  className="font-bold text-orange-500 hover:text-orange-600 transition"
                >
                  Register
                </button>
              </p>
            </>
          )}

          {/* Trust Signal */}
          <div className="mt-8 flex items-center justify-center gap-1.5 text-[11px] text-neutral-400">
            <ShieldCheck size={13} />
            <span>Secure login with encrypted connection</span>
          </div>
        </div>
      </div>

      {/* ===== REDESIGNED LOADING OVERLAY ===== */}
      {submitting && transitionMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-xl">
          <div className="w-full max-w-[300px] rounded-[2rem] bg-white p-8 text-center shadow-[0_24px_80px_-20px_rgba(0,0,0,0.08)] ring-1 ring-neutral-900/5">
            {/* Icon with ambient pulse */}
            <div className="relative mx-auto flex h-[72px] w-[72px] items-center justify-center">
              {!isSuccessState && (
                <>
                  <div
                    className="absolute inset-0 rounded-[1.25rem] bg-orange-500/5 animate-ping"
                    style={{ animationDuration: '2s' }}
                  />
                  <div
                    className="absolute inset-[-6px] rounded-[1.5rem] bg-orange-500/[0.03] animate-pulse"
                    style={{ animationDuration: '3s' }}
                  />
                </>
              )}
              <div className="relative flex h-16 w-16 items-center justify-center rounded-[1.25rem] bg-orange-50 text-orange-500 transition-all duration-300">
                {isSuccessState ? (
                  <CheckCircle size={32} />
                ) : (
                  <Loader2 size={32} className="animate-spin" />
                )}
              </div>
            </div>

            {/* Title */}
            <h3 className="mt-6 text-lg font-bold text-neutral-900 tracking-tight">
              {transitionMessage}
            </h3>

            {/* Dynamic subtitle */}
            <p className="mt-2 text-sm text-neutral-400 leading-relaxed">
              {transitionMessage === 'Welcome back'
                ? 'Good to see you again'
                : transitionMessage === 'Opening admin panel...'
                ? 'Taking you to your dashboard'
                : transitionMessage === 'Opening Shop2Bhutan...'
                ? "Let's get shopping"
                : 'This will only take a moment'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}