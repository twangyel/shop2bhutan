import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  XCircle,
} from 'lucide-react';
import {
  fetchAdminCustomers,
  reactivateCustomerAccount,
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
        customer.accountType === 'email' ? 'email account' : 'phone-only',
        deactivated ? 'deactivated inactive disabled' : 'active enabled',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return !query || searchable.includes(query);
    });
  }, [customers, searchQuery, statusFilter]);

  async function handleReactivate(customer: AdminCustomerRecord) {
    const ok = window.confirm(
      `Reactivate ${customer.name || customer.phone || 'this customer'}? They will be able to sign in and use their account again.`,
    );

    if (!ok) return;

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
          <table className="w-full min-w-[1080px]">
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
                  const isBusy = reactivatingId === customer.id;

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
                        <div className="space-y-1">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${statusBadgeClass(
                              customer,
                            )}`}
                          >
                            {deactivated ? <XCircle size={13} /> : <CheckCircle2 size={13} />}
                            {deactivated ? 'Deactivated' : 'Active'}
                          </span>

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

                          {deactivated && (
                            <button
                              type="button"
                              onClick={() => void handleReactivate(customer)}
                              disabled={isBusy}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-60"
                            >
                              {isBusy ? (
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
    </div>
  );
}
