import { useCallback, useEffect, useMemo, useState } from 'react';
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
  Loader2,
  Package,
  Share2,
  Truck,
  XCircle,
  ArrowLeft,
} from 'lucide-react';
import { appSettings } from '@/data/mockData';
import { useAuth } from '@/contexts/AuthContext';
import { fetchCustomerOrderById, fetchCustomerOrderByIdFast } from '@/lib/customerOrders';
import { getFulfillmentDisplay, isSelfPickupOrder } from '@/lib/fulfillment';
import { shareTextContent } from '@/lib/nativeShare';
import type { Order, OrderStatus } from '@/types';

const BHUTAN_TIME_ZONE = 'Asia/Thimphu';

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

function itemPriceDisplay(order: Order, item: Order['items'][number], index: number) {
  const quotationItem =
    order.quotation?.items?.find((candidate) => candidate.orderItemId === item.id) ??
    order.quotation?.items?.[index];
  const quantity = Math.max(1, Number(item.quantity) || 1);
  const quotedTotal = Number(quotationItem?.totalPrice || 0);
  const quotedUnitPrice = Number(quotationItem?.unitPrice || 0);
  const orderUnitPrice = Number(item.unitPrice || 0);

  if (quotedTotal > 0) {
    return { label: 'Final price', value: money(quotedTotal), muted: false };
  }

  if (quotedUnitPrice > 0) {
    return { label: 'Final price', value: money(quotedUnitPrice * quantity), muted: false };
  }

  if (orderUnitPrice > 0) {
    return { label: 'Store price', value: money(orderUnitPrice * quantity), muted: false };
  }

  return { label: 'Final price', value: 'Pending', muted: true };
}

function OrderItemPrice({
  order,
  item,
  index,
}: {
  order: Order;
  item: Order['items'][number];
  index: number;
}) {
  const price = itemPriceDisplay(order, item, index);

  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{price.label}</p>
      <p className={`mt-0.5 text-sm font-bold ${price.muted ? 'text-gray-400' : 'text-gray-900'}`}>
        {price.value}
      </p>
    </div>
  );
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
  if (status === 'pending_confirmation') return 'Request Received';
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

function getStatusBadgeClass(status?: OrderStatus) {
  if (status === 'cancelled') return 'bg-red-50 text-red-600';
  if (status === 'delivered') return 'bg-emerald-50 text-emerald-600';
  if (status === 'payment_verified') return 'bg-emerald-50 text-emerald-600';
  if (status === 'quoted') return 'bg-violet-50 text-violet-600';
  if (isWaitingForQuotation(status)) return 'bg-amber-50 text-amber-600';
  return 'bg-orange-50 text-orange-600';
}

function getCompactProgress(order: Order) {
  const effectiveStatus = getEffectiveOrderStatus(order);
  const totalSteps = progressSteps.length;

  if (effectiveStatus === 'cancelled') {
    return {
      currentLabel: 'Order cancelled',
      nextText: 'This order is no longer active.',
      progressPercent: 100,
      stepLabel: 'Cancelled',
    };
  }

  const index = getProgressIndex(effectiveStatus);
  const current = displayProgressStep(progressSteps[index] ?? progressSteps[0], order);
  const progressPercent = Math.round(((index + 1) / totalSteps) * 100);

  return {
    currentLabel: current.label,
    nextText: current.next,
    progressPercent,
    stepLabel: `Step ${index + 1} of ${totalSteps}`,
  };
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
    <div className="relative pl-7">
      <div className="absolute left-[11px] top-2 bottom-5 w-px bg-gray-200" aria-hidden="true" />

      {progressSteps.map((step, index) => {
        const isCompleted = currentIndex > index;
        const isCurrent = currentIndex === index;
        const isActive = isCompleted || isCurrent;
        const timestamp = stepTimestamp(order, step.status);
        const formattedTime = formatBhutanDateTime(timestamp);
        const event = latestTrackingEvent(order, step.status);
        const displayStep = displayProgressStep(step, order);

        if (!isActive && !isCompleted) return null;

        return (
          <div key={step.status} className="relative mb-5 last:mb-0">
            <div className="absolute -left-7 top-0.5">
              {isCompleted ? (
                <div className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-orange-500">
                  <CheckCircle size={12} className="text-white" strokeWidth={3} />
                </div>
              ) : isCurrent ? (
                <div className="flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-orange-500 bg-white">
                  <div className="h-2 w-2 rounded-full bg-orange-500" />
                </div>
              ) : (
                <div className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-gray-100">
                  <Clock size={12} className="text-gray-400" strokeWidth={2} />
                </div>
              )}
            </div>

            <p className={`text-sm font-bold ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>
              {displayStep.label}
            </p>
            {formattedTime && (
              <p className="mt-0.5 text-xs text-gray-400">{formattedTime}</p>
            )}
            {(event?.message || displayStep.description) && (
              <p className={`mt-1 text-xs leading-relaxed ${isActive ? 'text-gray-600' : 'text-gray-400'}`}>
                {event?.message || displayStep.description}
              </p>
            )}
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
  const [sharingOrder, setSharingOrder] = useState(false);
  const [shareFeedback, setShareFeedback] = useState('');
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
  const effectiveStatus = useMemo(() => (order ? getEffectiveOrderStatus(order) : undefined), [order]);

  const shareOrderUpdate = async () => {
    if (!order || sharingOrder) return;

    setSharingOrder(true);
    setShareFeedback('');

    try {
      const status = customerStageLabel(effectiveStatus ?? order.status);
      const requestLabel = isQuotationRequestStage(effectiveStatus ?? order.status)
        ? 'Shopping Request'
        : 'Order';

      const result = await shareTextContent({
        title: `Shop2Bhutan ${requestLabel} #${order.orderNumber}`,
        dialogTitle: 'Share order update',
        text: [
          `Shop2Bhutan ${requestLabel} #${order.orderNumber}`,
          `Status: ${status}`,
          statusMessage(order, effectiveStatus ?? order.status),
          '',
          'Open Shop2Bhutan to view the complete private details.',
        ].join('\n'),
      });

      if (result === 'copied') {
        setShareFeedback('Order update copied');
        window.setTimeout(() => setShareFeedback(''), 2200);
      }
    } catch (shareError) {
      console.warn('Unable to share order update:', shareError);
      setShareFeedback('Unable to share right now');
      window.setTimeout(() => setShareFeedback(''), 2600);
    } finally {
      setSharingOrder(false);
    }
  };

  if (!authLoading && !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center bg-white">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
          <Package size={29} strokeWidth={2.1} />
        </div>
        <h1 className="mt-5 text-xl font-bold text-gray-900">Sign in to view</h1>
        <p className="mt-2 text-sm text-gray-500">
          Your order details are securely linked to your account.
        </p>
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="mt-6 h-12 rounded-xl bg-orange-500 px-6 text-sm font-bold text-white transition active:scale-[0.98]"
        >
          Sign In
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="border-b border-gray-100 px-4 py-3">
          <div className="mx-auto max-w-2xl">
            <div className="h-5 w-40 animate-pulse rounded-full bg-gray-100" />
            <div className="mt-2 h-4 w-24 animate-pulse rounded-full bg-gray-100" />
          </div>
        </div>
        <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-28 rounded-xl bg-gray-50 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !order || !compactProgress) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center bg-white">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-500">
          <XCircle size={29} strokeWidth={2.1} />
        </div>
        <h1 className="mt-5 text-xl font-bold text-gray-900">Order not found</h1>
        <p className="mt-2 text-sm text-gray-500">{error || 'We could not find this order.'}</p>
        <button
          type="button"
          onClick={() => navigate('/orders')}
          className="mt-6 h-12 rounded-xl bg-orange-500 px-6 text-sm font-bold text-white transition active:scale-[0.98]"
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
    <div className="min-h-screen bg-white pb-[calc(6rem+env(safe-area-inset-bottom))]">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/95 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/orders')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-700 transition active:scale-95"
            aria-label="Back"
          >
            <ArrowLeft size={20} strokeWidth={2.2} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-gray-900">Order Details</h1>
          </div>
          <button
            type="button"
            onClick={() => void shareOrderUpdate()}
            disabled={sharingOrder}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-600 transition active:scale-95 disabled:opacity-60"
            aria-label="Share order update"
          >
            {sharingOrder ? <Loader2 size={16} className="animate-spin text-orange-500" /> : <Share2 size={17} strokeWidth={2.2} />}
          </button>
        </div>
        {shareFeedback && (
          <p className="mx-auto mt-1 max-w-2xl text-right text-[11px] font-medium text-gray-500" role="status">
            {shareFeedback}
          </p>
        )}
      </header>

      <main className="mx-auto max-w-2xl px-5 py-5">
        {/* Status Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-orange-500">Order Journey</p>
            <h2 className="mt-1 text-[22px] font-bold text-gray-900">
              {customerStageLabel(effectiveStatus ?? order.status)}
            </h2>
            <p className="mt-1 text-[13px] text-gray-500">#{order.orderNumber}</p>
          </div>
          <span className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-bold ${getStatusBadgeClass(effectiveStatus ?? order.status)}`}>
            {customerStageLabel(effectiveStatus ?? order.status)}
          </span>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          {statusMessage(order, effectiveStatus ?? order.status)}
        </p>

        {/* Progress Bar */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-gray-400">{compactProgress.stepLabel}</span>
            <span className="text-[11px] font-semibold text-gray-400">{compactProgress.progressPercent}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full transition-all ${effectiveStatus === 'cancelled' ? 'bg-red-500' : 'bg-orange-500'}`}
              style={{ width: `${compactProgress.progressPercent}%` }}
            />
          </div>
        </div>

        {/* Primary CTA */}
        {quotationReady && order.quotation && (
          <button
            type="button"
            onClick={() => navigate(`/quotation/${order.id}`)}
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 text-sm font-bold text-white transition active:scale-[0.98]"
          >
            <FileText size={17} strokeWidth={2.4} />
            Confirm & Pay — {money(order.quotation.totalAmount)}
          </button>
        )}

        {showPaymentUpload && order.quotation && (
          <button
            type="button"
            onClick={() => navigate(`/payment/${order.id}`)}
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 text-sm font-bold text-white transition active:scale-[0.98]"
          >
            <CreditCard size={17} strokeWidth={2.4} />
            {paymentSummary.isPartiallyPaid ? `Pay remaining ${money(paymentSummary.balanceDue)}` : 'Upload Payment Proof'}
          </button>
        )}

        {/* Timeline Toggle */}
        <section className="mt-6">
          <button
            type="button"
            onClick={() => setTimelineOpen((v) => !v)}
            className="flex w-full items-center justify-between text-left"
            aria-expanded={timelineOpen}
          >
            <div>
              <h3 className="text-[15px] font-bold text-gray-900">Status History</h3>
              <p className="mt-0.5 text-xs text-gray-400">Tap to view every update</p>
            </div>
            <span className="flex items-center gap-1 text-[12px] font-semibold text-gray-500">
              {timelineOpen ? 'Hide' : 'View'}
              <ChevronDown size={15} className={`transition-transform ${timelineOpen ? 'rotate-180' : ''}`} />
            </span>
          </button>

          {timelineOpen && (
            <div className="mt-4">
              <OrderProgressTimeline order={order} />
            </div>
          )}
        </section>

        {/* Items */}
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[15px] font-bold text-gray-900">{itemsTitle}</h3>
            <span className="text-[12px] font-semibold text-gray-500">
              {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
            </span>
          </div>

          <div className="divide-y divide-gray-100">
            {order.items.map((item, index) => (
              <div key={item.id} className="flex gap-3.5 py-4 first:pt-0">
                <img
                  src={item.productImage || fallbackImage()}
                  alt={item.productName || 'Order item'}
                  className="h-16 w-16 shrink-0 rounded-xl bg-gray-50 object-cover"
                  loading="lazy"
                  onError={(e) => { (e.target as HTMLImageElement).src = fallbackImage(); }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {item.sourcePlatform && (
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-gray-500">
                        {item.sourcePlatform}
                      </span>
                    )}
                    <span className="text-[11px] text-gray-400">Qty {item.quantity}</span>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm font-bold text-gray-900 leading-snug">
                    {item.productName}
                  </p>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <OrderItemPrice order={order} item={item} index={index} />
                    {item.sourceUrl && /^https?:\/\//i.test(item.sourceUrl) && (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-orange-500"
                      >
                        Source <ExternalLink size={12} strokeWidth={2.5} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Delivery Details */}
        <section className="mt-8">
          <h3 className="text-[15px] font-bold text-gray-900 mb-3">
            {quotationStage ? 'Request Details' : 'Delivery Details'}
          </h3>

          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-500">
                <MapPin size={18} strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{contactTitle}</p>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${fulfillmentDisplay.badgeClass}`}>
                    {fulfillmentDisplay.label}
                  </span>
                </div>
                <p className="mt-1 text-sm font-bold text-gray-900">
                  {order.shippingAddress.recipientName || 'Customer'}
                </p>
                {order.shippingAddress.phone && (
                  <p className="mt-0.5 text-xs text-gray-500">{order.shippingAddress.phone}</p>
                )}
                <p className="mt-1.5 text-xs leading-relaxed text-gray-600">{safeAddress(order)}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-500">
                <Truck size={18} strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{methodTitle}</p>
                <p className="mt-1 text-sm font-bold text-gray-900">{quotationFulfillmentMethodTitle}</p>
                <p className="mt-1 text-xs leading-relaxed text-gray-600">{quotationFulfillmentDescription}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Payment Summary */}
        {order.quotation && (
          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-gray-900">Payment Summary</h3>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                paymentSummary.isFullyPaid
                  ? 'bg-emerald-50 text-emerald-600'
                  : paymentSummary.isPartiallyPaid
                    ? 'bg-blue-50 text-blue-600'
                    : hasPendingPayment
                      ? 'bg-orange-50 text-orange-600'
                      : 'bg-gray-100 text-gray-600'
              }`}>
                {paymentSummary.isFullyPaid
                  ? 'Fully paid'
                  : paymentSummary.isPartiallyPaid
                    ? 'Partially paid'
                    : hasPendingPayment
                      ? 'Under review'
                      : 'Payment due'}
              </span>
            </div>

            <div className="flex items-end justify-between gap-4 mb-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Total Payable</p>
                <p className="mt-1 text-[22px] font-bold text-gray-900">{money(paymentSummary.totalPayable)}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Balance</p>
                <p className={`mt-1 text-base font-bold ${paymentSummary.balanceDue > 0 ? 'text-orange-500' : 'text-emerald-600'}`}>
                  {money(paymentSummary.balanceDue)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Verified Paid</p>
                <p className="mt-1 text-[15px] font-bold text-emerald-600">{money(paymentSummary.verifiedPaid)}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Pending Review</p>
                <p className="mt-1 text-[15px] font-bold text-gray-900">{money(paymentSummary.pendingAmount)}</p>
              </div>
            </div>

            {paymentSummary.balanceDue > 0 && !hasPendingPayment && order.quotation.status === 'approved' && (
              <button
                type="button"
                onClick={() => navigate(`/payment/${order.id}`)}
                className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 text-sm font-bold text-white transition active:scale-[0.98]"
              >
                {paymentSummary.isPartiallyPaid ? 'Upload Remaining Payment' : 'Upload Payment Proof'}
                <ChevronRight size={17} />
              </button>
            )}

            {hasPendingPayment && (
              <p className="mt-4 rounded-xl bg-orange-50 px-3 py-2.5 text-xs font-medium leading-relaxed text-orange-700">
                A payment proof is under review. Your balance will update after verification.
              </p>
            )}

            {order.payment && (
              <div className="mt-4 rounded-xl bg-gray-50 p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-gray-900">Latest Payment</p>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                    order.payment.status === 'verified'
                      ? 'bg-emerald-100 text-emerald-700'
                      : order.payment.status === 'rejected'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-orange-100 text-orange-700'
                  }`}>
                    {order.payment.status === 'verified' ? 'Verified' : order.payment.status === 'rejected' ? 'Rejected' : 'Pending'}
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500">Method</span>
                    <span className="font-bold text-gray-900">{formatPaymentMethod(order.payment.method)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500">Amount</span>
                    <span className="font-bold text-gray-900">{money(order.payment.amount)}</span>
                  </div>
                  {order.payment.transactionId && (
                    <div className="flex justify-between gap-4">
                      <span className="shrink-0 text-gray-500">Transaction ID</span>
                      <span className="break-all text-right font-mono text-[11px] text-gray-900">
                        {order.payment.transactionId}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Delivered Actions */}
        {effectiveStatus === 'delivered' && (
          <div className="mt-8 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => navigate('/shop')}
              className="h-12 rounded-xl bg-orange-500 text-sm font-bold text-white transition active:scale-[0.98]"
            >
              Order Again
            </button>
            <button
              type="button"
              onClick={() => alert('Reviews coming soon!')}
              className="h-12 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-800 transition active:scale-[0.98]"
            >
              Write Review
            </button>
          </div>
        )}

        {/* Quotation Reference */}
        {!quotationReady && order.quotation && effectiveStatus !== 'payment_pending' && (
          <button
            type="button"
            onClick={() => navigate(`/quotation/${order.id}`)}
            className={`mt-6 flex w-full items-center justify-between rounded-xl p-4 text-left transition active:scale-[0.99] ${
              quotationIsReferenceOnly ? 'bg-gray-50' : 'bg-violet-50'
            }`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                quotationIsReferenceOnly ? 'bg-gray-100 text-gray-600' : 'bg-white text-violet-600'
              }`}>
                <FileText size={18} strokeWidth={2.4} />
              </span>
              <div className="min-w-0">
                <p className={`text-sm font-bold ${quotationIsReferenceOnly ? 'text-gray-900' : 'text-violet-900'}`}>
                  {quotationIsReferenceOnly ? 'Final price details' : 'View final price'}
                </p>
                <p className={`mt-0.5 text-xs ${quotationIsReferenceOnly ? 'text-gray-500' : 'text-violet-700'}`}>
                  Total: {money(order.quotation.totalAmount)}
                </p>
              </div>
            </div>
            <ChevronRight size={19} className={`shrink-0 ${quotationIsReferenceOnly ? 'text-gray-400' : 'text-violet-500'}`} />
          </button>
        )}
      </main>
    </div>
  );
}
