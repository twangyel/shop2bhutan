import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Check, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchCustomerOrderById,
  updateCustomerOrderStatus,
  updateQuotationStatus,
} from '@/lib/customerOrders';
import type { Order, Quotation } from '@/types';

function quotationDisplay(quotation: Quotation) {
  if (quotation.status === 'approved') {
    return {
      card: 'bg-emerald-50',
      iconBg: 'bg-emerald-500',
      icon: <Check size={20} className="text-white" />,
      title: 'Quotation Approved',
      titleColor: 'text-emerald-700',
      subtitle: 'Proceed with payment upload.',
    };
  }

  if (quotation.status === 'rejected') {
    return {
      card: 'bg-red-50',
      iconBg: 'bg-red-500',
      icon: <X size={20} className="text-white" />,
      title: 'Quotation Rejected',
      titleColor: 'text-red-700',
      subtitle: 'Processed',
    };
  }

  if (quotation.status === 'expired') {
    return {
      card: 'bg-red-50',
      iconBg: 'bg-red-500',
      icon: <X size={20} className="text-white" />,
      title: 'Quotation Expired',
      titleColor: 'text-red-700',
      subtitle: 'Please contact support for a fresh quotation.',
    };
  }

  return {
    card: 'bg-violet-50',
    iconBg: 'bg-violet-500',
    icon: <Clock size={20} className="text-white" />,
    title: quotation.status === 'pending' ? 'Quotation Pending' : 'Quotation Received',
    titleColor: 'text-violet-700',
    subtitle: quotation.validUntil
      ? `Valid until ${new Date(quotation.validUntil).toLocaleDateString()}`
      : 'Please review the quotation details below.',
  };
}

export default function QuotationReview() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadOrder = useCallback(async () => {
    if (!orderId || !user) {
      setOrder(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const realOrder = await fetchCustomerOrderById(orderId, user.id, user.email ?? '');
      setOrder(realOrder);
    } catch (err) {
      console.error('Failed to load quotation:', err);
      setError(err instanceof Error ? err.message : 'Unable to load quotation.');
    } finally {
      setLoading(false);
    }
  }, [orderId, user]);

  useEffect(() => {
    if (!authLoading) {
      loadOrder();
    }
  }, [authLoading, loadOrder]);

  const q = order?.quotation;
  const display = useMemo(() => (q ? quotationDisplay(q) : null), [q]);

  const handleReject = async () => {
    if (!q) return;

    setSubmitting(true);
    setError('');

    try {
      await updateQuotationStatus(q.id, 'rejected');
      await loadOrder();
    } catch (err) {
      console.error('Failed to reject quotation:', err);
      setError(err instanceof Error ? err.message : 'Unable to reject quotation.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAccept = async () => {
    if (!q || !order) return;

    setSubmitting(true);
    setError('');

    try {
      await updateQuotationStatus(q.id, 'approved');
      await updateCustomerOrderStatus(order.id, 'payment_pending');
      navigate(`/payment/${order.id}`);
    } catch (err) {
      console.error('Failed to accept quotation:', err);
      setError(err instanceof Error ? err.message : 'Unable to accept quotation.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!authLoading && !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <p className="text-neutral-500 mb-4">Please sign in to view your quotation.</p>
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
      <div className="min-h-screen bg-neutral-50 pb-24">
        <div className="bg-white border-b border-neutral-200 px-4 py-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => navigate(-1)} className="p-1">
              <ArrowLeft size={22} className="text-neutral-700" />
            </button>
            <h1 className="text-lg font-semibold text-gray-900">Quotation</h1>
          </div>
        </div>
        <div className="px-4 py-4 space-y-4">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-32 rounded-xl bg-white animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!order || !q || !display) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <p className="text-neutral-500 mb-4">{error || 'Quotation not found'}</p>
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

  const canRespond = ['pending', 'sent'].includes(q.status);

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <div className="bg-white border-b border-neutral-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="p-1">
            <ArrowLeft size={22} className="text-neutral-700" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Quotation</h1>
            <p className="text-xs text-neutral-500">#{order.orderNumber}</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className={`rounded-xl p-4 ${display.card}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${display.iconBg}`}>
              {display.icon}
            </div>
            <div>
              <p className={`text-sm font-semibold ${display.titleColor}`}>{display.title}</p>
              <p className="text-xs text-neutral-500">{display.subtitle}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4">
          <h3 className="text-base font-semibold text-gray-900 mb-3">Quoted Items</h3>
          <div className="space-y-3">
            {q.items.map((item) => (
              <div key={item.id} className="flex gap-3">
                <img
                  src={item.productImage}
                  alt=""
                  className="w-16 h-16 rounded-lg object-cover bg-neutral-100"
                />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">{item.productName}</p>
                  <p className="text-xs text-neutral-500">Qty: {item.quantity}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-bold text-amber-600">
                      Nu. {item.unitPrice.toLocaleString()}
                    </span>
                    <span className="text-xs text-neutral-400">x{item.quantity}</span>
                    <span className="text-sm font-semibold ml-auto">
                      Nu. {item.totalPrice.toLocaleString()}
                    </span>
                  </div>
                  {item.notes && <p className="text-xs text-neutral-500 mt-1">{item.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

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
            {q.taxAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">Tax</span>
                <span className="font-medium">Nu. {q.taxAmount.toLocaleString()}</span>
              </div>
            )}
          </div>
          <hr className="my-3 border-neutral-200" />
          <div className="flex justify-between">
            <span className="text-base font-semibold text-gray-900">Total Amount</span>
            <span className="text-xl font-bold text-amber-600">Nu. {q.totalAmount.toLocaleString()}</span>
          </div>
          <p className="text-xs text-orange-600 mt-2 bg-orange-50 px-2 py-1 rounded-lg">
            Final price after quotation confirmation.
          </p>
        </div>
      </div>

      {canRespond && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 p-4 z-40">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleReject}
              disabled={submitting}
              className="flex-1 h-12 bg-neutral-200 text-neutral-700 font-semibold rounded-xl hover:bg-neutral-300 transition-colors disabled:opacity-50"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={handleAccept}
              disabled={submitting}
              className="flex-1 h-12 bg-emerald-500 text-white font-semibold rounded-xl hover:bg-emerald-600 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Processing...' : 'Accept & Pay'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
