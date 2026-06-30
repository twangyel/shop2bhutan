import { useState } from 'react';
import { Save, Download, Upload } from 'lucide-react';
import { deliveryFeeRules, deliveryHubs } from '@/data/mockData';

export default function DeliveryFeeSettings() {
  const [activeHub, setActiveHub] = useState(deliveryHubs[0].id);
  const [rules, setRules] = useState(deliveryFeeRules);

  const hubRules = rules.filter(r => r.hubId === activeHub);

  const updateRule = (id: string, field: 'baseFee' | 'perKgFee' | 'estimatedDays', value: number) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Delivery Fees</h2>
        <p className="text-sm text-neutral-500">Orders accepted from all 20 dzongkhags. Hubs: Thimphu, Phuntsholing, Paro.</p>
      </div>

      {/* Hub Tabs */}
      <div className="flex gap-1 bg-white rounded-xl p-1 shadow-card w-fit">
        {deliveryHubs.map(h => (
          <button
            key={h.id}
            onClick={() => setActiveHub(h.id)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeHub === h.id ? 'bg-amber-500 text-white' : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            {h.name}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button className="px-3 py-2 bg-white border border-neutral-200 text-neutral-600 text-sm font-medium rounded-lg hover:bg-neutral-50 transition-colors flex items-center gap-2">
          <Download size={14} />
          Export CSV
        </button>
        <button className="px-3 py-2 bg-white border border-neutral-200 text-neutral-600 text-sm font-medium rounded-lg hover:bg-neutral-50 transition-colors flex items-center gap-2">
          <Upload size={14} />
          Import CSV
        </button>
      </div>

      {/* Fee Table */}
      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Dzongkhag</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Base Fee (₹)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Per Kg Fee (₹)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Est. Days</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {hubRules.map(rule => (
                <tr key={rule.id} className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium">{rule.dzongkhag}</td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={rule.baseFee}
                      onChange={(e) => updateRule(rule.id, 'baseFee', parseInt(e.target.value) || 0)}
                      className="w-20 h-8 px-2 border border-neutral-200 rounded text-sm"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={rule.perKgFee}
                      onChange={(e) => updateRule(rule.id, 'perKgFee', parseInt(e.target.value) || 0)}
                      className="w-20 h-8 px-2 border border-neutral-200 rounded text-sm"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={rule.estimatedDays}
                      onChange={(e) => updateRule(rule.id, 'estimatedDays', parseInt(e.target.value) || 0)}
                      className="w-16 h-8 px-2 border border-neutral-200 rounded text-sm"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      rule.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-neutral-100 text-neutral-500'
                    }`}>
                      {rule.isActive ? 'Active' : 'Inactive'}
                    </span>
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
