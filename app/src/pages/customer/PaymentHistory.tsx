import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Package,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
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
import { usePrivacyScreen } from '@/lib/privacyScreen';

const BHUTAN_TIME_ZONE = 'Asia/Thimphu';
const SHOP2BHUTAN_APP_URL = 'https://shop2bhutan.vercel.app';

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

  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: BHUTAN_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);

  return `${formatted.replace(/\b(am|pm)\b/gi, (value) => value.toUpperCase())} BTT`;
}

function readableText(value?: string) {
  const clean = String(value || '').trim();
  if (!clean) return '';
  return clean
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function paymentTypeLabel(value?: string) {
  if (value === 'advance') return 'Advance payment';
  if (value === 'balance') return 'Balance payment';
  if (value === 'full') return 'Full payment';
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

function paymentStatusDotClass(status: CustomerPaymentHistoryRecord['status']) {
  if (status === 'verified') return 'bg-emerald-500';
  if (status === 'rejected') return 'bg-red-500';
  return 'bg-orange-500';
}

function paymentStatusIcon(status: CustomerPaymentHistoryRecord['status']) {
  if (status === 'verified') return <CheckCircle2 size={14} />;
  if (status === 'rejected') return <XCircle size={14} />;
  return <Clock3 size={14} />;
}

function orderLabel(orderNumber?: string) {
  const clean = String(orderNumber || '').trim();
  if (!clean) return '#Order';
  return clean.startsWith('#') ? clean : `#${clean}`;
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

function filterCount(
  filter: PaymentFilter,
  history: CustomerPaymentHistoryResult,
) {
  if (filter === 'pending') return history.summary.pendingCount;
  if (filter === 'verified') return history.summary.verifiedCount;
  if (filter === 'rejected') return history.summary.rejectedCount;
  return history.summary.totalPayments || history.payments.length;
}

function RowAction({
  payment,
  onReceipt,
  openingReceiptId,
}: {
  payment: CustomerPaymentHistoryRecord;
  onReceipt: (payment: CustomerPaymentHistoryRecord) => void;
  openingReceiptId: string;
}) {
  if (payment.status === 'verified') {
    return (
      <button
        type="button"
        onClick={() => onReceipt(payment)}
        disabled={Boolean(openingReceiptId)}
        className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-500 transition hover:bg-gray-100 active:scale-95 disabled:cursor-wait disabled:opacity-50"
        aria-label={`Download receipt for ${orderLabel(payment.orderNumber)}`}
      >
        {openingReceiptId === payment.id ? (
          <Loader2 size={17} className="animate-spin" />
        ) : (
          <Download size={17} strokeWidth={2.1} />
        )}
      </button>
    );
  }

  if (payment.proofUrl) {
    return (
      <a
        href={payment.proofUrl}
        target="_blank"
        rel="noreferrer"
        className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-500 transition hover:bg-gray-100 active:scale-95"
        aria-label={`View payment proof for ${orderLabel(payment.orderNumber)}`}
      >
        <FileText size={17} strokeWidth={2.1} />
      </a>
    );
  }

  return null;
}

function PaymentRow({
  payment,
  expanded,
  onToggle,
  onViewOrder,
  onReceipt,
  openingReceiptId,
}: {
  payment: CustomerPaymentHistoryRecord;
  expanded: boolean;
  onToggle: () => void;
  onViewOrder: (orderId: string) => void;
  onReceipt: (payment: CustomerPaymentHistoryRecord) => void;
  openingReceiptId: string;
}) {
  const method = readableText(payment.paymentMethod) || 'Payment method';
  const submittedAt = payment.submittedAt || payment.createdAt;
  const showRejectedNote =
    payment.status === 'rejected' &&
    Boolean(payment.rejectionReason || payment.adminNotes);
  const showAdminNote =
    payment.status !== 'rejected' && Boolean(payment.adminNotes);

  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-white transition-all ${
        expanded
          ? 'border-gray-200 shadow-[0_12px_34px_rgba(15,23,42,0.07)]'
          : 'border-gray-100 shadow-sm'
      }`}
    >
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={onToggle}
          className="min-w-0 flex-1 px-4 py-3.5 text-left transition active:bg-gray-50"
          aria-expanded={expanded}
        >
          <div className="md:hidden">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 truncate text-[12px] font-bold text-gray-500">
                {orderLabel(payment.orderNumber)}
              </p>
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ring-1 ${paymentStatusClass(payment.status)}`}
              >
                {paymentStatusIcon(payment.status)}
                {paymentStatusLabel(payment.status)}
              </span>
            </div>

            <div className="mt-2 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-lg font-black tracking-tight text-gray-950">
                  {formatCurrency(payment.amount)}
                </p>
                <p className="mt-0.5 truncate text-[11px] font-medium text-gray-500">
                  {paymentTypeLabel(payment.paymentType)} • {method}
                </p>
              </div>
              <p className="shrink-0 text-[11px] font-semibold text-gray-400">
                {formatDate(submittedAt)}
              </p>
            </div>
          </div>

          <div className="hidden grid-cols-[minmax(0,1.7fr)_110px_110px_140px] items-center gap-4 md:grid">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-gray-700">
                {orderLabel(payment.orderNumber)}
              </p>
              <p className="mt-0.5 truncate text-xs text-gray-400">
                {paymentTypeLabel(payment.paymentType)} • {method}
              </p>
            </div>
            <p className="text-sm font-black text-gray-950">
              {formatCurrency(payment.amount)}
            </p>
            <span className="inline-flex items-center gap-2 text-xs font-bold text-gray-600">
              <span className={`h-2 w-2 rounded-full ${paymentStatusDotClass(payment.status)}`} />
              {paymentStatusLabel(payment.status)}
            </span>
            <p className="text-xs font-semibold text-gray-500">
              {formatDate(submittedAt)}
            </p>
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-0.5 pr-2">
          <RowAction
            payment={payment}
            onReceipt={onReceipt}
            openingReceiptId={openingReceiptId}
          />
          <button
            type="button"
            onClick={onToggle}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 transition hover:bg-gray-100 active:scale-95"
            aria-label={expanded ? 'Collapse payment details' : 'Expand payment details'}
          >
            {expanded ? (
              <ChevronDown size={18} strokeWidth={2.2} />
            ) : (
              <ChevronRight size={18} strokeWidth={2.2} />
            )}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3">
          <div className="grid gap-2 rounded-2xl bg-gray-50 p-3 ring-1 ring-gray-100 sm:grid-cols-2">
            <div className="flex items-start justify-between gap-3 sm:block">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
                Submitted
              </p>
              <p className="text-right text-xs font-bold text-gray-700 sm:mt-1 sm:text-left">
                {formatDateTime(submittedAt)}
              </p>
            </div>
            <div className="flex items-start justify-between gap-3 sm:block">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
                {payment.status === 'verified'
                  ? 'Verified'
                  : payment.status === 'rejected'
                    ? 'Reviewed'
                    : 'Status'}
              </p>
              <p className="text-right text-xs font-bold text-gray-700 sm:mt-1 sm:text-left">
                {payment.status === 'verified'
                  ? formatDateTime(payment.verifiedAt)
                  : payment.status === 'rejected'
                    ? 'Needs attention'
                    : 'Awaiting admin review'}
              </p>
            </div>
          </div>

          {payment.status === 'verified' && (
            <div className="mt-3 flex items-center gap-2 rounded-2xl bg-emerald-50 px-3 py-2.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">
              <ShieldCheck size={17} strokeWidth={2.1} />
              <span>{payment.adminNotes || 'Verified by Shop2Bhutan'}</span>
            </div>
          )}

          {showRejectedNote && (
            <div className="mt-3 rounded-2xl border border-red-100 bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-700">
              <p className="font-black">Reason</p>
              <p className="mt-0.5">
                {payment.rejectionReason || payment.adminNotes}
              </p>
            </div>
          )}

          {showAdminNote && payment.status !== 'verified' && (
            <div className="mt-3 rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2.5 text-xs leading-5 text-gray-600">
              <p className="font-black text-gray-700">Shop2Bhutan note</p>
              <p className="mt-0.5">{payment.adminNotes}</p>
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onViewOrder(payment.orderId)}
              className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-orange-200 bg-white px-3 text-xs font-black text-orange-600 transition active:scale-[0.98]"
            >
              <Package size={15} strokeWidth={2.2} />
              View Order
            </button>

            {payment.status === 'verified' ? (
              <button
                type="button"
                onClick={() => onReceipt(payment)}
                disabled={Boolean(openingReceiptId)}
                className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 text-xs font-black text-gray-700 transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
              >
                {openingReceiptId === payment.id ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Download size={15} strokeWidth={2.2} />
                )}
                {openingReceiptId === payment.id ? 'Preparing' : 'Receipt'}
              </button>
            ) : payment.proofUrl ? (
              <a
                href={payment.proofUrl}
                target="_blank"
                rel="noreferrer"
                className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 text-xs font-black text-gray-700 transition active:scale-[0.98]"
              >
                <FileText size={15} strokeWidth={2.2} />
                View Proof
              </a>
            ) : (
              <div className="flex h-11 items-center justify-center rounded-2xl border border-gray-100 bg-gray-50 px-3 text-xs font-bold text-gray-400">
                No proof available
              </div>
            )}
          </div>

          {payment.status === 'verified' && payment.proofUrl && (
            <a
              href={payment.proofUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 flex h-9 w-full items-center justify-center gap-1.5 text-[11px] font-bold text-gray-500 underline decoration-dotted underline-offset-4 transition active:scale-[0.99]"
            >
              View submitted payment proof
              <FileText size={12} strokeWidth={2.2} />
            </a>
          )}
        </div>
      )}
    </article>
  );
}

export default function PaymentHistory() {
  const navigate = useNavigate();
  const { user, isGuest } = useAuth();
  usePrivacyScreen();
  const [history, setHistory] = useState<CustomerPaymentHistoryResult>(() => emptyHistory());
  const [filter, setFilter] = useState<PaymentFilter>('all');
  const [expandedPaymentId, setExpandedPaymentId] = useState('');
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
          orderId: payment.orderId,
          orderNumber: payment.orderNumber,
          transactionId: payment.transactionId,
          amountLabel: formatCurrency(payment.amount),
          orderTotalLabel:
            payment.orderTotal > 0
              ? formatCurrency(payment.orderTotal)
              : undefined,
          previouslyPaidLabel: formatCurrency(
            payment.previouslyVerified,
          ),
          balanceDueLabel:
            payment.orderTotal > 0
              ? formatCurrency(payment.balanceDue)
              : undefined,
          paymentType: paymentTypeLabel(payment.paymentType),
          paymentMethod:
            readableText(payment.paymentMethod) || 'Payment Method',
          submittedAt: formatDateTime(
            payment.submittedAt || payment.createdAt,
          ),
          verifiedAt: formatDateTime(payment.verifiedAt),
          status: paymentStatusLabel(payment.status),
          customerName: payment.customerName,
          customerPhone: payment.customerPhone,
          logoPath: '/brand/logo-full-ui.png',
          appUrl: SHOP2BHUTAN_APP_URL,
          verificationUrl: payment.receiptVerificationToken
            ? `${SHOP2BHUTAN_APP_URL}/verify-payment/${encodeURIComponent(
                payment.receiptVerificationToken,
              )}`
            : undefined,
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
    <div className="min-h-screen bg-white pb-[calc(6.5rem+var(--s2b-safe-area-bottom,env(safe-area-inset-bottom,0px)))]">
      <header className="sticky top-0 z-20 border-b border-gray-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 pb-3 pt-[calc(var(--s2b-safe-area-top,env(safe-area-inset-top,0px))+0.75rem)]">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-orange-500">Payments</p>
            <h1 className="mt-0.5 text-xl font-black tracking-tight text-gray-950">Payment History</h1>
            <p className="truncate text-xs font-medium text-gray-500">
              Receipts, proofs, and payment status
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadHistory({ silent: true })}
            disabled={loading || refreshing}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-gray-100 bg-gray-50 text-gray-600 transition active:scale-95 disabled:opacity-60"
            aria-label="Refresh payment history"
          >
            {refreshing ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-4">
        <div className="grid grid-cols-4 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          {filters.map((item) => {
            const active = filter === item.value;
            const count = filterCount(item.value, history);
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => {
                  setFilter(item.value);
                  setExpandedPaymentId('');
                }}
                className={`min-w-0 px-2 py-3 text-[11px] font-black transition sm:text-xs ${
                  active
                    ? 'bg-orange-500 text-white'
                    : 'border-l border-gray-100 text-gray-600 first:border-l-0 hover:bg-gray-50'
                }`}
              >
                <span className="truncate">{item.label} {count}</span>
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
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            ) : (
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
            )}
            <span>{receiptMessage.text}</span>
          </div>
        )}

        {loading ? (
          <div className="space-y-2.5">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-[78px] animate-pulse rounded-2xl bg-gray-100" />
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
          <section>
            <div className="mb-2 hidden grid-cols-[minmax(0,1.7fr)_110px_110px_140px_78px] items-center gap-4 px-4 text-[10px] font-black uppercase tracking-[0.12em] text-gray-400 md:grid">
              <span>Order</span>
              <span>Amount</span>
              <span>Status</span>
              <span>Submitted</span>
              <span className="text-center">Actions</span>
            </div>

            <div className="space-y-2.5">
              {filteredPayments.map((payment) => (
                <PaymentRow
                  key={payment.id}
                  payment={payment}
                  expanded={expandedPaymentId === payment.id}
                  onToggle={() =>
                    setExpandedPaymentId((current) =>
                      current === payment.id ? '' : payment.id,
                    )
                  }
                  onViewOrder={handleViewOrder}
                  onReceipt={(record) => void handleReceipt(record)}
                  openingReceiptId={openingReceiptId}
                />
              ))}
            </div>
          </section>
        )}

        <p className="px-1 text-center text-[11px] leading-5 text-gray-400">
          Payment proofs are private and used only by Shop2Bhutan admin for verification and support.
        </p>
      </main>
    </div>
  );
}
