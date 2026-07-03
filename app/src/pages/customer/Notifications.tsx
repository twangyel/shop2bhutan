import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  CheckCheck,
  ChevronRight,
  CreditCard,
  FileText,
  Megaphone,
  Package,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  fetchCustomerNotifications,
  markAllCustomerNotificationsRead,
  markCustomerNotificationRead,
} from '@/lib/customerOrders';
import type { Notification as AppNotification, NotificationType } from '@/types';

const BHUTAN_TIME_ZONE = 'Asia/Thimphu';

function formatBhutanDateTime(value?: string) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const dateText = new Intl.DateTimeFormat('en-US', {
    timeZone: BHUTAN_TIME_ZONE,
    month: 'short',
    day: 'numeric',
  }).format(date);

  const timeText = new Intl.DateTimeFormat('en-US', {
    timeZone: BHUTAN_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);

  return `${dateText}, ${timeText} BTT`;
}

function notificationIcon(type: NotificationType) {
  const className = 'h-5 w-5';

  if (type === 'payment') return <CreditCard className={className} />;
  if (type === 'quotation') return <FileText className={className} />;
  if (type === 'order_update') return <Package className={className} />;
  if (type === 'promotion') return <Megaphone className={className} />;

  return <Bell className={className} />;
}

function notificationTone(type: NotificationType) {
  if (type === 'payment') return 'bg-emerald-50 text-emerald-600';
  if (type === 'quotation') return 'bg-amber-50 text-amber-600';
  if (type === 'order_update') return 'bg-blue-50 text-blue-600';
  if (type === 'promotion') return 'bg-purple-50 text-purple-600';
  return 'bg-neutral-100 text-neutral-600';
}

function notificationTypeLabel(type: NotificationType) {
  if (type === 'payment') return 'Payment';
  if (type === 'quotation') return 'Quotation';
  if (type === 'order_update') return 'Order Update';
  if (type === 'promotion') return 'Promotion';
  return 'System';
}

export default function Notifications() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const unreadCount = useMemo(() => notifications.filter((item) => !item.isRead).length, [notifications]);

  const loadNotifications = useCallback(async (options?: { silent?: boolean }) => {
    if (!user || authLoading) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const silent = Boolean(options?.silent);

    if (!silent) {
      setLoading(true);
    }
    setError('');

    try {
      const rows = await fetchCustomerNotifications(user.id);
      setNotifications(rows);
    } catch (err) {
      console.error('Failed to load notifications:', err);
      if (!silent) {
        setError(err instanceof Error ? err.message : 'Unable to load notifications.');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [authLoading, user]);

  useEffect(() => {
    if (!authLoading) {
      void loadNotifications();
    }
  }, [authLoading, loadNotifications]);

  useEffect(() => {
    if (!user || authLoading) return undefined;

    const refreshSilently = () => {
      void loadNotifications({ silent: true });
      window.dispatchEvent(new CustomEvent('shop2bhutan:notifications-updated'));
    };

    const channel = supabase
      .channel(`customer-notifications-page:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        refreshSilently
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void loadNotifications({ silent: true });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [authLoading, loadNotifications, user]);

  const handleNotificationClick = async (notification: AppNotification) => {
    if (!user) return;

    if (!notification.isRead) {
      setNotifications((current) =>
        current.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item))
      );

      try {
        await markCustomerNotificationRead(notification.id, user.id);
      } catch (err) {
        console.warn('[Notifications] mark read skipped:', err);
      }
    }

    if (notification.link) {
      navigate(notification.link);
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
      <div className="min-h-screen bg-neutral-50">
        <div className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-lg items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-gray-900"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-base font-black text-gray-950">Notifications</h1>
              <p className="text-xs text-neutral-500">Loading updates...</p>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-lg space-y-3 px-4 py-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-24 animate-pulse rounded-3xl bg-white shadow-sm" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <div className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-neutral-100 text-gray-900 active:scale-95"
              aria-label="Go back"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-black text-gray-950">Notifications</h1>
              <p className="truncate text-xs text-neutral-500">
                {unreadCount > 0 ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}` : 'You are all caught up'}
              </p>
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => loadNotifications()}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 active:scale-95"
              aria-label="Refresh notifications"
            >
              <RefreshCw size={18} />
            </button>
            <button
              type="button"
              disabled={busy || unreadCount <= 0}
              onClick={handleMarkAllRead}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 text-white shadow-sm disabled:bg-neutral-200 disabled:text-neutral-400 active:scale-95"
              aria-label="Mark all as read"
            >
              <CheckCheck size={18} />
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-lg px-4 py-4">
        {error && (
          <div className="mb-4 flex gap-2 rounded-2xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {notifications.length === 0 ? (
          <div className="rounded-[28px] bg-white px-6 py-10 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-500">
              <ShieldCheck size={28} />
            </div>
            <h2 className="text-lg font-black text-gray-950">No notifications yet</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              Order, quotation, payment, and delivery updates will appear here.
            </p>
            <button
              type="button"
              onClick={() => navigate('/orders')}
              className="mt-6 h-11 rounded-2xl bg-amber-500 px-5 text-sm font-bold text-white shadow-sm active:scale-95"
            >
              View My Orders
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => {
              const hasLink = Boolean(notification.link);
              const formattedTime = formatBhutanDateTime(notification.createdAt);

              return (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full rounded-[24px] border bg-white p-4 text-left shadow-sm transition active:scale-[0.99] ${
                    notification.isRead ? 'border-transparent opacity-80' : 'border-amber-100 ring-1 ring-amber-50'
                  }`}
                >
                  <div className="flex gap-3">
                    <div
                      className={`mt-0.5 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl ${notificationTone(notification.type)}`}
                    >
                      {notificationIcon(notification.type)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-black text-gray-950">{notification.title}</p>
                            {!notification.isRead && (
                              <span className="h-2 w-2 rounded-full bg-amber-500" aria-label="Unread" />
                            )}
                          </div>
                          <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-neutral-400">
                            {notificationTypeLabel(notification.type)}
                          </p>
                        </div>

                        {hasLink && <ChevronRight size={18} className="mt-1 flex-shrink-0 text-neutral-300" />}
                      </div>

                      {notification.message && (
                        <p className="mt-2 text-sm leading-5 text-neutral-600">{notification.message}</p>
                      )}

                      <p className="mt-3 text-xs font-medium text-neutral-400">
                        {formattedTime || 'Just now'}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
