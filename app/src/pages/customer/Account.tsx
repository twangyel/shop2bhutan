import { useNavigate } from 'react-router-dom';
import {
  MapPin,
  Bell,
  User,
  HeadphonesIcon,
  Settings,
  LogOut,
  ChevronRight,
  ClipboardList,
  Truck,
  Wallet,
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { appSettings } from '@/data/mockData';

const menuGroups = [
  {
    items: [
      { icon: ClipboardList, label: 'My Orders', path: '/orders' },
      { icon: Truck, label: 'My Parcels', path: '/my-parcels' },
      { icon: Bell, label: 'Notifications', path: '/notifications', badge: true },
      { icon: User, label: 'Profile', path: '/profile' },
    ],
  },
  {
    items: [
      { icon: MapPin, label: 'Saved Addresses', path: '/addresses' },
      { icon: Wallet, label: 'Payment History', path: '/orders' },
      { icon: HeadphonesIcon, label: 'Support', path: '/support' },
      { icon: Settings, label: 'Settings', path: '#' },
    ],
  },
];

type ProfileLike = {
  full_name?: string | null;
  name?: string | null;
  phone?: string | null;
  default_dzongkhag_id?: string | null;
  dzongkhag?: string | null;
  avatar_url?: string | null;
};

const PHONE_ONLY_EMAIL_SUFFIX = '@phone.shop2bhutan.com';

function getDisplayEmail(value?: string | null) {
  const email = value?.trim() || '';

  if (!email) return 'No email added';
  if (email.toLowerCase().endsWith(PHONE_ONLY_EMAIL_SUFFIX)) return 'No email added';

  return email;
}

export default function Account() {
  const navigate = useNavigate();
  const { unreadCount, orders } = useApp();
  const { user, context, signOut } = useAuth();

  const profile = (context?.profile ?? null) as ProfileLike | null;
  const isLoggedIn = Boolean(user);

  const displayName =
    profile?.full_name ||
    profile?.name ||
    user?.email?.split('@')[0] ||
    'Guest';

  const displayEmail = isLoggedIn
    ? getDisplayEmail(context?.email || user?.email)
    : 'Sign in to manage your orders';

  const displayPhone = profile?.phone?.trim() || null;
  const displayDzongkhag =
    profile?.default_dzongkhag_id?.trim() || profile?.dzongkhag?.trim() || null;
  const avatarUrl = profile?.avatar_url?.trim() || null;

  const pendingOrders = orders.filter((o) =>
    ['pending_confirmation', 'quoted', 'payment_pending'].includes(o.status)
  ).length;

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-neutral-50 pb-8">
      <div className="bg-white border-b border-neutral-100 px-4 pt-6 pb-5">
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-16 h-16 rounded-full object-cover border-2 border-amber-200"
            />
          ) : (
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center border-2 border-amber-200">
              <span className="text-xl font-bold text-amber-700">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          <div>
            <h2 className="text-lg font-bold text-gray-900">{displayName}</h2>
            <p className="text-sm text-neutral-500">{displayEmail}</p>
            {(displayPhone || displayDzongkhag) && (
              <p className="text-xs text-neutral-500 mt-0.5">
                {[displayPhone, displayDzongkhag].filter(Boolean).join(' • ')}
              </p>
            )}
            <p className="text-xs text-neutral-400 mt-0.5">
              {appSettings.orderCoverage.shortLabel}
            </p>
            {context?.role && context.role !== 'anon' && (
              <p className="text-[11px] text-amber-600 font-semibold mt-1">
                Role: {context.role}
              </p>
            )}
          </div>
        </div>

        {!isLoggedIn && (
          <div className="grid grid-cols-2 gap-3 mt-5">
            <button
              onClick={() => navigate('/login')}
              className="h-11 rounded-xl bg-amber-500 text-white text-sm font-semibold"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/register')}
              className="h-11 rounded-xl bg-neutral-100 text-neutral-700 text-sm font-semibold"
            >
              Register
            </button>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 mt-5">
          {[
            { label: 'Orders', value: orders.length },
            { label: 'Pending', value: pendingOrders },
            { label: 'Parcels', value: 3 },
          ].map((stat) => (
            <button
              key={stat.label}
              onClick={() =>
                stat.label === 'Orders'
                  ? navigate('/orders')
                  : stat.label === 'Parcels'
                    ? navigate('/my-parcels')
                    : null
              }
              className="bg-neutral-50 rounded-xl p-3 text-center hover:bg-neutral-100 transition-colors"
            >
              <p className="text-lg font-bold text-amber-600">{stat.value}</p>
              <p className="text-[11px] text-neutral-500 font-medium">{stat.label}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 mt-4 space-y-3">
        {menuGroups.map((group, gi) => (
          <div key={gi} className="bg-white rounded-xl overflow-hidden shadow-sm">
            {group.items.map((item, i) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  onClick={() => item.path !== '#' && navigate(item.path)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-neutral-50 transition-colors ${
                    i < group.items.length - 1 ? 'border-b border-neutral-100' : ''
                  }`}
                >
                  <Icon size={20} className="text-neutral-500" />
                  <span className="flex-1 text-sm text-gray-900">{item.label}</span>
                  {item.badge && unreadCount > 0 && (
                    <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                  <ChevronRight size={16} className="text-neutral-400" />
                </button>
              );
            })}
          </div>
        ))}

        {isLoggedIn ? (
          <button
            onClick={handleLogout}
            className="w-full h-12 bg-red-50 text-red-600 font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
          >
            <LogOut size={18} />
            <span className="text-sm">Logout</span>
          </button>
        ) : (
          <button
            onClick={() => navigate('/login')}
            className="w-full h-12 bg-amber-500 text-white font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-amber-600 transition-colors"
          >
            <span className="text-sm">Sign In</span>
          </button>
        )}
      </div>
    </div>
  );
}
