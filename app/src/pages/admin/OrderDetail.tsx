import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Truck, MapPin, Printer } from 'lucide-react';
import { orders } from '@/data/mockData';
import StatusBadge from '@/components/shared/StatusBadge';
import TrackingTimeline from '@/components/shared/TrackingTimeline';

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const order = orders.find(o => o.id === id);

  if (!order) {
    return <div className="text-neutral-500">Order not found</div>;
  }

  return (
    <div className="space-y-4">
      {/* Breadcrumb & Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin/orders')} className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors">
            <ArrowLeft size={20} className="text-neutral-600" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-500">Orders /</span>
              <span className="text-sm font-medium">#{order.orderNumber}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {order.quotation?.status === 'sent' && (
            <button
              onClick={() => navigate(`/admin/quotation/${order.id}`)}
              className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-2"
            >
              <FileText size={16} />
              Edit Quotation
            </button>
          )}
          <button className="px-4 py-2 bg-neutral-100 text-neutral-700 text-sm font-medium rounded-lg hover:bg-neutral-200 transition-colors flex items-center gap-2">
            <Printer size={16} />
            Print
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column */}
        <div className="space-y-4">
          {/* Customer Card */}
          <div className="bg-white rounded-xl p-5 shadow-card">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Customer</h3>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-700 font-bold">
                {order.user.name.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-semibold">{order.user.name}</p>
                <p className="text-xs text-neutral-500">{order.user.email}</p>
                <p className="text-xs text-neutral-500">{order.user.phone}</p>
              </div>
            </div>
          </div>

          {/* Shipping Address */}
          <div className="bg-white rounded-xl p-5 shadow-card">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Shipping Address</h3>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <MapPin size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm">{order.shippingAddress.recipientName}</p>
                  <p className="text-xs text-neutral-500">{order.shippingAddress.phone}</p>
                  <p className="text-xs text-neutral-600 mt-1">
                    {order.shippingAddress.village}, {order.shippingAddress.gewog}, {order.shippingAddress.dzongkhag}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Truck size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">{order.deliveryHub.name}</p>
                  <p className="text-xs text-neutral-500">{order.deliveryHub.address}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl p-5 shadow-card">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Tracking</h3>
            <TrackingTimeline currentStatus={order.status} />
          </div>
        </div>

        {/* Center Column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Order Items */}
          <div className="bg-white rounded-xl p-5 shadow-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Order Items</h3>
              <span className="text-xs text-neutral-500">{order.items.length} items</span>
            </div>
            <div className="space-y-3">
              {order.items.map(item => (
                <div key={item.id} className="flex gap-3 p-3 bg-neutral-50 rounded-lg">
                  <img src={item.productImage} alt="" className="w-14 h-14 rounded-lg object-cover bg-white" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{item.productName}</p>
                    {item.sourceUrl && (
                      <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline truncate block">
                        {item.sourceUrl}
                      </a>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-neutral-500">Qty: {item.quantity}</span>
                      <span className="text-sm font-bold">Nu. {item.unitPrice.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quotation Card */}
          {order.quotation && (
            <div className="bg-white rounded-xl p-5 shadow-card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">Quotation</h3>
                <StatusBadge status={order.quotation.status} size="sm" />
              </div>
              <div className="space-y-2">
                {order.quotation.items.map(item => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-neutral-600">{item.productName} x{item.quantity}</span>
                    <span className="font-medium">Nu. {item.totalPrice.toLocaleString()}</span>
                  </div>
                ))}
                <hr className="border-neutral-200" />
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600">Product Total</span>
                  <span className="font-medium">Nu. {order.quotation.productTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600">Service Charge</span>
                  <span className="font-medium">Nu. {order.quotation.serviceCharge.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600">Delivery Fee</span>
                  <span className="font-medium">Nu. {order.quotation.deliveryFee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600">Tax</span>
                  <span className="font-medium">Nu. {order.quotation.taxAmount.toLocaleString()}</span>
                </div>
                <hr className="border-neutral-200" />
                <div className="flex justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold text-amber-600">Nu. {order.quotation.totalAmount.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => navigate(`/admin/quotation/${order.id}`)}
                  className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors"
                >
                  Edit Quotation
                </button>
              </div>
            </div>
          )}

          {/* Payment Card */}
          {order.payment && (
            <div className="bg-white rounded-xl p-5 shadow-card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">Payment</h3>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                  order.payment.status === 'verified' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'
                }`}>
                  {order.payment.status === 'verified' ? 'Verified' : 'Pending'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-neutral-500">Method</p>
                  <p className="text-sm font-medium">{order.payment.method}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Amount</p>
                  <p className="text-sm font-medium">Nu. {order.payment.amount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Transaction ID</p>
                  <p className="text-sm font-mono">{order.payment.transactionId}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Date</p>
                  <p className="text-sm">{new Date(order.payment.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              {order.payment.status === 'pending' && (
                <div className="flex gap-2 mt-4">
                  <button className="px-4 py-2 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 transition-colors">
                    Verify Payment
                  </button>
                  <button className="px-4 py-2 bg-red-50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors">
                    Reject
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Order Notes */}
          <div className="bg-white rounded-xl p-5 shadow-card">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Order Notes</h3>
            <textarea
              placeholder="Add internal notes..."
              className="w-full h-20 p-3 border border-neutral-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
            <button className="mt-2 px-4 py-2 bg-neutral-100 text-neutral-700 text-sm font-medium rounded-lg hover:bg-neutral-200 transition-colors">
              Add Note
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
