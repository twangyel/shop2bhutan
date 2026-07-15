import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle, Loader2, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import {
  calculateServiceChargeFromRules,
  deleteServiceChargeRule,
  fetchServiceChargeRules,
  saveServiceChargeRules,
} from '@/lib/customerOrders';
import type { ServiceChargeRule } from '@/types';

function cleanNumber(value: string | number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
}

function makeTempRule(): ServiceChargeRule {
  const suffix = Date.now();

  return {
    id: `temp-service-${suffix}`,
    name: '',
    minAmount: 0,
    maxAmount: null,
    percentage: 0,
    flatFee: 0,
    minimumCharge: 0,
    isActive: true,
    requiresManualReview: false,
    sortOrder: suffix,
  };
}

function formatRange(rule: ServiceChargeRule) {
  const min = `Nu. ${rule.minAmount.toLocaleString()}`;
  const max = rule.maxAmount === null ? '∞' : `Nu. ${rule.maxAmount.toLocaleString()}`;
  return `${min} – ${max}`;
}

export default function ServiceChargeSettings() {
  const [rules, setRules] = useState<ServiceChargeRule[]>([]);
  const [previewAmount, setPreviewAmount] = useState(3000);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const loadRules = useCallback(async () => {
    setLoading(true);
    setError('');
    setSaved(false);

    try {
      const realRules = await fetchServiceChargeRules();
      setRules(realRules);
    } catch (err) {
      console.error('Failed to load service charge settings:', err);
      setError(err instanceof Error ? err.message : 'Unable to load service charge settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const preview = useMemo(() => calculateServiceChargeFromRules(previewAmount, rules), [previewAmount, rules]);

  const updateRule = <K extends keyof ServiceChargeRule>(id: string, field: K, value: ServiceChargeRule[K]) => {
    setSaved(false);
    setRules((prev) => prev.map((rule) => (rule.id === id ? { ...rule, [field]: value } : rule)));
  };

  const addRule = () => {
    setSaved(false);
    setRules((prev) => [...prev, makeTempRule()]);
  };

  const removeRule = async (rule: ServiceChargeRule) => {
    const isTemp = rule.id.startsWith('temp-');

    if (isTemp) {
      setRules((prev) => prev.filter((item) => item.id !== rule.id));
      return;
    }

    setDeletingId(rule.id);
    setError('');
    setSaved(false);

    try {
      const updatedRules = await deleteServiceChargeRule(rule);
      setRules(updatedRules);
      setSaved(true);
    } catch (err) {
      console.error('Failed to delete service charge rule:', err);
      setError(err instanceof Error ? err.message : 'Unable to delete service charge rule.');
    } finally {
      setDeletingId('');
    }
  };

  const handleSave = async () => {
    const invalid = rules.find((rule) => !rule.name.trim());
    if (invalid) {
      setError('Tier name is required for every service charge row.');
      return;
    }

    setSaving(true);
    setError('');
    setSaved(false);

    try {
      const updatedRules = await saveServiceChargeRules(rules);
      setRules(updatedRules);
      setSaved(true);
    } catch (err) {
      console.error('Failed to save service charge settings:', err);
      setError(err instanceof Error ? err.message : 'Unable to save service charge settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Service Charges</h2>
          <p className="text-sm text-neutral-500">Loading service charge tiers...</p>
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
          <h2 className="text-xl font-semibold text-gray-900">Service Charges</h2>
          <p className="text-sm text-neutral-500">
            Configure Shop2Bhutan service charge tiers. Formula: max(product total × percentage, minimum charge). Set a tier to Review to make its calculated charge editable during quotation preparation.
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
            Add Tier
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

      {saved && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-start gap-2">
          <CheckCircle size={17} className="mt-0.5 flex-shrink-0" />
          <span>Service charge settings saved.</span>
        </div>
      )}

      <div className="bg-white rounded-xl p-5 shadow-card">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Preview Calculator</h3>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label className="text-xs text-neutral-500">Product Total (Nu.)</label>
            <input
              type="number"
              value={previewAmount}
              onChange={(e) => setPreviewAmount(cleanNumber(e.target.value))}
              className="w-full h-10 mt-1 px-3 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
          <div className="rounded-xl bg-amber-50 px-5 py-3 min-w-[260px]">
            <p className="text-xs font-medium text-amber-700 uppercase">Calculated Service Charge</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">Nu. {preview.amount.toLocaleString()}</p>
            <p className="text-xs text-neutral-500 mt-1">
              {preview.rule ? `${preview.rule.name} • ${formatRange(preview.rule)}` : 'No matching active tier'}
            </p>
            {preview.needsReview && (
              <p className="text-xs text-orange-600 mt-1">Review mode: this calculated amount will be editable during quotation preparation.</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        <div className="px-4 py-4 border-b border-neutral-100">
          <h3 className="text-sm font-semibold text-gray-900">Charge Tiers</h3>
          <p className="text-xs text-neutral-500 mt-1">
            Keep the 1,000–5,000 range profitable because most Shop2Bhutan orders are expected in that range.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Tier Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Min Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Max Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Percentage</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Minimum Charge</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Quotation Mode</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-neutral-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50 transition-colors">
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={rule.name}
                      onChange={(e) => updateRule(rule.id, 'name', e.target.value)}
                      className="w-48 h-9 px-3 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      placeholder="Everyday Orders"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={rule.minAmount}
                      onChange={(e) => updateRule(rule.id, 'minAmount', cleanNumber(e.target.value))}
                      className="w-28 h-9 px-3 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={rule.maxAmount ?? ''}
                      onChange={(e) => updateRule(rule.id, 'maxAmount', e.target.value === '' ? null : cleanNumber(e.target.value))}
                      className="w-28 h-9 px-3 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      placeholder="∞"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={rule.percentage}
                      onChange={(e) => updateRule(rule.id, 'percentage', cleanNumber(e.target.value))}
                      className="w-24 h-9 px-3 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={rule.minimumCharge ?? rule.flatFee ?? 0}
                      onChange={(e) => {
                        const value = cleanNumber(e.target.value);
                        updateRule(rule.id, 'minimumCharge', value);
                        updateRule(rule.id, 'flatFee', value);
                      }}
                      className="w-32 h-9 px-3 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
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
                      onClick={() => updateRule(rule.id, 'requiresManualReview', !rule.requiresManualReview)}
                      title={rule.requiresManualReview ? 'Review: admin can edit the suggested service charge in quotation preparation' : 'Auto: calculated service charge is applied automatically'}
                      aria-label={`Quotation mode: ${rule.requiresManualReview ? 'Review' : 'Auto'}`}
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        rule.requiresManualReview ? 'bg-orange-50 text-orange-600' : 'bg-neutral-100 text-neutral-500'
                      }`}
                    >
                      {rule.requiresManualReview ? 'Review' : 'Auto'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => removeRule(rule)}
                      disabled={deletingId === rule.id}
                      className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-60"
                      aria-label="Delete service charge rule"
                    >
                      {deletingId === rule.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    </button>
                  </td>
                </tr>
              ))}
              {rules.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-neutral-500">
                    No service charge tiers found. Add a tier to begin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl bg-violet-50 border border-violet-100 px-4 py-3 text-sm text-violet-700">
        Auto applies the calculated amount directly. Review uses the calculated amount as a suggestion and lets the admin edit it before sending the quotation. Set every tier to Review when you want every service charge to be editable.
      </div>
    </div>
  );
}
