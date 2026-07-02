import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle,
  ChevronRight,
  Clock,
  CreditCard,
  ExternalLink,
  FileText,
  MapPin,
  Package,
  Truck,
  XCircle,
} from 'lucide-react';
import { appSettings } from '@/data/mockData';
import { useAuth } from '@/contexts/AuthContext';
import StatusBadge from '@/components/shared/StatusBadge';
import TrackingTimeline from '@/components/shared/TrackingTimeline';
import { fetchCustomerOrderById } from '@/lib/customerOrders';
import type { Order } from '@/types';

const statusIcons: Record<string, ReactNode> = {
  pending_confirmation: <Clock size={30} className="text-orange-500" />,
  quotation_pending: <FileText size={30} className="text-amber-500" />,
  quoted: <FileText size={30} className="text-violet-500" />,
  payment_pending: <CreditCard size={30} className="text-orange-500" />,
  payment_verified: <CheckCircle size={30} className="text-blue-500" />,
  order_placed: <Package size={30} className="text-blue-500" />,
  in_transit: <Truck size={30} className="text-blue-500" />,
  arrived_at_hub: <Package size={30} className="text-emerald-500" />,
  out_for_delivery: <MapPin size={30} className="text-emerald-500" />,
  delivered: <CheckCircle size={30} className="text-emerald-500" />,
  cancelled: <XCircle size={30} className="text-red-500" />,
};

function money(value?: number) {
  return `Nu. ${Number(value ?? 0).toLocaleString()}`;
}

function statusMessage(order: Order) {
  if (order.status === 'delivered') return 'Your order has been delivered successfully.';
  if (order.status === 'in_transit') return 'Your order is on its way to Bhutan.';
  if (order.status === 'quoted') return 'Your quotation is ready. Review it before payment.';
  if (order.status === 'payment_pending' && order.payment?.status === 'pending') {
    return 'Your payment proof is under review.';
  }
  if (order.status === 'quotation_pending') return 'We are checking your product details and preparing your quotation.';
  return 'We are processing your order.';
}

function safeAddress(order: Order) {
  return [order.shippingAddress.village, order.shippingAddress.gewog, order.shippingAddress.dzongkhag]
    .filter(Boolean)
    .join(', ') || 'Delivery address pending';
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
      void loadOrder();
    }
  }, [authLoading, loadOrder]);

  if (!authLoading && !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <p className="mb-4 text-neutral-500">Please sign in to view your order.</p>
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="h-11 rounded-xl bg-amber-500 px-5 text-sm font-semibold text-white"
        >
          Sign In
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <div className="border-b border-neutral-200 bg-white px-4 py-3">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <button type="button" onClick={() => navigate('/orders')} className="p-1">
              <ArrowLeft size={22} className="text-neutral-700" />
            </button>
            <h1 className="text-lg font-semibold text-gray-900">Order Details</h1>
          </div>
        </div>
        <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-32 rounded-3xl bg-white shadow-sm animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <p className="mb-4 text-neutral-500">{error || 'Order not found'}</p>
        <button
          type="button"
          onClick={() => navigate('/orders')}
          className="h-11 rounded-xl bg-amber-500 px-5 text-sm font-semibold text-white"
        >
          Back to Orders
        </button>
      </div>
    );
  }

  const quotationReady = Boolean(order.quotation && order.status === 'quoted');
  const showPaymentUpload = order.status === 'payment_pending' && !order.payment;

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-8">
      <div className="sticky top-0 z-30 border-b border-white/70 bg-white/90 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <button type="button" onClick={() => navigate('/orders')} className="rounded-full p-1.5 hover:bg-neutral-100">
            <ArrowLeft size={22} className="text-neutral-700" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-black text-gray-950">Order Details</h1>
            <p className="truncate text-xs text-neutral-500">#{order.orderNumber}</p>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        <section className="overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-neutral-100">
          <div className="bg-gradient-to-br from-gray-950 to-gray-800 p-5 text-white">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-white/50">Current status</p>
                <div className="mt-2 inline-flex">
                  <StatusBadge status={order.status} />
                </div>
                <p className="mt-3 text-sm leading-relaxed text-white/80">{statusMessage(order)}</p>
              </div>
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
                {statusIcons[order.status] ?? <Package size={30} className="text-white" />}
              </div>
            </div>
          </div>

          {quotationReady && order.quotation && (
            <button
              type="button"
              onClick={() => navigate(`/quotation/${order.id}`)}
              className="w-full bg-gradient-to-r from-violet-50 via-white to-amber-50 p-4 text-left transition-colors hover:from-violet-100 hover:to-amber-100"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-100">
                    <FileText size={22} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-violet-950">Quotation ready</p>
                    <p className="mt-0.5 text-xs text-violet-700">Review your final payable amount before payment.</p>
                    <p className="mt-1 text-base font-black text-violet-950">{money(order.quotation.totalAmount)}</p>
                  </div>
                </div>
                <ChevronRight size={21} className="flex-shrink-0 text-violet-500" />
              </div>
            </button>
          )}

          {showPaymentUpload && order.quotation && (
            <button
              type="button"
              onClick={() => navigate(`/payment/${order.id}`)}
              className="w-full bg-gradient-to-r from-emerald-50 to-white p-4 text-left transition-colors hover:from-emerald-100"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-100">
                    <CreditCard size={22} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-emerald-950">Payment pending</p>
                    <p className="text-xs text-emerald-700">Upload your payment screenshot to continue.</p>
                  </div>
                </div>
                <ChevronRight size={21} className="text-emerald-500" />
              </div>
            </button>
          )}
        </section>

        <section className="rounded-[1.75rem] bg-white p-4 shadow-sm ring-1 ring-neutral-100">
          <h3 className="mb-4 text-base font-black text-gray-950">Order Timeline</h3>
          <TrackingTimeline currentStatus={order.status} />
        </section>

        <section className="rounded-[1.75rem] bg-white p-4 shadow-sm ring-1 ring-neutral-100">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-black text-gray-950">Items ordered</h3>
            <span className="rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-bold text-neutral-600">
              {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
            </span>
          </div>
          <div className="space-y-3">
            {order.items.map((item) => (
              <div key={item.id} className="rounded-3xl border border-neutral-100 bg-neutral-50/80 p-3">
                <div className="flex gap-3">
                  <img
                    src={item.productImage}
                    alt=""
                    className="h-20 w-20 flex-shrink-0 rounded-2xl bg-white object-cover ring-1 ring-neutral-200"
                    loading="lazy"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.sourcePlatform && (
                        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-neutral-600 ring-1 ring-neutral-200">
                          {item.sourcePlatform}
                        </span>
                      )}
                      <span className="text-xs text-neutral-500">Qty: {item.quantity}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm font-black leading-snug text-gray-950">{item.productName}</p>
                    {item.unitPrice > 0 && (
                      <p className="mt-2 text-sm font-black text-amber-600">
                        {money(item.unitPrice * item.quantity)}
                      </p>
                    )}
                  </div>
                </div>
                {item.sourceUrl && /^https?:\/\//i.test(item.sourceUrl) && (
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-600 transition-colors hover:bg-blue-100"
                  >
                    <ExternalLink size={13} /> View product source
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[1.75rem] bg-white p-4 shadow-sm ring-1 ring-neutral-100">
          <h3 className="mb-3 text-base font-black text-gray-950">Delivery details</h3>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                <MapPin size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black text-gray-950">{order.shippingAddress.recipientName}</p>
                {order.shippingAddress.phone && <p className="text-xs text-neutral-500">{order.shippingAddress.phone}</p>}
                <p className="mt-1 text-xs leading-relaxed text-neutral-600">{safeAddress(order)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <Truck size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black text-gray-950">{order.deliveryHub.name}</p>
                <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                  {appSettings.orderCoverage.label}. Delivery currently available in {appSettings.deliveryHubs.hubNamesJoined}.
                </p>
              </div>
            </div>
          </div>
        </section>

        {order.payment && (
          <section className="rounded-[1.75rem] bg-white p-4 shadow-sm ring-1 ring-neutral-100">
            <h3 className="mb-3 text-base font-black text-gray-950">Payment details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-neutral-600">Method</span>
                <span className="font-bold text-gray-950">{order.payment.method || 'Under review'}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-neutral-600">Amount</span>
                <span className="font-bold text-gray-950">{money(order.payment.amount)}</span>
              </div>
              {order.payment.transactionId && (
                <div className="flex justify-between gap-4">
                  <span className="text-neutral-600">Transaction ID</span>
                  <span className="break-all text-right font-mono text-xs text-gray-950">{order.payment.transactionId}</span>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <span className="text-neutral-600">Status</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    order.payment.status === 'verified'
                      ? 'bg-emerald-50 text-emerald-600'
                      : order.payment.status === 'rejected'
                        ? 'bg-red-50 text-red-600'
                        : 'bg-orange-50 text-orange-600'
                  }`}
                >
                  {order.payment.status === 'verified' ? 'Verified' : order.payment.status === 'rejected' ? 'Rejected' : 'Pending'}
                </span>
              </div>
            </div>
          </section>
        )}

        {order.status === 'delivered' && (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => navigate('/shop')}
              className="h-12 rounded-2xl bg-amber-500 text-sm font-black text-white transition-colors hover:bg-amber-600"
            >
              Order Again
            </button>
            <button
              type="button"
              className="h-12 rounded-2xl bg-white text-sm font-black text-neutral-700 shadow-sm ring-1 ring-neutral-100 transition-colors hover:bg-neutral-50"
            >
              Write Review
            </button>
          </div>
        )}

        {!quotationReady && order.quotation && order.status !== 'payment_pending' && (
          <button
            type="button"
            onClick={() => navigate(`/quotation/${order.id}`)}
            className="flex w-full items-center justify-between rounded-3xl bg-white p-4 text-left shadow-sm ring-1 ring-neutral-100 transition-all hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                <FileText size={20} />
              </div>
              <div>
                <p className="text-sm font-black text-gray-950">View quotation</p>
                <p className="text-xs text-neutral-500">Total: {money(order.quotation.totalAmount)}</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-neutral-400" />
          </button>
        )}
      </main>
    </div>
  );
}
