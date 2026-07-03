import { useCallback, useEffect, useMemo, useState, type ElementType } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock3, FileText, ListChecks, Package, RefreshCw, SlidersHorizontal, Truck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import OrderCard from '@/components/shared/OrderCard';
import EmptyState from '@/components/shared/EmptyState';
import { fetchCustomerOrders } from '@/lib/customerOrders';
import type { Order } from '@/types';

type FilterTab = 'all' | 'pending' | 'quoted' | 'in_transit' | 'delivered';

const tabs: { key: FilterTab; label: string; shortLabel: string; icon: ElementType }[] = [
  { key: 'all', label: 'All', shortLabel: 'All', icon: ListChecks },
  { key: 'pending', label: 'Pending', shortLabel: 'Pending', icon: Clock3 },
  { key: 'quoted', label: 'Quoted', shortLabel: 'Quoted', icon: FileText },
  { key: 'in_transit', label: 'In Transit', shortLabel: 'Transit', icon: Truck },
  { key: 'delivered', label: 'Delivered', shortLabel: 'Delivered', icon: CheckCircle2 },
];

function tabMatches(order: Order, tab: FilterTab) {
  if (tab === 'all') return true;
  if (tab === 'pending') return ['pending_confirmation', 'quotation_pending', 'payment_pending'].includes(order.status);
  if (tab === 'quoted') return order.status === 'quoted';
  if (tab === 'in_transit') return ['order_placed', 'in_transit', 'arrived_at_hub', 'out_for_delivery'].includes(order.status);
  if (tab === 'delivered') return order.status === 'delivered';
  return true;
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

    setLoading(true);
    setError('');

    try {
      const realOrders = await fetchCustomerOrders(user.id, user.email ?? '');
      setOrders(realOrders);
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

  const counts = useMemo(() => {
    return tabs.reduce(
      (acc, tab) => ({ ...acc, [tab.key]: orders.filter((order) => tabMatches(order, tab.key)).length }),
      {} as Record<FilterTab, number>
    );
  }, [orders]);

  const filteredOrders = useMemo(() => orders.filter((order) => tabMatches(order, activeTab)), [activeTab, orders]);

  if (!authLoading && !user) {
    return (
      <div className="min-h-screen bg-neutral-50 px-4 py-8">
        <EmptyState
          icon={<Package size={40} className="text-neutral-300" />}
          title="Sign in to view orders"
          description="Your Shop2Bhutan orders, quotations, and tracking updates will appear here."
          action={{ label: 'Sign In', onClick: () => navigate('/login') }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="sticky top-0 z-30 border-b border-neutral-100 bg-white/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-950">My Orders</h1>
              <p className="mt-1 text-xs leading-5 text-neutral-500">Review quotations, payments, and delivery tracking.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadOrders}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-50 text-neutral-700 transition-colors hover:bg-neutral-100"
                aria-label="Refresh orders"
              >
                <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
              </button>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-50 text-neutral-700 transition-colors hover:bg-neutral-100"
                aria-label="Filter orders"
              >
                <SlidersHorizontal size={17} />
              </button>
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 pr-2 scrollbar-hide">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              const Icon = tab.icon;
              const count = counts[tab.key] || 0;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex flex-shrink-0 items-center gap-2 rounded-2xl px-3.5 py-2.5 text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-gray-950 text-white shadow-sm'
                      : tab.key === 'quoted' && count > 0
                        ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-100 hover:bg-amber-100'
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  <Icon size={15} strokeWidth={isActive ? 2.4 : 1.9} />
                  <span>{tab.shortLabel}</span>
                  <span
                    className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-black ${
                      isActive ? 'bg-white text-gray-950' : 'bg-white/90 text-neutral-500'
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
              <div key={item} className="h-40 animate-pulse rounded-2xl bg-white shadow-sm" />
            ))}
          </div>
        ) : filteredOrders.length > 0 ? (
          <div className="space-y-3">
            {filteredOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Package size={40} className="text-neutral-300" />}
            title={`No ${activeTab === 'all' ? '' : activeTab.replace('_', ' ')} orders`}
            description="Orders will appear here once you request a quotation."
            action={{ label: 'Request Product', onClick: () => navigate('/paste-link') }}
          />
        )}
      </main>
    </div>
  );
}
