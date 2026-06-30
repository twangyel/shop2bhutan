import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  FileText,
  CreditCard,
  Package,
  Truck,
  MapPin,
  CheckCircle,
  XCircle,
  ChevronRight,
} from 'lucide-react';
import { appSettings } from '@/data/mockData';
import { useAuth } from '@/contexts/AuthContext';
import StatusBadge from '@/components/shared/StatusBadge';
import TrackingTimeline from '@/components/shared/TrackingTimeline';
import { fetchCustomerOrderById } from '@/lib/customerOrders';
import type { Order } from '@/types';

const statusIcons: Record<string, ReactNode> = {
  pending_confirmation: <Clock size={32} className="text-orange-500" />,
  quotation_pending: <FileText size={32} className="text-amber-500" />,
  quoted: <FileText size={32} className="text-violet-500" />,
  payment_pending: <CreditCard size={32} className="text-orange-500" />,
  payment_verified: <CheckCircle size={32} className="text-blue-500" />,
  order_placed: <Package size={32} className="text-blue-500" />,
  in_transit: <Truck size={32} className="text-blue-500" />,
  arrived_at_hub: <Package size={32} className="text-emerald-500" />,
  out_for_delivery: <MapPin size={32} className="text-emerald-500" />,
  delivered: <CheckCircle size={32} className="text-emerald-500" />,
  cancelled: <XCircle size={32} className="text-red-500" />,
};

function statusMessage(order: Order) {
  if (order.status === 'delivered') return 'Your order has been delivered successfully.';
  if (order.status === 'in_transit') return 'Your order is on its way to you.';
  if (order.status === 'quoted') return 'Review your quotation and proceed with payment.';
  if (order.status === 'payment_pending' && order.payment?.status === 'pending') {
    return 'Your payment proof is under review.';
  }
  return 'We are processing your order.';
}

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOrder = useCallback(async () => {
    if (!id || !user) {
      setOrder(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const realOrder = await fetchCustomerOrderById(id, user.id, user.email ?? '');
      setOrder(realOrder);
    } catch (err) {
      console.error('Failed to load order detail:', err);
      setError(err instanceof Error ? err.message : 'Unable to load order details.');
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    if (!authLoading) {
      loadOrder();
    }
  }, [authLoading, loadOrder]);

  if (!authLoading && !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <p className="text-neutral-500 mb-4">Please sign in to view your order.</p>
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="h-11 px-5 rounded-xl bg-amber-500 text-white text-sm font-semibold"
        >
          Sign In
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <div className="bg-white border-b border-neutral-200 px-4 py-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => navigate('/orders')} className="p-1">
              <ArrowLeft size={22} className="text-neutral-700" />
            </button>
            <h1 className="text-lg font-semibold text-gray-900">Order Details</h1>
          </div>
        </div>
        <div className="px-4 py-4 space-y-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-32 rounded-xl bg-white animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <p className="text-neutral-500 mb-4">{error || 'Order not found'}</p>
        <button
          type="button"
          onClick={() => navigate('/orders')}
          className="h-11 px-5 rounded-xl bg-amber-500 text-white text-sm font-semibold"
        >
          Back to Orders
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="bg-white border-b border-neutral-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate('/orders')} className="p-1">
            <ArrowLeft size={22} className="text-neutral-700" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Order Details</h1>
            <p className="text-xs text-neutral-500">#{order.orderNumber}</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        <div className="bg-white rounded-xl p-5 text-center">
          <div className="w-14 h-14 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-3">
            {statusIcons[order.status] ?? <Package size={32} className="text-neutral-500" />}
          </div>
          <StatusBadge status={order.status} />
          <p className="text-sm text-neutral-500 mt-2">{statusMessage(order)}</p>
        </div>

        <div className="bg-white rounded-xl p-4">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Order Timeline</h3>
          <TrackingTimeline currentStatus={order.status} />
        </div>

        <div className="bg-white rounded-xl p-4">
          <h3 className="text-base font-semibold text-gray-900 mb-3">Items Ordered</h3>
          <div className="space-y-3">
            {order.items.map((item) => (
              <div key={item.id} className="flex gap-3">
                <img
                  src={item.productImage}
                  alt=""
                  className="w-16 h-16 rounded-lg object-cover bg-neutral-100"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 line-clamp-2">{item.productName}</p>
                  {item.sourceUrl && (
                    <span className="inline-block mt-1 px-2 py-0.5 bg-neutral-100 text-neutral-600 text-[10px] font-medium rounded-full uppercase">
                      {item.sourcePlatform || 'Link'}
                    </span>
                  )}
                  <p className="text-xs text-neutral-500 mt-1">Qty: {item.quantity}</p>
                  {item.unitPrice > 0 && (
                    <p className="text-sm font-bold text-amber-600 mt-1">
                      Nu. {(item.unitPrice * item.quantity).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl p-4">
          <h3 className="text-base font-semibold text-gray-900 mb-3">Delivery Details</h3>
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <MapPin size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold">{order.shippingAddress.recipientName}</p>
                {order.shippingAddress.phone && (
                  <p className="text-xs text-neutral-500">{order.shippingAddress.phone}</p>
                )}
                <p className="text-xs text-neutral-600 mt-1">
                  {[order.shippingAddress.village, order.shippingAddress.gewog, order.shippingAddress.dzongkhag]
                    .filter(Boolean)
                    .join(', ') || 'Delivery address pending'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Truck size={18} className="text-emerald-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold">{order.deliveryHub.name}</p>
                <p className="text-xs text-neutral-500">
                  {appSettings.orderCoverage.label}. Hubs: {appSettings.deliveryHubs.hubNamesJoined}.
                </p>
              </div>
            </div>
          </div>
        </div>

        {order.payment && (
          <div className="bg-white rounded-xl p-4">
            <h3 className="text-base font-semibold text-gray-900 mb-3">Payment Details</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">Method</span>
                <span className="font-medium">{order.payment.method || 'Under review'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">Amount</span>
                <span className="font-medium">Nu. {order.payment.amount.toLocaleString()}</span>
              </div>
              {order.payment.transactionId && (
                <div className="flex justify-between text-sm gap-4">
                  <span className="text-neutral-600">Transaction ID</span>
                  <span className="font-mono text-xs text-right break-all">{order.payment.transactionId}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">Status</span>
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                    order.payment.status === 'verified'
                      ? 'bg-emerald-50 text-emerald-600'
                      : order.payment.status === 'rejected'
                        ? 'bg-red-50 text-red-600'
                        : 'bg-orange-50 text-orange-600'
                  }`}
                >
                  {order.payment.status === 'verified'
                    ? 'Verified'
                    : order.payment.status === 'rejected'
                      ? 'Rejected'
                      : 'Pending'}
                </span>
              </div>
            </div>
          </div>
        )}

        {order.quotation && (
          <button
            type="button"
            onClick={() => navigate(`/quotation/${order.id}`)}
            className="w-full bg-white rounded-xl p-4 flex items-center justify-between hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3">
              <FileText size={20} className="text-violet-500" />
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-900">View Quotation</p>
                <p className="text-xs text-neutral-500">
                  Total: Nu. {order.quotation.totalAmount.toLocaleString()}
                </p>
              </div>
            </div>
            <ChevronRight size={18} className="text-neutral-400" />
          </button>
        )}

        <div className="flex gap-3">
          {order.status === 'quoted' && (
            <button
              type="button"
              onClick={() => navigate(`/quotation/${order.id}`)}
              className="flex-1 h-12 bg-amber-500 text-white font-semibold rounded-xl hover:bg-amber-600 transition-colors"
            >
              View Quotation
            </button>
          )}
          {order.status === 'payment_pending' && !order.payment && (
            <button
              type="button"
              onClick={() => navigate(`/payment/${order.id}`)}
              className="flex-1 h-12 bg-emerald-500 text-white font-semibold rounded-xl hover:bg-emerald-600 transition-colors"
            >
              Upload Payment
            </button>
          )}
          {order.status === 'delivered' && (
            <>
              <button
                type="button"
                onClick={() => navigate('/catalog')}
                className="flex-1 h-12 bg-amber-500 text-white font-semibold rounded-xl hover:bg-amber-600 transition-colors"
              >
                Order Again
              </button>
              <button
                type="button"
                className="flex-1 h-12 bg-neutral-100 text-neutral-700 font-semibold rounded-xl hover:bg-neutral-200 transition-colors"
              >
                Write Review
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
