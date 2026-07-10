import { useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
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
      pathname === '/support' ||
      pathname === '/payment-history'
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
    location.pathname.startsWith('/quotation/') ||
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
    <div className="mx-auto min-h-dvh w-full max-w-lg bg-white text-slate-900 sm:shadow-[0_0_40px_rgba(15,23,42,0.08)]">
      {appSettings.maintenanceEnabled && (
        <div className="border-b border-amber-100 bg-amber-50 px-4 py-3 text-amber-900">
          <div className="mx-auto flex items-start gap-2.5 text-sm leading-5">
            <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-600" />
            <span>{appSettings.maintenanceMessage}</span>
          </div>
        </div>
      )}

      <main
        className={
          shouldHideTabBar
            ? 'min-h-dvh'
            : 'min-h-dvh pb-[calc(4.7rem+env(safe-area-inset-bottom))]'
        }
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${location.pathname}${location.search}`}
            initial={{ opacity: 0, y: 7 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {showNotificationPrompt && !shouldHideTabBar && (
        <div className="fixed left-0 right-0 top-[calc(env(safe-area-inset-top)+0.65rem)] z-[90] px-4">
          <div className="mx-auto max-w-lg">
            <div className="relative overflow-hidden rounded-[1.4rem] border border-slate-200/80 bg-white p-4 shadow-[0_16px_45px_rgba(15,23,42,0.16)]">
              <div className="absolute inset-x-0 top-0 h-1 bg-orange-500" />

              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
                  <Bell size={19} strokeWidth={2.3} />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-slate-950">
                    Turn on notifications
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Receive quotations, payment, order and parcel updates instantly.
                  </p>

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={handleEnableNativeNotifications}
                      disabled={requestingNotificationPermission}
                      className="h-9 rounded-xl bg-orange-500 px-4 text-xs font-extrabold text-white transition active:scale-95 disabled:opacity-60"
                    >
                      {requestingNotificationPermission ? 'Checking...' : 'Enable'}
                    </button>

                    <button
                      type="button"
                      onClick={handleDismissNotificationPrompt}
                      className="h-9 rounded-xl bg-slate-100 px-4 text-xs font-bold text-slate-600 transition active:scale-95"
                    >
                      Later
                    </button>
                  </div>

                  {nativeNotificationPermission === 'denied' && (
                    <p className="mt-2 text-[11px] leading-4 text-slate-500">
                      Notifications may need to be enabled from Android app settings.
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleDismissNotificationPrompt}
                  className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition active:bg-slate-100"
                  aria-label="Dismiss notification prompt"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!shouldHideTabBar && (
        <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-50">
          <div className="pointer-events-auto mx-auto flex h-[calc(66px+env(safe-area-inset-bottom))] w-full max-w-lg items-start border-t border-slate-200/80 bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl sm:shadow-[0_-10px_30px_rgba(15,23,42,0.06)]">
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

              return (
                <button
                  key={tab.path}
                  type="button"
                  onClick={() => handleTabPress(tab.path)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative flex h-[66px] flex-1 flex-col items-center justify-center gap-1 transition active:scale-95 ${
                    isActive ? 'text-orange-600' : 'text-slate-400'
                  }`}
                >
                  <span className="relative flex h-7 w-8 items-center justify-center">
                    <Icon
                      size={isActive ? 24 : 22}
                      strokeWidth={isActive ? 2.45 : 1.7}
                      className="transition-all duration-150"
                    />

                    {showBadge && (
                      <span
                        className={`absolute -right-1 -top-1 flex h-4 items-center justify-center rounded-full px-1 text-[8px] font-black leading-none text-white shadow-sm ring-2 ring-white ${
                          isCountBadge
                            ? 'min-w-4 bg-red-500'
                            : 'min-w-[1.75rem] bg-emerald-500'
                        }`}
                      >
                        {badgeLabel}
                      </span>
                    )}
                  </span>

                  <span
                    className={`text-[10.5px] leading-none ${
                      isActive ? 'font-extrabold' : 'font-medium'
                    }`}
                  >
                    {tab.label}
                  </span>

                  {isActive && (
                    <motion.span
                      layoutId="customer-active-tab"
                      className="absolute bottom-1 h-1 w-1 rounded-full bg-orange-500"
                      transition={{ type: 'spring', stiffness: 520, damping: 34 }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </nav>
      )}
    </div>
  )
}
