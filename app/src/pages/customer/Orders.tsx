import { useCallback, useEffect, useMemo, useState, type ElementType } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  CreditCard,
  FileText,
  Headphones,
  ListChecks,
  MapPin,
  Package,
  RefreshCw,
  ShoppingBag,
  Store,
  Truck,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchCustomerOrdersSummary } from '@/lib/customerOrders';
import { supabase } from '@/lib/supabase';
import { getFulfillmentDisplay, isSelfPickupOrder } from '@/lib/fulfillment';
import type { Order, OrderItem, OrderStatus } from '@/types';

type FilterTab = 'all' | 'pending' | 'quoted' | 'in_transit' | 'delivered';

type StageTone = {
  label: string;
  pill: string;
  bar: string;
  iconBg: string;
  iconText: string;
};

const tabs: { key: FilterTab; label: string; shortLabel: string; icon: ElementType }[] = [
  { key: 'all', label: 'All orders', shortLabel: 'All', icon: ListChecks },
  { key: 'pending', label: 'Pending', shortLabel: 'Pending', icon: Clock3 },
  { key: 'quoted', label: 'Final price', shortLabel: 'Final Price', icon: FileText },
  { key: 'in_transit', label: 'In transit', shortLabel: 'Transit', icon: Truck },
  { key: 'delivered', label: 'Delivered', shortLabel: 'Delivered', icon: CheckCircle2 },
];

const ORDER_PROGRESS = [
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
] as const;

const ORDERS_CACHE_PREFIX = 'shop2bhutan:orders:';

function ordersCacheKey(userId: string) {
  return `${ORDERS_CACHE_PREFIX}${userId}`;
}

function readCachedOrders(userId: string): Order[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.sessionStorage.getItem(ordersCacheKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Order[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCachedOrders(userId: string, value: Order[]) {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(ordersCacheKey(userId), JSON.stringify(value));
  } catch {
    // Storage can be unavailable in private mode. Ignore silently.
  }
}

function tabMatches(order: Order, tab: FilterTab) {
  const status = effectiveOrderStatus(order);

  if (tab === 'all') return true;
  if (tab === 'pending') {
    return ['pending_confirmation', 'quotation_pending', 'payment_pending'].includes(status);
  }
  if (tab === 'quoted') return status === 'quoted';
  if (tab === 'in_transit') {
    return ['payment_verified', 'order_placed', 'in_transit', 'arrived_at_hub', 'out_for_delivery'].includes(status);
  }
  if (tab === 'delivered') return status === 'delivered';
  return true;
}

function money(value?: number) {
  return `Nu. ${Number(value ?? 0).toLocaleString()}`;
}

function itemCount(order: Order) {
  return order.items.reduce((total, item) => total + Math.max(1, Number(item.quantity) || 1), 0);
}

function estimatedTotal(order: Order) {
  if (order.quotation?.totalAmount) return order.quotation.totalAmount;

  return order.items.reduce((total, item) => {
    const quantity = Math.max(1, Number(item.quantity) || 1);
    return total + Number(item.unitPrice || 0) * quantity;
  }, 0);
}

function fallbackImage() {
  return (
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180"><rect width="180" height="180" rx="28" fill="#f8fafc"/><rect x="40" y="42" width="100" height="96" rx="24" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/><path d="M67 76h46M67 92h34M67 108h40" stroke="#cbd5e1" stroke-width="7" stroke-linecap="round"/><text x="90" y="157" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="15" font-weight="700" fill="#94a3b8">S2B</text></svg>`,
    )
  );
}

function primaryItem(order: Order): OrderItem {
  return (
    order.items[0] ?? {
      id: `fallback-${order.id}`,
      productName: 'Shop2Bhutan order',
      productImage: fallbackImage(),
      quantity: 1,
      unitPrice: 0,
      attributes: {},
    }
  );
}

type PreviewableOrderItem = OrderItem & {
  screenshotUrl?: string;
  attachmentPath?: string;
};

function isDirectImageUrl(value?: string | null) {
  return Boolean(value && /^(https?:|data:|blob:)/i.test(value.trim()));
}

function isGeneratedFallbackImage(value?: string | null) {
  const cleanValue = value?.trim() || '';
  return cleanValue.startsWith('data:image/svg+xml') && cleanValue.includes('S2B');
}

function OrderItemPreviewImage({
  item,
  compact = false,
}: {
  item: PreviewableOrderItem;
  compact?: boolean;
}) {
  const initialImage =
    (isDirectImageUrl(item.screenshotUrl) && item.screenshotUrl) ||
    (item.productImage && !isGeneratedFallbackImage(item.productImage)
      ? item.productImage
      : fallbackImage());

  const [imageSrc, setImageSrc] = useState(initialImage);

  useEffect(() => {
    let active = true;

    async function loadScreenshotPreview() {
      const screenshotUrl = item.screenshotUrl?.trim() || '';
      const attachmentPath = item.attachmentPath?.trim() || '';

      if (isDirectImageUrl(screenshotUrl)) {
        if (active) setImageSrc(screenshotUrl);
        return;
      }

      if (!attachmentPath) {
        if (
          active &&
          item.productImage &&
          !isGeneratedFallbackImage(item.productImage)
        ) {
          setImageSrc(item.productImage);
        }
        return;
      }

      if (isDirectImageUrl(attachmentPath)) {
        if (active) setImageSrc(attachmentPath);
        return;
      }

      const { data, error } = await supabase.storage
        .from('order-screenshots')
        .createSignedUrl(attachmentPath, 60 * 30);

      if (!active) return;

      if (error) {
        console.warn(
          '[Orders] Product screenshot preview skipped:',
          error.message,
        );
        return;
      }

      if (data?.signedUrl) {
        setImageSrc(data.signedUrl);
      }
    }

    void loadScreenshotPreview();

    return () => {
      active = false;
    };
  }, [
    item.attachmentPath,
    item.productImage,
    item.screenshotUrl,
  ]);

  return (
    <img
      src={imageSrc || fallbackImage()}
      alt={item.productName || 'Product preview'}
      className={`${compact ? 'h-14 w-14 rounded-2xl' : 'h-[72px] w-[72px] rounded-[18px]'} border border-slate-100 bg-slate-50 object-cover`}
      loading="lazy"
      onError={(event) => {
        if (event.currentTarget.src !== fallbackImage()) {
          event.currentTarget.src = fallbackImage();
        }
      }}
    />
  );
}

function readableDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Thimphu',
  }).format(date);
}


function readableDateTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const formatted = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Thimphu',
  }).format(date);

  return formatted.replace(/\b(am|pm)\b/gi, (part) => part.toUpperCase());
}

function firstValidDate(...values: Array<string | undefined>) {
  return values.find((value) => {
    if (!value) return false;
    const date = new Date(value);
    return !Number.isNaN(date.getTime());
  }) || '';
}

function latestPayment(order: Order) {
  const payments = order.payments ?? (order.payment ? [order.payment] : []);

  return [...payments].sort((a, b) => {
    const aTime = new Date(a.verifiedAt || a.createdAt || 0).getTime() || 0;
    const bTime = new Date(b.verifiedAt || b.createdAt || 0).getTime() || 0;
    return bTime - aTime;
  })[0];
}

function effectiveOrderStatus(order: Order): OrderStatus {
  if (order.status === 'cancelled' || order.status === 'delivered') return order.status;

  const statusIndex = ORDER_PROGRESS.indexOf(order.status as (typeof ORDER_PROGRESS)[number]);
  const verifiedIndex = ORDER_PROGRESS.indexOf('payment_verified');
  const paymentIndex = ORDER_PROGRESS.indexOf('payment_pending');
  const payments = order.payments ?? (order.payment ? [order.payment] : []);
  const hasVerified = payments.some((payment) => payment.status === 'verified');
  const hasPendingOrRejected = payments.some(
    (payment) => payment.status === 'pending' || payment.status === 'rejected',
  );

  if (hasVerified && (statusIndex < 0 || statusIndex <= verifiedIndex)) return 'payment_verified';
  if (hasPendingOrRejected && (statusIndex < 0 || statusIndex < paymentIndex)) return 'payment_pending';

  return order.status;
}

function orderEstimatedDelivery(order: Order) {
  const row = order as Order & {
    estimatedDeliveryFrom?: string;
    estimatedDeliveryTo?: string;
    estimatedDeliveryNote?: string;
  };
  const from = readableDate(row.estimatedDeliveryFrom);
  const to = readableDate(row.estimatedDeliveryTo);

  if (from && to && from !== to) return `${from} – ${to}`;
  if (from || to) return from || to;
  return row.estimatedDeliveryNote?.trim() || 'To be updated';
}

function orderDeliveryDestination(order: Order) {
  const display = getFulfillmentDisplay(order);
  if (isSelfPickupOrder(order)) return display.title;

  const parts = [
    order.shippingAddress?.village,
    order.shippingAddress?.gewog,
    order.shippingAddress?.dzongkhag,
  ]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean);

  return Array.from(new Set(parts)).join(', ') || 'Delivery address pending';
}

function orderPrimaryAction(order: Order) {
  const status = effectiveOrderStatus(order);
  const payment = latestPayment(order);

  if (status === 'quoted') {
    return { label: 'Review final price', path: `/quotation/${order.id}` };
  }

  if (status === 'payment_pending' && payment?.status !== 'pending') {
    return {
      label: payment?.status === 'rejected' ? 'Upload corrected proof' : 'Continue payment',
      path: `/payment/${order.id}`,
    };
  }

  return { label: actionText(order), path: `/order/${order.id}` };
}

function stageTone(order: Order): StageTone {
  const status = effectiveOrderStatus(order);

  if (status === 'delivered') {
    return {
      label: 'Delivered',
      pill: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
      bar: 'bg-emerald-500',
      iconBg: 'bg-emerald-50',
      iconText: 'text-emerald-600',
    };
  }

  if (status === 'cancelled') {
    return {
      label: 'Cancelled',
      pill: 'bg-red-50 text-red-700 ring-red-100',
      bar: 'bg-red-500',
      iconBg: 'bg-red-50',
      iconText: 'text-red-600',
    };
  }

  if (status === 'quoted') {
    return {
      label: 'Final price ready',
      pill: 'bg-orange-50 text-orange-700 ring-orange-100',
      bar: 'bg-orange-500',
      iconBg: 'bg-orange-50',
      iconText: 'text-orange-600',
    };
  }

  if (status === 'payment_pending') {
    const paymentStatus = latestPayment(order)?.status;
    return {
      label:
        paymentStatus === 'pending'
          ? 'Payment under review'
          : paymentStatus === 'rejected'
            ? 'Payment rejected'
            : 'Payment pending',
      pill:
        paymentStatus === 'rejected'
          ? 'bg-red-50 text-red-700 ring-red-100'
          : 'bg-orange-50 text-orange-700 ring-orange-100',
      bar: paymentStatus === 'rejected' ? 'bg-red-500' : 'bg-orange-500',
      iconBg: paymentStatus === 'rejected' ? 'bg-red-50' : 'bg-orange-50',
      iconText: paymentStatus === 'rejected' ? 'text-red-600' : 'text-orange-600',
    };
  }

  if (['payment_verified', 'order_placed', 'in_transit', 'arrived_at_hub', 'out_for_delivery'].includes(status)) {
    const labels: Record<string, string> = {
      payment_verified: 'Payment verified',
      order_placed: 'Order placed',
      in_transit: 'In transit',
      arrived_at_hub: 'Arrived at hub',
      out_for_delivery: 'Out for delivery',
    };

    return {
      label: labels[status] ?? 'In progress',
      pill: status === 'payment_verified'
        ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
        : 'bg-blue-50 text-blue-700 ring-blue-100',
      bar: status === 'payment_verified' ? 'bg-emerald-500' : 'bg-blue-500',
      iconBg: status === 'payment_verified' ? 'bg-emerald-50' : 'bg-blue-50',
      iconText: status === 'payment_verified' ? 'text-emerald-600' : 'text-blue-600',
    };
  }

  return {
    label: status === 'quotation_pending' ? 'Checking availability' : 'Request received',
    pill: 'bg-amber-50 text-amber-700 ring-amber-100',
    bar: 'bg-amber-500',
    iconBg: 'bg-amber-50',
    iconText: 'text-amber-600',
  };
}

function orderProgress(order: Order) {
  const status = effectiveOrderStatus(order);

  if (status === 'cancelled') {
    return { percent: 100, stepLabel: 'Cancelled' };
  }

  const index = ORDER_PROGRESS.indexOf(status as (typeof ORDER_PROGRESS)[number]);
  const safeIndex = index >= 0 ? index : 0;

  return {
    percent: Math.round(((safeIndex + 1) / ORDER_PROGRESS.length) * 100),
    stepLabel: `Step ${safeIndex + 1} of ${ORDER_PROGRESS.length}`,
  };
}

function actionText(order: Order) {
  const status = effectiveOrderStatus(order);
  const payment = latestPayment(order);

  if (status === 'quoted') return 'Review final price';
  if (status === 'payment_pending') {
    if (payment?.status === 'pending') return 'View payment status';
    if (payment?.status === 'rejected') return 'Upload corrected proof';
    return 'Continue payment';
  }
  if (status === 'delivered') return 'View completed order';
  if (status === 'cancelled') return 'View order details';
  if (['pending_confirmation', 'quotation_pending'].includes(status)) return 'View request';
  return 'Track order';
}

function statusDescription(order: Order) {
  const status = effectiveOrderStatus(order);
  const payment = latestPayment(order);

  if (status === 'pending_confirmation') return 'Your shopping request has been received.';
  if (status === 'quotation_pending') return 'Shop2Bhutan is checking availability, selected options, prices, and delivery charges.';
  if (status === 'quoted') return 'Availability is confirmed and your final price is ready.';
  if (status === 'payment_pending') {
    if (payment?.status === 'pending') return 'Your payment proof is being verified.';
    if (payment?.status === 'rejected') return 'Please upload a corrected payment screenshot.';
    return 'Confirm the final price and submit your payment proof.';
  }
  if (status === 'payment_verified') return 'Payment is verified. Seller ordering will begin shortly.';
  if (status === 'order_placed') return 'Your products have been ordered from the seller.';
  if (status === 'in_transit') return 'Your order is on the way to Bhutan.';
  if (status === 'arrived_at_hub') return 'Your order has reached the delivery hub.';
  if (status === 'out_for_delivery') return 'Your order is on its final delivery journey.';
  if (status === 'delivered') return 'Your order was delivered successfully.';
  if (status === 'cancelled') return 'This order is no longer active.';
  return 'Open the order to view its latest update.';
}

function amountLabel(order: Order) {
  if (order.quotation?.totalAmount) return 'Final payable';
  if (estimatedTotal(order) > 0) return 'Store estimate';
  return 'Final amount';
}

function quotationItemForOrderItem(
  order: Order,
  item: OrderItem,
  index: number,
) {
  const quotationItems = order.quotation?.items ?? [];
  const hasLinkedOrderItems = quotationItems.some((candidate) => Boolean(candidate.orderItemId));

  if (hasLinkedOrderItems) {
    return quotationItems.find((candidate) => candidate.orderItemId === item.id);
  }

  return quotationItems[index];
}

function quotedItemTotal(order: Order, item: OrderItem, index: number) {
  const quotationItem = quotationItemForOrderItem(order, item, index);
  if (!quotationItem) return 0;

  const quantity = Math.max(1, Number(quotationItem.quantity || item.quantity) || 1);
  const total = Number(quotationItem.totalPrice || 0);
  if (total > 0) return total;

  return Number(quotationItem.unitPrice || 0) * quantity;
}

function needsCustomerAction(order: Order) {
  const status = effectiveOrderStatus(order);
  if (status === 'quoted') return true;
  if (status !== 'payment_pending') return false;
  return latestPayment(order)?.status !== 'pending';
}

function OrderFact({
  icon: Icon,
  label,
  value,
}: {
  icon: ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500 ring-1 ring-slate-100">
        <Icon size={15} strokeWidth={2.1} />
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-400">{label}</p>
        <p className="mt-0.5 break-words text-[11.5px] font-semibold leading-[1.05rem] text-slate-700">{value}</p>
      </div>
    </div>
  );
}

function CustomerOrderRow({
  order,
  expanded,
  onToggle,
}: {
  order: Order;
  expanded: boolean;
  onToggle: () => void;
}) {
  const navigate = useNavigate();
  const item = primaryItem(order);
  const count = itemCount(order);
  const total = estimatedTotal(order);
  const tone = stageTone(order);
  const progress = orderProgress(order);
  const extraItems = Math.max(0, order.items.length - 1);
  const payment = latestPayment(order);
  const status = effectiveOrderStatus(order);
  const primaryAction = orderPrimaryAction(order);
  const fulfillment = getFulfillmentDisplay(order);
  const quotationDate = firstValidDate(
    order.quotation?.respondedAt,
    order.quotation?.createdAt,
  );
  const paymentDate = firstValidDate(
    payment?.verifiedAt,
    payment?.createdAt,
  );

  const openPath = (path: string) => {
    navigate(path);
  };

  return (
    <article
      className={`overflow-hidden rounded-[22px] border bg-white transition ${
        expanded
          ? 'border-slate-200 shadow-[0_10px_28px_rgba(15,23,42,0.06)]'
          : 'border-slate-100 shadow-[0_4px_16px_rgba(15,23,42,0.03)]'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={`order-details-${order.id}`}
        className="w-full p-3.5 text-left transition active:bg-slate-50/70"
      >
        <div className="flex gap-3">
          <div className="shrink-0">
            <OrderItemPreviewImage item={item as PreviewableOrderItem} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold ring-1 ${tone.pill}`}>
                  {status === 'payment_verified' && <CheckCircle2 size={12} strokeWidth={2.5} />}
                  {tone.label}
                </span>
                {extraItems > 0 && (
                  <span className="inline-flex rounded-full bg-slate-900 px-2 py-1 text-[9px] font-black text-white">
                    +{extraItems} {extraItems === 1 ? 'item' : 'items'}
                  </span>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <span className="hidden text-[10.5px] font-semibold text-slate-400 sm:inline">
                  {readableDate(order.createdAt)}
                </span>
                <span className={`flex h-8 w-8 items-center justify-center rounded-full border transition ${expanded ? 'border-orange-100 bg-orange-50 text-orange-600' : 'border-slate-200 bg-white text-slate-500'}`}>
                  <ChevronDown
                    size={16}
                    strokeWidth={2.4}
                    className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                  />
                </span>
              </div>
            </div>

            <p className="mt-2 truncate text-[10.5px] font-bold text-slate-400">
              #{order.orderNumber}
            </p>

            <h2 className="mt-1 line-clamp-2 text-[14px] font-black leading-[1.22rem] text-slate-950">
              {item.productName || 'Shop2Bhutan order'}
            </h2>

            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px] font-semibold text-slate-500">
              <span>{count} {count === 1 ? 'item' : 'items'}</span>
              {item.sourcePlatform && (
                <>
                  <span className="h-1 w-1 rounded-full bg-slate-300" />
                  <span className="capitalize">{item.sourcePlatform}</span>
                </>
              )}
              <span className="sm:hidden">
                <span className="mx-1 h-1 w-1 rounded-full bg-slate-300" />
                {readableDate(order.createdAt)}
              </span>
            </div>

            <div className="mt-2.5 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-slate-400">
                  {amountLabel(order)}
                </p>
                <p className={`mt-0.5 tracking-tight ${total > 0 ? 'text-[18px] font-black text-slate-950' : 'text-[12px] font-bold text-slate-400'}`}>
                  {total > 0 ? money(total) : 'Final price pending'}
                </p>
              </div>
              <span className="shrink-0 text-[10px] font-bold text-slate-400">{progress.stepLabel}</span>
            </div>
          </div>
        </div>
      </button>

      {expanded && (
        <div id={`order-details-${order.id}`} className="border-t border-slate-100 px-3.5 pb-4 pt-3">
          <div className={`rounded-2xl px-3.5 py-3 ${tone.iconBg}`}>
            <div className="flex items-start gap-2.5">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/80 ${tone.iconText}`}>
                {status === 'delivered' || status === 'payment_verified' ? (
                  <CheckCircle2 size={17} strokeWidth={2.4} />
                ) : status === 'in_transit' || status === 'arrived_at_hub' || status === 'out_for_delivery' ? (
                  <Truck size={17} strokeWidth={2.3} />
                ) : status === 'quoted' ? (
                  <FileText size={17} strokeWidth={2.3} />
                ) : (
                  <Package size={17} strokeWidth={2.3} />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-extrabold leading-5 text-slate-700">
                  {statusDescription(order)}
                </p>
                <div className="mt-2.5 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/90 ring-1 ring-black/5">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${tone.bar}`}
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-[10px] font-black text-slate-500">{progress.stepLabel}</span>
                </div>
              </div>
            </div>
          </div>

          <section className="mt-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[12px] font-black text-slate-900">Products in this order</h3>
              <span className="text-[10px] font-bold text-slate-400">
                {count} {count === 1 ? 'item' : 'items'}
              </span>
            </div>

            <div className="mt-2 overflow-hidden rounded-2xl border border-slate-100 bg-white">
              {order.items.map((orderItem, index) => {
                const quantity = Math.max(1, Number(orderItem.quantity) || 1);
                const quotationItem = quotationItemForOrderItem(order, orderItem, index);
                const finalLineTotal = quotedItemTotal(order, orderItem, index);
                const excludedFromFinalPrice = Boolean(order.quotation && !quotationItem);

                return (
                  <div
                    key={orderItem.id || `${order.id}-item-${index}`}
                    className="flex items-center gap-3 border-b border-slate-100 p-3 last:border-b-0"
                  >
                    <OrderItemPreviewImage
                      item={orderItem as PreviewableOrderItem}
                      compact
                    />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[12px] font-extrabold leading-4 text-slate-900">
                        {orderItem.productName || `Product ${index + 1}`}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-semibold text-slate-500">
                        <span>Qty {quantity}</span>
                        {orderItem.sourcePlatform && (
                          <>
                            <span className="h-1 w-1 rounded-full bg-slate-300" />
                            <span className="capitalize">{orderItem.sourcePlatform}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      {excludedFromFinalPrice ? (
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black text-slate-500">
                          Excluded
                        </span>
                      ) : finalLineTotal > 0 ? (
                        <>
                          <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">Final</p>
                          <p className="mt-0.5 text-[11.5px] font-black text-slate-900">
                            {money(finalLineTotal)}
                          </p>
                        </>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400">Price pending</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4">
            <OrderFact
              icon={CalendarDays}
              label="Requested"
              value={readableDateTime(order.createdAt) || 'Date unavailable'}
            />
            <OrderFact
              icon={FileText}
              label="Final price"
              value={quotationDate ? readableDateTime(quotationDate) : 'Not ready yet'}
            />
            <OrderFact
              icon={CreditCard}
              label="Payment"
              value={
                payment
                  ? `${payment.status === 'verified' ? 'Verified' : payment.status === 'rejected' ? 'Rejected' : 'Under review'}${paymentDate ? ` • ${readableDateTime(paymentDate)}` : ''}`
                  : 'Not submitted'
              }
            />
            <OrderFact
              icon={Truck}
              label="Estimated delivery"
              value={orderEstimatedDelivery(order)}
            />
            <OrderFact
              icon={MapPin}
              label={isSelfPickupOrder(order) ? 'Pickup at' : 'Deliver to'}
              value={orderDeliveryDestination(order)}
            />
            <OrderFact
              icon={Store}
              label="Fulfillment"
              value={fulfillment.title || fulfillment.subtitle || 'Delivery arrangement'}
            />
          </div>

          {needsCustomerAction(order) && (
            <div className="mt-4 rounded-2xl border border-orange-100 bg-orange-50 px-3.5 py-3">
              <p className="text-[11.5px] font-extrabold text-orange-800">Your action is needed</p>
              <p className="mt-1 text-[11px] leading-5 text-orange-700">
                Open this order to complete the next step and keep it moving.
              </p>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => openPath(primaryAction.path)}
              className="flex h-11 items-center justify-center gap-1.5 rounded-2xl bg-orange-500 px-3 text-[12px] font-extrabold text-white transition active:scale-[0.98] active:bg-orange-600"
            >
              {primaryAction.label}
              <ChevronRight size={15} strokeWidth={2.5} />
            </button>

            <button
              type="button"
              onClick={() => openPath('/support')}
              className="flex h-11 items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 text-[12px] font-extrabold text-slate-700 transition active:scale-[0.98] active:bg-slate-50"
            >
              Need help?
              <Headphones size={15} strokeWidth={2.3} />
            </button>
          </div>

          {primaryAction.path !== `/order/${order.id}` && (
            <button
              type="button"
              onClick={() => openPath(`/order/${order.id}`)}
              className="mt-2 flex h-10 w-full items-center justify-center gap-1.5 rounded-2xl text-[11.5px] font-bold text-slate-500 transition active:bg-slate-50"
            >
              View complete order details
              <ChevronRight size={14} strokeWidth={2.3} />
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function OrdersSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((item) => (
        <div key={item} className="rounded-[22px] border border-slate-100 bg-white p-3.5">
          <div className="flex gap-3">
            <div className="h-[72px] w-[72px] animate-pulse rounded-[18px] bg-slate-100" />
            <div className="flex-1">
              <div className="flex justify-between gap-3">
                <div className="h-6 w-28 animate-pulse rounded-full bg-slate-100" />
                <div className="h-8 w-8 animate-pulse rounded-full bg-slate-100" />
              </div>
              <div className="mt-2 h-3 w-32 animate-pulse rounded-full bg-slate-100" />
              <div className="mt-2 h-4 w-4/5 animate-pulse rounded-full bg-slate-100" />
              <div className="mt-3 h-6 w-28 animate-pulse rounded-full bg-slate-100" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyOrders({ activeTab, onAdd }: { activeTab: FilterTab; onAdd: () => void }) {
  const title =
    activeTab === 'all'
      ? 'No orders yet'
      : activeTab === 'quoted'
        ? 'No final prices ready'
        : `No ${tabs.find((tab) => tab.key === activeTab)?.label.toLowerCase() ?? ''}`;

  return (
    <section className="rounded-[28px] border border-slate-100 bg-white px-6 py-10 text-center shadow-[0_8px_28px_rgba(15,23,42,0.04)]">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-orange-50 text-orange-500 ring-1 ring-orange-100">
        <ShoppingBag size={29} strokeWidth={2.1} />
      </div>
      <h2 className="mt-5 text-xl font-black tracking-tight text-slate-950">{title}</h2>
      <p className="mx-auto mt-2 max-w-xs text-[14px] leading-6 text-slate-500">
        Shopping requests, final prices, payment updates, and delivery tracking will appear here.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-6 inline-flex h-12 items-center justify-center rounded-2xl bg-orange-500 px-6 text-[14px] font-extrabold text-white shadow-lg shadow-orange-500/20 transition active:scale-[0.98] active:bg-orange-600"
      >
        Add a product
      </button>
    </section>
  );
}

export default function Orders() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [expandedOrderId, setExpandedOrderId] = useState('');

  const loadOrders = useCallback(async () => {
    if (!user) {
      setOrders([]);
      setLoading(false);
      return;
    }

    const cachedOrders = readCachedOrders(user.id);
    if (cachedOrders.length > 0) {
      setOrders(cachedOrders);
      setLoading(false);
    } else {
      setLoading(true);
    }

    setError('');

    try {
      const realOrders = await fetchCustomerOrdersSummary(user.id, user.email ?? '');
      setOrders(realOrders);
      writeCachedOrders(user.id, realOrders);
    } catch (err) {
      console.error('Failed to load customer orders:', err);
      setError(err instanceof Error ? err.message : 'Unable to load your orders.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) void loadOrders();
  }, [authLoading, loadOrders]);

  useEffect(() => {
    const refresh = () => void loadOrders();
    const handleVisibilityChange = () => {
      if (!document.hidden) refresh();
    };

    window.addEventListener('shop2bhutan:orders-updated', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('shop2bhutan:orders-updated', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadOrders]);

  const counts = useMemo(
    () =>
      tabs.reduce(
        (acc, tab) => ({
          ...acc,
          [tab.key]: orders.filter((order) => tabMatches(order, tab.key)).length,
        }),
        {} as Record<FilterTab, number>,
      ),
    [orders],
  );

  const filteredOrders = useMemo(
    () => orders.filter((order) => tabMatches(order, activeTab)),
    [activeTab, orders],
  );

  useEffect(() => {
    if (
      expandedOrderId &&
      !filteredOrders.some((order) => order.id === expandedOrderId)
    ) {
      setExpandedOrderId('');
    }
  }, [expandedOrderId, filteredOrders]);

  const activeCount = useMemo(
    () => orders.filter((order) => !['delivered', 'cancelled'].includes(effectiveOrderStatus(order))).length,
    [orders],
  );
  const actionCount = useMemo(() => orders.filter(needsCustomerAction).length, [orders]);
  if (!authLoading && !user) {
    return (
      <div className="min-h-screen bg-white px-4 py-10">
        <section className="mx-auto max-w-md rounded-[28px] border border-slate-100 bg-white px-6 py-10 text-center shadow-[0_8px_28px_rgba(15,23,42,0.04)]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-orange-50 text-orange-500 ring-1 ring-orange-100">
            <Package size={29} strokeWidth={2.1} />
          </div>
          <h1 className="mt-5 text-xl font-black text-slate-950">Sign in to view orders</h1>
          <p className="mt-2 text-[14px] leading-6 text-slate-500">
            Your shopping requests, final prices, payments, and delivery tracking are securely linked to your account.
          </p>
          <button
            type="button"
            onClick={() => navigate('/login', { state: { from: '/orders' } })}
            className="mt-6 h-12 w-full rounded-2xl bg-orange-500 text-[14px] font-extrabold text-white shadow-lg shadow-orange-500/20 transition active:scale-[0.98]"
          >
            Sign in
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
      <header className="border-b border-slate-100 bg-white px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.8rem)]">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-orange-500">Shopping activity</p>
              <h1 className="mt-1 text-[22px] font-black tracking-tight text-slate-950">My Orders</h1>
              <p className="mt-0.5 text-[12px] leading-5 text-slate-500">Track requests, final prices, payments, and delivery.</p>
            </div>

            <button
              type="button"
              onClick={() => void loadOrders()}
              disabled={loading}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-600 ring-1 ring-slate-100 transition active:scale-95 active:bg-slate-100 disabled:opacity-60"
              aria-label="Refresh orders"
            >
              <RefreshCw size={18} strokeWidth={2.2} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="mt-3 flex min-h-[30px] flex-wrap items-center gap-x-2 gap-y-1.5 pb-0.5 text-[10.5px] font-bold leading-none">
            <span className="inline-flex min-h-[26px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-50 px-2.5 py-1.5 text-slate-600 ring-1 ring-slate-100">
              <span className="font-black text-slate-950">{activeCount}</span>
              Active
            </span>
            <span
              className={`inline-flex min-h-[26px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1.5 ring-1 ${
                actionCount > 0
                  ? 'bg-orange-50 text-orange-700 ring-orange-100'
                  : 'bg-slate-50 text-slate-600 ring-slate-100'
              }`}
            >
              <span className="font-black">{actionCount}</span>
              Needs action
            </span>
          </div>

          <div className="scrollbar-hide -mx-4 mt-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-1.5 pt-0.5">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              const Icon = tab.icon;
              const count = counts[tab.key] || 0;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.key);
                    setExpandedOrderId('');
                  }}
                  aria-label={tab.label}
                  className={`flex min-h-[30px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1.5 text-[11px] font-extrabold leading-none ring-1 transition active:scale-[0.97] ${
                    isActive
                      ? 'bg-orange-500 text-white ring-orange-500 shadow-sm shadow-orange-500/20'
                      : 'bg-white text-slate-600 ring-slate-200 active:bg-slate-50'
                  }`}
                >
                  <Icon size={12.5} strokeWidth={isActive ? 2.6 : 2.1} />
                  <span>{tab.shortLabel}</span>
                  <span
                    className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[8.5px] font-black ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {count > 99 ? '99+' : count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-3">
        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium leading-5 text-red-700">
            {error}
          </div>
        )}

        {loading && orders.length === 0 ? (
          <OrdersSkeleton />
        ) : filteredOrders.length > 0 ? (
          <div className="space-y-3">
            {filteredOrders.map((order) => (
              <CustomerOrderRow
                key={order.id}
                order={order}
                expanded={expandedOrderId === order.id}
                onToggle={() =>
                  setExpandedOrderId((current) =>
                    current === order.id ? '' : order.id,
                  )
                }
              />
            ))}
          </div>
        ) : (
          <EmptyOrders activeTab={activeTab} onAdd={() => navigate('/paste-link')} />
        )}
      </main>
    </div>
  );
}
