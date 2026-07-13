import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  ReceiptText,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchCustomerPaymentHistory,
  type CustomerPaymentHistoryRecord,
  type CustomerPaymentHistoryResult,
} from '@/lib/customerOrders';
import {
  openOrDownloadPaymentReceipt,
  type PaymentReceiptResult,
} from '@/lib/paymentReceipt';

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
  if (value === 'advance') return 'Advance';
  if (value === 'balance') return 'Balance';
  if (value === 'full') return 'Full Payment';
  return 'Payment';
}

function paymentStatusLabel(status: CustomerPaymentHistoryRecord['status']) {
  if (status === 'verified') return 'Verified';
  if (status === 'rejected') return 'Rejected';
  return 'Pending';
}

function paymentStatusClass(status: CustomerPaymentHistoryRecord['status']) {
  if (status === 'verified') return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  if (status === 'rejected') return 'bg-red-50 text-red-700 ring-red-100';
  return 'bg-orange-50 text-orange-700 ring-orange-100';
}

function paymentStatusIcon(status: CustomerPaymentHistoryRecord['status']) {
  if (status === 'verified') return <CheckCircle2 size={14} />;
  if (status === 'rejected') return <XCircle size={14} />;
  return <Clock3 size={14} />;
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

function CompactSummary({
  history,
}: {
  history: CustomerPaymentHistoryResult;
}) {
  return (
    <section className="overflow-hidden rounded-3xl bg-gray-950 p-4 text-white shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">
            Verified collections
          </p>
          <p className="mt-1 text-3xl font-black tracking-tight text-white">
            {formatCurrency(history.summary.verifiedPaid)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-right">
          <div className="rounded-2xl bg-white/10 px-3 py-2 ring-1 ring-white/10">
            <p className="text-base font-black text-orange-400">{history.summary.pendingCount}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Pending</p>
          </div>
          <div className="rounded-2xl bg-white/10 px-3 py-2 ring-1 ring-white/10">
            <p className="text-base font-black text-red-400">{history.summary.rejectedCount}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Issue</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function PaymentCard({
  payment,
  onViewOrder,
  onReceipt,
  openingReceiptId,
}: {
  payment: CustomerPaymentHistoryRecord;
  onViewOrder: (orderId: string) => void;
  onReceipt: (payment: CustomerPaymentHistoryRecord) => void;
  openingReceiptId: string;
}) {
  const method = readableText(payment.paymentMethod) || 'Payment Method';
  const showRejectedNote = payment.status === 'rejected' && (payment.rejectionReason || payment.adminNotes);
  const showAdminNote = payment.status !== 'rejected' && payment.adminNotes;

  return (
    <article className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-gray-400">Order #{payment.orderNumber}</p>
          <p className="mt-1 text-xl font-black tracking-tight text-gray-950">
            {formatCurrency(payment.amount)}
          </p>
        </div>

        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ${paymentStatusClass(payment.status)}`}>
          {paymentStatusIcon(payment.status)}
          {paymentStatusLabel(payment.status)}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="rounded-full bg-gray-50 px-2.5 py-1 text-[11px] font-bold text-gray-600">
          {paymentTypeLabel(payment.paymentType)}
        </span>
        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
          {method}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 divide-x divide-gray-200 rounded-2xl bg-gray-50 px-3 py-2.5 ring-1 ring-gray-100">
        <div className="pr-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Submitted</p>
          <p className="mt-0.5 text-xs font-bold text-gray-700">{formatDateTime(payment.submittedAt || payment.createdAt)}</p>
        </div>
        <div className="pl-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
            {payment.status === 'verified' ? 'Verified' : payment.status === 'rejected' ? 'Reviewed' : 'Status'}
          </p>
          <p className="mt-0.5 text-xs font-bold text-gray-700">
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

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onViewOrder(payment.orderId)}
          className="flex h-10 items-center justify-center gap-1.5 rounded-2xl bg-orange-500 px-3 text-xs font-black text-white transition active:scale-[0.98]"
        >
          View Order
          <ExternalLink size={13} strokeWidth={2.5} />
        </button>

        {payment.status === 'verified' ? (
          <button
            type="button"
            onClick={() => onReceipt(payment)}
            disabled={openingReceiptId === payment.id}
            className="flex h-10 items-center justify-center gap-1.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-700 transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
          >
            {openingReceiptId === payment.id ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Download size={13} strokeWidth={2.5} />
            )}
            {openingReceiptId === payment.id ? 'Preparing' : 'Receipt'}
          </button>
        ) : payment.proofUrl ? (
          <a
            href={payment.proofUrl}
            target="_blank"
            rel="noreferrer"
            className="flex h-10 items-center justify-center gap-1.5 rounded-2xl border border-gray-200 bg-white px-3 text-xs font-black text-gray-700 transition active:scale-[0.98]"
          >
            Proof
            <FileText size={13} strokeWidth={2.5} />
          </a>
        ) : (
          <div className="flex h-10 items-center justify-center rounded-2xl border border-gray-100 bg-gray-50 px-3 text-xs font-bold text-gray-400">
            No proof
          </div>
        )}
      </div>

      {payment.status === 'verified' && payment.proofUrl && (
        <a
          href={payment.proofUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-2xl border border-gray-200 bg-white px-3 text-[11px] font-bold text-gray-600 transition active:scale-[0.99]"
        >
          View submitted payment proof
          <FileText size={12} strokeWidth={2.4} />
        </a>
      )}
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
  const [openingReceiptId, setOpeningReceiptId] = useState('');
  const [receiptMessage, setReceiptMessage] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);
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

  const showReceiptMessage = (
    tone: 'success' | 'error',
    message: string,
  ) => {
    setReceiptMessage({ tone, text: message });

    window.setTimeout(() => {
      setReceiptMessage((current) =>
        current?.text === message ? null : current,
      );
    }, 3200);
  };

  const handleReceipt = async (
    payment: CustomerPaymentHistoryRecord,
  ) => {
    if (
      payment.status !== 'verified' ||
      openingReceiptId
    ) {
      return;
    }

    setOpeningReceiptId(payment.id);
    setReceiptMessage(null);

    try {
      const result: PaymentReceiptResult =
        await openOrDownloadPaymentReceipt({
          paymentId: payment.id,
          orderNumber: payment.orderNumber,
          amountLabel: formatCurrency(payment.amount),
          paymentType: paymentTypeLabel(payment.paymentType),
          paymentMethod:
            readableText(payment.paymentMethod) || 'Payment Method',
          submittedAt: formatDateTime(
            payment.submittedAt || payment.createdAt,
          ),
          verifiedAt: formatDateTime(payment.verifiedAt),
          status: paymentStatusLabel(payment.status),
        });

      if (result.mode === 'opened') {
        showReceiptMessage(
          'success',
          `Receipt saved and opened as ${result.fileName}.`,
        );
      } else if (result.mode === 'saved') {
        showReceiptMessage(
          'success',
          `Receipt saved as ${result.fileName}. Install a PDF viewer to open it.`,
        );
      } else {
        showReceiptMessage(
          'success',
          `Receipt downloaded as ${result.fileName}.`,
        );
      }
    } catch (receiptError) {
      console.error(
        '[PaymentHistory] Failed to prepare receipt:',
        receiptError,
      );

      showReceiptMessage(
        'error',
        receiptError instanceof Error
          ? receiptError.message
          : 'Unable to prepare the payment receipt.',
      );
    } finally {
      setOpeningReceiptId('');
    }
  };

  return (
    <div className="min-h-screen bg-white pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-20 border-b border-gray-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-orange-500">Payments</p>
            <h1 className="mt-0.5 text-xl font-black tracking-tight text-gray-950">Payment History</h1>
            <p className="truncate text-xs font-medium text-gray-500">
              Proofs, verification status, and related orders
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadHistory({ silent: true })}
            disabled={loading || refreshing}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-gray-600 transition active:scale-95 disabled:opacity-60"
            aria-label="Refresh payment history"
          >
            {refreshing ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={17} />}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-3 px-4 py-4">
        <CompactSummary history={history} />

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

        {receiptMessage && (
          <div
            role="status"
            className={`flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm ${
              receiptMessage.tone === 'success'
                ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                : 'border-red-100 bg-red-50 text-red-700'
            }`}
          >
            {receiptMessage.tone === 'success' ? (
              <CheckCircle2
                size={18}
                className="mt-0.5 shrink-0"
              />
            ) : (
              <AlertCircle
                size={18}
                className="mt-0.5 shrink-0"
              />
            )}
            <span>{receiptMessage.text}</span>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-40 animate-pulse rounded-3xl bg-gray-100" />
            ))}
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="rounded-3xl border border-gray-100 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-gray-50 text-gray-400">
              <ReceiptText size={28} />
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
              <PaymentCard
                key={payment.id}
                payment={payment}
                onViewOrder={handleViewOrder}
                onReceipt={(record) => void handleReceipt(record)}
                openingReceiptId={openingReceiptId}
              />
            ))}
          </div>
        )}

        <p className="px-1 text-center text-[11px] leading-5 text-gray-400">
          Payment proofs are private and used only by Shop2Bhutan admin for verification and support.
        </p>
      </main>
    </div>
  );
}
