import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type RouteState = {
  forced?: boolean;
  returnTo?: string;
} | null;

type PasswordChangeCompletion = {
  userId: string;
  forced: boolean;
  returnTo: string;
  at: number;
};

const PASSWORD_CHANGE_SUCCESS_KEY = 'shop2bhutan:password-change-success';
const PASSWORD_CHANGE_SUCCESS_TTL_MS = 5 * 60 * 1000;

function mustChangePassword(profile: unknown) {
  const row = (profile ?? {}) as {
    must_change_password?: boolean | null;
    mustChangePassword?: boolean | null;
  };

  return Boolean(row.must_change_password ?? row.mustChangePassword ?? false);
}

function getSafeReturnTo(value: unknown) {
  if (typeof value !== 'string') return '/';
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  if (value.startsWith('/login') || value.startsWith('/register')) return '/';
  if (value.startsWith('/change-password')) return '/';
  return value;
}

function readPasswordChangeCompletion(userId?: string | null): PasswordChangeCompletion | null {
  if (typeof window === 'undefined' || !userId) return null;

  try {
    const raw = window.sessionStorage.getItem(PASSWORD_CHANGE_SUCCESS_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<PasswordChangeCompletion>;

    if (parsed.userId !== userId) return null;
    if (typeof parsed.at !== 'number') return null;
    if (Date.now() - parsed.at > PASSWORD_CHANGE_SUCCESS_TTL_MS) {
      window.sessionStorage.removeItem(PASSWORD_CHANGE_SUCCESS_KEY);
      return null;
    }

    return {
      userId,
      forced: Boolean(parsed.forced),
      returnTo: getSafeReturnTo(parsed.returnTo),
      at: parsed.at,
    };
  } catch {
    window.sessionStorage.removeItem(PASSWORD_CHANGE_SUCCESS_KEY);
    return null;
  }
}

function rememberPasswordChangeCompletion(completion: PasswordChangeCompletion) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(PASSWORD_CHANGE_SUCCESS_KEY, JSON.stringify(completion));
}

function clearPasswordChangeCompletion() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(PASSWORD_CHANGE_SUCCESS_KEY);
}

export default function ChangePassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, context, refreshContext } = useAuth();

  const routeState = location.state as RouteState;
  const forcedByRoute = Boolean(routeState?.forced);
  const forcedByProfile = mustChangePassword(context?.profile);
  const [forcedSession, setForcedSession] = useState(() => forcedByRoute || forcedByProfile);
  const [completion, setCompletion] = useState<PasswordChangeCompletion | null>(() =>
    readPasswordChangeCompletion(user?.id),
  );

  useEffect(() => {
    if (forcedByRoute || forcedByProfile) {
      setForcedSession(true);
    }
  }, [forcedByRoute, forcedByProfile]);

  useEffect(() => {
    const savedCompletion = readPasswordChangeCompletion(user?.id);
    if (savedCompletion) {
      setCompletion(savedCompletion);
    }
  }, [user?.id]);

  const completed = Boolean(completion);
  const forced = forcedSession && !completed;
  const returnTo = useMemo(
    () => getSafeReturnTo(routeState?.returnTo),
    [routeState?.returnTo],
  );

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const resetScroll = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    };

    resetScroll();
    const frame = window.requestAnimationFrame(resetScroll);

    return () => window.cancelAnimationFrame(frame);
  }, []);

  const clearMustChangePasswordFlag = async () => {
    if (!forcedSession || !user?.id) return;

    const rpcResult = await supabase.rpc('clear_my_must_change_password');
    if (!rpcResult.error) return;

    const now = new Date().toISOString();
    const fallback = await supabase
      .from('profiles')
      .update({
        must_change_password: false,
        password_changed_at: now,
        updated_at: now,
      })
      .eq('id', user.id);

    if (fallback.error) {
      throw new Error(
        'Password changed, but the temporary-password flag could not be cleared. Please contact Shop2Bhutan admin.',
      );
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    setError('');

    if (!user?.id || !user.email) {
      setError('Please sign in again before changing your password.');
      return;
    }

    if (!forced && !currentPassword) {
      setError('Current password is required.');
      return;
    }

    if (!newPassword) {
      setError('New password is required.');
      return;
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }

    if (!forced && newPassword === currentPassword) {
      setError('New password must be different from your current password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match.');
      return;
    }

    setSubmitting(true);

    try {
      if (!forced) {
        const { error: verifyError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword,
        });

        if (verifyError) {
          setError('Current password is incorrect. Please try again.');
          return;
        }
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError(updateError.message || 'Unable to update password. Please try again.');
        return;
      }

      await clearMustChangePasswordFlag();

      const nextCompletion: PasswordChangeCompletion = {
        userId: user.id,
        forced: forcedSession,
        returnTo,
        at: Date.now(),
      };

      rememberPasswordChangeCompletion(nextCompletion);
      setCompletion(nextCompletion);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to update password. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleContinue = async () => {
    setSubmitting(true);
    try {
      await refreshContext();
    } catch (contextError) {
      console.warn('[ChangePassword] Context refresh skipped:', contextError);
    } finally {
      const nextPath = completion?.forced ? completion.returnTo : '/account';
      clearPasswordChangeCompletion();
      setSubmitting(false);
      navigate(nextPath, { replace: true });
    }
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4 py-8">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
            <KeyRound size={28} />
          </div>
          <h1 className="mt-4 text-xl font-bold text-neutral-900">Sign in required</h1>
          <p className="mt-2 text-sm text-neutral-500">Please sign in to change your password.</p>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="mt-5 h-12 w-full rounded-2xl bg-orange-500 font-bold text-white transition hover:bg-orange-600 active:scale-[0.98]"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4 py-8">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600">
            <CheckCircle size={38} />
          </div>

          <h1 className="mt-5 text-2xl font-bold text-neutral-900">Password updated</h1>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            {completion?.forced
              ? 'Your temporary password has been replaced. You can now continue using Shop2Bhutan with your new password.'
              : 'Your Shop2Bhutan password has been updated. Use your new password the next time you sign in.'}
          </p>

          <button
            type="button"
            onClick={handleContinue}
            disabled={submitting}
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 font-bold text-white transition hover:bg-orange-600 active:scale-[0.98] disabled:opacity-60"
          >
            {submitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
            {completion?.forced ? 'Continue to Shop2Bhutan' : 'Back to Account'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-[calc(2rem+env(safe-area-inset-bottom))]">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-neutral-100 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-md px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-orange-500">Account security</p>
            <h1 className="mt-0.5 text-xl font-black tracking-tight text-neutral-950">
              {forced ? 'Update Password' : 'Change Password'}
            </h1>
            <p className="text-xs text-neutral-500">
              {forced
                ? 'Create your own password to continue.'
                : 'Keep your account secure'}
            </p>
          </div>
        </div>
      </header>

      <form id="change-password-form" onSubmit={handleSubmit} className="mx-auto max-w-md space-y-4 px-4 py-4">
        <section className="rounded-3xl bg-neutral-950 p-4 text-white">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-orange-400 ring-1 ring-white/10">
              <ShieldCheck size={21} />
            </span>
            <div>
              <h2 className="text-base font-black">Protect your account</h2>
              <p className="mt-1 text-xs leading-5 text-neutral-400">
                Use a password you do not use for other apps or services.
              </p>
            </div>
          </div>
        </section>

        {/* Security Notice */}
        {forced && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
            <div className="mt-0.5 shrink-0 text-amber-500">
              <ShieldCheck size={18} />
            </div>
            <p className="text-xs leading-relaxed text-amber-700">
              For your security, create a new password before using the app. You do not need to enter the temporary password again.
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Password Fields */}
        <section className="space-y-4 rounded-3xl border border-neutral-100 bg-white p-4 shadow-sm">
          {!forced && (
            <PasswordField
              label="Current Password"
              value={currentPassword}
              onChange={(value) => {
                setCurrentPassword(value);
                setError('');
              }}
              placeholder="Enter current password"
              showPassword={showPassword}
              onToggleShow={() => setShowPassword((v) => !v)}
            />
          )}

          <PasswordField
            label="New Password"
            value={newPassword}
            onChange={(value) => {
              setNewPassword(value);
              setError('');
            }}
            placeholder="Min 6 characters"
            showPassword={showPassword}
            onToggleShow={() => setShowPassword((v) => !v)}
          />

          <PasswordField
            label="Confirm New Password"
            value={confirmPassword}
            onChange={(value) => {
              setConfirmPassword(value);
              setError('');
            }}
            placeholder="Confirm new password"
            showPassword={showPassword}
            onToggleShow={() => setShowPassword((v) => !v)}
          />
        </section>

        {/* Password Tip */}
        <div className="rounded-2xl bg-neutral-50 p-3.5 ring-1 ring-neutral-100">
          <p className="text-xs font-bold text-neutral-700">Password tip</p>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500">
            Use a password that is hard to guess and different from other apps.
          </p>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 font-bold text-white transition active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
        >
          {submitting ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Updating...
            </>
          ) : (
            <>
              <KeyRound size={18} />
              Update Password
            </>
          )}
        </button>
      </form>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  showPassword,
  onToggleShow,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  showPassword: boolean;
  onToggleShow: () => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-neutral-700">
        {label}
      </label>
      <div className="relative">
        <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
          <Lock size={18} />
        </div>
        <input
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-11 w-full rounded-2xl border border-neutral-200 bg-white pl-11 pr-11 text-sm outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
          aria-label="Toggle password visibility"
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}
