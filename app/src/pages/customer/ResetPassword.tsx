import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import BrandLogo from '@/components/BrandLogo';

export default function ResetPassword() {
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });

    let active = true;

    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;

      if (!session) {
        setError(
          'Reset session not found. Please open the latest reset password link from your email.',
        );
      }

      setReady(true);
    }

    void checkSession();

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    setError('');

    if (!password) {
      setError('Password is required.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    setSubmitting(false);

    if (updateError) {
      setError(
        updateError.message || 'Unable to update password. Please try again.',
      );
      return;
    }

    setSuccess(true);
  };

  if (!ready) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-white px-6">
        <div className="text-center">
          <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
            <div className="absolute inset-0 animate-pulse rounded-[22px] bg-orange-100" />
            <div className="relative flex h-12 w-12 items-center justify-center rounded-[18px] bg-white shadow-lg ring-1 ring-orange-100">
              <Loader2
                size={25}
                strokeWidth={2.2}
                className="animate-spin text-orange-500"
              />
            </div>
          </div>
          <h1 className="mt-5 text-base font-extrabold text-neutral-900">
            Preparing password reset
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            Verifying your secure reset link...
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-white px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))]">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
          <div className="flex justify-center">
            <div className="origin-center scale-[0.78]">
              <BrandLogo variant="full" className="justify-center" />
            </div>
          </div>

          <div className="my-auto py-8">
            <div className="rounded-[28px] border border-neutral-100 bg-white p-6 text-center shadow-[0_18px_55px_rgba(15,23,42,0.07)]">
              <div className="mx-auto flex h-18 w-18 items-center justify-center rounded-[24px] bg-emerald-50 text-emerald-600">
                <CheckCircle size={34} strokeWidth={2.1} />
              </div>

              <p className="mt-5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-emerald-600">
                Password secured
              </p>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-neutral-950">
                Password updated
              </h1>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-neutral-500">
                Your password has been updated successfully. You can now sign
                in using your new password.
              </p>

              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-left text-emerald-700">
                <ShieldCheck size={18} className="mt-0.5 shrink-0" />
                <p className="text-xs font-semibold leading-5">
                  For your security, use the new password when signing in on
                  your other devices.
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate('/login')}
                className="mt-6 flex h-[52px] w-full items-center justify-center rounded-2xl bg-orange-500 text-sm font-extrabold text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-600 active:scale-[0.98]"
              >
                Back to Sign In
              </button>
            </div>
          </div>

          <div className="flex items-center justify-center gap-1.5 pb-1 text-[11px] font-medium text-neutral-400">
            <ShieldCheck size={13} />
            Secure password recovery
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-white px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))]">
      <div className="mx-auto w-full max-w-md">
        <div className="flex justify-center">
          <div className="origin-center scale-[0.78]">
            <BrandLogo variant="full" className="justify-center" />
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-[30px] border border-neutral-100 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.07)]">
          <div className="border-b border-orange-100 bg-gradient-to-br from-orange-50 via-white to-amber-50 px-6 py-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-orange-500 text-white shadow-lg shadow-orange-500/20">
              <KeyRound size={27} strokeWidth={2.1} />
            </div>

            <p className="mt-5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-orange-500">
              Create new password
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-neutral-950">
              Set a secure password
            </h1>
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              Choose a new password for your Shop2Bhutan account. It must
              contain at least 6 characters.
            </p>
          </div>

          <div className="p-6">
            {error && (
              <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-red-700">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <p className="text-sm font-medium leading-5">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="new-password"
                  className="mb-2 block text-[13px] font-bold text-neutral-800"
                >
                  New password
                </label>

                <div className="relative">
                  <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
                    <Lock size={18} strokeWidth={1.9} />
                  </div>

                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    autoComplete="new-password"
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError('');
                    }}
                    placeholder="Minimum 6 characters"
                    className="h-[52px] w-full rounded-2xl border border-neutral-200 bg-neutral-50 pl-11 pr-12 text-[15px] font-medium text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-orange-500 focus:bg-white focus:ring-[3px] focus:ring-orange-500/10"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-2.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600 active:scale-95"
                    aria-label={showPassword ? 'Hide passwords' : 'Show passwords'}
                  >
                    {showPassword ? (
                      <EyeOff size={18} strokeWidth={1.9} />
                    ) : (
                      <Eye size={18} strokeWidth={1.9} />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirm-new-password"
                  className="mb-2 block text-[13px] font-bold text-neutral-800"
                >
                  Confirm new password
                </label>

                <div className="relative">
                  <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
                    <Lock size={18} strokeWidth={1.9} />
                  </div>

                  <input
                    id="confirm-new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    autoComplete="new-password"
                    onChange={(event) => {
                      setConfirmPassword(event.target.value);
                      setError('');
                    }}
                    placeholder="Re-enter your new password"
                    className="h-[52px] w-full rounded-2xl border border-neutral-200 bg-neutral-50 pl-11 pr-4 text-[15px] font-medium text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-orange-500 focus:bg-white focus:ring-[3px] focus:ring-orange-500/10"
                  />
                </div>

                {password &&
                  confirmPassword &&
                  password === confirmPassword && (
                    <p className="mt-2 flex items-center gap-1 text-xs font-bold text-emerald-600">
                      <CheckCircle size={13} strokeWidth={2.5} />
                      Passwords match
                    </p>
                  )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 text-sm font-extrabold text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
              >
                {submitting && <Loader2 size={18} className="animate-spin" />}
                {submitting ? 'Updating password...' : 'Update Password'}
              </button>
            </form>

            <button
              type="button"
              onClick={() => navigate('/login')}
              className="mt-4 h-11 w-full rounded-2xl text-sm font-bold text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-700"
            >
              Back to Sign In
            </button>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-center gap-1.5 text-[11px] font-medium text-neutral-400">
          <ShieldCheck size={13} />
          Secure password recovery
        </div>
      </div>
    </div>
  );
}
