import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, SlidersHorizontal, Package } from 'lucide-react';
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
      loadOrders();
    }
  }, [authLoading, loadOrders]);

  const filteredOrders = orders.filter((order) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') {
      return ['pending_confirmation', 'quotation_pending', 'payment_pending'].includes(order.status);
    }
    if (activeTab === 'quoted') return order.status === 'quoted';
    if (activeTab === 'in_transit') {
      return ['order_placed', 'in_transit', 'arrived_at_hub', 'out_for_delivery'].includes(order.status);
    }
    if (activeTab === 'delivered') return order.status === 'delivered';
    return true;
  });

  if (!authLoading && !user) {
    return (
      <div className="min-h-screen bg-neutral-50 px-4 py-8">
        <EmptyState
          icon={<Package size={40} className="text-neutral-300" />}
          title="Sign in to view orders"
          description="Your Shop2Bhutan orders will appear here after you sign in."
          action={{ label: 'Sign In', onClick: () => navigate('/login') }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="px-4 py-4 bg-white border-b border-neutral-200">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">My Orders</h1>
          <div className="flex items-center gap-1">
            <button type="button" onClick={loadOrders} className="p-2" aria-label="Refresh orders">
              <RefreshCw size={19} className={`text-neutral-600 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button type="button" className="p-2" aria-label="Filter orders">
              <SlidersHorizontal size={20} className="text-neutral-600" />
            </button>
          </div>
        </div>
      </div>

      <div className="sticky top-0 z-30 bg-white border-b border-neutral-100 px-4 py-2">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeTab === tab.key ? 'bg-amber-500 text-white' : 'bg-neutral-100 text-neutral-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-32 rounded-xl bg-white animate-pulse" />
            ))}
          </div>
        ) : filteredOrders.length > 0 ? (
          filteredOrders.map((order) => <OrderCard key={order.id} order={order} />)
        ) : (
          <EmptyState
            icon={<Package size={40} className="text-neutral-300" />}
            title={`No ${activeTab === 'all' ? '' : activeTab.replace('_', ' ')} orders`}
            description="Orders will appear here once you place them."
            action={{ label: 'Start Shopping', onClick: () => navigate('/catalog') }}
          />
        )}
      </div>
    </div>
  );
}
