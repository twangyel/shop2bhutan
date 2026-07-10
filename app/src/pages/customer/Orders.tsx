import { useCallback, useEffect, useMemo, useState, type ElementType } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  ListChecks,
  Package,
  RefreshCw,
  ShoppingBag,
  Truck,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchCustomerOrdersSummary } from '@/lib/customerOrders';
import type { Order, OrderItem } from '@/types';

type FilterTab = 'all' | 'pending' | 'quoted' | 'in_transit' | 'delivered';

type StageTone = {
  label: string;
  pill: string;
  bar: string;
  iconBg: string;
  iconText: string;
};

const tabs: { key: FilterTab; label: string; shortLabel: string; icon: ElementType }[] = [
  { key: 'all', label: 'All orders', shortLabel: 'All', icon: ListChecks },
  { key: 'pending', label: 'Pending', shortLabel: 'Pending', icon: Clock3 },
  { key: 'quoted', label: 'Quoted', shortLabel: 'Quoted', icon: FileText },
  { key: 'in_transit', label: 'In transit', shortLabel: 'Transit', icon: Truck },
  { key: 'delivered', label: 'Delivered', shortLabel: 'Delivered', icon: CheckCircle2 },
];

const ORDER_PROGRESS = [
  'pending_confirmation',
  'quotation_pending',
  'quoted',
  'payment_pending',
  'payment_verified',
  'order_placed',
  'in_transit',
  'arrived_at_hub',
  'out_for_delivery',
  'delivered',
] as const;

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
  if (tab === 'pending') {
    return ['pending_confirmation', 'quotation_pending', 'payment_pending'].includes(order.status);
  }
  if (tab === 'quoted') return order.status === 'quoted';
  if (tab === 'in_transit') {
    return ['payment_verified', 'order_placed', 'in_transit', 'arrived_at_hub', 'out_for_delivery'].includes(
      order.status,
    );
  }
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
      `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180"><rect width="180" height="180" rx="28" fill="#f8fafc"/><rect x="40" y="42" width="100" height="96" rx="24" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/><path d="M67 76h46M67 92h34M67 108h40" stroke="#cbd5e1" stroke-width="7" stroke-linecap="round"/><text x="90" y="157" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="15" font-weight="700" fill="#94a3b8">S2B</text></svg>`,
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

function readableDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Thimphu',
  }).format(date);
}

function stageTone(order: Order): StageTone {
  const status = order.status;

  if (status === 'delivered') {
    return {
      label: 'Delivered',
      pill: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
      bar: 'bg-emerald-500',
      iconBg: 'bg-emerald-50',
      iconText: 'text-emerald-600',
    };
  }

  if (status === 'cancelled') {
    return {
      label: 'Cancelled',
      pill: 'bg-red-50 text-red-700 ring-red-100',
      bar: 'bg-red-500',
      iconBg: 'bg-red-50',
      iconText: 'text-red-600',
    };
  }

  if (status === 'quoted') {
    return {
      label: 'Quotation ready',
      pill: 'bg-violet-50 text-violet-700 ring-violet-100',
      bar: 'bg-violet-500',
      iconBg: 'bg-violet-50',
      iconText: 'text-violet-600',
    };
  }

  if (status === 'payment_pending') {
    const paymentStatus = order.payment?.status;
    return {
      label:
        paymentStatus === 'pending'
          ? 'Payment under review'
          : paymentStatus === 'rejected'
            ? 'Payment rejected'
            : 'Payment pending',
      pill:
        paymentStatus === 'rejected'
          ? 'bg-red-50 text-red-700 ring-red-100'
          : 'bg-orange-50 text-orange-700 ring-orange-100',
      bar: paymentStatus === 'rejected' ? 'bg-red-500' : 'bg-orange-500',
      iconBg: paymentStatus === 'rejected' ? 'bg-red-50' : 'bg-orange-50',
      iconText: paymentStatus === 'rejected' ? 'text-red-600' : 'text-orange-600',
    };
  }

  if (['payment_verified', 'order_placed', 'in_transit', 'arrived_at_hub', 'out_for_delivery'].includes(status)) {
    const labels: Record<string, string> = {
      payment_verified: 'Payment verified',
      order_placed: 'Order placed',
      in_transit: 'In transit',
      arrived_at_hub: 'Arrived at hub',
      out_for_delivery: 'Out for delivery',
    };

    return {
      label: labels[status] ?? 'In progress',
      pill: 'bg-blue-50 text-blue-700 ring-blue-100',
      bar: 'bg-blue-500',
      iconBg: 'bg-blue-50',
      iconText: 'text-blue-600',
    };
  }

  return {
    label: status === 'quotation_pending' ? 'Preparing quotation' : 'Request received',
    pill: 'bg-amber-50 text-amber-700 ring-amber-100',
    bar: 'bg-amber-500',
    iconBg: 'bg-amber-50',
    iconText: 'text-amber-600',
  };
}

function progressPercent(order: Order) {
  if (order.status === 'cancelled') return 100;
  const index = ORDER_PROGRESS.indexOf(order.status as (typeof ORDER_PROGRESS)[number]);
  if (index < 0) return 10;
  return Math.max(10, Math.round(((index + 1) / ORDER_PROGRESS.length) * 100));
}

function actionText(order: Order) {
  if (order.status === 'quoted') return 'Review quotation';
  if (order.status === 'payment_pending') {
    if (order.payment?.status === 'pending') return 'View payment status';
    if (order.payment?.status === 'rejected') return 'Upload corrected proof';
    return 'Continue payment';
  }
  if (order.status === 'delivered') return 'View completed order';
  if (order.status === 'cancelled') return 'View order details';
  if (['pending_confirmation', 'quotation_pending'].includes(order.status)) return 'View request';
  return 'Track order';
}

function statusDescription(order: Order) {
  if (order.status === 'pending_confirmation') return 'Your quotation request has been received.';
  if (order.status === 'quotation_pending') return 'Shop2Bhutan is checking your products and delivery area.';
  if (order.status === 'quoted') return 'Your final quotation is ready for review.';
  if (order.status === 'payment_pending') {
    if (order.payment?.status === 'pending') return 'Your payment proof is being verified.';
    if (order.payment?.status === 'rejected') return 'Please upload a corrected payment screenshot.';
    return 'Approve the quotation and submit your payment proof.';
  }
  if (order.status === 'payment_verified') return 'Payment is verified. Seller ordering will begin shortly.';
  if (order.status === 'order_placed') return 'Your products have been ordered from the seller.';
  if (order.status === 'in_transit') return 'Your order is on the way to Bhutan.';
  if (order.status === 'arrived_at_hub') return 'Your order has reached the delivery hub.';
  if (order.status === 'out_for_delivery') return 'Your order is on its final delivery journey.';
  if (order.status === 'delivered') return 'Your order was delivered successfully.';
  if (order.status === 'cancelled') return 'This order is no longer active.';
  return 'Open the order to view its latest update.';
}

function amountLabel(order: Order) {
  if (order.quotation?.totalAmount) return 'Quotation total';
  if (estimatedTotal(order) > 0) return 'Site estimate';
  return 'Final amount';
}

function needsCustomerAction(order: Order) {
  if (order.status === 'quoted') return true;
  if (order.status !== 'payment_pending') return false;
  return order.payment?.status !== 'pending';
}

function CustomerOrderCard({ order }: { order: Order }) {
  const navigate = useNavigate();
  const item = primaryItem(order);
  const count = itemCount(order);
  const total = estimatedTotal(order);
  const tone = stageTone(order);
  const progress = progressPercent(order);
  const extraItems = Math.max(0, order.items.length - 1);

  return (
    <button
      type="button"
      onClick={() => navigate(`/order/${order.id}`)}
      className="group w-full overflow-hidden rounded-[26px] border border-slate-100 bg-white text-left shadow-[0_8px_28px_rgba(15,23,42,0.04)] transition duration-200 active:scale-[0.985] active:bg-slate-50/60"
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-extrabold ring-1 ${tone.pill}`}>
                {tone.label}
              </span>
              {needsCustomerAction(order) && (
                <span className="inline-flex rounded-full bg-orange-500 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow-sm shadow-orange-500/20">
                  Action needed
                </span>
              )}
            </div>
            <p className="mt-2 truncate text-[12px] font-bold text-slate-400">Order #{order.orderNumber}</p>
          </div>

          <span className="shrink-0 text-[11px] font-semibold text-slate-400">{readableDate(order.createdAt)}</span>
        </div>

        <div className="mt-4 flex gap-3.5">
          <div className="relative shrink-0">
            <img
              src={item.productImage || fallbackImage()}
              alt=""
              className="h-[86px] w-[86px] rounded-[22px] border border-slate-100 bg-slate-50 object-cover"
              loading="lazy"
            />
            {extraItems > 0 && (
              <span className="absolute -bottom-1.5 -right-1.5 flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-white bg-slate-900 px-1.5 text-[10px] font-black text-white shadow-sm">
                +{extraItems}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="line-clamp-2 text-[16px] font-black leading-5 text-slate-950">
              {item.productName || 'Shop2Bhutan order'}
            </h2>

            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-semibold text-slate-500">
              <span>{count} {count === 1 ? 'item' : 'items'}</span>
              {item.sourcePlatform && (
                <>
                  <span className="h-1 w-1 rounded-full bg-slate-300" />
                  <span className="capitalize">{item.sourcePlatform}</span>
                </>
              )}
            </div>

            <div className="mt-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{amountLabel(order)}</p>
              <p className={`mt-0.5 tracking-tight ${total > 0 ? 'text-[20px] font-black text-slate-950' : 'text-[15px] font-bold text-slate-400'}`}>
                {total > 0 ? money(total) : 'To be quoted'}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-slate-50 px-3.5 py-3">
          <div className="flex items-start gap-3">
            <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone.iconBg} ${tone.iconText}`}>
              {order.status === 'delivered' ? (
                <CheckCircle2 size={18} strokeWidth={2.4} />
              ) : order.status === 'in_transit' || order.status === 'out_for_delivery' ? (
                <Truck size={18} strokeWidth={2.3} />
              ) : order.status === 'quoted' ? (
                <FileText size={18} strokeWidth={2.3} />
              ) : (
                <Package size={18} strokeWidth={2.3} />
              )}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[13px] font-extrabold text-slate-900">Latest update</p>
                <span className="text-[11px] font-bold text-slate-400">{progress}%</span>
              </div>
              <p className="mt-1 text-[12px] leading-5 text-slate-500">{statusDescription(order)}</p>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white ring-1 ring-slate-100">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${tone.bar}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-h-[50px] items-center justify-between border-t border-slate-100 px-4 py-3">
        <span className="text-[13px] font-extrabold text-slate-900">{actionText(order)}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-50 text-orange-600 transition group-active:translate-x-0.5">
          <ChevronRight size={17} strokeWidth={2.6} />
        </span>
      </div>
    </button>
  );
}

function OrdersSkeleton() {
  return (
    <div className="space-y-3.5">
      {[1, 2, 3].map((item) => (
        <div key={item} className="rounded-[26px] border border-slate-100 bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="h-7 w-32 animate-pulse rounded-full bg-slate-100" />
            <div className="h-3 w-16 animate-pulse rounded-full bg-slate-100" />
          </div>
          <div className="mt-4 flex gap-3.5">
            <div className="h-[86px] w-[86px] animate-pulse rounded-[22px] bg-slate-100" />
            <div className="flex-1">
              <div className="h-4 w-4/5 animate-pulse rounded-full bg-slate-100" />
              <div className="mt-2 h-3 w-1/2 animate-pulse rounded-full bg-slate-100" />
              <div className="mt-4 h-6 w-28 animate-pulse rounded-full bg-slate-100" />
            </div>
          </div>
          <div className="mt-4 h-24 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

function EmptyOrders({ activeTab, onAdd }: { activeTab: FilterTab; onAdd: () => void }) {
  const title = activeTab === 'all' ? 'No orders yet' : `No ${tabs.find((tab) => tab.key === activeTab)?.label.toLowerCase() ?? ''}`;

  return (
    <section className="rounded-[28px] border border-slate-100 bg-white px-6 py-10 text-center shadow-[0_8px_28px_rgba(15,23,42,0.04)]">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-orange-50 text-orange-500 ring-1 ring-orange-100">
        <ShoppingBag size={29} strokeWidth={2.1} />
      </div>
      <h2 className="mt-5 text-xl font-black tracking-tight text-slate-950">{title}</h2>
      <p className="mx-auto mt-2 max-w-xs text-[14px] leading-6 text-slate-500">
        Product requests, quotations, payment updates, and delivery tracking will appear here.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-6 inline-flex h-12 items-center justify-center rounded-2xl bg-orange-500 px-6 text-[14px] font-extrabold text-white shadow-lg shadow-orange-500/20 transition active:scale-[0.98] active:bg-orange-600"
      >
        Add a product
      </button>
    </section>
  );
}

export default function Orders() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

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
    if (!authLoading) void loadOrders();
  }, [authLoading, loadOrders]);

  useEffect(() => {
    const refresh = () => void loadOrders();
    const handleVisibilityChange = () => {
      if (!document.hidden) refresh();
    };

    window.addEventListener('shop2bhutan:orders-updated', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('shop2bhutan:orders-updated', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadOrders]);

  const counts = useMemo(
    () =>
      tabs.reduce(
        (acc, tab) => ({
          ...acc,
          [tab.key]: orders.filter((order) => tabMatches(order, tab.key)).length,
        }),
        {} as Record<FilterTab, number>,
      ),
    [orders],
  );

  const filteredOrders = useMemo(
    () => orders.filter((order) => tabMatches(order, activeTab)),
    [activeTab, orders],
  );

  const activeCount = useMemo(
    () => orders.filter((order) => !['delivered', 'cancelled'].includes(order.status)).length,
    [orders],
  );
  const actionCount = useMemo(() => orders.filter(needsCustomerAction).length, [orders]);
  const completedCount = useMemo(
    () => orders.filter((order) => order.status === 'delivered').length,
    [orders],
  );

  if (!authLoading && !user) {
    return (
      <div className="min-h-screen bg-white px-4 py-10">
        <section className="mx-auto max-w-md rounded-[28px] border border-slate-100 bg-white px-6 py-10 text-center shadow-[0_8px_28px_rgba(15,23,42,0.04)]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-orange-50 text-orange-500 ring-1 ring-orange-100">
            <Package size={29} strokeWidth={2.1} />
          </div>
          <h1 className="mt-5 text-xl font-black text-slate-950">Sign in to view orders</h1>
          <p className="mt-2 text-[14px] leading-6 text-slate-500">
            Your quotations, payments, and delivery tracking are securely linked to your account.
          </p>
          <button
            type="button"
            onClick={() => navigate('/login', { state: { from: '/orders' } })}
            className="mt-6 h-12 w-full rounded-2xl bg-orange-500 text-[14px] font-extrabold text-white shadow-lg shadow-orange-500/20 transition active:scale-[0.98]"
          >
            Sign in
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.8rem)] backdrop-blur-xl">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-orange-500">Shopping activity</p>
              <h1 className="mt-1 text-[24px] font-black tracking-tight text-slate-950">My Orders</h1>
              <p className="mt-1 text-[13px] leading-5 text-slate-500">Track quotations, payments, and delivery.</p>
            </div>

            <button
              type="button"
              onClick={() => void loadOrders()}
              disabled={loading}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-600 ring-1 ring-slate-100 transition active:scale-95 active:bg-slate-100 disabled:opacity-60"
              aria-label="Refresh orders"
            >
              <RefreshCw size={18} strokeWidth={2.2} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 divide-x divide-slate-100 rounded-2xl border border-slate-100 bg-white py-3 shadow-[0_6px_18px_rgba(15,23,42,0.03)]">
            <div className="px-3 text-center">
              <p className="text-[20px] font-black text-slate-950">{activeCount}</p>
              <p className="mt-0.5 text-[11px] font-bold text-slate-400">Active</p>
            </div>
            <div className="px-3 text-center">
              <p className={`text-[20px] font-black ${actionCount > 0 ? 'text-orange-600' : 'text-slate-950'}`}>{actionCount}</p>
              <p className="mt-0.5 text-[11px] font-bold text-slate-400">Action</p>
            </div>
            <div className="px-3 text-center">
              <p className="text-[20px] font-black text-slate-950">{completedCount}</p>
              <p className="mt-0.5 text-[11px] font-bold text-slate-400">Delivered</p>
            </div>
          </div>

          <div className="scrollbar-hide -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-0.5">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              const Icon = tab.icon;
              const count = counts[tab.key] || 0;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  aria-label={tab.label}
                  className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[12px] font-extrabold ring-1 transition active:scale-[0.97] ${
                    isActive
                      ? 'bg-orange-500 text-white ring-orange-500 shadow-sm shadow-orange-500/20'
                      : 'bg-white text-slate-600 ring-slate-200 active:bg-slate-50'
                  }`}
                >
                  <Icon size={14} strokeWidth={isActive ? 2.6 : 2.1} />
                  <span>{tab.shortLabel}</span>
                  <span
                    className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-black ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
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
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium leading-5 text-red-700">
            {error}
          </div>
        )}

        {loading && orders.length === 0 ? (
          <OrdersSkeleton />
        ) : filteredOrders.length > 0 ? (
          <div className="space-y-3.5">
            {filteredOrders.map((order) => (
              <CustomerOrderCard key={order.id} order={order} />
            ))}
          </div>
        ) : (
          <EmptyOrders activeTab={activeTab} onAdd={() => navigate('/paste-link')} />
        )}
      </main>
    </div>
  );
}
