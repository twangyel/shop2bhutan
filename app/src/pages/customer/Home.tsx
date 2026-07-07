import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Bell,
  Megaphone,
  ChevronDown,
  Headphones,
  Link2,
  MapPin,
  Package,
  Truck,
  X,
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
  { icon: Link2, label: 'Paste Link', path: '/paste-link' },
  { icon: Package, label: 'My Orders', path: '/orders' },
  { icon: Truck, label: 'Track Order', path: '/orders' },
  { icon: Headphones, label: 'Support', path: '/support' },
];

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


type ActiveUpdate = {
  kind: 'order' | 'parcel';
  id: string;
  title: string;
  statusLabel: string;
  description: string;
  path: string;
};

type ActivityRow = Record<string, unknown> & {
  id?: string | null;
  order_id?: string | null;
  status?: string | null;
  created_at?: string | null;
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
) {
  for (const column of ownerColumns) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .eq(column, userId)
      .order('created_at', { ascending: false })
      .limit(8);

    if (error) {
      console.warn(`[Home] ${table}.${column} activity lookup skipped:`, error.message);
      continue;
    }

    const rows = Array.isArray(data) ? (data as unknown as ActivityRow[]) : [];
    if (rows.length > 0) return rows;
  }

  return [];
}

async function fetchLatestActiveOrder(userId: string): Promise<ActiveUpdate | null> {
  const rows = await fetchOwnedRows(
    'orders',
    'id, order_id, status, created_at',
    userId,
    ['customer_id', 'user_id'],
  );

  const row = rows.find(isActiveOrderRow);
  if (!row) return null;

  const id = makeActivityId(row);
  const orderNumber = cleanString(row.order_id) ?? id.slice(0, 8).toUpperCase();

  return {
    kind: 'order',
    id,
    title: `Order #${orderNumber}`,
    statusLabel: titleCaseStatus(row.status),
    description: orderStatusDescription(row.status),
    path: `/orders/${id}`,
  };
}

async function fetchLatestActiveParcel(userId: string): Promise<ActiveUpdate | null> {
  const rows = await fetchOwnedRows(
    'parcel_requests',
    'id, status, created_at, trip_id',
    userId,
    ['customer_id', 'user_id'],
  );

  const row = rows.find(isActiveParcelRow);
  if (!row) return null;

  const id = makeActivityId(row);

  return {
    kind: 'parcel',
    id,
    title: 'Parcel request active',
    statusLabel: titleCaseStatus(row.status),
    description: parcelStatusDescription(row.status),
    path: '/my-parcels',
  };
}

function ContinueTrackingCard({
  update,
  loading,

  onNavigate,
}: {
  update: ActiveUpdate | null;
  loading: boolean;
  isGuest: boolean;
  onNavigate: (path: string) => void;
}) {
  if (loading) {
    return (
      <section className="mt-5 rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="h-3 w-28 animate-pulse rounded-full bg-gray-100" />
        <div className="mt-3 h-5 w-44 animate-pulse rounded-full bg-gray-100" />
        <div className="mt-3 h-3 w-full animate-pulse rounded-full bg-gray-100" />
        <div className="mt-2 h-3 w-2/3 animate-pulse rounded-full bg-gray-100" />
      </section>
    );
  }

  if (!update) {
    return (
      <section className="mt-5 rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-sm ring-1 ring-blue-100">
            <Activity size={21} strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-orange-500">
              Your Active Updates
            </p>
            <h3 className="mt-1 text-base font-extrabold text-gray-900">
              No active updates yet
            </h3>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              Your latest order or parcel status will appear here.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('/parcel')}
          className="mt-4 h-11 w-full rounded-2xl border border-blue-100 bg-blue-50 px-3 text-xs font-bold text-blue-700 transition active:scale-[0.98]"
        >
          Book a Parcel Trip
        </button>
      </section>
    );
  }

  const isOrder = update.kind === 'order';

  return (
    <section className="mt-5 rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
            isOrder ? 'bg-orange-50 text-orange-500' : 'bg-emerald-50 text-emerald-600'
          }`}
        >
          {isOrder ? <Package size={21} strokeWidth={2.2} /> : <Truck size={21} strokeWidth={2.2} />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Continue Tracking
            </p>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                isOrder ? 'bg-orange-50 text-orange-600' : 'bg-emerald-50 text-emerald-600'
              }`}
            >
              {isOrder ? 'Order' : 'Parcel'}
            </span>
          </div>

          <h3 className="mt-1 truncate text-base font-extrabold text-gray-900">
            {update.title}
          </h3>
          <p className="mt-1 text-xs font-semibold text-gray-700">
            {update.statusLabel}
          </p>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            {update.description}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onNavigate(update.path)}
        className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-gray-900 text-xs font-bold text-white transition active:scale-[0.98]"
      >
        <span>{isOrder ? 'View Order' : 'View Parcel'}</span>
        <ArrowRight size={15} strokeWidth={2.5} />
      </button>
    </section>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { user: authUser, loading: authLoading, context: authContext, isGuest } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [appSettings, setAppSettings] = useState(DEFAULT_APP_SETTINGS);
  const [dzongkhags, setDzongkhags] = useState<DzongkhagOption[]>([]);
  const [activeUpdate, setActiveUpdate] = useState<ActiveUpdate | null>(null);
  const [activeUpdateLoading, setActiveUpdateLoading] = useState(false);
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);

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
      setActiveUpdate(null);
      setActiveUpdateLoading(false);
      return;
    }

    setActiveUpdateLoading(true);

    try {
      const [orderUpdate, parcelUpdate] = await Promise.all([
        isGuest ? Promise.resolve(null) : fetchLatestActiveOrder(authUser.id),
        fetchLatestActiveParcel(authUser.id),
      ]);

      setActiveUpdate(orderUpdate ?? parcelUpdate);
    } catch (error) {
      console.warn('[Home] Active update lookup skipped:', error);
      setActiveUpdate(null);
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

  return (
    <div className="min-h-screen bg-white">
      {/* ========== HEADER ========== */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100">
        <div className="mx-auto max-w-3xl px-4 pb-3 pt-3">
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
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-gray-100 bg-white px-3 py-1.5 text-left text-xs font-medium text-gray-700 shadow-sm transition-colors active:bg-gray-50"
          >
            <MapPin size={13} className="text-orange-500" />
            <span>{locationChipText}</span>
            <ChevronDown size={12} className="ml-0.5 text-gray-400" />
          </button>
        </div>
      </header>

      {/* ========== MAIN ========== */}
      <main className="mx-auto max-w-3xl px-4 pb-28 pt-4">
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
              linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.55) 100%),
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
                  className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/30"
                  aria-label={`Open ${store.name} website`}
                >
                  {store.name}
                </button>
              ))}
            </div>

            {/* Label */}
            <p className="mt-4 text-[11px] font-bold uppercase tracking-widest text-amber-400">
              {appSettings.appName}
            </p>

            {/* Headline */}
            <h2 className="mt-1.5 text-[1.45rem] font-extrabold text-white leading-tight sm:text-3xl">
              Shop from India,<br />
              <span className="text-amber-400">Delivered to Bhutan</span>
            </h2>

            {/* Subtext */}
            <p className="mt-2 max-w-[270px] text-xs leading-5 text-white/85">
              We shop from Amazon, Flipkart, Myntra, and Meesho. Large appliances excluded. We order and deliver to Thimphu, Paro and Chhukha.
            </p>
          </div>
        </section>

        {/* ----- Request Quotation CTA ----- */}
        <button
          type="button"
          onClick={() => navigate('/paste-link')}
          className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 text-base font-bold text-white transition-colors hover:bg-orange-600 active:scale-[0.98]"
        >
          <span>Request Quotation</span>
          <ArrowRight size={18} strokeWidth={2.5} />
        </button>

        {/* ----- Quick Actions ----- */}
        <section className="mt-5 bg-white border border-gray-100 rounded-2xl p-3">
          <div className="grid grid-cols-4 gap-1">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => navigate(action.path)}
                  className="group flex flex-col items-center justify-center gap-2 rounded-xl px-1.5 py-3 text-center transition-colors hover:bg-gray-50 active:bg-gray-100"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
                    <Icon size={20} strokeWidth={2} />
                  </span>
                  <span className="text-[11px] font-semibold text-gray-700">{action.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ----- Active Order / Parcel Card ----- */}
        <ContinueTrackingCard
          update={activeUpdate}
          loading={activeUpdateLoading}
          isGuest={isGuest}
          onNavigate={(path) => navigate(path)}
        />

        {/* ----- Footer Note ----- */}
        <p className="mt-6 px-2 text-center text-[0.65rem] leading-relaxed text-gray-400">
          Orders accepted from all 20 dzongkhags. Delivery currently available in Thimphu, Paro, and Phuntsholing/Chhukha.
        </p>
      </main>

      {locationSheetOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-end bg-black/35 px-3 pb-[calc(5.75rem+env(safe-area-inset-bottom))] pt-6"
          role="dialog"
          aria-modal="true"
          onClick={() => setLocationSheetOpen(false)}
        >
          <div
            className="mx-auto max-h-[calc(100vh-8rem)] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-orange-500">
                  Delivery Location
                </p>
                <h3 className="mt-1 text-lg font-extrabold text-gray-900">
                  {deliveryLabel ? 'Your current location' : 'Choose your location'}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setLocationSheetOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-50 text-gray-500 active:bg-gray-100"
                aria-label="Close location selector"
              >
                <X size={17} />
              </button>
            </div>

            {deliveryLabel ? (
              <div className="mt-4 rounded-2xl border border-orange-100 bg-orange-50 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-orange-500 shadow-sm">
                    <MapPin size={18} />
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
              <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-orange-500 shadow-sm">
                    <MapPin size={18} />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-gray-900">
                      No location selected yet
                    </p>
                    <p className="mt-0.5 text-xs leading-5 text-gray-600">
                      Select your dzongkhag during registration or update it from your profile.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-xs font-bold text-blue-900">
                Orders accepted from all 20 dzongkhags.
              </p>
              <p className="mt-1 text-xs leading-5 text-blue-700">
                Delivery/pickup is currently available in Thimphu, Paro, and Phuentsholing/Chhukha.
              </p>
            </div>

            <div className="mt-4 grid gap-2">
              {isRealCustomer ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setLocationSheetOpen(false);
                      navigate('/profile');
                    }}
                    className="h-12 rounded-2xl bg-orange-500 px-4 text-sm font-bold text-white active:scale-[0.98]"
                  >
                    Change registered dzongkhag
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLocationSheetOpen(false);
                      navigate('/addresses');
                    }}
                    className="h-12 rounded-2xl border border-gray-100 bg-white px-4 text-sm font-bold text-gray-800 active:bg-gray-50"
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
                    className="h-12 rounded-2xl bg-orange-500 px-4 text-sm font-bold text-white active:scale-[0.98]"
                  >
                    Register and select dzongkhag
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLocationSheetOpen(false);
                      navigate('/login');
                    }}
                    className="h-12 rounded-2xl border border-gray-100 bg-white px-4 text-sm font-bold text-gray-800 active:bg-gray-50"
                  >
                    I already have an account
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => setLocationSheetOpen(false)}
                className="h-11 rounded-2xl bg-gray-50 px-4 text-sm font-semibold text-gray-500 active:bg-gray-100"
              >
                Continue browsing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
