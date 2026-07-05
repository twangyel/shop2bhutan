import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
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

export default function ChangePassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, context, refreshContext } = useAuth();

  const routeState = location.state as RouteState;
  const forcedByRoute = Boolean(routeState?.forced);
  const forcedByProfile = mustChangePassword(context?.profile);
  const forced = forcedByRoute || forcedByProfile;
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
  const [success, setSuccess] = useState('');

  const clearMustChangePasswordFlag = async () => {
    if (!forced || !user?.id) return;

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
    setSuccess('');

    if (!user?.email) {
      setError('Please sign in again before changing your password.');
      return;
    }

    if (!currentPassword) {
      setError(forced ? 'Temporary password is required.' : 'Current password is required.');
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

    if (newPassword === currentPassword) {
      setError('New password must be different from your current password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match.');
      return;
    }

    setSubmitting(true);

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (verifyError) {
      setSubmitting(false);
      setError(
        forced
          ? 'Temporary password is incorrect. Please check the password given by admin.'
          : 'Current password is incorrect. Please try again.',
      );
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      setSubmitting(false);
      setError(updateError.message || 'Unable to update password. Please try again.');
      return;
    }

    try {
      await clearMustChangePasswordFlag();
    } catch (flagError) {
      setSubmitting(false);
      setError(
        flagError instanceof Error
          ? flagError.message
          : 'Password changed, but the temporary-password flag could not be cleared.',
      );
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    await refreshContext();
    setSubmitting(false);
    setSuccess(
      forced
        ? 'Password updated successfully. You can now continue using Shop2Bhutan.'
        : 'Password updated successfully. Use your new password next time you sign in.',
    );

    if (forced) {
      window.setTimeout(() => {
        navigate(returnTo, { replace: true });
      }, 800);
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

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-neutral-100 bg-white">
        <div className="flex items-center gap-3 px-4 py-3">
          {!forced && (
            <button
              type="button"
              onClick={() => navigate('/account')}
              className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full hover:bg-neutral-100"
            >
              <ArrowLeft size={22} />
            </button>
          )}

          <div>
            <h1 className="text-lg font-bold text-neutral-900">
              {forced ? 'Set New Password' : 'Change Password'}
            </h1>
            <p className="text-xs text-neutral-500">
              {forced
                ? 'Admin reset your password. Create your own now.'
                : 'Keep your account secure'}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 px-4 py-4 pb-28">
        {/* Security Notice */}
        {forced && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
            <div className="mt-0.5 shrink-0 text-amber-500">
              <ShieldCheck size={18} />
            </div>
            <p className="text-xs leading-relaxed text-amber-700">
              For your security, you must replace the temporary password before using the app.
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle size={16} />
            {success}
          </div>
        )}

        {/* Password Fields */}
        <div className="space-y-4">
          <PasswordField
            label={forced ? 'Temporary Password' : 'Current Password'}
            value={currentPassword}
            onChange={(value) => {
              setCurrentPassword(value);
              setError('');
              setSuccess('');
            }}
            placeholder={forced ? 'Enter temporary password' : 'Enter current password'}
            showPassword={showPassword}
            onToggleShow={() => setShowPassword((v) => !v)}
          />

          <PasswordField
            label="New Password"
            value={newPassword}
            onChange={(value) => {
              setNewPassword(value);
              setError('');
              setSuccess('');
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
              setSuccess('');
            }}
            placeholder="Confirm new password"
            showPassword={showPassword}
            onToggleShow={() => setShowPassword((v) => !v)}
          />
        </div>

        {/* Password Tip */}
        <div className="rounded-2xl bg-neutral-50 p-4">
          <p className="text-xs font-bold text-neutral-700">Password tip</p>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500">
            Use a password that is hard to guess and different from other apps.
          </p>
        </div>
      </form>

      {/* Sticky Bottom Button */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-neutral-100 bg-white p-4">
        <button
          type="submit"
          onClick={handleSubmit}
          disabled={submitting}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 font-bold text-white shadow-sm transition hover:bg-orange-600 active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
        >
          {submitting ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Updating...
            </>
          ) : (
            <>
              <KeyRound size={18} />
              {forced ? 'Save Password' : 'Update Password'}
            </>
          )}
        </button>
      </div>
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
          className="h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 pl-11 pr-11 text-sm outline-none transition focus:border-orange-500 focus:bg-white focus:ring-2 focus:ring-orange-500/10"
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
