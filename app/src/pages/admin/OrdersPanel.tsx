import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { orders } from '@/data/mockData';
import StatusBadge from '@/components/shared/StatusBadge';

const statusFilters = ['All', 'Pending', 'Quoted', 'In Transit', 'Delivered', 'Cancelled'];

export default function OrdersPanel() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);

  const filteredOrders = orders.filter(o => {
    const matchesSearch = !searchQuery ||
      o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.user.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All' ||
      (statusFilter === 'Pending' && ['pending_confirmation', 'quotation_pending', 'payment_pending'].includes(o.status)) ||
      (statusFilter === 'Quoted' && o.status === 'quoted') ||
      (statusFilter === 'In Transit' && ['order_placed', 'in_transit', 'arrived_at_hub', 'out_for_delivery'].includes(o.status)) ||
      (statusFilter === 'Delivered' && o.status === 'delivered') ||
      (statusFilter === 'Cancelled' && o.status === 'cancelled');
    return matchesSearch && matchesStatus;
  });

  const pageSize = 10;
  const totalPages = Math.ceil(filteredOrders.length / pageSize);
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="bg-white rounded-xl p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search orders..."
              className="w-full h-9 pl-9 pr-4 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
          <div className="flex gap-1">
            {statusFilters.map(status => (
              <button
                key={status}
                onClick={() => { setStatusFilter(status); setCurrentPage(1); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  statusFilter === status ? 'bg-amber-500 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Order #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Dzongkhag</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Items</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Total</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {paginatedOrders.map(order => (
                <tr
                  key={order.id}
                  className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/admin/orders/${order.id}`)}
                >
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">#{order.orderNumber}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600">{order.user.name}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600">{order.shippingAddress.dzongkhag}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600">{order.items.length}</td>
                  <td className="px-4 py-3 text-sm font-medium">Nu. {order.quotation?.totalAmount?.toLocaleString() || '-'}</td>
                  <td className="px-4 py-3"><StatusBadge status={order.status} size="sm" /></td>
                  <td className="px-4 py-3 text-sm text-neutral-500">{new Date(order.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/admin/orders/${order.id}`); }}
                      className="p-1.5 text-neutral-400 hover:text-amber-600 transition-colors"
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-100">
          <p className="text-xs text-neutral-500">
            Showing {Math.min((currentPage - 1) * pageSize + 1, filteredOrders.length)}-{Math.min(currentPage * pageSize, filteredOrders.length)} of {filteredOrders.length}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg bg-neutral-100 text-neutral-600 disabled:opacity-50 hover:bg-neutral-200 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg bg-neutral-100 text-neutral-600 disabled:opacity-50 hover:bg-neutral-200 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
