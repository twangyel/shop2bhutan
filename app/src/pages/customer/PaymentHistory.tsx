import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  Loader2,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Wallet,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchCustomerPaymentHistory,
  type CustomerPaymentHistoryRecord,
  type CustomerPaymentHistoryResult,
} from '@/lib/customerOrders';

const BHUTAN_TIME_ZONE = 'Asia/Thimphu';

type PaymentFilter = 'all' | 'pending' | 'verified' | 'rejected';

const filters: { value: PaymentFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
];

function formatCurrency(value: number) {
  return `Nu. ${Number(value || 0).toLocaleString()}`;
}

function formatDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: BHUTAN_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatDateTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return `${new Intl.DateTimeFormat('en-GB', {
    timeZone: BHUTAN_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)} BTT`;
}

function readableText(value?: string) {
  const clean = String(value || '').trim();
  if (!clean) return '';
  return clean
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function paymentTypeLabel(value?: string) {
  if (value === 'advance') return 'Advance Payment';
  if (value === 'balance') return 'Remaining Balance';
  if (value === 'full') return 'Full Payment';
  return 'Payment';
}

function paymentStatusLabel(status: CustomerPaymentHistoryRecord['status']) {
  if (status === 'verified') return 'Verified';
  if (status === 'rejected') return 'Rejected';
  return 'Pending Review';
}

function paymentStatusClass(status: CustomerPaymentHistoryRecord['status']) {
  if (status === 'verified') return 'border-emerald-100 bg-emerald-50 text-emerald-700';
  if (status === 'rejected') return 'border-red-100 bg-red-50 text-red-700';
  return 'border-orange-100 bg-orange-50 text-orange-700';
}

function paymentStatusIcon(status: CustomerPaymentHistoryRecord['status']) {
  if (status === 'verified') return <CheckCircle2 size={16} />;
  if (status === 'rejected') return <XCircle size={16} />;
  return <Clock3 size={16} />;
}

function emptyHistory(): CustomerPaymentHistoryResult {
  return {
    payments: [],
    summary: {
      totalPayments: 0,
      verifiedCount: 0,
      pendingCount: 0,
      rejectedCount: 0,
      verifiedPaid: 0,
      pendingAmount: 0,
      rejectedAmount: 0,
    },
  };
}

function SummaryCard({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string;
  helper: string;
  tone: 'green' | 'orange' | 'red';
}) {
  const toneClass =
    tone === 'green'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
      : tone === 'red'
        ? 'bg-red-50 text-red-700 ring-red-100'
        : 'bg-orange-50 text-orange-700 ring-orange-100';

  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-3 shadow-sm">
      <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wide ring-1 ${toneClass}`}>
        {label}
      </span>
      <p className="mt-3 text-base font-black text-gray-950">{value}</p>
      <p className="mt-0.5 text-[11px] font-medium text-gray-400">{helper}</p>
    </div>
  );
}

function PaymentCard({
  payment,
  onViewOrder,
}: {
  payment: CustomerPaymentHistoryRecord;
  onViewOrder: (orderId: string) => void;
}) {
  const method = readableText(payment.paymentMethod) || 'Payment Method';
  const showRejectedNote = payment.status === 'rejected' && (payment.rejectionReason || payment.adminNotes);
  const showAdminNote = payment.status !== 'rejected' && payment.adminNotes;

  return (
    <article className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold text-gray-400">Order #{payment.orderNumber}</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-gray-950">
              {formatCurrency(payment.amount)}
            </h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-gray-50 px-2.5 py-1 text-[11px] font-bold text-gray-600">
                {paymentTypeLabel(payment.paymentType)}
              </span>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                {method}
              </span>
            </div>
          </div>

          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-black ${paymentStatusClass(payment.status)}`}>
            {paymentStatusIcon(payment.status)}
            {paymentStatusLabel(payment.status)}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-gray-50 p-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Submitted</p>
            <p className="mt-1 text-xs font-bold text-gray-700">{formatDateTime(payment.submittedAt || payment.createdAt)}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              {payment.status === 'verified' ? 'Verified' : payment.status === 'rejected' ? 'Reviewed' : 'Status'}
            </p>
            <p className="mt-1 text-xs font-bold text-gray-700">
              {payment.status === 'verified'
                ? formatDate(payment.verifiedAt)
                : payment.status === 'rejected'
                  ? 'Needs attention'
                  : 'Awaiting admin'}
            </p>
          </div>
        </div>

        {showRejectedNote && (
          <div className="mt-3 rounded-2xl border border-red-100 bg-red-50 p-3 text-xs leading-5 text-red-700">
            <p className="font-black">Reason</p>
            <p className="mt-1">{payment.rejectionReason || payment.adminNotes}</p>
          </div>
        )}

        {showAdminNote && (
          <div className="mt-3 rounded-2xl border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-700">
            <p className="font-black">Admin note</p>
            <p className="mt-1">{payment.adminNotes}</p>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onViewOrder(payment.orderId)}
            className="flex h-11 items-center justify-center gap-1.5 rounded-2xl bg-orange-500 px-3 text-xs font-black text-white transition active:scale-[0.98]"
          >
            View Order
            <ExternalLink size={14} strokeWidth={2.5} />
          </button>

          {payment.proofUrl ? (
            <a
              href={payment.proofUrl}
              target="_blank"
              rel="noreferrer"
              className="flex h-11 items-center justify-center gap-1.5 rounded-2xl border border-gray-200 bg-white px-3 text-xs font-black text-gray-700 transition active:scale-[0.98]"
            >
              View Proof
              <FileText size={14} strokeWidth={2.5} />
            </a>
          ) : (
            <div className="flex h-11 items-center justify-center rounded-2xl border border-gray-100 bg-gray-50 px-3 text-xs font-bold text-gray-400">
              No proof file
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export default function PaymentHistory() {
  const navigate = useNavigate();
  const { user, isGuest } = useAuth();
  const [history, setHistory] = useState<CustomerPaymentHistoryResult>(() => emptyHistory());
  const [filter, setFilter] = useState<PaymentFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadHistory = useCallback(async (options?: { silent?: boolean }) => {
    if (!user?.id || isGuest) {
      setHistory(emptyHistory());
      setLoading(false);
      return;
    }

    const silent = Boolean(options?.silent);

    try {
      if (silent) setRefreshing(true);
      else setLoading(true);

      setError('');
      const result = await fetchCustomerPaymentHistory(user.id);
      setHistory(result);
    } catch (err) {
      console.error('[PaymentHistory] Failed to load payments:', err);
      setError(err instanceof Error ? err.message : 'Unable to load payment history.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isGuest, user?.id]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const filteredPayments = useMemo(() => {
    if (filter === 'all') return history.payments;
    return history.payments.filter((payment) => payment.status === filter);
  }, [filter, history.payments]);

  const handleViewOrder = (orderId: string) => {
    if (!orderId) return;
    navigate(`/order/${orderId}`);
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="sticky top-0 z-10 border-b border-gray-100 bg-white/95 backdrop-blur">
        <div className="px-4 py-3">
          <h1 className="text-lg font-black text-gray-950">Payment History</h1>
          <p className="text-xs font-medium text-gray-500">
            Uploaded proofs, verification status, and related orders
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-4 px-4 py-4">
        <section className="rounded-3xl border border-orange-100 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
              <Wallet size={24} strokeWidth={2.4} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black uppercase tracking-wider text-orange-500">Payments</p>
              <h2 className="mt-1 text-xl font-black text-gray-950">Track every payment proof</h2>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                See what is verified, pending review, or rejected. Payments remain linked to your order for support and delivery tracking.
              </p>
            </div>
            <button
              type="button"
              onClick={() => loadHistory({ silent: true })}
              disabled={loading || refreshing}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-gray-100 bg-white text-gray-500 shadow-sm disabled:opacity-60"
              aria-label="Refresh payment history"
            >
              {refreshing ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={17} />}
            </button>
          </div>
        </section>

        <div className="grid grid-cols-3 gap-2">
          <SummaryCard
            label="Verified"
            value={formatCurrency(history.summary.verifiedPaid)}
            helper={`${history.summary.verifiedCount} paid`}
            tone="green"
          />
          <SummaryCard
            label="Pending"
            value={formatCurrency(history.summary.pendingAmount)}
            helper={`${history.summary.pendingCount} review`}
            tone="orange"
          />
          <SummaryCard
            label="Rejected"
            value={formatCurrency(history.summary.rejectedAmount)}
            helper={`${history.summary.rejectedCount} issue`}
            tone="red"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none]">
          {filters.map((item) => {
            const active = filter === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={`shrink-0 rounded-full border px-4 py-2 text-xs font-black transition ${
                  active
                    ? 'border-orange-500 bg-orange-500 text-white shadow-sm'
                    : 'border-gray-100 bg-white text-gray-600'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-52 animate-pulse rounded-3xl bg-gray-100" />
            ))}
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="rounded-3xl border border-gray-100 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gray-50 text-gray-400">
              <ReceiptText size={30} />
            </div>
            <h3 className="mt-4 text-base font-black text-gray-950">
              {history.payments.length === 0 ? 'No payments yet' : 'No payments in this filter'}
            </h3>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              {history.payments.length === 0
                ? 'Once you upload a payment proof for an accepted quotation, it will appear here.'
                : 'Try another status filter to view your other payment records.'}
            </p>
            <button
              type="button"
              onClick={() => navigate('/orders')}
              className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 text-sm font-black text-white"
            >
              View Orders
              <ExternalLink size={15} />
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPayments.map((payment) => (
              <PaymentCard key={payment.id} payment={payment} onViewOrder={handleViewOrder} />
            ))}
          </div>
        )}

        <div className="rounded-3xl border border-blue-100 bg-blue-50 p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm">
              <ShieldCheck size={18} />
            </span>
            <div>
              <p className="text-sm font-black text-blue-900">Safe payment record</p>
              <p className="mt-1 text-xs leading-5 text-blue-700">
                Payment proofs are private and visible only to you and Shop2Bhutan admin for verification and support.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
