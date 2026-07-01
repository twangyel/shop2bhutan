import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
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
import { DZONGKHAGS } from '@/data/mockData';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type ProfileLike = {
  id?: string | null;
  full_name?: string | null;
  name?: string | null;
  phone?: string | null;
  default_dzongkhag_id?: string | null;
  dzongkhag?: string | null;
  avatar_url?: string | null;
};

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

function getAvatarPath(userId: string, file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  return `${userId}/avatar-${Date.now()}.${extension}`;
}

export default function Profile() {
  const navigate = useNavigate();
  const { user, context, refreshContext, signOut } = useAuth();

  const profile = context?.profile as ProfileLike | null;

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [dzongkhag, setDzongkhag] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const displayEmail = context?.email || user?.email || '';

  const initials = useMemo(() => {
    const source = fullName || displayEmail || 'Customer';
    return source.charAt(0).toUpperCase();
  }, [fullName, displayEmail]);

  useEffect(() => {
    setFullName(profile?.full_name || profile?.name || '');
    setPhone(profile?.phone || '');
    setDzongkhag(profile?.default_dzongkhag_id || profile?.dzongkhag || '');
    setAvatarUrl(profile?.avatar_url || null);
  }, [profile]);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const handleAvatarUpload = async (file: File | null) => {
    if (!user) {
      setError('Please sign in to upload a profile picture.');
      return;
    }

    if (!file) return;

    setError('');
    setSuccess('');

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file only.');
      return;
    }

    const maxSize = 2 * 1024 * 1024;

    if (file.size > maxSize) {
      setError('Profile picture must be 2MB or smaller.');
      return;
    }

    setUploadingAvatar(true);

    const path = getAvatarPath(user.id, file);

    const { error: uploadError } = await supabase.storage
      .from('profile-avatars')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      setUploadingAvatar(false);
      setError(uploadError.message || 'Unable to upload profile picture.');
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('profile-avatars').getPublicUrl(path);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        avatar_url: publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    setUploadingAvatar(false);

    if (updateError) {
      setError(updateError.message || 'Avatar uploaded, but profile update failed.');
      return;
    }

    setAvatarUrl(publicUrl);
    await refreshContext();
    setSuccess('Profile picture updated.');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setError('Please sign in to edit your profile.');
      return;
    }

    const cleanName = fullName.trim();
    const normalizedPhone = normalizeBhutanPhone(phone);

    setError('');
    setSuccess('');

    if (!cleanName) {
      setError('Full name is required.');
      return;
    }

    if (!phone.trim()) {
      setError('Phone number is required.');
      return;
    }

    if (!normalizedPhone) {
      setError('Enter a valid Bhutan mobile number starting with 17 or 77.');
      return;
    }

    if (!dzongkhag) {
      setError('Please select your dzongkhag.');
      return;
    }

    setSaving(true);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: cleanName,
        phone: normalizedPhone,
        default_dzongkhag_id: dzongkhag,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    setSaving(false);

    if (updateError) {
      setError(updateError.message || 'Unable to update profile.');
      return;
    }

    setPhone(normalizedPhone);
    await refreshContext();
    setSuccess('Profile updated successfully.');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-neutral-50 px-4 py-8">
        <div className="max-w-md mx-auto bg-white rounded-2xl p-6 text-center shadow-sm">
          <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <User size={26} className="text-amber-600" />
          </div>

          <h1 className="text-xl font-bold text-gray-900 mb-2">Sign in required</h1>
          <p className="text-sm text-neutral-500 mb-5">
            Please sign in to manage your Shop2Bhutan profile.
          </p>

          <button
            type="button"
            onClick={() => navigate('/login')}
            className="w-full h-12 bg-amber-500 text-white font-semibold rounded-xl"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <div className="bg-gradient-to-br from-amber-500 to-amber-600 px-4 pt-6 pb-8 rounded-b-3xl">
        <div className="max-w-md mx-auto">
          <button
            type="button"
            onClick={() => navigate('/account')}
            className="flex items-center gap-2 text-white/85 text-sm mb-5"
          >
            <ArrowLeft size={18} />
            Back to Account
          </button>

          <div className="text-center">
            <div className="relative w-24 h-24 mx-auto">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={fullName || 'Profile picture'}
                  className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-white border-4 border-white shadow-lg flex items-center justify-center">
                  <span className="text-3xl font-bold text-amber-600">{initials}</span>
                </div>
              )}

              <label className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center cursor-pointer">
                {uploadingAvatar ? (
                  <Loader2 size={18} className="text-amber-600 animate-spin" />
                ) : (
                  <Camera size={18} className="text-amber-600" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingAvatar}
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    void handleAvatarUpload(file);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>

            <h1 className="text-xl font-bold text-white mt-4">
              {fullName || 'Your Profile'}
            </h1>
            <p className="text-sm text-white/85">{displayEmail}</p>
            <p className="text-xs text-white/75 mt-1">
              Tap the camera icon to upload profile picture.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 -mt-4">
        <form onSubmit={handleSave} className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 flex items-center gap-2">
              <CheckCircle size={16} />
              {success}
            </div>
          )}

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
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  setError('');
                  setSuccess('');
                }}
                className="w-full h-12 pl-10 pr-4 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                placeholder="Your full name"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 uppercase tracking-wider mb-1.5">
              Email
            </label>
            <div className="relative">
              <Mail
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
              />
              <input
                type="email"
                value={displayEmail}
                disabled
                className="w-full h-12 pl-10 pr-4 border border-neutral-200 rounded-xl text-sm bg-neutral-50 text-neutral-500"
              />
            </div>
            <p className="text-[11px] text-neutral-400 mt-1">
              Email is managed by Supabase Auth.
            </p>
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
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setError('');
                  setSuccess('');
                }}
                className="w-full h-12 pl-10 pr-4 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                placeholder="17123456 or 77123456"
              />
            </div>
            <p className="text-[11px] text-neutral-400 mt-1">
              Must be 8 digits and start with 17 or 77.
            </p>
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
                value={dzongkhag}
                onChange={(e) => {
                  setDzongkhag(e.target.value);
                  setError('');
                  setSuccess('');
                }}
                className="w-full h-12 pl-10 pr-4 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 appearance-none bg-white"
              >
                <option value="">Select dzongkhag</option>
                {DZONGKHAGS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full h-12 bg-amber-500 text-white font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-amber-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={18} />
                Save Profile
              </>
            )}
          </button>
        </form>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full h-12 mt-4 bg-red-50 text-red-600 font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </div>
  );
}
