import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, SlidersHorizontal, ShoppingCart, ArrowLeft, Link2 } from 'lucide-react';
import { categories, products } from '@/data/mockData';
import { useApp } from '@/contexts/AppContext';
import ProductCard from '@/components/shared/ProductCard';

type SortOption = 'popular' | 'price-low' | 'price-high' | 'newest' | 'rating';

export default function Catalog() {
  const navigate = useNavigate();
  const { cartItemCount } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState<SortOption>('popular');
  const [showFilters, setShowFilters] = useState(false);

  const filteredProducts = useMemo(() => {
    let filtered = products;

    if (selectedCategory !== 'All') {
      const cat = categories.find(c => c.name === selectedCategory);
      if (cat) filtered = filtered.filter(p => p.categoryId === cat.id);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
      );
    }

    switch (sortBy) {
      case 'price-low': filtered = [...filtered].sort((a, b) => a.price - b.price); break;
      case 'price-high': filtered = [...filtered].sort((a, b) => b.price - a.price); break;
      case 'newest': filtered = [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); break;
      case 'rating': filtered = [...filtered].sort((a, b) => b.rating - a.rating); break;
      default: break;
    }

    return filtered;
  }, [selectedCategory, searchQuery, sortBy]);

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-neutral-200">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="p-1 -ml-1">
              <ArrowLeft size={22} className="text-neutral-700" />
            </button>
            <h1 className="text-lg font-semibold text-gray-900 flex-1">Shop</h1>
            <button onClick={() => setShowFilters(!showFilters)} className="p-2">
              <SlidersHorizontal size={20} className="text-neutral-600" />
            </button>
            <button onClick={() => navigate('/cart')} className="relative p-2">
              <ShoppingCart size={20} className="text-neutral-600" />
              {cartItemCount > 0 && (
                <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {cartItemCount}
                </span>
              )}
            </button>
          </div>

          <div className="mt-2">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="w-full h-10 pl-10 pr-4 bg-neutral-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                autoFocus
              />
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 mt-3 scrollbar-hide">
            <button
              onClick={() => setSelectedCategory('All')}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === 'All' ? 'bg-amber-500 text-white' : 'bg-neutral-100 text-neutral-700'
              }`}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.name)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === cat.name ? 'bg-amber-500 text-white' : 'bg-neutral-100 text-neutral-700'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="px-4 py-3 bg-white border-b border-neutral-200">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Sort By</p>
          <div className="flex flex-wrap gap-2">
            {([
              { value: 'popular', label: 'Popular' },
              { value: 'price-low', label: 'Price: Low to High' },
              { value: 'price-high', label: 'Price: High to Low' },
              { value: 'newest', label: 'Newest' },
              { value: 'rating', label: 'Best Rated' },
            ] as { value: SortOption; label: string }[]).map(option => (
              <button
                key={option.value}
                onClick={() => setSortBy(option.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  sortBy === option.value ? 'bg-amber-500 text-white' : 'bg-neutral-100 text-neutral-600'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Paste Link CTA */}
      <div className="px-4 pt-4">
        <button
          onClick={() => navigate('/paste-link')}
          className="w-full flex items-center gap-3 p-4 bg-gradient-to-r from-amber-500 to-amber-600 rounded-2xl text-white shadow-md active:scale-[0.98] transition-transform"
        >
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Link2 size={20} />
          </div>
          <div className="text-left flex-1">
            <p className="font-semibold text-sm">Have a product link?</p>
            <p className="text-xs text-white/80">Paste any Amazon, Flipkart, Myntra or Meesho link</p>
          </div>
          <span className="text-xs font-medium bg-white/20 px-3 py-1 rounded-full">Paste</span>
        </button>
      </div>

      {/* Product Grid */}
      <div className="px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
          {filteredProducts.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-neutral-500">No products found</p>
          </div>
        )}
      </div>
    </div>
  );
}
