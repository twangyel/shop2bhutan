import { useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Home, ShoppingBag, Package, ClipboardList, User } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getRequestBagItemCount } from '@/lib/customerOrders'

const tabs = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/shop', label: 'Shop', icon: ShoppingBag },
  { path: '/parcel', label: 'Parcel', icon: Package },
  { path: '/request-bag', label: 'Bag', icon: ClipboardList, showBadge: true },
  { path: '/account', label: 'Account', icon: User },
]

export default function CustomerLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [bagCount, setBagCount] = useState(0)

  const refreshBagCount = useCallback(async () => {
    if (!user || authLoading) {
      setBagCount(0)
      return
    }

    try {
      const count = await getRequestBagItemCount(user.id)
      setBagCount(count)
    } catch (error) {
      console.warn('[CustomerLayout] Request Bag count skipped:', error)
      setBagCount(0)
    }
  }, [authLoading, user])

  useEffect(() => {
    void refreshBagCount()
  }, [refreshBagCount, location.pathname])

  useEffect(() => {
    const handleBagUpdated = () => {
      void refreshBagCount()
    }

    window.addEventListener('shop2bhutan:request-bag-updated', handleBagUpdated)
    window.addEventListener('focus', handleBagUpdated)

    return () => {
      window.removeEventListener('shop2bhutan:request-bag-updated', handleBagUpdated)
      window.removeEventListener('focus', handleBagUpdated)
    }
  }, [refreshBagCount])

  const hideTabBarPaths = ['/login', '/register', '/forgot-password', '/checkout', '/change-password']
  const shouldHideTabBar =
    hideTabBarPaths.some((p) => location.pathname === p) ||
    location.pathname.startsWith('/payment/') ||
    location.pathname.startsWith('/quotation/') ||
    location.pathname.startsWith('/parcel-booking/') ||
    location.pathname.startsWith('/product/') ||
    location.pathname.startsWith('/order/') ||
    location.pathname === '/checkout'

  return (
    <div className="min-h-screen bg-neutral-50">
      <main className="pb-20">
        <Outlet />
      </main>

      {!shouldHideTabBar && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 z-50">
          <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
            {tabs.map((tab) => {
              const isActive = location.pathname === tab.path
              const Icon = tab.icon
              const showBadge = tab.showBadge && bagCount > 0

              return (
                <button
                  key={tab.path}
                  onClick={() => navigate(tab.path)}
                  className="flex flex-col items-center justify-center gap-0.5 w-14 h-full relative"
                >
                  <span className="relative inline-flex">
                    <Icon
                      size={22}
                      strokeWidth={isActive ? 2.5 : 1.5}
                      className={isActive ? 'text-amber-500' : 'text-neutral-400'}
                    />
                    {showBadge && (
                      <span className="absolute -right-2.5 -top-2 flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-white">
                        {bagCount > 99 ? '99+' : bagCount}
                      </span>
                    )}
                  </span>
                  <span className={`text-[10px] ${isActive ? 'font-semibold text-amber-500' : 'text-neutral-400'}`}>
                    {tab.label}
                  </span>
                </button>
              )
            })}
          </div>
        </nav>
      )}
    </div>
  )
}
