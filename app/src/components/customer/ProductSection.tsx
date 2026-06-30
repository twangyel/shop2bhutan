import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { Product } from '@/types';
import ProductCard from '@/components/shared/ProductCard';

interface ProductSectionProps {
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  products: Product[];
  layout: 'grid' | 'horizontal';
  maxItems?: number;
  seeAllLink?: string;
}

export default function ProductSection({
  title,
  subtitle,
  badge,
  badgeColor = 'bg-red-50 text-red-600',
  products,
  layout,
  maxItems = 4,
  seeAllLink = '/catalog',
}: ProductSectionProps) {
  const navigate = useNavigate();
  const displayProducts = products.slice(0, maxItems);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-[15px] font-bold text-gray-900">{title}</h3>
          {badge && (
            <span className={`px-2 py-0.5 ${badgeColor} text-[10px] font-bold rounded-full`}>
              {badge}
            </span>
          )}
        </div>
        <button
          onClick={() => navigate(seeAllLink)}
          className="flex items-center gap-0.5 text-xs font-semibold text-amber-600 hover:text-amber-700 transition-colors"
        >
          Browse
          <ChevronRight size={14} />
        </button>
      </div>
      {subtitle && <p className="text-[11px] text-neutral-500 -mt-2 mb-2">{subtitle}</p>}

      {layout === 'grid' && (
        <div className="grid grid-cols-2 gap-3">
          {displayProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {layout === 'horizontal' && (
        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-1 -mx-4 px-4">
          {displayProducts.map((product) => (
            <ProductCard key={product.id} product={product} variant="horizontal" />
          ))}
          <div className="flex-shrink-0 w-3" />
        </div>
      )}
    </div>
  );
}
