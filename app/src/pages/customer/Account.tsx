import { useNavigate } from 'react-router-dom';
import {
  MapPin, Bell, User, HeadphonesIcon, Settings,
  LogOut, ChevronRight, ClipboardList, Truck, Wallet
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
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

export default function Account() {
  const navigate = useNavigate();
  const { user, logout, unreadCount, orders } = useApp();

  const pendingOrders = orders.filter((o) =>
    ['pending_confirmation', 'quoted', 'payment_pending'].includes(o.status)
  ).length;

  return (
    <div className="min-h-screen bg-neutral-50 pb-8">
      {/* Profile Header */}
      <div className="bg-white border-b border-neutral-100 px-4 pt-6 pb-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center border-2 border-amber-200">
            <span className="text-xl font-bold text-amber-700">{user?.name?.charAt(0) || 'K'}</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">{user?.name || 'Karma Dorji'}</h2>
            <p className="text-sm text-neutral-500">{user?.email || 'karma.dorji@email.com'}</p>
            <p className="text-xs text-neutral-400 mt-0.5">{appSettings.orderCoverage.shortLabel}</p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          {[
            { label: 'Orders', value: orders.length },
            { label: 'Pending', value: pendingOrders },
            { label: 'Parcels', value: 3 },
          ].map((stat) => (
            <button
              key={stat.label}
              onClick={() => stat.label === 'Orders' ? navigate('/orders') : stat.label === 'Parcels' ? navigate('/my-parcels') : null}
              className="bg-neutral-50 rounded-xl p-3 text-center hover:bg-neutral-100 transition-colors"
            >
              <p className="text-lg font-bold text-amber-600">{stat.value}</p>
              <p className="text-[11px] text-neutral-500 font-medium">{stat.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Menu Groups */}
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

        {/* Logout */}
        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="w-full h-12 bg-red-50 text-red-600 font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
        >
          <LogOut size={18} />
          <span className="text-sm">Logout</span>
        </button>
      </div>
    </div>
  );
}
