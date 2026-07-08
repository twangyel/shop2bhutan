import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  ClipboardList,
  CreditCard,
  Users,
  Package,
  Grid3X3,
  Image,
  Truck,
  Percent,
  Wallet,
  Settings,
  FileText,
  LogOut,
  ChevronDown,
  Search,
  Bell,
  ClipboardCheck,
  Menu,
  X,
  PanelLeftClose,
  PanelLeft,
  CheckCheck,
  Loader2,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import { useApp } from '@/contexts/AppContext'
import { useAuth } from '@/contexts/AuthContext'
import { useState, useEffect, useCallback, useRef } from 'react'
import BrandLogo from '@/components/BrandLogo'
import { supabase } from '@/lib/supabase'
import {
  fetchAdminNotifications,
  getUnreadAdminNotificationCount,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
  deleteAllAdminNotifications,
} from '@/lib/customerOrders'
import type { Notification as AppNotification, NotificationType } from '@/types'

const navGroups = [
  {
    title: 'Main',
    items: [
      { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/admin/orders', label: 'Orders', icon: ClipboardList },
      { path: '/admin/parcels', label: 'Parcel Trips', icon: ClipboardCheck },
      {
        path: '/admin/parcel-requests',
        label: 'Parcel Requests',
        icon: Package,
      },
      { path: '/admin/payments', label: 'Payments', icon: CreditCard },
      { path: '/admin/customers', label: 'Customers', icon: Users },
    ],
  },
  {
    title: 'Catalog',
    items: [
      { path: '/admin/products', label: 'Products', icon: Package },
      { path: '/admin/categories', label: 'Categories', icon: Grid3X3 },
      { path: '/admin/banners', label: 'Banners', icon: Image },
    ],
  },
  {
    title: 'Settings',
    items: [
      { path: '/admin/delivery-fees', label: 'Delivery Fees', icon: Truck },
      {
        path: '/admin/service-charges',
        label: 'Service Charges',
        icon: Percent,
      },
      {
        path: '/admin/payment-methods',
        label: 'Payment Methods',
        icon: Wallet,
      },
      { path: '/admin/settings', label: 'App Settings', icon: Settings },
      { path: '/admin/faq', label: 'FAQ / Terms', icon: FileText },
    ],
  },
]

const BHUTAN_TIME_ZONE = 'Asia/Thimphu'

function formatAdminNotificationTime(value?: string) {
  if (!value) return 'Just now'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Just now'

  const dateText = new Intl.DateTimeFormat('en-US', {
    timeZone: BHUTAN_TIME_ZONE,
    month: 'short',
    day: 'numeric',
  }).format(date)
  const timeText = new Intl.DateTimeFormat('en-US', {
    timeZone: BHUTAN_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)

  return `${dateText}, ${timeText} BTT`
}

function adminNotificationStyle(type: NotificationType, title: string) {
  const text = title.toLowerCase()

  if (text.includes('parcel')) {
    return {
      icon: Package,
      bg: 'bg-orange-50',
      text: 'text-orange-600',
      label: 'Parcel',
    }
  }

  if (type === 'payment') {
    return {
      icon: CreditCard,
      bg: 'bg-emerald-50',
      text: 'text-emerald-600',
      label: 'Payment',
    }
  }

  if (type === 'quotation') {
    const rejected = text.includes('reject') || text.includes('declin')
    return {
      icon: FileText,
      bg: rejected ? 'bg-red-50' : 'bg-violet-50',
      text: rejected ? 'text-red-600' : 'text-violet-600',
      label: 'Quotation',
    }
  }

  if (type === 'order_update') {
    return {
      icon: ClipboardList,
      bg: 'bg-blue-50',
      text: 'text-blue-600',
      label: 'Order',
    }
  }

  return {
    icon: Bell,
    bg: 'bg-amber-50',
    text: 'text-amber-600',
    label: 'System',
  }
}

function profileDisplayName(profile: unknown, fallbackEmail?: string | null) {
  const row = (profile && typeof profile === 'object' ? profile : {}) as Record<
    string,
    unknown
  >
  const fullName = typeof row.full_name === 'string' ? row.full_name.trim() : ''
  const name = typeof row.name === 'string' ? row.name.trim() : ''
  if (fullName) return fullName
  if (name) return name
  if (fallbackEmail) return fallbackEmail.split('@')[0]
  return 'Admin User'
}

function AdminGateScreen({
  title,
  message,
}: {
  title: string
  message: string
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-6">
      <div className="w-full max-w-xs rounded-3xl border border-neutral-200 bg-white p-6 text-center shadow-xl shadow-neutral-900/5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
          <Loader2 size={26} className="animate-spin" />
        </div>
        <p className="mt-4 text-sm font-bold text-neutral-900">{title}</p>
        <p className="mt-1 text-xs leading-5 text-neutral-500">{message}</p>
      </div>
    </div>
  )
}

export default function AdminLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { logout } = useApp()
  const { loading: authLoading, user, context, signOut, isGuest } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [notificationLoading, setNotificationLoading] = useState(false)
  const [notificationError, setNotificationError] = useState('')
  const [deleteNotificationsOpen, setDeleteNotificationsOpen] = useState(false)
  const [deletingNotifications, setDeletingNotifications] = useState(false)
  const [adminNotifications, setAdminNotifications] = useState<
    AppNotification[]
  >([])
  const [adminUnreadCount, setAdminUnreadCount] = useState(0)
  const [loggingOut, setLoggingOut] = useState(false)
  const notificationPanelRef = useRef<HTMLDivElement>(null)

  const requestedAdminPath =
    `${location.pathname}${location.search}${location.hash}` || '/admin'
  const canAccessAdmin = Boolean(context?.is_admin || context?.is_super_admin)

  const adminDisplayName = profileDisplayName(
    context?.profile,
    context?.email || user?.email,
  )
  const adminInitial = (adminDisplayName || 'A').charAt(0).toUpperCase()

  const pageTitle =
    navGroups
      .flatMap((g) => g.items)
      .find(
        (i) =>
          i.path === location.pathname ||
          (i.path !== '/admin' && location.pathname.startsWith(i.path)),
      )?.label || 'Dashboard'

  useEffect(() => {
    if (authLoading) return

    if (!user || isGuest) {
      navigate(`/login?returnTo=${encodeURIComponent(requestedAdminPath)}`, {
        replace: true,
        state: { returnTo: requestedAdminPath },
      })
      return
    }

    if (context && !canAccessAdmin) {
      navigate('/', { replace: true })
    }
  }, [
    authLoading,
    canAccessAdmin,
    context,
    isGuest,
    navigate,
    requestedAdminPath,
    user,
  ])

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [sidebarOpen])

  const loadAdminNotifications = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!user) {
        setAdminNotifications([])
        setAdminUnreadCount(0)
        setNotificationLoading(false)
        return
      }

      const silent = Boolean(options?.silent)
      if (!silent) setNotificationLoading(true)
      setNotificationError('')

      try {
        const [rows, unread] = await Promise.all([
          fetchAdminNotifications(user.id),
          getUnreadAdminNotificationCount(user.id),
        ])
        setAdminNotifications(rows.slice(0, 12))
        setAdminUnreadCount(unread)
      } catch (error) {
        console.error(
          '[AdminLayout] Failed to load admin notifications:',
          error,
        )
        if (!silent)
          setNotificationError(
            error instanceof Error
              ? error.message
              : 'Unable to load notifications.',
          )
      } finally {
        if (!silent) setNotificationLoading(false)
      }
    },
    [user],
  )

  useEffect(() => {
    void loadAdminNotifications({ silent: true })
  }, [loadAdminNotifications, location.pathname])

  useEffect(() => {
    if (!user) return undefined

    let active = true
    const timers = new Set<number>()

    const refreshSoon = (delay = 0) => {
      const timer = window.setTimeout(() => {
        timers.delete(timer)
        if (active) void loadAdminNotifications({ silent: true })
      }, delay)
      timers.add(timer)
    }

    const channel = supabase
      .channel(`admin-notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          refreshSoon(0)
          refreshSoon(800)
        },
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
          console.warn('[AdminLayout] Notification realtime channel status:', status)
          refreshSoon(1000)
        }
      })

    const interval = window.setInterval(() => {
      if (!document.hidden) refreshSoon(0)
    }, 15000)

    return () => {
      active = false
      timers.forEach((timer) => window.clearTimeout(timer))
      window.clearInterval(interval)
      void supabase.removeChannel(channel)
    }
  }, [loadAdminNotifications, user])

  useEffect(() => {
    if (!user || !canAccessAdmin) return undefined

    let active = true
    const timers = new Set<number>()

    const refreshSoon = (delay = 0) => {
      const timer = window.setTimeout(() => {
        timers.delete(timer)
        if (active) void loadAdminNotifications({ silent: true })
      }, delay)
      timers.add(timer)
    }

    const channel = supabase
      .channel(`admin-orders-notification-fallback:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
        },
        () => {
          // Orders are inserted before order_items, and the admin notification
          // trigger/client notification may arrive a moment later. Refresh twice.
          refreshSoon(250)
          refreshSoon(1500)
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') return

        if (
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT' ||
          status === 'CLOSED'
        ) {
          console.warn('[AdminLayout] Orders realtime channel status:', status)
          refreshSoon(1000)
        }
      })

    return () => {
      active = false
      timers.forEach((timer) => window.clearTimeout(timer))
      void supabase.removeChannel(channel)
    }
  }, [canAccessAdmin, loadAdminNotifications, user])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!notificationPanelRef.current) return
      if (!notificationPanelRef.current.contains(event.target as Node)) {
        setNotificationOpen(false)
      }
    }

    if (notificationOpen)
      document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [notificationOpen])

  const handleNav = (path: string) => {
    navigate(path)
    setSidebarOpen(false)
  }

  const handleOpenNotification = async (notification: AppNotification) => {
    if (!user) return

    if (!notification.isRead) {
      setAdminNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, isRead: true } : item,
        ),
      )
      setAdminUnreadCount((count) => Math.max(0, count - 1))

      try {
        await markAdminNotificationRead(notification.id, user.id)
      } catch (error) {
        console.warn('[AdminLayout] Mark notification read skipped:', error)
        void loadAdminNotifications({ silent: true })
      }
    }

    setNotificationOpen(false)
    if (notification.link) navigate(notification.link)
  }

  const handleMarkAllNotificationsRead = async () => {
    if (!user || adminUnreadCount <= 0) return

    setAdminNotifications((current) =>
      current.map((item) => ({ ...item, isRead: true })),
    )
    setAdminUnreadCount(0)

    try {
      await markAllAdminNotificationsRead(user.id)
    } catch (error) {
      console.warn('[AdminLayout] Mark all notifications read skipped:', error)
      void loadAdminNotifications({ silent: true })
    }
  }

  const handleDeleteAllNotifications = async () => {
    if (!user || deletingNotifications) return

    const previousNotifications = adminNotifications
    const previousUnreadCount = adminUnreadCount

    setDeletingNotifications(true)
    setNotificationError('')
    setAdminNotifications([])
    setAdminUnreadCount(0)

    try {
      await deleteAllAdminNotifications(user.id)
      setDeleteNotificationsOpen(false)
      setNotificationOpen(false)
    } catch (error) {
      console.warn('[AdminLayout] Delete all notifications skipped:', error)
      setAdminNotifications(previousNotifications)
      setAdminUnreadCount(previousUnreadCount)
      setNotificationError(
        error instanceof Error
          ? error.message
          : 'Unable to delete notifications.',
      )
      void loadAdminNotifications({ silent: true })
    } finally {
      setDeletingNotifications(false)
    }
  }

  const handleLogout = async () => {
    if (loggingOut) return

    try {
      setLoggingOut(true)
      setNotificationOpen(false)
      setSidebarOpen(false)
      await new Promise((resolve) => window.setTimeout(resolve, 160))
      logout()
      await signOut()
      navigate('/login', { replace: true })
    } catch (error) {
      console.warn('[AdminLayout] Logout skipped:', error)
      setLoggingOut(false)
    }
  }

  if (authLoading || (user && !context)) {
    return (
      <AdminGateScreen
        title="Checking admin access..."
        message="Preparing your Shop2Bhutan admin dashboard."
      />
    )
  }

  if (!user || isGuest) {
    return (
      <AdminGateScreen
        title="Opening login..."
        message="Sign in to continue to the admin panel."
      />
    )
  }

  if (!canAccessAdmin) {
    return (
      <AdminGateScreen
        title="Admin access required"
        message="Redirecting you back to Shop2Bhutan."
      />
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50">
      {loggingOut && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-white/80 px-6 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-3xl border border-amber-100 bg-white p-5 text-center shadow-2xl shadow-amber-500/10">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
              <Loader2 size={26} className="animate-spin" />
            </div>
            <p className="mt-4 text-sm font-bold text-neutral-900">Signing out...</p>
            <p className="mt-1 text-xs leading-5 text-neutral-500">Closing your admin session safely.</p>
          </div>
        </div>
      )}
      {deleteNotificationsOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-red-100 bg-white p-5 shadow-2xl shadow-red-500/10">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                <AlertTriangle size={22} strokeWidth={2.4} />
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="text-base font-black text-neutral-950">
                  Delete all notifications?
                </h2>
                <p className="mt-1 text-sm leading-6 text-neutral-500">
                  This will remove notifications from your admin account only.
                  It will not delete notifications for other admins.
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDeleteNotificationsOpen(false)}
                disabled={deletingNotifications}
                className="h-11 rounded-2xl border border-neutral-200 bg-white text-sm font-bold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDeleteAllNotifications}
                disabled={deletingNotifications}
                className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-red-500 text-sm font-bold text-white transition hover:bg-red-600 disabled:opacity-60"
              >
                {deletingNotifications ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Delete all
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
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
          fixed top-0 left-0 z-40 h-full bg-white border-r border-neutral-200
          flex flex-col overflow-visible transition-all duration-300 ease-in-out
          w-[280px] -translate-x-full md:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : ''}
          ${sidebarCollapsed ? 'md:w-[72px]' : 'md:w-[280px]'}
        `}
      >
        {/* Desktop collapse toggle — floating so it stays clickable after collapse */}
        <button
          type="button"
          onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
          className="absolute -right-3 top-5 z-50 hidden h-7 w-7 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 shadow-md transition hover:bg-neutral-50 hover:text-neutral-900 md:flex"
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? (
            <PanelLeft size={16} />
          ) : (
            <PanelLeftClose size={16} />
          )}
        </button>

        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-4 border-b border-neutral-100 shrink-0 overflow-hidden">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-50 ring-1 ring-orange-100 transition-all duration-300 ${
              sidebarCollapsed ? 'md:mx-auto' : ''
            }`}
            title="Shop2Bhutan Admin"
          >
            <BrandLogo variant="mark" imgClassName="h-8 w-8" />
          </div>

          <div
            className={`min-w-0 flex-1 overflow-hidden transition-all duration-300 ${
              sidebarCollapsed ? 'md:w-0 md:flex-none md:opacity-0' : 'opacity-100'
            }`}
          >
            <p className="truncate text-sm font-black tracking-tight text-[#0039A6]">
              Shop2Bhutan
            </p>
            <p className="truncate text-[11px] font-semibold text-neutral-400">
              Admin Panel
            </p>
          </div>

          {/* Mobile close */}
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="ml-auto p-1.5 rounded-lg hover:bg-neutral-100 md:hidden shrink-0"
            aria-label="Close admin menu"
          >
            <X size={20} className="text-neutral-600" />
          </button>
        </div>

        {/* Navigation — scrollable independently */}
        <nav className="flex-1 py-4 overflow-y-auto min-h-0">
          {navGroups.map((group) => (
            <div key={group.title} className="mb-4">
              <p
                className={`px-4 text-[11px] font-medium text-neutral-500 uppercase tracking-wider mb-1 whitespace-nowrap transition-all duration-300 overflow-hidden ${sidebarCollapsed ? 'md:opacity-0 md:h-0 md:mb-0' : 'opacity-100 h-auto'}`}
              >
                {group.title}
              </p>
              {group.items.map((item) => {
                const isActive =
                  location.pathname === item.path ||
                  (item.path !== '/admin' &&
                    location.pathname.startsWith(item.path))
                const Icon = item.icon
                return (
                  <button
                    key={item.path}
                    onClick={() => handleNav(item.path)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors relative group ${
                      isActive
                        ? 'text-violet-600 bg-violet-50 border-l-[3px] border-violet-600'
                        : 'text-neutral-700 hover:bg-neutral-100 border-l-[3px] border-transparent'
                    }`}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <span className="relative shrink-0">
                      <Icon size={20} className="shrink-0" />
                    </span>
                    {/* Tooltip on hover when collapsed (desktop) */}
                    {sidebarCollapsed && (
                      <div className="hidden md:group-hover:flex absolute left-full ml-3 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap z-50 shadow-lg pointer-events-none">
                        {item.label}
                        <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-gray-900 rotate-45" />
                      </div>
                    )}
                    <span
                      className={`font-medium whitespace-nowrap transition-all duration-300 overflow-hidden ${sidebarCollapsed ? 'md:opacity-0 md:w-0' : 'opacity-100 w-auto'}`}
                    >
                      {item.label}
                    </span>
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Bottom action — keep logout here, keep the admin identity only in the top header */}
        <div
          className={`border-t border-neutral-200 shrink-0 ${
            sidebarCollapsed ? 'p-3 md:px-3' : 'p-4'
          }`}
        >
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className={`w-full flex items-center gap-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-60 ${
              sidebarCollapsed ? 'h-10 justify-center px-0 py-0' : 'px-3 py-2'
            }`}
            title={sidebarCollapsed ? 'Logout' : undefined}
          >
            {loggingOut ? <Loader2 size={18} className="shrink-0 animate-spin" /> : <LogOut size={18} className="shrink-0" />}
            {!sidebarCollapsed && (
              <span className="whitespace-nowrap overflow-hidden">
                {loggingOut ? 'Signing out...' : 'Logout'}
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* ─── Main Content ─── */}
      <div
        className={`
        flex min-h-screen min-w-0 flex-col overflow-x-hidden
        transition-all duration-300
        ${
          sidebarCollapsed
            ? 'w-full md:ml-[72px] md:w-[calc(100%-72px)]'
            : 'w-full md:ml-[280px] md:w-[calc(100%-280px)]'
        }
      `}
      >
        {/* ─── Header ─── */}
        <header className="h-16 bg-white border-b border-neutral-200 flex items-center justify-between px-4 md:px-6 sticky top-0 z-20">
          {/* Left: Hamburger (mobile) + Title */}
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
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
              />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 lg:w-64 h-9 pl-9 pr-4 bg-neutral-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
            <div className="relative" ref={notificationPanelRef}>
              <button
                type="button"
                onClick={() => {
                  setNotificationOpen((open) => !open)
                  void loadAdminNotifications({ silent: true })
                }}
                className="relative p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                aria-label="Open admin notifications"
              >
                <Bell size={20} className="text-neutral-600" />
                {adminUnreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-white">
                    {adminUnreadCount > 9 ? '9+' : adminUnreadCount}
                  </span>
                )}
              </button>

              {notificationOpen && (
                <div className="absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl">
                  <div className="border-b border-neutral-100 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900">
                          Admin Notifications
                        </p>
                        <p className="text-xs text-neutral-500">
                          {adminUnreadCount > 0
                            ? `${adminUnreadCount} unread update${adminUnreadCount === 1 ? '' : 's'}`
                            : 'All caught up'}
                        </p>
                      </div>

                      {adminNotifications.length > 0 && (
                        <div className="flex shrink-0 items-center gap-2">
                          {adminUnreadCount > 0 && (
                            <button
                              type="button"
                              onClick={handleMarkAllNotificationsRead}
                              className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
                            >
                              <CheckCheck size={14} />
                              Read
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setDeleteNotificationsOpen(true)}
                            className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                          >
                            <Trash2 size={14} />
                            Delete all
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="max-h-[420px] overflow-y-auto p-2">
                    {notificationLoading ? (
                      <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-neutral-500">
                        <Loader2
                          size={17}
                          className="animate-spin text-amber-500"
                        />
                        Loading notifications...
                      </div>
                    ) : notificationError ? (
                      <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-3 text-sm text-red-600">
                        {notificationError}
                      </div>
                    ) : adminNotifications.length === 0 ? (
                      <div className="px-4 py-8 text-center">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-50 text-neutral-400">
                          <Bell size={22} />
                        </div>
                        <p className="text-sm font-semibold text-gray-900">
                          No notifications yet
                        </p>
                        <p className="mt-1 text-xs text-neutral-500">
                          New orders, payments, and quotation responses will
                          appear here.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {adminNotifications.map((notification) => {
                          const style = adminNotificationStyle(
                            notification.type,
                            notification.title,
                          )
                          const Icon = style.icon

                          return (
                            <button
                              key={notification.id}
                              type="button"
                              onClick={() =>
                                handleOpenNotification(notification)
                              }
                              className={`flex w-full gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                                notification.isRead
                                  ? 'hover:bg-neutral-50'
                                  : 'bg-amber-50/60 hover:bg-amber-50'
                              }`}
                            >
                              <span
                                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${style.bg} ${style.text}`}
                              >
                                <Icon size={18} />
                              </span>

                              <span className="min-w-0 flex-1">
                                <span className="flex items-start justify-between gap-2">
                                  <span className="text-sm font-bold text-gray-900">
                                    {notification.title}
                                  </span>
                                  {!notification.isRead && (
                                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-orange-500" />
                                  )}
                                </span>
                                <span className="mt-1 block line-clamp-2 text-xs leading-5 text-neutral-600">
                                  {notification.message}
                                </span>
                                <span className="mt-2 flex items-center justify-between gap-2">
                                  <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                                    {style.label}
                                  </span>
                                  <span className="text-[11px] text-neutral-400">
                                    {formatAdminNotificationTime(
                                      notification.createdAt,
                                    )}
                                  </span>
                                </span>
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <button type="button" className="hidden sm:flex items-center gap-2 hover:bg-neutral-100 rounded-lg px-2 py-1.5 transition-colors" title={adminDisplayName}>
              <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white font-semibold text-sm">
                {adminInitial}
              </div>
              <ChevronDown size={16} className="text-neutral-500" />
            </button>
          </div>
        </header>

        {/* ─── Page Content ─── */}
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
