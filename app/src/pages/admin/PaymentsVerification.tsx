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
  type AdminPaymentRecord,
} from '@/lib/customerOrders';
import { useAuth } from '@/contexts/AuthContext';
import { usePrivacyScreen } from '@/lib/privacyScreen';

const tabs = ['Pending Review', 'Verified', 'Rejected', 'All'] as const;
type PaymentTab = (typeof tabs)[number];

function formatCurrency(value: number) {
  return `Nu. ${Number(value || 0).toLocaleString()}`;
}

function formatDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString();
}

function statusLabel(status: AdminPaymentRecord['status']) {
  if (status === 'verified') return 'Verified';
  if (status === 'rejected') return 'Rejected';
  return 'Pending';
}

function paymentTypeLabel(paymentType?: AdminPaymentRecord['paymentType']) {
  if (paymentType === 'advance' || paymentType === 'partial' || paymentType === 'deposit') return 'Advance / Partial';
  if (paymentType === 'balance') return 'Remaining Balance';
  if (paymentType === 'full') return 'Full Payment';
  return 'Payment';
}

function paymentTypeClass(paymentType?: AdminPaymentRecord['paymentType']) {
  if (paymentType === 'advance' || paymentType === 'partial' || paymentType === 'deposit') return 'bg-blue-50 text-blue-700';
  if (paymentType === 'balance') return 'bg-purple-50 text-purple-700';
  if (paymentType === 'full') return 'bg-emerald-50 text-emerald-700';
  return 'bg-neutral-100 text-neutral-600';
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
      setError(err instanceof Error ? err.message : 'Unable to load payments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayments();
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
        paymentTypeLabel(payment.paymentType),
        payment.transactionId,
        payment.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return matchesTab(payment, activeTab) && (!query || searchable.includes(query));
    });
  }, [payments, activeTab, searchQuery]);

  const stats = useMemo(
    () => ({
      pending: payments.filter((payment) => payment.status === 'pending').length,
      verified: payments.filter((payment) => payment.status === 'verified').length,
      rejected: payments.filter((payment) => payment.status === 'rejected').length,
    }),
    [payments]
  );

  const copyToClipboard = async (text: string) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
  };

  const handleVerify = async (paymentId: string) => {
    setUpdatingId(paymentId);
    setError('');

    try {
      await verifyAdminPaymentById(paymentId, user?.id);
      await loadPayments();
    } catch (err) {
      console.error('Failed to verify payment:', err);
      setError(err instanceof Error ? err.message : 'Unable to verify payment.');
    } finally {
      setUpdatingId('');
    }
  };

  const handleReject = async (paymentId: string) => {
    const reason = window.prompt('Reason for rejection?', 'Payment screenshot is unclear or amount could not be verified.');
    if (reason === null) return;

    setUpdatingId(paymentId);
    setError('');

    try {
      await rejectAdminPaymentById(paymentId, user?.id, reason);
      await loadPayments();
    } catch (err) {
      console.error('Failed to reject payment:', err);
      setError(err instanceof Error ? err.message : 'Unable to reject payment.');
    } finally {
      setUpdatingId('');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Payments</h2>
          <p className="text-sm text-neutral-500">Real customer payment proofs from Supabase.</p>
        </div>
        <button
          type="button"
          onClick={loadPayments}
          disabled={loading}
          className="h-10 px-3 rounded-lg border border-neutral-200 bg-white text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60 flex items-center gap-2"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pending', value: stats.pending, color: 'text-orange-600' },
          { label: 'Verified', value: stats.verified, color: 'text-emerald-600' },
          { label: 'Rejected', value: stats.rejected, color: 'text-red-600' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl p-4 shadow-card">
            <p className="text-xs text-neutral-500">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl p-4 shadow-card">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  activeTab === tab ? 'bg-amber-500 text-white' : 'text-neutral-600 bg-neutral-100 hover:bg-neutral-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="relative w-full lg:w-80">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search payment, order, customer..."
              className="w-full h-10 pl-9 pr-4 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle size={17} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading && (
          <div className="col-span-full rounded-xl bg-white p-10 text-center shadow-card">
            <div className="flex items-center justify-center gap-2 text-sm text-neutral-500">
              <Loader2 size={18} className="animate-spin text-amber-500" />
              Loading payments...
            </div>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="col-span-full rounded-xl bg-white p-10 text-center shadow-card">
            <p className="text-sm font-medium text-neutral-600">No payments found</p>
            <p className="mt-1 text-xs text-neutral-400">Customer uploaded payment proofs will appear here.</p>
          </div>
        )}

        {!loading &&
          filtered.map((payment) => (
            <div key={payment.id} className="bg-white rounded-xl p-5 shadow-card">
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  onClick={() => navigate(`/admin/orders/${payment.orderId}`)}
                  className="text-xs font-semibold text-amber-600 hover:underline"
                >
                  #{payment.orderNumber}
                </button>
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                    payment.status === 'verified'
                      ? 'bg-emerald-50 text-emerald-600'
                      : payment.status === 'rejected'
                        ? 'bg-red-50 text-red-600'
                        : 'bg-orange-50 text-orange-600'
                  }`}
                >
                  {statusLabel(payment.status)}
                </span>
              </div>

              <div className="flex items-end justify-between gap-3">
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(payment.amount)}</p>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${paymentTypeClass(payment.paymentType)}`}>
                  {paymentTypeLabel(payment.paymentType)}
                </span>
              </div>

              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-neutral-500">Customer</span>
                  <span className="font-medium text-right truncate">{payment.customerName || '-'}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-neutral-500">Phone</span>
                  <span className="font-medium text-right">{payment.customerPhone || '-'}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-neutral-500">Method</span>
                  <span className="font-medium text-right">{payment.method || '-'}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-neutral-500">Payment Type</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${paymentTypeClass(payment.paymentType)}`}>
                    {paymentTypeLabel(payment.paymentType)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-neutral-500">Transaction ID</span>
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="font-mono text-xs truncate max-w-[140px]">{payment.transactionId || '-'}</span>
                    {payment.transactionId && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(payment.transactionId)}
                        className="p-0.5 text-neutral-400 hover:text-amber-600"
                        aria-label="Copy transaction ID"
                      >
                        <Copy size={12} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-500">Date</span>
                  <span>{formatDate(payment.createdAt)}</span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => navigate(`/admin/orders/${payment.orderId}`)}
                  className="h-9 flex-1 min-w-[120px] rounded-lg border border-amber-200 bg-amber-50 px-3 text-sm font-semibold text-amber-700 hover:bg-amber-100"
                >
                  Open Order
                </button>
                {payment.screenshotUrl && (
                  <a
                    href={payment.screenshotUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-9 flex-1 min-w-[120px] flex items-center justify-center gap-1.5 rounded-lg border border-neutral-200 text-neutral-700 text-sm font-medium hover:bg-neutral-50"
                  >
                    <Eye size={15} /> View Proof
                  </a>
                )}
                {payment.status === 'pending' && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleVerify(payment.id)}
                      disabled={updatingId === payment.id}
                      className="h-9 flex-1 min-w-[120px] flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-60"
                    >
                      {updatingId === payment.id ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                      Verify
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(payment.id)}
                      disabled={updatingId === payment.id}
                      className="h-9 px-3 flex items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-60"
                      aria-label="Reject payment"
                    >
                      <XCircle size={16} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
