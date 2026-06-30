import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SlidersHorizontal, Package } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import OrderCard from '@/components/shared/OrderCard';
import EmptyState from '@/components/shared/EmptyState';

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
  const { orders } = useApp();
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const filteredOrders = orders.filter(o => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return ['pending_confirmation', 'quotation_pending', 'payment_pending'].includes(o.status);
    if (activeTab === 'quoted') return o.status === 'quoted';
    if (activeTab === 'in_transit') return ['order_placed', 'in_transit', 'arrived_at_hub', 'out_for_delivery'].includes(o.status);
    if (activeTab === 'delivered') return o.status === 'delivered';
    return true;
  });

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="px-4 py-4 bg-white border-b border-neutral-200">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">My Orders</h1>
          <button className="p-2">
            <SlidersHorizontal size={20} className="text-neutral-600" />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="sticky top-0 z-30 bg-white border-b border-neutral-100 px-4 py-2">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {tabs.map(tab => (
            <button
              key={tab.key}
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
        {filteredOrders.length > 0 ? (
          filteredOrders.map(order => (
            <OrderCard key={order.id} order={order} />
          ))
        ) : (
          <EmptyState
            icon={<Package size={40} className="text-neutral-300" />}
            title={`No ${activeTab === 'all' ? '' : activeTab.replace('_', ' ')} orders`}
            description="Orders will appear here once you place them"
            action={{ label: 'Start Shopping', onClick: () => navigate('/catalog') }}
          />
        )}
      </div>
    </div>
  );
}
