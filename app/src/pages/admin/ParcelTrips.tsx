import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { parcelTrips } from '@/data/parcelData';
import type { ParcelTrip } from '@/types/parcel';

export default function ParcelTrips() {
  const [trips, setTrips] = useState<ParcelTrip[]>(parcelTrips);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', goingDate: '', returnDate: '',
    fromLocation: 'Customer pickup address', toLocation: 'Phuntsholing, Bhutan',
    description: '',
  });

  const toggleActive = (id: string) => {
    setTrips((prev) => prev.map((t) => t.id === id ? { ...t, isActive: !t.isActive } : t));
  };

  const addTrip = () => {
    if (!form.name || !form.goingDate || !form.returnDate) return;
    setTrips((prev) => [...prev, {
      id: `trip-${Date.now()}`,
      name: form.name, goingDate: form.goingDate, returnDate: form.returnDate,
      fromLocation: form.fromLocation, toLocation: form.toLocation,
      description: form.description, isActive: true,
      createdAt: new Date().toISOString(),
    }]);
    setForm({ name: '', goingDate: '', returnDate: '', fromLocation: 'Customer pickup address', toLocation: 'Phuntsholing, Bhutan', description: '' });
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Parcel Trips</h2>
          <p className="text-sm text-neutral-500">Create and manage available Phuntsholing parcel trips</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-2">
          <Plus size={16} />
          Add Trip
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl p-5 shadow-card space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-neutral-500 uppercase">Trip Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Phuntsholing Run - July 2026" className="w-full h-9 mt-1 px-3 border border-neutral-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-500 uppercase">From</label>
              <input value={form.fromLocation} onChange={(e) => setForm({ ...form, fromLocation: e.target.value })} className="w-full h-9 mt-1 px-3 border border-neutral-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-500 uppercase">To</label>
              <input value={form.toLocation} onChange={(e) => setForm({ ...form, toLocation: e.target.value })} className="w-full h-9 mt-1 px-3 border border-neutral-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-500 uppercase">Going Date</label>
              <input type="date" value={form.goingDate} onChange={(e) => setForm({ ...form, goingDate: e.target.value })} className="w-full h-9 mt-1 px-3 border border-neutral-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-500 uppercase">Return Date</label>
              <input type="date" value={form.returnDate} onChange={(e) => setForm({ ...form, returnDate: e.target.value })} className="w-full h-9 mt-1 px-3 border border-neutral-200 rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-500 uppercase">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Trip details..." className="w-full h-14 mt-1 p-2 border border-neutral-200 rounded-lg text-sm resize-none" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-neutral-100 text-neutral-700 text-sm font-medium rounded-lg">Cancel</button>
            <button onClick={addTrip} className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors">Create Trip</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Trip</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Going</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Return</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Route</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {trips.map((trip) => (
                <tr key={trip.id} className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold">{trip.name}</p>
                    <p className="text-xs text-neutral-500">{trip.description}</p>
                  </td>
                  <td className="px-4 py-3 text-sm">{new Date(trip.goingDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sm">{new Date(trip.returnDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-xs text-neutral-600">{trip.fromLocation} → {trip.toLocation}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActive(trip.id)} className={`px-2 py-0.5 text-xs font-medium rounded-full ${trip.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-neutral-100 text-neutral-500'}`}>
                      {trip.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button className="p-1.5 text-neutral-400 hover:text-amber-600 transition-colors"><Pencil size={14} /></button>
                      <button className="p-1.5 text-neutral-400 hover:text-red-600 transition-colors"><Trash2 size={14} /></button>
                    </div>
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
