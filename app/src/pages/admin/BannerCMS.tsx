import { useState } from 'react';
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import { banners } from '@/data/mockData';

const positions = [
  { key: 'home_top', label: 'Home Top' },
  { key: 'home_mid', label: 'Home Middle' },
  { key: 'catalog_top', label: 'Catalog Top' },
];

export default function BannerCMS() {
  const [activePosition, setActivePosition] = useState('home_top');
  const [bannerList, setBannerList] = useState(banners);

  const filtered = bannerList.filter(b => b.position === activePosition);

  const toggleStatus = (id: string) => {
    setBannerList(prev => prev.map(b => b.id === id ? { ...b, isActive: !b.isActive } : b));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Banners</h2>
        <button className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-2">
          <Plus size={16} />
          Add Banner
        </button>
      </div>

      {/* Position Tabs */}
      <div className="flex gap-1 bg-white rounded-xl p-1 shadow-card w-fit">
        {positions.map(pos => (
          <button
            key={pos.key}
            onClick={() => setActivePosition(pos.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activePosition === pos.key ? 'bg-amber-500 text-white' : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            {pos.label}
          </button>
        ))}
      </div>

      {/* Banner List */}
      <div className="space-y-3">
        {filtered.map((banner) => (
          <div key={banner.id} className="bg-white rounded-xl p-4 shadow-card flex items-center gap-4">
            <button className="text-neutral-400 hover:text-neutral-600 cursor-grab">
              <GripVertical size={18} />
            </button>
            <img src={banner.image} alt="" className="w-24 h-14 rounded-lg object-cover bg-neutral-100" />
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-gray-900">{banner.title}</h4>
              <p className="text-xs text-neutral-500 truncate">{banner.subtitle}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-neutral-400">Link: {banner.linkType}</span>
                <span className="text-xs text-neutral-400">{new Date(banner.startDate).toLocaleDateString()} - {new Date(banner.endDate).toLocaleDateString()}</span>
              </div>
            </div>
            <button
              onClick={() => toggleStatus(banner.id)}
              className={`px-2 py-1 text-xs font-medium rounded-full ${
                banner.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-neutral-100 text-neutral-500'
              }`}
            >
              {banner.isActive ? 'Active' : 'Inactive'}
            </button>
            <div className="flex gap-1">
              <button className="p-1.5 text-neutral-400 hover:text-amber-600 transition-colors">
                <Pencil size={14} />
              </button>
              <button className="p-1.5 text-neutral-400 hover:text-red-600 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
