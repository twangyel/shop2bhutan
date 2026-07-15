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
  type LucideIcon,
} from 'lucide-react'
import { useApp } from '@/contexts/AppContext'
import { useAuth } from '@/contexts/AuthContext'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import BrandLogo from '@/components/BrandLogo'
import { supabase } from '@/lib/supabase'
import {
  fetchAdminNotifications,
  fetchAdminOrders,
  fetchAdminCustomers,
  fetchAdminPayments,
  getUnreadAdminNotificationCount,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
  deleteAllAdminNotifications,
  type AdminCustomerRecord,
  type AdminPaymentRecord,
} from '@/lib/customerOrders'
import type {
  Notification as AppNotification,
  NotificationType,
  Order,
} from '@/types'

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

type AdminSearchKind = 'page' | 'order' | 'customer' | 'payment'

type AdminSearchResult = {
  id: string
  kind: AdminSearchKind
  title: string
  subtitle: string
  path: string
  icon: LucideIcon
  keywords: string
}

const ADMIN_NAV_ALIASES: Record<string, string> = {
  '/admin': 'home overview statistics collections profit',
  '/admin/orders': 'shopping requests quotations quote order final price',
  '/admin/parcels': 'parcel trips routes schedule',
  '/admin/parcel-requests': 'parcel booking requests delivery',
  '/admin/payments': 'payment proof verification collections transactions',
  '/admin/customers': 'users profiles phone email accounts',
  '/admin/products': 'catalog items inventory products',
  '/admin/categories': 'catalog product groups categories',
  '/admin/banners': 'home banner promotion image',
  '/admin/delivery-fees': 'shipping delivery destination charges',
  '/admin/service-charges': 'commission percentage service fee charges',
  '/admin/payment-methods': 'bank account qr payment methods',
  '/admin/settings': 'application support business hours profit settings',
  '/admin/faq': 'faq terms privacy return policy content',
}

function normalizeAdminSearch(value: unknown) {
  return String(value ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function adminSearchTokens(value: string) {
  return normalizeAdminSearch(value).split(' ').filter(Boolean)
}

function matchesAdminSearch(searchable: string, query: string) {
  const normalizedSearchable = normalizeAdminSearch(searchable)
  const normalizedQuery = normalizeAdminSearch(query)
  if (!normalizedQuery) return false
  if (normalizedSearchable.includes(normalizedQuery)) return true

  const tokens = adminSearchTokens(normalizedQuery)
  return tokens.length > 0 && tokens.every((token) => normalizedSearchable.includes(token))
}

function statusSearchLabel(value: unknown) {
  return String(value ?? '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function paymentSearchValue(payment: AdminPaymentRecord, keys: string[]) {
  const row = payment as unknown as Record<string, unknown>
  for (const key of keys) {
    const value = row[key]
    if (value !== undefined && value !== null && String(value).trim()) return String(value)
  }
  return ''
}

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
    const needsChanges =
      text.includes('reject') ||
      text.includes('declin') ||
      text.includes('change') ||
      text.includes('revision')

    return {
      icon: FileText,
      bg: needsChanges ? 'bg-red-50' : 'bg-orange-50',
      text: needsChanges ? 'text-red-600' : 'text-orange-600',
      label: 'Final Price',
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
  const [adminSearchOpen, setAdminSearchOpen] = useState(false)
  const [adminSearchLoading, setAdminSearchLoading] = useState(false)
  const [adminSearchLoaded, setAdminSearchLoaded] = useState(false)
  const [adminSearchError, setAdminSearchError] = useState('')
  const [adminSearchOrders, setAdminSearchOrders] = useState<Order[]>([])
  const [adminSearchCustomers, setAdminSearchCustomers] = useState<AdminCustomerRecord[]>([])
  const [adminSearchPayments, setAdminSearchPayments] = useState<AdminPaymentRecord[]>([])
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
  const adminSearchRef = useRef<HTMLDivElement>(null)
  const adminSearchLastLoadedAtRef = useRef(0)

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


  const loadAdminSearchData = useCallback(
    async (force = false) => {
      if (!canAccessAdmin || adminSearchLoading) return

      const isFresh =
        adminSearchLoaded &&
        Date.now() - adminSearchLastLoadedAtRef.current < 30_000

      if (!force && isFresh) return

      setAdminSearchLoading(true)
      setAdminSearchError('')

      try {
        const [orders, customers, payments] = await Promise.all([
          fetchAdminOrders(),
          fetchAdminCustomers(),
          fetchAdminPayments(),
        ])

        setAdminSearchOrders(orders)
        setAdminSearchCustomers(customers)
        setAdminSearchPayments(payments)
        setAdminSearchLoaded(true)
        adminSearchLastLoadedAtRef.current = Date.now()
      } catch (error) {
        console.error('[AdminLayout] Global search data failed:', error)
        setAdminSearchError(
          error instanceof Error
            ? error.message
            : 'Unable to load live admin search data.',
        )
      } finally {
        setAdminSearchLoading(false)
      }
    },
    [adminSearchLoaded, adminSearchLoading, canAccessAdmin],
  )

  const adminSearchResults = useMemo<AdminSearchResult[]>(() => {
    const query = searchQuery.trim()
    if (query.length < 2) return []

    const pageResults = navGroups
      .flatMap((group) =>
        group.items.map((item) => ({
          id: `page:${item.path}`,
          kind: 'page' as const,
          title: item.label,
          subtitle: `${group.title} page`,
          path: item.path,
          icon: item.icon,
          keywords: `${group.title} ${item.label} ${ADMIN_NAV_ALIASES[item.path] || ''}`,
        })),
      )
      .filter((result) => matchesAdminSearch(result.keywords, query))
      .slice(0, 5)

    const orderResults = adminSearchOrders
      .filter((order) => {
        const searchable = [
          order.id,
          order.orderNumber,
          order.status,
          order.user?.name,
          order.user?.email,
          order.user?.phone,
          order.shippingAddress?.recipientName,
          order.shippingAddress?.phone,
          order.shippingAddress?.dzongkhag,
          ...(order.items || []).flatMap((item) => [
            item.productName,
            item.sourcePlatform,
            item.sourceUrl,
          ]),
        ]
          .filter(Boolean)
          .join(' ')

        return matchesAdminSearch(searchable, query)
      })
      .slice(0, 6)
      .map((order) => {
        const customerName =
          order.user?.name ||
          order.shippingAddress?.recipientName ||
          order.user?.phone ||
          'Customer'
        const orderNumber = order.orderNumber || order.id.slice(0, 8)

        return {
          id: `order:${order.id}`,
          kind: 'order' as const,
          title: `#${orderNumber}`,
          subtitle: `${customerName} • ${statusSearchLabel(order.status)}`,
          path: `/admin/orders/${order.id}`,
          icon: ClipboardList,
          keywords: '',
        }
      })

    const customerResults = adminSearchCustomers
      .filter((customer) =>
        matchesAdminSearch(
          [
            customer.id,
            customer.name,
            customer.email,
            customer.phone,
            customer.dzongkhag,
            customer.accountStatus,
            customer.accountType,
          ]
            .filter(Boolean)
            .join(' '),
          query,
        ),
      )
      .slice(0, 5)
      .map((customer) => ({
        id: `customer:${customer.id}`,
        kind: 'customer' as const,
        title: customer.name || customer.phone || 'Customer',
        subtitle:
          [customer.phone, customer.email, customer.dzongkhag]
            .filter(Boolean)
            .join(' • ') || 'Customer account',
        path: `/admin/customers?search=${encodeURIComponent(
          customer.phone || customer.email || customer.name,
        )}`,
        icon: Users,
        keywords: '',
      }))

    const paymentResults = adminSearchPayments
      .filter((payment) => {
        const searchable = [
          payment.id,
          payment.orderId,
          payment.orderNumber,
          payment.customerName,
          payment.customerEmail,
          payment.customerPhone,
          payment.status,
          payment.paymentType,
          paymentSearchValue(payment, ['transactionId', 'transaction_id', 'referenceNumber']),
          paymentSearchValue(payment, ['paymentMethod', 'payment_method', 'method']),
          payment.amount,
        ]
          .filter(Boolean)
          .join(' ')

        return matchesAdminSearch(searchable, query)
      })
      .slice(0, 4)
      .map((payment) => ({
        id: `payment:${payment.id}`,
        kind: 'payment' as const,
        title: `Payment • #${payment.orderNumber || String(payment.orderId || payment.id).slice(0, 8)}`,
        subtitle: `${payment.customerName || 'Customer'} • ${statusSearchLabel(payment.status)} • Nu. ${Number(payment.amount || 0).toLocaleString()}`,
        path: `/admin/payments?search=${encodeURIComponent(
          payment.orderNumber || payment.id,
        )}`,
        icon: CreditCard,
        keywords: '',
      }))

    return [
      ...orderResults,
      ...customerResults,
      ...paymentResults,
      ...pageResults,
    ].slice(0, 14)
  }, [
    adminSearchCustomers,
    adminSearchOrders,
    adminSearchPayments,
    searchQuery,
  ])

  const openAdminSearchResult = (result: AdminSearchResult) => {
    setAdminSearchOpen(false)
    setSearchQuery('')
    navigate(result.path)
  }

  const clearAdminSearch = () => {
    setSearchQuery('')
    setAdminSearchOpen(false)
    setAdminSearchError('')
  }

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

  // Close transient navigation panels on route change.
  useEffect(() => {
    setSidebarOpen(false)
    setAdminSearchOpen(false)
    setSearchQuery('')
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
    function handleAdminSearchClickOutside(event: MouseEvent) {
      if (!adminSearchRef.current) return
      if (!adminSearchRef.current.contains(event.target as Node)) {
        setAdminSearchOpen(false)
      }
    }

    if (adminSearchOpen) {
      document.addEventListener('mousedown', handleAdminSearchClickOutside)
    }

    return () =>
      document.removeEventListener('mousedown', handleAdminSearchClickOutside)
  }, [adminSearchOpen])

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
            <div className="relative hidden sm:block" ref={adminSearchRef}>
              <Search
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
              />
              <input
                type="search"
                placeholder="Search orders, customers..."
                value={searchQuery}
                onFocus={() => {
                  setAdminSearchOpen(true)
                  void loadAdminSearchData()
                }}
                onChange={(event) => {
                  setSearchQuery(event.target.value)
                  setAdminSearchOpen(true)
                  if (event.target.value.trim().length >= 2) {
                    void loadAdminSearchData()
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    setAdminSearchOpen(false)
                    return
                  }

                  if (event.key === 'Enter' && adminSearchResults[0]) {
                    event.preventDefault()
                    openAdminSearchResult(adminSearchResults[0])
                  }
                }}
                className="h-9 w-52 rounded-full bg-neutral-100 pl-9 pr-9 text-sm outline-none transition focus:bg-white focus:ring-2 focus:ring-amber-500/20 lg:w-72"
              />

              {adminSearchLoading ? (
                <Loader2
                  size={15}
                  className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-amber-500"
                />
              ) : searchQuery ? (
                <button
                  type="button"
                  onClick={clearAdminSearch}
                  className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-200 hover:text-neutral-700"
                  aria-label="Clear admin search"
                >
                  <X size={14} />
                </button>
              ) : null}

              {adminSearchOpen && searchQuery.trim() && (
                <div className="absolute right-0 top-11 z-50 w-[min(430px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl">
                  <div className="border-b border-neutral-100 px-4 py-3">
                    <p className="text-sm font-bold text-neutral-900">Admin search</p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      Live results from orders, customers, payments, and admin pages
                    </p>
                  </div>

                  <div className="max-h-[430px] overflow-y-auto p-2">
                    {searchQuery.trim().length < 2 ? (
                      <div className="px-4 py-7 text-center">
                        <Search size={22} className="mx-auto text-neutral-300" />
                        <p className="mt-2 text-sm font-semibold text-neutral-700">
                          Type at least 2 characters
                        </p>
                      </div>
                    ) : adminSearchError && adminSearchResults.length === 0 ? (
                      <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-3 text-sm text-red-600">
                        {adminSearchError}
                      </div>
                    ) : adminSearchResults.length > 0 ? (
                      <div className="space-y-1">
                        {adminSearchResults.map((result) => {
                          const ResultIcon = result.icon

                          return (
                            <button
                              key={result.id}
                              type="button"
                              onClick={() => openAdminSearchResult(result)}
                              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-neutral-50"
                            >
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                                <ResultIcon size={17} />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-bold text-neutral-900">
                                  {result.title}
                                </span>
                                <span className="mt-0.5 block truncate text-xs text-neutral-500">
                                  {result.subtitle}
                                </span>
                              </span>
                              <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                                {result.kind}
                              </span>
                            </button>
                          )
                        })}

                        {adminSearchLoading && (
                          <div className="flex items-center justify-center gap-2 px-3 py-3 text-xs text-neutral-400">
                            <Loader2 size={14} className="animate-spin text-amber-500" />
                            Refreshing live results...
                          </div>
                        )}
                      </div>
                    ) : adminSearchLoading ? (
                      <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-neutral-500">
                        <Loader2 size={17} className="animate-spin text-amber-500" />
                        Searching live admin data...
                      </div>
                    ) : (
                      <div className="px-4 py-8 text-center">
                        <Search size={24} className="mx-auto text-neutral-300" />
                        <p className="mt-2 text-sm font-semibold text-neutral-800">
                          No matching results
                        </p>
                        <p className="mt-1 text-xs text-neutral-400">
                          Try an order number, customer name, phone, email, or page name.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-neutral-100 bg-neutral-50 px-4 py-2 text-[11px] text-neutral-400">
                    Press Enter to open the first result • Esc to close
                  </div>
                </div>
              )}
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
                          New shopping requests, payments, and final price responses will
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
