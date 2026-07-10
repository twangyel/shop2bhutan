import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Bell,
  ChevronDown,
  ChevronRight,
  Headphones,
  ShoppingBag,
  LogIn,
  MapPin,
  Megaphone,
  Package,
  ShieldCheck,
  Truck,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import Logo from '@/components/shared/Logo';
import { fetchCustomerOrdersSummary, getUnreadNotificationCount } from '@/lib/customerOrders';
import { DEFAULT_APP_SETTINGS, fetchPublicAppSettings } from '@/lib/appSettings';
import { supabase } from '@/lib/supabase';

const stores = [
  {
    name: 'Amazon',
    platform: 'amazon',
    url: 'https://www.amazon.in/',
    logo: '/store-logos/amazon.png',
  },
  {
    name: 'Flipkart',
    platform: 'flipkart',
    url: 'https://www.flipkart.com/',
    logo: '/store-logos/flipkart.png',
  },
  {
    name: 'Myntra',
    platform: 'myntra',
    url: 'https://www.myntra.com/',
    logo: '/store-logos/myntra.png',
  },
  {
    name: 'Meesho',
    platform: 'meesho',
    url: 'https://www.meesho.com/',
    logo: '/store-logos/meesho.png',
  },
] as const;

const quickActions = [
  {
    icon: ShoppingBag,
    label: 'Request Bag',
    path: '/request-bag',
    iconClass: 'bg-orange-50 text-orange-600',
  },
  {
    icon: Package,
    label: 'My Orders',
    path: '/orders',
    iconClass: 'bg-blue-50 text-blue-600',
  },
  {
    icon: Truck,
    label: 'Parcel',
    path: '/parcel',
    iconClass: 'bg-emerald-50 text-emerald-600',
  },
  {
    icon: Headphones,
    label: 'Support',
    path: '/support',
    iconClass: 'bg-violet-50 text-violet-600',
  },
] as const;

const trustBadges = [
  { icon: MapPin, label: 'All 20 dzongkhags' },
  { icon: Activity, label: 'Live order tracking' },
  { icon: ShieldCheck, label: 'Quote before payment' },
] as const;

const howItWorks = [
  { step: '1', title: 'Paste Link', description: 'Send us any product link from accepted Indian stores.' },
  { step: '2', title: 'Get Quote', description: 'We calculate item cost, service fee, and delivery.' },
  { step: '3', title: 'Pay Safely', description: 'Upload payment proof after reviewing the quotation.' },
  { step: '4', title: 'Track Delivery', description: 'Follow your order or parcel until handover.' },
] as const;

type DzongkhagOption = {
  id: string;
  name: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getCustomerFirstName(profile: unknown, metadata: unknown) {
  const sources = [profile, metadata];

  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;

    const row = source as Record<string, unknown>;
    const value =
      cleanString(row.first_name) ||
      cleanString(row.full_name) ||
      cleanString(row.name) ||
      cleanString(row.customer_name);

    if (value) return value.split(/\s+/)[0];
  }

  return '';
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeDzongkhagOptions(data: unknown): DzongkhagOption[] {
  if (!Array.isArray(data)) return [];

  return data
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const id = cleanString(row.id);
      const name = cleanString(row.name);
      return id && name ? { id, name } : null;
    })
    .filter((item): item is DzongkhagOption => Boolean(item));
}

function getProfileField(profile: unknown, key: string) {
  if (!profile || typeof profile !== 'object') return null;
  return cleanString((profile as Record<string, unknown>)[key]);
}

function getMetadataField(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== 'object') return null;
  return cleanString((metadata as Record<string, unknown>)[key]);
}

function resolveDeliveryLabel({
  profile,
  userMetadata,
  dzongkhags,
}: {
  profile: unknown;
  userMetadata?: unknown;
  dzongkhags: DzongkhagOption[];
}) {
  const profileDzongkhag = getProfileField(profile, 'dzongkhag');
  const defaultDzongkhagId = getProfileField(profile, 'default_dzongkhag_id');
  const metadataDzongkhagName =
    getMetadataField(userMetadata, 'default_dzongkhag_name') ||
    getMetadataField(userMetadata, 'dzongkhag');
  const metadataDzongkhagId = getMetadataField(userMetadata, 'default_dzongkhag_id');

  const firstValue =
    profileDzongkhag ||
    defaultDzongkhagId ||
    metadataDzongkhagName ||
    metadataDzongkhagId;

  if (!firstValue) return null;

  if (UUID_RE.test(firstValue)) {
    return dzongkhags.find((item) => item.id === firstValue)?.name || null;
  }

  return firstValue;
}



const BHUTAN_TIME_ZONE = 'Asia/Thimphu';

function readableHomeDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: BHUTAN_TIME_ZONE,
    day: 'numeric',
    month: 'short',
  }).format(date);
}

function etaRangeLabel(from?: unknown, to?: unknown) {
  const fromText = readableHomeDate(cleanString(from));
  const toText = readableHomeDate(cleanString(to));

  if (fromText && toText && fromText !== toText) return `${fromText} – ${toText}`;
  return fromText || toText || '';
}

function orderEtaLabel(row: ActivityRow) {
  const eta = etaRangeLabel(
    row.estimated_delivery_from ?? row.estimatedDeliveryFrom ?? row.eta_from,
    row.estimated_delivery_to ?? row.estimatedDeliveryTo ?? row.eta_to,
  );

  if (eta) return `Expected ${eta}`;

  const status = normalizeStatus(row.status);
  if (['order_placed', 'in_transit', 'arrived_at_hub', 'out_for_delivery'].includes(status)) {
    return 'ETA will be updated soon';
  }

  if (['payment_verified', 'payment_pending'].includes(status)) {
    return 'ETA after seller order';
  }

  return '';
}

type ActiveUpdate = {
  kind: 'order' | 'parcel';
  id: string;
  title: string;
  statusLabel: string;
  description: string;
  path: string;
  etaLabel?: string;
};

type ActivityRow = Record<string, unknown> & {
  id?: string | null;
  order_id?: string | null;
  order_no?: string | null;
  status?: string | null;
  created_at?: string | null;
  trip_id?: string | null;
  estimated_delivery_from?: string | null;
  estimated_delivery_to?: string | null;
  estimated_delivery_note?: string | null;
  estimatedDeliveryFrom?: string | null;
  estimatedDeliveryTo?: string | null;
  eta_from?: string | null;
  eta_to?: string | null;
};

const inactiveOrderStatuses = new Set([
  'delivered',
  'cancelled',
  'canceled',
  'completed',
]);

const inactiveParcelStatuses = new Set([
  'delivered',
  'completed',
  'cancelled',
  'canceled',
  'rejected',
]);

function normalizeStatus(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function titleCaseStatus(value: unknown) {
  const status = normalizeStatus(value);
  if (!status) return 'In progress';

  return status
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function orderStatusDescription(status: unknown) {
  const cleanStatus = normalizeStatus(status);

  if (cleanStatus === 'quotation_pending') return 'We are checking your product details and preparing your quotation.';
  if (cleanStatus === 'quoted') return 'Your quotation is ready for review.';
  if (cleanStatus === 'payment_pending') return 'Your payment step is pending or under review.';
  if (cleanStatus === 'payment_verified') return 'Payment is verified. We will place your order with the seller.';
  if (cleanStatus === 'order_placed') return 'Your order has been placed with the seller.';
  if (cleanStatus === 'in_transit') return 'Your package is on the way to Bhutan.';
  if (cleanStatus === 'arrived_at_hub') return 'Your order has reached the delivery hub.';
  if (cleanStatus === 'out_for_delivery') return 'Your package is out for delivery.';

  return 'Your shopping order is being processed.';
}

function parcelStatusDescription(status: unknown) {
  const cleanStatus = normalizeStatus(status);

  if (cleanStatus === 'pending' || cleanStatus === 'submitted') return 'Admin will review and update your parcel request.';
  if (cleanStatus === 'accepted' || cleanStatus === 'approved') return 'Your parcel request has been accepted.';
  if (cleanStatus === 'picked_up' || cleanStatus === 'collected') return 'Your parcel has been picked up.';
  if (cleanStatus === 'in_transit') return 'Your parcel is moving on the selected trip.';
  if (cleanStatus === 'ready_for_delivery') return 'Your parcel is ready for handover.';

  return 'Your parcel request is active.';
}

function makeActivityId(row: ActivityRow) {
  return cleanString(row.id) ?? '';
}


function isActiveParcelRow(row: ActivityRow) {
  const status = normalizeStatus(row.status);
  return Boolean(makeActivityId(row)) && !inactiveParcelStatuses.has(status);
}

async function fetchOwnedRows(
  table: string,
  select: string,
  userId: string,
  ownerColumns: string[],
  fallbackSelect?: string,
) {
  for (const column of ownerColumns) {
    const runQuery = async (selectValue: string) => {
      const { data, error } = await supabase
        .from(table)
        .select(selectValue)
        .eq(column, userId)
        .order('created_at', { ascending: false })
        .limit(8);

      if (error) return { rows: [] as ActivityRow[], error };
      return { rows: Array.isArray(data) ? (data as unknown as ActivityRow[]) : [], error: null };
    };

    const primary = await runQuery(select);

    if (!primary.error && primary.rows.length > 0) return primary.rows;

    if (primary.error && fallbackSelect) {
      console.warn(`[Home] ${table}.${column} activity lookup fallback used:`, primary.error.message);
      const fallback = await runQuery(fallbackSelect);
      if (!fallback.error && fallback.rows.length > 0) return fallback.rows;
      if (fallback.error) console.warn(`[Home] ${table}.${column} fallback lookup skipped:`, fallback.error.message);
      continue;
    }

    if (primary.error) {
      console.warn(`[Home] ${table}.${column} activity lookup skipped:`, primary.error.message);
    }
  }

  return [];
}

async function fetchLatestActiveOrder(userId: string, email = ''): Promise<ActiveUpdate | null> {
  try {
    const orders = await fetchCustomerOrdersSummary(userId, email);
    const order = orders.find((item) => {
      const status = normalizeStatus(item.status);
      return Boolean(item.id) && !inactiveOrderStatuses.has(status);
    });

    if (!order) return null;

    const row = order as unknown as ActivityRow;
    const orderNumber =
      cleanString((order as { orderNumber?: string }).orderNumber) ??
      cleanString(row.order_no) ??
      cleanString(row.order_id) ??
      order.id.slice(0, 8).toUpperCase();

    return {
      kind: 'order',
      id: order.id,
      title: `Order #${orderNumber}`,
      statusLabel: titleCaseStatus(order.status),
      description: orderStatusDescription(order.status),
      etaLabel: orderEtaLabel({
        ...row,
        status: order.status,
        estimated_delivery_from: optionalString(
          row.estimated_delivery_from ??
            row.estimatedDeliveryFrom ??
            (order as unknown as Record<string, unknown>).estimatedDeliveryFrom,
        ),
        estimated_delivery_to: optionalString(
          row.estimated_delivery_to ??
            row.estimatedDeliveryTo ??
            (order as unknown as Record<string, unknown>).estimatedDeliveryTo,
        ),
      }),
      path: `/order/${order.id}`,
    };
  } catch (error) {
    console.warn('[Home] customer order summary activity lookup skipped:', error);
    return null;
  }
}


async function fetchParcelTripEta(tripId?: unknown) {
  const id = cleanString(tripId);
  if (!id) return '';

  const { data, error } = await supabase
    .from('parcel_trips')
    .select('going_date, return_date, origin, destination, title')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) {
    if (error) console.warn('[Home] parcel trip ETA lookup skipped:', error.message);
    return '';
  }

  const row = data as Record<string, unknown>;
  const goingDate = readableHomeDate(cleanString(row.going_date));
  const returnDate = readableHomeDate(cleanString(row.return_date));

  if (goingDate && returnDate && goingDate !== returnDate) return `Trip ${goingDate} – ${returnDate}`;
  if (goingDate) return `Trip ${goingDate}`;
  return '';
}

async function fetchLatestActiveParcel(userId: string): Promise<ActiveUpdate | null> {
  const rows = await fetchOwnedRows(
    'parcel_requests',
    'id, status, created_at, trip_id',
    userId,
    ['customer_id', 'user_id', 'profile_id'],
  );

  const row = rows.find(isActiveParcelRow);
  if (!row) return null;

  const id = makeActivityId(row);
  const tripEta = await fetchParcelTripEta(row.trip_id);

  return {
    kind: 'parcel',
    id,
    title: 'Parcel request active',
    statusLabel: titleCaseStatus(row.status),
    description: parcelStatusDescription(row.status),
    etaLabel: tripEta,
    path: '/my-parcels',
  };
}

function ActivityMiniCard({
  update,
  fullWidth,
  onNavigate,
}: {
  update: ActiveUpdate;
  fullWidth: boolean;
  onNavigate: (path: string) => void;
}) {
  const isOrder = update.kind === 'order';

  return (
    <button
      type="button"
      onClick={() => onNavigate(update.path)}
      className={`rounded-[1.35rem] border border-slate-100 bg-slate-50/80 p-4 text-left transition active:scale-[0.98] ${
        fullWidth ? 'col-span-2' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
            isOrder
              ? 'bg-orange-50 text-orange-600'
              : 'bg-emerald-50 text-emerald-600'
          }`}
        >
          {isOrder ? (
            <Package size={19} strokeWidth={2.2} />
          ) : (
            <Truck size={19} strokeWidth={2.2} />
          )}
        </span>

        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
            isOrder
              ? 'bg-orange-50 text-orange-700'
              : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          {update.statusLabel}
        </span>
      </div>

      <h3 className="mt-3 line-clamp-1 text-sm font-extrabold text-slate-950">
        {update.title}
      </h3>
      <p className="mt-1 line-clamp-2 text-[12px] leading-[1.45] text-slate-500">
        {update.description}
      </p>

      {update.etaLabel && (
        <p
          className={`mt-2 text-[12px] font-bold ${
            isOrder ? 'text-orange-600' : 'text-emerald-600'
          }`}
        >
          {update.etaLabel}
        </p>
      )}

      <span className="mt-3 flex items-center justify-between text-[12px] font-bold text-slate-700">
        {isOrder ? 'View order' : 'View parcel'}
        <ArrowRight size={14} strokeWidth={2.5} />
      </span>
    </button>
  );
}

function SectionHeading({
  eyebrow,
  title,
  action,
  onAction,
}: {
  eyebrow?: string;
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        {eyebrow && (
          <p className="text-[11.5px] font-extrabold uppercase tracking-[0.14em] text-orange-500">
            {eyebrow}
          </p>
        )}
        <h2 className="mt-1 text-[1.18rem] font-extrabold tracking-tight text-slate-950">
          {title}
        </h2>
      </div>

      {action && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="flex items-center gap-0.5 text-[13px] font-bold text-orange-600 transition active:scale-95"
        >
          {action}
          <ChevronRight size={15} strokeWidth={2.3} />
        </button>
      )}
    </div>
  );
}

function ContinueTrackingCard({
  updates,
  loading,
  onNavigate,
}: {
  updates: ActiveUpdate[];
  loading: boolean;
  onNavigate: (path: string) => void;
}) {
  if (loading) {
    return (
      <section className="mt-6">
        <div className="h-4 w-36 animate-pulse rounded-full bg-slate-100" />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="h-40 animate-pulse rounded-[1.35rem] bg-slate-100" />
          <div className="h-40 animate-pulse rounded-[1.35rem] bg-slate-100" />
        </div>
      </section>
    );
  }

  if (updates.length === 0) {
    return (
      <section className="mt-7">
        <SectionHeading eyebrow="Simple process" title="How Shop2Bhutan works" />

        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {howItWorks.map((item) => (
            <div
              key={item.step}
              className="min-h-[128px] rounded-[1.25rem] border border-slate-100 bg-slate-50/80 p-4"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[13px] font-black text-orange-600 shadow-sm ring-1 ring-orange-100">
                {item.step}
              </span>
              <p className="mt-2.5 text-[14px] font-extrabold text-slate-900">
                {item.title}
              </p>
              <p className="mt-1.5 text-[12.5px] leading-[1.5] text-slate-500">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  const visibleUpdates = updates.slice(0, 2);
  const fullWidth = visibleUpdates.length === 1;

  return (
    <section className="mt-7">
      <SectionHeading
        eyebrow="Continue tracking"
        title="Active updates"
        action="View all"
        onAction={() => onNavigate('/orders')}
      />

      <div className="mt-3 grid grid-cols-2 gap-3">
        {visibleUpdates.map((update) => (
          <ActivityMiniCard
            key={`${update.kind}-${update.id}`}
            update={update}
            fullWidth={fullWidth}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { user: authUser, loading: authLoading, context: authContext, isGuest } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [appSettings, setAppSettings] = useState(DEFAULT_APP_SETTINGS);
  const [dzongkhags, setDzongkhags] = useState<DzongkhagOption[]>([]);
  const [activeUpdates, setActiveUpdates] = useState<ActiveUpdate[]>([]);
  const [activeUpdateLoading, setActiveUpdateLoading] = useState(false);
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);

  // Swipe-to-dismiss state
  const [sheetDragY, setSheetDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const sheetStartYRef = React.useRef(0);

  const refreshUnreadCount = useCallback(async () => {
    if (!authUser || authLoading) {
      setUnreadCount(0);
      return;
    }

    try {
      const count = await getUnreadNotificationCount(authUser.id);
      setUnreadCount(count);
    } catch (error) {
      console.warn('[Home] Notification count skipped:', error);
      setUnreadCount(0);
    }
  }, [authLoading, authUser]);

  useEffect(() => {
    void refreshUnreadCount();
  }, [refreshUnreadCount]);

  useEffect(() => {
    const handler = () => {
      void refreshUnreadCount();
    };

    window.addEventListener('shop2bhutan:notifications-updated', handler);
    window.addEventListener('focus', handler);

    return () => {
      window.removeEventListener('shop2bhutan:notifications-updated', handler);
      window.removeEventListener('focus', handler);
    };
  }, [refreshUnreadCount]);

  const refreshActiveUpdate = useCallback(async () => {
    if (authLoading) return;

    if (!authUser) {
      setActiveUpdates([]);
      setActiveUpdateLoading(false);
      return;
    }

    setActiveUpdateLoading(true);

    try {
      const [orderUpdate, parcelUpdate] = await Promise.all([
        isGuest ? Promise.resolve(null) : fetchLatestActiveOrder(authUser.id, authUser.email ?? ''),
        fetchLatestActiveParcel(authUser.id),
      ]);

      setActiveUpdates([orderUpdate, parcelUpdate].filter(Boolean) as ActiveUpdate[]);
    } catch (error) {
      console.warn('[Home] Active update lookup skipped:', error);
      setActiveUpdates([]);
    } finally {
      setActiveUpdateLoading(false);
    }
  }, [authLoading, authUser, isGuest]);

  useEffect(() => {
    void refreshActiveUpdate();
  }, [refreshActiveUpdate]);

  useEffect(() => {
    const handler = () => {
      void refreshActiveUpdate();
    };

    window.addEventListener('shop2bhutan:orders-updated', handler);
    window.addEventListener('shop2bhutan:request-bag-updated', handler);
    window.addEventListener('shop2bhutan:parcels-updated', handler);
    window.addEventListener('focus', handler);

    return () => {
      window.removeEventListener('shop2bhutan:orders-updated', handler);
      window.removeEventListener('shop2bhutan:request-bag-updated', handler);
      window.removeEventListener('shop2bhutan:parcels-updated', handler);
      window.removeEventListener('focus', handler);
    };
  }, [refreshActiveUpdate]);

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      try {
        const loaded = await fetchPublicAppSettings();
        if (active) setAppSettings(loaded);
      } catch (error) {
        console.warn('[Home] App settings skipped:', error);
      }
    }

    void loadSettings();

    const handleSettingsUpdated = () => {
      void loadSettings();
    };

    window.addEventListener('shop2bhutan:app-settings-updated', handleSettingsUpdated);

    return () => {
      active = false;
      window.removeEventListener('shop2bhutan:app-settings-updated', handleSettingsUpdated);
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadDzongkhags() {
      try {
        const { data, error } = await supabase.rpc('get_dzongkhag_options');
        if (!active) return;

        if (error) {
          console.warn('[Home] Dzongkhag options skipped:', error.message);
          return;
        }

        setDzongkhags(normalizeDzongkhagOptions(data));
      } catch (error) {
        console.warn('[Home] Dzongkhag options skipped:', error);
      }
    }

    void loadDzongkhags();

    return () => {
      active = false;
    };
  }, []);

  const visibleStores = stores.filter(
    (store) => appSettings.acceptedPlatforms[store.platform as keyof typeof appSettings.acceptedPlatforms],
  );

  const deliveryLabel = useMemo(
    () =>
      resolveDeliveryLabel({
        profile: authContext?.profile,
        userMetadata: authUser?.user_metadata,
        dzongkhags,
      }),
    [authContext?.profile, authUser?.user_metadata, dzongkhags],
  );

  const isRealCustomer = Boolean(authUser && !isGuest);
  const locationChipText = deliveryLabel
    ? `Delivering to ${deliveryLabel}`
    : 'Choose location';

  const greeting = useMemo(() => getGreeting(), []);
  const customerFirstName = useMemo(
    () => getCustomerFirstName(authContext?.profile, authUser?.user_metadata),
    [authContext?.profile, authUser?.user_metadata],
  );

  // Swipe-to-dismiss handlers
  const handleSheetTouchStart = (e: React.TouchEvent) => {
    sheetStartYRef.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleSheetTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const delta = e.touches[0].clientY - sheetStartYRef.current;
    if (delta > 0) {
      setSheetDragY(delta);
    }
  };

  const handleSheetTouchEnd = () => {
    setIsDragging(false);
    if (sheetDragY > 120) {
      setLocationSheetOpen(false);
    }
    setSheetDragY(0);
  };

  return (
    <div className="min-h-dvh bg-white">
      <header className="bg-white">
        <div className="px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
          <div className="flex items-center justify-between gap-3">
            <Logo size="sm" className="min-w-0" />

            <button
              type="button"
              onClick={() => navigate('/notifications')}
              className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-700 transition active:scale-95 active:bg-slate-100"
              aria-label="Notifications"
            >
              <Bell size={19} strokeWidth={1.9} />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black leading-none text-white ring-2 ring-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>

          <div className="mt-3">
            <p className="text-[14px] font-medium text-slate-500">
              {greeting}
              {customerFirstName && (
                <>
                  {', '}
                  <span className="font-extrabold text-slate-900">
                    {customerFirstName}
                  </span>
                </>
              )}
            </p>
            <button
              type="button"
              onClick={() => setLocationSheetOpen(true)}
              className="mt-1.5 inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full text-left text-orange-600 transition active:scale-95"
            >
              <MapPin size={17} strokeWidth={2.3} className="shrink-0" />
              <span className="truncate text-[14px] font-bold">
                {deliveryLabel ? `Delivering to ${deliveryLabel}` : 'Set delivery location'}
              </span>
              <ChevronDown size={14} className="shrink-0" />
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 pb-[calc(1.75rem+env(safe-area-inset-bottom))] pt-2">
        {appSettings.homeAnnouncementEnabled && appSettings.homeAnnouncementText && (
          <section className="mt-2 flex items-start gap-3 rounded-[1.2rem] bg-blue-50 px-4 py-3 text-blue-900">
            <Megaphone size={18} className="mt-0.5 shrink-0 text-blue-600" />
            <p className="text-[13px] font-medium leading-5">
              {appSettings.homeAnnouncementText}
            </p>
          </section>
        )}

        <section
          className="relative mt-4 min-h-[205px] overflow-hidden rounded-[1.55rem] bg-slate-900 shadow-[0_14px_35px_rgba(15,23,42,0.12)]"
          style={{
            backgroundImage: `
              linear-gradient(90deg, rgba(15,23,42,0.82) 0%, rgba(15,23,42,0.52) 52%, rgba(15,23,42,0.10) 100%),
              linear-gradient(to top, rgba(15,23,42,0.40), rgba(15,23,42,0.01)),
              url('/home-banner-bg.jpg')
            `,
            backgroundSize: 'cover',
            backgroundPosition: '62% center',
          }}
        >
          <div className="relative z-10 flex min-h-[166px] max-w-[79%] flex-col justify-center p-5">
            <h2 className="text-[1.38rem] font-extrabold leading-[1.13] tracking-tight text-white">
              Shop Amazon, Flipkart,
              <span className="block text-orange-300">Myntra &amp; Meesho.</span>
            </h2>

            <p className="mt-2 text-[13px] leading-[1.5] text-white/[0.88]">
              Paste the product link or upload a screenshot. We send a quotation before you pay.
            </p>

            <button
              type="button"
              onClick={() => navigate('/paste-link')}
              className="mt-4 inline-flex h-11 w-fit items-center gap-2 rounded-[0.9rem] bg-orange-500 px-[18px] text-[14px] font-extrabold text-white shadow-lg shadow-orange-950/20 transition active:scale-95 active:bg-orange-600"
            >
              Start shopping
              <ArrowRight size={15} strokeWidth={2.5} />
            </button>
          </div>
        </section>

        {visibleStores.length > 0 && (
          <section className="mt-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-orange-500">
                  Accepted stores
                </p>
                <h2 className="mt-1 text-[15px] font-extrabold text-slate-950">
                  Shop from these platforms
                </h2>
              </div>
              <span className="text-[10px] font-semibold text-slate-400">
                Opens official site
              </span>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2">
              {visibleStores.map((store) => (
                <button
                  key={store.name}
                  type="button"
                  onClick={() => window.open(store.url, '_blank', 'noopener,noreferrer')}
                  className="flex min-h-[86px] flex-col items-center justify-center gap-2 rounded-[1.15rem] border border-slate-100 bg-white px-2 py-3 text-center shadow-[0_6px_20px_rgba(15,23,42,0.045)] transition active:scale-95 active:bg-slate-50"
                  aria-label={`Open ${store.name} website`}
                >
                  <span className="flex h-9 w-9 items-center justify-center">
                    <img
                      src={store.logo}
                      alt={store.name}
                      className="h-full w-full object-contain"
                      loading="lazy"
                    />
                  </span>
                  <span className="text-[11.5px] font-extrabold text-slate-700">
                    {store.name}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="mt-7">
          <SectionHeading
            eyebrow="Everything in one place"
            title="Quick actions"
          />

          <div className="mt-3 grid grid-cols-4 gap-2">
            {quickActions.map((action) => {
              const Icon = action.icon;

              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => navigate(action.path)}
                  className="flex min-h-[94px] flex-col items-center justify-center gap-2.5 rounded-[1.25rem] bg-slate-50 px-1.5 py-3 text-center transition active:scale-95 active:bg-slate-100"
                >
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl ${action.iconClass}`}
                  >
                    <Icon size={20} strokeWidth={2.15} />
                  </span>
                  <span className="text-[12.5px] font-bold leading-[1.2] text-slate-700">
                    {action.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <ContinueTrackingCard
          updates={activeUpdates}
          loading={activeUpdateLoading}
          onNavigate={(path) => navigate(path)}
        />

        <section className="mt-7">
          <button
            type="button"
            onClick={() => navigate('/parcel')}
            className="flex w-full items-center gap-3 rounded-[1.35rem] bg-emerald-50 p-4 text-left transition active:scale-[0.98]"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm">
              <Truck size={22} strokeWidth={2.1} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-extrabold text-emerald-950">
                Sending a small parcel?
              </span>
              <span className="mt-1 block text-[13.5px] leading-[1.55] text-emerald-800/75">
                Book documents, medicine or small electronics on an available trip.
              </span>
            </span>
            <ChevronRight size={19} className="shrink-0 text-emerald-600" />
          </button>
        </section>

        <section className="mt-7">
          <SectionHeading eyebrow="Shop confidently" title="Why customers trust us" />

          <div className="mt-3 divide-y divide-slate-100 rounded-[1.35rem] border border-slate-100 bg-white">
            {trustBadges.map((badge) => {
              const Icon = badge.icon;

              return (
                <div key={badge.label} className="flex items-center gap-3 px-4 py-3.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Icon size={17} strokeWidth={2.1} />
                  </span>
                  <span className="text-[13.5px] font-bold text-slate-700">
                    {badge.label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {locationSheetOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/35 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          onClick={() => setLocationSheetOpen(false)}
        >
          <div
            className="customer-bottom-sheet w-full max-w-lg rounded-t-[2rem] bg-white shadow-[0_-18px_55px_rgba(15,23,42,0.16)]"
            style={{
              animation: isDragging ? undefined : 's2b-sheet-up 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
              transform: sheetDragY > 0 ? `translateY(${sheetDragY}px)` : undefined,
              transition: isDragging
                ? 'none'
                : 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
            }}
            onClick={(event) => event.stopPropagation()}
            onTouchStart={handleSheetTouchStart}
            onTouchMove={handleSheetTouchMove}
            onTouchEnd={handleSheetTouchEnd}
          >
            <div className="flex justify-center pb-1 pt-3">
              <div className="h-1.5 w-12 rounded-full bg-slate-200" />
            </div>

            <div className="max-h-[84dvh] overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
              <div className="flex items-center gap-3 pb-4 pt-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
                  <MapPin size={19} strokeWidth={2.1} />
                </span>
                <div>
                  <p className="text-[11.5px] font-extrabold uppercase tracking-[0.14em] text-orange-500">
                    Delivery location
                  </p>
                  <h3 className="mt-0.5 text-base font-extrabold text-slate-950">
                    {deliveryLabel ? 'Your current location' : 'Choose your location'}
                  </h3>
                </div>
              </div>

              {deliveryLabel ? (
                <div className="rounded-[1.2rem] bg-orange-50 p-4">
                  <p className="text-sm font-extrabold text-slate-950">
                    {locationChipText}
                  </p>
                  <p className="mt-1 text-[13.5px] leading-[1.55] text-slate-600">
                    This is based on your registered dzongkhag or saved profile.
                  </p>
                </div>
              ) : (
                <div className="rounded-[1.2rem] bg-slate-50 p-5 text-center">
                  <MapPin
                    size={24}
                    strokeWidth={1.9}
                    className="mx-auto text-orange-500"
                  />
                  <p className="mt-3 text-sm font-extrabold text-slate-900">
                    No location selected
                  </p>
                  <p className="mt-1 text-[13.5px] leading-[1.55] text-slate-500">
                    Add your dzongkhag to receive clearer delivery information.
                  </p>
                </div>
              )}

              <div className="mt-3 flex items-start gap-3 rounded-[1.2rem] bg-blue-50 p-4">
                <Truck size={19} className="mt-0.5 shrink-0 text-blue-600" />
                <div>
                  <p className="text-[13.5px] font-extrabold text-blue-950">
                    Orders accepted from all 20 dzongkhags
                  </p>
                  <p className="mt-1 text-[13px] leading-[1.55] text-blue-800/75">
                    Delivery and pickup are currently available in Thimphu, Paro and
                    Phuentsholing/Chhukha.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-2.5">
                {isRealCustomer ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setLocationSheetOpen(false);
                        navigate('/profile');
                      }}
                      className="h-12 rounded-2xl bg-orange-500 px-4 text-sm font-extrabold text-white transition active:scale-[0.98] active:bg-orange-600"
                    >
                      {deliveryLabel ? 'Change delivery location' : 'Set delivery location'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setLocationSheetOpen(false);
                        navigate('/addresses');
                      }}
                      className="h-12 rounded-2xl bg-slate-100 px-4 text-sm font-bold text-slate-700 transition active:scale-[0.98] active:bg-slate-200"
                    >
                      Manage saved addresses
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setLocationSheetOpen(false);
                        navigate('/register');
                      }}
                      className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 text-sm font-extrabold text-white transition active:scale-[0.98]"
                    >
                      <UserPlus size={16} strokeWidth={2.2} />
                      Register and select dzongkhag
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setLocationSheetOpen(false);
                        navigate('/login');
                      }}
                      className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 text-sm font-bold text-slate-700 transition active:scale-[0.98]"
                    >
                      <LogIn size={16} strokeWidth={2.2} />
                      I already have an account
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setLocationSheetOpen(false)}
                  className="h-11 rounded-2xl text-sm font-bold text-slate-500 transition active:bg-slate-50"
                >
                  Continue browsing
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
