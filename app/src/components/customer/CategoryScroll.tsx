import { useNavigate } from 'react-router-dom';
import { categories } from '@/data/mockData';

const categoryEmojis = ['📱', '👕', '✨', '🏠', '🏋️', '📚', '🧸', '🍎'];
const categoryColors = [
  'bg-amber-50 text-amber-600',
  'bg-emerald-50 text-emerald-600',
  'bg-violet-50 text-violet-600',
  'bg-blue-50 text-blue-600',
  'bg-orange-50 text-orange-600',
  'bg-yellow-50 text-yellow-600',
  'bg-pink-50 text-pink-500',
  'bg-teal-50 text-teal-600',
];

export default function CategoryScroll() {
  const navigate = useNavigate();

  return (
    <div>
      <h3 className="text-[15px] font-bold text-gray-900 mb-3 px-0.5">Browse Categories</h3>
      <div className="flex gap-2.5 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-1">
        {categories.map((cat, i) => (
          <button
            key={cat.id}
            onClick={() => navigate('/catalog')}
            className="flex-shrink-0 w-[72px] flex flex-col items-center gap-1.5 snap-start select-none"
          >
            <div className={`w-[56px] h-[56px] ${categoryColors[i]} rounded-2xl flex items-center justify-center text-2xl border border-black/5`}>
              {categoryEmojis[i]}
            </div>
            <span className="text-[11px] font-medium text-neutral-700 text-center leading-tight">
              {cat.name}
            </span>
          </button>
        ))}
        {/* Spacer for intentional cut-off */}
        <div className="flex-shrink-0 w-3" />
      </div>
    </div>
  );
}
