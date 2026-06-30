import { useState } from 'react';
import { Plus, Pencil, Trash2, Save } from 'lucide-react';
import { serviceChargeRules } from '@/data/mockData';

export default function ServiceChargeSettings() {
  const [rules] = useState(serviceChargeRules);
  const [showAddForm, setShowAddForm] = useState(false);
  const [previewAmount, setPreviewAmount] = useState(3000);

  const calculateCharge = (amount: number) => {
    const rule = rules.find(r => r.isActive && amount >= r.minAmount && (r.maxAmount === null || amount <= r.maxAmount));
    if (!rule) return 0;
    return Math.max(Math.round(amount * (rule.percentage / 100)), rule.flatFee || 0);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Service Charges</h2>
        <p className="text-sm text-neutral-500">Configure service charge tiers</p>
      </div>

      {/* Preview Calculator */}
      <div className="bg-white rounded-xl p-5 shadow-card">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Preview Calculator</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="text-xs text-neutral-500">Order Amount (Nu. )</label>
            <input
              type="number"
              value={previewAmount}
              onChange={(e) => setPreviewAmount(parseInt(e.target.value) || 0)}
              className="w-full h-10 mt-1 px-3 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
          <div className="text-2xl font-bold text-amber-600">
            Nu. {calculateCharge(previewAmount).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Rules Table */}
      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Charge Tiers</h3>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3 py-1.5 bg-amber-500 text-white text-xs font-medium rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-1"
          >
            <Plus size={14} />
            Add Tier
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Tier Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Min Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Max Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Percentage</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Flat Fee</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rules.map(rule => (
                <tr key={rule.id} className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium">{rule.name}</td>
                  <td className="px-4 py-3 text-sm">Nu. {rule.minAmount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm">{rule.maxAmount ? `Nu. ${rule.maxAmount.toLocaleString()}` : '∞'}</td>
                  <td className="px-4 py-3 text-sm">{rule.percentage}%</td>
                  <td className="px-4 py-3 text-sm">{rule.flatFee ? `Nu. ${rule.flatFee}` : '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      rule.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-neutral-100 text-neutral-500'
                    }`}>
                      {rule.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button className="p-1.5 text-neutral-400 hover:text-amber-600 transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button className="p-1.5 text-neutral-400 hover:text-red-600 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end">
        <button className="px-6 py-2 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-2">
          <Save size={16} />
          Save Changes
        </button>
      </div>
    </div>
  );
}
