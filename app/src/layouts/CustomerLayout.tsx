import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Home, ShoppingBag, Link2, ShoppingCart, User } from 'lucide-react';
import { useApp } from '@/context/AppContext';

const tabs = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/catalog', label: 'Shop', icon: ShoppingBag },
  { path: '/cart', label: 'Cart', icon: ShoppingCart },
  { path: '/profile', label: 'Profile', icon: User },
];

export default function CustomerLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { cartItemCount, orders } = useApp();

  const activeOrdersCount = orders.filter(o =>
    ['pending_confirmation', 'quoted', 'payment_pending'].includes(o.status)
  ).length;

  const hideTabBarPaths = ['/login', '/register', '/forgot-password', '/checkout', '/payment/', '/quotation/'];
  const shouldHideTabBar = hideTabBarPaths.some(path => location.pathname.startsWith(path)) ||
    location.pathname.match(/\/product\/.+/) ||
    location.pathname.match(/\/order\/.+/) ||
    location.pathname === '/checkout';

  return (
    <div className="min-h-screen bg-neutral-50">
      <main className="pb-24">
        <Outlet />
      </main>

      {!shouldHideTabBar && (
        <>
          {/* Bottom Navigation */}
          <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 z-50">
            <div className="flex items-center justify-around h-16 max-w-lg mx-auto relative">
              {/* Left tabs: Home, Shop */}
              {tabs.slice(0, 2).map((tab) => {
                const isActive = location.pathname === tab.path;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.path}
                    onClick={() => navigate(tab.path)}
                    className="flex flex-col items-center justify-center gap-0.5 w-16 h-full"
                  >
                    <Icon
                      size={22}
                      strokeWidth={isActive ? 2.5 : 1.5}
                      className={isActive ? 'text-amber-500' : 'text-neutral-400'}
                    />
                    <span className={`text-[10px] ${isActive ? 'font-semibold text-amber-500' : 'text-neutral-400'}`}>
                      {tab.label}
                    </span>
                  </button>
                );
              })}

              {/* Center: Paste Link FAB */}
              <div className="relative -mt-6">
                <button
                  onClick={() => navigate('/paste-link')}
                  className="w-14 h-14 bg-amber-500 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/30 hover:bg-amber-600 active:scale-95 transition-all"
                >
                  <Link2 size={24} className="text-white" strokeWidth={2.5} />
                </button>
                <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-semibold text-neutral-500 whitespace-nowrap">
                  Paste Link
                </span>
              </div>

              {/* Right tabs: Cart, Profile */}
              {tabs.slice(2).map((tab) => {
                const isActive = location.pathname === tab.path;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.path}
                    onClick={() => navigate(tab.path)}
                    className="flex flex-col items-center justify-center gap-0.5 w-16 h-full relative"
                  >
                    <div className="relative">
                      <Icon
                        size={22}
                        strokeWidth={isActive ? 2.5 : 1.5}
                        className={isActive ? 'text-amber-500' : 'text-neutral-400'}
                      />
                      {tab.label === 'Cart' && cartItemCount > 0 && (
                        <span className="absolute -top-1.5 -right-2.5 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                          {cartItemCount > 9 ? '9+' : cartItemCount}
                        </span>
                      )}
                    </div>
                    <span className={`text-[10px] ${isActive ? 'font-semibold text-amber-500' : 'text-neutral-400'}`}>
                      {tab.label === 'Profile' && activeOrdersCount > 0 ? 'Orders' : tab.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
