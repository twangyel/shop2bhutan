import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Home, ShoppingBag, Package, User, ShoppingCart } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';

const tabs = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/catalog', label: 'Shop', icon: ShoppingBag },
  { path: '/parcel', label: 'Parcel', icon: Package },
  { path: '/account', label: 'Account', icon: User },
  { path: '/cart', label: 'Cart', icon: ShoppingCart },
];

export default function CustomerLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { cartItemCount } = useApp();


  const hideTabBarPaths = ['/login', '/register', '/forgot-password', '/checkout'];
  const shouldHideTabBar =
    hideTabBarPaths.some((p) => location.pathname === p) ||
    location.pathname.startsWith('/payment/') ||
    location.pathname.startsWith('/quotation/') ||
    location.pathname.startsWith('/parcel-booking/') ||
    location.pathname.startsWith('/product/') ||
    location.pathname.startsWith('/order/') ||
    location.pathname === '/checkout';

  return (
    <div className="min-h-screen bg-neutral-50">
      <main className="pb-20">
        <Outlet />
      </main>

      {!shouldHideTabBar && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 z-50">
          <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
            {tabs.map((tab) => {
              const isActive = location.pathname === tab.path;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.path}
                  onClick={() => navigate(tab.path)}
                  className="flex flex-col items-center justify-center gap-0.5 w-14 h-full relative"
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
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
