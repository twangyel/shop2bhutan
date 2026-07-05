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
      <div className="min-h-screen bg-white px-4 py-8">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
            <KeyRound size={26} />
          </div>
          <h1 className="mb-2 text-xl font-extrabold text-gray-900">Sign in required</h1>
          <p className="mb-5 text-sm text-gray-500">Please sign in to change your password.</p>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="h-12 w-full rounded-2xl bg-orange-500 font-bold text-white"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="rounded-b-[2rem] bg-orange-500 px-4 pb-8 pt-6 text-white">
        <div className="mx-auto max-w-md">
          {!forced && (
            <button
              type="button"
              onClick={() => navigate('/account')}
              className="mb-6 flex items-center gap-2 text-sm font-semibold text-white/90"
            >
              <ArrowLeft size={18} />
              Back to Account
            </button>
          )}

          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-orange-600 shadow-md">
              <KeyRound size={28} />
            </div>
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-white/90">Security</p>
              <h1 className="text-2xl font-extrabold">
                {forced ? 'Set New Password' : 'Change Password'}
              </h1>
              <p className="mt-1 text-sm text-white/90">
                {forced
                  ? 'Admin reset your password. Please create your own password now.'
                  : 'Keep your Shop2Bhutan account secure.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto -mt-4 max-w-md px-4">
        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
          {forced && (
            <div className="flex items-start gap-2 rounded-2xl border border-amber-100 bg-amber-50 px-3 py-3 text-sm text-amber-700">
              <ShieldCheck size={17} className="mt-0.5 shrink-0" />
              <span>
                For your security, you must replace the temporary password before using the app.
              </span>
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <CheckCircle size={16} />
              {success}
            </div>
          )}

          {[
            {
              label: forced ? 'Temporary Password' : 'Current Password',
              value: currentPassword,
              setter: setCurrentPassword,
              placeholder: forced ? 'Enter temporary password' : 'Enter current password',
            },
            {
              label: 'New Password',
              value: newPassword,
              setter: setNewPassword,
              placeholder: 'Min 6 characters',
            },
            {
              label: 'Confirm New Password',
              value: confirmPassword,
              setter: setConfirmPassword,
              placeholder: 'Confirm new password',
            },
          ].map((field) => (
            <div key={field.label}>
              <label className="mb-1.5 block text-xs font-bold tracking-wider text-gray-600">
                {field.label}
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={field.value}
                  onChange={(event) => {
                    field.setter(event.target.value);
                    setError('');
                    setSuccess('');
                  }}
                  placeholder={field.placeholder}
                  className="h-12 w-full rounded-2xl border border-gray-200 pl-10 pr-11 text-sm outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          ))}

          <div className="rounded-2xl bg-gray-50 p-3">
            <p className="text-xs font-bold text-gray-700">Password tip</p>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              Use a password that is hard to guess and different from other apps.
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 font-bold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />}
            {submitting ? 'Updating...' : forced ? 'Save New Password' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
