import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import {
  deleteDeliveryFeeRule,
  fetchDeliveryFeeRules,
  saveDeliveryFeeRules,
} from '@/lib/customerOrders';
import { useAppToast } from '@/components/shared/AppToast';
import type { DeliveryFeeRule } from '@/types';

function cleanNumber(value: string | number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
}

function makeTempRule(): DeliveryFeeRule {
  const suffix = Date.now();

  return {
    id: `temp-delivery-${suffix}`,
    destination: '',
    destinationKey: '',
    dzongkhag: '',
    hubId: 'manual',
    baseFee: 0,
    perKgFee: 0,
    estimatedDays: 0,
    isActive: true,
    manualQuote: false,
    sortOrder: suffix,
    notes: '',
  };
}

export default function DeliveryFeeSettings() {
  const toast = useAppToast();
  const [rules, setRules] = useState<DeliveryFeeRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [error, setError] = useState('');

  const loadRules = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const realRules = await fetchDeliveryFeeRules();
      setRules(realRules);
    } catch (err) {
      console.error('Failed to load delivery fee settings:', err);
      setError(err instanceof Error ? err.message : 'Unable to load delivery fee settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const activeRules = useMemo(() => rules.filter((rule) => rule.isActive && !rule.manualQuote), [rules]);
  const manualRules = useMemo(() => rules.filter((rule) => rule.manualQuote || !rule.isActive), [rules]);

  const updateRule = <K extends keyof DeliveryFeeRule>(id: string, field: K, value: DeliveryFeeRule[K]) => {
    setRules((prev) => prev.map((rule) => (rule.id === id ? { ...rule, [field]: value } : rule)));
  };

  const addRule = () => {
    setRules((prev) => [...prev, makeTempRule()]);
  };

  const removeRule = async (rule: DeliveryFeeRule) => {
    const isTemp = rule.id.startsWith('temp-');

    if (isTemp) {
      setRules((prev) => prev.filter((item) => item.id !== rule.id));
      toast.info('Draft removed', 'The unsaved delivery destination was removed.');
      return;
    }

    setDeletingId(rule.id);
    setError('');

    try {
      const updatedRules = await deleteDeliveryFeeRule(rule);
      setRules(updatedRules);
      toast.success(
        'Delivery destination deleted',
        'The delivery fee rule was removed successfully.',
      );
    } catch (err) {
      console.error('Failed to delete delivery fee rule:', err);
      toast.error(
        'Unable to delete delivery destination',
        err instanceof Error ? err.message : 'Please try again.',
      );
    } finally {
      setDeletingId('');
    }
  };

  const handleSave = async () => {
    const invalid = rules.find((rule) => !rule.destination.trim());
    if (invalid) {
      toast.warning(
        'Destination required',
        'Enter a destination name for every delivery fee row before saving.',
      );
      return;
    }

    setSaving(true);
    setError('');

    try {
      const updatedRules = await saveDeliveryFeeRules(rules);
      setRules(updatedRules);
      toast.success(
        'Delivery fees saved',
        'Destination-based delivery rules were updated successfully.',
      );
    } catch (err) {
      console.error('Failed to save delivery fee settings:', err);
      toast.error(
        'Unable to save delivery fees',
        err instanceof Error ? err.message : 'Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Delivery Fees</h2>
          <p className="text-sm text-neutral-500">Loading destination-based delivery settings...</p>
        </div>
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-24 bg-white rounded-xl shadow-card animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Delivery Fees</h2>
          <p className="text-sm text-neutral-500">
            Orders accepted from all 20 dzongkhags. Delivery currently available in Thimphu, Paro, and Phuntsholing/Chhukha.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadRules}
            disabled={loading || saving}
            className="h-10 px-3 rounded-lg border border-neutral-200 bg-white text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60 flex items-center gap-2"
          >
            <RefreshCw size={15} />
            Refresh
          </button>
          <button
            type="button"
            onClick={addRule}
            className="h-10 px-3 rounded-lg border border-neutral-200 bg-white text-sm font-medium text-neutral-700 hover:bg-neutral-50 flex items-center gap-2"
          >
            <Plus size={15} />
            Add Destination
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
          <AlertCircle size={17} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {activeRules.map((rule) => (
          <div key={rule.id} className="bg-white rounded-xl p-4 shadow-card border border-neutral-100">
            <p className="text-xs text-neutral-500 uppercase font-semibold">Active destination</p>
            <p className="text-base font-semibold text-gray-900 mt-1">{rule.destination}</p>
            <p className="text-2xl font-bold text-amber-600 mt-2">Nu. {rule.baseFee.toLocaleString()}</p>
            <p className="text-xs text-neutral-500 mt-1">{rule.estimatedDays || '-'} estimated days</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        <div className="px-4 py-4 border-b border-neutral-100">
          <h3 className="text-sm font-semibold text-gray-900">Destination Fees</h3>
          <p className="text-xs text-neutral-500 mt-1">
            These are destination fees only. Do not use hub tabs here because Thimphu, Paro, and Chhukha are destinations.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px]">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Destination</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Delivery Fee</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Est. Days</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Manual Quote</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Notes</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-neutral-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50 transition-colors">
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={rule.destination}
                      onChange={(e) => updateRule(rule.id, 'destination', e.target.value)}
                      className="w-56 h-9 px-3 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      placeholder="Thimphu"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={rule.baseFee}
                      onChange={(e) => updateRule(rule.id, 'baseFee', cleanNumber(e.target.value))}
                      disabled={rule.manualQuote}
                      className="w-28 h-9 px-3 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 disabled:bg-neutral-100 disabled:text-neutral-400"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={rule.estimatedDays}
                      onChange={(e) => updateRule(rule.id, 'estimatedDays', cleanNumber(e.target.value))}
                      className="w-24 h-9 px-3 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => updateRule(rule.id, 'isActive', !rule.isActive)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        rule.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-neutral-100 text-neutral-500'
                      }`}
                    >
                      {rule.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => updateRule(rule.id, 'manualQuote', !rule.manualQuote)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        rule.manualQuote ? 'bg-violet-50 text-violet-600' : 'bg-neutral-100 text-neutral-500'
                      }`}
                    >
                      {rule.manualQuote ? 'Manual' : 'Auto'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={rule.notes || ''}
                      onChange={(e) => updateRule(rule.id, 'notes', e.target.value)}
                      className="w-72 h-9 px-3 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      placeholder="Optional note"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => removeRule(rule)}
                      disabled={deletingId === rule.id}
                      className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-60"
                      aria-label="Delete delivery fee rule"
                    >
                      {deletingId === rule.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    </button>
                  </td>
                </tr>
              ))}
              {rules.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-neutral-500">
                    No delivery fee rules found. Add a destination to begin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {manualRules.length > 0 && (
        <div className="rounded-xl bg-violet-50 border border-violet-100 px-4 py-3 text-sm text-violet-700">
          Manual or inactive destinations will not auto-add delivery fee in quotation builder. Admin should quote manually only when service is possible.
        </div>
      )}
    </div>
  );
}
