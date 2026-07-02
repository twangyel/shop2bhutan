import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  ChevronRight,
  ClipboardList,
  HeadphonesIcon,
  Home,
  LayoutDashboard,
  KeyRound,
  LogOut,
  MapPin,
  PackageCheck,
  Pencil,
  ShieldCheck,
  Truck,
  User,
  Wallet,
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const PHONE_ONLY_EMAIL_SUFFIX = '@phone.shop2bhutan.com';

const coverageLine = 'Orders accepted from all 20 dzongkhags.';
const deliveryLine = 'Delivery currently available in Thimphu, Paro, and Chhukha.';

type ProfileLike = {
  full_name?: string | null;
  name?: string | null;
  phone?: string | null;
  default_dzongkhag_id?: string | null;
  dzongkhag?: string | null;
  avatar_url?: string | null;
};

type DzongkhagOption = {
  id: string;
  name: string;
};

type MenuItem = {
  icon: React.ElementType;
  label: string;
  description?: string;
  path: string;
  badge?: boolean;
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

const primaryActions = [
  { label: 'Edit Profile', path: '/profile', icon: Pencil },
  { label: 'Addresses', path: '/addresses', icon: MapPin },
  { label: 'Password', path: '/change-password', icon: KeyRound },
];

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
  const { unreadCount, orders } = useApp();
  const { user, context, signOut } = useAuth();

  const [addressCount, setAddressCount] = useState(0);
  const [dzongkhagOptions, setDzongkhagOptions] = useState<DzongkhagOption[]>([]);

  const profile = (context?.profile ?? null) as ProfileLike | null;
  const isLoggedIn = Boolean(user);

  const rawEmail = context?.email || user?.email || '';
  const displayName = getDisplayName(profile, rawEmail);
  const displayEmail = isLoggedIn ? getDisplayEmail(rawEmail) : 'Sign in to manage your orders';
  const displayPhone = profile?.phone?.trim() || null;
  const displayDzongkhag = getDzongkhagDisplayName(
    profile?.default_dzongkhag_id || profile?.dzongkhag,
    dzongkhagOptions
  );
  const avatarUrl = profile?.avatar_url?.trim() || null;
  const emailAdded = displayEmail !== 'No email added' && isLoggedIn;
  const canAccessAdmin = Boolean(context?.is_admin || context?.is_super_admin);

  const pendingOrders = useMemo(
    () =>
      orders.filter((o) =>
        ['pending_confirmation', 'quoted', 'payment_pending', 'quotation_pending'].includes(o.status)
      ).length,
    [orders]
  );

  useEffect(() => {
    let active = true;

    async function loadDzongkhags() {
      const { data, error } = await supabase.rpc('get_dzongkhag_options');

      if (!active) return;

      if (!error) {
        setDzongkhagOptions(normalizeDzongkhagOptions(data));
      }
    }

    void loadDzongkhags();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadAddressCount() {
      if (!user) {
        setAddressCount(0);
        return;
      }

      const { count, error } = await supabase
        .from('customer_addresses')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (!active) return;

      if (!error) setAddressCount(count ?? 0);
    }

    void loadAddressCount();

    return () => {
      active = false;
    };
  }, [user]);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <div className="mx-auto max-w-md px-4 pt-4">
        <div className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 p-4 text-white shadow-lg shadow-amber-500/20">
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
                  className="h-20 w-20 rounded-3xl border-4 border-white/80 object-cover shadow-md"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl border-4 border-white/80 bg-white/95 shadow-md">
                  <span className="text-2xl font-extrabold text-amber-600">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              {isLoggedIn && (
                <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-white text-amber-600 shadow-md">
                  <Pencil size={15} />
                </span>
              )}
            </button>

            <div className="min-w-0 flex-1 pt-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/75">My Account</p>
              <h1 className="mt-1 truncate text-2xl font-extrabold leading-tight">{displayName}</h1>
              <p className="mt-1 truncate text-sm text-white/90">{displayEmail}</p>
              {displayPhone && <p className="text-sm text-white/85">+975 {displayPhone}</p>}
              {displayDzongkhag && <p className="text-xs text-white/75">Registered dzongkhag: {displayDzongkhag}</p>}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-white/15 p-3 backdrop-blur">
              <div className="flex items-center gap-2 text-xs font-semibold text-white/80">
                <ShieldCheck size={15} /> Order coverage
              </div>
              <p className="mt-1 text-xs leading-4 text-white/90">{coverageLine}</p>
            </div>
            <div className="rounded-2xl bg-white/15 p-3 backdrop-blur">
              <div className="flex items-center gap-2 text-xs font-semibold text-white/80">
                <PackageCheck size={15} /> Delivery
              </div>
              <p className="mt-1 text-xs leading-4 text-white/90">{deliveryLine}</p>
            </div>
          </div>
        </div>

        {!isLoggedIn && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="h-12 rounded-2xl bg-amber-500 text-sm font-bold text-white shadow-sm"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => navigate('/register')}
              className="h-12 rounded-2xl bg-white text-sm font-bold text-neutral-800 shadow-sm"
            >
              Register
            </button>
          </div>
        )}

        {isLoggedIn && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            {primaryActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => navigate(action.path)}
                  className="rounded-2xl bg-white p-3 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <Icon size={18} />
                  </span>
                  <span className="mt-2 block text-[11px] font-bold text-neutral-800">{action.label}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { label: 'Orders', value: orders.length, path: '/orders' },
            { label: 'Pending', value: pendingOrders, path: '/orders' },
            { label: 'Addresses', value: addressCount, path: '/addresses' },
          ].map((stat) => (
            <button
              key={stat.label}
              type="button"
              onClick={() => navigate(stat.path)}
              className="rounded-2xl bg-white p-3 text-center shadow-sm transition hover:bg-neutral-50"
            >
              <p className="text-xl font-extrabold text-amber-600">{stat.value}</p>
              <p className="text-[11px] font-semibold text-neutral-500">{stat.label}</p>
            </button>
          ))}
        </div>

        {isLoggedIn && !emailAdded && (
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="mt-4 w-full rounded-2xl border border-amber-100 bg-amber-50 p-3 text-left shadow-sm"
          >
            <p className="text-sm font-bold text-amber-800">Add email for recovery</p>
            <p className="mt-0.5 text-xs leading-5 text-amber-700">
              Email is optional, but adding one helps with password recovery and order updates.
            </p>
          </button>
        )}

        {canAccessAdmin && (
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="mt-4 w-full overflow-hidden rounded-3xl bg-neutral-900 p-4 text-left text-white shadow-lg shadow-neutral-900/15 transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-amber-300">
                <LayoutDashboard size={22} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-extrabold">Admin Panel</span>
                <span className="mt-0.5 block text-xs leading-5 text-white/70">
                  Manage orders, quotations, payments, products, parcels, and settings.
                </span>
              </span>
              <ChevronRight size={18} className="text-white/45" />
            </div>
          </button>
        )}

        <div className="mt-5 space-y-5">
          {menuGroups.map((group) => (
            <div key={group.title}>
              <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">
                {group.title}
              </p>

              <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
                {group.items.map((item, index) => {
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => navigate(item.path)}
                      className={`flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-neutral-50 ${
                        index < group.items.length - 1 ? 'border-b border-neutral-100' : ''
                      }`}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-neutral-50 text-neutral-500">
                        <Icon size={19} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-neutral-900">{item.label}</span>
                        {item.description && (
                          <span className="mt-0.5 block truncate text-xs text-neutral-500">{item.description}</span>
                        )}
                      </span>
                      {item.badge && unreadCount > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                          {unreadCount}
                        </span>
                      )}
                      <ChevronRight size={17} className="text-neutral-300" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {isLoggedIn ? (
          <button
            type="button"
            onClick={handleLogout}
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-red-50 font-bold text-red-600 transition hover:bg-red-100"
          >
            <LogOut size={18} />
            Logout
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 font-bold text-white transition hover:bg-amber-600"
          >
            <Home size={18} />
            Sign In to Continue
          </button>
        )}
      </div>
    </div>
  );
}
