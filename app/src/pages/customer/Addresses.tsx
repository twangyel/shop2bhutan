import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Truck, Pencil, Check } from 'lucide-react';
import { addresses, deliveryHubs } from '@/data/mockData';
import { DZONGKHAGS } from '@/data/mockData';

export default function Addresses() {
  const navigate = useNavigate();
  const [showAddForm, setShowAddForm] = useState(false);
  const [addressList, setAddressList] = useState(addresses);

  const handleSetDefault = (id: string) => {
    setAddressList(prev => prev.map(a => ({ ...a, isDefault: a.id === id })));
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="bg-white border-b border-neutral-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-1">
              <ArrowLeft size={22} className="text-neutral-700" />
            </button>
            <h1 className="text-lg font-semibold text-gray-900">Saved Addresses</h1>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3 py-1.5 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors"
          >
            <Plus size={16} className="inline mr-1" />
            Add
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {showAddForm && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Add New Address</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-neutral-500 uppercase">Label</label>
                <select className="w-full h-10 mt-1 px-3 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 bg-white">
                  <option>Home</option>
                  <option>Office</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500 uppercase">Recipient Name</label>
                <input type="text" placeholder="Full name" className="w-full h-10 mt-1 px-3 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20" />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500 uppercase">Phone</label>
                <input type="tel" placeholder="+975 XXXXXXXX" className="w-full h-10 mt-1 px-3 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20" />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500 uppercase">Dzongkhag</label>
                <select className="w-full h-10 mt-1 px-3 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 bg-white">
                  <option value="">Select dzongkhag</option>
                  {DZONGKHAGS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-neutral-500 uppercase">Gewog</label>
                  <input type="text" placeholder="Gewog" className="w-full h-10 mt-1 px-3 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20" />
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-500 uppercase">Village</label>
                  <input type="text" placeholder="Village" className="w-full h-10 mt-1 px-3 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500 uppercase">Landmark (Optional)</label>
                <input type="text" placeholder="Nearby landmark" className="w-full h-10 mt-1 px-3 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20" />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 h-10 bg-neutral-200 text-neutral-700 font-medium rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 h-10 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 transition-colors"
                >
                  Save Address
                </button>
              </div>
            </div>
          </div>
        )}

        {addressList.map(addr => {
          const hub = deliveryHubs.find(h => h.id === addr.deliveryHubId);
          return (
            <div key={addr.id} className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-semibold rounded-full uppercase">
                    {addr.label}
                  </span>
                  {addr.isDefault && (
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-semibold rounded-full">
                      DEFAULT
                    </span>
                  )}
                </div>
                <button className="p-1 text-neutral-400 hover:text-neutral-600">
                  <Pencil size={16} />
                </button>
              </div>
              <p className="text-sm font-semibold text-gray-900 mt-2">{addr.recipientName}</p>
              <p className="text-xs text-neutral-500">{addr.phone}</p>
              <p className="text-xs text-neutral-600 mt-1">
                {addr.village}, {addr.gewog}, {addr.dzongkhag}
              </p>
              {addr.landmark && <p className="text-xs text-neutral-400 mt-0.5">{addr.landmark}</p>}
              <div className="flex items-center gap-1 mt-2">
                <Truck size={12} className="text-emerald-500" />
                <span className="text-xs text-emerald-600 font-medium">{hub?.name}</span>
              </div>
              {!addr.isDefault && (
                <button
                  onClick={() => handleSetDefault(addr.id)}
                  className="mt-2 text-xs text-amber-600 font-medium flex items-center gap-1"
                >
                  <Check size={12} />
                  Set as Default
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
