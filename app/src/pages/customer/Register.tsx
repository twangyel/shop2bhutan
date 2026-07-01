import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MapPin,
  Phone,
  User,
  X,
} from 'lucide-react';
import { DZONGKHAGS } from '@/data/mockData';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import Logo from '@/components/shared/Logo';

type ToastState = {
  type: 'error' | 'success' | 'info';
  title: string;
  message: string;
};

function normalizeBhutanPhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  const phone8 = digits.startsWith('975') ? digits.slice(3) : digits;

  if (!/^(17|77)\d{6}$/.test(phone8)) {
    return null;
  }

  return phone8;
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

function RegistrationToast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  const isError = toast.type === 'error';
  const isSuccess = toast.type === 'success';

  return (
    <div className="fixed left-1/2 top-4 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 animate-[fadeIn_0.2s_ease-out]">
      <div
        className={`rounded-2xl border bg-white/95 px-4 py-3 shadow-xl backdrop-blur ${
          isError
            ? 'border-red-100'
            : isSuccess
              ? 'border-emerald-100'
              : 'border-amber-100'
        }`}
      >
        <div className="flex gap-3">
          <div
            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              isError
                ? 'bg-red-50 text-red-600'
                : isSuccess
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-amber-50 text-amber-600'
            }`}
          >
            {isSuccess ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-900">{toast.title}</p>
            <p className="mt-0.5 text-xs leading-5 text-neutral-600">{toast.message}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-0.5 text-neutral-400 hover:text-neutral-600"
            aria-label="Close notification"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Register() {
  const navigate = useNavigate();
  const { refreshContext } = useAuth();

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    dzongkhag: '',
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const normalizedPreviewPhone = useMemo(
    () => normalizeBhutanPhone(form.phone),
    [form.phone]
  );

  useEffect(() => {
    if (!toast) return;

    const timer = window.setTimeout(() => {
      setToast(null);
    }, 4500);

    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = (nextToast: ToastState) => {
    setToast(nextToast);
  };

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
    setSubmitError('');
    setSuccessMessage('');
  };

  const checkDuplicateRegistration = async (email: string, phone: string) => {
    const { data, error } = await supabase.rpc('check_registration_duplicate', {
      p_email: email,
      p_phone: phone,
    });

    if (error) {
      console.warn('Duplicate registration check skipped:', error.message);
      return { emailExists: false, phoneExists: false };
    }

    const result = data as { email_exists?: boolean; phone_exists?: boolean } | null;

    return {
      emailExists: Boolean(result?.email_exists),
      phoneExists: Boolean(result?.phone_exists),
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    const normalizedPhone = normalizeBhutanPhone(form.phone);

    if (!form.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!form.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      newErrors.email = 'Invalid email';
    }

    if (!form.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!normalizedPhone) {
      newErrors.phone =
        'Enter a valid Bhutan mobile number. Example: 17123456 or 77123456';
    }

    if (!form.dzongkhag) {
      newErrors.dzongkhag = 'Select your dzongkhag';
    }

    if (!form.password) {
      newErrors.password = 'Password is required';
    } else if (form.password.length < 6) {
      newErrors.password = 'Min 6 characters';
    }

    if (form.password !== form.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!agreed) {
      newErrors.agreed = 'You must agree to the terms';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      showToast({
        type: 'error',
        title: 'Please check your details',
        message: 'Some information is missing or invalid. Fix the highlighted fields and try again.',
      });
      return;
    }

    if (!normalizedPhone) return;

    setSubmitting(true);
    setSubmitError('');
    setSuccessMessage('');

    const cleanEmail = form.email.trim().toLowerCase();
    const cleanName = form.name.trim();

    const { emailExists, phoneExists } = await checkDuplicateRegistration(
      cleanEmail,
      normalizedPhone
    );

    if (emailExists || phoneExists) {
      const duplicateErrors: Record<string, string> = {};

      if (emailExists) duplicateErrors.email = 'This email is already registered';
      if (phoneExists) duplicateErrors.phone = 'This phone number is already registered';

      setErrors((prev) => ({ ...prev, ...duplicateErrors }));
      setSubmitting(false);

      showToast({
        type: 'error',
        title: 'Account already exists',
        message:
          emailExists && phoneExists
            ? 'This email and phone number are already registered. Please sign in instead.'
            : emailExists
              ? 'This email is already registered. Please sign in or use forgot password.'
              : 'This phone number is already registered. Please sign in with phone number instead.',
      });

      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: form.password,
      options: {
        data: {
          full_name: cleanName,
          name: cleanName,
          phone: normalizedPhone,
          default_dzongkhag_id: form.dzongkhag,
        },
      },
    });

    if (error) {
      setSubmitting(false);
      const message = error.message || 'Unable to create account. Please try again.';
      setSubmitError(message);

      showToast({
        type: 'error',
        title: isDuplicateError(message) ? 'Account already exists' : 'Registration failed',
        message: isDuplicateError(message)
          ? 'This email or phone number is already registered. Please sign in instead.'
          : message,
      });

      return;
    }

    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').upsert(
        {
          id: data.user.id,
          full_name: cleanName,
          phone: normalizedPhone,
          default_dzongkhag_id: form.dzongkhag,
        },
        {
          onConflict: 'id',
        }
      );

      if (profileError) {
        console.warn('Profile creation skipped:', profileError.message);

        if (isDuplicateError(profileError.message)) {
          setSubmitting(false);
          setErrors((prev) => ({
            ...prev,
            phone: 'This phone number is already registered',
          }));
          showToast({
            type: 'error',
            title: 'Phone already registered',
            message: 'This phone number is already linked to another account. Please use a different number.',
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
      navigate('/');
      return;
    }

    const successText =
      'Account created. Please check your email to confirm your account, then sign in.';

    setSuccessMessage(successText);
    showToast({
      type: 'success',
      title: 'Check your email',
      message: successText,
    });
  };

  return (
    <div className="min-h-screen bg-white py-8 px-6">
      {toast && <RegistrationToast toast={toast} onClose={() => setToast(null)} />}

      <div className="max-w-sm mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="text-sm text-neutral-500"
          >
            ← Back to Login
          </button>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <Logo size="lg" showText={false} />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create Account</h1>
            <p className="text-sm text-neutral-500">
              Join Shop2Bhutan to start shopping
            </p>
          </div>
        </div>

        {submitError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {submitError}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {successMessage}
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="ml-1 font-semibold underline"
            >
              Go to sign in
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-700 uppercase tracking-wider mb-1.5">
              Full Name
            </label>
            <div className="relative">
              <User
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
              />
              <input
                type="text"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="Your full name"
                className={`w-full h-12 pl-10 pr-4 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 ${
                  errors.name ? 'border-red-400' : 'border-neutral-300'
                }`}
              />
            </div>
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
              />
              <input
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                placeholder="your@email.com"
                className={`w-full h-12 pl-10 pr-4 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 ${
                  errors.email ? 'border-red-400' : 'border-neutral-300'
                }`}
              />
            </div>
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 uppercase tracking-wider mb-1.5">
              Bhutan Mobile Number
            </label>
            <div className="relative">
              <Phone
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
              />
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                placeholder="17123456 or +97517123456"
                className={`w-full h-12 pl-10 pr-4 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 ${
                  errors.phone ? 'border-red-400' : 'border-neutral-300'
                }`}
              />
            </div>
            {errors.phone ? (
              <p className="text-xs text-red-500 mt-1">{errors.phone}</p>
            ) : normalizedPreviewPhone ? (
              <p className="text-[11px] text-emerald-600 mt-1">
                Will save as {normalizedPreviewPhone}
              </p>
            ) : (
              <p className="text-[11px] text-neutral-400 mt-1">
                Must be 8 digits and start with 17 or 77.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 uppercase tracking-wider mb-1.5">
              Dzongkhag
            </label>
            <div className="relative">
              <MapPin
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
              />
              <select
                value={form.dzongkhag}
                onChange={(e) => update('dzongkhag', e.target.value)}
                className={`w-full h-12 pl-10 pr-4 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 appearance-none bg-white ${
                  errors.dzongkhag ? 'border-red-400' : 'border-neutral-300'
                }`}
              >
                <option value="">Select dzongkhag</option>
                {DZONGKHAGS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            {errors.dzongkhag && (
              <p className="text-xs text-red-500 mt-1">{errors.dzongkhag}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
              />
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                placeholder="Min 6 characters"
                className={`w-full h-12 pl-10 pr-10 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 ${
                  errors.password ? 'border-red-400' : 'border-neutral-300'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-red-500 mt-1">{errors.password}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 uppercase tracking-wider mb-1.5">
              Confirm Password
            </label>
            <div className="relative">
              <Lock
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
              />
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.confirmPassword}
                onChange={(e) => update('confirmPassword', e.target.value)}
                placeholder="Confirm password"
                className={`w-full h-12 pl-10 pr-4 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 ${
                  errors.confirmPassword ? 'border-red-400' : 'border-neutral-300'
                }`}
              />
            </div>
            {errors.confirmPassword && (
              <p className="text-xs text-red-500 mt-1">{errors.confirmPassword}</p>
            )}
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => {
                setAgreed(e.target.checked);
                setErrors((prev) => ({ ...prev, agreed: '' }));
              }}
              className="w-4 h-4 mt-0.5 rounded border-neutral-300 text-amber-500 focus:ring-amber-500"
            />
            <span className="text-sm text-neutral-600">
              I agree to the{' '}
              <button type="button" className="text-amber-600 font-medium">
                Terms of Service
              </button>{' '}
              and{' '}
              <button type="button" className="text-amber-600 font-medium">
                Privacy Policy
              </button>
            </span>
          </label>
          {errors.agreed && <p className="text-xs text-red-500">{errors.agreed}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-12 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-neutral-500 mt-6">
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="text-amber-600 font-semibold"
          >
            Sign In
          </button>
        </p>
      </div>
    </div>
  );
}
