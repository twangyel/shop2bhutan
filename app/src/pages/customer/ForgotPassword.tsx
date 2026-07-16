import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle,
  HeadphonesIcon,
  KeyRound,
  Loader2,
  Mail,
  Phone,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import BrandLogo from '@/components/BrandLogo';
import { useAppToast } from '@/components/shared/AppToast';

const PHONE_ONLY_EMAIL_SUFFIX = '@phone.shop2bhutan.com';

type ResetMode = 'email_reset_requested' | 'phone_only_support_reset';

type PasswordResetNotifyResponse = {
  notified?: boolean;
};

function getResetRedirectUrl() {
  return `${window.location.origin}/reset-password`;
}

function normalizeBhutanPhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  const phone8 = digits.startsWith('975') ? digits.slice(3) : digits;

  if (!/^(17|77)\d{6}$/.test(phone8)) return null;

  return phone8;
}

function isEmail(value: string) {
  return value.includes('@');
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isPhoneOnlyEmail(value?: string | null) {
  return Boolean(value?.trim().toLowerCase().endsWith(PHONE_ONLY_EMAIL_SUFFIX));
}

export default function ForgotPassword() {
  const navigate = useNavigate();
  const { showToast } = useAppToast();

  const [identifier, setIdentifier] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [supportReset, setSupportReset] = useState(false);
  const [adminNotified, setAdminNotified] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!error) return;

    showToast({
      type: 'error',
      title: 'Reset request failed',
      message: error,
    });
  }, [error, showToast]);

  useEffect(() => {
    if (!submitted) return;

    showToast({
      type: 'success',
      title: 'Reset link requested',
      message: adminNotified
        ? 'Check your email for the latest reset link. Shop2Bhutan admin was also notified.'
        : 'Check your email for the latest password reset link.',
    });
  }, [adminNotified, showToast, submitted]);

  useEffect(() => {
    if (!supportReset) return;

    showToast({
      type: 'info',
      title: 'Admin reset requested',
      message: adminNotified
        ? 'Shop2Bhutan admin has been notified to prepare a temporary password.'
        : 'Please contact Shop2Bhutan support to request a temporary password.',
    });
  }, [adminNotified, showToast, supportReset]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

  const sendResetEmail = async (email: string) => {
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getResetRedirectUrl(),
    });

    if (resetError) {
      throw new Error(resetError.message || 'Unable to send reset link. Please try again.');
    }
  };

  const notifyAdminPasswordReset = async (rawIdentifier: string, resetMode: ResetMode) => {
    const { data, error: notifyError } = await supabase.rpc('notify_password_reset_requested', {
      p_identifier: rawIdentifier.trim(),
      p_reset_mode: resetMode,
    });

    if (notifyError) {
      console.error('Password reset admin notification failed:', notifyError);
      return false;
    }

    return Boolean((data as PasswordResetNotifyResponse | null)?.notified);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const cleanIdentifier = identifier.trim().toLowerCase();

    setError('');
    setSubmitted(false);
    setSupportReset(false);
    setAdminNotified(false);

    if (!cleanIdentifier) {
      setError('Please enter your email or Bhutan mobile number.');
      return;
    }

    setSubmitting(true);

    try {
      if (isEmail(cleanIdentifier)) {
        if (!isValidEmail(cleanIdentifier)) {
          throw new Error('Please enter a valid email address.');
        }

        await sendResetEmail(cleanIdentifier);

        const notified = await notifyAdminPasswordReset(
          cleanIdentifier,
          'email_reset_requested'
        );

        setAdminNotified(notified);
        setSubmitted(true);
        return;
      }

      const normalizedPhone = normalizeBhutanPhone(cleanIdentifier);

      if (!normalizedPhone) {
        throw new Error('Enter a valid email or Bhutan mobile number.');
      }

      const { data, error: phoneLookupError } = await supabase.rpc('get_login_email_by_phone', {
        p_phone: normalizedPhone,
      });

      if (phoneLookupError) {
        throw new Error('Phone reset lookup is not ready. Please contact support.');
      }

      if (!data) {
        throw new Error('No account was found with this phone number.');
      }

      const loginEmail = String(data).toLowerCase();

      if (isPhoneOnlyEmail(loginEmail)) {
        const notified = await notifyAdminPasswordReset(
          normalizedPhone,
          'phone_only_support_reset'
        );

        setAdminNotified(notified);
        setSupportReset(true);
        return;
      }

      await sendResetEmail(loginEmail);

      const notified = await notifyAdminPasswordReset(
        normalizedPhone,
        'email_reset_requested'
      );

      setAdminNotified(notified);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to process reset request.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
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
                Reset link requested
              </p>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-neutral-950">
                Check your email
              </h1>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-neutral-500">
                If a real email is linked to this account, we sent a password reset link. Open the latest email and follow it to create a new password.
              </p>

              <div
                className={`mt-5 flex items-start gap-3 rounded-2xl border px-4 py-3 text-left ${
                  adminNotified
                    ? 'border-emerald-100 bg-emerald-50/70 text-emerald-700'
                    : 'border-amber-100 bg-amber-50/70 text-amber-700'
                }`}
              >
                {adminNotified ? (
                  <CheckCircle size={18} className="mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle size={18} className="mt-0.5 shrink-0" />
                )}
                <p className="text-xs font-semibold leading-5">
                  {adminNotified
                    ? 'Shop2Bhutan admin has also been notified about this reset request.'
                    : 'If you still need help, please contact Shop2Bhutan support.'}
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
            Secure account recovery
          </div>
        </div>
      </div>
    );
  }

  if (supportReset) {
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
              <div className="mx-auto flex h-18 w-18 items-center justify-center rounded-[24px] bg-orange-500 text-white shadow-lg shadow-orange-500/20">
                <HeadphonesIcon size={34} strokeWidth={2.1} />
              </div>

              <p className="mt-5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-orange-500">
                Phone-only account
              </p>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-neutral-950">
                Admin reset required
              </h1>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-neutral-500">
                Phone-only accounts cannot receive password reset emails. Shop2Bhutan support must create a temporary password for you.
              </p>

              <div
                className={`mt-5 flex items-start gap-3 rounded-2xl border px-4 py-3 text-left ${
                  adminNotified
                    ? 'border-emerald-100 bg-emerald-50/70 text-emerald-700'
                    : 'border-amber-100 bg-amber-50/70 text-amber-700'
                }`}
              >
                {adminNotified ? (
                  <CheckCircle size={18} className="mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle size={18} className="mt-0.5 shrink-0" />
                )}
                <p className="text-xs font-semibold leading-5">
                  {adminNotified
                    ? 'We notified Shop2Bhutan admin. Contact support directly if your reset is urgent.'
                    : 'We could not notify admin automatically. Please contact support directly.'}
                </p>
              </div>

              <div className="mt-6 space-y-3">
                <button
                  type="button"
                  onClick={() => navigate('/support')}
                  className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 text-sm font-extrabold text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-600 active:scale-[0.98]"
                >
                  <HeadphonesIcon size={18} />
                  Contact Support
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="h-[52px] w-full rounded-2xl border border-neutral-200 bg-neutral-50 text-sm font-bold text-neutral-700 transition hover:bg-neutral-100 active:scale-[0.98]"
                >
                  Back to Login
                </button>
              </div>

              <p className="mt-5 text-[11px] leading-5 text-neutral-400">
                Admin can reset the password from Customers &gt; Reset Password.
              </p>
            </div>
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
          <div className="border-b border-neutral-100 bg-white px-6 py-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-orange-500 text-white shadow-lg shadow-orange-500/20">
              <KeyRound size={27} strokeWidth={2.1} />
            </div>
            <p className="mt-5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-orange-500">
              Account recovery
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-neutral-950">
              Forgot your password?
            </h1>
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              Enter your registered email or Bhutan mobile number. We will guide you through the correct recovery option.
            </p>
          </div>

          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="reset-identifier"
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
                    id="reset-identifier"
                    type="text"
                    value={identifier}
                    autoComplete="username"
                    inputMode={identifier.includes('@') ? 'email' : 'text'}
                    onChange={(event) => {
                      setIdentifier(event.target.value);
                      setError('');
                      setSubmitted(false);
                      setSupportReset(false);
                      setAdminNotified(false);
                    }}
                    placeholder="your@email.com or 17123456"
                    className="h-[52px] w-full rounded-2xl border border-neutral-200 bg-white pl-11 pr-4 text-[15px] font-medium text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-orange-500 focus:bg-white focus:ring-[3px] focus:ring-orange-500/10"
                  />
                </div>
                <p className="mt-2 text-xs leading-5 text-neutral-400">
                  Bhutan mobile numbers must contain 8 digits and begin with 17 or 77.
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 text-sm font-extrabold text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
              >
                {submitting && <Loader2 size={18} className="animate-spin" />}
                {submitting ? 'Checking account...' : 'Continue'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-neutral-500">
              Remember your password?{' '}
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="font-extrabold text-orange-500 transition hover:text-orange-600"
              >
                Sign in
              </button>
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-center gap-1.5 text-[11px] font-medium text-neutral-400">
          <ShieldCheck size={13} />
          Secure account recovery
        </div>
      </div>
    </div>
  );
}
