import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  ChevronRight,
  ClipboardList,
  HeadphonesIcon,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogOut,
  MapPin,
  Pencil,
  Truck,
  User,
  Wallet,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { getUnreadNotificationCount } from '@/lib/customerOrders';
import { deactivateMyAccount } from '@/lib/account';

const PHONE_ONLY_EMAIL_SUFFIX = '@phone.shop2bhutan.com';

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
  action?: 'deactivate_account';
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function getDzongkhagDisplayName(value: string | null | undefined, options: DzongkhagOption[]) {
  const cleanValue = value?.trim() || '';
  if (!cleanValue) return null;
  if (!UUID_RE.test(cleanValue)) return cleanValue;
  return options.find((item) => item.id === cleanValue)?.name || null;
}

const menuGroups: { title: string; items: MenuItem[] }[] = [
  {
    title: 'Orders & Delivery',
    items: [
      { icon: ClipboardList, label: 'My Orders', description: 'View quotations, payments, and tracking', path: '/orders' },
      { icon: Truck, label: 'My Parcels', description: 'Parcel requests and trip bookings', path: '/my-parcels' },
      { icon: MapPin, label: 'Saved Addresses', description: 'Manage delivery addresses', path: '/addresses' },
      { icon: Wallet, label: 'Payment History', description: 'Payment records from your orders', path: '/orders' },
    ],
  },
  {
    title: 'Account',
    items: [
      { icon: User, label: 'Profile', description: 'Name, phone, email, and photo', path: '/profile' },
      { icon: KeyRound, label: 'Change Password', description: 'Update your login password', path: '/change-password' },
      { icon: Bell, label: 'Notifications', description: 'Updates and account alerts', path: '/notifications', badge: true },
      {
        icon: AlertTriangle,
        label: 'Deactivate Account',
        description: 'Disable your account and sign out',
        action: 'deactivate_account',
        danger: true,
        realAccountOnly: true,
      },
    ],
  },
  {
    title: 'Help',
    items: [
      { icon: HeadphonesIcon, label: 'Support', description: 'Contact Shop2Bhutan support', path: '/support' },
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
  const [loggingOut, setLoggingOut] = useState(false);

  const [dzongkhagOptions, setDzongkhagOptions] = useState<DzongkhagOption[]>([]);

  const profile = (context?.profile ?? null) as ProfileLike | null;
  const hasGuestSession = Boolean(user && isGuest);
  const isLoggedIn = Boolean(user && !isGuest);

  const rawEmail = context?.email || user?.email || '';
  const displayName = hasGuestSession ? 'Guest Parcel User' : getDisplayName(profile, rawEmail);
  const displayEmail = hasGuestSession
    ? 'Guest parcel tracking on this device'
    : isLoggedIn
      ? getDisplayEmail(rawEmail)
      : 'Sign in to manage your orders';
  const displayPhone = profile?.phone?.trim() || null;
  const displayDzongkhag = getDzongkhagDisplayName(
    profile?.default_dzongkhag_id || profile?.dzongkhag,
    dzongkhagOptions
  );
  const avatarUrl = profile?.avatar_url?.trim() || null;
  const emailAdded = displayEmail !== 'No email added' && isLoggedIn;
  const canAccessAdmin = Boolean(context?.is_admin || context?.is_super_admin);

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

    window.addEventListener('shop2bhutan:notifications-updated', handleNotificationsUpdated);
    window.addEventListener('focus', handleNotificationsUpdated);

    return () => {
      window.removeEventListener('shop2bhutan:notifications-updated', handleNotificationsUpdated);
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
        }
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
      await signOut();
      navigate('/login', { replace: true });
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

  const handleLogout = async () => {
    if (loggingOut) return;

    try {
      setLoggingOut(true);
      setUnreadCount(0);
      await new Promise((resolve) => window.setTimeout(resolve, 160));
      await signOut();
      navigate('/login', { replace: true });
    } catch (error) {
      console.warn('[Account] Logout skipped:', error);
      setLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="mx-auto max-w-3xl px-4 pt-4">

        {/* ===== Profile Header ===== */}
        <div className="flex items-start gap-4">
          <button
            type="button"
            onClick={() => isLoggedIn && navigate('/profile')}
            className="relative shrink-0"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="h-20 w-20 rounded-3xl object-cover border border-gray-100 shadow-sm"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-gray-100 bg-gray-50 shadow-sm">
                <span className="text-2xl font-extrabold text-gray-400">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            {isLoggedIn && (
              <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-white shadow-sm border-2 border-white">
                <Pencil size={13} strokeWidth={2.5} />
              </span>
            )}
          </button>

          <div className="min-w-0 flex-1 pt-1">
            <h1 className="truncate text-xl font-bold text-gray-900">{displayName}</h1>
            <p className="mt-0.5 truncate text-sm text-gray-500">{displayEmail}</p>
            {displayPhone && <p className="text-sm text-gray-500">+975 {displayPhone}</p>}
            {displayDzongkhag && <p className="text-xs text-gray-400">{displayDzongkhag}</p>}
          </div>
        </div>

        {/* ===== Auth Buttons ===== */}
        {!isLoggedIn && (
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="h-12 rounded-2xl bg-orange-500 text-sm font-bold text-white transition-colors hover:bg-orange-600"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => navigate('/register')}
              className="h-12 rounded-2xl border border-gray-200 bg-white text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50"
            >
              Register
            </button>
          </div>
        )}

        {hasGuestSession && (
          <button
            type="button"
            onClick={() => navigate('/my-parcels')}
            className="mt-4 w-full rounded-2xl border border-blue-100 bg-blue-50 p-4 text-left"
          >
            <p className="text-sm font-bold text-blue-900">Guest Parcel Tracking</p>
            <p className="mt-0.5 text-xs leading-5 text-blue-700">
              You are using a guest parcel session. Your parcel tracking is saved on this device only.
            </p>
          </button>
        )}

        {/* ===== Add Email Prompt ===== */}
        {isLoggedIn && !emailAdded && (
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="mt-4 w-full rounded-2xl border border-gray-100 bg-white p-4 text-left border-l-4 border-l-orange-400"
          >
            <p className="text-sm font-bold text-gray-900">Add email for recovery</p>
            <p className="mt-0.5 text-xs leading-5 text-gray-500">
              Email is optional, but adding one helps with password recovery and order updates.
            </p>
          </button>
        )}

        {/* ===== Admin Panel ===== */}
        {canAccessAdmin && (
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="mt-4 w-full overflow-hidden rounded-2xl bg-gray-900 p-4 text-left text-white transition-colors hover:bg-gray-800"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-orange-400">
                <LayoutDashboard size={22} strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-extrabold">Admin Panel</span>
                <span className="mt-0.5 block text-xs leading-5 text-gray-400">
                  Manage orders, quotations, payments, products, parcels, and settings.
                </span>
              </span>
              <ChevronRight size={18} className="text-gray-500" />
            </div>
          </button>
        )}

        {/* ===== Menu Groups ===== */}
        <div className="mt-5 space-y-5">
          {menuGroups.map((group) => (
            <div key={group.title}>
              <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                {group.title}
              </p>

              <div className="overflow-hidden rounded-2xl bg-white border border-gray-100">
                {group.items
                  .filter((item) => !item.realAccountOnly || isLoggedIn)
                  .map((item, index, visibleItems) => {
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

                        if (item.path) navigate(item.path);
                      }}
                      className={`flex w-full items-center gap-3 px-4 py-4 text-left transition-colors ${
                        isDanger ? 'hover:bg-red-50' : 'hover:bg-gray-50'
                      } ${index < visibleItems.length - 1 ? 'border-b border-gray-100' : ''}`}
                    >
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          isDanger ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-gray-500'
                        }`}
                      >
                        <Icon size={19} strokeWidth={2} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm font-bold ${isDanger ? 'text-red-600' : 'text-gray-900'}`}>
                          {item.label}
                        </span>
                        {item.description && (
                          <span className={`mt-0.5 block truncate text-xs ${isDanger ? 'text-red-400' : 'text-gray-500'}`}>
                            {item.description}
                          </span>
                        )}
                      </span>
                      {item.badge && unreadCount > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                          {unreadCount}
                        </span>
                      )}
                      <ChevronRight size={17} className={isDanger ? 'text-red-200' : 'text-gray-300'} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* ===== Logout ===== */}
        {isLoggedIn ? (
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
          >
            {loggingOut ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} strokeWidth={2} />}
            {loggingOut ? 'Signing out...' : 'Logout'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 text-sm font-bold text-white transition-colors hover:bg-orange-600"
          >
            Sign In to Continue
          </button>
        )}
      </div>

      {loggingOut && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-white/80 px-6 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-3xl border border-orange-100 bg-white p-5 text-center shadow-2xl shadow-orange-500/10">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
              <Loader2 size={26} className="animate-spin" />
            </div>
            <p className="mt-4 text-sm font-bold text-neutral-900">Signing out...</p>
            <p className="mt-1 text-xs leading-5 text-neutral-500">Securing your Shop2Bhutan session.</p>
          </div>
        </div>
      )}

      {deactivateOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center overflow-y-auto bg-black/30 px-4 py-4 sm:items-center">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-5 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                  <AlertTriangle size={22} />
                </span>

                <div className="min-w-0">
                  <h2 className="text-base font-bold text-neutral-900">Deactivate account?</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">
                    Your account will be disabled and you will be signed out. Your orders,
                    payments, and parcel history will be kept safely for support and admin records.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => !deactivating && setDeactivateOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600"
                disabled={deactivating}
              >
                <X size={20} />
              </button>
            </div>

            {/* Warning Box */}
            <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-3.5 text-xs leading-relaxed text-amber-700">
              You will need Shop2Bhutan admin support to reactivate this account later.
            </div>

            {/* Divider */}
            <div className="my-5 h-px bg-neutral-100" />

            {/* Reason Field */}
            <div>
              <label className="block text-sm font-semibold text-neutral-700">
                Reason <span className="font-normal text-neutral-400">(optional)</span>
              </label>
              <textarea
                value={deactivationReason}
                onChange={(event) => setDeactivationReason(event.target.value)}
                placeholder="Example: I no longer want to use this account"
                className="mt-2 h-20 w-full resize-none rounded-2xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10"
                disabled={deactivating}
              />
            </div>

            {deactivateError && (
              <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                {deactivateError}
              </div>
            )}

            {/* Actions */}
            <div className="sticky bottom-0 -mx-5 mt-5 grid grid-cols-2 gap-3 border-t border-neutral-100 bg-white px-5 pb-[env(safe-area-inset-bottom)] pt-4">
              <button
                type="button"
                onClick={() => setDeactivateOpen(false)}
                disabled={deactivating}
                className="h-12 rounded-2xl bg-neutral-50 text-sm font-bold text-neutral-700 transition hover:bg-neutral-100 active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
              >
                Keep Account
              </button>

              <button
                type="button"
                onClick={handleDeactivateAccount}
                disabled={deactivating}
                className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-red-500 text-sm font-bold text-white transition hover:bg-red-600 active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
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
