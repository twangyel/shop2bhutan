import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  ChevronDown,
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
import { fetchCustomerOrderById, fetchCustomerOrderByIdFast } from '@/lib/customerOrders';
import { getFulfillmentDisplay, isSelfPickupOrder } from '@/lib/fulfillment';
import type { Order, OrderStatus } from '@/types';

const BHUTAN_TIME_ZONE = 'Asia/Thimphu';

const statusIcons: Record<string, ReactNode> = {
  pending_confirmation: <Clock size={30} className="text-orange-500" strokeWidth={2} />,
  quotation_pending: <FileText size={30} className="text-amber-500" strokeWidth={2} />,
  quoted: <FileText size={30} className="text-violet-500" strokeWidth={2} />,
  payment_pending: <CreditCard size={30} className="text-orange-500" strokeWidth={2} />,
  payment_verified: <CheckCircle size={30} className="text-blue-500" strokeWidth={2} />,
  order_placed: <Package size={30} className="text-blue-500" strokeWidth={2} />,
  in_transit: <Truck size={30} className="text-blue-500" strokeWidth={2} />,
  arrived_at_hub: <Package size={30} className="text-emerald-500" strokeWidth={2} />,
  out_for_delivery: <MapPin size={30} className="text-emerald-500" strokeWidth={2} />,
  delivered: <CheckCircle size={30} className="text-emerald-500" strokeWidth={2} />,
  cancelled: <XCircle size={30} className="text-red-500" strokeWidth={2} />,
};

const progressSteps: Array<{
  status: OrderStatus;
  label: string;
  shortLabel: string;
  description: string;
  next: string;
}> = [
  {
    status: 'pending_confirmation',
    label: 'Request Received',
    shortLabel: 'Request',
    description: 'Your shopping request has been received',
    next: 'We will check product availability, selected options, current prices, and delivery charges.',
  },
  {
    status: 'quotation_pending',
    label: 'Checking Availability & Price',
    shortLabel: 'Checking',
    description: 'We are checking availability and final price',
    next: 'You will be notified when your final price is ready.',
  },
  {
    status: 'quoted',
    label: 'Final Price Ready',
    shortLabel: 'Final Price',
    description: 'Review your confirmed final price',
    next: 'Confirm the final price and continue to payment.',
  },
  {
    status: 'payment_pending',
    label: 'Payment Pending',
    shortLabel: 'Payment',
    description: 'Upload your payment screenshot',
    next: 'Upload payment screenshot or wait for payment verification.',
  },
  {
    status: 'payment_verified',
    label: 'Payment Verified',
    shortLabel: 'Verified',
    description: 'Your payment has been verified',
    next: 'We will place your order with the seller.',
  },
  {
    status: 'order_placed',
    label: 'Order Placed',
    shortLabel: 'Placed',
    description: 'Order placed with seller',
    next: 'Your order is being prepared for shipment.',
  },
  {
    status: 'in_transit',
    label: 'In Transit',
    shortLabel: 'Transit',
    description: 'Your order is on the way to Bhutan',
    next: 'Your order is on the way to Bhutan.',
  },
  {
    status: 'arrived_at_hub',
    label: 'Arrived at Hub',
    shortLabel: 'Hub',
    description: 'Package arrived at delivery hub',
    next: 'Delivery will be arranged from the hub.',
  },
  {
    status: 'out_for_delivery',
    label: 'Out for Delivery',
    shortLabel: 'Delivery',
    description: 'Package is out for delivery',
    next: 'Your package is out for delivery.',
  },
  {
    status: 'delivered',
    label: 'Delivered',
    shortLabel: 'Delivered',
    description: 'Package delivered successfully',
    next: 'Package delivered successfully.',
  },
];

function displayProgressStep(step: (typeof progressSteps)[number], order: Order) {
  if (!isSelfPickupOrder(order)) return step;

  if (step.status === 'arrived_at_hub') {
    return {
      ...step,
      label: 'Arrived at Pickup Hub',
      shortLabel: 'Hub',
      description: 'Package arrived at your pickup hub',
      next: 'We will notify you when your order is ready for pickup.',
    };
  }

  if (step.status === 'out_for_delivery') {
    return {
      ...step,
      label: 'Ready for Pickup',
      shortLabel: 'Pickup',
      description: 'Your order is ready for pickup',
      next: 'Please collect your order from the selected pickup hub.',
    };
  }

  if (step.status === 'delivered') {
    return {
      ...step,
      label: 'Picked Up',
      shortLabel: 'Picked Up',
      description: 'Package collected successfully',
      next: 'Package collected successfully.',
    };
  }

  return step;
}

const ORDER_DETAIL_CACHE_PREFIX = 'shop2bhutan:order-detail:';

function orderDetailCacheKey(userId: string, orderId: string) {
  return `${ORDER_DETAIL_CACHE_PREFIX}${userId}:${orderId}`;
}

function readCachedOrderDetail(userId: string, orderId: string): Order | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(orderDetailCacheKey(userId, orderId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Order;
    return parsed?.id ? parsed : null;
  } catch {
    return null;
  }
}

function writeCachedOrderDetail(userId: string, orderId: string, value: Order | null) {
  if (typeof window === 'undefined' || !value) return;

  try {
    window.sessionStorage.setItem(orderDetailCacheKey(userId, orderId), JSON.stringify(value));
  } catch {
    // Storage can be unavailable in private mode. Ignore silently.
  }
}


function money(value?: number) {
  return `Nu. ${Number(value ?? 0).toLocaleString()}`;
}

function formatPaymentMethod(value?: string) {
  const clean = String(value ?? '').trim();
  if (!clean) return 'Under review';

  return clean
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function itemDisplayPrice(order: Order, item: Order['items'][number], index: number) {
  const quotationItem =
    order.quotation?.items?.find((candidate) => candidate.orderItemId === item.id) ??
    order.quotation?.items?.[index];
  const quantity = Math.max(1, Number(item.quantity) || 1);
  const quotedTotal = Number(quotationItem?.totalPrice || 0);
  const quotedUnitPrice = Number(quotationItem?.unitPrice || 0);
  const orderUnitPrice = Number(item.unitPrice || 0);

  if (quotedTotal > 0) return money(quotedTotal);
  if (quotedUnitPrice > 0) return money(quotedUnitPrice * quantity);
  if (orderUnitPrice > 0) return money(orderUnitPrice * quantity);
  return 'Final price pending';
}

function fallbackImage() {
  return (
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180"><rect width="180" height="180" rx="28" fill="#f8fafc"/><rect x="40" y="42" width="100" height="96" rx="24" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/><path d="M67 76h46M67 92h34M67 108h40" stroke="#cbd5e1" stroke-width="7" stroke-linecap="round"/><text x="90" y="157" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="15" font-weight="700" fill="#94a3b8">S2B</text></svg>`,
    )
  );
}

function statusMessage(order: Order, status = getEffectiveOrderStatus(order)) {
  if (isSelfPickupOrder(order)) {
    if (status === 'delivered') return 'Your order has been picked up successfully.';
    if (status === 'out_for_delivery') return `Your order is ready for pickup at ${getFulfillmentDisplay(order).title}.`;
    if (status === 'arrived_at_hub') return `Your order has reached ${getFulfillmentDisplay(order).title}.`;
  }

  if (status === 'delivered') return 'Your order has been delivered successfully.';
  if (status === 'out_for_delivery') return 'Your order is out for delivery.';
  if (status === 'arrived_at_hub') return 'Your order has reached the delivery hub.';
  if (status === 'in_transit') return 'Your order is on its way to Bhutan.';
  if (status === 'order_placed') return 'Your order has been placed with the seller.';
  if (status === 'payment_verified') return 'Your payment has been verified. We will order the product from the seller.';
  if (status === 'cancelled') return 'This order has been cancelled.';
  if (status === 'quoted') return 'Availability is confirmed and your final price is ready. Review it before payment.';
  if (status === 'payment_pending' && order.payment?.status === 'pending') {
    return 'Your payment proof is under review.';
  }
  if (status === 'payment_pending' && order.payment?.status === 'rejected') {
    return 'Your payment proof was rejected. Please upload a corrected screenshot.';
  }
  if (status === 'quotation_pending') return 'We are checking product availability, current price, selected options, and delivery charges.';
  if (status === 'pending_confirmation') return 'Your shopping request has been received. We will begin checking availability and final price shortly.';
  return 'We are processing your order.';
}

function compactUniqueText(parts: unknown[]) {
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

function firstAddressText(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = String(row[key] ?? '').trim();
    if (value) return value;
  }

  return '';
}

function safeAddress(order: Order) {
  if (isSelfPickupOrder(order)) {
    const display = getFulfillmentDisplay(order);
    return compactUniqueText([display.title, display.details]).join('. ');
  }

  const source = order.shippingAddress as unknown as Record<string, unknown>;
  const fullAddress = firstAddressText(source, [
    'formatted_address',
    'formattedAddress',
    'full_address',
    'fullAddress',
    'delivery_address',
    'deliveryAddress',
    'address_line',
    'addressLine',
    'address',
  ]);

  if (fullAddress) return fullAddress;

  return compactUniqueText([
    order.shippingAddress.village,
    order.shippingAddress.gewog,
    order.shippingAddress.dzongkhag,
  ]).join(', ') || 'Delivery address pending';
}

function isGenericDeliveryHubName(value?: string | null) {
  const clean = String(value ?? '').trim().toLowerCase();
  return !clean || ['selected hub', 'delivery hub', 'bhutan hub', 'hub', 'selected delivery hub'].includes(clean);
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
  const balanceDue = order.paymentSummary?.balanceDue ?? Math.max(totalPayable - verifiedPaid, 0);

  return {
    totalPayable,
    verifiedPaid,
    pendingAmount,
    balanceDue,
    hasPendingPayment: order.paymentSummary?.hasPendingPayment ?? pendingAmount > 0,
    isPartiallyPaid: totalPayable > 0 && verifiedPaid > 0 && verifiedPaid < totalPayable,
    isFullyPaid: totalPayable > 0 && verifiedPaid >= totalPayable,
  };
}

function getEffectiveOrderStatus(order: Order): OrderStatus {
  if (order.status === 'cancelled' || order.status === 'delivered') return order.status;

  const actualIndex = getProgressIndex(order.status);
  const paymentVerifiedIndex = getProgressIndex('payment_verified');

  if (actualIndex > paymentVerifiedIndex) return order.status;

  const payments = order.payments ?? (order.payment ? [order.payment] : []);
  const hasVerifiedPayment = payments.some((payment) => payment.status === 'verified') || order.payment?.status === 'verified';
  const hasPendingPayment = payments.some((payment) => payment.status === 'pending') || order.payment?.status === 'pending';
  const hasRejectedPayment = payments.some((payment) => payment.status === 'rejected') || order.payment?.status === 'rejected';
  const summary = order.paymentSummary;
  const fullyCovered = Boolean(
    summary &&
      summary.totalPayable > 0 &&
      (summary.coverage === 'fully_paid' || summary.coverage === 'overpaid' || summary.verifiedPaid >= summary.totalPayable)
  );

  if (order.status === 'payment_verified' || fullyCovered || hasVerifiedPayment) return 'payment_verified';
  if (order.status === 'payment_pending' || hasPendingPayment || hasRejectedPayment) return 'payment_pending';

  return order.status;
}

function getProgressIndex(status: OrderStatus) {
  const index = progressSteps.findIndex((step) => step.status === status);
  return index >= 0 ? index : 0;
}

function isQuotationRequestStage(status?: OrderStatus) {
  return status === 'pending_confirmation' || status === 'quotation_pending' || status === 'quoted';
}

function isWaitingForQuotation(status?: OrderStatus) {
  return status === 'pending_confirmation' || status === 'quotation_pending';
}

function customerStageLabel(status?: OrderStatus) {
  if (status === 'pending_confirmation') return 'Request Submitted';
  if (status === 'quotation_pending') return 'Checking Availability';
  if (status === 'quoted') return 'Final Price Ready';
  if (status === 'payment_pending') return 'Payment Pending';
  if (status === 'payment_verified') return 'Payment Verified';
  if (status === 'order_placed') return 'Order Placed';
  if (status === 'in_transit') return 'In Transit';
  if (status === 'arrived_at_hub') return 'Arrived at Hub';
  if (status === 'out_for_delivery') return 'Out for Delivery';
  if (status === 'delivered') return 'Delivered';
  if (status === 'cancelled') return 'Cancelled';
  return 'In Progress';
}

function CustomerStageBadge({ status }: { status?: OrderStatus }) {
  const isWaiting = isWaitingForQuotation(status);
  const className = isWaiting
    ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-100'
    : status === 'quoted'
      ? 'bg-violet-50 text-violet-700 ring-1 ring-violet-100'
      : status === 'delivered'
        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
        : status === 'cancelled'
          ? 'bg-red-50 text-red-700 ring-1 ring-red-100'
          : 'bg-orange-50 text-orange-700 ring-1 ring-orange-100';

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold ${className}`}>
      {customerStageLabel(status)}
    </span>
  );
}

function getCompactProgress(order: Order) {
  const effectiveStatus = getEffectiveOrderStatus(order);

  if (effectiveStatus === 'cancelled') {
    return {
      currentLabel: 'Order cancelled',
      nextText: 'This order is no longer active.',
      progressPercent: 100,
    };
  }

  const index = getProgressIndex(effectiveStatus);
  const current = displayProgressStep(progressSteps[index] ?? progressSteps[0], order);
  const progressPercent = Math.max(8, Math.round((index / Math.max(1, progressSteps.length - 1)) * 100));

  return {
    currentLabel: current.label,
    nextText: current.next,
    progressPercent,
  };
}

function getProgressCardTitle(order: Order) {
  const effectiveStatus = getEffectiveOrderStatus(order);

  if (effectiveStatus === 'cancelled') return 'Journey cancelled';
  if (effectiveStatus === 'delivered') return isSelfPickupOrder(order) ? 'Pickup complete' : 'Delivery complete';

  const currentIndex = getProgressIndex(effectiveStatus);
  const currentStep = displayProgressStep(progressSteps[currentIndex] ?? progressSteps[0], order);
  const currentStageLabel = customerStageLabel(effectiveStatus);

  if (currentStep.label.toLowerCase() !== currentStageLabel.toLowerCase()) {
    return currentStep.label;
  }

  const nextStep = progressSteps[currentIndex + 1];
  return nextStep ? `Next: ${displayProgressStep(nextStep, order).label}` : currentStep.label;
}

function formatBhutanDateTime(value?: string) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const dateText = new Intl.DateTimeFormat('en-US', {
    timeZone: BHUTAN_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);

  const timeText = new Intl.DateTimeFormat('en-US', {
    timeZone: BHUTAN_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);

  return `${dateText}, ${timeText} BTT`;
}

function firstValidDate(...values: Array<string | undefined>) {
  return values.find((value) => {
    if (!value) return false;
    const date = new Date(value);
    return !Number.isNaN(date.getTime());
  }) || '';
}

function latestTrackingEvent(order: Order, status: OrderStatus) {
  return (order.trackingEvents ?? [])
    .filter((event) => event.status === status && event.visibleToCustomer !== false)
    .sort((a, b) => (new Date(b.createdAt).getTime() || 0) - (new Date(a.createdAt).getTime() || 0))[0];
}

function stepTimestamp(order: Order, status: OrderStatus) {
  const trackingEvent = latestTrackingEvent(order, status);
  const payment = order.payment;
  const quotation = order.quotation;

  if (trackingEvent?.createdAt) return trackingEvent.createdAt;
  if (status === 'pending_confirmation') return firstValidDate(order.createdAt);
  if (status === 'quotation_pending') return firstValidDate(order.createdAt);
  if (status === 'quoted') return firstValidDate(quotation?.respondedAt, quotation?.createdAt);
  if (status === 'payment_pending') return firstValidDate(payment?.createdAt, quotation?.respondedAt, order.updatedAt);
  if (status === 'payment_verified') return firstValidDate(payment?.verifiedAt);
  if (status === getEffectiveOrderStatus(order)) return firstValidDate(order.updatedAt, order.createdAt);

  return '';
}

function OrderProgressTimeline({ order }: { order: Order }) {
  const effectiveStatus = getEffectiveOrderStatus(order);
  const currentIndex = effectiveStatus === 'cancelled' ? -1 : getProgressIndex(effectiveStatus);

  return (
    <div className="space-y-0">
      {progressSteps.map((step, index) => {
        const isCompleted = currentIndex > index;
        const isCurrent = currentIndex === index;
        const isActive = isCompleted || isCurrent;
        const timestamp = stepTimestamp(order, step.status);
        const formattedTime = formatBhutanDateTime(timestamp);
        const event = latestTrackingEvent(order, step.status);
        const displayStep = displayProgressStep(step, order);

        return (
          <div key={step.status} className="relative flex gap-3 pb-5 last:pb-0">
            {index < progressSteps.length - 1 && (
              <span
                className={`absolute left-[15px] top-8 h-full w-px ${
                  isCompleted ? 'bg-emerald-200' : 'bg-gray-200'
                }`}
                aria-hidden="true"
              />
            )}

            <div
              className={`relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                isCompleted
                  ? 'bg-emerald-500 text-white'
                  : isCurrent
                    ? 'bg-orange-500 text-white ring-4 ring-orange-100'
                    : 'bg-gray-100 text-gray-400'
              }`}
            >
              {isCompleted ? <CheckCircle size={15} strokeWidth={2.5} /> : <Clock size={14} strokeWidth={2.5} />}
            </div>

            <div className="min-w-0 flex-1 pt-0.5">
              <p className={`text-sm font-bold ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>{displayStep.label}</p>
              <p className={`mt-0.5 text-xs ${isActive ? 'text-gray-600' : 'text-gray-400'}`}>{event?.message || displayStep.description}</p>
              <p className={`mt-1 text-[11px] font-medium ${formattedTime ? 'text-gray-500' : 'text-gray-300'}`}>
                {formattedTime || 'Pending'}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [error, setError] = useState('');

  const loadOrder = useCallback(async () => {
    if (!id || !user) {
      setOrder(null);
      setLoading(false);
      return;
    }

    const cachedOrder = readCachedOrderDetail(user.id, id);
    if (cachedOrder) {
      setOrder(cachedOrder);
      setLoading(false);
    } else {
      setLoading(true);
    }

    setError('');

    try {
      const fastOrder = await fetchCustomerOrderByIdFast(id, user.id, user.email ?? '');
      if (fastOrder) {
        setOrder(fastOrder);
        writeCachedOrderDetail(user.id, id, fastOrder);
        setLoading(false);
      }

      const realOrder = await fetchCustomerOrderById(id, user.id, user.email ?? '');
      setOrder(realOrder);
      writeCachedOrderDetail(user.id, id, realOrder);
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

  const compactProgress = useMemo(() => (order ? getCompactProgress(order) : null), [order]);
  const progressCardTitle = useMemo(() => (order ? getProgressCardTitle(order) : ''), [order]);
  const effectiveStatus = useMemo(() => (order ? getEffectiveOrderStatus(order) : undefined), [order]);

  if (!authLoading && !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center bg-slate-50">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-orange-50 text-orange-500 ring-1 ring-orange-100">
          <Package size={29} strokeWidth={2.1} />
        </div>
        <h1 className="mt-5 text-xl font-black text-slate-950">Sign in to view</h1>
        <p className="mt-2 text-sm text-slate-500">
          Your order details are securely linked to your account.
        </p>
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="mt-6 h-12 rounded-2xl bg-orange-500 px-6 text-sm font-extrabold text-white shadow-lg shadow-orange-500/20 transition active:scale-[0.98]"
        >
          Sign In
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="border-b border-slate-100 bg-white px-4 py-3">
          <div className="mx-auto max-w-2xl">
            <div className="h-5 w-40 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-2 h-4 w-24 animate-pulse rounded-full bg-slate-200" />
          </div>
        </div>
        <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-32 rounded-[22px] bg-white animate-pulse shadow-sm" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !order || !compactProgress) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center bg-slate-50">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-red-50 text-red-500 ring-1 ring-red-100">
          <XCircle size={29} strokeWidth={2.1} />
        </div>
        <h1 className="mt-5 text-xl font-black text-slate-950">Order not found</h1>
        <p className="mt-2 text-sm text-slate-500">{error || 'We could not find this order.'}</p>
        <button
          type="button"
          onClick={() => navigate('/orders')}
          className="mt-6 h-12 rounded-2xl bg-orange-500 px-6 text-sm font-extrabold text-white shadow-lg shadow-orange-500/20 transition active:scale-[0.98]"
        >
          Back to Orders
        </button>
      </div>
    );
  }

  const payments = order.payments ?? (order.payment ? [order.payment] : []);
  const paymentSummary = getPaymentSummary(order);
  const hasPendingPayment = payments.some((payment) => payment.status === 'pending');
  const quotationReady = Boolean(order.quotation && effectiveStatus === 'quoted');
  const paymentUploadStatuses: OrderStatus[] = ['payment_pending', 'payment_verified', 'order_placed', 'in_transit', 'arrived_at_hub', 'out_for_delivery'];
  const showPaymentUpload = Boolean(
    order.quotation &&
      order.quotation.status === 'approved' &&
      paymentSummary.balanceDue > 0 &&
      !hasPendingPayment &&
      effectiveStatus &&
      paymentUploadStatuses.includes(effectiveStatus)
  );
  const fulfillmentDisplay = getFulfillmentDisplay(order);
  const isSelfPickup = isSelfPickupOrder(order);
  const deliveryHubName = String(order.deliveryHub?.name ?? '').trim();
  const hasSpecificDeliveryHub = !isGenericDeliveryHubName(deliveryHubName);
  const fulfillmentMethodTitle = isSelfPickup
    ? fulfillmentDisplay.title
    : hasSpecificDeliveryHub
      ? deliveryHubName
      : 'Delivery coverage';
  const fulfillmentMethodDescription = isSelfPickup
    ? fulfillmentDisplay.subtitle
    : `${appSettings.orderCoverage.label}. Delivery/pickup currently available in ${appSettings.deliveryHubs.hubNamesJoined}.`;
  const quotationStage = isQuotationRequestStage(effectiveStatus);
  const waitingForQuotation = isWaitingForQuotation(effectiveStatus);
  const detailTitle = quotationStage ? 'Shopping Request' : 'Order Details';
  const currentStatusTitle = quotationStage ? 'Current step' : 'Current status';
  const progressTitle = quotationStage ? 'Shopping progress' : 'Order progress';
  const itemsTitle = quotationStage ? 'Requested items' : 'Items ordered';
  const contactTitle = quotationStage
    ? 'Contact & destination'
    : isSelfPickup
      ? 'Pickup contact'
      : 'Delivery address';
  const methodTitle = quotationStage
    ? isSelfPickup
      ? 'Pickup option'
      : 'Delivery preference'
    : isSelfPickup
      ? 'Pickup option'
      : 'Delivery arrangement';
  const quotationFulfillmentMethodTitle = quotationStage && !isSelfPickup
    ? 'Deliver to me'
    : fulfillmentMethodTitle;
  const quotationFulfillmentDescription = quotationStage && !isSelfPickup
    ? 'Delivery fee will be included in your final price based on the selected area.'
    : fulfillmentMethodDescription;
  const quotationIsReferenceOnly = Boolean(
    effectiveStatus &&
      (effectiveStatus === 'cancelled' || getProgressIndex(effectiveStatus) >= getProgressIndex('payment_verified')),
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-[calc(7.5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-500">
              {quotationStage ? 'Shopping request' : 'Order journey'}
            </p>
            <h1 className="mt-0.5 text-lg font-black tracking-tight text-slate-950">{detailTitle}</h1>
            <p className="truncate text-xs font-medium text-slate-500">#{order.orderNumber}</p>
          </div>
          <CustomerStageBadge status={effectiveStatus ?? order.status} />
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        {waitingForQuotation && (
          <section className="rounded-[22px] bg-emerald-50 px-4 py-3.5 ring-1 ring-emerald-100 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm ring-1 ring-emerald-100">
                <CheckCircle size={20} strokeWidth={2.5} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-emerald-950">Request submitted</p>
                <p className="mt-1 text-xs leading-5 text-emerald-800">
                  We&apos;ll check availability, selected options, and the final price. No payment is required yet.
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="overflow-hidden rounded-[22px] border border-slate-200 bg-white text-slate-950 shadow-sm">
          <div className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{currentStatusTitle}</p>
                <h2 className="mt-1.5 text-2xl font-black tracking-tight text-slate-950">
                  {customerStageLabel(effectiveStatus ?? order.status)}
                </h2>
                <p className="mt-1.5 max-w-md text-sm leading-5 text-slate-600">
                  {statusMessage(order, effectiveStatus ?? order.status)}
                </p>
              </div>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] border border-orange-100 bg-orange-50 shadow-sm">
                {statusIcons[effectiveStatus ?? order.status] ?? (
                  <Package size={30} className="text-orange-500" strokeWidth={2} />
                )}
              </span>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3.5">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Next step</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">{compactProgress.nextText}</p>
              </div>
              <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-black text-slate-700">
                {compactProgress.progressPercent}%
              </span>
            </div>
          </div>

          {quotationReady && order.quotation && (
            <button
              type="button"
              onClick={() => navigate(`/quotation/${order.id}`)}
              className="flex w-full items-center justify-between gap-3 border-t border-orange-400 bg-orange-500 px-4 py-3.5 text-left transition active:bg-orange-600"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white">
                  <FileText size={19} strokeWidth={2.4} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-black text-white">Confirm &amp; Pay</p>
                  <p className="mt-0.5 text-xs text-white/75">Final payable: {money(order.quotation.totalAmount)}</p>
                </div>
              </div>
              <ChevronRight size={20} className="shrink-0 text-white" />
            </button>
          )}

          {showPaymentUpload && order.quotation && (
            <button
              type="button"
              onClick={() => navigate(`/payment/${order.id}`)}
              className="flex w-full items-center justify-between gap-3 border-t border-orange-400 bg-orange-500 px-4 py-3.5 text-left transition active:bg-orange-600"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white">
                  <CreditCard size={19} strokeWidth={2.4} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-black text-white">
                    {paymentSummary.isPartiallyPaid ? 'Pay remaining balance' : 'Upload payment proof'}
                  </p>
                  <p className="mt-0.5 text-xs text-white/75">
                    {paymentSummary.isPartiallyPaid
                      ? `${money(paymentSummary.balanceDue)} remaining`
                      : 'Complete payment to continue your order.'}
                  </p>
                </div>
              </div>
              <ChevronRight size={20} className="shrink-0 text-white" />
            </button>
          )}
        </section>

        <section className="overflow-hidden rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <button
            type="button"
            onClick={() => setTimelineOpen((value) => !value)}
            className="w-full text-left"
            aria-expanded={timelineOpen}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-orange-500">{progressTitle}</p>
                <h3 className="mt-1 text-base font-black text-slate-950">{progressCardTitle}</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">Tap to view every update in Bhutan Time.</p>
              </div>
              <span className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-slate-100 px-3 text-[11px] font-black text-slate-700">
                {timelineOpen ? 'Hide' : 'Timeline'}
                <ChevronDown size={15} className={`transition-transform ${timelineOpen ? 'rotate-180' : ''}`} />
              </span>
            </div>

            <div className="mt-4">
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all ${effectiveStatus === 'cancelled' ? 'bg-red-500' : 'bg-orange-500'}`}
                  style={{ width: `${compactProgress.progressPercent}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                <span>{quotationStage ? 'Requested' : 'Received'}</span>
                <span>{isSelfPickup ? 'Picked up' : 'Delivered'}</span>
              </div>
            </div>
          </button>

          {timelineOpen && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <OrderProgressTimeline order={order} />
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-end justify-between gap-3 px-1">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-orange-500">Products</p>
              <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">{itemsTitle}</h3>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600">
              {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
            </span>
          </div>

          <div className="overflow-hidden rounded-[22px] bg-white shadow-sm ring-1 ring-slate-100">
            {order.items.map((item, index) => (
              <div
                key={item.id}
                className={`p-3.5 ${index < order.items.length - 1 ? 'border-b border-slate-100' : ''}`}
              >
                <div className="flex gap-3">
                  <img
                    src={item.productImage || fallbackImage()}
                    alt={item.productName || 'Order item'}
                    className="h-[76px] w-[76px] shrink-0 rounded-[18px] bg-slate-50 object-cover ring-1 ring-slate-100"
                    loading="lazy"
                    onError={(e) => { (e.target as HTMLImageElement).src = fallbackImage(); }}
                  />
                  <div className="min-w-0 flex-1 py-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.sourcePlatform && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-slate-600">
                          {item.sourcePlatform}
                        </span>
                      )}
                      <span className="text-[11px] font-semibold text-slate-400">Qty {item.quantity}</span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm font-black leading-5 text-slate-950">{item.productName}</p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-slate-950">
                        {itemDisplayPrice(order, item, index)}
                      </p>
                      {item.sourceUrl && /^https?:\/\//i.test(item.sourceUrl) && (
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex shrink-0 items-center gap-1 text-[11px] font-black text-blue-600"
                        >
                          Source <ExternalLink size={12} strokeWidth={2.5} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3 px-1">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-orange-500">Fulfillment</p>
            <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">
              {quotationStage ? 'Request details' : 'Delivery details'}
            </h3>
          </div>

          <div className="overflow-hidden rounded-[22px] bg-white shadow-sm ring-1 ring-slate-100">
            <div className="flex items-start gap-3 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
                <MapPin size={18} strokeWidth={2.4} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{contactTitle}</p>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${fulfillmentDisplay.badgeClass}`}>
                    {fulfillmentDisplay.label}
                  </span>
                </div>
                <p className="mt-1.5 text-sm font-black text-slate-950">
                  {order.shippingAddress.recipientName || 'Customer'}
                </p>
                {order.shippingAddress.phone && (
                  <p className="mt-0.5 text-xs font-semibold text-slate-500">{order.shippingAddress.phone}</p>
                )}
                <p className="mt-1.5 text-xs leading-5 text-slate-600">{safeAddress(order)}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 border-t border-slate-100 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <Truck size={18} strokeWidth={2.4} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{methodTitle}</p>
                <p className="mt-1.5 text-sm font-black text-slate-950">{quotationFulfillmentMethodTitle}</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{quotationFulfillmentDescription}</p>
              </div>
            </div>
          </div>
        </section>

        {order.quotation && (
          <section>
            <div className="mb-3 flex items-end justify-between gap-3 px-1">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-orange-500">Payment</p>
                <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">Payment summary</h3>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                  paymentSummary.isFullyPaid
                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
                    : paymentSummary.isPartiallyPaid
                      ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-100'
                      : hasPendingPayment
                        ? 'bg-orange-50 text-orange-700 ring-1 ring-orange-100'
                        : 'bg-slate-100 text-slate-600 ring-1 ring-slate-100'
                }`}
              >
                {paymentSummary.isFullyPaid
                  ? 'Fully paid'
                  : paymentSummary.isPartiallyPaid
                    ? 'Partially paid'
                    : hasPendingPayment
                      ? 'Under review'
                      : 'Payment due'}
              </span>
            </div>

            <div className="overflow-hidden rounded-[22px] bg-white shadow-sm ring-1 ring-slate-100">
              <div className="p-4">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Total payable</p>
                    <p className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                      {money(paymentSummary.totalPayable)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Balance</p>
                    <p className={`mt-1 text-base font-black ${paymentSummary.balanceDue > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>
                      {money(paymentSummary.balanceDue)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-1.5 ring-1 ring-slate-100">
                  <div className="rounded-xl bg-white px-3 py-2.5 shadow-sm">
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">Verified paid</p>
                    <p className="mt-1 text-sm font-black text-emerald-600">{money(paymentSummary.verifiedPaid)}</p>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2.5 shadow-sm">
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">Pending review</p>
                    <p className="mt-1 text-sm font-black text-slate-950">{money(paymentSummary.pendingAmount)}</p>
                  </div>
                </div>

                {paymentSummary.balanceDue > 0 && !hasPendingPayment && order.quotation.status === 'approved' && (
                  <button
                    type="button"
                    onClick={() => navigate(`/payment/${order.id}`)}
                    className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 text-sm font-black text-white shadow-md shadow-orange-500/15 transition-transform active:scale-[0.98]"
                  >
                    {paymentSummary.isPartiallyPaid ? 'Upload Remaining Payment' : 'Upload Payment Proof'}
                    <ChevronRight size={17} />
                  </button>
                )}

                {hasPendingPayment && (
                  <p className="mt-4 rounded-2xl bg-orange-50 px-3 py-2.5 text-xs font-semibold leading-5 text-orange-700 ring-1 ring-orange-100">
                    A payment proof is under review. Your balance will update after verification.
                  </p>
                )}
              </div>

              {order.payment && (
                <div className="border-t border-slate-100 bg-slate-50/70 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-slate-950">Latest payment</p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                        order.payment.status === 'verified'
                          ? 'bg-emerald-100 text-emerald-700'
                          : order.payment.status === 'rejected'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-orange-100 text-orange-700'
                      }`}
                    >
                      {order.payment.status === 'verified'
                        ? 'Verified'
                        : order.payment.status === 'rejected'
                          ? 'Rejected'
                          : 'Pending'}
                    </span>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-semibold text-slate-500">Method</span>
                      <span className="text-right font-black text-slate-950">{formatPaymentMethod(order.payment.method)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-semibold text-slate-500">Amount</span>
                      <span className="font-black text-slate-950">{money(order.payment.amount)}</span>
                    </div>
                    {order.payment.transactionId && (
                      <div className="flex items-start justify-between gap-4">
                        <span className="shrink-0 font-semibold text-slate-500">Transaction ID</span>
                        <span className="break-all text-right font-mono text-[11px] text-slate-950">
                          {order.payment.transactionId}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {effectiveStatus === 'delivered' && (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => navigate('/shop')}
              className="h-12 rounded-2xl bg-orange-500 text-sm font-black text-white shadow-md shadow-orange-500/15 transition-transform active:scale-[0.98]"
            >
              Order Again
            </button>
            <button
              type="button"
              onClick={() => alert('Reviews coming soon!')}
              className="h-12 rounded-2xl bg-white text-sm font-black text-slate-800 shadow-sm ring-1 ring-slate-200 transition-transform active:scale-[0.98]"
            >
              Write Review
            </button>
          </div>
        )}

        {!quotationReady && order.quotation && effectiveStatus !== 'payment_pending' && (
          <button
            type="button"
            onClick={() => navigate(`/quotation/${order.id}`)}
            className={`flex w-full items-center justify-between rounded-[22px] p-4 text-left shadow-sm ring-1 transition-transform active:scale-[0.99] ${
              quotationIsReferenceOnly ? 'bg-white ring-slate-100' : 'bg-violet-50 ring-violet-100'
            }`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                  quotationIsReferenceOnly
                    ? 'bg-violet-50 text-violet-600'
                    : 'bg-white text-violet-600 shadow-sm'
                }`}
              >
                <FileText size={19} strokeWidth={2.4} />
              </span>
              <div className="min-w-0">
                <p className={`text-sm font-black ${quotationIsReferenceOnly ? 'text-slate-900' : 'text-violet-950'}`}>
                  {quotationIsReferenceOnly ? 'Final price details' : 'View final price'}
                </p>
                <p
                  className={`mt-0.5 text-xs font-semibold ${
                    quotationIsReferenceOnly ? 'text-slate-500' : 'text-violet-700'
                  }`}
                >
                  Total: {money(order.quotation.totalAmount)}
                </p>
              </div>
            </div>
            <ChevronRight
              size={19}
              className={`shrink-0 ${quotationIsReferenceOnly ? 'text-slate-400' : 'text-violet-500'}`}
            />
          </button>
        )}
      </main>
    </div>
  );
}
