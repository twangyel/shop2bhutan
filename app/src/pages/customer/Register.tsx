import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle,
  ChevronDown,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchPublicContentPage,
  getDefaultContentPage,
  type ContentPageRecord,
  type ContentPageSlug,
} from '@/lib/contentPages';

type ToastState = {
  type: 'error' | 'success' | 'info';
  title: string;
  message: string;
};

type DzongkhagOption = {
  id: string;
  name: string;
};

type RegisterRouteState = {
  returnTo?: string;
} | null;

type RegistrationStep = 1 | 2;

const PHONE_ONLY_EMAIL_DOMAIN = 'phone.shop2bhutan.com';
const GOOGLE_OAUTH_PENDING_KEY = 'shop2bhutan:google-oauth-pending';
const GOOGLE_OAUTH_RETURN_TO_KEY = 'shop2bhutan:google-oauth-return-to';

function makePhoneOnlyAuthEmail(phone8: string) {
  return `${phone8}@${PHONE_ONLY_EMAIL_DOMAIN}`;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeBhutanPhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  const phone8 = digits.startsWith('975') ? digits.slice(3) : digits;
  if (!/^(17|77)\d{6}$/.test(phone8)) return null;
  return phone8;
}

function getSafeReturnTo(value: unknown) {
  if (typeof value !== 'string') return '/';
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  if (value.startsWith('/login') || value.startsWith('/register')) return '/';
  return value;
}

function getGoogleRedirectUrl(returnTo: string) {
  const callbackUrl = Capacitor.isNativePlatform()
    ? new URL('com.shop2bhutan.app://login')
    : new URL('/login', window.location.origin);

  callbackUrl.searchParams.set('oauth', 'google');
  callbackUrl.searchParams.set('returnTo', returnTo);
  return callbackUrl.toString();
}

function isDuplicateError(message: string) {
  const lower = message.toLowerCase();
  return (
    lower.includes('already registered') ||
    lower.includes('already exists') ||
    lower.includes('duplicate key') ||
    lower.includes('unique constraint')
  );
}

function isEmailRateLimitError(message: string) {
  const lower = message.toLowerCase();
  return (
    lower.includes('email rate limit') || lower.includes('rate limit exceeded')
  );
}

function getFriendlySignupError(message: string, hasRealEmail: boolean) {
  if (isEmailRateLimitError(message)) {
    return hasRealEmail
      ? 'Supabase email limit is temporarily reached. Please wait a few minutes and try again.'
      : 'Phone-only registration is being blocked by Supabase email confirmation/rate limit. Turn off email confirmation for this MVP flow, then try again.';
  }
  if (!hasRealEmail && message.toLowerCase().includes('email')) {
    return 'Phone-only registration needs the internal auth-email fix. Please use the latest patch and make sure email confirmation is disabled in Supabase.';
  }
  return message;
}

function normalizeDzongkhagOptions(data: unknown): DzongkhagOption[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const id = typeof row.id === 'string' ? row.id : '';
      const name = typeof row.name === 'string' ? row.name : '';
      return id && name ? { id, name } : null;
    })
    .filter((item): item is DzongkhagOption => Boolean(item));
}

function RegistrationToast({
  toast,
  onClose,
}: {
  toast: ToastState;
  onClose: () => void;
}) {
  const isError = toast.type === 'error';
  const isSuccess = toast.type === 'success';

  return (
    <div className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[70] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 animate-[fadeIn_0.2s_ease-out]">
      <div
        className={`rounded-2xl border bg-white/95 px-4 py-3 shadow-xl backdrop-blur ${
          isError
            ? 'border-red-100'
            : isSuccess
              ? 'border-emerald-100'
              : 'border-orange-100'
        }`}
      >
        <div className="flex gap-3">
          <div
            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              isError
                ? 'bg-red-50 text-red-600'
                : isSuccess
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-orange-50 text-orange-600'
            }`}
          >
            {isSuccess ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-900">{toast.title}</p>
            <p className="mt-0.5 text-xs leading-5 text-gray-500">
              {toast.message}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-0.5 text-gray-400 hover:text-gray-600"
            aria-label="Close notification"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function PolicyContentModal({
  page,
  loading,
  error,
  onClose,
}: {
  page: ContentPageRecord;
  loading: boolean;
  error: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 px-4 pb-4 sm:items-center sm:pb-0">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close policy information"
        onClick={onClose}
      />

      <div className="relative z-10 max-h-[82vh] w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
              <FileText size={22} strokeWidth={2.3} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-orange-500">
                Shop2Bhutan Policy
              </p>
              <h2 className="mt-0.5 truncate text-lg font-black text-gray-900">
                {page.title}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 active:scale-95"
            aria-label="Close"
          >
            <X size={17} strokeWidth={2.5} />
          </button>
        </div>

        <div className="max-h-[58vh] overflow-y-auto px-5 py-4">
          {error && (
            <div className="mb-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex h-40 items-center justify-center gap-2 text-sm text-gray-500">
              <Loader2 size={18} className="animate-spin text-orange-500" />
              Loading latest information...
            </div>
          ) : (
            <div className="space-y-3 text-sm leading-relaxed text-gray-600">
              {page.content.split('\n').map((line, index) => {
                const cleanLine = line.trim();
                if (!cleanLine) {
                  return <div key={`gap-${index}`} className="h-1" />;
                }

                const looksLikeHeading =
                  /^\d+\.|^[A-Z][A-Za-z\s&]+$/.test(cleanLine) &&
                  cleanLine.length < 80;

                return looksLikeHeading ? (
                  <h3
                    key={`${cleanLine}-${index}`}
                    className="pt-2 text-base font-bold text-gray-900"
                  >
                    {cleanLine}
                  </h3>
                ) : (
                  <p key={`${cleanLine}-${index}`}>{cleanLine}</p>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 bg-white px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-12 w-full rounded-2xl bg-orange-500 text-sm font-bold text-white transition active:scale-[0.98]"
          >
            I understand
          </button>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true">
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
  );
}

export default function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshContext } = useAuth();

  const routeState = location.state as RegisterRouteState;
  const queryReturnTo = new URLSearchParams(location.search).get('returnTo');
  const returnTo = getSafeReturnTo(routeState?.returnTo ?? queryReturnTo);

  const [step, setStep] = useState<RegistrationStep>(1);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    dzongkhag: '',
    password: '',
    confirmPassword: '',
  });

  const [dzongkhagOptions, setDzongkhagOptions] = useState<DzongkhagOption[]>(
    [],
  );
  const [loadingDzongkhags, setLoadingDzongkhags] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isDzongkhagOpen, setIsDzongkhagOpen] = useState(false);
  const [policyModalSlug, setPolicyModalSlug] =
    useState<ContentPageSlug | null>(null);
  const [policyPage, setPolicyPage] = useState<ContentPageRecord | null>(null);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [policyError, setPolicyError] = useState('');
  const dzongkhagRef = useRef<HTMLDivElement>(null);

  const busy = submitting || googleSubmitting;
  const normalizedPreviewPhone = useMemo(
    () => normalizeBhutanPhone(form.phone),
    [form.phone],
  );
  const selectedDzongkhag =
    dzongkhagOptions.find((item) => item.id === form.dzongkhag) || null;
  const passwordReady = form.password.length >= 6;
  const passwordsMatch =
    form.confirmPassword.length > 0 && form.password === form.confirmPassword;

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    let active = true;

    async function loadDzongkhags() {
      setLoadingDzongkhags(true);
      const { data, error } = await supabase.rpc('get_dzongkhag_options');

      if (!active) return;

      if (error) {
        console.warn('Failed to load dzongkhags:', error.message);
        setDzongkhagOptions([]);
      } else {
        setDzongkhagOptions(normalizeDzongkhagOptions(data));
      }

      setLoadingDzongkhags(false);
    }

    void loadDzongkhags();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dzongkhagRef.current &&
        !dzongkhagRef.current.contains(event.target as Node)
      ) {
        setIsDzongkhagOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!policyModalSlug) {
      setPolicyPage(null);
      setPolicyError('');
      setPolicyLoading(false);
      return undefined;
    }

    const activeSlug = policyModalSlug;
    let active = true;

    async function loadPolicyPage() {
      setPolicyLoading(true);
      setPolicyError('');

      try {
        const loaded = await fetchPublicContentPage(activeSlug);
        if (active) setPolicyPage(loaded);
      } catch (error) {
        console.warn('[Register] policy content load skipped:', error);
        if (active) {
          setPolicyPage(getDefaultContentPage(activeSlug));
          setPolicyError(
            'Unable to load the latest content. Showing default information.',
          );
        }
      } finally {
        if (active) setPolicyLoading(false);
      }
    }

    void loadPolicyPage();

    const handleContentUpdated = () => {
      void loadPolicyPage();
    };

    window.addEventListener(
      'shop2bhutan:content-updated',
      handleContentUpdated,
    );

    return () => {
      active = false;
      window.removeEventListener(
        'shop2bhutan:content-updated',
        handleContentUpdated,
      );
    };
  }, [policyModalSlug]);

  const showToast = (nextToast: ToastState) => {
    setToast(nextToast);
  };

  const update = (field: string, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: '' }));
    setSubmitError('');
    setSuccessMessage('');
  };

  const validateDetails = () => {
    const nextErrors: Record<string, string> = {};
    const optionalEmail = form.email.trim().toLowerCase();
    const normalizedPhone = normalizeBhutanPhone(form.phone);

    if (!form.name.trim()) nextErrors.name = 'Name is required';
    if (optionalEmail && !isValidEmail(optionalEmail)) {
      nextErrors.email = 'Enter a valid email address';
    }
    if (!form.phone.trim()) {
      nextErrors.phone = 'Phone number is required';
    } else if (!normalizedPhone) {
      nextErrors.phone = 'Enter a valid 17 or 77 Bhutan mobile number';
    }
    if (!form.dzongkhag) nextErrors.dzongkhag = 'Select your dzongkhag';

    return nextErrors;
  };

  const validateSecurity = () => {
    const nextErrors: Record<string, string> = {};

    if (!form.password) {
      nextErrors.password = 'Password is required';
    } else if (form.password.length < 6) {
      nextErrors.password = 'Use at least 6 characters';
    }
    if (!form.confirmPassword) {
      nextErrors.confirmPassword = 'Confirm your password';
    } else if (form.password !== form.confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match';
    }
    if (!agreed) nextErrors.agreed = 'You must agree before continuing';

    return nextErrors;
  };

  const handleContinue = () => {
    const detailErrors = validateDetails();

    if (Object.keys(detailErrors).length > 0) {
      setErrors((previous) => ({ ...previous, ...detailErrors }));
      showToast({
        type: 'error',
        title: 'Check your details',
        message: 'Complete the highlighted fields before continuing.',
      });
      return;
    }

    setErrors({});
    setStep(2);
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  };

  const handleGoogleSignup = async () => {
    if (busy) return;

    setGoogleSubmitting(true);
    setSubmitError('');
    setSuccessMessage('');

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
      console.error('[Register] Google sign-up failed:', error);
      window.sessionStorage.removeItem(GOOGLE_OAUTH_PENDING_KEY);
      window.sessionStorage.removeItem(GOOGLE_OAUTH_RETURN_TO_KEY);
      setGoogleSubmitting(false);
      setSubmitError(
        error instanceof Error
          ? error.message
          : 'Unable to open Google sign-up. Please try again.',
      );
    }
  };

  const checkDuplicateRegistration = async (
    email: string | null,
    phone: string,
  ) => {
    const { data, error } = await supabase.rpc('check_registration_duplicate', {
      p_email: email,
      p_phone: phone,
    });

    if (error) {
      console.warn('Duplicate registration check skipped:', error.message);
      return { emailExists: false, phoneExists: false };
    }

    const result = data as {
      email_exists?: boolean;
      phone_exists?: boolean;
    } | null;

    return {
      emailExists: Boolean(result?.email_exists),
      phoneExists: Boolean(result?.phone_exists),
    };
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const detailErrors = validateDetails();
    const securityErrors = validateSecurity();
    const nextErrors = { ...detailErrors, ...securityErrors };

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      if (Object.keys(detailErrors).length > 0) {
        setStep(1);
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      }
      showToast({
        type: 'error',
        title: 'Please check your details',
        message: 'Fix the highlighted fields and try again.',
      });
      return;
    }

    const normalizedPhone = normalizeBhutanPhone(form.phone);
    if (!normalizedPhone) return;

    setSubmitting(true);
    setSubmitError('');
    setSuccessMessage('');

    const cleanEmail = form.email.trim().toLowerCase();
    const hasRealEmail = cleanEmail.length > 0;
    const authEmail = hasRealEmail
      ? cleanEmail
      : makePhoneOnlyAuthEmail(normalizedPhone);
    const cleanName = form.name.trim();

    const { emailExists, phoneExists } = await checkDuplicateRegistration(
      hasRealEmail ? cleanEmail : null,
      normalizedPhone,
    );

    if (emailExists || phoneExists) {
      const duplicateErrors: Record<string, string> = {};
      if (emailExists) duplicateErrors.email = 'This email is already registered';
      if (phoneExists) {
        duplicateErrors.phone = 'This phone number is already registered';
      }

      setErrors((previous) => ({ ...previous, ...duplicateErrors }));
      setStep(1);
      setSubmitting(false);
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      showToast({
        type: 'error',
        title: 'Account already exists',
        message:
          emailExists && phoneExists
            ? 'This email and phone number are already registered. Please sign in instead.'
            : emailExists
              ? 'This email is already registered. Please sign in or use forgot password.'
              : 'This phone number is already registered. Please sign in with your phone number.',
      });
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: authEmail,
      password: form.password,
      options: {
        data: {
          full_name: cleanName,
          name: cleanName,
          phone: normalizedPhone,
          default_dzongkhag_id: form.dzongkhag,
          default_dzongkhag_name: selectedDzongkhag?.name ?? null,
          has_real_email: hasRealEmail,
        },
      },
    });

    if (error) {
      setSubmitting(false);
      const rawMessage =
        error.message || 'Unable to create account. Please try again.';
      const friendlyMessage = getFriendlySignupError(rawMessage, hasRealEmail);
      setSubmitError(friendlyMessage);
      showToast({
        type: 'error',
        title: isDuplicateError(rawMessage)
          ? 'Account already exists'
          : 'Registration failed',
        message: isDuplicateError(rawMessage)
          ? hasRealEmail
            ? 'This email or phone number is already registered. Please sign in instead.'
            : 'This phone number is already registered. Please sign in with your phone number.'
          : friendlyMessage,
      });
      return;
    }

    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: data.user.id,
            full_name: cleanName,
            phone: normalizedPhone,
            default_dzongkhag_id: form.dzongkhag,
          },
          { onConflict: 'id' },
        );

      if (profileError) {
        console.warn('Profile creation skipped:', profileError.message);
        if (isDuplicateError(profileError.message)) {
          setSubmitting(false);
          setStep(1);
          setErrors((previous) => ({
            ...previous,
            phone: 'This phone number is already registered',
          }));
          showToast({
            type: 'error',
            title: 'Phone already registered',
            message:
              'This phone number is already linked to another account. Please use a different number.',
          });
          return;
        }
      }
    }

    setSubmitting(false);

    if (data.session) {
      showToast({
        type: 'success',
        title: 'Welcome to Shop2Bhutan',
        message: 'Your account has been created successfully.',
      });
      await refreshContext();
      navigate(returnTo, { replace: true });
      return;
    }

    const successText = hasRealEmail
      ? 'Account created. Please check your email to confirm your account, then sign in.'
      : 'Account created. Please sign in with your phone number and password.';

    setSuccessMessage(successText);
    showToast({
      type: 'success',
      title: hasRealEmail ? 'Check your email' : 'Account created',
      message: successText,
    });
  };

  return (
    <div className="min-h-[100dvh] bg-white px-4 pb-[calc(1.75rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] text-[15px] sm:px-5">
      {toast && (
        <RegistrationToast toast={toast} onClose={() => setToast(null)} />
      )}

      {policyModalSlug && (
        <PolicyContentModal
          page={policyPage ?? getDefaultContentPage(policyModalSlug)}
          loading={policyLoading}
          error={policyError}
          onClose={() => setPolicyModalSlug(null)}
        />
      )}

      <div className="mx-auto w-full max-w-md">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-500">
              Shop2Bhutan account
            </p>
            <h1 className="mt-1 text-[30px] font-black tracking-tight text-neutral-950">
              Create your account
            </h1>
            <p className="mt-1 text-[15px] font-medium leading-6 text-neutral-500">
              Quick setup. Takes less than a minute.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/login', { state: { returnTo } })}
            className="shrink-0 rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-extrabold text-neutral-700 transition active:scale-[0.97]"
          >
            Sign in
          </button>
        </div>

        <div className="mt-5 rounded-[28px] border border-neutral-100 bg-white p-4 sm:p-5">
          {submitError && (
            <div className="mb-4 flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertCircle size={16} strokeWidth={2.5} />
              </div>
              <p className="text-sm font-medium leading-5 text-red-700">
                {submitError}
              </p>
            </div>
          )}

          {successMessage ? (
            <div className="py-5 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] bg-emerald-50 text-emerald-600">
                <CheckCircle size={28} strokeWidth={2.4} />
              </div>
              <h2 className="mt-4 text-xl font-black text-neutral-950">
                Account created
              </h2>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-neutral-500">
                {successMessage}
              </p>
              <button
                type="button"
                onClick={() => navigate('/login', { state: { returnTo } })}
                className="mt-5 h-12 w-full rounded-2xl bg-orange-500 text-sm font-extrabold text-white transition active:scale-[0.98]"
              >
                Go to sign in
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={handleGoogleSignup}
                disabled={busy}
                className="flex h-[54px] w-full items-center justify-center gap-3 rounded-2xl border border-neutral-200 bg-white text-[15px] font-extrabold text-neutral-800 transition hover:bg-neutral-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {googleSubmitting ? (
                  <Loader2
                    size={19}
                    strokeWidth={2.4}
                    className="animate-spin text-neutral-500"
                  />
                ) : (
                  <GoogleIcon />
                )}
                {googleSubmitting
                  ? 'Connecting to Google...'
                  : 'Continue with Google'}
              </button>

              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-neutral-200" />
                <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-neutral-400">
                  or register manually
                </span>
                <div className="h-px flex-1 bg-neutral-200" />
              </div>

              <div className="mb-5 grid grid-cols-2 gap-2">
                <div
                  className={`rounded-2xl border px-3.5 py-3.5 transition ${
                    step === 1
                      ? 'border-orange-200 bg-orange-50/70'
                      : 'border-emerald-100 bg-emerald-50/60'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-xl text-sm font-black ${
                        step === 1
                          ? 'bg-orange-500 text-white'
                          : 'bg-emerald-500 text-white'
                      }`}
                    >
                      {step === 2 ? <Check size={15} strokeWidth={3} /> : '1'}
                    </span>
                    <div>
                      <p className="text-[13px] font-black text-neutral-900">
                        Your details
                      </p>
                      <p className="text-[11px] font-medium text-neutral-400">Step 1</p>
                    </div>
                  </div>
                </div>

                <div
                  className={`rounded-2xl border px-3.5 py-3.5 transition ${
                    step === 2
                      ? 'border-orange-200 bg-orange-50/70'
                      : 'border-neutral-200 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-xl text-sm font-black ${
                        step === 2
                          ? 'bg-orange-500 text-white'
                          : 'bg-white text-neutral-400 ring-1 ring-neutral-200'
                      }`}
                    >
                      2
                    </span>
                    <div>
                      <p className="text-[13px] font-black text-neutral-900">
                        Security
                      </p>
                      <p className="text-[11px] font-medium text-neutral-400">Step 2</p>
                    </div>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit}>
                {step === 1 ? (
                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor="register-name"
                        className="mb-2 block text-sm font-bold text-neutral-800"
                      >
                        Full name
                      </label>
                      <div className="relative">
                        <User
                          size={17}
                          strokeWidth={1.9}
                          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
                        />
                        <input
                          id="register-name"
                          type="text"
                          value={form.name}
                          autoComplete="name"
                          onChange={(event) => update('name', event.target.value)}
                          placeholder="Your full name"
                          className={`h-[54px] w-full rounded-2xl border bg-white pl-11 pr-4 text-[15px] font-medium text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:ring-[3px] ${
                            errors.name
                              ? 'border-red-400 bg-red-50/50 focus:ring-red-500/10'
                              : 'border-neutral-200 focus:border-orange-500 focus:ring-orange-500/10'
                          }`}
                        />
                      </div>
                      {errors.name && (
                        <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-red-500">
                          <AlertCircle size={12} strokeWidth={2.5} />
                          {errors.name}
                        </p>
                      )}
                    </div>

                    <div>
                      <div className="mb-1.5 flex items-center justify-between gap-3">
                        <label
                          htmlFor="register-email"
                          className="text-sm font-bold text-neutral-800"
                        >
                          Email address
                        </label>
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-neutral-400">
                          Optional
                        </span>
                      </div>
                      <div className="relative">
                        <Mail
                          size={17}
                          strokeWidth={1.9}
                          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
                        />
                        <input
                          id="register-email"
                          type="email"
                          value={form.email}
                          autoComplete="email"
                          onChange={(event) => update('email', event.target.value)}
                          placeholder="your@email.com"
                          className={`h-[54px] w-full rounded-2xl border bg-white pl-11 pr-4 text-[15px] font-medium text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:ring-[3px] ${
                            errors.email
                              ? 'border-red-400 bg-red-50/50 focus:ring-red-500/10'
                              : 'border-neutral-200 focus:border-orange-500 focus:ring-orange-500/10'
                          }`}
                        />
                      </div>
                      {errors.email && (
                        <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-red-500">
                          <AlertCircle size={12} strokeWidth={2.5} />
                          {errors.email}
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="register-phone"
                        className="mb-2 block text-sm font-bold text-neutral-800"
                      >
                        Bhutan mobile number
                      </label>
                      <div className="relative">
                        <Phone
                          size={17}
                          strokeWidth={1.9}
                          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
                        />
                        <input
                          id="register-phone"
                          type="tel"
                          value={form.phone}
                          autoComplete="tel"
                          inputMode="numeric"
                          maxLength={8}
                          onChange={(event) =>
                            update(
                              'phone',
                              event.target.value.replace(/\D/g, '').slice(0, 8),
                            )
                          }
                          placeholder="17xxxxxx or 77xxxxxx"
                          className={`h-[54px] w-full rounded-2xl border bg-white pl-11 pr-10 text-[15px] font-medium text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:ring-[3px] ${
                            errors.phone
                              ? 'border-red-400 bg-red-50/50 focus:ring-red-500/10'
                              : 'border-neutral-200 focus:border-orange-500 focus:ring-orange-500/10'
                          }`}
                        />
                        {normalizedPreviewPhone && !errors.phone && (
                          <CheckCircle
                            size={17}
                            strokeWidth={2.5}
                            className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-500"
                          />
                        )}
                      </div>
                      {errors.phone ? (
                        <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-red-500">
                          <AlertCircle size={12} strokeWidth={2.5} />
                          {errors.phone}
                        </p>
                      ) : (
                        <p className="mt-1.5 text-xs leading-5 text-neutral-500">
                          8 digits beginning with 17 or 77.
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-bold text-neutral-800">
                        Dzongkhag
                      </label>
                      <div className="relative" ref={dzongkhagRef}>
                        <MapPin
                          size={17}
                          strokeWidth={1.9}
                          className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-neutral-400"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setIsDzongkhagOpen((current) => !current)
                          }
                          disabled={loadingDzongkhags}
                          aria-expanded={isDzongkhagOpen}
                          className={`flex h-[54px] w-full items-center justify-between rounded-2xl border bg-white pl-11 pr-3.5 text-[15px] outline-none transition focus:ring-[3px] disabled:bg-neutral-100 ${
                            errors.dzongkhag
                              ? 'border-red-400 bg-red-50/50 focus:ring-red-500/10'
                              : 'border-neutral-200 focus:border-orange-500 focus:ring-orange-500/10'
                          }`}
                        >
                          <span
                            className={
                              form.dzongkhag
                                ? 'truncate font-medium text-neutral-900'
                                : 'truncate text-neutral-400'
                            }
                          >
                            {form.dzongkhag
                              ? selectedDzongkhag?.name
                              : loadingDzongkhags
                                ? 'Loading dzongkhags...'
                                : 'Select your dzongkhag'}
                          </span>
                          {loadingDzongkhags ? (
                            <Loader2
                              size={17}
                              className="shrink-0 animate-spin text-orange-500"
                            />
                          ) : (
                            <ChevronDown
                              size={17}
                              strokeWidth={2}
                              className={`shrink-0 text-neutral-400 transition-transform duration-200 ${
                                isDzongkhagOpen ? 'rotate-180' : ''
                              }`}
                            />
                          )}
                        </button>

                        {isDzongkhagOpen && (
                          <div className="absolute z-40 mt-2 w-full overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl shadow-black/10">
                            <div className="max-h-60 overflow-y-auto p-1.5">
                              {dzongkhagOptions.map((option) => {
                                const selected = form.dzongkhag === option.id;
                                return (
                                  <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => {
                                      update('dzongkhag', option.id);
                                      setIsDzongkhagOpen(false);
                                    }}
                                    className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                                      selected
                                        ? 'bg-orange-50 font-bold text-orange-600'
                                        : 'font-medium text-neutral-700 hover:bg-neutral-50'
                                    }`}
                                  >
                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                                      {selected && (
                                        <CheckCircle size={16} strokeWidth={2.5} />
                                      )}
                                    </span>
                                    {option.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                      {errors.dzongkhag && (
                        <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-red-500">
                          <AlertCircle size={12} strokeWidth={2.5} />
                          {errors.dzongkhag}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleContinue}
                      disabled={loadingDzongkhags || busy}
                      className="mt-1 flex h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 text-[15px] font-extrabold text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
                    >
                      Continue
                      <ArrowRight size={17} strokeWidth={2.5} />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 rounded-2xl border border-neutral-100 bg-white px-3.5 py-3.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-orange-500 ring-1 ring-neutral-100">
                        <UserPlus size={18} strokeWidth={2.2} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-extrabold text-neutral-900">
                          {form.name.trim()}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-neutral-500">
                          {normalizedPreviewPhone} · {selectedDzongkhag?.name}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="shrink-0 text-xs font-extrabold text-orange-500"
                      >
                        Edit
                      </button>
                    </div>

                    <div>
                      <label
                        htmlFor="register-password"
                        className="mb-2 block text-sm font-bold text-neutral-800"
                      >
                        Password
                      </label>
                      <div className="relative">
                        <Lock
                          size={17}
                          strokeWidth={1.9}
                          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
                        />
                        <input
                          id="register-password"
                          type={showPassword ? 'text' : 'password'}
                          value={form.password}
                          autoComplete="new-password"
                          onChange={(event) =>
                            update('password', event.target.value)
                          }
                          placeholder="Minimum 6 characters"
                          className={`h-[54px] w-full rounded-2xl border bg-white pl-11 pr-11 text-[15px] font-medium text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:ring-[3px] ${
                            errors.password
                              ? 'border-red-400 bg-red-50/50 focus:ring-red-500/10'
                              : 'border-neutral-200 focus:border-orange-500 focus:ring-orange-500/10'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowPassword((current) => !current)
                          }
                          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl text-neutral-400 transition active:bg-neutral-100"
                          aria-label={
                            showPassword ? 'Hide passwords' : 'Show passwords'
                          }
                        >
                          {showPassword ? (
                            <EyeOff size={17} strokeWidth={1.9} />
                          ) : (
                            <Eye size={17} strokeWidth={1.9} />
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

                    <div>
                      <label
                        htmlFor="register-confirm-password"
                        className="mb-2 block text-sm font-bold text-neutral-800"
                      >
                        Confirm password
                      </label>
                      <div className="relative">
                        <Lock
                          size={17}
                          strokeWidth={1.9}
                          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
                        />
                        <input
                          id="register-confirm-password"
                          type={showPassword ? 'text' : 'password'}
                          value={form.confirmPassword}
                          autoComplete="new-password"
                          onChange={(event) =>
                            update('confirmPassword', event.target.value)
                          }
                          placeholder="Re-enter your password"
                          className={`h-[54px] w-full rounded-2xl border bg-white pl-11 pr-10 text-[15px] font-medium text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:ring-[3px] ${
                            errors.confirmPassword
                              ? 'border-red-400 bg-red-50/50 focus:ring-red-500/10'
                              : 'border-neutral-200 focus:border-orange-500 focus:ring-orange-500/10'
                          }`}
                        />
                        {passwordsMatch && !errors.confirmPassword && (
                          <CheckCircle
                            size={17}
                            strokeWidth={2.5}
                            className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-500"
                          />
                        )}
                      </div>
                      {errors.confirmPassword && (
                        <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-red-500">
                          <AlertCircle size={12} strokeWidth={2.5} />
                          {errors.confirmPassword}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-extrabold ${
                          passwordReady
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-neutral-100 text-neutral-400'
                        }`}
                      >
                        <Check size={12} strokeWidth={2.8} />
                        6+ characters
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-extrabold ${
                          passwordsMatch
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-neutral-100 text-neutral-400'
                        }`}
                      >
                        <Check size={12} strokeWidth={2.8} />
                        Passwords match
                      </span>
                    </div>

                    <div
                      className={`rounded-2xl border px-3.5 py-3 ${
                        errors.agreed
                          ? 'border-red-200 bg-red-50/60'
                          : 'border-neutral-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <label
                          htmlFor="terms-agreement"
                          className="relative mt-0.5 flex shrink-0 cursor-pointer"
                        >
                          <input
                            id="terms-agreement"
                            type="checkbox"
                            checked={agreed}
                            onChange={(event) => {
                              setAgreed(event.target.checked);
                              setErrors((previous) => ({
                                ...previous,
                                agreed: '',
                              }));
                            }}
                            className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border-[1.5px] border-neutral-300 bg-white transition checked:border-orange-500 checked:bg-orange-500 focus:outline-none focus:ring-[3px] focus:ring-orange-500/20"
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
                        </label>

                        <div className="min-w-0">
                          <p className="text-[13px] font-medium leading-5 text-neutral-600">
                            I agree to the{' '}
                            <button
                              type="button"
                              onClick={() => setPolicyModalSlug('terms')}
                              className="font-extrabold text-orange-500"
                            >
                              Terms of Service
                            </button>{' '}
                            and{' '}
                            <button
                              type="button"
                              onClick={() => setPolicyModalSlug('privacy')}
                              className="font-extrabold text-orange-500"
                            >
                              Privacy Policy
                            </button>
                            .
                          </p>
                          {errors.agreed && (
                            <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-red-500">
                              <AlertCircle size={12} strokeWidth={2.5} />
                              {errors.agreed}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-[auto_1fr] gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setStep(1);
                          window.scrollTo({
                            top: 0,
                            left: 0,
                            behavior: 'smooth',
                          });
                        }}
                        disabled={busy}
                        className="flex h-[54px] items-center justify-center gap-1.5 rounded-2xl border border-neutral-200 bg-white px-4 text-[15px] font-extrabold text-neutral-700 transition active:scale-[0.98] disabled:opacity-60"
                      >
                        <ArrowLeft size={17} strokeWidth={2.4} />
                        Back
                      </button>

                      <button
                        type="submit"
                        disabled={busy || loadingDzongkhags}
                        className="flex h-[54px] items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 text-[15px] font-extrabold text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
                      >
                        {submitting && (
                          <Loader2
                            size={18}
                            strokeWidth={2.5}
                            className="animate-spin"
                          />
                        )}
                        {submitting ? 'Creating...' : 'Create Account'}
                      </button>
                    </div>
                  </div>
                )}
              </form>
            </>
          )}
        </div>

        <div className="mt-5 flex items-center justify-center gap-1.5 text-xs font-medium text-neutral-500">
          <ShieldCheck size={13} strokeWidth={2} />
          Your information is encrypted and protected
        </div>
      </div>
    </div>
  );
}
