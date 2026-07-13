import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import {
  AlertTriangle,
  Bell,
  CheckCircle,
  ChevronRight,
  ClipboardList,
  HeadphonesIcon,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogOut,
  MapPin,
  Pencil,
  Share2,
  Truck,
  User,
  Wallet,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { getUnreadNotificationCount } from '@/lib/customerOrders';
import { deactivateMyAccount } from '@/lib/account';
import VerificationBadge, {
  getVerificationBadgeLabel,
  getVerificationBadgeToneClass,
  normalizeVerificationBadge,
} from '@/components/shared/VerificationBadge';

const PHONE_ONLY_EMAIL_SUFFIX = '@phone.shop2bhutan.com';
const SHOP2BHUTAN_APP_URL = 'https://shop2bhutan.vercel.app/download';
const SHOP2BHUTAN_SHARE_TEXT =
  'Shop from Amazon, Flipkart, Myntra and Meesho and get your orders delivered to Bhutan with Shop2Bhutan 🇧🇹';

type ProfileLike = {
  full_name?: string | null;
  name?: string | null;
  phone?: string | null;
  default_dzongkhag_id?: string | null;
  dzongkhag?: string | null;
  avatar_url?: string | null;
  account_status?: string | null;
  is_active?: boolean | null;
  deactivated_at?: string | null;
  verification_badge?: string | null;
  verificationBadge?: string | null;
  verified_at?: string | null;
  verification_note?: string | null;
};

type DzongkhagOption = {
  id: string;
  name: string;
};

type MenuItem = {
  icon: React.ElementType;
  label: string;
  description?: string;
  path?: string;
  badge?: boolean;
  action?: 'deactivate_account' | 'share_app';
  danger?: boolean;
  realAccountOnly?: boolean;
};

function isPhoneOnlyEmail(value?: string | null) {
  return Boolean(value?.trim().toLowerCase().endsWith(PHONE_ONLY_EMAIL_SUFFIX));
}

function getDisplayEmail(value?: string | null) {
  const email = value?.trim() || '';
  if (!email || isPhoneOnlyEmail(email)) return 'No email added';
  return email;
}

function getDisplayName(profile: ProfileLike | null, email?: string | null) {
  if (profile?.full_name?.trim()) return profile.full_name.trim();
  if (profile?.name?.trim()) return profile.name.trim();
  if (email && !isPhoneOnlyEmail(email)) return email.split('@')[0];
  return 'Guest';
}

function getProfileVerificationBadge(profile: ProfileLike | null) {
  return normalizeVerificationBadge(
    profile?.verification_badge ?? profile?.verificationBadge,
  );
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function getDzongkhagDisplayName(
  value: string | null | undefined,
  options: DzongkhagOption[],
) {
  const cleanValue = value?.trim() || '';
  if (!cleanValue) return null;
  if (!UUID_RE.test(cleanValue)) return cleanValue;
  return options.find((item) => item.id === cleanValue)?.name || null;
}

const menuGroups: { title: string; items: MenuItem[] }[] = [
  {
    title: 'Orders & Delivery',
    items: [
      {
        icon: ClipboardList,
        label: 'My Orders',
        description: 'Quotations, payments, and tracking',
        path: '/orders',
      },
      {
        icon: Truck,
        label: 'My Parcels',
        description: 'Parcel requests and trip bookings',
        path: '/my-parcels',
      },
      {
        icon: MapPin,
        label: 'Saved Addresses',
        description: 'Manage your delivery destinations',
        path: '/addresses',
      },
      {
        icon: Wallet,
        label: 'Payment History',
        description: 'Uploaded proofs and verification status',
        path: '/payment-history',
      },
    ],
  },
  {
    title: 'Account',
    items: [
      {
        icon: User,
        label: 'Profile',
        description: 'Personal details and profile picture',
        path: '/profile',
      },
      {
        icon: KeyRound,
        label: 'Change Password',
        description: 'Update your login password',
        path: '/change-password',
      },
      {
        icon: Bell,
        label: 'Notifications',
        description: 'Order, parcel, and account updates',
        path: '/notifications',
        badge: true,
      },
      {
        icon: AlertTriangle,
        label: 'Deactivate Account',
        description: 'Disable this account and sign out',
        action: 'deactivate_account',
        danger: true,
        realAccountOnly: true,
      },
    ],
  },
  {
    title: 'Help',
    items: [
      {
        icon: Share2,
        label: 'Share Shop2Bhutan',
        description: 'Invite friends to open or install the app',
        action: 'share_app',
      },
      {
        icon: HeadphonesIcon,
        label: 'Support',
        description: 'Contact Shop2Bhutan support',
        path: '/support',
      },
    ],
  },
];

export default function Account() {
  const navigate = useNavigate();
  const { user, context, signOut, isGuest } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivationReason, setDeactivationReason] = useState('');
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState('');
  const [accountDeactivated, setAccountDeactivated] = useState(false);
  const [dzongkhagOptions, setDzongkhagOptions] = useState<DzongkhagOption[]>([]);
  const [shareFeedback, setShareFeedback] = useState('');

  const profile = (context?.profile ?? null) as ProfileLike | null;
  const hasGuestSession = Boolean(user && isGuest);
  const isLoggedIn = Boolean(user && !isGuest);

  const rawEmail = context?.email || user?.email || '';
  const displayName = hasGuestSession
    ? 'Guest Parcel User'
    : getDisplayName(profile, rawEmail);
  const displayEmail = hasGuestSession
    ? 'Tracking is saved on this device'
    : isLoggedIn
      ? getDisplayEmail(rawEmail)
      : 'Sign in to manage your Shop2Bhutan account';
  const displayPhone = profile?.phone?.trim() || null;
  const displayDzongkhag = getDzongkhagDisplayName(
    profile?.default_dzongkhag_id || profile?.dzongkhag,
    dzongkhagOptions,
  );
  const avatarUrl = profile?.avatar_url?.trim() || null;
  const verificationBadge = getProfileVerificationBadge(profile);
  const emailAdded = displayEmail !== 'No email added' && isLoggedIn;
  const canAccessAdmin = Boolean(
    context?.is_admin || context?.is_super_admin,
  );

  const refreshUnreadCount = useCallback(async () => {
    if (!user || isGuest) {
      setUnreadCount(0);
      return;
    }

    try {
      const count = await getUnreadNotificationCount(user.id);
      setUnreadCount(count);
    } catch (error) {
      console.warn('[Account] Notification count skipped:', error);
      setUnreadCount(0);
    }
  }, [isGuest, user]);

  useEffect(() => {
    void refreshUnreadCount();
  }, [refreshUnreadCount]);

  useEffect(() => {
    const handleNotificationsUpdated = () => {
      void refreshUnreadCount();
    };

    window.addEventListener(
      'shop2bhutan:notifications-updated',
      handleNotificationsUpdated,
    );
    window.addEventListener('focus', handleNotificationsUpdated);

    return () => {
      window.removeEventListener(
        'shop2bhutan:notifications-updated',
        handleNotificationsUpdated,
      );
      window.removeEventListener('focus', handleNotificationsUpdated);
    };
  }, [refreshUnreadCount]);

  useEffect(() => {
    if (!user || isGuest) return undefined;

    const channel = supabase
      .channel(`customer-notifications-account:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void refreshUnreadCount();
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void refreshUnreadCount();
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isGuest, refreshUnreadCount, user]);

  useEffect(() => {
    let active = true;

    async function loadDzongkhags() {
      const { data, error } = await supabase.rpc('get_dzongkhag_options');
      if (!active) return;
      if (!error) setDzongkhagOptions(normalizeDzongkhagOptions(data));
    }

    void loadDzongkhags();

    return () => {
      active = false;
    };
  }, []);

  const handleDeactivateAccount = async () => {
    if (!user || isGuest) return;

    try {
      setDeactivating(true);
      setDeactivateError('');

      await deactivateMyAccount(deactivationReason);
      setUnreadCount(0);
      setDeactivateOpen(false);
      setDeactivationReason('');
      setAccountDeactivated(true);
      await signOut();
    } catch (error) {
      setDeactivateError(
        error instanceof Error
          ? error.message
          : 'Failed to deactivate account. Please try again.',
      );
    } finally {
      setDeactivating(false);
    }
  };

  const copyShareMessage = async (shareMessage: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareMessage);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = shareMessage;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    setShareFeedback('Shop2Bhutan link copied');
    window.setTimeout(() => setShareFeedback(''), 2200);
  };

  const handleShareApp = async () => {
    const shareMessage = `${SHOP2BHUTAN_SHARE_TEXT}\n\nOpen or install Shop2Bhutan:\n${SHOP2BHUTAN_APP_URL}`;

    try {
      if (Capacitor.isNativePlatform()) {
        const { value: nativeSharingAvailable } = await Share.canShare();

        if (!nativeSharingAvailable) {
          await copyShareMessage(shareMessage);
          return;
        }

        await Share.share({
          title: 'Shop2Bhutan',
          text: shareMessage,
          dialogTitle: 'Share Shop2Bhutan',
        });
        return;
      }

      const webShareData = {
        title: 'Shop2Bhutan',
        text: shareMessage,
      };

      const webSharingAvailable =
        Boolean(navigator.share) &&
        (!navigator.canShare || navigator.canShare(webShareData));

      if (webSharingAvailable) {
        await navigator.share(webShareData);
        return;
      }

      await copyShareMessage(shareMessage);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;

      console.warn('[Account] Share failed:', error);

      try {
        await copyShareMessage(shareMessage);
      } catch (copyError) {
        console.warn('[Account] Copy fallback failed:', copyError);
        setShareFeedback('Unable to share. Please try again.');
        window.setTimeout(() => setShareFeedback(''), 2600);
      }
    }
  };

  const handleLogout = async () => {
    setUnreadCount(0);
    await signOut();
    navigate('/login');
  };

  if (accountDeactivated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6 py-10">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
            <CheckCircle size={31} strokeWidth={2.4} />
          </div>

          <h1 className="mt-5 text-2xl font-black tracking-tight text-slate-950">
            Account deactivated
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            You have been signed out. Your order, payment, and parcel records
            remain safely stored for support and admin reference.
          </p>

          <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-700">
            Contact Shop2Bhutan support when you need this account reactivated.
          </div>

          <button
            type="button"
            onClick={() => navigate('/login', { replace: true })}
            className="mt-6 h-12 w-full rounded-2xl bg-orange-500 text-sm font-bold text-white transition active:scale-[0.98]"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto max-w-3xl px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500">
            Your Account
          </p>
          <h1 className="mt-0.5 text-xl font-black tracking-tight text-slate-950">
            Account
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4">
        {/* Profile Card */}
        <section className="overflow-hidden rounded-[22px] bg-slate-900 text-white shadow-lg shadow-slate-900/10">
          <div className="flex items-center gap-4 p-4">
            <button
              type="button"
              onClick={() => isLoggedIn && navigate('/profile')}
              className="relative shrink-0"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="h-[68px] w-[68px] rounded-full object-cover ring-2 ring-white/15"
                />
              ) : (
                <div className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-white/10 ring-1 ring-white/10">
                  <span className="text-3xl font-black text-orange-400">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}

              {isLoggedIn && (
                <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-xl bg-orange-500 text-white ring-2 ring-slate-900">
                  <Pencil size={13} strokeWidth={2.5} />
                </span>
              )}
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-1">
                <h2 className="truncate text-lg font-black tracking-tight">
                  {displayName}
                </h2>
                <span className="[&>*]:ring-0 [&>*]:border-0 [&>*]:shadow-none">
                  <VerificationBadge badge={verificationBadge} size="xs" />
                </span>
              </div>

              {verificationBadge !== 'none' && (
                <p
                  className={`mt-0.5 text-xs font-bold ${getVerificationBadgeToneClass(
                    verificationBadge,
                  )}`}
                >
                  {getVerificationBadgeLabel(verificationBadge)}
                </p>
              )}

              <p className={`mt-1 truncate text-sm ${emailAdded ? 'text-slate-300' : 'text-slate-500'}`}>
                {displayEmail}
              </p>

              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
                {displayPhone && <span>+975 {displayPhone}</span>}
                {displayDzongkhag && <span>{displayDzongkhag}</span>}
              </div>
            </div>

            {isLoggedIn && (
              <ChevronRight
                size={18}
                className="shrink-0 text-white/30"
              />
            )}
          </div>

          {isLoggedIn && (
            <button
              type="button"
              onClick={() => navigate('/profile')}
              className="flex w-full items-center justify-between border-t border-white/10 px-4 py-2.5 text-left active:bg-white/5 transition"
            >
              <span className="text-xs font-semibold text-slate-400">View and edit personal details</span>
              <span className="text-xs font-extrabold text-orange-400">Edit profile</span>
            </button>
          )}
        </section>

        {!isLoggedIn && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="h-11 rounded-2xl bg-orange-500 text-sm font-bold text-white transition active:scale-[0.98]"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => navigate('/register')}
              className="h-11 rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-700 transition active:scale-[0.98]"
            >
              Register
            </button>
          </div>
        )}

        {hasGuestSession && (
          <button
            type="button"
            onClick={() => navigate('/my-parcels')}
            className="mt-3 flex w-full items-center gap-3 rounded-[18px] bg-blue-50 px-4 py-3 text-left ring-1 ring-blue-100 active:scale-[0.99] transition"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm ring-1 ring-blue-100">
              <Truck size={18} strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-blue-900">
                Guest parcel tracking
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-blue-700">
                Saved on this device only
              </span>
            </span>
            <ChevronRight size={17} className="text-blue-300 shrink-0" />
          </button>
        )}

        {isLoggedIn && !emailAdded && (
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="mt-3 flex w-full items-center gap-3 rounded-[18px] bg-amber-50/70 px-4 py-3 text-left ring-1 ring-amber-100 active:scale-[0.99] transition"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-amber-500 shadow-sm ring-1 ring-amber-100">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-slate-900">
                Add email for recovery
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                For password recovery and important updates
              </span>
            </span>
            <ChevronRight size={17} className="text-slate-400 shrink-0" />
          </button>
        )}

        {canAccessAdmin && (
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="mt-3 flex w-full items-center gap-3 rounded-[18px] bg-white px-4 py-3 text-left ring-1 ring-slate-100 shadow-sm active:scale-[0.99] transition"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-orange-400">
              <LayoutDashboard size={20} strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-black text-slate-950">
                Admin Panel
              </span>
              <span className="mt-0.5 block truncate text-xs text-slate-500">
                Manage Shop2Bhutan operations
              </span>
            </span>
            <ChevronRight size={17} className="text-slate-300 shrink-0" />
          </button>
        )}

        {/* Menu Groups — neutral icons */}
        <div className="mt-5 space-y-5">
          {menuGroups.map((group) => {
            const visibleItems = group.items.filter(
              (item) => !item.realAccountOnly || isLoggedIn,
            );

            return (
              <section key={group.title}>
                <div className="mb-2 flex items-center justify-between px-1">
                  <h2 className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                    {group.title}
                  </h2>
                  <span className="text-[10px] font-bold text-slate-300">
                    {visibleItems.length}
                  </span>
                </div>

                <div className="overflow-hidden rounded-[18px] bg-white ring-1 ring-slate-100">
                  {visibleItems.map((item, index) => {
                    const Icon = item.icon;
                    const isDanger = Boolean(item.danger);

                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => {
                          if (item.action === 'deactivate_account') {
                            setDeactivateOpen(true);
                            setDeactivateError('');
                            return;
                          }

                          if (item.action === 'share_app') {
                            void handleShareApp();
                            return;
                          }

                          if (item.path) navigate(item.path);
                        }}
                        className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition active:scale-[0.995] ${
                          isDanger ? 'active:bg-red-50' : 'active:bg-slate-50'
                        } ${
                          index < visibleItems.length - 1
                            ? 'border-b border-slate-100'
                            : ''
                        }`}
                      >
                        {/* Neutral icon background — no colors */}
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                            isDanger
                              ? 'bg-red-50 text-red-500'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          <Icon size={18} strokeWidth={2.1} />
                        </span>

                        <span className="min-w-0 flex-1">
                          <span
                            className={`block text-sm font-bold ${
                              isDanger ? 'text-red-600' : 'text-slate-900'
                            }`}
                          >
                            {item.label}
                          </span>
                          {item.description && (
                            <span
                              className={`mt-0.5 block truncate text-xs ${
                                isDanger ? 'text-red-400' : 'text-slate-400'
                              }`}
                            >
                              {item.description}
                            </span>
                          )}
                        </span>

                        {item.badge && unreadCount > 0 && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                            {unreadCount}
                          </span>
                        )}

                        <ChevronRight
                          size={17}
                          className={
                            isDanger ? 'text-red-200 shrink-0' : 'text-slate-300 shrink-0'
                          }
                        />
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        {isLoggedIn ? (
          <button
            type="button"
            onClick={handleLogout}
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-[18px] bg-white text-sm font-bold text-slate-700 ring-1 ring-slate-200 transition active:scale-[0.98]"
          >
            <LogOut size={18} strokeWidth={2} />
            Log Out
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-[18px] bg-orange-500 text-sm font-bold text-white transition active:scale-[0.98]"
          >
            Sign In to Continue
          </button>
        )}
      </main>

      {shareFeedback && (
        <div className="fixed bottom-[calc(6.75rem+env(safe-area-inset-bottom))] left-1/2 z-[90] -translate-x-1/2 px-4">
          <div className="whitespace-nowrap rounded-full bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-xl shadow-slate-900/20">
            {shareFeedback}
          </div>
        </div>
      )}

      {deactivateOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 px-3 pt-12 backdrop-blur-[2px] sm:items-center sm:p-4">
          <div className="max-h-[calc(100dvh-1rem)] w-full max-w-md overflow-y-auto rounded-t-[22px] bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[22px]">
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden" />

            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                <AlertTriangle size={21} strokeWidth={2} />
              </span>

              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-black tracking-tight text-slate-950">
                  Deactivate account?
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  You will be signed out, but your order, payment, and parcel
                  records will remain safely stored.
                </p>
              </div>

              <button
                type="button"
                onClick={() => !deactivating && setDeactivateOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition active:scale-95"
                disabled={deactivating}
                aria-label="Close"
              >
                <X size={17} strokeWidth={2} />
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-700">
              Shop2Bhutan admin support will be required to reactivate this
              account later.
            </div>

            <label className="mt-4 block text-xs font-bold text-slate-700">
              Reason <span className="font-medium text-slate-400">(optional)</span>
            </label>
            <textarea
              value={deactivationReason}
              onChange={(event) => setDeactivationReason(event.target.value)}
              placeholder="Tell us why you are leaving"
              className="mt-1.5 h-24 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-500/10"
              disabled={deactivating}
            />

            {deactivateError && (
              <div className="mt-3 rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
                {deactivateError}
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDeactivateOpen(false)}
                disabled={deactivating}
                className="h-11 rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-700 transition active:scale-95 disabled:opacity-60"
              >
                Keep Account
              </button>

              <button
                type="button"
                onClick={handleDeactivateAccount}
                disabled={deactivating}
                className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-red-500 text-sm font-bold text-white transition active:scale-95 disabled:opacity-60"
              >
                {deactivating && <Loader2 size={16} className="animate-spin" />}
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
