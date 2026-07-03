import { useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Home, ShoppingBag, Package, ClipboardList, User } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getRequestBagItemCount, getUnreadNotificationCount } from '@/lib/customerOrders'

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
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)

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


  const refreshNotificationCount = useCallback(async () => {
    if (!user || authLoading) {
      setUnreadNotificationCount(0)
      return
    }

    try {
      const count = await getUnreadNotificationCount(user.id)
      setUnreadNotificationCount(count)
    } catch (error) {
      console.warn('[CustomerLayout] Notification count skipped:', error)
      setUnreadNotificationCount(0)
    }
  }, [authLoading, user])

  useEffect(() => {
    void refreshBagCount()
    void refreshNotificationCount()
  }, [refreshBagCount, refreshNotificationCount, location.pathname])

  useEffect(() => {
    const handleAppBadgesUpdated = () => {
      void refreshBagCount()
      void refreshNotificationCount()
    }

    window.addEventListener('shop2bhutan:request-bag-updated', handleAppBadgesUpdated)
    window.addEventListener('shop2bhutan:notifications-updated', handleAppBadgesUpdated)
    window.addEventListener('focus', handleAppBadgesUpdated)

    return () => {
      window.removeEventListener('shop2bhutan:request-bag-updated', handleAppBadgesUpdated)
      window.removeEventListener('shop2bhutan:notifications-updated', handleAppBadgesUpdated)
      window.removeEventListener('focus', handleAppBadgesUpdated)
    }
  }, [refreshBagCount, refreshNotificationCount])

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
              const showBagBadge = tab.showBadge && bagCount > 0
              const showNotificationBadge = tab.path === '/account' && unreadNotificationCount > 0
              const badgeValue = showBagBadge ? bagCount : unreadNotificationCount
              const showBadge = showBagBadge || showNotificationBadge

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
                      <span className="absolute -right-1.5 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-emerald-500 px-0.5 text-[8px] font-bold leading-none text-white shadow-sm ring-2 ring-white">
                        {badgeValue > 99 ? '99+' : badgeValue}
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
