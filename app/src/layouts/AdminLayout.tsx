import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardList, CreditCard, Users, Package,
  Grid3X3, Image, Truck, Percent, Wallet, Settings, FileText,
  LogOut, ChevronDown, Search, Bell
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useState } from 'react';

const navGroups = [
  {
    title: 'Main',
    items: [
      { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/admin/orders', label: 'Orders', icon: ClipboardList },
      { path: '/admin/payments', label: 'Payments', icon: CreditCard },
      { path: '/admin/customers', label: 'Customers', icon: Users },
    ]
  },
  {
    title: 'Catalog',
    items: [
      { path: '/admin/products', label: 'Products', icon: Package },
      { path: '/admin/categories', label: 'Categories', icon: Grid3X3 },
      { path: '/admin/banners', label: 'Banners', icon: Image },
    ]
  },
  {
    title: 'Settings',
    items: [
      { path: '/admin/delivery-fees', label: 'Delivery Fees', icon: Truck },
      { path: '/admin/service-charges', label: 'Service Charges', icon: Percent },
      { path: '/admin/payment-methods', label: 'Payment Methods', icon: Wallet },
      { path: '/admin/settings', label: 'App Settings', icon: Settings },
      { path: '/admin/faq', label: 'FAQ / Terms', icon: FileText },
    ]
  },
];

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useApp();
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="flex h-screen bg-neutral-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-neutral-200 flex flex-col fixed h-full z-40 overflow-y-auto">
        {/* Logo */}
        <div className="h-16 flex items-center gap-2 px-4 border-b border-neutral-100">
          <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-gray-900">Shop2Bhutan</span>
          <span className="px-2 py-0.5 bg-gray-900 text-white text-[10px] font-medium rounded-full">Admin</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4">
          {navGroups.map((group) => (
            <div key={group.title} className="mb-4">
              <p className="px-4 text-[11px] font-medium text-neutral-500 uppercase tracking-wider mb-1">
                {group.title}
              </p>
              {group.items.map((item) => {
                const isActive = location.pathname === item.path ||
                  (item.path !== '/admin' && location.pathname.startsWith(item.path));
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors relative ${
                      isActive
                        ? 'text-violet-600 bg-violet-50 border-l-[3px] border-violet-600'
                        : 'text-neutral-700 hover:bg-neutral-100 border-l-[3px] border-transparent'
                    }`}
                  >
                    <Icon size={20} />
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-neutral-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center text-white font-semibold text-sm">
              A
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Admin User</p>
              <p className="text-xs text-neutral-500">Administrator</p>
            </div>
          </div>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        {/* Header */}
        <header className="h-16 bg-white border-b border-neutral-200 flex items-center justify-between px-6 sticky top-0 z-30">
          <h1 className="text-lg font-semibold text-gray-900">
            {navGroups.flatMap(g => g.items).find(i =>
              i.path === location.pathname || (i.path !== '/admin' && location.pathname.startsWith(i.path))
            )?.label || 'Dashboard'}
          </h1>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 h-9 pl-9 pr-4 bg-neutral-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
            <button className="relative p-2 hover:bg-neutral-100 rounded-lg transition-colors">
              <Bell size={20} className="text-neutral-600" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            <button className="flex items-center gap-2 hover:bg-neutral-100 rounded-lg px-2 py-1.5 transition-colors">
              <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white font-semibold text-sm">
                A
              </div>
              <ChevronDown size={16} className="text-neutral-500" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function ShoppingBag(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>
    </svg>
  );
}
