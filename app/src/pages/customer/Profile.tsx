import { useNavigate } from 'react-router-dom';
import {
  ClipboardList, MapPin, Bell, User, HelpCircle, Phone,
  Lock, Globe, Moon, FileText, Shield, Info, LogOut, ChevronRight
} from 'lucide-react';
import { useApp } from '@/context/AppContext';

const menuGroups = [
  {
    title: 'Account',
    items: [
      { icon: ClipboardList, label: 'My Orders', path: '/orders' },
      { icon: MapPin, label: 'Saved Addresses', path: '/addresses' },
      { icon: Bell, label: 'Notifications', path: '/notifications', badge: true },
      { icon: User, label: 'Edit Profile', path: '#' },
    ]
  },
  {
    title: 'Support',
    items: [
      { icon: HelpCircle, label: 'Help Center', path: '/support' },
      { icon: Phone, label: 'Contact Us', path: '#' },
      { icon: FileText, label: 'FAQ', path: '/support' },
    ]
  },
  {
    title: 'Settings',
    items: [
      { icon: Lock, label: 'Change Password', path: '#' },
      { icon: Globe, label: 'Language', path: '#' },
      { icon: Moon, label: 'Dark Mode', path: '#', toggle: true },
    ]
  },
  {
    title: 'About',
    items: [
      { icon: FileText, label: 'Terms of Service', path: '#' },
      { icon: Shield, label: 'Privacy Policy', path: '#' },
      { icon: Info, label: 'About Shop2Bhutan', path: '#' },
    ]
  },
];

export default function Profile() {
  const navigate = useNavigate();
  const { user, logout, unreadCount, orders } = useApp();

  const totalOrders = orders.length;
  const totalAddresses = 3;
  const pendingOrders = orders.filter(o => ['pending_confirmation', 'quoted', 'payment_pending'].includes(o.status)).length;

  return (
    <div className="min-h-screen bg-neutral-50 pb-8">
      {/* Profile Header Card */}
      <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-b-3xl p-6 text-center">
        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-3 border-[3px] border-white shadow-lg">
          <span className="text-2xl font-bold text-amber-600">{user?.name?.charAt(0) || 'K'}</span>
        </div>
        <h2 className="text-lg font-bold text-white">{user?.name || 'Karma Dorji'}</h2>
        <p className="text-sm text-white/80">{user?.email || 'karma.dorji@email.com'}</p>
        <button className="mt-3 px-4 py-2 bg-white text-amber-600 text-sm font-semibold rounded-full hover:bg-white/90 transition-colors">
          Edit Profile
        </button>
      </div>

      {/* Delivery Info */}
      <div className="px-4 mt-4">
        <div className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Delivery Hubs</p>
            <p className="text-[11px] text-neutral-500">Thimphu, Phuntsholing, Paro</p>
            <p className="text-[10px] text-neutral-400">Orders accepted from all 20 dzongkhags</p>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="px-4 mt-5">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Orders', value: totalOrders },
            { label: 'Addresses', value: totalAddresses },
            { label: 'Pending', value: pendingOrders },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-xl p-3 text-center shadow-sm">
              <p className="text-xl font-bold text-amber-600">{stat.value}</p>
              <p className="text-xs text-neutral-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Menu Groups */}
      <div className="px-4 mt-6 space-y-5">
        {menuGroups.map(group => (
          <div key={group.title}>
            <p className="px-2 text-[11px] font-medium text-neutral-500 uppercase tracking-wider mb-1">
              {group.title}
            </p>
            <div className="bg-white rounded-xl overflow-hidden shadow-sm">
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
                    {(item as any).badge && unreadCount > 0 && (
                      <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {unreadCount}
                      </span>
                    )}
                    {(item as any).toggle ? (
                      <div className="w-10 h-6 bg-neutral-300 rounded-full relative">
                        <div className="w-5 h-5 bg-white rounded-full shadow absolute top-0.5 left-0.5" />
                      </div>
                    ) : (
                      <ChevronRight size={16} className="text-neutral-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Logout */}
      <div className="px-4 mt-8">
        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="w-full h-12 bg-red-50 text-red-600 font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </div>
  );
}
