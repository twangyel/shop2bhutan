import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ChevronLeft, ChevronRight, Eye, Loader2, Package, RefreshCw, Search } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';
import { fetchAdminOrders } from '@/lib/customerOrders';
import { getFulfillmentDisplay, isSelfPickupOrder } from '@/lib/fulfillment';
import type { Order } from '@/types';

const statusFilters = ['All', 'Pending', 'Quoted', 'In Transit', 'Delivered', 'Cancelled'] as const;
type StatusFilter = (typeof statusFilters)[number];

const pageSize = 10;
const BHUTAN_TIME_ZONE = 'Asia/Thimphu';

function matchesStatus(order: Order, statusFilter: StatusFilter) {
  if (statusFilter === 'All') return true;
  if (statusFilter === 'Pending') {
    return ['pending_confirmation', 'quotation_pending', 'payment_pending'].includes(order.status);
  }
  if (statusFilter === 'Quoted') return order.status === 'quoted' || order.quotation?.status === 'sent';
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
      balanceDue,
      searchableText: `payment rejected ${paymentTypeLabel(rejectedPayment.paymentType)} ${rejectedPayment.method || ''}`,
    };
  }

  return {
    statusLabel: totalPayable > 0 ? 'Unpaid' : 'No Quote Yet',
    statusClass: 'bg-neutral-100 text-neutral-600',
    typeLabel: totalPayable > 0 ? 'Waiting for payment' : 'Quotation pending',
    method: '',
    amountLabel: totalPayable > 0 ? 'No proof uploaded' : 'No quotation total',
    balanceDue,
    searchableText: totalPayable > 0 ? 'unpaid waiting for payment' : 'no quote quotation pending',
  };
}


export default function OrdersPanel() {
  const navigate = useNavigate();
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
      return matchesSearch && matchesStatus(order, statusFilter);
    });
  }, [orders, searchQuery, statusFilter]);

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

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle size={17} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Order #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Fulfillment / Address</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Payment</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Items</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Total</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-sm text-neutral-500">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 size={18} className="animate-spin text-amber-500" />
                      Loading orders...
                    </div>
                  </td>
                </tr>
              )}

              {!loading && paginatedOrders.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-neutral-500">
                      <Package size={34} className="text-neutral-300" />
                      <p className="text-sm font-medium">No orders found</p>
                      <p className="text-xs">New paste-link requests will appear here after customers submit them.</p>
                    </div>
                  </td>
                </tr>
              )}

              {!loading &&
                paginatedOrders.map((order) => {
                  const deliveryAddressText = fullDeliveryAddress(order);
                  const paymentInfo = getOrderPaymentInfo(order);
                  const etaLabel = getOrderEtaLabel(order);

                  return (
                  <tr
                    key={order.id}
                    className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/admin/orders/${order.id}`)}
                  >
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">#{order.orderNumber}</td>
                    <td className="px-4 py-3 text-sm text-neutral-700">
                      <div className="font-medium text-gray-900">{order.user.name}</div>
                      <div className="text-xs text-neutral-500 truncate max-w-[190px]">{order.user.email || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600">{order.user.phone || order.shippingAddress.phone || '-'}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600 max-w-[240px]">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${getFulfillmentDisplay(order).badgeClass}`}>
                          {getFulfillmentDisplay(order).label}
                        </span>
                        <span className="font-medium text-neutral-700">{isSelfPickupOrder(order) ? getFulfillmentDisplay(order).title : order.shippingAddress.dzongkhag || '-'}</span>
                      </div>
                      <div className="mt-1 text-xs text-neutral-400 truncate">{deliveryAddressText || '-'}</div>
                      {etaLabel && (
                        <div className="mt-1 text-xs font-semibold text-blue-600">ETA: {etaLabel}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600 min-w-[210px]">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[11px] font-bold ${paymentInfo.statusClass}`}>
                          {paymentInfo.statusLabel}
                        </span>
                        <div className="text-xs font-semibold text-neutral-700">
                          {paymentInfo.method ? `${paymentInfo.typeLabel} · ${paymentInfo.method}` : paymentInfo.typeLabel}
                        </div>
                        <div className="text-xs text-neutral-500">{paymentInfo.amountLabel}</div>
                        <div className={`text-xs font-medium ${paymentInfo.balanceDue > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          Balance: {formatCurrency(paymentInfo.balanceDue)}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600">{order.items.length}</td>
                    <td className="px-4 py-3 text-sm font-medium">Nu. {order.quotation?.totalAmount?.toLocaleString() || '-'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} size="sm" />
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-500">
                      <div className="font-medium text-neutral-700">{formatBhutanDate(order.createdAt)}</div>
                      <div className="mt-0.5 text-xs text-neutral-400">{formatBhutanTime(order.createdAt)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/admin/orders/${order.id}`);
                        }}
                        className="p-1.5 text-neutral-400 hover:text-amber-600 transition-colors"
                        aria-label="View order"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-100">
          <p className="text-xs text-neutral-500">
            Showing {filteredOrders.length === 0 ? 0 : Math.min((safePage - 1) * pageSize + 1, filteredOrders.length)}-
            {Math.min(safePage * pageSize, filteredOrders.length)} of {filteredOrders.length}
          </p>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="p-1.5 rounded-lg bg-neutral-100 text-neutral-600 disabled:opacity-50 hover:bg-neutral-200 transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="p-1.5 rounded-lg bg-neutral-100 text-neutral-600 disabled:opacity-50 hover:bg-neutral-200 transition-colors"
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
