import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Bell,
  BellOff,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  CreditCard,
  FileText,
  Loader2,
  Megaphone,
  MoreVertical,
  Package,
  RefreshCw,
  Trash2,
  Truck,
  X,
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

  if (type === 'order_update') {
    if (t.includes('delivered') || t.includes('picked up')) {
      return { icon: Package, bg: 'bg-emerald-50', text: 'text-emerald-600' };
    }

    if (t.includes('ready for pickup') || t.includes('ready for collection')) {
      return { icon: Package, bg: 'bg-amber-50', text: 'text-amber-600' };
    }

    if (t.includes('arrived at pickup hub') || t.includes('arrived at hub')) {
      return { icon: Truck, bg: 'bg-violet-50', text: 'text-violet-600' };
    }

    if (t.includes('out for delivery')) {
      return { icon: Truck, bg: 'bg-cyan-50', text: 'text-cyan-600' };
    }

    if (t.includes('in transit')) {
      return { icon: Truck, bg: 'bg-blue-50', text: 'text-blue-600' };
    }

    if (t.includes('order placed')) {
      return { icon: Package, bg: 'bg-indigo-50', text: 'text-indigo-600' };
    }

    if (t.includes('parcel')) {
      return { icon: Package, bg: 'bg-orange-50', text: 'text-orange-600' };
    }

    return { icon: Package, bg: 'bg-sky-50', text: 'text-sky-600' };
  }

  if (type === 'payment') {
    return { icon: CreditCard, bg: 'bg-emerald-50', text: 'text-emerald-600' };
  }

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

  if (type === 'promotion') {
    return { icon: Megaphone, bg: 'bg-purple-50', text: 'text-purple-600' };
  }

  return { icon: Bell, bg: 'bg-slate-100', text: 'text-slate-500' };
}

function notificationTypeLabel(type: NotificationType) {
  if (type === 'payment') return 'Payment';
  if (type === 'quotation') return 'Final price';
  if (type === 'order_update') return 'Order update';
  if (type === 'promotion') return 'Promotion';
  return 'System';
}

type NotificationGroup = {
  key: string;
  items: AppNotification[];
};

function orderNotificationGroupKey(notification: AppNotification) {
  if (notification.type !== 'order_update') return '';

  const searchable = [
    notification.title,
    notification.message,
    notification.link,
  ]
    .filter(Boolean)
    .join(' ');

  const publicOrderNumber = searchable.match(/S2B-ORD-[A-Z0-9-]+/i)?.[0];

  if (publicOrderNumber) {
    return `order:${publicOrderNumber.toUpperCase()}`;
  }

  const orderRoute = String(notification.link || '').match(/\/order\/([^/?#]+)/i)?.[1];

  return orderRoute ? `order-route:${orderRoute}` : '';
}

function groupNotifications(items: AppNotification[]): NotificationGroup[] {
  const groups: NotificationGroup[] = [];
  const groupedOrderIndexes = new Map<string, number>();

  items.forEach((notification) => {
    const orderKey = orderNotificationGroupKey(notification);

    if (!orderKey) {
      groups.push({
        key: `notification:${notification.id}`,
        items: [notification],
      });
      return;
    }

    const existingIndex = groupedOrderIndexes.get(orderKey);

    if (existingIndex === undefined) {
      groupedOrderIndexes.set(orderKey, groups.length);
      groups.push({ key: orderKey, items: [notification] });
      return;
    }

    groups[existingIndex].items.push(notification);
  });

  return groups;
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
  onImageClick,
  isLast,
  isLatest = false,
  isNested = false,
  groupedUpdateCount = 0,
  groupExpanded = false,
  onToggleGroup,
}: {
  notification: AppNotification;
  onClick: () => void;
  onDelete: () => Promise<boolean> | boolean;
  onImageClick: (url: string, title: string) => void;
  isLast?: boolean;
  isLatest?: boolean;
  isNested?: boolean;
  groupedUpdateCount?: number;
  groupExpanded?: boolean;
  onToggleGroup?: () => void;
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
        deleting ? 'max-h-0 -translate-x-2 opacity-0' : 'max-h-[520px] opacity-100'
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
          className={`flex gap-2.5 rounded-xl px-2 transition active:bg-slate-50 ${
            isNested ? 'ml-5 py-2' : 'py-2.5'
          } ${
            isLatest && !isRead
              ? 'bg-orange-50/70 ring-1 ring-inset ring-orange-100'
              : ''
          } ${!isLast ? 'border-b border-slate-100' : ''}`}
        >
          <div
            className={`mt-0.5 flex shrink-0 items-center justify-center rounded-xl ${
              isNested ? 'h-8 w-8' : 'h-9 w-9'
            } ${style.bg} ${style.text}`}
          >
            <Icon size={isNested ? 15 : 17} strokeWidth={2.2} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-1.5">
                  <p
                    className={`truncate font-bold ${
                      isNested ? 'text-[12px]' : 'text-[13px]'
                    } ${isRead ? 'text-slate-500' : 'text-slate-950'}`}
                  >
                    {displayCopy.title}
                  </p>
                  {!isRead && (
                    <span
                      className="h-2 w-2 shrink-0 rounded-full bg-orange-500 ring-2 ring-orange-100"
                      aria-label="Unread"
                    />
                  )}
                </div>
                <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">
                  {notificationTypeLabel(notification.type)}
                </p>
              </div>
              <span className="shrink-0 text-[10px] font-medium text-slate-400">
                {formatRelativeTime(notification.createdAt)}
              </span>
            </div>

            {notification.imageUrl && !isNested && (
              <button
                type="button"
                className="group relative mt-2 block w-full overflow-hidden rounded-xl border border-slate-100 bg-slate-50 text-left"
                aria-label={`View image for ${displayCopy.title}`}
                onClick={(event) => {
                  event.stopPropagation();

                  if (moved.current) {
                    moved.current = false;
                    return;
                  }

                  if (offset < 0) {
                    resetSwipe();
                    return;
                  }

                  onImageClick(notification.imageUrl!, displayCopy.title);
                }}
              >
                <img
                  src={notification.imageUrl}
                  alt={displayCopy.title}
                  loading="lazy"
                  draggable={false}
                  className="aspect-[16/6] w-full object-cover transition duration-200 group-active:scale-[0.99]"
                  onError={(event) => {
                    event.currentTarget.closest('button')?.setAttribute('hidden', '');
                  }}
                />
                <span className="absolute bottom-2 right-2 rounded-full bg-white/95 px-2.5 py-1 text-[9px] font-bold text-slate-600 shadow-sm ring-1 ring-black/5">
                  View image
                </span>
              </button>
            )}

            {displayCopy.message && (
              <p
                className={`mt-1 line-clamp-2 ${
                  isNested ? 'text-[11px] leading-4' : 'text-[13px] leading-5'
                } ${isRead ? 'text-slate-400' : 'text-slate-600'}`}
              >
                {displayCopy.message}
              </p>
            )}

            {groupedUpdateCount > 0 && onToggleGroup && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleGroup();
                }}
                className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600 transition active:scale-[0.98]"
                aria-expanded={groupExpanded}
              >
                {groupExpanded ? (
                  <ChevronUp size={12} />
                ) : (
                  <ChevronDown size={12} />
                )}
                {groupExpanded
                  ? 'Hide earlier updates'
                  : `${groupedUpdateCount} earlier update${
                      groupedUpdateCount === 1 ? '' : 's'
                    }`}
              </button>
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
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    title: string;
  } | null>(null);
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

  useEffect(() => {
    if (
      (!showClearAllConfirm && !previewImage) ||
      typeof document === 'undefined'
    ) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      if (previewImage) {
        setPreviewImage(null);
        return;
      }

      if (!clearingAll) {
        setShowClearAllConfirm(false);
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [clearingAll, previewImage, showClearAllConfirm]);

  useEffect(() => {
    if (!showHeaderMenu || typeof document === 'undefined') return undefined;

    const closeMenu = () => setShowHeaderMenu(false);
    window.addEventListener('scroll', closeMenu, { passive: true });

    return () => {
      window.removeEventListener('scroll', closeMenu);
    };
  }, [showHeaderMenu]);

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
      setNotifications((current) =>
        current.map((item) => ({ ...item, isRead: true })),
      );
      window.dispatchEvent(
        new CustomEvent('shop2bhutan:notifications-updated'),
      );
    } catch (err) {
      console.error('Failed to mark all notifications read:', err);
      setError(err instanceof Error ? err.message : 'Unable to mark notifications as read.');
    } finally {
      setBusy(false);
    }
  };


  const handleClearAll = async () => {
    if (!user || notifications.length === 0 || clearingAll) return;

    setShowHeaderMenu(false);
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

  const toggleNotificationGroup = (groupKey: string) => {
    setExpandedGroups((current) =>
      current.includes(groupKey)
        ? current.filter((key) => key !== groupKey)
        : [...current, groupKey],
    );
  };

  const renderNotificationList = (
    items: AppNotification[],
    sectionLabel: string,
  ) => {
    if (items.length === 0) return null;

    const groups = groupNotifications(items);
    const latestNotificationId = notifications[0]?.id;

    return (
      <div>
        <div className="mb-1.5 mt-4 px-1">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">
            {sectionLabel}
          </p>
        </div>

        {groups.map((group, groupIndex) => {
          const [latest, ...earlier] = group.items;
          const expanded = expandedGroups.includes(group.key);
          const groupIsLast =
            groupIndex === groups.length - 1 &&
            sectionLabel === 'Earlier' &&
            (!expanded || earlier.length === 0);

          return (
            <div key={group.key}>
              <SwipeableNotification
                notification={latest}
                onClick={() => handleNotificationClick(latest)}
                onDelete={() => handleDelete(latest.id)}
                onImageClick={(url, imageTitle) =>
                  setPreviewImage({ url, title: imageTitle })
                }
                isLatest={latest.id === latestNotificationId}
                groupedUpdateCount={earlier.length}
                groupExpanded={expanded}
                onToggleGroup={
                  earlier.length > 0
                    ? () => toggleNotificationGroup(group.key)
                    : undefined
                }
                isLast={groupIsLast}
              />

              {expanded &&
                earlier.map((notification, index) => (
                  <SwipeableNotification
                    key={notification.id}
                    notification={notification}
                    onClick={() => handleNotificationClick(notification)}
                    onDelete={() => handleDelete(notification.id)}
                    onImageClick={(url, imageTitle) =>
                      setPreviewImage({ url, title: imageTitle })
                    }
                    isNested
                    isLast={
                      groupIndex === groups.length - 1 &&
                      sectionLabel === 'Earlier' &&
                      index === earlier.length - 1
                    }
                  />
                ))}
            </div>
          );
        })}
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
    <div className="min-h-screen bg-white pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 pb-2.5 pt-[calc(env(safe-area-inset-top)+0.65rem)]">
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-orange-500">Activity</p>
            <h1 className="mt-0.5 truncate text-lg font-black tracking-tight text-slate-950">Notifications</h1>
            <p className="truncate text-xs text-slate-400">
              {unreadCount > 0 ? `${unreadCount} unread` : notifications.length > 0 ? `${notifications.length} updates` : 'You are all caught up'}
            </p>
          </div>

          <div className="relative flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => loadNotifications()}
              disabled={busy || clearingAll}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-slate-600 transition active:scale-95 disabled:opacity-50"
              aria-label="Refresh notifications"
            >
              <RefreshCw size={17} strokeWidth={2} />
            </button>

            {unreadCount > 0 && (
              <button
                type="button"
                disabled={busy || clearingAll}
                onClick={handleMarkAllRead}
                className="flex h-9 items-center gap-1 rounded-full bg-orange-500 px-2.5 text-[11px] font-bold text-white shadow-sm transition active:scale-95 disabled:opacity-60"
                aria-label="Mark all notifications as read"
              >
                {busy ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <CheckCheck size={15} strokeWidth={2.5} />
                )}
                <span>Mark all read</span>
              </button>
            )}

            {notifications.length > 0 && (
              <>
                <button
                  type="button"
                  disabled={busy || clearingAll}
                  onClick={() => setShowHeaderMenu((current) => !current)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-50 active:scale-95 disabled:opacity-50"
                  aria-label="More notification actions"
                  aria-expanded={showHeaderMenu}
                >
                  <MoreVertical size={18} strokeWidth={2.2} />
                </button>

                {showHeaderMenu && (
                  <div className="absolute right-0 top-11 z-30 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10">
                    <button
                      type="button"
                      onClick={() => {
                        setShowHeaderMenu(false);
                        setShowClearAllConfirm(true);
                      }}
                      className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-xs font-bold text-red-600 transition hover:bg-red-50"
                    >
                      <Trash2 size={15} />
                      Clear all
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-3">
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

      {previewImage &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/95 p-3 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label={`Image preview: ${previewImage.title}`}
            onClick={() => setPreviewImage(null)}
          >
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute right-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/20 backdrop-blur transition active:scale-95"
              style={{ top: 'calc(env(safe-area-inset-top) + 1rem)' }}
              aria-label="Close image preview"
            >
              <X size={22} strokeWidth={2.2} />
            </button>

            <div
              className="flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col items-center justify-center"
              onClick={(event) => event.stopPropagation()}
            >
              <img
                src={previewImage.url}
                alt={previewImage.title}
                className="max-h-[calc(100dvh-7rem)] max-w-full rounded-2xl bg-white object-contain shadow-2xl"
              />
              <p className="mt-3 max-w-full truncate px-4 text-center text-sm font-bold text-white/90">
                {previewImage.title}
              </p>
            </div>
          </div>,
          document.body,
        )}

      {showClearAllConfirm &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[1000] flex items-end justify-center bg-slate-950/40 px-3 pt-3 backdrop-blur-[2px] sm:items-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-notifications-title"
            onClick={() => {
              if (!clearingAll) setShowClearAllConfirm(false);
            }}
          >
            <div
              className="max-h-[calc(100dvh-1rem)] w-full max-w-lg overflow-y-auto rounded-t-[26px] bg-white px-5 pt-4 shadow-[0_-12px_48px_rgba(15,23,42,0.18)] ring-1 ring-slate-200 sm:rounded-[26px] sm:p-5"
              style={{
                paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)',
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden" />

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
          </div>,
          document.body,
        )}
    </div>
  );
}
