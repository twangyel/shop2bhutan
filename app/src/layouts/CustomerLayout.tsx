import { useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Bell,
  Home,
  ShoppingBag,
  Store,
  Package,
  User,
  X,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  getRequestBagItemCount,
  getUnreadNotificationCount,
} from '@/lib/customerOrders'
import { DEFAULT_APP_SETTINGS, fetchPublicAppSettings } from '@/lib/appSettings'
import { fetchCustomerParcelBadgeSummary } from '@/lib/parcels'
import {
  dismissNativeNotificationPrompt,
  getNativeNotificationPermission,
  isNativeNotificationPromptDismissed,
  isNativeNotificationsAvailable,
  requestNativeNotificationPermission,
  showNativeNotificationFromRow,
} from '@/lib/nativeNotifications'
import { registerPushDeviceForUser } from '@/lib/pushNotifications'

const tabs = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/shop', label: 'Shop', icon: Store },
  { path: '/parcel', label: 'Parcel', icon: Package },
  { path: '/request-bag', label: 'Bag', icon: ShoppingBag, showBadge: true },
  { path: '/account', label: 'Account', icon: User },
]

function isTabActive(pathname: string, tabPath: string) {
  if (tabPath === '/') return pathname === '/'

  if (tabPath === '/shop') {
    return pathname === '/shop' || pathname === '/catalog'
  }

  if (tabPath === '/parcel') {
    return pathname === '/parcel' || pathname === '/my-parcels'
  }

  if (tabPath === '/request-bag') {
    return pathname === '/request-bag' || pathname === '/cart'
  }

  if (tabPath === '/account') {
    return (
      pathname === '/account' ||
      pathname === '/orders' ||
      pathname.startsWith('/order/') ||
      pathname === '/profile' ||
      pathname === '/addresses' ||
      pathname === '/notifications' ||
      pathname === '/support'
    )
  }

  return pathname === tabPath
}

export default function CustomerLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [bagCount, setBagCount] = useState(0)
  const [parcelBadgeLabel, setParcelBadgeLabel] = useState<string | null>(null)
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)
  const [appSettings, setAppSettings] = useState(DEFAULT_APP_SETTINGS)
  const [nativeNotificationPermission, setNativeNotificationPermission] = useState('unknown')
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false)
  const [requestingNotificationPermission, setRequestingNotificationPermission] = useState(false)

  const refreshNativeNotificationPermission = useCallback(async () => {
    if (!isNativeNotificationsAvailable()) {
      setNativeNotificationPermission('granted')
      setShowNotificationPrompt(false)
      return
    }

    const permission = await getNativeNotificationPermission()
    setNativeNotificationPermission(permission)

    setShowNotificationPrompt(
      Boolean(user) &&
        permission !== 'granted' &&
        !isNativeNotificationPromptDismissed(),
    )
  }, [user])

  useEffect(() => {
    void refreshNativeNotificationPermission()
  }, [refreshNativeNotificationPermission])

  const handleEnableNativeNotifications = async () => {
    setRequestingNotificationPermission(true)

    try {
      const permission = await requestNativeNotificationPermission()
      setNativeNotificationPermission(permission)

      if (permission === 'granted') {
        setShowNotificationPrompt(false)

        if (user?.id) {
          await registerPushDeviceForUser(user.id, { requestPermission: true })
        }

        await showNativeNotificationFromRow({
          id: 'shop2bhutan-notifications-enabled',
          title: 'Notifications enabled',
          message: 'You will receive Shop2Bhutan order, parcel, payment, and account updates.',
          link: '/notifications',
        })
        return
      }

      // If Android permission is denied, hide our custom prompt for now so the
      // user does not see two repeated prompts. They can enable it later from
      // Android app settings or the Notifications screen.
      if (permission === 'denied') {
        dismissNativeNotificationPrompt()
        setShowNotificationPrompt(false)
        return
      }

      setShowNotificationPrompt(true)
    } finally {
      setRequestingNotificationPermission(false)
    }
  }

  const handleDismissNotificationPrompt = () => {
    dismissNativeNotificationPrompt()
    setShowNotificationPrompt(false)
  }

  const refreshBagCount = useCallback(async () => {
    if (authLoading) return

    if (!user) {
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
    if (authLoading) return

    if (!user) {
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

  const refreshParcelBadge = useCallback(async () => {
    if (authLoading) return

    try {
      const summary = await fetchCustomerParcelBadgeSummary(user?.id)
      setParcelBadgeLabel(summary.label)
    } catch (error) {
      console.warn('[CustomerLayout] Parcel badge skipped:', error)
      setParcelBadgeLabel(null)
    }
  }, [authLoading, user])

  useEffect(() => {
    void refreshBagCount()
    void refreshNotificationCount()

    // The Parcel screen already loads parcel data. Avoid running the
    // badge-count queries at the exact same time when opening parcel pages.
    if (
      location.pathname !== '/parcel' &&
      !location.pathname.startsWith('/my-parcels') &&
      !location.pathname.startsWith('/parcel-booking/')
    ) {
      void refreshParcelBadge()
    }
  }, [
    refreshBagCount,
    refreshNotificationCount,
    refreshParcelBadge,
    location.pathname,
  ])

  useEffect(() => {
    const handleAppBadgesUpdated = () => {
      void refreshBagCount()
      void refreshNotificationCount()
      void refreshParcelBadge()
    }

    const handleVisibilityChange = () => {
      if (!document.hidden) handleAppBadgesUpdated()
    }

    window.addEventListener(
      'shop2bhutan:request-bag-updated',
      handleAppBadgesUpdated,
    )
    window.addEventListener(
      'shop2bhutan:notifications-updated',
      handleAppBadgesUpdated,
    )
    window.addEventListener(
      'shop2bhutan:parcels-updated',
      handleAppBadgesUpdated,
    )
    window.addEventListener('focus', handleAppBadgesUpdated)
    window.addEventListener('pageshow', handleAppBadgesUpdated)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener(
        'shop2bhutan:request-bag-updated',
        handleAppBadgesUpdated,
      )
      window.removeEventListener(
        'shop2bhutan:notifications-updated',
        handleAppBadgesUpdated,
      )
      window.removeEventListener(
        'shop2bhutan:parcels-updated',
        handleAppBadgesUpdated,
      )
      window.removeEventListener('focus', handleAppBadgesUpdated)
      window.removeEventListener('pageshow', handleAppBadgesUpdated)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [refreshBagCount, refreshNotificationCount, refreshParcelBadge])

  useEffect(() => {
    if (authLoading) return undefined

    if (!user) {
      setUnreadNotificationCount(0)
      return undefined
    }

    const userId = user.id
    let active = true
    const timers: number[] = []

    const refreshSoon = (delay = 0) => {
      const timer = window.setTimeout(() => {
        if (active) void refreshNotificationCount()
      }, delay)
      timers.push(timer)
    }

    const handleNotificationChange = (payload: {
      eventType?: string
      new?: Record<string, unknown>
      old?: Record<string, unknown>
    }) => {
      const eventType = payload.eventType
      const nextRow = payload.new ?? {}
      const oldRow = payload.old ?? {}
      const rowUserId = String(nextRow.user_id ?? oldRow.user_id ?? '')

      if (rowUserId && rowUserId !== userId) return

      if (eventType === 'INSERT' && nextRow.is_read === false) {
        setUnreadNotificationCount((current) => current + 1)

        if (location.pathname !== '/notifications') {
          void showNativeNotificationFromRow(nextRow)
        }
      }

      refreshSoon(250)
      refreshSoon(1200)
    }

    void refreshNotificationCount()

    const channel = supabase
      .channel(`customer-notifications-badge:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        handleNotificationChange,
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          refreshSoon(0)
          return
        }

        if (
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT' ||
          status === 'CLOSED'
        ) {
          console.warn(
            '[CustomerLayout] Notification realtime channel status:',
            status,
          )
          refreshSoon(1000)
        }
      })

    const interval = window.setInterval(() => {
      if (!document.hidden) {
        void refreshNotificationCount()
      }
    }, 15000)

    return () => {
      active = false
      timers.forEach((timer) => window.clearTimeout(timer))
      window.clearInterval(interval)
      void supabase.removeChannel(channel)
    }
  }, [authLoading, location.pathname, refreshNotificationCount, user])

  useEffect(() => {
    if (authLoading) return undefined

    let active = true
    const timers: number[] = []

    const refreshSoon = (delay = 0) => {
      const timer = window.setTimeout(() => {
        if (!active) return

        void refreshParcelBadge()
        window.dispatchEvent(new CustomEvent('shop2bhutan:parcels-updated'))
      }, delay)

      timers.push(timer)
    }

    const handleParcelChange = () => {
      refreshSoon(0)
      refreshSoon(800)
    }

    let channel = supabase
      .channel(`customer-parcels-badge:${user?.id ?? 'guest'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'parcel_trips' },
        handleParcelChange,
      )

    if (user?.id) {
      channel = channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'parcel_requests',
          filter: `user_id=eq.${user.id}`,
        },
        handleParcelChange,
      )
    }

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') refreshSoon(0)

      if (
        status === 'CHANNEL_ERROR' ||
        status === 'TIMED_OUT' ||
        status === 'CLOSED'
      ) {
        console.warn('[CustomerLayout] Parcel realtime channel status:', status)
        refreshSoon(1000)
      }
    })

    return () => {
      active = false
      timers.forEach((timer) => window.clearTimeout(timer))
      void supabase.removeChannel(channel)
    }
  }, [authLoading, refreshParcelBadge, user])

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

    window.addEventListener(
      'shop2bhutan:app-settings-updated',
      handleSettingsUpdated,
    )

    return () => {
      active = false
      window.removeEventListener(
        'shop2bhutan:app-settings-updated',
        handleSettingsUpdated,
      )
    }
  }, [])

  const hideTabBarPaths = [
    '/login',
    '/register',
    '/forgot-password',
    '/checkout',
    '/change-password',
  ]
  const shouldHideTabBar =
    hideTabBarPaths.some((p) => location.pathname === p) ||
    location.pathname.startsWith('/payment/') ||
    location.pathname.startsWith('/parcel-booking/') ||
    location.pathname.startsWith('/product/') ||
    location.pathname === '/checkout'

  const handleTabPress = (path: string) => {
    if (location.pathname === path) {
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
      return
    }

    navigate(path)
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main
        className={
          shouldHideTabBar
            ? 'transition-opacity duration-200 ease-out'
            : 'pb-[calc(7.5rem+env(safe-area-inset-bottom))] transition-opacity duration-200 ease-out'
        }
      >
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

      {showNotificationPrompt && !shouldHideTabBar && (
        <div className="fixed left-0 right-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[90] px-4">
          <div className="relative mx-auto max-w-lg overflow-hidden rounded-3xl bg-slate-950 p-4 text-white shadow-2xl shadow-slate-900/30 ring-1 ring-white/10">
            <div className="absolute inset-x-0 top-0 h-1 bg-blue-500" />

            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-blue-300 ring-1 ring-white/10">
                <Bell size={20} strokeWidth={2.4} />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold text-white">
                  Turn on app notifications
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-300">
                  Get instant alerts for quotations, payments, orders, and parcels.
                </p>

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={handleEnableNativeNotifications}
                    disabled={requestingNotificationPermission}
                    className="h-9 rounded-2xl bg-white px-4 text-xs font-extrabold text-blue-700 transition active:scale-[0.98] disabled:opacity-60"
                  >
                    {requestingNotificationPermission ? 'Checking...' : 'Enable'}
                  </button>

                  <button
                    type="button"
                    onClick={handleDismissNotificationPrompt}
                    className="h-9 rounded-2xl border border-white/15 bg-white/10 px-4 text-xs font-bold text-white transition active:scale-[0.98]"
                  >
                    Later
                  </button>
                </div>

                {nativeNotificationPermission === 'denied' && (
                  <p className="mt-2 text-[11px] leading-4 text-blue-200">
                    If Android says notifications are blocked, enable them from app settings.
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={handleDismissNotificationPrompt}
                className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-300 active:bg-white/10"
                aria-label="Dismiss notification prompt"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {!shouldHideTabBar && (
        <nav className="pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] left-0 right-0 z-50 px-3 transition-transform duration-200 ease-out">
          <div className="pointer-events-auto mx-auto flex h-[76px] max-w-lg items-center justify-around rounded-[2rem] border border-neutral-200/80 bg-white/95 px-1.5 shadow-[0_18px_42px_rgba(15,23,42,0.16)] backdrop-blur-xl">
            {tabs.map((tab) => {
              const isActive = isTabActive(location.pathname, tab.path)
              const Icon = tab.icon
              const showBagBadge = tab.showBadge && bagCount > 0
              const showParcelBadge =
                tab.path === '/parcel' && Boolean(parcelBadgeLabel)
              const showNotificationBadge =
                tab.path === '/account' && unreadNotificationCount > 0
              const badgeLabel = showBagBadge
                ? bagCount > 9
                  ? '9+'
                  : String(bagCount)
                : showParcelBadge
                  ? parcelBadgeLabel
                  : unreadNotificationCount > 9
                    ? '9+'
                    : String(unreadNotificationCount)
              const showBadge =
                showBagBadge || showParcelBadge || showNotificationBadge
              const isCountBadge = showBagBadge || showNotificationBadge
              const badgeClass = isCountBadge
                ? 'bg-red-500 text-white'
                : 'bg-emerald-500 text-white'
              const badgeSizeClass = isCountBadge
                ? 'h-4 min-w-4 px-1 text-[8px]'
                : 'h-4 min-w-[1.75rem] px-1.5 text-[8px]'

              return (
                <button
                  key={tab.path}
                  type="button"
                  onClick={() => handleTabPress(tab.path)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative flex h-[64px] flex-1 flex-col items-center justify-center gap-1.5 rounded-3xl text-center transition active:scale-[0.98] ${
                    isActive
                      ? 'bg-amber-50 text-amber-600 shadow-sm ring-1 ring-amber-100'
                      : 'text-neutral-400 active:bg-neutral-50'
                  }`}
                >
                  <span className="relative flex h-8 w-8 items-center justify-center">
                    <Icon
                      size={isActive ? 27 : 25}
                      strokeWidth={isActive ? 2.55 : 1.9}
                      className="transition-colors"
                    />
                    {showBadge && (
                      <span
                        className={`absolute -right-1.5 -top-1.5 flex items-center justify-center rounded-full font-bold leading-none shadow-sm ring-2 ring-white ${badgeClass} ${badgeSizeClass}`}
                      >
                        {badgeLabel}
                      </span>
                    )}
                  </span>
                  <span
                    className={`block text-[11px] leading-none ${isActive ? 'font-extrabold text-amber-700' : 'font-semibold text-neutral-400'}`}
                  >
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
