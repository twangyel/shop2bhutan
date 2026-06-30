import { useState } from 'react';
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import { categories } from '@/data/mockData';

export default function CategoryCMS() {
  const [categoryList, setCategoryList] = useState(categories);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  const toggleStatus = (id: string) => {
    setCategoryList(prev => prev.map(c => c.id === id ? { ...c, isActive: !c.isActive } : c));
  };

  const handleAdd = () => {
    if (!newCatName.trim()) return;
    setCategoryList(prev => [...prev, {
      id: `cat-${Date.now()}`,
      name: newCatName,
      icon: 'Package',
      image: '',
      sortOrder: prev.length + 1,
      isActive: true,
    }]);
    setNewCatName('');
    setShowAddForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Categories</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-2"
        >
          <Plus size={16} />
          Add Category
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white rounded-xl p-4 shadow-card">
          <div className="flex gap-3">
            <input
              type="text"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="Category name"
              className="flex-1 h-9 px-3 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
            <button
              onClick={handleAdd}
              className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors"
            >
              Add
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 bg-neutral-100 text-neutral-600 text-sm font-medium rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <th className="px-4 py-3 w-8"></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Icon</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Products</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Sort</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {categoryList.map(cat => (
                <tr key={cat.id} className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50 transition-colors">
                  <td className="px-4 py-3">
                    <button className="text-neutral-400 hover:text-neutral-600 cursor-grab">
                      <GripVertical size={16} />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">{cat.name}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600">{cat.icon}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600">{Math.floor(Math.random() * 50) + 10}</td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      defaultValue={cat.sortOrder}
                      className="w-14 h-7 px-1 border border-neutral-200 rounded text-sm text-center"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleStatus(cat.id)}
                      className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        cat.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-neutral-100 text-neutral-500'
                      }`}
                    >
                      {cat.isActive ? 'Active' : 'Inactive'}
                    </button>
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
    </div>
  );
}
