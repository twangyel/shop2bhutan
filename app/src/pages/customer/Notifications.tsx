import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Bell,
  CheckCheck,
  ChevronRight,
  CreditCard,
  FileText,
  Loader2,
  Megaphone,
  Package,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Truck,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  fetchCustomerNotifications,
  markAllCustomerNotificationsRead,
  markCustomerNotificationRead,
} from '@/lib/customerOrders';
import type { Notification as AppNotification, NotificationType } from '@/types';
import {
  getNativeNotificationPermission,
  getNativeNotificationSettingsUrlHint,
  isNativeNotificationsAvailable,
  requestNativeNotificationPermission,
} from '@/lib/nativeNotifications';

const BHUTAN_TIME_ZONE = 'Asia/Thimphu';
const SWIPE_THRESHOLD = 80;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatBhutanDateTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const dateText = new Intl.DateTimeFormat('en-US', {
    timeZone: BHUTAN_TIME_ZONE, month: 'short', day: 'numeric',
  }).format(date);
  const timeText = new Intl.DateTimeFormat('en-US', {
    timeZone: BHUTAN_TIME_ZONE, hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(date);
  return `${dateText}, ${timeText} BTT`;
}

function getNotificationStyle(type: NotificationType, title: string) {
  const t = title.toLowerCase();
  if (t.includes('parcel')) return { icon: Package, bg: 'bg-orange-50', text: 'text-orange-600' };
  if (type === 'order_update') {
    if (t.includes('delivered')) return { icon: Package, bg: 'bg-emerald-50', text: 'text-emerald-600' };
    if (t.includes('out for delivery')) return { icon: Truck, bg: 'bg-orange-50', text: 'text-orange-600' };
    if (t.includes('in transit') || t.includes('arrived')) return { icon: Truck, bg: 'bg-blue-50', text: 'text-blue-600' };
    return { icon: Package, bg: 'bg-blue-50', text: 'text-blue-600' };
  }
  if (type === 'payment') return { icon: CreditCard, bg: 'bg-emerald-50', text: 'text-emerald-600' };
  if (type === 'quotation') return { icon: FileText, bg: 'bg-violet-50', text: 'text-violet-600' };
  if (type === 'promotion') return { icon: Megaphone, bg: 'bg-purple-50', text: 'text-purple-600' };
  return { icon: Bell, bg: 'bg-gray-50', text: 'text-gray-600' };
}

function notificationTypeLabel(type: NotificationType) {
  if (type === 'payment') return 'Payment';
  if (type === 'quotation') return 'Quotation';
  if (type === 'order_update') return 'Order update';
  if (type === 'promotion') return 'Promotion';
  return 'System';
}

/* ------------------------------------------------------------------ */
/*  Swipeable Notification Card                                        */
/* ------------------------------------------------------------------ */

function SwipeableNotification({
  notification,
  onClick,
  onDelete,
}: {
  notification: AppNotification;
  onClick: () => void;
  onDelete: () => void;
}) {
  const [offset, setOffset] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const startX = useRef(0);
  const currentX = useRef(0);
  const isDragging = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const style = getNotificationStyle(notification.type, notification.title);
  const Icon = style.icon;
  const formattedTime = formatBhutanDateTime(notification.createdAt);
  const hasLink = Boolean(notification.link);
  const isRead = notification.isRead;

  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    startX.current = e.clientX;
    currentX.current = offset;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const delta = e.clientX - startX.current;
    if (delta > 10) return;
    const newOffset = Math.max(-SWIPE_THRESHOLD, Math.min(0, currentX.current + delta));
    setOffset(newOffset);
  };

  const handlePointerUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (offset <= -SWIPE_THRESHOLD * 0.5) {
      setOffset(-SWIPE_THRESHOLD);
      setIsOpen(true);
    } else {
      setOffset(0);
      setIsOpen(false);
    }
  };

  const handleDelete = () => {
    setDeleting(true);
    setTimeout(() => onDelete(), 200);
  };

  const handleCardClick = () => {
    if (isOpen) {
      setOffset(0);
      setIsOpen(false);
    } else {
      onClick();
    }
  };

  if (deleting) {
    return <div className="h-0 overflow-hidden transition-all duration-200" />;
  }

  return (
    <div className="relative overflow-hidden rounded-2xl select-none">
      {/* Red delete background */}
      <div className="absolute inset-0 flex items-center justify-end rounded-2xl bg-red-500 px-5">
        <button
          type="button"
          onClick={handleDelete}
          className="flex flex-col items-center gap-1 text-white"
        >
          <Trash2 size={20} strokeWidth={2} />
          <span className="text-[10px] font-bold">Delete</span>
        </button>
      </div>

      {/* White card */}
      <div
        ref={cardRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          transform: `translateX(${offset}px)`,
          transition: isDragging.current ? 'none' : 'transform 0.2s ease-out',
          touchAction: 'pan-y',
        }}
        className="relative z-10 cursor-pointer"
      >
        <div
          onClick={handleCardClick}
          className="w-full rounded-2xl bg-white p-4"
        >
          <div className="flex gap-3">
            <div className={`mt-0.5 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl ${style.bg} ${style.text}`}>
              <Icon size={20} strokeWidth={2} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`text-sm font-bold ${isRead ? 'text-gray-500' : 'text-gray-900'}`}>
                      {notification.title}
                    </p>
                    {!isRead && (
                      <span className="h-2 w-2 rounded-full bg-orange-500" aria-label="Unread" />
                    )}
                  </div>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    {notificationTypeLabel(notification.type)}
                  </p>
                </div>
                {hasLink && <ChevronRight size={18} className="mt-1 flex-shrink-0 text-gray-300" />}
              </div>

              {notification.message && (
                <p className={`mt-2 text-sm leading-5 ${isRead ? 'text-gray-400' : 'text-gray-600'}`}>
                  {notification.message}
                </p>
              )}

              <p className="mt-3 text-xs font-medium text-gray-400">
                {formattedTime || 'Just now'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function Notifications() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [nativePermission, setNativePermission] = useState('unknown');
  const [nativePermissionBusy, setNativePermissionBusy] = useState(false);

  const unreadCount = useMemo(() => notifications.filter((item) => !item.isRead).length, [notifications]);

  useEffect(() => {
    const resetScroll = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    };

    resetScroll();
    const frame = window.requestAnimationFrame(resetScroll);

    return () => window.cancelAnimationFrame(frame);
  }, []);

  const refreshNativePermission = useCallback(async () => {
    if (!isNativeNotificationsAvailable()) {
      setNativePermission('granted');
      return;
    }

    const permission = await getNativeNotificationPermission();
    setNativePermission(permission);
  }, []);

  useEffect(() => {
    void refreshNativePermission();

    const handleFocus = () => {
      void refreshNativePermission();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refreshNativePermission]);

  const handleEnableNativeNotifications = async () => {
    setNativePermissionBusy(true);

    try {
      const permission = await requestNativeNotificationPermission();
      setNativePermission(permission);
    } finally {
      setNativePermissionBusy(false);
    }
  };

  const loadNotifications = useCallback(async (options?: { silent?: boolean }) => {
    if (!user || authLoading) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    const silent = Boolean(options?.silent);
    if (!silent) setLoading(true);
    setError('');
    try {
      const rows = await fetchCustomerNotifications(user.id);
      setNotifications(rows);
    } catch (err) {
      console.error('Failed to load notifications:', err);
      if (!silent) setError(err instanceof Error ? err.message : 'Unable to load notifications.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [authLoading, user]);

  useEffect(() => { if (!authLoading) void loadNotifications(); }, [authLoading, loadNotifications]);

  useEffect(() => {
    if (!user || authLoading) return undefined;
    const refreshSilently = () => {
      void loadNotifications({ silent: true });
      window.dispatchEvent(new CustomEvent('shop2bhutan:notifications-updated'));
    };
    const channel = supabase
      .channel(`customer-notifications-page:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, refreshSilently)
      .subscribe((status) => { if (status === 'SUBSCRIBED') void loadNotifications({ silent: true }); });
    return () => { void supabase.removeChannel(channel); };
  }, [authLoading, loadNotifications, user]);

  const handleNotificationClick = async (notification: AppNotification) => {
    if (!user) return;
    if (!notification.isRead) {
      setNotifications((current) => current.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item)));
      try { await markCustomerNotificationRead(notification.id, user.id); } catch (err) { console.warn('[Notifications] mark read skipped:', err); }
    }
    if (notification.link) navigate(notification.link);
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    try {
      const { error: deleteError } = await supabase.from('notifications').delete().eq('id', id).eq('user_id', user.id);
      if (deleteError) throw deleteError;
      setNotifications((current) => current.filter((item) => item.id !== id));
      window.dispatchEvent(new CustomEvent('shop2bhutan:notifications-updated'));
    } catch (err) {
      console.error('Failed to delete notification:', err);
      setError(err instanceof Error ? err.message : 'Unable to delete notification.');
    }
  };

  const handleMarkAllRead = async () => {
    if (!user || unreadCount <= 0) return;
    setBusy(true);
    setError('');
    try {
      await markAllCustomerNotificationsRead(user.id);
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
    } catch (err) {
      console.error('Failed to mark all notifications read:', err);
      setError(err instanceof Error ? err.message : 'Unable to mark notifications as read.');
    } finally {
      setBusy(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="sticky top-0 z-20 border-b border-gray-100 bg-white px-4 py-3">
          <div className="mx-auto flex max-w-lg items-center gap-3">
            <div>
              <h1 className="text-base font-bold text-gray-900">Notifications</h1>
              <p className="text-xs text-gray-500">Loading updates...</p>
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-lg space-y-3 px-4 py-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-24 animate-pulse rounded-2xl bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="sticky top-0 z-20 border-b border-gray-100 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-gray-900">Notifications</h1>
              <p className="truncate text-xs text-gray-500">
                {unreadCount > 0 ? `${unreadCount} unread` : notifications.length > 0 ? `${notifications.length} updates` : 'You are all caught up'}
              </p>
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => loadNotifications()}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600 active:scale-95"
              aria-label="Refresh notifications"
            >
              <RefreshCw size={18} />
            </button>
            {unreadCount > 0 && (
              <button
                type="button"
                disabled={busy}
                onClick={handleMarkAllRead}
                className="flex h-10 items-center gap-1.5 rounded-full bg-orange-500 px-3 text-xs font-bold text-white shadow-sm active:scale-95 disabled:opacity-60"
                aria-label="Mark all as read"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCheck size={16} />}
                <span className="hidden sm:inline">Mark all read</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-lg px-4 py-4">
        {isNativeNotificationsAvailable() && nativePermission !== 'granted' && (
          <div className="mb-4 rounded-2xl border border-orange-100 bg-orange-50 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-orange-500 shadow-sm">
                <Bell size={19} strokeWidth={2.4} />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold text-gray-900">
                  Native app notifications
                </p>
                <p className="mt-1 text-xs leading-5 text-gray-600">
                  Enable Android alerts for quotation, payment, order, and parcel updates.
                </p>

                {nativePermission === 'denied' && (
                  <p className="mt-2 text-[11px] leading-4 text-amber-700">
                    {getNativeNotificationSettingsUrlHint()}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleEnableNativeNotifications}
                  disabled={nativePermissionBusy}
                  className="mt-3 h-9 rounded-2xl bg-orange-500 px-4 text-xs font-bold text-white transition active:scale-[0.98] disabled:opacity-60"
                >
                  {nativePermissionBusy ? 'Checking...' : 'Enable Notifications'}
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 flex gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {notifications.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white px-6 py-10 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-50 text-orange-500">
              <ShieldCheck size={28} strokeWidth={2} />
            </div>
            <h2 className="text-lg font-bold text-gray-900">No notifications yet</h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              Order, quotation, payment, and delivery updates will appear here.
            </p>
            <button
              type="button"
              onClick={() => navigate('/orders')}
              className="mt-6 h-11 rounded-2xl bg-orange-500 px-5 text-sm font-bold text-white hover:bg-orange-600"
            >
              View My Orders
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <SwipeableNotification
                key={notification.id}
                notification={notification}
                onClick={() => handleNotificationClick(notification)}
                onDelete={() => handleDelete(notification.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
