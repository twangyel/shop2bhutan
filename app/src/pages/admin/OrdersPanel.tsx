import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ChevronLeft, ChevronRight, Loader2, Package, RefreshCw, Search } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';
import { fetchAdminOrders } from '@/lib/customerOrders';
import { getFulfillmentDisplay, isSelfPickupOrder } from '@/lib/fulfillment';
import type { Order } from '@/types';

const statusFilters = ['All', 'Pending', 'Final Price', 'In Transit', 'Delivered', 'Cancelled'] as const;
type StatusFilter = (typeof statusFilters)[number];

const pageSize = 10;
const BHUTAN_TIME_ZONE = 'Asia/Thimphu';

function matchesStatus(order: Order, statusFilter: StatusFilter) {
  if (statusFilter === 'All') return true;
  if (statusFilter === 'Pending') {
    return ['pending_confirmation', 'quotation_pending', 'payment_pending'].includes(order.status);
  }
  if (statusFilter === 'Final Price') return order.status === 'quoted' || order.quotation?.status === 'sent';
  if (statusFilter === 'In Transit') {
    return ['order_placed', 'in_transit', 'arrived_at_hub', 'out_for_delivery'].includes(order.status);
  }
  if (statusFilter === 'Delivered') return order.status === 'delivered';
  if (statusFilter === 'Cancelled') return order.status === 'cancelled';
  return true;
}

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
  if (isSelfPickupOrder(order)) {
    const display = getFulfillmentDisplay(order);
    return display.details || display.title;
  }

  return compactAddressParts([
    order.shippingAddress.village,
    order.shippingAddress.gewog,
    order.shippingAddress.dzongkhag,
    order.shippingAddress.landmark,
  ]).join(', ');
}

function formatCurrency(value?: number) {
  const amount = Number(value || 0);
  if (!amount || amount <= 0) return 'Nu. 0';
  return `Nu. ${amount.toLocaleString()}`;
}

function shortOrderReference(value?: string) {
  const clean = String(value || '').trim();
  if (!clean) return '#—';

  const numericSuffix = clean.match(/(\d{4,})$/)?.[1];
  if (numericSuffix) return `#${numericSuffix.slice(-5)}`;

  return clean.startsWith('#') ? clean : `#${clean}`;
}


type OrderWithEta = Order & {
  estimatedDeliveryFrom?: string;
  estimatedDeliveryTo?: string;
  estimatedDeliveryNote?: string;
};

function formatEtaDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: BHUTAN_TIME_ZONE,
    day: 'numeric',
    month: 'short',
  }).format(date);
}

function getOrderEtaLabel(order: Order) {
  const etaOrder = order as OrderWithEta;
  const from = formatEtaDate(etaOrder.estimatedDeliveryFrom);
  const to = formatEtaDate(etaOrder.estimatedDeliveryTo);

  if (from && to && from !== to) return `${from} – ${to}`;
  return from || to || '';
}

function readablePaymentMethod(value?: string) {
  const clean = String(value || '').trim();
  if (!clean) return '';
  return clean
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function paymentTypeLabel(paymentType?: string) {
  if (paymentType === 'advance' || paymentType === 'partial' || paymentType === 'deposit') return 'Advance / Partial';
  if (paymentType === 'balance') return 'Remaining Balance';
  if (paymentType === 'full') return 'Full Payment';
  return 'Payment';
}

function getOrderPaymentInfo(order: Order) {
  const payments = order.payments ?? (order.payment ? [order.payment] : []);
  const paymentSummary = order.paymentSummary;
  const totalPayable = paymentSummary?.totalPayable ?? order.quotation?.totalAmount ?? 0;
  const verifiedPaid = paymentSummary?.verifiedPaid ??
    payments
      .filter((payment) => payment.status === 'verified')
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const balanceDue = paymentSummary?.balanceDue ?? Math.max(totalPayable - verifiedPaid, 0);
  const pendingPayment = payments.find((payment) => payment.status === 'pending');
  const rejectedPayment = payments.find((payment) => payment.status === 'rejected');
  const verifiedPayment = payments.find((payment) => payment.status === 'verified');
  const displayPayment = pendingPayment ?? verifiedPayment ?? rejectedPayment ?? payments[0];

  if (pendingPayment) {
    return {
      statusLabel: 'Pending Review',
      statusClass: 'bg-orange-50 text-orange-700',
      typeLabel: paymentTypeLabel(pendingPayment.paymentType),
      method: readablePaymentMethod(pendingPayment.method),
      amountLabel: `Proof: ${formatCurrency(pendingPayment.amount)}`,
      summaryLabel: `${formatCurrency(pendingPayment.amount)} proof uploaded`,
      balanceDue,
      searchableText: `pending review ${paymentTypeLabel(pendingPayment.paymentType)} ${pendingPayment.method || ''}`,
    };
  }

  if (paymentSummary?.coverage === 'fully_paid' || paymentSummary?.coverage === 'overpaid') {
    return {
      statusLabel: 'Fully Paid',
      statusClass: 'bg-emerald-50 text-emerald-700',
      typeLabel: paymentTypeLabel(displayPayment?.paymentType),
      method: readablePaymentMethod(displayPayment?.method),
      amountLabel: `Verified: ${formatCurrency(verifiedPaid)}`,
      summaryLabel: `${formatCurrency(verifiedPaid)} verified`,
      balanceDue,
      searchableText: `fully paid verified ${paymentTypeLabel(displayPayment?.paymentType)} ${displayPayment?.method || ''}`,
    };
  }

  if (paymentSummary?.coverage === 'partial_paid' || verifiedPaid > 0) {
    return {
      statusLabel: 'Partial Paid',
      statusClass: 'bg-blue-50 text-blue-700',
      typeLabel: paymentTypeLabel(displayPayment?.paymentType),
      method: readablePaymentMethod(displayPayment?.method),
      amountLabel: `Verified: ${formatCurrency(verifiedPaid)}`,
      summaryLabel: `${formatCurrency(verifiedPaid)} verified · ${formatCurrency(balanceDue)} due`,
      balanceDue,
      searchableText: `partial paid verified ${paymentTypeLabel(displayPayment?.paymentType)} ${displayPayment?.method || ''}`,
    };
  }

  if (rejectedPayment) {
    return {
      statusLabel: 'Payment Rejected',
      statusClass: 'bg-red-50 text-red-700',
      typeLabel: paymentTypeLabel(rejectedPayment.paymentType),
      method: readablePaymentMethod(rejectedPayment.method),
      amountLabel: `Rejected: ${formatCurrency(rejectedPayment.amount)}`,
      summaryLabel: `${formatCurrency(rejectedPayment.amount)} rejected`,
      balanceDue,
      searchableText: `payment rejected ${paymentTypeLabel(rejectedPayment.paymentType)} ${rejectedPayment.method || ''}`,
    };
  }

  return {
    statusLabel: totalPayable > 0 ? 'Unpaid' : 'Final Price Pending',
    statusClass: 'bg-neutral-100 text-neutral-600',
    typeLabel: totalPayable > 0 ? 'Waiting for payment' : 'Checking availability & price',
    method: '',
    amountLabel: totalPayable > 0 ? 'No proof uploaded' : 'No final price yet',
    summaryLabel: totalPayable > 0 ? `${formatCurrency(totalPayable)} due` : 'Awaiting final price',
    balanceDue,
    searchableText: totalPayable > 0 ? 'unpaid waiting for payment' : 'final price pending checking availability price',
  };
}



function orderAgeHours(order: Order) {
  const value = order.updatedAt || order.createdAt;
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? Math.max(0, (Date.now() - date.getTime()) / (60 * 60 * 1000))
    : 0;
}

function isActionOverdue(order: Order) {
  if (order.status === 'delivered' || order.status === 'cancelled') return false;
  const thresholds: Partial<Record<Order['status'], number>> = {
    pending_confirmation: 12,
    quotation_pending: 12,
    quoted: 48,
    payment_pending: 72,
    payment_verified: 24,
    order_placed: 72,
    in_transit: 168,
    arrived_at_hub: 48,
    out_for_delivery: 24,
  };
  return orderAgeHours(order) >= (thresholds[order.status] ?? 72);
}

export default function OrdersPanel() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const actionFocus = searchParams.get('focus');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [currentPage, setCurrentPage] = useState(1);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const realOrders = await fetchAdminOrders();
      setOrders(realOrders);
    } catch (err) {
      console.error('Failed to load admin orders:', err);
      setError(err instanceof Error ? err.message : 'Unable to load orders.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return orders.filter((order) => {
      const paymentInfo = getOrderPaymentInfo(order);
      const searchableText = [
        order.orderNumber,
        order.user.name,
        order.user.email,
        order.user.phone,
        order.shippingAddress.dzongkhag,
        order.shippingAddress.village,
        order.shippingAddress.gewog,
        order.shippingAddress.landmark,
        fullDeliveryAddress(order),
        getOrderEtaLabel(order),
        (order as OrderWithEta).estimatedDeliveryNote,
        order.notes,
        paymentInfo.statusLabel,
        paymentInfo.typeLabel,
        paymentInfo.method,
        paymentInfo.searchableText,
        ...order.items.map((item) => item.productName),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesSearch = !query || searchableText.includes(query);
      const matchesActionFocus =
        actionFocus === 'quotation'
          ? order.status === 'pending_confirmation' ||
            order.status === 'quotation_pending' ||
            order.quotation?.status === 'pending'
          : actionFocus === 'overdue'
            ? isActionOverdue(order)
            : true;
      return matchesSearch && matchesStatus(order, statusFilter) && matchesActionFocus;
    });
  }, [actionFocus, orders, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedOrders = filteredOrders.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Orders</h1>
          <p className="text-sm text-neutral-500">Real customer requests from Supabase.</p>
        </div>
        <button
          type="button"
          onClick={loadOrders}
          disabled={loading}
          className="h-9 px-3 rounded-lg bg-white border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60 flex items-center gap-2"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search order number, customer, phone, item..."
              className="w-full h-9 pl-9 pr-4 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            {statusFilters.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  statusFilter === status
                    ? 'bg-amber-500 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {actionFocus && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          <span className="font-semibold">
            {actionFocus === 'quotation'
              ? 'Showing orders that need quotation preparation.'
              : 'Showing active orders that may be overdue.'}
          </span>
          <button type="button" onClick={() => navigate('/admin/orders')} className="text-xs font-extrabold text-orange-700">
            Clear focus
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle size={17} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="overflow-hidden rounded-xl bg-white shadow-card">
        <div className="max-h-[calc(100vh-15rem)] overflow-auto">
          <table className="w-full min-w-[1180px]">
            <thead className="sticky top-0 z-10 bg-neutral-50">
              <tr className="border-b border-neutral-200">
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Order
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Customer
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Fulfilment
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Payment
                </th>
                <th className="px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Items
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Total
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Status
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Date
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-neutral-500">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 size={18} className="animate-spin text-amber-500" />
                      Loading orders...
                    </div>
                  </td>
                </tr>
              )}

              {!loading && paginatedOrders.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-neutral-500">
                      <Package size={34} className="text-neutral-300" />
                      <p className="text-sm font-medium">No orders found</p>
                      <p className="text-xs">
                        New paste-link requests will appear here after customers submit them.
                      </p>
                    </div>
                  </td>
                </tr>
              )}

              {!loading &&
                paginatedOrders.map((order) => {
                  const deliveryAddressText = fullDeliveryAddress(order);
                  const paymentInfo = getOrderPaymentInfo(order);
                  const etaLabel = getOrderEtaLabel(order);
                  const fulfillment = getFulfillmentDisplay(order);
                  const customerPhone =
                    order.user.phone || order.shippingAddress.phone || 'No phone';
                  const fulfillmentLocation = isSelfPickupOrder(order)
                    ? fulfillment.title
                    : deliveryAddressText || order.shippingAddress.dzongkhag || 'Address pending';
                  const quotedTotal = Number(order.quotation?.totalAmount || 0);

                  return (
                    <tr
                      key={order.id}
                      className="cursor-pointer border-b border-neutral-100 align-middle transition-colors last:border-0 hover:bg-neutral-50/80"
                      onClick={() => navigate(`/admin/orders/${order.id}`)}
                    >
                      <td className="px-4 py-2.5">
                        <div
                          className="whitespace-nowrap text-sm font-bold text-gray-900"
                          title={order.orderNumber}
                        >
                          {shortOrderReference(order.orderNumber)}
                        </div>
                      </td>

                      <td className="px-4 py-2.5">
                        <div className="max-w-[190px] truncate text-sm font-semibold text-gray-900">
                          {order.user.name || 'Customer'}
                        </div>
                        <div className="mt-0.5 text-xs leading-4 text-neutral-500">
                          {customerPhone}
                        </div>
                      </td>

                      <td className="max-w-[280px] px-4 py-2.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${fulfillment.badgeClass}`}
                        >
                          {fulfillment.label}
                        </span>
                        <div
                          className="mt-1 truncate text-xs font-medium leading-4 text-neutral-700"
                          title={fulfillmentLocation}
                        >
                          {fulfillmentLocation}
                        </div>
                        {etaLabel && (
                          <div className="mt-0.5 text-xs font-semibold leading-4 text-blue-600">
                            {etaLabel}
                          </div>
                        )}
                      </td>

                      <td className="min-w-[180px] px-4 py-2.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${paymentInfo.statusClass}`}
                        >
                          {paymentInfo.statusLabel}
                        </span>
                        <div className="mt-1 whitespace-nowrap text-xs font-medium leading-4 text-neutral-600">
                          {paymentInfo.summaryLabel}
                        </div>
                      </td>

                      <td className="px-4 py-2.5 text-center text-sm font-semibold tabular-nums text-neutral-700">
                        {order.items.length}
                      </td>

                      <td className="px-4 py-2.5 text-right">
                        {quotedTotal > 0 ? (
                          <span className="whitespace-nowrap text-sm font-bold tabular-nums text-gray-900">
                            {formatCurrency(quotedTotal)}
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-neutral-400">
                            Pending
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-2.5">
                        <StatusBadge status={order.status} size="sm" />
                      </td>

                      <td className="px-4 py-2.5">
                        <div className="whitespace-nowrap text-xs font-semibold text-neutral-700">
                          {formatBhutanDate(order.createdAt)}
                        </div>
                        <div className="mt-0.5 whitespace-nowrap text-[11px] leading-4 text-neutral-400">
                          {formatBhutanTime(order.createdAt)}
                        </div>
                      </td>

                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/admin/orders/${order.id}`);
                          }}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 text-xs font-bold text-neutral-600 transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700"
                          aria-label={`View ${shortOrderReference(order.orderNumber)}`}
                        >
                          View
                          <ChevronRight size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-neutral-100 px-4 py-3">
          <p className="text-xs text-neutral-500">
            Showing{' '}
            {filteredOrders.length === 0
              ? 0
              : Math.min((safePage - 1) * pageSize + 1, filteredOrders.length)}
            -{Math.min(safePage * pageSize, filteredOrders.length)} of{' '}
            {filteredOrders.length}
          </p>

          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={safePage === 1}
              className="rounded-lg bg-neutral-100 p-1.5 text-neutral-600 transition-colors hover:bg-neutral-200 disabled:opacity-50"
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={safePage === totalPages}
              className="rounded-lg bg-neutral-100 p-1.5 text-neutral-600 transition-colors hover:bg-neutral-200 disabled:opacity-50"
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
