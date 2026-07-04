import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  ExternalLink,
  FileText,
  MapPin,
  Package,
  XCircle,
  Printer,
  RefreshCw,
  Truck,
} from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';
import TrackingTimeline from '@/components/shared/TrackingTimeline';
import { fetchAdminOrderById, rejectCustomerPayment, updateAdminFulfillmentStatus, verifyCustomerPayment } from '@/lib/customerOrders';
import { useAuth } from '@/contexts/AuthContext';
import type { Order, OrderStatus, Payment, PaymentCoverage, PaymentStatus } from '@/types';

const BHUTAN_TIME_ZONE = 'Asia/Thimphu';

function formatBhutanDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('en-US', {
    timeZone: BHUTAN_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatBhutanTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return `${new Intl.DateTimeFormat('en-US', {
    timeZone: BHUTAN_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)} BTT`;
}

function DateTimeStack({ value, prefix }: { value?: string; prefix?: string }) {
  const dateText = formatBhutanDate(value);
  const timeText = formatBhutanTime(value);

  if (dateText === '-') return <span className="text-sm text-neutral-500">-</span>;

  return (
    <div>
      <div className="text-sm text-neutral-600">{prefix ? `${prefix} ${dateText}` : dateText}</div>
      {timeText && <div className="mt-0.5 text-xs text-neutral-400">{timeText}</div>}
    </div>
  );
}

function formatAmount(value?: number) {
  if (!value || value <= 0) return '-';
  return `Nu. ${value.toLocaleString()}`;
}


function compactAddressParts(parts: Array<string | undefined>) {
  const seen = new Set<string>();

  return parts
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .filter((part) => {
      const key = part.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function fullDeliveryAddress(order: Order) {
  return compactAddressParts([
    order.shippingAddress.village,
    order.shippingAddress.gewog,
    order.shippingAddress.dzongkhag,
    order.shippingAddress.landmark,
  ]).join(', ');
}

function paymentStatusChip(status: PaymentStatus) {
  const styles: Record<PaymentStatus, string> = {
    pending: 'bg-orange-50 text-orange-600',
    verified: 'bg-emerald-50 text-emerald-600',
    rejected: 'bg-red-50 text-red-600',
  };

  const labels: Record<PaymentStatus, string> = {
    pending: 'Pending Review',
    verified: 'Verified',
    rejected: 'Rejected',
  };

  return <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${styles[status]}`}>{labels[status]}</span>;
}

function paymentCoverageLabel(coverage: PaymentCoverage) {
  const labels: Record<PaymentCoverage, string> = {
    unpaid: 'Unpaid',
    partial_paid: 'Partial Paid',
    fully_paid: 'Fully Paid',
    overpaid: 'Overpaid',
  };

  return labels[coverage];
}

function paymentCoverageClass(coverage: PaymentCoverage) {
  if (coverage === 'fully_paid') return 'bg-emerald-50 text-emerald-600';
  if (coverage === 'partial_paid') return 'bg-blue-50 text-blue-600';
  if (coverage === 'overpaid') return 'bg-purple-50 text-purple-600';
  return 'bg-neutral-100 text-neutral-600';
}

function getPaymentSummary(order: Order) {
  const payments = order.payments ?? (order.payment ? [order.payment] : []);
  const totalPayable = order.paymentSummary?.totalPayable ?? order.quotation?.totalAmount ?? 0;
  const verifiedPaid = order.paymentSummary?.verifiedPaid ?? payments
    .filter((payment) => payment.status === 'verified')
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const pendingAmount = order.paymentSummary?.pendingAmount ?? payments
    .filter((payment) => payment.status === 'pending')
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const rejectedAmount = order.paymentSummary?.rejectedAmount ?? payments
    .filter((payment) => payment.status === 'rejected')
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const balanceDue = order.paymentSummary?.balanceDue ?? Math.max(totalPayable - verifiedPaid, 0);
  const coverage = order.paymentSummary?.coverage ?? (verifiedPaid <= 0
    ? 'unpaid'
    : totalPayable > 0 && verifiedPaid > totalPayable
      ? 'overpaid'
      : totalPayable > 0 && verifiedPaid >= totalPayable
        ? 'fully_paid'
        : 'partial_paid');

  return {
    totalPayable,
    verifiedPaid,
    pendingAmount,
    rejectedAmount,
    balanceDue,
    coverage,
    hasPendingPayment: order.paymentSummary?.hasPendingPayment ?? payments.some((payment) => payment.status === 'pending'),
  };
}

type FulfillmentAction = {
  status: OrderStatus;
  label: string;
  description: string;
};

const fulfillmentActions: FulfillmentAction[] = [
  {
    status: 'order_placed',
    label: 'Mark as Order Placed',
    description: 'Product has been ordered from the Indian seller.',
  },
  {
    status: 'in_transit',
    label: 'Mark In Transit',
    description: 'Package is moving from seller/India toward Bhutan.',
  },
  {
    status: 'arrived_at_hub',
    label: 'Mark Arrived at Hub',
    description: 'Package has reached the selected Bhutan hub.',
  },
  {
    status: 'out_for_delivery',
    label: 'Mark Out for Delivery',
    description: 'Package is assigned for final customer delivery.',
  },
  {
    status: 'delivered',
    label: 'Mark Delivered',
    description: 'Customer has received the package.',
  },
  {
    status: 'cancelled',
    label: 'Cancel Order',
    description: 'Stop fulfillment for this order.',
  },
];

const statusOrder: OrderStatus[] = [
  'pending_confirmation',
  'quotation_pending',
  'quoted',
  'payment_pending',
  'payment_verified',
  'order_placed',
  'in_transit',
  'arrived_at_hub',
  'out_for_delivery',
  'delivered',
];

function statusIndex(status: OrderStatus) {
  return statusOrder.indexOf(status);
}

function hasVerifiedPayment(order: Order) {
  const payments = order.payments ?? (order.payment ? [order.payment] : []);
  const summary = order.paymentSummary;
  const fullyCovered = Boolean(
    summary &&
      summary.totalPayable > 0 &&
      (summary.coverage === 'fully_paid' || summary.coverage === 'overpaid' || summary.verifiedPaid >= summary.totalPayable)
  );

  return fullyCovered || payments.some((payment) => payment.status === 'verified') || order.status === 'payment_verified' || statusIndex(order.status) > statusIndex('payment_verified');
}

function nextFulfillmentStatus(order: Order): OrderStatus {
  if (order.status === 'cancelled' || order.status === 'delivered') return order.status;
  const currentIndex = statusIndex(order.status);
  return fulfillmentActions.find((action) => statusIndex(action.status) > currentIndex)?.status ?? 'order_placed';
}

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewBusyId, setReviewBusyId] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [fulfillmentBusyStatus, setFulfillmentBusyStatus] = useState<OrderStatus | ''>('');
  const [fulfillmentError, setFulfillmentError] = useState('');
  const [sellerReference, setSellerReference] = useState('');
  const [fulfillmentNote, setFulfillmentNote] = useState('');
  const [pendingFulfillmentAction, setPendingFulfillmentAction] = useState<FulfillmentAction | null>(null);

  const loadOrder = useCallback(async () => {
    if (!id) {
      setOrder(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const realOrder = await fetchAdminOrderById(id);
      setOrder(realOrder);
    } catch (err) {
      console.error('Failed to load admin order detail:', err);
      setError(err instanceof Error ? err.message : 'Unable to load order details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const handleVerifyPayment = async (payment: Payment) => {
    if (!order || !payment.id) return;
    const confirmed = window.confirm(`Verify payment of ${formatAmount(payment.amount)}?`);
    if (!confirmed) return;

    setReviewBusyId(payment.id);
    setReviewError('');

    try {
      await verifyCustomerPayment({
        order,
        paymentId: payment.id,
        adminId: user?.id,
      });
      await loadOrder();
    } catch (err) {
      console.error('Failed to verify payment:', err);
      setReviewError(err instanceof Error ? err.message : 'Unable to verify payment.');
    } finally {
      setReviewBusyId('');
    }
  };

  const handleRejectPayment = async (payment: Payment) => {
    if (!order || !payment.id) return;
    const reason = window.prompt('Reason for rejecting this payment proof?');
    if (reason === null) return;

    setReviewBusyId(payment.id);
    setReviewError('');

    try {
      await rejectCustomerPayment({
        order,
        paymentId: payment.id,
        adminId: user?.id,
        adminNote: reason.trim() || 'Rejected by admin.',
      });
      await loadOrder();
    } catch (err) {
      console.error('Failed to reject payment:', err);
      setReviewError(err instanceof Error ? err.message : 'Unable to reject payment.');
    } finally {
      setReviewBusyId('');
    }
  };

  const handleFulfillmentUpdate = (status: OrderStatus) => {
    const action = fulfillmentActions.find((item) => item.status === status);
    if (!order || !action) return;

    setFulfillmentError('');
    setPendingFulfillmentAction(action);
  };

  const confirmFulfillmentUpdate = async () => {
    if (!order || !pendingFulfillmentAction) return;

    const status = pendingFulfillmentAction.status;
    setFulfillmentBusyStatus(status);
    setFulfillmentError('');

    try {
      await updateAdminFulfillmentStatus({
        orderId: order.id,
        status,
        adminId: user?.id,
        sellerReference: status === 'order_placed' ? sellerReference.trim() : undefined,
        adminNote: fulfillmentNote.trim(),
      });
      setFulfillmentNote('');
      setPendingFulfillmentAction(null);
      await loadOrder();
    } catch (err) {
      console.error('Failed to update fulfillment status:', err);
      setFulfillmentError(err instanceof Error ? err.message : 'Unable to update fulfillment status.');
      setPendingFulfillmentAction(null);
    } finally {
      setFulfillmentBusyStatus('');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin/orders')} className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors">
            <ArrowLeft size={20} className="text-neutral-600" />
          </button>
          <div>
            <p className="text-sm text-neutral-500">Orders /</p>
            <h1 className="text-lg font-semibold text-gray-900">Loading order...</h1>
          </div>
        </div>
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-36 rounded-xl bg-white shadow-card animate-pulse" />
        ))}
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/admin/orders')} className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors">
          <ArrowLeft size={20} className="text-neutral-600" />
        </button>
        <div className="bg-white rounded-xl p-8 shadow-card text-center">
          <AlertCircle size={38} className="text-red-400 mx-auto mb-3" />
          <p className="text-sm text-neutral-600 mb-4">{error || 'Order not found'}</p>
          <button
            type="button"
            onClick={() => navigate('/admin/orders')}
            className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors"
          >
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  const deliveryAddressText = fullDeliveryAddress(order);
  const payments = order.payments ?? (order.payment ? [order.payment] : []);
  const paymentSummary = getPaymentSummary(order);
  const fulfillmentReady = hasVerifiedPayment(order);
  const suggestedNextStatus = nextFulfillmentStatus(order);
  const currentStatusIndex = statusIndex(order.status);
  const isTerminalOrder = order.status === 'delivered' || order.status === 'cancelled';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin/orders')} className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors">
            <ArrowLeft size={20} className="text-neutral-600" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-500">Orders /</span>
              <span className="text-sm font-medium">#{order.orderNumber}</span>
            </div>
            <p className="text-xs text-neutral-400">DB UUID: {order.id}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadOrder}
            className="px-4 py-2 bg-white border border-neutral-200 text-neutral-700 text-sm font-medium rounded-lg hover:bg-neutral-50 transition-colors flex items-center gap-2"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => navigate(`/admin/quotation/${order.id}`)}
            className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-2"
          >
            <FileText size={16} />
            Prepare Quotation
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 bg-neutral-100 text-neutral-700 text-sm font-medium rounded-lg hover:bg-neutral-200 transition-colors flex items-center gap-2"
          >
            <Printer size={16} />
            Print
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-4">
          <div className="bg-white rounded-xl p-5 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Customer</h3>
              <StatusBadge status={order.status} size="sm" />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-700 font-bold">
                {(order.user.name || 'C').charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{order.user.name}</p>
                <p className="text-xs text-neutral-500 truncate">{order.user.email || '-'}</p>
                <p className="text-xs text-neutral-500">{order.user.phone || order.shippingAddress.phone || '-'}</p>
              </div>
            </div>
            {order.notes && (
              <div className="mt-4 rounded-lg bg-neutral-50 p-3">
                <p className="text-xs font-semibold text-neutral-500 mb-1">Customer Notes</p>
                <p className="text-sm text-neutral-700 whitespace-pre-wrap">{order.notes}</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl p-5 shadow-card">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Delivery Address</h3>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <MapPin size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">{order.shippingAddress.recipientName}</p>
                  <p className="text-xs text-neutral-500">{order.shippingAddress.phone || '-'}</p>
                  <p className="text-xs text-neutral-600 mt-1 whitespace-pre-wrap">
                    {deliveryAddressText || '-'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Truck size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">{order.deliveryHub.name}</p>
                  <p className="text-xs text-neutral-500">{order.deliveryHub.address || '-'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-card">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Tracking</h3>
            <TrackingTimeline currentStatus={order.status} trackingEvents={order.trackingEvents} showDetails />
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl p-5 shadow-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Order Items</h3>
              <span className="text-xs text-neutral-500">{order.items.length} items</span>
            </div>
            <div className="space-y-3">
              {order.items.map((item) => (
                <div key={item.id} className="flex gap-3 p-3 bg-neutral-50 rounded-lg">
                  <img src={item.productImage} alt="" className="w-16 h-16 rounded-lg object-cover bg-white flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold line-clamp-2">{item.productName}</p>
                    {item.sourceUrl && (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:underline truncate flex items-center gap-1 mt-1"
                      >
                        <span className="truncate">{item.sourceUrl}</span>
                        <ExternalLink size={12} className="flex-shrink-0" />
                      </a>
                    )}
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      <span className="text-xs text-neutral-500">Qty: {item.quantity}</span>
                      <span className="text-xs text-neutral-500 uppercase">{item.sourcePlatform || 'link'}</span>
                      <span className="text-sm font-bold">{formatAmount(item.unitPrice)}</span>
                    </div>
                    {Object.keys(item.attributes || {}).length > 0 && (
                      <p className="text-xs text-neutral-500 mt-1">{JSON.stringify(item.attributes)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Quotation</h3>
              {order.quotation ? <StatusBadge status={order.quotation.status} size="sm" /> : <span className="text-xs text-neutral-400">Not prepared</span>}
            </div>

            {order.quotation ? (
              <div className="space-y-2">
                {order.quotation.items.map((item) => (
                  <div key={item.id} className="flex justify-between gap-3 text-sm">
                    <span className="text-neutral-600 line-clamp-1">{item.productName} x{item.quantity}</span>
                    <span className="font-medium whitespace-nowrap">Nu. {item.totalPrice.toLocaleString()}</span>
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
            ) : (
              <div className="rounded-lg border border-dashed border-neutral-200 p-4 text-center">
                <FileText size={28} className="text-neutral-300 mx-auto mb-2" />
                <p className="text-sm text-neutral-500 mb-3">No quotation has been created yet.</p>
                <button
                  type="button"
                  onClick={() => navigate(`/admin/quotation/${order.id}`)}
                  className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors"
                >
                  Prepare Quotation
                </button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl p-5 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Payments</h3>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${paymentCoverageClass(paymentSummary.coverage)}`}>
                {paymentCoverageLabel(paymentSummary.coverage)}
              </span>
            </div>

            {reviewError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                {reviewError}
              </div>
            )}

            {paymentSummary.coverage === 'partial_paid' && (
              <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-3">
                <p className="text-sm font-semibold text-blue-800">Partial payment verified</p>
                <p className="mt-1 text-xs leading-5 text-blue-700">
                  Fulfillment can continue after verified advance payment, but collect the remaining balance of {formatAmount(paymentSummary.balanceDue)} before final handover.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              <div className="rounded-lg bg-neutral-50 p-3">
                <p className="text-xs text-neutral-500">Quotation Total</p>
                <p className="text-sm font-bold mt-1">{formatAmount(paymentSummary.totalPayable)}</p>
              </div>
              <div className="rounded-lg bg-emerald-50 p-3">
                <p className="text-xs text-emerald-600">Verified Paid</p>
                <p className="text-sm font-bold mt-1 text-emerald-700">{formatAmount(paymentSummary.verifiedPaid)}</p>
              </div>
              <div className="rounded-lg bg-orange-50 p-3">
                <p className="text-xs text-orange-600">Pending Review</p>
                <p className="text-sm font-bold mt-1 text-orange-700">{formatAmount(paymentSummary.pendingAmount)}</p>
              </div>
              <div className="rounded-lg bg-red-50 p-3">
                <p className="text-xs text-red-600">Rejected</p>
                <p className="text-sm font-bold mt-1 text-red-700">{formatAmount(paymentSummary.rejectedAmount)}</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-3">
                <p className="text-xs text-amber-600">Balance Due</p>
                <p className="text-sm font-bold mt-1 text-amber-700">{formatAmount(paymentSummary.balanceDue)}</p>
              </div>
            </div>

            {payments.length === 0 ? (
              <div className="rounded-lg border border-dashed border-neutral-200 p-4 text-center">
                <p className="text-sm text-neutral-500">No payment proof uploaded yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {payments.map((payment, index) => (
                  <div key={payment.id || `${payment.createdAt}-${index}`} className="rounded-xl border border-neutral-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Payment #{payments.length - index}</p>
                        <DateTimeStack value={payment.createdAt} prefix="Uploaded" />
                      </div>
                      {paymentStatusChip(payment.status)}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-neutral-500">Method</p>
                        <p className="text-sm font-medium">{payment.method || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-500">Amount</p>
                        <p className="text-sm font-medium">{formatAmount(payment.amount)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-500">Transaction / Reference</p>
                        <p className="text-sm font-mono break-all">{payment.transactionId || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-500">Verified At</p>
                        <DateTimeStack value={payment.verifiedAt} />
                      </div>
                    </div>

                    {payment.notes && (
                      <div className="mt-3 rounded-lg bg-neutral-50 p-3">
                        <p className="text-xs font-semibold text-neutral-500 mb-1">Payment Notes</p>
                        <p className="text-xs text-neutral-600 whitespace-pre-wrap">{payment.notes}</p>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 mt-4">
                      {payment.screenshotUrl && (
                        <a
                          href={payment.screenshotUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-2 bg-neutral-100 text-neutral-700 text-xs font-medium rounded-lg hover:bg-neutral-200 transition-colors"
                        >
                          View payment proof
                          <ExternalLink size={13} />
                        </a>
                      )}

                      {payment.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleVerifyPayment(payment)}
                            disabled={reviewBusyId === payment.id}
                            className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-500 text-white text-xs font-medium rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50"
                          >
                            <CheckCircle size={13} />
                            {reviewBusyId === payment.id ? 'Verifying...' : 'Verify Payment'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectPayment(payment)}
                            disabled={reviewBusyId === payment.id}
                            className="inline-flex items-center gap-2 px-3 py-2 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                          >
                            <XCircle size={13} />
                            {reviewBusyId === payment.id ? 'Updating...' : 'Reject Payment'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl p-5 shadow-card">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Fulfillment & Tracking</h3>
                <p className="mt-1 text-xs text-neutral-500">Update the post-payment journey after ordering from the Indian seller.</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${fulfillmentReady ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}>
                {fulfillmentReady
                  ? paymentSummary.coverage === 'partial_paid'
                    ? 'Ready after partial payment'
                    : 'Ready after payment'
                  : 'Waiting for verified payment'}
              </span>
            </div>

            {fulfillmentError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                {fulfillmentError}
              </div>
            )}

            {!fulfillmentReady && (
              <div className="mb-4 rounded-xl border border-dashed border-orange-200 bg-orange-50 p-4">
                <p className="text-sm font-semibold text-orange-700">Verify payment before fulfillment.</p>
                <p className="mt-1 text-xs text-orange-600">This keeps payment review inside the payments ledger and order movement inside order status/tracking.</p>
              </div>
            )}

            <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold text-neutral-600">Seller / Indian order reference</span>
                <input
                  type="text"
                  value={sellerReference}
                  onChange={(event) => setSellerReference(event.target.value)}
                  placeholder="Amazon / Flipkart order ID, invoice ref..."
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  disabled={!fulfillmentReady || isTerminalOrder}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-neutral-600">Admin note for this update</span>
                <input
                  type="text"
                  value={fulfillmentNote}
                  onChange={(event) => setFulfillmentNote(event.target.value)}
                  placeholder="Optional note visible on timeline"
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  disabled={!fulfillmentReady || isTerminalOrder}
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
              {fulfillmentActions.map((action) => {
                const actionIndex = statusIndex(action.status);
                const isCancelAction = action.status === 'cancelled';
                const isSuggested = action.status === suggestedNextStatus && !isTerminalOrder;
                const isAlreadyPassed = !isCancelAction && currentStatusIndex >= actionIndex;
                const disabled = !fulfillmentReady || isTerminalOrder || isAlreadyPassed || fulfillmentBusyStatus !== '';

                return (
                  <button
                    key={action.status}
                    type="button"
                    onClick={() => handleFulfillmentUpdate(action.status)}
                    disabled={disabled}
                    className={`rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      isCancelAction
                        ? 'border-red-100 bg-red-50 text-red-700 hover:bg-red-100'
                        : isSuggested
                          ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                          : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    <span className="flex items-center gap-2 text-xs font-bold">
                      {action.status === 'order_placed' ? <Package size={14} /> : action.status === 'in_transit' ? <Truck size={14} /> : action.status === 'cancelled' ? <XCircle size={14} /> : <CheckCircle size={14} />}
                      {fulfillmentBusyStatus === action.status ? 'Updating...' : action.label}
                    </span>
                    <span className="mt-1 block text-[11px] leading-relaxed opacity-75">{action.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-card">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Admin Notes</h3>
            <textarea
              placeholder="Add internal notes later when admin notes update is wired..."
              className="w-full h-20 p-3 border border-neutral-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              disabled
            />
            <p className="text-xs text-neutral-400 mt-2">Note saving will be wired in a later admin order-management step.</p>
          </div>
        </div>
      </div>

      {pendingFulfillmentAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start gap-3">
              <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
                pendingFulfillmentAction.status === 'cancelled' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
              }`}>
                {pendingFulfillmentAction.status === 'cancelled' ? <XCircle size={20} /> : <Truck size={20} />}
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-950">Confirm status update</h3>
                <p className="mt-1 text-sm text-neutral-500">
                  {pendingFulfillmentAction.label} for order #{order.orderNumber}?
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <p className="text-sm font-semibold text-gray-900">{pendingFulfillmentAction.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-500">{pendingFulfillmentAction.description}</p>
              {pendingFulfillmentAction.status === 'order_placed' && sellerReference.trim() && (
                <p className="mt-2 text-xs text-neutral-600">
                  <span className="font-semibold">Seller reference:</span> {sellerReference.trim()}
                </p>
              )}
              {fulfillmentNote.trim() && (
                <p className="mt-1 text-xs text-neutral-600">
                  <span className="font-semibold">Timeline note:</span> {fulfillmentNote.trim()}
                </p>
              )}
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPendingFulfillmentAction(null)}
                disabled={fulfillmentBusyStatus !== ''}
                className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Keep Current Status
              </button>
              <button
                type="button"
                onClick={confirmFulfillmentUpdate}
                disabled={fulfillmentBusyStatus !== ''}
                className={`rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${
                  pendingFulfillmentAction.status === 'cancelled' ? 'bg-red-500 hover:bg-red-600' : 'bg-amber-500 hover:bg-amber-600'
                }`}
              >
                {fulfillmentBusyStatus ? 'Updating...' : 'Confirm Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
