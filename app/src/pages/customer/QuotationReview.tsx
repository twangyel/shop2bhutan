import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Check, X } from 'lucide-react';
import { orders } from '@/data/mockData';

export default function QuotationReview() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const order = orders.find(o => o.id === orderId);

  if (!order || !order.quotation) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-neutral-500">Quotation not found</p>
      </div>
    );
  }

  const q = order.quotation;

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <div className="bg-white border-b border-neutral-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1">
            <ArrowLeft size={22} className="text-neutral-700" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Quotation</h1>
            <p className="text-xs text-neutral-500">#{order.orderNumber}</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Status Banner */}
        <div className={`rounded-xl p-4 ${
          q.status === 'sent' ? 'bg-violet-50' : q.status === 'approved' ? 'bg-emerald-50' : 'bg-red-50'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              q.status === 'sent' ? 'bg-violet-500' : q.status === 'approved' ? 'bg-emerald-500' : 'bg-red-500'
            }`}>
              {q.status === 'sent' ? <Clock size={20} className="text-white" /> :
               q.status === 'approved' ? <Check size={20} className="text-white" /> :
               <X size={20} className="text-white" />}
            </div>
            <div>
              <p className={`text-sm font-semibold ${
                q.status === 'sent' ? 'text-violet-700' : q.status === 'approved' ? 'text-emerald-700' : 'text-red-700'
              }`}>
                {q.status === 'sent' ? 'Quotation Received' : q.status === 'approved' ? 'Quotation Approved' : 'Quotation Rejected'}
              </p>
              <p className="text-xs text-neutral-500">
                {q.status === 'sent' ? `Valid until ${new Date(q.validUntil).toLocaleDateString()}` : 'Processed'}
              </p>
            </div>
          </div>
        </div>

        {/* Quotation Items */}
        <div className="bg-white rounded-xl p-4">
          <h3 className="text-base font-semibold text-gray-900 mb-3">Quoted Items</h3>
          <div className="space-y-3">
            {q.items.map(item => (
              <div key={item.id} className="flex gap-3">
                <img src={item.productImage} alt="" className="w-16 h-16 rounded-lg object-cover bg-neutral-100" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">{item.productName}</p>
                  <p className="text-xs text-neutral-500">Qty: {item.quantity}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-bold text-amber-600">Nu. {item.unitPrice.toLocaleString()}</span>
                    <span className="text-xs text-neutral-400">x{item.quantity}</span>
                    <span className="text-sm font-semibold ml-auto">Nu. {item.totalPrice.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Price Breakdown */}
        <div className="bg-white rounded-xl p-4">
          <h3 className="text-base font-semibold text-gray-900 mb-3">Price Details</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">Product Total</span>
              <span className="font-medium">Nu. {q.productTotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">Service Charge</span>
              <span className="font-medium">Nu. {q.serviceCharge.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">Delivery Fee</span>
              <span className="font-medium">Nu. {q.deliveryFee.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">Tax (5%)</span>
              <span className="font-medium">Nu. {q.taxAmount.toLocaleString()}</span>
            </div>
          </div>
          <hr className="my-3 border-neutral-200" />
          <div className="flex justify-between">
            <span className="text-base font-semibold text-gray-900">Total Amount</span>
            <span className="text-xl font-bold text-amber-600">Nu. {q.totalAmount.toLocaleString()}</span>
          </div>
          <p className="text-xs text-orange-600 mt-2 bg-orange-50 px-2 py-1 rounded-lg">
            Valid for 48 hours. Final price after quotation confirmation.
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      {q.status === 'sent' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 p-4 z-40">
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/orders')}
              className="flex-1 h-12 bg-neutral-200 text-neutral-700 font-semibold rounded-xl hover:bg-neutral-300 transition-colors"
            >
              Reject
            </button>
            <button
              onClick={() => navigate(`/payment/${orderId}`)}
              className="flex-1 h-12 bg-emerald-500 text-white font-semibold rounded-xl hover:bg-emerald-600 transition-colors"
            >
              Accept & Pay
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
