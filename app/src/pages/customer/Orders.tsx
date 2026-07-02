import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import OrderCard from '@/components/shared/OrderCard';
import EmptyState from '@/components/shared/EmptyState';
import { fetchCustomerOrders } from '@/lib/customerOrders';
import type { Order } from '@/types';

type FilterTab = 'all' | 'pending' | 'quoted' | 'in_transit' | 'delivered';

const tabs: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'quoted', label: 'Quoted' },
  { key: 'in_transit', label: 'In Transit' },
  { key: 'delivered', label: 'Delivered' },
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
            <div>
              <h1 className="text-xl font-bold text-gray-900">My Orders</h1>
              <p className="mt-1 text-xs text-neutral-500">Review quotations, payment status, and delivery tracking.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadOrders}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-50 ring-1 ring-neutral-200 transition-colors hover:bg-neutral-100"
                aria-label="Refresh orders"
              >
                <RefreshCw size={18} className={`text-neutral-700 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-50 ring-1 ring-neutral-200 transition-colors hover:bg-neutral-100"
                aria-label="Filter orders"
              >
                <SlidersHorizontal size={18} className="text-neutral-700" />
              </button>
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex flex-shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    isActive ? 'bg-amber-500 text-white shadow-sm' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  {tab.label}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${isActive ? 'bg-white/20 text-white' : 'bg-white text-neutral-500'}`}>
                    {counts[tab.key] || 0}
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
              <div key={item} className="h-40 rounded-2xl bg-white shadow-sm animate-pulse" />
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
