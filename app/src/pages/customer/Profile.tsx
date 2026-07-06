import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  CheckCircle,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Save,
  User,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import VerificationBadge, { getVerificationBadgeLabel, normalizeVerificationBadge } from '@/components/shared/VerificationBadge';

type ProfileLike = {
  id?: string | null;
  full_name?: string | null;
  name?: string | null;
  phone?: string | null;
  default_dzongkhag_id?: string | null;
  dzongkhag?: string | null;
  avatar_url?: string | null;
  verification_badge?: string | null;
  verificationBadge?: string | null;
  verified_at?: string | null;
  verification_note?: string | null;
};

type DzongkhagOption = {
  id: string;
  name: string;
};

const PHONE_ONLY_EMAIL_SUFFIX = '@phone.shop2bhutan.com';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isPhoneOnlyEmail(value?: string | null) {
  return Boolean(value?.trim().toLowerCase().endsWith(PHONE_ONLY_EMAIL_SUFFIX));
}

function getRealEmail(value?: string | null) {
  const email = value?.trim() || '';
  if (!email || isPhoneOnlyEmail(email)) return '';
  return email;
}

function getDisplayEmail(value?: string | null) {
  const realEmail = getRealEmail(value);
  return realEmail || 'No email added';
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

function getAvatarPath(userId: string, file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  return `${userId}/avatar-${Date.now()}.${extension}`;
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

function resolveDzongkhagId(rawValue: string | null | undefined, options: DzongkhagOption[]) {
  const value = rawValue?.trim() || '';
  if (!value) return '';
  if (UUID_RE.test(value)) return value;
  const match = options.find((item) => item.name.toLowerCase() === value.toLowerCase());
  return match?.id || '';
}

function getDzongkhagName(idOrName: string | null | undefined, options: DzongkhagOption[]) {
  const value = idOrName?.trim() || '';
  if (!value) return '';
  if (!UUID_RE.test(value)) return value;
  return options.find((item) => item.id === value)?.name || '';
}

function getProfileVerificationBadge(profile: ProfileLike | null) {
  return normalizeVerificationBadge(profile?.verification_badge ?? profile?.verificationBadge);
}

export default function Profile() {
  const navigate = useNavigate();
  const { user, context, refreshContext, signOut } = useAuth();

  const profile = context?.profile as ProfileLike | null;
  const currentRealEmail = getRealEmail(context?.email || user?.email);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dzongkhagId, setDzongkhagId] = useState('');
  const [dzongkhagOptions, setDzongkhagOptions] = useState<DzongkhagOption[]>([]);
  const [loadingDzongkhags, setLoadingDzongkhags] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const displayEmail = getDisplayEmail(context?.email || user?.email);
  const verificationBadge = getProfileVerificationBadge(profile);
  const registeredDzongkhagName = getDzongkhagName(dzongkhagId, dzongkhagOptions);

  const initials = useMemo(() => {
    const source = fullName || displayEmail || 'Customer';
    return source.charAt(0).toUpperCase();
  }, [fullName, displayEmail]);

  useEffect(() => {
    let active = true;
    async function loadDzongkhags() {
      setLoadingDzongkhags(true);
      const { data, error: rpcError } = await supabase.rpc('get_dzongkhag_options');
      if (!active) return;
      if (rpcError) {
        console.warn('Failed to load dzongkhags:', rpcError.message);
        setDzongkhagOptions([]);
      } else {
        setDzongkhagOptions(normalizeDzongkhagOptions(data));
      }
      setLoadingDzongkhags(false);
    }
    void loadDzongkhags();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const metadata = user?.user_metadata as Record<string, unknown> | undefined;
    const metadataDzongkhag =
      (typeof metadata?.default_dzongkhag_id === 'string' && metadata.default_dzongkhag_id) ||
      (typeof metadata?.default_dzongkhag_name === 'string' && metadata.default_dzongkhag_name) ||
      (typeof metadata?.dzongkhag === 'string' && metadata.dzongkhag) ||
      '';
    const rawDzongkhag = profile?.default_dzongkhag_id || profile?.dzongkhag || metadataDzongkhag;

    setFullName(profile?.full_name || profile?.name || '');
    setEmail(currentRealEmail);
    setPhone(profile?.phone || '');
    setDzongkhagId(resolveDzongkhagId(rawDzongkhag, dzongkhagOptions));
    setAvatarUrl(profile?.avatar_url || null);
  }, [profile, currentRealEmail, dzongkhagOptions, user?.user_metadata]);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const showError = (message: string) => {
    setSuccess('');
    setError(message);
  };

  const handleAvatarUpload = async (file: File | null) => {
    if (!user) { showError('Please sign in to upload a profile picture.'); return; }
    if (!file) return;
    if (!file.type.startsWith('image/')) { showError('Please upload an image file only.'); return; }
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) { showError('Profile picture must be 2MB or smaller.'); return; }

    setUploadingAvatar(true);
    setError('');
    setSuccess('');

    const path = getAvatarPath(user.id, file);
    const { error: uploadError } = await supabase.storage
      .from('profile-avatars')
      .upload(path, file, { cacheControl: '3600', upsert: true });

    if (uploadError) {
      setUploadingAvatar(false);
      showError(uploadError.message || 'Unable to upload profile picture.');
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from('profile-avatars').getPublicUrl(path);
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    setUploadingAvatar(false);
    if (updateError) { showError(updateError.message || 'Avatar uploaded, but profile update failed.'); return; }

    setAvatarUrl(publicUrl);
    await refreshContext();
    setSuccess('Profile picture updated.');
  };

  const checkProfileDuplicates = async (nextEmail: string | null, nextPhone: string) => {
    const { data, error: rpcError } = await supabase.rpc('check_profile_update_duplicate', {
      p_email: nextEmail,
      p_phone: nextPhone,
    });
    if (rpcError) {
      console.warn('Profile duplicate check skipped:', rpcError.message);
      return { emailExists: false, phoneExists: false };
    }
    const result = data as { email_exists?: boolean; phone_exists?: boolean } | null;
    return { emailExists: Boolean(result?.email_exists), phoneExists: Boolean(result?.phone_exists) };
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { showError('Please sign in to edit your profile.'); return; }

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const normalizedPhone = normalizeBhutanPhone(phone);

    setError('');
    setSuccess('');

    if (!cleanName) { showError('Full name is required.'); return; }
    if (cleanEmail && !isValidEmail(cleanEmail)) { showError('Please enter a valid email address.'); return; }
    if (currentRealEmail && !cleanEmail) { showError('Email cannot be removed after it has been added.'); return; }
    if (!phone.trim()) { showError('Phone number is required.'); return; }
    if (!normalizedPhone) { showError('Enter a valid Bhutan mobile number starting with 17 or 77.'); return; }
    if (!dzongkhagId) { showError('Please select your dzongkhag.'); return; }

    setSaving(true);
    const emailChanged = cleanEmail && cleanEmail !== currentRealEmail.toLowerCase();
    const { emailExists, phoneExists } = await checkProfileDuplicates(
      emailChanged ? cleanEmail : null,
      normalizedPhone
    );

    if (emailExists || phoneExists) {
      setSaving(false);
      showError(emailExists ? 'This email is already linked to another account.' : 'This phone number is already linked to another account.');
      return;
    }

    if (emailChanged) {
      const { error: emailUpdateError } = await supabase.auth.updateUser({ email: cleanEmail });
      if (emailUpdateError) { setSaving(false); showError(emailUpdateError.message || 'Unable to update email.'); return; }
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: cleanName,
        phone: normalizedPhone,
        default_dzongkhag_id: dzongkhagId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    setSaving(false);
    if (updateError) { showError(updateError.message || 'Unable to update profile.'); return; }

    setPhone(normalizedPhone);
    await refreshContext();
    setSuccess(emailChanged ? 'Profile updated. Email saved for recovery.' : 'Profile updated successfully.');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-white px-4 py-8">
        <div className="mx-auto max-w-md rounded-2xl border border-gray-100 bg-white p-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50">
            <User size={26} className="text-orange-500" />
          </div>
          <h1 className="mb-2 text-xl font-bold text-gray-900">Sign in required</h1>
          <p className="mb-5 text-sm text-gray-500">Please sign in to manage your Shop2Bhutan profile.</p>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="h-12 w-full rounded-2xl bg-orange-500 font-bold text-white hover:bg-orange-600"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-gray-100 bg-white px-4 py-3">
        <div className="mx-auto max-w-md flex items-center">
          
          <div>
            <h1 className="text-lg font-bold text-gray-900">Edit Profile</h1>
            <p className="text-xs text-gray-500">Update your personal details</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-md px-4 py-6">
        {/* Avatar */}
        <div className="flex flex-col items-center">
          <div className="relative">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={fullName || 'Profile picture'}
                className="h-24 w-24 rounded-full object-cover border border-gray-100 shadow-sm"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full border border-gray-100 bg-gray-50 shadow-sm">
                <span className="text-3xl font-extrabold text-gray-400">{initials}</span>
              </div>
            )}
            <label className="absolute -bottom-2 -right-2 flex h-10 w-10 cursor-pointer items-center justify-center rounded-2xl bg-orange-500 text-white shadow-sm border-2 border-white">
              {uploadingAvatar ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} strokeWidth={2} />}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploadingAvatar}
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  void handleAvatarUpload(file);
                  event.target.value = '';
                }}
              />
            </label>
          </div>
          <div className="mt-3 flex items-center justify-center gap-1.5">
            <p className="text-sm font-bold text-gray-900">{fullName || 'Your Profile'}</p>
            <VerificationBadge badge={verificationBadge} size="sm" />
          </div>
          {verificationBadge !== 'none' && (
            <p className="mt-0.5 text-xs font-bold text-amber-600">
              {getVerificationBadgeLabel(verificationBadge)}
            </p>
          )}
          <p className="text-xs text-gray-500">{displayEmail}</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="mt-6 space-y-4">
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <CheckCircle size={16} strokeWidth={2.5} />
              {success}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">Full name</label>
            <div className="relative">
              <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={fullName}
                onChange={(event) => { setFullName(event.target.value); setError(''); setSuccess(''); }}
                className="h-12 w-full rounded-2xl border border-gray-200 pl-10 pr-4 text-sm outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
                placeholder="Your full name"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">Email address (optional)</label>
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(event) => { setEmail(event.target.value); setError(''); setSuccess(''); }}
                className="h-12 w-full rounded-2xl border border-gray-200 pl-10 pr-4 text-sm outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
                placeholder="Add email for recovery"
              />
            </div>
            <p className="mt-1 text-xs leading-5 text-gray-400">
              Optional. Add an email for password recovery and order updates.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">Bhutan mobile number</label>
            <div className="relative">
              <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="tel"
                value={phone}
                onChange={(event) => { setPhone(event.target.value); setError(''); setSuccess(''); }}
                className="h-12 w-full rounded-2xl border border-gray-200 pl-10 pr-4 text-sm outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
                placeholder="17123456 or 77123456"
              />
            </div>
            <p className="mt-1 text-xs text-gray-400">Must be 8 digits and start with 17 or 77.</p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">Registered dzongkhag</label>
            <div className="relative">
              <MapPin size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={dzongkhagId}
                disabled={loadingDzongkhags}
                onChange={(event) => { setDzongkhagId(event.target.value); setError(''); setSuccess(''); }}
                className="h-12 w-full appearance-none rounded-2xl border border-gray-200 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 disabled:bg-gray-50"
              >
                <option value="">{loadingDzongkhags ? 'Loading dzongkhags...' : 'Select dzongkhag'}</option>
                {dzongkhagOptions.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            {registeredDzongkhagName && (
              <p className="mt-1 text-xs text-emerald-600">Registered as {registeredDzongkhagName}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={saving || loadingDzongkhags}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 font-bold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <><Loader2 size={18} className="animate-spin" /> Saving...</>
            ) : (
              <><Save size={18} strokeWidth={2.5} /> Save Profile</>
            )}
          </button>
        </form>

        <button
          type="button"
          onClick={handleLogout}
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white font-bold text-gray-700 transition hover:bg-gray-50"
        >
          <LogOut size={18} strokeWidth={2} />
          Logout
        </button>
      </div>
    </div>
  );
}
