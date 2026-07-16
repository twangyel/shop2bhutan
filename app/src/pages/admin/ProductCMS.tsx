import { useState } from 'react';
import { Search, Plus, Pencil, Eye, EyeOff } from 'lucide-react';
import { products, categories } from '@/data/mockData';
import { useAppToast } from '@/components/shared/AppToast';

export default function ProductCMS() {
  const toast = useAppToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [productList, setProductList] = useState(products);

  const filtered = productList.filter(p => {
    const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? p.isActive : !p.isActive);
    return matchesSearch && matchesStatus;
  });

  const toggleStatus = (id: string) => {
    const product = productList.find((item) => item.id === id);
    if (!product) return;

    const nextActive = !product.isActive;
    setProductList((previous) =>
      previous.map((item) =>
        item.id === id ? { ...item, isActive: nextActive } : item,
      ),
    );
    toast.info(
      'Product preview updated',
      `${product.name} is now ${nextActive ? 'active' : 'inactive'} in this local preview. This CMS is not connected to Supabase yet.`,
    );
  };

  const showProductEditorNotice = () => {
    toast.info(
      'Product editor not connected',
      'This Products screen currently uses local demo data. Add and edit actions will be enabled when the catalog backend is connected.',
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Products</h2>
        <button type="button" onClick={showProductEditorNotice} className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-2">
          <Plus size={16} />
          Add Product
        </button>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="w-full h-9 pl-9 pr-4 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
          <div className="flex gap-1">
            {(['all', 'active', 'inactive'] as const).map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize ${
                  statusFilter === status ? 'bg-amber-500 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Image</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Price</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Stock</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Rating</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(product => {
                const category = categories.find(c => c.id === product.categoryId);
                return (
                  <tr key={product.id} className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-3">
                      <img src={product.images[0]} alt="" className="w-10 h-10 rounded-lg object-cover bg-neutral-100" />
                    </td>
                    <td className="px-4 py-3 text-sm font-medium max-w-[200px] truncate">{product.name}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600">{category?.name || '-'}</td>
                    <td className="px-4 py-3 text-sm font-medium">Nu. {product.price.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm">{product.stockQuantity}</td>
                    <td className="px-4 py-3 text-sm">{product.rating} ★</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        product.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-neutral-100 text-neutral-500'
                      }`}>
                        {product.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button type="button" onClick={showProductEditorNotice} className="p-1.5 text-neutral-400 hover:text-amber-600 transition-colors">
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => toggleStatus(product.id)}
                          className="p-1.5 text-neutral-400 hover:text-amber-600 transition-colors"
                        >
                          {product.isActive ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
