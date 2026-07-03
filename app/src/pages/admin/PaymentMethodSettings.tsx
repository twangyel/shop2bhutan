import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Wallet,
} from 'lucide-react';
import {
  deletePaymentMethod,
  fetchPaymentMethods,
  savePaymentMethods,
} from '@/lib/customerOrders';
import type { PaymentMethod } from '@/types';

function makeTempMethod(): PaymentMethod {
  const suffix = Date.now();

  return {
    id: `temp-payment-${suffix}`,
    name: '',
    type: 'mobile_banking',
    accountNumber: '',
    accountName: 'Shop2Bhutan',
    bankName: '',
    branch: '',
    qrImage: '',
    instructions: '',
    isActive: true,
    sortOrder: suffix,
  };
}

function paymentMethodTypeLabel(type: string) {
  return type === 'bank_transfer' ? 'Bank Transfer' : 'Mobile Banking';
}

export default function PaymentMethodSettings() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const loadMethods = useCallback(async () => {
    setLoading(true);
    setError('');
    setSaved(false);

    try {
      const realMethods = await fetchPaymentMethods({ includeInactive: true });
      setMethods(realMethods);
    } catch (err) {
      console.error('Failed to load payment methods:', err);
      setError(err instanceof Error ? err.message : 'Unable to load payment methods.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMethods();
  }, [loadMethods]);

  const updateMethod = <K extends keyof PaymentMethod>(id: string, field: K, value: PaymentMethod[K]) => {
    setSaved(false);
    setMethods((prev) => prev.map((method) => (method.id === id ? { ...method, [field]: value } : method)));
  };

  const addMethod = () => {
    const method = makeTempMethod();
    setSaved(false);
    setMethods((prev) => [...prev, method]);
    setEditingId(method.id);
  };

  const toggleStatus = (id: string) => {
    setSaved(false);
    setMethods((prev) => prev.map((method) => (method.id === id ? { ...method, isActive: !method.isActive } : method)));
  };

  const removeMethod = async (method: PaymentMethod) => {
    const isTemp = method.id.startsWith('temp-');

    if (isTemp) {
      setMethods((prev) => prev.filter((item) => item.id !== method.id));
      return;
    }

    if (!window.confirm(`Delete ${method.name}? Customers will no longer see this payment method.`)) return;

    setDeletingId(method.id);
    setError('');
    setSaved(false);

    try {
      const updatedMethods = await deletePaymentMethod(method);
      setMethods(updatedMethods);
      setEditingId(null);
      setSaved(true);
    } catch (err) {
      console.error('Failed to delete payment method:', err);
      setError(err instanceof Error ? err.message : 'Unable to delete payment method.');
    } finally {
      setDeletingId('');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);

    try {
      const updatedMethods = await savePaymentMethods(methods);
      setMethods(updatedMethods);
      setEditingId(null);
      setSaved(true);
    } catch (err) {
      console.error('Failed to save payment methods:', err);
      setError(err instanceof Error ? err.message : 'Unable to save payment methods.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Payment Methods</h2>
          <p className="text-sm text-neutral-500">Loading payment methods...</p>
        </div>
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-28 bg-white rounded-xl shadow-card animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Payment Methods</h2>
          <p className="text-sm text-neutral-500">
            Manage the bank and mobile banking options shown to customers on the payment upload page.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadMethods}
            disabled={loading || saving}
            className="h-10 px-3 rounded-lg border border-neutral-200 bg-white text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60 flex items-center gap-2"
          >
            <RefreshCw size={15} />
            Refresh
          </button>
          <button
            type="button"
            onClick={addMethod}
            className="h-10 px-3 rounded-lg border border-neutral-200 bg-white text-sm font-medium text-neutral-700 hover:bg-neutral-50 flex items-center gap-2"
          >
            <Plus size={15} />
            Add Method
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="h-10 px-4 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-60 flex items-center gap-2"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Save Changes
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {saved && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
          <CheckCircle size={16} />
          Payment methods saved successfully.
        </div>
      )}

      {methods.length === 0 ? (
        <div className="rounded-xl bg-white p-8 text-center shadow-card">
          <p className="text-sm text-neutral-500 mb-4">No payment methods yet.</p>
          <button
            type="button"
            onClick={addMethod}
            className="h-10 px-4 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600"
          >
            Add Payment Method
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {methods.map((method, index) => (
            <div key={method.id} className="bg-white rounded-xl p-5 shadow-card">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      method.type === 'bank_transfer' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                    }`}
                  >
                    {method.type === 'bank_transfer' ? <Building2 size={20} /> : <Wallet size={20} />}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">{method.name || 'New payment method'}</h4>
                    <p className="text-xs text-neutral-500">{paymentMethodTypeLabel(method.type)}</p>
                    <p className="text-xs text-neutral-400">
                      Sort #{Number(method.sortOrder) || index + 1} · {method.accountNumber || 'No account/code yet'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleStatus(method.id)}
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      method.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-neutral-100 text-neutral-500'
                    }`}
                  >
                    {method.isActive ? 'Active' : 'Inactive'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(editingId === method.id ? null : method.id)}
                    className="p-1.5 text-neutral-400 hover:text-amber-600 transition-colors"
                    aria-label="Edit payment method"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeMethod(method)}
                    disabled={deletingId === method.id}
                    className="p-1.5 text-neutral-400 hover:text-red-600 transition-colors disabled:opacity-60"
                    aria-label="Delete payment method"
                  >
                    {deletingId === method.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              </div>

              {editingId === method.id && (
                <div className="mt-4 pt-4 border-t border-neutral-200 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-neutral-500">Method Name</label>
                      <input
                        type="text"
                        value={method.name}
                        onChange={(event) => updateMethod(method.id, 'name', event.target.value)}
                        placeholder="e.g. MBoB, BPay, Bank of Bhutan"
                        className="w-full h-9 mt-1 px-2 border border-neutral-200 rounded text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-neutral-500">Type</label>
                      <select
                        value={method.type === 'bank_transfer' ? 'bank_transfer' : 'mobile_banking'}
                        onChange={(event) => updateMethod(method.id, 'type', event.target.value as PaymentMethod['type'])}
                        className="w-full h-9 mt-1 px-2 border border-neutral-200 rounded text-sm bg-white"
                      >
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="mobile_banking">Mobile Banking</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-neutral-500">Account Number / Code</label>
                      <input
                        type="text"
                        value={method.accountNumber}
                        onChange={(event) => updateMethod(method.id, 'accountNumber', event.target.value)}
                        placeholder="Account number, mobile number, or merchant code"
                        className="w-full h-9 mt-1 px-2 border border-neutral-200 rounded text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-neutral-500">Account Name</label>
                      <input
                        type="text"
                        value={method.accountName}
                        onChange={(event) => updateMethod(method.id, 'accountName', event.target.value)}
                        placeholder="Shop2Bhutan"
                        className="w-full h-9 mt-1 px-2 border border-neutral-200 rounded text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-neutral-500">Bank Name</label>
                      <input
                        type="text"
                        value={method.bankName ?? ''}
                        onChange={(event) => updateMethod(method.id, 'bankName', event.target.value)}
                        placeholder="Optional"
                        className="w-full h-9 mt-1 px-2 border border-neutral-200 rounded text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-neutral-500">Branch</label>
                      <input
                        type="text"
                        value={method.branch ?? ''}
                        onChange={(event) => updateMethod(method.id, 'branch', event.target.value)}
                        placeholder="Optional"
                        className="w-full h-9 mt-1 px-2 border border-neutral-200 rounded text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-neutral-500">QR Image URL</label>
                      <input
                        type="text"
                        value={method.qrImage ?? ''}
                        onChange={(event) => updateMethod(method.id, 'qrImage', event.target.value)}
                        placeholder="Optional"
                        className="w-full h-9 mt-1 px-2 border border-neutral-200 rounded text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-neutral-500">Sort Order</label>
                      <input
                        type="number"
                        min="1"
                        value={method.sortOrder}
                        onChange={(event) => updateMethod(method.id, 'sortOrder', Number(event.target.value) || 1)}
                        className="w-full h-9 mt-1 px-2 border border-neutral-200 rounded text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-neutral-500">Instructions</label>
                    <textarea
                      value={method.instructions}
                      onChange={(event) => updateMethod(method.id, 'instructions', event.target.value)}
                      placeholder="Tell customers exactly how to pay and what to show in the screenshot."
                      className="w-full h-20 mt-1 p-2 border border-neutral-200 rounded text-sm resize-none"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="px-4 py-2 bg-neutral-100 text-neutral-700 text-sm font-medium rounded-lg"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving}
                      className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-60"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
