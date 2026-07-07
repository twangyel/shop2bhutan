import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, Loader2, Mail, Lock, Eye, EyeOff, User, Phone, ShieldCheck } from 'lucide-react';
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

  const isSuccessState =
    transitionMessage === 'Welcome back' ||
    transitionMessage === 'Opening admin panel...' ||
    transitionMessage === 'Opening Shop2Bhutan...';

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-white">
      {/* Header Area */}
      <div className="flex flex-col items-center px-6 pb-6 pt-6">
        <div className="mb-3 origin-center scale-[0.85]">
          <BrandLogo variant="full" className="justify-center" />
        </div>

        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
          {isAdminLogin ? 'Admin Sign In' : 'Welcome Back'}
        </h1>
        <p className="mt-1.5 text-center text-[13px] font-medium text-gray-500">
          {isAdminLogin
            ? 'Sign in to continue to the admin panel'
            : 'Sign in with email or Bhutan mobile number'}
        </p>
      </div>

      {/* Form Area */}
      <div className="flex-1 px-6 pb-6">
        <div className="mx-auto w-full max-w-sm px-6 pb-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {submitError && (
              <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                  <AlertCircle size={16} strokeWidth={2.5} />
                </div>
                <p className="text-sm font-medium leading-relaxed text-red-700">
                  {submitError}
                </p>
              </div>
            )}

            {/* Email/Phone Input */}
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-gray-800">
                Email or phone number
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                  {identifier.includes('@') ? (
                    <Mail size={18} strokeWidth={1.8} />
                  ) : (
                    <Phone size={18} strokeWidth={1.8} />
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
                  className={`h-[52px] w-full rounded-[14px] border bg-gray-50 pl-11 pr-4 text-[14px] font-medium text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-orange-500 focus:bg-white focus:ring-[3px] focus:ring-orange-500/10 ${
                    errors.identifier ? 'border-red-400 bg-red-50/50 focus:border-red-400 focus:ring-red-500/10' : 'border-gray-200'
                  }`}
                />
              </div>
              {errors.identifier && (
                <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-500">
                  <AlertCircle size={12} strokeWidth={2.5} />
                  {errors.identifier}
                </p>
              )}
            </div>

            {/* Password Input */}
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-gray-800">
                Password
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <Lock size={18} strokeWidth={1.8} />
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
                  className={`h-[52px] w-full rounded-[14px] border bg-gray-50 pl-11 pr-11 text-[14px] font-medium text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-orange-500 focus:bg-white focus:ring-[3px] focus:ring-orange-500/10 ${
                    errors.password ? 'border-red-400 bg-red-50/50 focus:border-red-400 focus:ring-red-500/10' : 'border-gray-200'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={18} strokeWidth={1.8} /> : <Eye size={18} strokeWidth={1.8} />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-500">
                  <AlertCircle size={12} strokeWidth={2.5} />
                  {errors.password}
                </p>
              )}
            </div>

            {/* Remember Me / Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2.5">
                <div className="relative flex shrink-0">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="peer h-5 w-5 cursor-pointer appearance-none rounded-[6px] border-[1.5px] border-gray-300 bg-gray-50 transition-all checked:border-orange-500 checked:bg-orange-500 focus:outline-none focus:ring-[3px] focus:ring-orange-500/20"
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
                <span className="text-[13px] font-medium text-gray-600">Remember me</span>
              </label>
              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="text-[13px] font-semibold text-gray-500 transition-colors hover:text-orange-600"
              >
                Forgot Password?
              </button>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={submitting}
              className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-orange-500 text-[15px] font-bold text-white shadow-lg shadow-orange-500/20 transition-all hover:bg-orange-600 hover:shadow-orange-500/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
            >
              {submitting ? (
                <>
                  <Loader2 size={18} strokeWidth={2.5} className="animate-spin" />
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
              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">or</span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              {/* Guest Button */}
              <button
                type="button"
                onClick={handleGuestContinue}
                disabled={submitting}
                className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] border border-gray-200 bg-white font-semibold text-gray-700 transition-all hover:bg-gray-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 size={18} strokeWidth={2.5} className="animate-spin text-gray-400" />
                ) : (
                  <User size={18} strokeWidth={1.8} className="text-gray-500" />
                )}
                <span className="text-[14px]">Continue as Guest</span>
              </button>

              {/* Register Link */}
              <p className="mt-6 text-center text-[13px] font-medium text-gray-500">
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => navigate('/register', { state: { returnTo } })}
                  className="font-bold text-orange-500 transition-colors hover:text-orange-600"
                >
                  Register
                </button>
              </p>
            </>
          )}

          {/* Trust Signal */}
          <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] font-medium text-gray-400">
            <ShieldCheck size={13} strokeWidth={2} className="text-gray-400" />
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