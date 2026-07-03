import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardList, CreditCard, Users, Package,
  Grid3X3, Image, Truck, Percent, Wallet, Settings, FileText,
  LogOut, ChevronDown, Search, Bell, ClipboardCheck, Menu, X
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useState, useEffect } from 'react';
import Logo from '@/components/shared/Logo';

const navGroups = [
  {
    title: 'Main',
    items: [
      { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/admin/orders', label: 'Orders', icon: ClipboardList },
      { path: '/admin/parcels', label: 'Parcel Trips', icon: ClipboardCheck },
      { path: '/admin/parcel-requests', label: 'Parcel Requests', icon: Package },
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const pageTitle = navGroups.flatMap(g => g.items).find(i =>
    i.path === location.pathname || (i.path !== '/admin' && location.pathname.startsWith(i.path))
  )?.label || 'Dashboard';

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  const handleNav = (path: string) => {
    navigate(path);
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-neutral-50">
      {/* ─── Mobile Overlay ─── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ─── Sidebar ─── */}
      <aside
        className={`
          fixed top-0 left-0 z-40 h-full w-[280px] bg-white border-r border-neutral-200
          flex flex-col overflow-y-auto
          transform transition-transform duration-300 ease-in-out
          -translate-x-full md:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : ''}
        `}
      >
        {/* Logo + Close (mobile) */}
        <div className="h-16 flex items-center gap-2 px-4 border-b border-neutral-100 shrink-0">
          <Logo size="sm" showText={false} />
          <span className="font-bold text-gray-900">Shop2Bhutan</span>
          <span className="px-2 py-0.5 bg-gray-900 text-white text-[10px] font-medium rounded-full">Admin</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto p-1.5 rounded-lg hover:bg-neutral-100 md:hidden"
          >
            <X size={20} className="text-neutral-600" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 min-h-0">
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
                    onClick={() => handleNav(item.path)}
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
        <div className="p-4 border-t border-neutral-200 shrink-0">
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

      {/* ─── Main Content ─── */}
      <div className="flex-1 flex flex-col min-h-screen w-full md:ml-64">
        {/* ─── Header ─── */}
        <header className="h-16 bg-white border-b border-neutral-200 flex items-center justify-between px-4 md:px-6 sticky top-0 z-20">
          {/* Left: Hamburger + Title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 -ml-1 hover:bg-neutral-100 rounded-lg transition-colors md:hidden shrink-0"
            >
              <Menu size={22} className="text-neutral-700" />
            </button>
            <h1 className="text-base md:text-lg font-semibold text-gray-900 truncate">
              {pageTitle}
            </h1>
          </div>

          {/* Right: Search + Bell + Profile */}
          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            <div className="relative hidden sm:block">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 lg:w-64 h-9 pl-9 pr-4 bg-neutral-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
            <button className="relative p-2 hover:bg-neutral-100 rounded-lg transition-colors">
              <Bell size={20} className="text-neutral-600" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            <button className="hidden sm:flex items-center gap-2 hover:bg-neutral-100 rounded-lg px-2 py-1.5 transition-colors">
              <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white font-semibold text-sm">
                A
              </div>
              <ChevronDown size={16} className="text-neutral-500" />
            </button>
          </div>
        </header>

        {/* ─── Page Content ─── */}
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
