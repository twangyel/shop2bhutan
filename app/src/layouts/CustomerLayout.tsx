import { useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, Home, ShoppingBag, Package, ClipboardList, User } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { getRequestBagItemCount, getUnreadNotificationCount } from '@/lib/customerOrders'
import { DEFAULT_APP_SETTINGS, fetchPublicAppSettings } from '@/lib/appSettings'

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
  const [appSettings, setAppSettings] = useState(DEFAULT_APP_SETTINGS)

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

  useEffect(() => {
    if (!user || authLoading) return undefined

    const channel = supabase
      .channel(`customer-notifications-badge:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void refreshNotificationCount()
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void refreshNotificationCount()
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [authLoading, refreshNotificationCount, user])

  useEffect(() => {
    let active = true

    async function loadSettings() {
      try {
        const loaded = await fetchPublicAppSettings()
        if (active) setAppSettings(loaded)
      } catch (error) {
        console.warn('[CustomerLayout] App settings skipped:', error)
      }
    }

    void loadSettings()

    const handleSettingsUpdated = () => {
      void loadSettings()
    }

    window.addEventListener('shop2bhutan:app-settings-updated', handleSettingsUpdated)

    return () => {
      active = false
      window.removeEventListener('shop2bhutan:app-settings-updated', handleSettingsUpdated)
    }
  }, [])

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
        {appSettings.maintenanceEnabled && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
            <div className="mx-auto flex max-w-3xl items-start gap-2 text-sm">
              <AlertTriangle size={17} className="mt-0.5 shrink-0" />
              <span>{appSettings.maintenanceMessage}</span>
            </div>
          </div>
        )}
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
                  type="button"
                  onClick={() => navigate(tab.path)}
                  className="flex flex-col items-center justify-center gap-0.5 w-14 h-full relative"
                >
                  <span className="relative inline-flex">
                    <Icon
                      size={21}
                      strokeWidth={isActive ? 2.5 : 1.5}
                      className={isActive ? 'text-amber-500' : 'text-neutral-400'}
                    />
                    {showBadge && (
                      <span className="absolute -right-1 -top-1 flex h-3 min-w-3 items-center justify-center rounded-full bg-emerald-500 px-0.5 text-[7px] font-bold leading-none text-white shadow-sm ring-2 ring-white">
                        {badgeValue > 9 ? '9+' : badgeValue}
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
