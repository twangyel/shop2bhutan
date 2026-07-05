import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, User, Phone } from 'lucide-react';
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
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <Logo size="xl" />
          <h1 className="text-2xl font-bold text-gray-900 mt-5">Welcome Back</h1>
          <p className="text-sm text-gray-500 mt-1">
            Sign in with email or Bhutan mobile number
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {submitError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {submitError}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Email or phone number
            </label>
            <div className="relative">
              {identifier.includes('@') ? (
                <Mail
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
              ) : (
                <Phone
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
              )}
              <input
                type="text"
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  setErrors((p) => ({ ...p, identifier: '' }));
                  setSubmitError('');
                }}
                placeholder="your@email.com or 17123456"
                className={`w-full h-12 pl-10 pr-4 border rounded-2xl text-sm outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 ${
                  errors.identifier ? 'border-red-400' : 'border-gray-300'
                }`}
              />
            </div>
            {errors.identifier && (
              <p className="text-xs text-red-500 mt-1">{errors.identifier}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrors((p) => ({ ...p, password: '' }));
                  setSubmitError('');
                }}
                placeholder="Enter your password"
                className={`w-full h-12 pl-10 pr-10 border rounded-2xl text-sm outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 ${
                  errors.password ? 'border-red-400' : 'border-gray-300'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-red-500 mt-1">{errors.password}</p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
              />
              <span className="text-sm text-gray-600">Remember me</span>
            </label>
            <button
              type="button"
              onClick={() => navigate('/forgot-password')}
              className="text-sm text-orange-500 font-medium"
            >
              Forgot Password?
            </button>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-12 bg-orange-500 text-white font-semibold rounded-2xl hover:bg-orange-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">or</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <button
          type="button"
          onClick={handleGuestContinue}
          disabled={submitting}
          className="w-full h-11 flex items-center justify-center gap-2 border border-gray-200 bg-white text-gray-700 font-medium rounded-2xl hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <User size={18} />
          <span className="text-sm">Continue as Guest</span>
        </button>

        <p className="text-center text-sm text-gray-500 mt-6">
          Don&apos;t have an account?{' '}
          <button
            type="button"
            onClick={() => navigate('/register', { state: { returnTo } })}
            className="text-orange-500 font-semibold"
          >
            Register
          </button>
        </p>
      </div>
    </div>
  );
}
