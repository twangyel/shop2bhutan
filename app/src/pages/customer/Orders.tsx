import { useCallback, useEffect, useMemo, useRef, useState, type ElementType } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  ListChecks,
  Package,
  RefreshCw,
  SlidersHorizontal,
  Truck,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import { fetchCustomerOrdersSummary } from '@/lib/customerOrders';
import type { Order, OrderItem } from '@/types';

type FilterTab = 'all' | 'pending' | 'quoted' | 'in_transit' | 'delivered';

const tabs: { key: FilterTab; label: string; shortLabel: string; icon: ElementType }[] = [
  { key: 'all', label: 'All', shortLabel: 'All', icon: ListChecks },
  { key: 'pending', label: 'Pending', shortLabel: 'Pending', icon: Clock3 },
  { key: 'quoted', label: 'Quoted', shortLabel: 'Quoted', icon: FileText },
  { key: 'in_transit', label: 'In Transit', shortLabel: 'Transit', icon: Truck },
  { key: 'delivered', label: 'Delivered', shortLabel: 'Delivered', icon: CheckCircle2 },
];

const ORDERS_CACHE_PREFIX = 'shop2bhutan:orders:';

function ordersCacheKey(userId: string) {
  return `${ORDERS_CACHE_PREFIX}${userId}`;
}

function readCachedOrders(userId: string): Order[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.sessionStorage.getItem(ordersCacheKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Order[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCachedOrders(userId: string, value: Order[]) {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(ordersCacheKey(userId), JSON.stringify(value));
  } catch {
    // Storage can be unavailable in private mode. Ignore silently.
  }
}


function tabMatches(order: Order, tab: FilterTab) {
  if (tab === 'all') return true;
  if (tab === 'pending') return ['pending_confirmation', 'quotation_pending', 'payment_pending'].includes(order.status);
  if (tab === 'quoted') return order.status === 'quoted';
  if (tab === 'in_transit') return ['order_placed', 'in_transit', 'arrived_at_hub', 'out_for_delivery'].includes(order.status);
  if (tab === 'delivered') return order.status === 'delivered';
  return true;
}

function money(value?: number) {
  return `Nu. ${Number(value ?? 0).toLocaleString()}`;
}

function itemCount(order: Order) {
  return order.items.reduce((total, item) => total + Math.max(1, Number(item.quantity) || 1), 0);
}

function estimatedTotal(order: Order) {
  if (order.quotation?.totalAmount) return order.quotation.totalAmount;

  return order.items.reduce((total, item) => {
    const quantity = Math.max(1, Number(item.quantity) || 1);
    return total + Number(item.unitPrice || 0) * quantity;
  }, 0);
}

function fallbackImage() {
  return (
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="18" fill="#f5f5f5"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="15" fill="#a3a3a3">S2B</text></svg>`
    )
  );
}

function primaryItem(order: Order): OrderItem {
  return (
    order.items[0] ?? {
      id: `fallback-${order.id}`,
      productName: 'Shop2Bhutan order',
      productImage: fallbackImage(),
      quantity: 1,
      unitPrice: 0,
      attributes: {},
    }
  );
}

function timeAgo(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  const time = date.getTime();
  if (Number.isNaN(time)) return '';

  const diffMs = Date.now() - time;
  const minutes = Math.max(1, Math.round(diffMs / 60000));

  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function actionHint(order: Order) {
  if (order.status === 'quoted') return 'Quotation ready for review';
  if (order.status === 'payment_pending') return order.payment?.status === 'pending' ? 'Payment proof under review' : 'Payment upload pending';
  if (order.status === 'delivered') return 'Delivered successfully';
  return 'Track status and order details';
}

function CustomerOrderCard({ order }: { order: Order }) {
  const navigate = useNavigate();
  const item = primaryItem(order);
  const count = itemCount(order);
  const total = estimatedTotal(order);
  const hasTotal = total > 0;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/order/${order.id}`)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          navigate(`/order/${order.id}`);
        }
      }}
      className="cursor-pointer rounded-2xl bg-white p-4 border border-gray-100 transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-orange-500/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold text-gray-400">#{order.orderNumber}</p>
          <h3 className="mt-1 line-clamp-1 text-sm font-bold text-gray-900">{item.productName}</h3>
          {timeAgo(order.createdAt) && <p className="mt-0.5 text-[11px] text-gray-500">{timeAgo(order.createdAt)}</p>}
        </div>
        <div className="shrink-0">
          <StatusBadge status={order.status} />
        </div>
      </div>

      <div className="mt-3 flex gap-3">
        <img
          src={item.productImage || fallbackImage()}
          alt=""
          className="h-16 w-16 flex-shrink-0 rounded-2xl bg-gray-50 object-cover border border-gray-100"
          loading="lazy"
        />

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            {item.sourcePlatform && (
              <span className="rounded-full bg-gray-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-gray-600 border border-gray-100">
                {item.sourcePlatform}
              </span>
            )}
            <span className="text-[11px] font-medium text-gray-500">
              {count} {count === 1 ? 'item' : 'items'}
            </span>
          </div>

          <p className="text-xs font-semibold text-gray-500">Estimated total</p>
          <p className={`leading-tight tracking-tight ${hasTotal ? 'text-lg font-bold text-gray-900' : 'text-sm font-medium italic text-gray-400'}`}>
            {hasTotal ? money(total) : 'To be quoted'}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-gray-900">{actionHint(order)}</p>
        </div>
        <div className="ml-3 flex shrink-0 items-center gap-1 text-xs font-bold text-orange-500">
          View Details
          <ChevronRight size={14} strokeWidth={2.5} />
        </div>
      </div>
    </article>
  );
}

export default function Orders() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0 });
  const tabBarRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const loadOrders = useCallback(async () => {
    if (!user) {
      setOrders([]);
      setLoading(false);
      return;
    }

    const cachedOrders = readCachedOrders(user.id);
    if (cachedOrders.length > 0) {
      setOrders(cachedOrders);
      setLoading(false);
    } else {
      setLoading(true);
    }

    setError('');

    try {
      const realOrders = await fetchCustomerOrdersSummary(user.id, user.email ?? '');
      setOrders(realOrders);
      writeCachedOrders(user.id, realOrders);
    } catch (err) {
      console.error('Failed to load customer orders:', err);
      setError(err instanceof Error ? err.message : 'Unable to load your orders.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      void loadOrders();
    }
  }, [authLoading, loadOrders]);

  useEffect(() => {
    const activeBtn = tabRefs.current[activeTab];
    if (activeBtn && tabBarRef.current) {
      setPillStyle({
        left: activeBtn.offsetLeft,
        width: activeBtn.offsetWidth,
      });
    }
  }, [activeTab]);

  const counts = useMemo(() => {
    return tabs.reduce(
      (acc, tab) => ({ ...acc, [tab.key]: orders.filter((order) => tabMatches(order, tab.key)).length }),
      {} as Record<FilterTab, number>
    );
  }, [orders]);

  const filteredOrders = useMemo(() => orders.filter((order) => tabMatches(order, activeTab)), [activeTab, orders]);

  if (!authLoading && !user) {
    return (
      <div className="min-h-screen bg-white px-4 py-8">
        <EmptyState
          icon={<Package size={40} className="text-gray-300" />}
          title="Sign in to view orders"
          description="Your Shop2Bhutan orders, quotations, and tracking updates will appear here."
          action={{ label: 'Sign In', onClick: () => navigate('/login') }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-30 border-b border-gray-100 bg-white px-4 py-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-900">My Orders</h1>
              <p className="mt-1 text-xs leading-5 text-gray-500">Review quotations, payments, and delivery tracking.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadOrders}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-50 text-gray-700 transition-colors hover:bg-gray-100"
                aria-label="Refresh orders"
              >
                <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
              </button>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-50 text-gray-700 transition-colors hover:bg-gray-100"
                aria-label="Filter orders"
              >
                <SlidersHorizontal size={17} />
              </button>
            </div>
          </div>

          <div
            ref={tabBarRef}
            className="relative mt-3 flex gap-1 overflow-x-auto rounded-2xl bg-gray-100 p-1 scrollbar-hide"
          >
            {/* Sliding pill background */}
            <div
              className="absolute top-1 h-[calc(100%-8px)] rounded-xl bg-orange-500 shadow-sm transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
              style={{
                left: pillStyle.left,
                width: pillStyle.width,
              }}
            />
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              const Icon = tab.icon;
              const count = counts[tab.key] || 0;
              return (
                <button
                  key={tab.key}
                  ref={(el) => { tabRefs.current[tab.key] = el; }}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`relative z-10 flex flex-shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold transition-colors duration-200 ${
                    isActive ? 'text-white' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon size={13} strokeWidth={isActive ? 2.4 : 1.9} />
                  <span>{tab.shortLabel}</span>
                  <span
                    className={`flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold transition-colors duration-200 ${
                      isActive ? 'bg-white/20 text-white' : 'bg-gray-200/80 text-gray-500'
                    }`}
                  >
                    {count > 99 ? '99+' : count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4">
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-40 animate-pulse rounded-2xl bg-gray-100" />
            ))}
          </div>
        ) : filteredOrders.length > 0 ? (
          <div className="space-y-3">
            {filteredOrders.map((order) => (
              <CustomerOrderCard key={order.id} order={order} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Package size={40} className="text-gray-300" />}
            title={`No ${activeTab === 'all' ? '' : activeTab.replace('_', ' ')} orders`}
            description="Orders will appear here once you request a quotation."
            action={{ label: 'Request Product', onClick: () => navigate('/paste-link') }}
          />
        )}
      </main>
    </div>
  );
}