import { useNavigate } from 'react-router-dom';
import type { Order } from '@/types';
import StatusBadge from './StatusBadge';
import { formatDistanceToNow } from 'date-fns';

interface OrderCardProps {
  order: Order;
}

export default function OrderCard({ order }: OrderCardProps) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(`/order/${order.id}`)}
      className="w-full bg-white rounded-xl shadow-card p-4 text-left hover:shadow-lg transition-shadow"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-900">#{order.orderNumber}</span>
        <StatusBadge status={order.status} size="sm" />
      </div>
      <p className="text-xs text-neutral-500 mb-3">
        {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
      </p>

      <div className="flex items-center gap-2 mb-3">
        {order.items.slice(0, 3).map((item, i) => (
          <div
            key={item.id}
            className="w-10 h-10 rounded-lg bg-neutral-100 overflow-hidden border border-neutral-200"
            style={{ marginLeft: i > 0 ? '-8px' : 0, zIndex: 3 - i }}
          >
            <img src={item.productImage} alt="" className="w-full h-full object-cover" />
          </div>
        ))}
        {order.items.length > 3 && (
          <span className="text-xs text-neutral-500 ml-1">+{order.items.length - 3} more</span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-900">
          Nu. {order.quotation?.totalAmount?.toLocaleString() || order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0).toLocaleString()}
        </span>
        <span className="text-sm text-amber-600 font-medium">View Details →</span>
      </div>
    </button>
  );
}
