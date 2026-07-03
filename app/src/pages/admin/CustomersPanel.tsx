import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Eye, Loader2, RefreshCw, Search } from 'lucide-react';
import { fetchAdminCustomers, type AdminCustomerRecord } from '@/lib/customerOrders';

function formatCurrency(value: number) {
  return `Nu. ${Number(value || 0).toLocaleString()}`;
}

function formatDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString();
}

export default function CustomersPanel() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<AdminCustomerRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
    loadCustomers();
  }, [loadCustomers]);

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return customers.filter((customer) => {
      const searchable = [
        customer.name,
        customer.email,
        customer.phone,
        customer.dzongkhag,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return !query || searchable.includes(query);
    });
  }, [customers, searchQuery]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Customers</h2>
          <p className="text-sm text-neutral-500">
            {customers.length} real registered {customers.length === 1 ? 'customer' : 'customers'} from Supabase.
          </p>
        </div>
        <button
          type="button"
          onClick={loadCustomers}
          disabled={loading}
          className="h-10 px-3 rounded-lg border border-neutral-200 bg-white text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60 flex items-center gap-2"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-card">
        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search customers..."
            className="w-full h-9 pl-9 pr-4 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
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
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Dzongkhag</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Orders</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Verified Spend</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Joined</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Last Order</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-neutral-500">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 size={18} className="animate-spin text-amber-500" />
                      Loading customers...
                    </div>
                  </td>
                </tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <p className="text-sm font-medium text-neutral-600">No customers found</p>
                    <p className="mt-1 text-xs text-neutral-400">Registered customer profiles will appear here.</p>
                  </td>
                </tr>
              )}

              {!loading &&
                filtered.map((customer) => (
                  <tr key={customer.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-semibold text-sm">
                          {(customer.name || customer.email || 'C').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{customer.name || 'Customer'}</p>
                          <p className="text-xs text-neutral-400 truncate max-w-[220px]">{customer.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600">
                      <div>{customer.phone || '-'}</div>
                      <div className="text-xs text-neutral-400">{customer.email || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600">{customer.dzongkhag || '-'}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">{customer.orders}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">{formatCurrency(customer.totalSpent)}</td>
                    <td className="px-4 py-3 text-sm text-neutral-500">{formatDate(customer.joined)}</td>
                    <td className="px-4 py-3 text-sm text-neutral-500">{formatDate(customer.lastOrderAt)}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => navigate('/admin/orders')}
                        className="p-1.5 text-neutral-400 hover:text-amber-600 transition-colors"
                        aria-label="View customer orders"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
