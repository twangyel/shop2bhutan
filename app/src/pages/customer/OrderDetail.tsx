import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Clock, FileText, CreditCard, Package, Truck,
  MapPin, CheckCircle, XCircle, ChevronRight
} from 'lucide-react';
import { orders } from '@/data/mockData';
import StatusBadge from '@/components/shared/StatusBadge';
import TrackingTimeline from '@/components/shared/TrackingTimeline';

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const order = orders.find(o => o.id === id);

  if (!order) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-neutral-500">Order not found</p></div>;
  }

  const statusIcons: Record<string, React.ReactNode> = {
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

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="bg-white border-b border-neutral-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/orders')} className="p-1">
            <ArrowLeft size={22} className="text-neutral-700" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Order Details</h1>
            <p className="text-xs text-neutral-500">#{order.orderNumber}</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Status Card */}
        <div className="bg-white rounded-xl p-5 text-center">
          <div className="w-14 h-14 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-3">
            {statusIcons[order.status]}
          </div>
          <StatusBadge status={order.status} />
          <p className="text-sm text-neutral-500 mt-2">
            {order.status === 'delivered' ? 'Your order has been delivered successfully.' :
             order.status === 'in_transit' ? 'Your order is on its way to you.' :
             order.status === 'quoted' ? 'Review your quotation and proceed with payment.' :
             'We are processing your order.'}
          </p>
        </div>

        {/* Tracking Timeline */}
        <div className="bg-white rounded-xl p-4">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Order Timeline</h3>
          <TrackingTimeline currentStatus={order.status} />
        </div>

        {/* Items Ordered */}
        <div className="bg-white rounded-xl p-4">
          <h3 className="text-base font-semibold text-gray-900 mb-3">Items Ordered</h3>
          <div className="space-y-3">
            {order.items.map(item => (
              <div key={item.id} className="flex gap-3">
                <img src={item.productImage} alt="" className="w-16 h-16 rounded-lg object-cover bg-neutral-100" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 line-clamp-2">{item.productName}</p>
                  {item.sourceUrl && (
                    <span className="inline-block mt-1 px-2 py-0.5 bg-neutral-100 text-neutral-600 text-[10px] font-medium rounded-full uppercase">
                      {item.sourcePlatform}
                    </span>
                  )}
                  <p className="text-xs text-neutral-500 mt-1">Qty: {item.quantity}</p>
                  <p className="text-sm font-bold text-amber-600 mt-1">Nu. {(item.unitPrice * item.quantity).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Delivery Details */}
        <div className="bg-white rounded-xl p-4">
          <h3 className="text-base font-semibold text-gray-900 mb-3">Delivery Details</h3>
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <MapPin size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold">{order.shippingAddress.recipientName}</p>
                <p className="text-xs text-neutral-500">{order.shippingAddress.phone}</p>
                <p className="text-xs text-neutral-600 mt-1">
                  {order.shippingAddress.village}, {order.shippingAddress.gewog}, {order.shippingAddress.dzongkhag}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Truck size={18} className="text-emerald-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold">{order.deliveryHub.name}</p>
                <p className="text-xs text-neutral-500">Orders accepted from all 20 dzongkhags. Hubs: Thimphu, Phuntsholing, Paro.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Details */}
        {order.payment && (
          <div className="bg-white rounded-xl p-4">
            <h3 className="text-base font-semibold text-gray-900 mb-3">Payment Details</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">Method</span>
                <span className="font-medium">{order.payment.method}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">Amount</span>
                <span className="font-medium">Nu. {order.payment.amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">Transaction ID</span>
                <span className="font-mono text-xs">{order.payment.transactionId}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">Status</span>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                  order.payment.status === 'verified' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'
                }`}>
                  {order.payment.status === 'verified' ? 'Verified' : 'Pending'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Quotation Card */}
        {order.quotation && (
          <button
            onClick={() => navigate(`/quotation/${order.id}`)}
            className="w-full bg-white rounded-xl p-4 flex items-center justify-between hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3">
              <FileText size={20} className="text-violet-500" />
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-900">View Quotation</p>
                <p className="text-xs text-neutral-500">Total: Nu. {order.quotation.totalAmount.toLocaleString()}</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-neutral-400" />
          </button>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          {order.status === 'quoted' && (
            <button
              onClick={() => navigate(`/quotation/${order.id}`)}
              className="flex-1 h-12 bg-amber-500 text-white font-semibold rounded-xl hover:bg-amber-600 transition-colors"
            >
              View Quotation
            </button>
          )}
          {order.status === 'payment_pending' && (
            <button
              onClick={() => navigate(`/payment/${order.id}`)}
              className="flex-1 h-12 bg-emerald-500 text-white font-semibold rounded-xl hover:bg-emerald-600 transition-colors"
            >
              Upload Payment
            </button>
          )}
          {order.status === 'delivered' && (
            <>
              <button
                onClick={() => navigate('/catalog')}
                className="flex-1 h-12 bg-amber-500 text-white font-semibold rounded-xl hover:bg-amber-600 transition-colors"
              >
                Order Again
              </button>
              <button className="flex-1 h-12 bg-neutral-100 text-neutral-700 font-semibold rounded-xl hover:bg-neutral-200 transition-colors">
                Write Review
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
