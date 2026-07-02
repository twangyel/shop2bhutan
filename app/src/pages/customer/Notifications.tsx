import { useCallback, useEffect, useMemo, useState, type ElementType } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, CheckCheck, CreditCard, FileText, Info, RefreshCw, ShoppingBag, Tag } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import EmptyState from '@/components/shared/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchCustomerNotifications,
  markAllCustomerNotificationsRead,
  markCustomerNotificationRead,
} from '@/lib/customerOrders';
import type { Notification } from '@/types';

const typeConfig: Record<string, { icon: ElementType; bg: string; iconColor: string; label: string }> = {
  order_update: { icon: ShoppingBag, bg: 'bg-amber-50', iconColor: 'text-amber-600', label: 'Order' },
  quotation: { icon: FileText, bg: 'bg-violet-50', iconColor: 'text-violet-600', label: 'Quotation' },
  payment: { icon: CreditCard, bg: 'bg-emerald-50', iconColor: 'text-emerald-600', label: 'Payment' },
  promotion: { icon: Tag, bg: 'bg-pink-50', iconColor: 'text-pink-600', label: 'Offer' },
  system: { icon: Info, bg: 'bg-neutral-100', iconColor: 'text-neutral-500', label: 'System' },
};

function timeAgo(value: string) {
  const createdAt = value ? new Date(value) : new Date();
  if (Number.isNaN(createdAt.getTime())) return 'Recently';
  return formatDistanceToNow(createdAt, { addSuffix: true });
}

export default function Notifications() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState('');

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.isRead).length,
    [notifications]
  );

  const loadNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const rows = await fetchCustomerNotifications(user.id);
      setNotifications(rows);
    } catch (err) {
      console.error('Failed to load notifications:', err);
      setError(err instanceof Error ? err.message : 'Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      void loadNotifications();
    }
  }, [authLoading, loadNotifications]);

  useEffect(() => {
    const handleUpdated = () => {
      void loadNotifications();
    };

    window.addEventListener('shop2bhutan:notifications-updated', handleUpdated);
    window.addEventListener('focus', handleUpdated);

    return () => {
      window.removeEventListener('shop2bhutan:notifications-updated', handleUpdated);
      window.removeEventListener('focus', handleUpdated);
    };
  }, [loadNotifications]);

  const handleNotificationClick = async (notification: Notification) => {
    if (!user) return;

    if (!notification.isRead) {
      setNotifications((prev) => prev.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item)));

      try {
        await markCustomerNotificationRead(notification.id, user.id);
      } catch (err) {
        console.warn('Failed to mark notification as read:', err);
      }
    }

    if (notification.link) navigate(notification.link);
  };

  const handleMarkAllRead = async () => {
    if (!user || unreadCount === 0) return;

    setMarkingAll(true);
    setNotifications((prev) => prev.map((notification) => ({ ...notification, isRead: true })));

    try {
      await markAllCustomerNotificationsRead(user.id);
    } catch (err) {
      console.error('Failed to mark all notifications read:', err);
      setError(err instanceof Error ? err.message : 'Unable to mark notifications as read.');
      void loadNotifications();
    } finally {
      setMarkingAll(false);
    }
  };

  if (!authLoading && !user) {
    return (
      <div className="min-h-screen bg-neutral-50 px-4 py-8">
        <EmptyState
          icon={<Bell size={40} className="text-neutral-300" />}
          title="Sign in to view notifications"
          description="Quotation updates and payment alerts will appear here after you sign in."
          action={{ label: 'Sign In', onClick: () => navigate('/login') }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="sticky top-0 z-30 border-b border-white/70 bg-white/90 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => navigate(-1)} className="rounded-full p-1.5 hover:bg-neutral-100">
              <ArrowLeft size={22} className="text-neutral-700" />
            </button>
            <div>
              <h1 className="text-lg font-black text-gray-950">Notifications</h1>
              <p className="text-xs text-neutral-500">{unreadCount > 0 ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}` : 'You are all caught up'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadNotifications}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 transition-colors hover:bg-neutral-200"
              aria-label="Refresh notifications"
            >
              <RefreshCw size={18} className={`text-neutral-700 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={markingAll}
                className="flex h-10 items-center gap-1 rounded-full bg-gray-950 px-3 text-xs font-black text-white transition-colors hover:bg-gray-800 disabled:opacity-60"
              >
                <CheckCheck size={14} />
                {markingAll ? 'Marking' : 'Read'}
              </button>
            )}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-2xl px-4 py-4">
        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-24 rounded-3xl bg-white shadow-sm animate-pulse" />
            ))}
          </div>
        ) : notifications.length > 0 ? (
          <div className="space-y-3">
            {notifications.map((notification) => {
              const config = typeConfig[notification.type] || typeConfig.system;
              const Icon = config.icon;

              return (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full rounded-3xl border bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                    !notification.isRead ? 'border-amber-200 ring-1 ring-amber-100' : 'border-neutral-100'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ${config.bg}`}>
                      <Icon size={20} className={config.iconColor} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-neutral-500">
                          {config.label}
                        </span>
                        {!notification.isRead && <span className="h-2 w-2 rounded-full bg-red-500" />}
                      </div>
                      <p className="mt-1 text-sm font-black text-gray-950">{notification.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-neutral-500">{notification.message}</p>
                      <p className="mt-2 text-[11px] font-medium text-neutral-400">{timeAgo(notification.createdAt)}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={<Bell size={40} className="text-neutral-300" />}
            title="No notifications"
            description="Quotation updates, payment alerts, and order updates will appear here."
          />
        )}
      </main>
    </div>
  );
}
