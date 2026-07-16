import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Bell,
  BellOff,
  CheckCheck,
  ClipboardList,
  CreditCard,
  FileText,
  Loader2,
  Megaphone,
  Package,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppToast } from '@/components/shared/AppToast';
import { supabase } from '@/lib/supabase';
import {
  fetchAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
} from '@/lib/customerOrders';
import type {
  Notification as AppNotification,
  NotificationType,
} from '@/types';

const BHUTAN_TIME_ZONE = 'Asia/Thimphu';
const TAP_MOVE_TOLERANCE = 6;
const SWIPE_DELETE_THRESHOLD_MIN = 140;
const SWIPE_DELETE_THRESHOLD_MAX = 220;
const SWIPE_DELETE_THRESHOLD_RATIO = 0.52;
const SWIPE_MAX_DRAG_RATIO = 0.7;

type NotificationFilter = 'all' | 'unread' | 'read';

const filters: Array<{
  value: NotificationFilter;
  label: string;
}> = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
];

function formatRelativeTime(value?: string) {
  if (!value) return 'Just now';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just now';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60_000));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: BHUTAN_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  }).format(date);
}

function formatFullDateTime(value?: string) {
  if (!value) return 'Time unavailable';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time unavailable';

  const text = new Intl.DateTimeFormat('en-GB', {
    timeZone: BHUTAN_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);

  return `${text.replace(
    /\b(am|pm)\b/gi,
    (period) => period.toUpperCase(),
  )} BTT`;
}

function isToday(value?: string) {
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BHUTAN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

  const todayParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BHUTAN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  return dateParts === todayParts;
}

function notificationStyle(type: NotificationType, title: string) {
  const text = title.toLowerCase();

  if (
    text.includes('customer') ||
    text.includes('registration') ||
    text.includes('password reset')
  ) {
    return {
      icon: Users,
      bg: 'bg-violet-50',
      text: 'text-violet-600',
      label: 'Customer',
    };
  }

  if (text.includes('parcel')) {
    return {
      icon: Package,
      bg: 'bg-orange-50',
      text: 'text-orange-600',
      label: 'Parcel',
    };
  }

  if (type === 'payment') {
    return {
      icon: CreditCard,
      bg: 'bg-emerald-50',
      text: 'text-emerald-600',
      label: 'Payment',
    };
  }

  if (type === 'quotation') {
    const needsAttention =
      text.includes('reject') ||
      text.includes('declin') ||
      text.includes('change') ||
      text.includes('revision');

    return {
      icon: FileText,
      bg: needsAttention ? 'bg-red-50' : 'bg-amber-50',
      text: needsAttention ? 'text-red-600' : 'text-amber-600',
      label: 'Final Price',
    };
  }

  if (type === 'order_update') {
    return {
      icon: ClipboardList,
      bg: 'bg-blue-50',
      text: 'text-blue-600',
      label: 'Order',
    };
  }

  if (type === 'promotion') {
    return {
      icon: Megaphone,
      bg: 'bg-fuchsia-50',
      text: 'text-fuchsia-600',
      label: 'Promotion',
    };
  }

  return {
    icon: Bell,
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    label: 'System',
  };
}

function resolveAdminNotificationLink(notification: AppNotification) {
  const link = String(notification.link || '').trim();

  if (!link || !link.startsWith('/') || link.startsWith('//')) {
    return '';
  }

  if (link.startsWith('/admin')) return link;

  const customerOrderMatch = link.match(/^\/order\/([^/?#]+)/);
  if (customerOrderMatch?.[1]) {
    return `/admin/orders/${customerOrderMatch[1]}`;
  }

  if (link.startsWith('/payment')) return '/admin/payments';
  if (link.startsWith('/quotation')) return '/admin/orders';
  if (
    link.startsWith('/parcel-booking') ||
    link.startsWith('/my-parcels')
  ) {
    return '/admin/parcel-requests';
  }
  if (link.startsWith('/profile')) return '/admin/customers';

  return link;
}

function SwipeableAdminNotification({
  notification,
  onOpen,
  onDelete,
}: {
  notification: AppNotification;
  onOpen: () => void;
  onDelete: () => Promise<boolean>;
}) {
  const [offset, setOffset] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const startOffset = useRef(0);
  const dragAxis = useRef<'none' | 'x' | 'y'>('none');
  const moved = useRef(false);

  const style = notificationStyle(
    notification.type,
    notification.title,
  );
  const Icon = style.icon;

  const rowWidth = () =>
    rowRef.current?.offsetWidth || window.innerWidth || 360;

  const deleteThreshold = () =>
    Math.min(
      SWIPE_DELETE_THRESHOLD_MAX,
      Math.max(
        SWIPE_DELETE_THRESHOLD_MIN,
        rowWidth() * SWIPE_DELETE_THRESHOLD_RATIO,
      ),
    );

  const maxDrag = () =>
    Math.min(rowWidth() * SWIPE_MAX_DRAG_RATIO, 280);

  const commitDelete = async () => {
    if (deleting) return;

    setDeleting(true);
    setOffset(-(rowWidth() + 60));

    await new Promise((resolve) =>
      window.setTimeout(resolve, 180),
    );

    const deleted = await onDelete();

    if (!deleted) {
      setDeleting(false);
      setOffset(0);
    }
  };

  const handlePointerDown = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    if (deleting) return;

    startX.current = event.clientX;
    startY.current = event.clientY;
    startOffset.current = offset;
    dragAxis.current = 'none';
    moved.current = false;

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture can be unavailable in some browsers.
    }
  };

  const handlePointerMove = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    if (deleting) return;

    const deltaX = event.clientX - startX.current;
    const deltaY = event.clientY - startY.current;

    if (dragAxis.current === 'none') {
      if (
        Math.abs(deltaX) < TAP_MOVE_TOLERANCE &&
        Math.abs(deltaY) < TAP_MOVE_TOLERANCE
      ) {
        return;
      }

      dragAxis.current =
        Math.abs(deltaX) > Math.abs(deltaY) ? 'x' : 'y';
    }

    if (dragAxis.current !== 'x') return;

    event.preventDefault();
    moved.current = Math.abs(deltaX) > TAP_MOVE_TOLERANCE;

    const rawOffset = startOffset.current + deltaX;
    const limit = maxDrag();
    const constrained = Math.max(-limit - 44, Math.min(0, rawOffset));
    const rubberBand =
      constrained < -limit
        ? -limit + (constrained + limit) * 0.22
        : constrained;

    setOffset(rubberBand);
  };

  const handlePointerUp = () => {
    if (deleting) return;

    if (dragAxis.current === 'x') {
      if (offset <= -deleteThreshold()) {
        void commitDelete();
      } else {
        setOffset(0);
      }
    }

    dragAxis.current = 'none';
  };

  const handleOpen = () => {
    if (moved.current) {
      moved.current = false;
      return;
    }

    if (offset < 0) {
      setOffset(0);
      return;
    }

    onOpen();
  };

  const progress = Math.min(
    1,
    Math.abs(offset) / deleteThreshold(),
  );

  return (
    <div
      className={`relative overflow-hidden transition-[max-height,opacity,transform] duration-300 ${
        deleting
          ? 'max-h-0 -translate-x-2 opacity-0'
          : 'max-h-80 opacity-100'
      }`}
    >
      <div
        className="absolute inset-0 flex items-center justify-end bg-red-500 px-6 text-white"
        style={{ opacity: progress }}
        aria-hidden="true"
      >
        <div className="text-right">
          <p className="text-xs font-extrabold">
            {offset <= -deleteThreshold()
              ? 'Release to delete'
              : 'Swipe left'}
          </p>
          <p className="mt-0.5 text-[10px] text-white/80">
            Remove this notification
          </p>
        </div>
      </div>

      <div
        ref={rowRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          transform: `translate3d(${offset}px, 0, 0)`,
          transition:
            dragAxis.current === 'x' && !deleting
              ? 'none'
              : 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)',
          touchAction: 'pan-y',
          willChange: 'transform',
        }}
        className={`relative z-10 border-b border-neutral-100 bg-white ${
          notification.isRead ? '' : 'bg-amber-50/35'
        }`}
      >
        <div
          role="button"
          tabIndex={0}
          onClick={handleOpen}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              handleOpen();
            }
          }}
          className="group flex cursor-pointer items-start gap-3 px-4 py-4 outline-none transition hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400 md:px-5"
        >
          <span
            className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${style.bg} ${style.text}`}
          >
            <Icon size={18} strokeWidth={2.2} />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-start gap-2">
                  <p
                    className={`text-sm font-bold leading-5 ${
                      notification.isRead
                        ? 'text-neutral-700'
                        : 'text-neutral-950'
                    }`}
                  >
                    {notification.title}
                  </p>

                  {!notification.isRead && (
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-orange-500 ring-2 ring-orange-100"
                      aria-label="Unread"
                    />
                  )}
                </div>

                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  {style.label}
                </p>
              </div>

              <span
                className="shrink-0 text-[11px] font-medium text-neutral-400"
                title={formatFullDateTime(notification.createdAt)}
              >
                {formatRelativeTime(notification.createdAt)}
              </span>
            </div>

            {notification.message && (
              <p
                className={`mt-2 text-sm leading-6 ${
                  notification.isRead
                    ? 'text-neutral-500'
                    : 'text-neutral-650'
                }`}
              >
                {notification.message}
              </p>
            )}

            <p className="mt-2 text-[11px] text-neutral-400 md:hidden">
              Swipe left to delete
            </p>
          </div>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void commitDelete();
            }}
            disabled={deleting}
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl text-neutral-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50 md:flex"
            aria-label="Delete notification"
            title="Delete notification"
          >
            {deleting ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Trash2 size={16} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminNotifications() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const toast = useAppToast();

  const [notifications, setNotifications] = useState<
    AppNotification[]
  >([]);
  const [filter, setFilter] =
    useState<NotificationFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [clearingRead, setClearingRead] = useState(false);
  const [confirmClearRead, setConfirmClearRead] = useState(false);
  const [error, setError] = useState('');

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.isRead).length,
    [notifications],
  );

  const readCount = notifications.length - unreadCount;

  const filteredNotifications = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return notifications.filter((notification) => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'unread' && !notification.isRead) ||
        (filter === 'read' && notification.isRead);

      if (!matchesFilter) return false;
      if (!query) return true;

      return [
        notification.title,
        notification.message,
        notification.type,
        notification.link,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [filter, notifications, searchQuery]);

  const todayNotifications = useMemo(
    () =>
      filteredNotifications.filter((notification) =>
        isToday(notification.createdAt),
      ),
    [filteredNotifications],
  );

  const earlierNotifications = useMemo(
    () =>
      filteredNotifications.filter(
        (notification) => !isToday(notification.createdAt),
      ),
    [filteredNotifications],
  );

  const notifyLayout = () => {
    window.dispatchEvent(
      new CustomEvent('shop2bhutan:notifications-updated'),
    );
  };

  const loadNotifications = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!user?.id || authLoading) {
        setNotifications([]);
        setLoading(false);
        return;
      }

      const silent = Boolean(options?.silent);

      if (silent) setRefreshing(true);
      else setLoading(true);

      setError('');

      try {
        const rows = await fetchAdminNotifications(user.id);
        setNotifications(rows);
      } catch (loadError) {
        console.error(
          '[AdminNotifications] Failed to load:',
          loadError,
        );

        if (!silent) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load admin notifications.',
          );
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [authLoading, user?.id],
  );

  useEffect(() => {
    if (!authLoading) void loadNotifications();
  }, [authLoading, loadNotifications]);

  useEffect(() => {
    if (!user?.id || authLoading) return undefined;

    let active = true;
    const refresh = () => {
      if (!active) return;
      void loadNotifications({ silent: true });
      notifyLayout();
    };

    const channel = supabase
      .channel(`admin-notifications-page:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        refresh,
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void loadNotifications({ silent: true });
        }
      });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [authLoading, loadNotifications, user?.id]);

  const handleOpenNotification = async (
    notification: AppNotification,
  ) => {
    if (!user?.id) return;

    if (!notification.isRead) {
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id
            ? { ...item, isRead: true }
            : item,
        ),
      );

      try {
        await markAdminNotificationRead(
          notification.id,
          user.id,
        );
        notifyLayout();
      } catch (markError) {
        console.warn(
          '[AdminNotifications] Mark read skipped:',
          markError,
        );
        void loadNotifications({ silent: true });
      }
    }

    const link = resolveAdminNotificationLink(notification);
    if (link) navigate(link);
  };

  const handleDeleteNotification = async (id: string) => {
    if (!user?.id) return false;

    const previous = notifications;
    setNotifications((current) =>
      current.filter((item) => item.id !== id),
    );
    setError('');

    try {
      const { error: deleteError, count } = await supabase
        .from('notifications')
        .delete({ count: 'exact' })
        .eq('id', id)
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      if (count === 0) {
        throw new Error(
          'The notification could not be deleted. Check the notifications delete policy.',
        );
      }

      notifyLayout();
      return true;
    } catch (deleteError) {
      console.error(
        '[AdminNotifications] Delete failed:',
        deleteError,
      );

      setNotifications(previous);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Unable to delete the notification.',
      );
      return false;
    }
  };

  const handleMarkAllRead = async () => {
    if (!user?.id || unreadCount <= 0 || markingAll) return;

    const previous = notifications;
    setMarkingAll(true);
    setNotifications((current) =>
      current.map((item) => ({ ...item, isRead: true })),
    );
    setError('');

    try {
      await markAllAdminNotificationsRead(user.id);
      notifyLayout();
      toast.success(
        'Notifications updated',
        'All admin notifications were marked as read.',
      );
    } catch (markError) {
      console.error(
        '[AdminNotifications] Mark all failed:',
        markError,
      );

      setNotifications(previous);
      setError(
        markError instanceof Error
          ? markError.message
          : 'Unable to mark notifications as read.',
      );
    } finally {
      setMarkingAll(false);
    }
  };

  const handleClearRead = async () => {
    if (!user?.id || clearingRead || readCount <= 0) return;

    const previous = notifications;
    setClearingRead(true);
    setNotifications((current) =>
      current.filter((item) => !item.isRead),
    );
    setConfirmClearRead(false);
    setError('');

    try {
      const { error: deleteError } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id)
        .eq('is_read', true);

      if (deleteError) throw deleteError;

      notifyLayout();
      toast.success(
        'Read notifications cleared',
        'Unread admin notifications were kept.',
      );
    } catch (clearError) {
      console.error(
        '[AdminNotifications] Clear read failed:',
        clearError,
      );

      setNotifications(previous);
      setError(
        clearError instanceof Error
          ? clearError.message
          : 'Unable to clear read notifications.',
      );
    } finally {
      setClearingRead(false);
    }
  };

  const renderSection = (
    items: AppNotification[],
    title: string,
  ) => {
    if (items.length === 0) return null;

    return (
      <section>
        <div className="mb-2 mt-5 flex items-center justify-between px-1">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-neutral-400">
            {title}
          </p>
          <span className="text-[11px] font-semibold text-neutral-400">
            {items.length}
          </span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          {items.map((notification) => (
            <SwipeableAdminNotification
              key={notification.id}
              notification={notification}
              onOpen={() =>
                void handleOpenNotification(notification)
              }
              onDelete={() =>
                handleDeleteNotification(notification.id)
              }
            />
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="space-y-4">
      {confirmClearRead && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-red-100 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-black text-neutral-950">
                  Clear read notifications?
                </h2>
                <p className="mt-2 text-sm leading-6 text-neutral-500">
                  This removes {readCount} read notification
                  {readCount === 1 ? '' : 's'} from your admin
                  account. Unread notifications will remain.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setConfirmClearRead(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-neutral-400 hover:bg-neutral-100"
                aria-label="Close confirmation"
              >
                <X size={17} />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConfirmClearRead(false)}
                className="h-11 rounded-2xl border border-neutral-200 bg-white text-sm font-bold text-neutral-700"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void handleClearRead()}
                disabled={clearingRead}
                className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-red-500 text-sm font-bold text-white disabled:opacity-60"
              >
                {clearingRead ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Trash2 size={15} />
                )}
                Clear read
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-amber-600">
            Admin activity
          </p>
          <h2 className="mt-1 text-xl font-semibold text-gray-900">
            Notifications
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Orders, payments, parcels, customers, and system
            updates for your admin account.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => void handleMarkAllRead()}
              disabled={markingAll}
              className="flex h-10 items-center gap-2 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:opacity-60"
            >
              {markingAll ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <CheckCheck size={16} />
              )}
              Mark all read
            </button>
          )}

          {readCount > 0 && (
            <button
              type="button"
              onClick={() => setConfirmClearRead(true)}
              disabled={clearingRead}
              className="flex h-10 items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-60"
            >
              <Trash2 size={15} />
              Clear read
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              void loadNotifications({ silent: true })
            }
            disabled={loading || refreshing}
            className="flex h-10 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-60"
          >
            {refreshing ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <RefreshCw size={15} />
            )}
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: 'Total',
            value: notifications.length,
            className: 'text-neutral-900',
          },
          {
            label: 'Unread',
            value: unreadCount,
            className: 'text-orange-600',
          },
          {
            label: 'Read',
            value: readCount,
            className: 'text-emerald-600',
          },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl bg-white p-4 shadow-card"
          >
            <p className="text-xs font-medium text-neutral-500">
              {item.label}
            </p>
            <p
              className={`mt-1 text-2xl font-bold ${item.className}`}
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-white p-4 shadow-card">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            {filters.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${
                  filter === item.value
                    ? 'bg-amber-500 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="relative w-full lg:w-80">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(event.target.value)
              }
              placeholder="Search notifications..."
              className="h-10 w-full rounded-lg border border-neutral-200 pl-9 pr-9 text-sm outline-none focus:ring-2 focus:ring-amber-500/20"
            />

            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle
            size={17}
            className="mt-0.5 shrink-0"
          />
          <span>{error}</span>
        </div>
      )}

      {loading || authLoading ? (
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="flex animate-pulse gap-3 border-b border-neutral-100 px-5 py-4"
            >
              <div className="h-10 w-10 shrink-0 rounded-xl bg-neutral-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/5 rounded bg-neutral-200" />
                <div className="h-3 w-4/5 rounded bg-neutral-100" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white px-6 py-12 text-center shadow-sm">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <BellOff size={27} />
          </span>
          <h3 className="mt-4 text-base font-bold text-neutral-900">
            {notifications.length === 0
              ? 'No admin notifications yet'
              : 'No matching notifications'}
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-neutral-500">
            {notifications.length === 0
              ? 'New shopping requests, payments, parcel activity, customer registrations, and system updates will appear here.'
              : 'Try another filter or clear the notification search.'}
          </p>
        </div>
      ) : (
        <div>
          {renderSection(todayNotifications, 'Today')}
          {renderSection(earlierNotifications, 'Earlier')}
        </div>
      )}
    </div>
  );
}
