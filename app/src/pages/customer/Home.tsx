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
import { getUnreadNotificationCount } from '@/lib/customerOrders';
import { DEFAULT_APP_SETTINGS, fetchPublicAppSettings } from '@/lib/appSettings';
import { supabase } from '@/lib/supabase';

const stores = [
  { name: 'Amazon', platform: 'amazon', url: 'https://www.amazon.in/' },
  { name: 'Flipkart', platform: 'flipkart', url: 'https://www.flipkart.com/' },
  { name: 'Myntra', platform: 'myntra', url: 'https://www.myntra.com/' },
  { name: 'Meesho', platform: 'meesho', url: 'https://www.meesho.com/' },
] as const;

const quickActions = [
  { icon: ShoppingBag, label: 'Request Bag', path: '/request-bag' },
  { icon: Package, label: 'My Orders', path: '/orders' },
  { icon: Truck, label: 'Parcel', path: '/parcel' },
  { icon: Headphones, label: 'Support', path: '/support' },
];

const trustBadges = [
  { icon: MapPin, label: '20 Dzongkhags Accepted' },
  { icon: Activity, label: 'Order Tracking' },
  { icon: ShieldCheck, label: 'Quote Before Pay' },
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

function isActiveOrderRow(row: ActivityRow) {
  const status = normalizeStatus(row.status);
  return Boolean(makeActivityId(row)) && !inactiveOrderStatuses.has(status);
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

async function fetchLatestActiveOrder(userId: string): Promise<ActiveUpdate | null> {
  const rows = await fetchOwnedRows(
    'orders',
    'id, order_id, order_no, status, created_at, estimated_delivery_from, estimated_delivery_to, estimated_delivery_note',
    userId,
    ['customer_id', 'user_id', 'profile_id'],
    'id, order_id, order_no, status, created_at',
  );

  const row = rows.find(isActiveOrderRow);
  if (!row) return null;

  const id = makeActivityId(row);
  const orderNumber = cleanString(row.order_no) ?? cleanString(row.order_id) ?? id.slice(0, 8).toUpperCase();

  return {
    kind: 'order',
    id,
    title: `Order #${orderNumber}`,
    statusLabel: titleCaseStatus(row.status),
    description: orderStatusDescription(row.status),
    etaLabel: orderEtaLabel(row),
    path: `/order/${id}`,
  };
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
      className={`rounded-3xl border border-gray-100 bg-white p-3 text-left shadow-sm transition active:scale-[0.98] ${
        fullWidth ? 'col-span-2' : ''
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
            isOrder ? 'bg-orange-50 text-orange-500' : 'bg-emerald-50 text-emerald-600'
          }`}
        >
          {isOrder ? <Package size={19} strokeWidth={2.2} /> : <Truck size={19} strokeWidth={2.2} />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${
                isOrder ? 'bg-orange-50 text-orange-600' : 'bg-emerald-50 text-emerald-600'
              }`}
            >
              {isOrder ? 'Order' : 'Parcel'}
            </span>
            <span className="truncate text-[10px] font-bold text-gray-400">{update.statusLabel}</span>
          </div>

          <h3 className="mt-2 line-clamp-1 text-sm font-extrabold text-gray-950">{update.title}</h3>
          <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-gray-500">{update.description}</p>

          {update.etaLabel && (
            <p className={`mt-2 text-[11px] font-extrabold ${isOrder ? 'text-orange-600' : 'text-emerald-600'}`}>
              {update.etaLabel}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-2xl bg-gray-50 px-3 py-2">
        <span className="text-[11px] font-bold text-gray-700">{isOrder ? 'View Order' : 'View Parcel'}</span>
        <ArrowRight size={14} strokeWidth={2.5} className="text-gray-500" />
      </div>
    </button>
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
      <section className="mt-5 rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="h-3 w-28 animate-pulse rounded-full bg-gray-100" />
        <div className="mt-3 h-5 w-44 animate-pulse rounded-full bg-gray-100" />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="h-28 animate-pulse rounded-3xl bg-gray-100" />
          <div className="h-28 animate-pulse rounded-3xl bg-gray-100" />
        </div>
      </section>
    );
  }

  if (updates.length === 0) {
    return (
      <section className="mt-5 rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-sm ring-1 ring-blue-100">
            <Activity size={21} strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-orange-500">
              How It Works
            </p>
            <h3 className="mt-1 text-base font-extrabold text-gray-900">
              Start shopping in 4 simple steps
            </h3>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              Paste a product link, review your quotation, pay safely, and track delivery.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-2">
          {howItWorks.map((item) => (
            <div
              key={item.step}
              className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2.5"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-extrabold text-orange-500 shadow-sm ring-1 ring-orange-100">
                {item.step}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-gray-900">{item.title}</p>
                <p className="mt-0.5 text-[11px] leading-4 text-gray-500">{item.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onNavigate('/paste-link')}
            className="flex h-11 items-center justify-center gap-1.5 rounded-2xl bg-orange-500 px-3 text-xs font-bold text-white transition active:scale-[0.98]"
          >
            <span>Paste Link</span>
            <ArrowRight size={14} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/parcel')}
            className="h-11 rounded-2xl border border-blue-100 bg-blue-50 px-3 text-xs font-bold text-blue-700 transition active:scale-[0.98]"
          >
            Send a Parcel
          </button>
        </div>
      </section>
    );
  }

  const visibleUpdates = updates.slice(0, 2);
  const fullWidth = visibleUpdates.length === 1;

  return (
    <section className="mt-5 rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Continue Tracking</p>
          <h2 className="text-base font-extrabold text-gray-950">Active updates</h2>
        </div>
        {updates.length > 2 && (
          <button
            type="button"
            onClick={() => onNavigate('/orders')}
            className="text-[11px] font-bold text-orange-600"
          >
            View all
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
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
        isGuest ? Promise.resolve(null) : fetchLatestActiveOrder(authUser.id),
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
    <div className="min-h-screen bg-white">
      {/* ========== HEADER ========== */}
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto max-w-3xl px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.6rem)]">
          <div className="flex items-center justify-between">
            <Logo size="sm" className="min-w-0" />
            <button
              type="button"
              onClick={() => navigate('/notifications')}
              className="relative flex h-10 w-10 items-center justify-center rounded-full text-gray-700 transition-colors hover:bg-gray-100 active:bg-gray-200"
              aria-label="Notifications"
            >
              <Bell size={18} strokeWidth={1.8} />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setLocationSheetOpen(true)}
            className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-full border border-orange-100 bg-orange-50/80 px-2.5 py-1 text-left shadow-sm transition active:scale-[0.99] active:bg-orange-50"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-orange-500 shadow-sm ring-1 ring-orange-100">
              <MapPin size={13} strokeWidth={2.2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[9px] font-bold uppercase tracking-wide text-orange-500">
                Delivery location
              </span>
              <span className="block truncate text-[11px] font-extrabold text-gray-900">
                {locationChipText}
              </span>
            </span>
            <ChevronDown size={13} className="shrink-0 text-orange-500" />
          </button>
        </div>
      </header>

      {/* ========== MAIN ========== */}
      <main className="mx-auto max-w-3xl px-4 pb-[calc(8rem+env(safe-area-inset-bottom))] pt-3.5">
        {appSettings.homeAnnouncementEnabled && appSettings.homeAnnouncementText && (
          <section className="mb-4 flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-blue-800">
            <Megaphone size={18} className="mt-0.5 shrink-0" />
            <p className="text-sm font-medium leading-5">{appSettings.homeAnnouncementText}</p>
          </section>
        )}

        {/* ----- Visual Banner ----- */}
        <section
          className="relative overflow-hidden rounded-3xl"
          style={{
            backgroundImage: `
              linear-gradient(90deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.46) 48%, rgba(0,0,0,0.12) 100%),
              linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.42) 100%),
              url('/home-banner-bg.jpg')
            `,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {/* Fallback bg color if image fails */}
          <div className="absolute inset-0 bg-gray-800 -z-10" />

          <div className="relative z-10 p-5">
            {/* Store pills */}
            <div className="flex flex-wrap gap-2">
              {visibleStores.map((store) => (
                <button
                  key={store.name}
                  type="button"
                  onClick={() => window.open(store.url, '_blank', 'noopener,noreferrer')}
                  className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm transition hover:bg-white/30 active:scale-[0.97]"
                  aria-label={`Open ${store.name} website`}
                >
                  {store.name}
                </button>
              ))}
            </div>

            {/* Headline */}
            <h2 className="mt-7 text-[1.45rem] font-extrabold text-white leading-tight sm:text-3xl">
              Shop from India,<br />
              <span className="text-amber-400">Delivered to Bhutan</span>
            </h2>

            {/* Subtext */}
            <p className="mt-2 max-w-[285px] text-xs leading-5 text-white/90">
              Paste links from Amazon, Flipkart, Myntra or Meesho. We quote, order, and deliver for you.
            </p>
          </div>
        </section>

        {/* ----- Request Quotation CTA ----- */}
        <button
          type="button"
          onClick={() => navigate('/paste-link')}
          className="mt-4 flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 text-[15px] font-bold text-white transition-colors hover:bg-orange-600 active:scale-[0.98]"
        >
          <span>Paste Product Link</span>
          <ArrowRight size={18} strokeWidth={2.5} />
        </button>

        {/* ----- Trust Badges ----- */}
        <section className="mt-3 grid grid-cols-3 gap-2">
          {trustBadges.map((badge) => {
            const Icon = badge.icon;
            return (
              <div
                key={badge.label}
                className="flex min-h-[46px] items-center justify-center gap-1.5 rounded-2xl border border-gray-100 bg-white px-2 text-center shadow-sm"
              >
                <Icon size={14} strokeWidth={2.2} className="shrink-0 text-blue-600" />
                <span className="text-[10.5px] font-extrabold leading-3 text-gray-700">
                  {badge.label}
                </span>
              </div>
            );
          })}
        </section>

        {/* ----- Quick Actions ----- */}
        <section className="mt-4 rounded-[1.6rem] border border-gray-100 bg-white p-2.5 shadow-sm">
          <div className="grid grid-cols-4 gap-1">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => navigate(action.path)}
                  className="group flex min-h-[74px] flex-col items-center justify-center gap-1.5 rounded-2xl px-1 py-2.5 text-center transition active:scale-[0.98] active:bg-gray-50"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-50 text-orange-500 ring-1 ring-orange-100">
                    <Icon size={18} strokeWidth={2} />
                  </span>
                  <span className="text-[10.5px] font-semibold text-gray-700">{action.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ----- Active Order / Parcel Card ----- */}
        <ContinueTrackingCard
          updates={activeUpdates}
          loading={activeUpdateLoading}
          onNavigate={(path) => navigate(path)}
        />

      </main>

      {locationSheetOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/25 px-4 pb-[calc(5.75rem+env(safe-area-inset-bottom))] pt-6 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          onClick={() => setLocationSheetOpen(false)}
        >
          <div
            className="mx-auto w-full max-w-md rounded-[28px] border border-white/70 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.18)]"
            style={{
              animation: isDragging ? undefined : 'slideUp 0.35s ease-out',
              transform: sheetDragY > 0 ? `translateY(${sheetDragY}px)` : undefined,
              transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
            }}
            onClick={(event) => event.stopPropagation()}
            onTouchStart={handleSheetTouchStart}
            onTouchMove={handleSheetTouchMove}
            onTouchEnd={handleSheetTouchEnd}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-[5px] w-10 rounded-full bg-gray-200" />
            </div>

            {/* Header */}
            <div className="flex items-center px-5 pt-2 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-orange-200 bg-orange-50 text-orange-500">
                  <MapPin size={18} strokeWidth={1.8} />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-orange-500">
                    Delivery Location
                  </p>
                  <h3 className="mt-0.5 text-[15px] font-extrabold text-gray-900">
                    {deliveryLabel ? 'Your current location' : 'Choose your location'}
                  </h3>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-gray-100 mx-5" />

            {/* Content */}
            <div className="max-h-[calc(100dvh-15rem)] overflow-y-auto px-5 pb-5 pt-4">
              {deliveryLabel ? (
                <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-orange-500 shadow-sm ring-1 ring-orange-100">
                      <MapPin size={18} strokeWidth={1.8} />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-gray-900">
                        Delivering to {deliveryLabel}
                      </p>
                      <p className="mt-0.5 text-xs leading-5 text-gray-600">
                        This comes from your registered dzongkhag or saved profile details.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-1.5 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-orange-200 bg-orange-50 text-orange-500">
                    <MapPin size={23} strokeWidth={1.8} />
                  </div>
                  <p className="mt-3 text-[15px] font-bold text-gray-900">
                    No location selected yet
                  </p>
                  <p className="mt-1 text-[13px] leading-5 text-gray-500">
                    Select your dzongkhag during registration or update it from your profile.
                  </p>
                </div>
              )}

              {/* Info banner */}
              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <Truck size={18} strokeWidth={1.8} />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-blue-900">
                    Orders accepted from all 20 dzongkhags
                  </p>
                  <p className="mt-0.5 text-xs leading-5 text-blue-700">
                    Delivery/pickup is currently available in{' '}
                    <span className="font-bold text-blue-900">Thimphu, Paro, and Phuentsholing/Chhukha</span>.
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 flex flex-col gap-2.5">
                {isRealCustomer ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setLocationSheetOpen(false);
                        navigate('/profile');
                      }}
                      className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 text-sm font-bold text-white shadow-md shadow-orange-500/20 transition active:scale-[0.98]"
                    >
                      <span>Change registered dzongkhag</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setLocationSheetOpen(false);
                        navigate('/addresses');
                      }}
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gray-100 text-sm font-semibold text-gray-700 transition hover:bg-gray-200 active:bg-gray-300"
                    >
                      <span>Manage saved addresses</span>
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
                      className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 text-sm font-bold text-white shadow-md shadow-orange-500/20 transition active:scale-[0.98]"
                    >
                      <UserPlus size={16} strokeWidth={2} />
                      <span>Register and select dzongkhag</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setLocationSheetOpen(false);
                        navigate('/login');
                      }}
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gray-100 text-sm font-semibold text-gray-700 transition hover:bg-gray-200 active:bg-gray-300"
                    >
                      <LogIn size={16} strokeWidth={2} />
                      <span>I already have an account</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setLocationSheetOpen(false)}
                  className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-500 transition active:bg-gray-50"
                >
                  <ChevronRight size={14} strokeWidth={2.5} />
                  <span>Continue browsing</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
