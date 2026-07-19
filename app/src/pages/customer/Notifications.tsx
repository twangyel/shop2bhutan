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
  CreditCard,
  FileText,
  Loader2,
  Megaphone,
  Package,
  RefreshCw,
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
const TAP_MOVE_TOLERANCE = 6;
const SWIPE_MAX_DRAG_RATIO = 0.72;
const SWIPE_DELETE_THRESHOLD_RATIO = 0.56;
const SWIPE_DELETE_THRESHOLD_MIN = 150;
const SWIPE_DELETE_THRESHOLD_MAX = 230;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */


function formatRelativeTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: BHUTAN_TIME_ZONE, hour: 'numeric', minute: '2-digit', hour12: true,
    }).format(date);
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: BHUTAN_TIME_ZONE, weekday: 'short',
    }).format(date);
  }
  return new Intl.DateTimeFormat('en-US', {
    timeZone: BHUTAN_TIME_ZONE, month: 'short', day: 'numeric',
  }).format(date);
}

function isToday(value?: string) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
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
  if (type === 'quotation') {
    const needsChanges =
      t.includes('change') ||
      t.includes('revision') ||
      t.includes('reject') ||
      t.includes('declin');

    return needsChanges
      ? { icon: FileText, bg: 'bg-red-50', text: 'text-red-600' }
      : { icon: FileText, bg: 'bg-orange-50', text: 'text-orange-600' };
  }
  if (type === 'promotion') return { icon: Megaphone, bg: 'bg-purple-50', text: 'text-purple-600' };
  return { icon: Bell, bg: 'bg-slate-100', text: 'text-slate-500' };
}

function notificationTypeLabel(type: NotificationType) {
  if (type === 'payment') return 'Payment';
  if (type === 'quotation') return 'Final price';
  if (type === 'order_update') return 'Order update';
  if (type === 'promotion') return 'Promotion';
  return 'System';
}

function customerFacingNotificationCopy(notification: AppNotification) {
  if (notification.type !== 'quotation') {
    return {
      title: notification.title,
      message: notification.message,
    };
  }

  const title = notification.title
    .replace(/Quotation Received/gi, 'Final Price Ready')
    .replace(/Quotation Ready/gi, 'Final Price Ready')
    .replace(/Quotation Pending/gi, 'Checking Availability & Price')
    .replace(/Quotation Approved/gi, 'Final Price Confirmed')
    .replace(/Quotation Accepted/gi, 'Final Price Confirmed')
    .replace(/Quotation Rejected/gi, 'Final Price Changes Requested')
    .replace(/Quotation Declined/gi, 'Final Price Changes Requested');

  const message = notification.message
    .replace(/quotation request/gi, 'shopping request')
    .replace(/quotation/gi, 'final price')
    .replace(/\bapproved\b/gi, 'confirmed')
    .replace(/\bapprove\b/gi, 'confirm')
    .replace(/\baccepted\b/gi, 'confirmed')
    .replace(/\baccept\b/gi, 'confirm');

  return { title, message };
}

/* ------------------------------------------------------------------ */
/*  Swipeable Notification Row                                         */
/* ------------------------------------------------------------------ */

function SwipeableNotification({
  notification,
  onClick,
  onDelete,
  isLast,
}: {
  notification: AppNotification;
  onClick: () => void;
  onDelete: () => Promise<boolean> | boolean;
  isLast?: boolean;
}) {
  const [offset, setOffset] = useState(0);
  const [deleting, setDeleting] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const startOffset = useRef(0);
  const dragAxis = useRef<'none' | 'x' | 'y'>('none');
  const moved = useRef(false);

  const displayCopy = customerFacingNotificationCopy(notification);
  const style = getNotificationStyle(notification.type, displayCopy.title);
  const Icon = style.icon;
  const isRead = notification.isRead;

  const getCardWidth = () => cardRef.current?.offsetWidth || window.innerWidth || 360;

  const getDeleteThreshold = () => {
    const width = getCardWidth();
    return Math.min(
      SWIPE_DELETE_THRESHOLD_MAX,
      Math.max(SWIPE_DELETE_THRESHOLD_MIN, width * SWIPE_DELETE_THRESHOLD_RATIO),
    );
  };

  const getMaxDrag = () => Math.min(getCardWidth() * SWIPE_MAX_DRAG_RATIO, 280);

  const resetSwipe = () => {
    setOffset(0);
  };

  const commitDelete = async () => {
    if (deleting) return;

    const width = getCardWidth();
    setDeleting(true);
    setOffset(-(width + 56));

    await new Promise((resolve) => window.setTimeout(resolve, 180));

    const deleted = await Promise.resolve(onDelete());

    if (!deleted) {
      setDeleting(false);
      setOffset(0);
    }
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (deleting) return;

    startX.current = e.clientX;
    startY.current = e.clientY;
    startOffset.current = offset;
    dragAxis.current = 'none';
    moved.current = false;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore unsupported pointer capture cases.
    }
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (deleting) return;

    const deltaX = e.clientX - startX.current;
    const deltaY = e.clientY - startY.current;

    if (dragAxis.current === 'none') {
      if (
        Math.abs(deltaX) < TAP_MOVE_TOLERANCE &&
        Math.abs(deltaY) < TAP_MOVE_TOLERANCE
      ) {
        return;
      }

      dragAxis.current = Math.abs(deltaX) > Math.abs(deltaY) ? 'x' : 'y';
    }

    if (dragAxis.current !== 'x') return;

    e.preventDefault();
    moved.current = Math.abs(deltaX) > TAP_MOVE_TOLERANCE;

    const rawOffset = startOffset.current + deltaX;
    const maxDrag = getMaxDrag();
    const limitedOffset = Math.max(-maxDrag - 44, Math.min(0, rawOffset));

    const rubberBandOffset =
      limitedOffset < -maxDrag
        ? -maxDrag + (limitedOffset + maxDrag) * 0.22
        : limitedOffset;

    setOffset(rubberBandOffset);
  };

  const handlePointerUp = () => {
    if (deleting) return;

    if (dragAxis.current === 'x') {
      const shouldDelete = offset <= -getDeleteThreshold();

      if (shouldDelete) {
        void commitDelete();
      } else {
        resetSwipe();
      }
    }

    dragAxis.current = 'none';
  };

  const handleCardClick = () => {
    if (moved.current) {
      moved.current = false;
      return;
    }

    if (offset < 0) {
      resetSwipe();
      return;
    }

    onClick();
  };

  const threshold = getDeleteThreshold();
  const swipeDistance = Math.abs(offset);
  const swipeProgress = Math.min(1, swipeDistance / threshold);
  const deleteReady = offset <= -threshold;

  return (
    <div
      className={`relative overflow-hidden select-none transition-[max-height,opacity,margin,transform] duration-300 ease-out ${
        deleting ? 'max-h-0 -translate-x-2 opacity-0' : 'max-h-72 opacity-100'
      }`}
    >
      {/* Delete background */}
      <div
        className="absolute inset-0 flex items-center justify-end rounded-lg bg-gradient-to-l from-red-500 via-red-500 to-red-400 px-5"
        style={{ opacity: Math.max(0, Math.min(1, swipeProgress)) }}
        aria-hidden="true"
      >
        <div className="text-right text-white">
          <p className="text-xs font-extrabold tracking-tight">
            {deleteReady ? 'Release to delete' : 'Swipe left'}
          </p>
          <p className="mt-0.5 text-[10px] font-medium text-white/80">
            {deleteReady ? 'Notification will be removed' : 'Keep swiping to delete'}
          </p>
        </div>
      </div>

      {/* Card content */}
      <div
        ref={cardRef}
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
        className="relative z-10 cursor-pointer"
      >
        <div
          onClick={handleCardClick}
          className={`flex gap-3 py-3 active:bg-slate-50 transition rounded-lg px-1 -mx-1 ${
            !isLast ? 'border-b border-slate-100' : ''
          }`}
        >
          <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${style.bg} ${style.text}`}>
            <Icon size={18} strokeWidth={2.1} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-bold ${isRead ? 'text-slate-500' : 'text-slate-950'}`}>
                    {displayCopy.title}
                  </p>
                  {!isRead && (
                    <span className="h-2.5 w-2.5 rounded-full bg-orange-500 shrink-0 ring-2 ring-orange-100" aria-label="Unread" />
                  )}
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mt-0.5">
                  {notificationTypeLabel(notification.type)}
                </p>
              </div>
              <span className="text-[11px] font-medium text-slate-400 shrink-0">
                {formatRelativeTime(notification.createdAt)}
              </span>
            </div>

            {displayCopy.message && (
              <p className={`mt-1.5 text-sm leading-[1.5] ${isRead ? 'text-slate-400' : 'text-slate-600'}`}>
                {displayCopy.message}
              </p>
            )}
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
  const [clearingAll, setClearingAll] = useState(false);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [error, setError] = useState('');
  const [nativePermission, setNativePermission] = useState('unknown');
  const [nativePermissionBusy, setNativePermissionBusy] = useState(false);

  const unreadCount = useMemo(() => notifications.filter((item) => !item.isRead).length, [notifications]);

  const todayNotifications = useMemo(
    () => notifications.filter((n) => isToday(n.createdAt)),
    [notifications],
  );
  const earlierNotifications = useMemo(
    () => notifications.filter((n) => !isToday(n.createdAt)),
    [notifications],
  );

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
    if (!user) return false;

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
          'Notification was not deleted. Please check the Supabase delete policy for notifications.',
        );
      }

      setNotifications((current) => current.filter((item) => item.id !== id));
      window.dispatchEvent(new CustomEvent('shop2bhutan:notifications-updated'));

      return true;
    } catch (err) {
      console.error('Failed to delete notification:', err);
      setError(
        err instanceof Error ? err.message : 'Unable to delete notification.',
      );
      return false;
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


  const handleClearAll = async () => {
    if (!user || notifications.length === 0 || clearingAll) return;

    setClearingAll(true);
    setError('');

    try {
      const { error: deleteError, count } = await supabase
        .from('notifications')
        .delete({ count: 'exact' })
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      if ((count ?? 0) === 0) {
        throw new Error(
          'Notifications were not cleared. Please check the Supabase delete policy for notifications.',
        );
      }

      setNotifications([]);
      setShowClearAllConfirm(false);
      window.dispatchEvent(new CustomEvent('shop2bhutan:notifications-updated'));
    } catch (err) {
      console.error('Failed to clear notifications:', err);
      setError(
        err instanceof Error ? err.message : 'Unable to clear notifications.',
      );
    } finally {
      setClearingAll(false);
    }
  };

  const renderNotificationList = (items: AppNotification[], sectionLabel: string) => {
    if (items.length === 0) return null;

    return (
      <div>
        <div className="mb-2 mt-5 px-1">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{sectionLabel}</p>
        </div>
        {items.map((notification, index) => (
          <SwipeableNotification
            key={notification.id}
            notification={notification}
            onClick={() => handleNotificationClick(notification)}
            onDelete={() => handleDelete(notification.id)}
            isLast={index === items.length - 1 && sectionLabel === 'Earlier'}
          />
        ))}
      </div>
    );
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="sticky top-0 z-20 border-b border-slate-100 bg-white px-4 py-3">
          <div className="mx-auto flex max-w-lg items-center gap-3">
            <div>
              <div className="h-5 w-40 animate-pulse rounded-lg bg-slate-200" />
              <div className="mt-2 h-4 w-32 animate-pulse rounded-lg bg-slate-200" />
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-lg space-y-4 px-4 py-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="flex gap-3 py-3 animate-pulse">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 rounded-lg bg-slate-200" />
                <div className="h-3 w-1/2 rounded-lg bg-slate-200" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500">Activity</p>
            <h1 className="mt-0.5 truncate text-xl font-black tracking-tight text-slate-950">Notifications</h1>
            <p className="truncate text-xs text-slate-400">
              {unreadCount > 0 ? `${unreadCount} unread` : notifications.length > 0 ? `${notifications.length} updates` : 'You are all caught up'}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => loadNotifications()}
              disabled={busy || clearingAll}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-600 transition active:scale-95 disabled:opacity-50"
              aria-label="Refresh notifications"
            >
              <RefreshCw size={18} strokeWidth={2} />
            </button>

            {unreadCount > 0 && (
              <button
                type="button"
                disabled={busy || clearingAll}
                onClick={handleMarkAllRead}
                className="flex h-10 items-center gap-1.5 rounded-full bg-orange-500 px-3 text-xs font-bold text-white shadow-sm transition active:scale-95 disabled:opacity-60"
                aria-label="Mark all notifications as read"
              >
                {busy ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <CheckCheck size={16} strokeWidth={2.5} />
                )}
                <span>Mark all</span>
              </button>
            )}

            {notifications.length > 0 && (
              <button
                type="button"
                disabled={busy || clearingAll}
                onClick={() => setShowClearAllConfirm(true)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-red-600 active:scale-95 disabled:opacity-50"
                aria-label="Clear all notifications"
                title="Clear all notifications"
              >
                {clearingAll ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <Trash2 size={17} strokeWidth={2.2} />
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-4">
        {isNativeNotificationsAvailable() && nativePermission !== 'granted' && (
          <div className="mb-4 rounded-[18px] bg-blue-50 p-4 ring-1 ring-blue-100">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
                <Bell size={18} strokeWidth={2.4} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold text-slate-900">Push notifications</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Enable alerts for final price, payment, order, and parcel updates.
                </p>
                {nativePermission === 'denied' && (
                  <p className="mt-2 text-[11px] leading-4 text-blue-700">
                    {getNativeNotificationSettingsUrlHint()}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleEnableNativeNotifications}
                  disabled={nativePermissionBusy}
                  className="mt-3 h-9 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white transition active:scale-[0.98] disabled:opacity-60"
                >
                  {nativePermissionBusy ? 'Checking...' : 'Enable'}
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 flex gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle size={18} className="mt-0.5 shrink-0" strokeWidth={2} />
            <p>{error}</p>
          </div>
        )}

        {notifications.length === 0 ? (
          <div className="rounded-[22px] bg-slate-50 px-6 py-10 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] bg-orange-50 text-orange-500 ring-1 ring-orange-100">
              <BellOff size={28} strokeWidth={2} />
            </div>
            <h2 className="text-lg font-black text-slate-950">No notifications yet</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Shopping request, final price, payment, and delivery updates will appear here.
            </p>
            <button
              type="button"
              onClick={() => navigate('/orders')}
              className="mt-6 h-11 rounded-2xl bg-orange-500 px-5 text-sm font-extrabold text-white shadow-lg shadow-orange-500/20 transition active:scale-[0.98] active:bg-orange-600"
            >
              View My Orders
            </button>
          </div>
        ) : (
          <>
            {renderNotificationList(todayNotifications, 'Today')}
            {renderNotificationList(earlierNotifications, 'Earlier')}
          </>
        )}
      </main>

      {showClearAllConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/30 backdrop-blur-[2px] transition-opacity duration-300"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-notifications-title"
          onClick={() => {
            if (!clearingAll) setShowClearAllConfirm(false);
          }}
        >
          <div
            className="w-full max-w-lg translate-y-0 rounded-t-[24px] bg-white p-5 pb-8 shadow-[0_-8px_40px_rgba(0,0,0,0.12)] ring-1 ring-slate-100 transition-transform duration-300 ease-out"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-slate-200" />

            <div className="flex items-start gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100">
                <Trash2 size={19} strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <h2
                  id="clear-notifications-title"
                  className="text-base font-black text-slate-950"
                >
                  Clear all notifications?
                </h2>
                <p className="mt-1 text-sm leading-5 text-slate-500">
                  This will permanently remove all {notifications.length}{' '}
                  {notifications.length === 1 ? 'notification' : 'notifications'} from your activity list.
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={clearingAll}
                onClick={() => setShowClearAllConfirm(false)}
                className="h-11 rounded-2xl bg-slate-100 text-sm font-bold text-slate-700 transition active:scale-[0.98] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={clearingAll}
                onClick={() => void handleClearAll()}
                className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-red-600 text-sm font-bold text-white transition active:scale-[0.98] active:bg-red-700 disabled:opacity-60"
              >
                {clearingAll ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <Trash2 size={17} strokeWidth={2.2} />
                )}
                Clear all
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
