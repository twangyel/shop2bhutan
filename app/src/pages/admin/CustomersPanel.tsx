import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Eye,
  KeyRound,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import {
  fetchAdminCustomers,
  reactivateCustomerAccount,
  resetCustomerTemporaryPassword,
  type AdminCustomerRecord,
} from '@/lib/customerOrders';

type StatusFilter = 'all' | 'active' | 'deactivated';

function formatCurrency(value: number) {
  return `Nu. ${Number(value || 0).toLocaleString()}`;
}

function formatDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.toLocaleString('en-GB', {
    timeZone: 'Asia/Thimphu',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })} BTT`;
}

function isDeactivated(customer: AdminCustomerRecord) {
  return customer.accountStatus === 'deactivated' || customer.isActive === false;
}

function statusBadgeClass(customer: AdminCustomerRecord) {
  return isDeactivated(customer)
    ? 'bg-rose-50 text-rose-700 border border-rose-100'
    : 'bg-emerald-50 text-emerald-700 border border-emerald-100';
}

export default function CustomersPanel() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<AdminCustomerRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [reactivatingId, setReactivatingId] = useState('');
  const [resettingId, setResettingId] = useState('');
  const [resetResult, setResetResult] = useState<{
    customer: AdminCustomerRecord;
    temporaryPassword: string;
    copied: boolean;
  } | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'reactivate' | 'reset-password';
    customer: AdminCustomerRecord;
  } | null>(null);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const realCustomers = await fetchAdminCustomers();
      setCustomers(realCustomers);
    } catch (err) {
      console.error('Failed to load customers:', err);
      setError(err instanceof Error ? err.message : 'Unable to load customers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  const counts = useMemo(() => {
    return customers.reduce(
      (acc, customer) => {
        acc.all += 1;
        if (isDeactivated(customer)) acc.deactivated += 1;
        else acc.active += 1;
        return acc;
      },
      { all: 0, active: 0, deactivated: 0 },
    );
  }, [customers]);

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return customers.filter((customer) => {
      const deactivated = isDeactivated(customer);

      if (statusFilter === 'active' && deactivated) return false;
      if (statusFilter === 'deactivated' && !deactivated) return false;

      const searchable = [
        customer.name,
        customer.email,
        customer.phone,
        customer.dzongkhag,
        customer.accountStatus,
        customer.deactivationReason,
        customer.mustChangePassword ? 'temporary password must change password reset' : '',
        customer.accountType === 'email' ? 'email account' : 'phone-only',
        deactivated ? 'deactivated inactive disabled' : 'active enabled',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return !query || searchable.includes(query);
    });
  }, [customers, searchQuery, statusFilter]);

  function handleReactivate(customer: AdminCustomerRecord) {
    setError('');
    setSuccess('');
    setConfirmAction({ type: 'reactivate', customer });
  }

  function handleResetPassword(customer: AdminCustomerRecord) {
    if (isDeactivated(customer)) {
      setError('Reactivate this customer before resetting the password.');
      return;
    }

    setError('');
    setSuccess('');
    setConfirmAction({ type: 'reset-password', customer });
  }

  async function confirmReactivate(customer: AdminCustomerRecord) {
    try {
      setReactivatingId(customer.id);
      setError('');
      setSuccess('');

      await reactivateCustomerAccount(customer.id);
      setSuccess(`${customer.name || 'Customer'} has been reactivated.`);
      await loadCustomers();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to reactivate customer.',
      );
    } finally {
      setReactivatingId('');
    }
  }

  async function confirmResetPassword(customer: AdminCustomerRecord) {
    try {
      setResettingId(customer.id);
      setError('');
      setSuccess('');
      setResetResult(null);

      const result = await resetCustomerTemporaryPassword(customer.id);
      setResetResult({
        customer,
        temporaryPassword: result.temporaryPassword,
        copied: false,
      });
      setSuccess(`Temporary password generated for ${customer.name || 'customer'}.`);
      await loadCustomers();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to generate temporary password.',
      );
    } finally {
      setResettingId('');
    }
  }

  async function handleConfirmAction() {
    if (!confirmAction) return;

    const action = confirmAction;
    setConfirmAction(null);

    if (action.type === 'reactivate') {
      await confirmReactivate(action.customer);
      return;
    }

    await confirmResetPassword(action.customer);
  }

  async function copyTemporaryPassword() {
    if (!resetResult?.temporaryPassword) return;

    try {
      await navigator.clipboard.writeText(resetResult.temporaryPassword);
      setResetResult((current) =>
        current ? { ...current, copied: true } : current,
      );
    } catch {
      setError('Unable to copy automatically. Please select and copy the password manually.');
    }
  }

  const filterButtons: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'active', label: 'Active', count: counts.active },
    { key: 'deactivated', label: 'Deactivated', count: counts.deactivated },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Customers</h2>
          <p className="text-sm text-neutral-500">
            {customers.length} real registered{' '}
            {customers.length === 1 ? 'customer' : 'customers'} from Supabase.
          </p>
        </div>
        <button
          type="button"
          onClick={loadCustomers}
          disabled={loading}
          className="flex h-10 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
        >
          {loading ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <RefreshCw size={15} />
          )}
          Refresh
        </button>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-card">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search customers..."
              className="h-9 w-full rounded-lg border border-neutral-200 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {filterButtons.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setStatusFilter(item.key)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  statusFilter === item.key
                    ? 'bg-amber-500 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {item.label} ({item.count})
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={17} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 size={17} className="mt-0.5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="overflow-hidden rounded-xl bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1240px]">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-500">
                  Customer
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-500">
                  Contact
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-500">
                  Dzongkhag
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-500">
                  Account
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-500">
                  Orders
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-500">
                  Verified Spend
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-500">
                  Joined
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-500">
                  Last Order
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-neutral-500">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-sm text-neutral-500">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 size={18} className="animate-spin text-amber-500" />
                      Loading customers...
                    </div>
                  </td>
                </tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center">
                    <p className="text-sm font-medium text-neutral-600">
                      No customers found
                    </p>
                    <p className="mt-1 text-xs text-neutral-400">
                      Registered customer profiles will appear here.
                    </p>
                  </td>
                </tr>
              )}

              {!loading &&
                filtered.map((customer) => {
                  const deactivated = isDeactivated(customer);
                  const isReactivating = reactivatingId === customer.id;
                  const isResetting = resettingId === customer.id;

                  return (
                    <tr
                      key={customer.id}
                      className="border-b border-neutral-100 transition-colors last:border-0 hover:bg-neutral-50"
                    >
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${
                              deactivated
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {(customer.name || customer.phone || 'C')
                              .charAt(0)
                              .toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {customer.name || 'Customer'}
                            </p>
                            <p className="text-xs text-neutral-400">
                              {deactivated
                                ? 'Deactivated customer profile'
                                : customer.mustChangePassword
                                  ? 'Temporary password active'
                                  : 'Active customer profile'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-neutral-600">
                        <div>{customer.phone || '-'}</div>
                        <div className="text-xs text-neutral-400">
                          {customer.email || 'No email provided'}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-neutral-600">
                        {customer.dzongkhag || '-'}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                            customer.accountType === 'email'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {customer.accountType === 'email'
                            ? 'Email account'
                            : 'Phone-only'}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="space-y-1.5">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${statusBadgeClass(
                              customer,
                            )}`}
                          >
                            {deactivated ? <XCircle size={13} /> : <CheckCircle2 size={13} />}
                            {deactivated ? 'Deactivated' : 'Active'}
                          </span>

                          {customer.mustChangePassword && !deactivated && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                              <ShieldAlert size={12} />
                              Must change password
                            </span>
                          )}

                          {customer.passwordResetByAdminAt && (
                            <p className="text-[11px] text-neutral-400">
                              Reset: {formatDateTime(customer.passwordResetByAdminAt)}
                            </p>
                          )}

                          {deactivated && customer.deactivatedAt && (
                            <p className="text-[11px] text-neutral-400">
                              {formatDateTime(customer.deactivatedAt)}
                            </p>
                          )}

                          {deactivated && customer.deactivationReason && (
                            <p className="max-w-[220px] truncate text-[11px] text-neutral-500">
                              Reason: {customer.deactivationReason}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-sm font-semibold text-gray-900">
                        {customer.orders}
                      </td>
                      <td className="px-4 py-3 align-top text-sm font-semibold text-gray-900">
                        {formatCurrency(customer.totalSpent)}
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-neutral-500">
                        {formatDate(customer.joined)}
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-neutral-500">
                        {formatDate(customer.lastOrderAt)}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => navigate('/admin/orders')}
                            className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-amber-600"
                            aria-label="View customer orders"
                          >
                            <Eye size={16} />
                          </button>

                          {!deactivated && (
                            <button
                              type="button"
                              onClick={() => void handleResetPassword(customer)}
                              disabled={isResetting}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-60"
                            >
                              {isResetting ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <KeyRound size={14} />
                              )}
                              Reset Password
                            </button>
                          )}

                          {deactivated && (
                            <button
                              type="button"
                              onClick={() => void handleReactivate(customer)}
                              disabled={isReactivating}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-60"
                            >
                              {isReactivating ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <RotateCcw size={14} />
                              )}
                              Reactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="border-b border-neutral-100 px-5 py-4">
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                    confirmAction.type === 'reset-password'
                      ? 'bg-amber-50 text-amber-600'
                      : 'bg-emerald-50 text-emerald-600'
                  }`}
                >
                  {confirmAction.type === 'reset-password' ? (
                    <KeyRound size={22} />
                  ) : (
                    <RotateCcw size={22} />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold text-neutral-900">
                    {confirmAction.type === 'reset-password'
                      ? 'Generate temporary password?'
                      : 'Reactivate customer?'}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-500">
                    {confirmAction.type === 'reset-password'
                      ? `${
                          confirmAction.customer.name ||
                          confirmAction.customer.phone ||
                          'This customer'
                        } will be forced to set a new password after login.`
                      : `${
                          confirmAction.customer.name ||
                          confirmAction.customer.phone ||
                          'This customer'
                        } will be able to sign in and use the account again.`}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 px-5 py-4">
              {confirmAction.type === 'reset-password' && (
                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3 text-xs leading-relaxed text-amber-700">
                  The temporary password will be shown only once. Copy it before closing the next dialog.
                </div>
              )}

              <div className="rounded-2xl bg-neutral-50 p-3">
                <p className="text-sm font-bold text-neutral-900">
                  {confirmAction.customer.name || 'Customer'}
                </p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {confirmAction.customer.phone || confirmAction.customer.email || 'No contact shown'}
                </p>
              </div>
            </div>

            <div className="flex gap-2 border-t border-neutral-100 bg-neutral-50 px-5 py-4">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="h-11 flex-1 rounded-2xl border border-neutral-200 bg-white text-sm font-bold text-neutral-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmAction()}
                className={`h-11 flex-1 rounded-2xl text-sm font-bold text-white ${
                  confirmAction.type === 'reset-password'
                    ? 'bg-amber-500 hover:bg-amber-600'
                    : 'bg-emerald-500 hover:bg-emerald-600'
                }`}
              >
                {confirmAction.type === 'reset-password'
                  ? 'Generate Password'
                  : 'Reactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {resetResult && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="border-b border-neutral-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                  <KeyRound size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    Temporary Password Generated
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Share this once with the customer.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3 text-xs leading-relaxed text-amber-700">
                The customer must use this temporary password to log in, then the app will force them to create their own new password.
              </div>

              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Customer
                </p>
                <p className="text-sm font-semibold text-neutral-900">
                  {resetResult.customer.name || resetResult.customer.phone || 'Customer'}
                </p>
                <p className="text-xs text-neutral-500">
                  {resetResult.customer.phone || resetResult.customer.email || 'No contact shown'}
                </p>
              </div>

              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Temporary Password
                </p>
                <div className="flex items-center gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-2">
                  <code className="flex-1 select-all px-2 text-base font-black tracking-wide text-neutral-900">
                    {resetResult.temporaryPassword}
                  </code>
                  <button
                    type="button"
                    onClick={() => void copyTemporaryPassword()}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-neutral-900 px-3 text-xs font-bold text-white"
                  >
                    <Copy size={14} />
                    {resetResult.copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-2 border-t border-neutral-100 bg-neutral-50 px-5 py-4">
              <button
                type="button"
                onClick={() => setResetResult(null)}
                className="h-11 flex-1 rounded-2xl border border-neutral-200 bg-white text-sm font-bold text-neutral-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
