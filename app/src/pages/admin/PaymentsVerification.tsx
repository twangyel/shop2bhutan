import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle,
  Copy,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react';
import {
  fetchAdminPayments,
  rejectAdminPaymentById,
  verifyAdminPaymentById,
  paymentSourceBankLabel,
  type AdminPaymentRecord,
} from '@/lib/customerOrders';
import { useAuth } from '@/contexts/AuthContext';
import { usePrivacyScreen } from '@/lib/privacyScreen';
import { useAppToast } from '@/components/shared/AppToast';

const BHUTAN_TIME_ZONE = 'Asia/Thimphu';

const tabs = ['Pending Review', 'Verified', 'Rejected', 'All'] as const;
type PaymentTab = (typeof tabs)[number];

function formatCurrency(value: number) {
  return `Nu. ${Number(value || 0).toLocaleString()}`;
}

function formatDateTime(value?: string) {
  if (!value) return 'Not available';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';

  return `${new Intl.DateTimeFormat('en-GB', {
    timeZone: BHUTAN_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)} BTT`;
}

function readableText(value?: string) {
  const clean = String(value || '').trim();
  if (!clean) return 'Not provided';

  return clean
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function statusLabel(status: AdminPaymentRecord['status']) {
  if (status === 'verified') return 'Verified';
  if (status === 'rejected') return 'Rejected';
  return 'Pending';
}

function statusClass(status: AdminPaymentRecord['status']) {
  if (status === 'verified') {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  }

  if (status === 'rejected') {
    return 'bg-red-50 text-red-700 ring-red-100';
  }

  return 'bg-orange-50 text-orange-700 ring-orange-100';
}

function paymentTypeLabel(paymentType?: AdminPaymentRecord['paymentType']) {
  if (
    paymentType === 'advance' ||
    paymentType === 'partial' ||
    paymentType === 'deposit'
  ) {
    return 'Advance / Partial';
  }

  if (paymentType === 'balance') return 'Remaining Balance';
  if (paymentType === 'full') return 'Full Payment';

  return 'Payment';
}

function paymentTypeClass(paymentType?: AdminPaymentRecord['paymentType']) {
  if (
    paymentType === 'advance' ||
    paymentType === 'partial' ||
    paymentType === 'deposit'
  ) {
    return 'bg-blue-50 text-blue-700 ring-blue-100';
  }

  if (paymentType === 'balance') {
    return 'bg-purple-50 text-purple-700 ring-purple-100';
  }

  if (paymentType === 'full') {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  }

  return 'bg-neutral-100 text-neutral-600 ring-neutral-200';
}

function matchesTab(payment: AdminPaymentRecord, tab: PaymentTab) {
  if (tab === 'All') return true;
  if (tab === 'Pending Review') return payment.status === 'pending';
  if (tab === 'Verified') return payment.status === 'verified';
  if (tab === 'Rejected') return payment.status === 'rejected';
  return true;
}

export default function PaymentsVerification() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const toast = useAppToast();

  usePrivacyScreen();

  const [activeTab, setActiveTab] = useState<PaymentTab>(() =>
    searchParams.get('tab') === 'pending' ? 'Pending Review' : 'Pending Review',
  );
  const [payments, setPayments] = useState<AdminPaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const realPayments = await fetchAdminPayments();
      setPayments(realPayments);
    } catch (err) {
      console.error('Failed to load payments:', err);
      setError(
        err instanceof Error ? err.message : 'Unable to load payments.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return payments.filter((payment) => {
      const searchable = [
        payment.orderNumber,
        payment.customerName,
        payment.customerEmail,
        payment.customerPhone,
        payment.method,
        paymentSourceBankLabel(payment.sourceBank),
        paymentTypeLabel(payment.paymentType),
        payment.transactionId,
        payment.normalizedTransactionId,
        payment.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return (
        matchesTab(payment, activeTab) &&
        (!query || searchable.includes(query))
      );
    });
  }, [payments, activeTab, searchQuery]);

  const stats = useMemo(
    () => ({
      pending: payments.filter((payment) => payment.status === 'pending')
        .length,
      verified: payments.filter((payment) => payment.status === 'verified')
        .length,
      rejected: payments.filter((payment) => payment.status === 'rejected')
        .length,
    }),
    [payments],
  );

  const copyToClipboard = async (text: string) => {
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      toast.success(
        'Reference copied',
        'The transaction reference was copied to your clipboard.',
      );
    } catch {
      toast.error(
        'Unable to copy',
        'Please select and copy the transaction reference manually.',
      );
    }
  };

  const handleVerify = async (paymentId: string) => {
    setUpdatingId(paymentId);
    setError('');

    try {
      await verifyAdminPaymentById(paymentId, user?.id);
      toast.success(
        'Payment verified',
        'The payment has been added to verified collections.',
      );
      await loadPayments();
    } catch (err) {
      console.error('Failed to verify payment:', err);
      const message =
        err instanceof Error ? err.message : 'Unable to verify payment.';
      toast.error('Payment verification failed', message);
    } finally {
      setUpdatingId('');
    }
  };

  const handleReject = async (paymentId: string) => {
    const reason = window.prompt(
      'Reason for rejection?',
      'Payment screenshot is unclear or amount could not be verified.',
    );

    if (reason === null) return;

    setUpdatingId(paymentId);
    setError('');

    try {
      await rejectAdminPaymentById(paymentId, user?.id, reason);
      toast.success(
        'Payment rejected',
        'The customer can now upload a corrected payment proof.',
      );
      await loadPayments();
    } catch (err) {
      console.error('Failed to reject payment:', err);
      const message =
        err instanceof Error ? err.message : 'Unable to reject payment.';
      toast.error('Payment rejection failed', message);
    } finally {
      setUpdatingId('');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Payments</h2>
          <p className="text-sm text-neutral-500">
            Review source bank, transaction reference, screenshot, and payment status.
          </p>
        </div>

        <button
          type="button"
          onClick={loadPayments}
          disabled={loading}
          className="flex h-10 items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-60"
        >
          {loading ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <RefreshCw size={15} />
          )}
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          {
            label: 'Pending',
            value: stats.pending,
            color: 'text-orange-600',
          },
          {
            label: 'Verified',
            value: stats.verified,
            color: 'text-emerald-600',
          },
          {
            label: 'Rejected',
            value: stats.rejected,
            color: 'text-red-600',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl bg-white p-4 shadow-card"
          >
            <p className="text-xs font-medium text-neutral-500">
              {stat.label}
            </p>
            <p className={`mt-1 text-2xl font-bold ${stat.color}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-white p-4 shadow-card">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-amber-500 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="relative w-full lg:w-80">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search payment, order, customer..."
              className="h-10 w-full rounded-lg border border-neutral-200 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={17} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="overflow-hidden rounded-xl bg-white shadow-card">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-neutral-500">
            <Loader2 size={18} className="animate-spin text-amber-500" />
            Loading payments...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-neutral-600">
              No payments found
            </p>
            <p className="mt-1 text-xs text-neutral-400">
              Customer-uploaded payment proofs will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1320px] w-full border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/80">
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                    Order
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                    Customer
                  </th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                    Amount
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                    Payment
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                    Paid From
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                    Reference
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                    Submitted
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                    Status
                  </th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-neutral-100">
                {filtered.map((payment) => {
                  const isUpdating = updatingId === payment.id;
                  const methodLabel = readableText(payment.method);
                  const sourceBankLabel = paymentSourceBankLabel(
                    payment.sourceBank,
                  );
                  const transactionId =
                    payment.transactionId?.trim() || '';

                  return (
                    <tr
                      key={payment.id}
                      className="transition-colors hover:bg-neutral-50/70"
                    >
                      <td className="px-5 py-4 align-middle">
                        <button
                          type="button"
                          onClick={() =>
                            navigate(`/admin/orders/${payment.orderId}`)
                          }
                          className="text-left text-sm font-semibold text-amber-700 hover:underline"
                        >
                          #{payment.orderNumber}
                        </button>
                      </td>

                      <td className="px-5 py-4 align-middle">
                        <div className="min-w-[150px]">
                          <p className="truncate text-sm font-semibold text-gray-900">
                            {payment.customerName || 'Unknown customer'}
                          </p>
                          <p className="mt-0.5 text-xs text-neutral-500">
                            {payment.customerPhone ||
                              payment.customerEmail ||
                              'No contact details'}
                          </p>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-right align-middle">
                        <p className="whitespace-nowrap text-sm font-bold text-gray-900">
                          {formatCurrency(payment.amount)}
                        </p>
                      </td>

                      <td className="px-5 py-4 align-middle">
                        <div className="min-w-[145px] space-y-1.5">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${paymentTypeClass(
                              payment.paymentType,
                            )}`}
                          >
                            {paymentTypeLabel(payment.paymentType)}
                          </span>
                          <p className="text-xs font-medium text-neutral-600">
                            {methodLabel}
                          </p>
                        </div>
                      </td>

                      <td className="px-5 py-4 align-middle">
                        <div className="min-w-[150px]">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${
                              payment.sourceBank
                                ? 'bg-sky-50 text-sky-700 ring-sky-100'
                                : 'bg-neutral-100 text-neutral-500 ring-neutral-200'
                            }`}
                          >
                            {sourceBankLabel}
                          </span>
                          <p className="mt-1.5 text-[10px] font-medium text-neutral-400">
                            Customer&apos;s payment app
                          </p>
                        </div>
                      </td>

                      <td className="px-5 py-4 align-middle">
                        {transactionId ? (
                          <div className="max-w-[210px]">
                            <div className="flex items-center gap-1.5">
                            <span
                              className="truncate font-mono text-xs text-neutral-700"
                              title={transactionId}
                            >
                              {transactionId}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                copyToClipboard(transactionId)
                              }
                              className="shrink-0 rounded p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-amber-600"
                              aria-label="Copy transaction ID"
                            >
                              <Copy size={13} />
                            </button>
                            </div>

                            {payment.duplicateReferenceCount > 0 && (
                              <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2 py-1.5 text-[10px] font-semibold leading-4 text-amber-700 ring-1 ring-amber-100">
                                <AlertCircle size={12} className="mt-0.5 shrink-0" />
                                Used in {payment.duplicateReferenceCount} earlier submission
                                {payment.duplicateReferenceCount === 1 ? '' : 's'}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-neutral-400">
                            Not provided
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 align-middle">
                        <p className="max-w-[155px] text-xs leading-5 text-neutral-600">
                          {formatDateTime(
                            payment.createdAt,
                          )}
                        </p>
                      </td>

                      <td className="px-5 py-4 align-middle">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${statusClass(
                            payment.status,
                          )}`}
                        >
                          {statusLabel(payment.status)}
                        </span>
                      </td>

                      <td className="px-5 py-4 align-middle">
                        <div className="flex min-w-[250px] items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`/admin/orders/${payment.orderId}`)
                            }
                            className="h-9 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
                          >
                            Open Order
                          </button>

                          {payment.screenshotUrl ? (
                            <a
                              href={payment.screenshotUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
                            >
                              <Eye size={14} />
                              Proof
                            </a>
                          ) : (
                            <span className="flex h-9 items-center rounded-lg border border-neutral-100 bg-neutral-50 px-3 text-xs font-medium text-neutral-400">
                              No proof
                            </span>
                          )}

                          {payment.status === 'pending' && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  handleVerify(payment.id)
                                }
                                disabled={isUpdating}
                                className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-60"
                              >
                                {isUpdating ? (
                                  <Loader2
                                    size={14}
                                    className="animate-spin"
                                  />
                                ) : (
                                  <CheckCircle size={14} />
                                )}
                                Verify
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleReject(payment.id)
                                }
                                disabled={isUpdating}
                                className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                                aria-label="Reject payment"
                                title="Reject payment"
                              >
                                <XCircle size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <p className="px-1 text-xs text-neutral-400">
          Showing {filtered.length} of {payments.length} payment
          {payments.length === 1 ? '' : 's'}. Swipe or scroll horizontally on
          smaller screens to view all columns.
        </p>
      )}
    </div>
  );
}
