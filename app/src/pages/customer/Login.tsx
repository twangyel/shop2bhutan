import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, User, Phone, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import Logo from '@/components/shared/Logo';

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

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshContext, ensureGuestSession } = useAuth();

  const routeState = location.state as LoginRouteState;
  const returnTo = getSafeReturnTo(routeState?.returnTo);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
    setSubmitError('');

    let loginEmail = '';

    try {
      loginEmail = await resolveLoginEmail(cleanIdentifier);
    } catch (err) {
      setSubmitting(false);
      setSubmitError(err instanceof Error ? err.message : 'Unable to sign in.');
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    });

    setSubmitting(false);

    if (error) {
      setSubmitError('Invalid login details. Please check your email/phone and password.');
      return;
    }

    await refreshContext();
    navigate(returnTo, { replace: true });
  };

  const handleGuestContinue = async () => {
    setSubmitting(true);
    setSubmitError('');

    try {
      await ensureGuestSession();
      navigate(returnTo, { replace: true });
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Unable to continue as guest. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header Area */}
      <div className="flex flex-col items-center pt-12 pb-8 px-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-orange-500 shadow-lg shadow-orange-500/20">
          <Logo size="xl" />
        </div>
        <h1 className="text-2xl font-bold text-neutral-900 mt-5">Welcome Back</h1>
        <p className="text-sm text-neutral-500 mt-1.5 text-center">
          Sign in with email or Bhutan mobile number
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
                  className={`h-12 w-full rounded-2xl border bg-white pl-11 pr-4 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 ${
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
                  className={`h-12 w-full rounded-2xl border bg-white pl-11 pr-11 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 ${
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
                  className="h-4 w-4 rounded border-neutral-300 text-orange-500 focus:ring-orange-500"
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
              className="h-12 w-full rounded-2xl bg-orange-500 font-bold text-white shadow-sm transition hover:bg-orange-600 active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
            >
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

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
            <User size={18} />
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

          {/* Trust Signal */}
          <div className="mt-8 flex items-center justify-center gap-1.5 text-[11px] text-neutral-400">
            <ShieldCheck size={13} />
            <span>Secure login with encrypted connection</span>
          </div>
        </div>
      </div>
    </div>
  );
}
