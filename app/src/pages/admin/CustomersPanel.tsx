import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Copy,
  KeyRound,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  UserX,
  XCircle,
} from 'lucide-react';
import VerificationBadge, { getVerificationBadgeLabel } from '@/components/shared/VerificationBadge';
import { useAppToast } from '@/components/shared/AppToast';
import type { VerificationBadge as VerificationBadgeType } from '@/types';
import {
  deactivateCustomerAccount,
  fetchAdminCustomers,
  reactivateCustomerAccount,
  resetCustomerTemporaryPassword,
  updateCustomerVerificationBadge,
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


function isDeactivated(customer: AdminCustomerRecord) {
  return customer.accountStatus === 'deactivated' || customer.isActive === false;
}

function statusBadgeClass(customer: AdminCustomerRecord) {
  return isDeactivated(customer)
    ? 'bg-rose-50 text-rose-700 border border-rose-100'
    : 'bg-emerald-50 text-emerald-700 border border-emerald-100';
}

export default function CustomersPanel() {
  const toast = useAppToast();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<AdminCustomerRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [, setReactivatingId] = useState('');
  const [, setDeactivatingId] = useState('');
  const [updatingVerificationId, setUpdatingVerificationId] = useState('');
  const [deactivationReason, setDeactivationReason] = useState('');
  const [, setResettingId] = useState('');
  const [resetResult, setResetResult] = useState<{
    customer: AdminCustomerRecord;
    temporaryPassword: string;
    copied: boolean;
  } | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'deactivate' | 'reactivate' | 'reset-password';
    customer: AdminCustomerRecord;
  } | null>(null);
  const [manageCustomer, setManageCustomer] =
    useState<AdminCustomerRecord | null>(null);

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
        getVerificationBadgeLabel(customer.verificationBadge),
        customer.verificationBadge === 'gold' ? 'trusted customer gold badge bhutan flag 🇧🇹' : '',
        customer.verificationBadge === 'blue' ? 'verified contact blue badge' : '',
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
    setConfirmAction({ type: 'reactivate', customer });
  }

  function handleDeactivate(customer: AdminCustomerRecord) {
    if (isDeactivated(customer)) return;

    setError('');
    setDeactivationReason('');
    setConfirmAction({ type: 'deactivate', customer });
  }

  function handleResetPassword(customer: AdminCustomerRecord) {
    if (isDeactivated(customer)) {
      toast.warning(
        'Customer is deactivated',
        'Reactivate this customer before resetting the password.',
      );
      return;
    }

    setError('');
    setConfirmAction({ type: 'reset-password', customer });
  }

  async function handleVerificationBadgeChange(
    customer: AdminCustomerRecord,
    badge: VerificationBadgeType,
  ) {
    try {
      setUpdatingVerificationId(customer.id);
      setError('');
  
      await updateCustomerVerificationBadge(customer.id, badge);
      toast.success(
        badge === 'none' ? 'Verification badge removed' : 'Verification badge updated',
        badge === 'none'
          ? `Verification badge removed for ${customer.name || 'customer'}.`
          : `${getVerificationBadgeLabel(badge)} badge assigned to ${customer.name || 'customer'}.`,
      );
      await loadCustomers();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Unable to update verification badge.';
      toast.error('Verification badge update failed', message);
    } finally {
      setUpdatingVerificationId('');
    }
  }

  async function confirmReactivate(customer: AdminCustomerRecord) {
    try {
      setReactivatingId(customer.id);
      setError('');
  
      await reactivateCustomerAccount(customer.id);
      toast.success('Customer reactivated', `${customer.name || 'Customer'} can sign in again.`);
      await loadCustomers();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to reactivate customer.';
      toast.error('Customer reactivation failed', message);
    } finally {
      setReactivatingId('');
    }
  }

  async function confirmDeactivate(customer: AdminCustomerRecord) {
    try {
      setDeactivatingId(customer.id);
      setError('');
  
      await deactivateCustomerAccount(
        customer.id,
        deactivationReason || 'Deactivated by admin',
      );

      toast.success('Customer deactivated', `${customer.name || 'Customer'} can no longer sign in.`);
      await loadCustomers();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to deactivate customer.';
      toast.error('Customer deactivation failed', message);
    } finally {
      setDeactivatingId('');
      setDeactivationReason('');
    }
  }

  async function confirmResetPassword(customer: AdminCustomerRecord) {
    try {
      setResettingId(customer.id);
      setError('');
        setResetResult(null);

      const result = await resetCustomerTemporaryPassword(customer.id);
      setResetResult({
        customer,
        temporaryPassword: result.temporaryPassword,
        copied: false,
      });
      toast.success(
        'Temporary password generated',
        `Share it securely with ${customer.name || 'the customer'}.`,
      );
      await loadCustomers();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Unable to generate temporary password.';
      toast.error('Temporary password failed', message);
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

    if (action.type === 'deactivate') {
      await confirmDeactivate(action.customer);
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
      toast.success('Temporary password copied', 'It is ready to share securely with the customer.');
    } catch {
      toast.error(
        'Unable to copy automatically',
        'Please select and copy the temporary password manually.',
      );
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

      <div className="overflow-hidden rounded-xl bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px]">
            <thead className="sticky top-0 z-10 bg-neutral-50">
              <tr className="border-b border-neutral-200">
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Customer
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Contact
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Account & Badge
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Orders / Spend
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Activity
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-neutral-500">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 size={18} className="animate-spin text-amber-500" />
                      Loading customers...
                    </div>
                  </td>
                </tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
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
                  const isUpdatingVerification =
                    updatingVerificationId === customer.id;
                  const orderLabel =
                    customer.orders === 1 ? '1 order' : `${customer.orders} orders`;

                  return (
                    <tr
                      key={customer.id}
                      className="border-b border-neutral-100 align-middle transition-colors last:border-0 hover:bg-neutral-50/80"
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                              deactivated
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {(customer.name || customer.phone || 'C')
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <p className="max-w-[210px] truncate text-sm font-semibold text-gray-900">
                                {customer.name || 'Customer'}
                              </p>
                              <VerificationBadge
                                badge={customer.verificationBadge}
                                size="xs"
                              />
                            </div>
                            <p className="mt-0.5 truncate text-xs leading-4 text-neutral-400">
                              {customer.dzongkhag || 'Dzongkhag not set'}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-2.5">
                        <p className="text-sm font-medium text-neutral-700">
                          {customer.phone || 'No phone'}
                        </p>
                        <p className="mt-0.5 max-w-[210px] truncate text-xs leading-4 text-neutral-400">
                          {customer.email || 'No email'}
                        </p>
                      </td>

                      <td className="min-w-[250px] px-4 py-2.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              customer.accountType === 'email'
                                ? 'bg-blue-50 text-blue-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {customer.accountType === 'email'
                              ? 'Email account'
                              : 'Phone-only'}
                          </span>

                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusBadgeClass(
                              customer,
                            )}`}
                          >
                            {deactivated ? (
                              <XCircle size={11} />
                            ) : (
                              <CheckCircle2 size={11} />
                            )}
                            {deactivated ? 'Deactivated' : 'Active'}
                          </span>

                          {customer.mustChangePassword && !deactivated && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                              <ShieldAlert size={11} />
                              Password change required
                            </span>
                          )}
                        </div>

                        <div className="mt-1.5 flex items-center gap-2">
                          {customer.verificationBadge &&
                          customer.verificationBadge !== 'none' ? (
                            <VerificationBadge
                              badge={customer.verificationBadge}
                              size="xs"
                              showLabel
                            />
                          ) : (
                            <span className="text-xs font-medium text-neutral-400">
                              No badge
                            </span>
                          )}

                          <select
                            value={customer.verificationBadge || 'none'}
                            disabled={isUpdatingVerification}
                            onChange={(event) =>
                              void handleVerificationBadgeChange(
                                customer,
                                event.target.value as VerificationBadgeType,
                              )
                            }
                            aria-label={`Change verification badge for ${
                              customer.name || 'customer'
                            }`}
                            className="h-7 rounded-lg border border-neutral-200 bg-white px-2 text-[11px] font-semibold text-neutral-600 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-500/10 disabled:opacity-60"
                          >
                            <option value="none">No badge</option>
                            <option value="blue">Verified Contact</option>
                            <option value="gold">
                              Trusted Customer 🇧🇹
                            </option>
                          </select>
                        </div>

                        {deactivated && customer.deactivationReason && (
                          <p
                            className="mt-1 max-w-[240px] truncate text-[11px] leading-4 text-rose-500"
                            title={customer.deactivationReason}
                          >
                            {customer.deactivationReason}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-2.5">
                        <p className="text-sm font-semibold text-gray-900">
                          {orderLabel}
                        </p>
                        <p className="mt-0.5 whitespace-nowrap text-xs font-medium leading-4 text-neutral-500">
                          {formatCurrency(customer.totalSpent)} verified
                        </p>
                      </td>

                      <td className="min-w-[170px] px-4 py-2.5">
                        <p className="text-xs font-medium leading-4 text-neutral-600">
                          Joined {formatDate(customer.joined)}
                        </p>
                        <p className="mt-0.5 text-xs leading-4 text-neutral-400">
                          {customer.lastOrderAt
                            ? `Last order ${formatDate(customer.lastOrderAt)}`
                            : 'No orders yet'}
                        </p>
                        {customer.passwordResetByAdminAt && (
                          <p className="mt-0.5 max-w-[190px] truncate text-[10px] leading-4 text-neutral-400">
                            Password reset {formatDate(customer.passwordResetByAdminAt)}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const params = new URLSearchParams({
                                customer: customer.id,
                                customerName:
                                  customer.name ||
                                  customer.phone ||
                                  customer.email ||
                                  'Customer',
                              });
                              navigate(`/admin/orders?${params.toString()}`);
                            }}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 text-xs font-bold text-neutral-600 transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700"
                          >
                            View
                            <ChevronRight size={14} />
                          </button>

                          <button
                            type="button"
                            onClick={() => setManageCustomer(customer)}
                            className="h-8 rounded-lg bg-neutral-100 px-2.5 text-xs font-bold text-neutral-600 transition hover:bg-neutral-200 hover:text-neutral-800"
                          >
                            Manage
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {manageCustomer && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="border-b border-neutral-100 px-5 py-4">
              <h3 className="text-base font-bold text-neutral-900">
                Manage Customer
              </h3>
              <p className="mt-1 text-sm text-neutral-500">
                {manageCustomer.name ||
                  manageCustomer.phone ||
                  manageCustomer.email ||
                  'Customer'}
              </p>
            </div>

            <div className="space-y-2 px-5 py-4">
              {!isDeactivated(manageCustomer) ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const customer = manageCustomer;
                      setManageCustomer(null);
                      handleResetPassword(customer);
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl border border-neutral-200 px-4 py-3 text-left transition hover:bg-neutral-50"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                      <KeyRound size={18} />
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-neutral-900">
                        Reset Password
                      </span>
                      <span className="block text-xs text-neutral-500">
                        Generate a temporary password.
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const customer = manageCustomer;
                      setManageCustomer(null);
                      handleDeactivate(customer);
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl border border-rose-100 px-4 py-3 text-left transition hover:bg-rose-50"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                      <UserX size={18} />
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-rose-700">
                        Deactivate Customer
                      </span>
                      <span className="block text-xs text-rose-500">
                        Prevent this customer from signing in.
                      </span>
                    </span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const customer = manageCustomer;
                    setManageCustomer(null);
                    handleReactivate(customer);
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl border border-emerald-100 px-4 py-3 text-left transition hover:bg-emerald-50"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <RotateCcw size={18} />
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-emerald-700">
                      Reactivate Customer
                    </span>
                    <span className="block text-xs text-emerald-600">
                      Restore account access.
                    </span>
                  </span>
                </button>
              )}
            </div>

            <div className="border-t border-neutral-100 bg-neutral-50 px-5 py-4">
              <button
                type="button"
                onClick={() => setManageCustomer(null)}
                className="h-11 w-full rounded-2xl border border-neutral-200 bg-white text-sm font-bold text-neutral-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="border-b border-neutral-100 px-5 py-4">
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                    confirmAction.type === 'reset-password'
                      ? 'bg-amber-50 text-amber-600'
                      : confirmAction.type === 'deactivate'
                        ? 'bg-rose-50 text-rose-600'
                        : 'bg-emerald-50 text-emerald-600'
                  }`}
                >
                  {confirmAction.type === 'reset-password' ? (
                    <KeyRound size={22} />
                  ) : confirmAction.type === 'deactivate' ? (
                    <UserX size={22} />
                  ) : (
                    <RotateCcw size={22} />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold text-neutral-900">
                    {confirmAction.type === 'reset-password'
                      ? 'Generate temporary password?'
                      : confirmAction.type === 'deactivate'
                        ? 'Deactivate customer?'
                        : 'Reactivate customer?'}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-500">
                    {confirmAction.type === 'reset-password'
                      ? `${
                          confirmAction.customer.name ||
                          confirmAction.customer.phone ||
                          'This customer'
                        } will be forced to set a new password after login.`
                      : confirmAction.type === 'deactivate'
                        ? `${
                            confirmAction.customer.name ||
                            confirmAction.customer.phone ||
                            'This customer'
                          } will no longer be able to sign in until reactivated.`
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

              {confirmAction.type === 'deactivate' && (
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Reason
                  </label>
                  <textarea
                    value={deactivationReason}
                    onChange={(event) => setDeactivationReason(event.target.value)}
                    rows={3}
                    placeholder="Example: Customer requested account closure"
                    className="w-full resize-none rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-500/10"
                  />
                </div>
              )}

              <div className="rounded-2xl bg-neutral-50 p-3">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold text-neutral-900">
                    {confirmAction.customer.name || 'Customer'}
                  </p>
                  <VerificationBadge badge={confirmAction.customer.verificationBadge} size="xs" />
                </div>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {confirmAction.customer.phone || confirmAction.customer.email || 'No contact shown'}
                </p>
              </div>
            </div>

            <div className="flex gap-2 border-t border-neutral-100 bg-neutral-50 px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  setConfirmAction(null);
                  setDeactivationReason('');
                }}
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
                    : confirmAction.type === 'deactivate'
                      ? 'bg-rose-500 hover:bg-rose-600'
                      : 'bg-emerald-500 hover:bg-emerald-600'
                }`}
              >
                {confirmAction.type === 'reset-password'
                  ? 'Generate Password'
                  : confirmAction.type === 'deactivate'
                    ? 'Deactivate'
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
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold text-neutral-900">
                    {resetResult.customer.name || resetResult.customer.phone || 'Customer'}
                  </p>
                  <VerificationBadge badge={resetResult.customer.verificationBadge} size="xs" />
                </div>
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
