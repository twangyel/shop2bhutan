import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, HeadphonesIcon, Mail, Phone } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const PHONE_ONLY_EMAIL_SUFFIX = '@phone.shop2bhutan.com';

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

 const [identifier, setIdentifier] = useState('');
 const [submitted, setSubmitted] = useState(false);
 const [supportReset, setSupportReset] = useState(false);
 const [error, setError] = useState('');
 const [submitting, setSubmitting] = useState(false);

 const sendResetEmail = async (email: string) => {
 const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
 redirectTo: getResetRedirectUrl(),
 });

 if (resetError) {
 throw new Error(resetError.message || 'Unable to send reset link. Please try again.');
 }
 };

 const handleSubmit = async (event: React.FormEvent) => {
 event.preventDefault();

 const cleanIdentifier = identifier.trim().toLowerCase();

 setError('');
 setSubmitted(false);
 setSupportReset(false);

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
 setSupportReset(true);
 return;
 }

 await sendResetEmail(loginEmail);
 setSubmitted(true);
 } catch (err) {
 setError(err instanceof Error ? err.message : 'Unable to process reset request.');
 } finally {
 setSubmitting(false);
 }
 };

 if (submitted) {
 return (
 <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6">
 <div className="max-w-sm text-center">
 <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100">
 <CheckCircle size={32} className="text-emerald-600" />
 </div>

 <h1 className="mb-2 text-2xl font-extrabold text-gray-900">Check Your Email</h1>
 <p className="mb-6 text-sm leading-6 text-gray-500">
 If a real email is linked to this account, we sent a password reset link. Open the latest email and follow the link to set a new password.
 </p>

 <button
 type="button"
 onClick={() => navigate('/login')}
 className="h-12 w-full rounded-2xl bg-orange-500 font-bold text-white transition hover:bg-orange-600"
>
 Back to Sign In
 </button>
 </div>
 </div>
 );
 }

 if (supportReset) {
 return (
 <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6">
 <div className="max-w-sm text-center">
 <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-orange-100">
 <HeadphonesIcon size={32} className="text-orange-600" />
 </div>

 <h1 className="mb-2 text-2xl font-extrabold text-gray-900">Support Reset Required</h1>
 <p className="mb-6 text-sm leading-6 text-gray-500">
 This account was registered with phone only, so email password reset is not available. Please contact Shop2Bhutan support to reset your password.
 </p>

 <div className="grid grid-cols-2 gap-3">
 <button
 type="button"
 onClick={() => navigate('/support')}
 className="h-12 rounded-2xl bg-orange-500 font-bold text-white transition hover:bg-orange-600"
>
 Contact Support
 </button>
 <button
 type="button"
 onClick={() => navigate('/login')}
 className="h-12 rounded-2xl bg-gray-100 font-bold text-gray-700 transition hover:bg-gray-200"
>
 Back to Login
 </button>
 </div>
 </div>
 </div>
 );
 }

 return (
 <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6">
 <div className="w-full max-w-sm">
 <button
 type="button"
 onClick={() => navigate('/login')}
 className="mb-6 flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-700"
>
 <ArrowLeft size={18} />
 Back to Login
 </button>

 <h1 className="mb-2 text-2xl font-extrabold text-gray-900">Reset Password</h1>
 <p className="mb-6 text-sm leading-6 text-gray-500">
 Enter your email or Bhutan mobile number. Real-email accounts receive a reset link. Phone-only accounts need support-assisted reset.
 </p>

 <form onSubmit={handleSubmit} className="space-y-4">
 {error && (
 <div className="rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
 {error}
 </div>
 )}

 <div>
 <label className="mb-1.5 block text-xs font-bold tracking-wider text-gray-600">
 Email or phone number
 </label>

 <div className="relative">
 {identifier.includes('@') ? (
 <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
 ) : (
 <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
 )}

 <input
 type="text"
 value={identifier}
 onChange={(event) => {
 setIdentifier(event.target.value);
 setError('');
 }}
 placeholder="your@email.com or 17123456"
 className="h-12 w-full rounded-2xl border border-gray-200 pl-10 pr-4 text-sm outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
 />
 </div>
 </div>

 <button
 type="submit"
 disabled={submitting}
 className="h-12 w-full rounded-2xl bg-orange-500 font-bold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
>
 {submitting ? 'Checking account...' : 'Continue'}
 </button>
 </form>
 </div>
 </div>
 );
}
