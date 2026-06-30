import { useState } from 'react';
import { Building2, Wallet, Pencil } from 'lucide-react';
import { paymentMethods } from '@/data/mockData';

export default function PaymentMethodSettings() {
  const [methods, setMethods] = useState(paymentMethods);
  const [editingId, setEditingId] = useState<string | null>(null);

  const toggleStatus = (id: string) => {
    setMethods(prev => prev.map(m => m.id === id ? { ...m, isActive: !m.isActive } : m));
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Payment Methods</h2>
        <p className="text-sm text-neutral-500">Manage payment options for customers</p>
      </div>

      <div className="space-y-4">
        {methods.map(method => (
          <div key={method.id} className="bg-white rounded-xl p-5 shadow-card">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  method.type === 'bank_transfer' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                }`}>
                  {method.type === 'bank_transfer' ? <Building2 size={20} /> : <Wallet size={20} />}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">{method.name}</h4>
                  <p className="text-xs text-neutral-500 capitalize">{method.type.replace('_', ' ')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleStatus(method.id)}
                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                    method.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-neutral-100 text-neutral-500'
                  }`}
                >
                  {method.isActive ? 'Active' : 'Inactive'}
                </button>
                <button
                  onClick={() => setEditingId(editingId === method.id ? null : method.id)}
                  className="p-1.5 text-neutral-400 hover:text-amber-600 transition-colors"
                >
                  <Pencil size={14} />
                </button>
              </div>
            </div>

            {editingId === method.id && (
              <div className="mt-4 pt-4 border-t border-neutral-200 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-neutral-500">Account Number</label>
                    <input
                      type="text"
                      defaultValue={method.accountNumber}
                      className="w-full h-9 mt-1 px-2 border border-neutral-200 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-500">Account Name</label>
                    <input
                      type="text"
                      defaultValue={method.accountName}
                      className="w-full h-9 mt-1 px-2 border border-neutral-200 rounded text-sm"
                    />
                  </div>
                  {method.bankName && (
                    <div>
                      <label className="text-xs text-neutral-500">Bank Name</label>
                      <input
                        type="text"
                        defaultValue={method.bankName}
                        className="w-full h-9 mt-1 px-2 border border-neutral-200 rounded text-sm"
                      />
                    </div>
                  )}
                  {method.branch && (
                    <div>
                      <label className="text-xs text-neutral-500">Branch</label>
                      <input
                        type="text"
                        defaultValue={method.branch}
                        className="w-full h-9 mt-1 px-2 border border-neutral-200 rounded text-sm"
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs text-neutral-500">Instructions</label>
                  <textarea
                    defaultValue={method.instructions}
                    className="w-full h-16 mt-1 p-2 border border-neutral-200 rounded text-sm resize-none"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-4 py-2 bg-neutral-100 text-neutral-700 text-sm font-medium rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
