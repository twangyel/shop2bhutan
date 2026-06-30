import { useNavigate } from 'react-router-dom';
import { Star, Plus } from 'lucide-react';
import type { Product } from '@/types';
import { useApp } from '@/context/AppContext';
import { formatEstimatedPrice, formatOriginalPrice, PRICE_DISCLAIMER } from '@/utils/currency';

interface ProductCardProps {
  product: Product;
  variant?: 'grid' | 'horizontal';
}

export default function ProductCard({ product, variant = 'grid' }: ProductCardProps) {
  const navigate = useNavigate();
  const { addToCart } = useApp();

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToCart({
      id: `cart-${product.id}-${Date.now()}`,
      productId: product.id,
      product,
      quantity: 1,
      selectedAttributes: {},
      addedAt: new Date().toISOString(),
    });
  };

  const discount = product.originalPrice
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : 0;

  // Price block shared between variants
  const PriceBlock = () => (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-bold text-amber-600">
          {formatEstimatedPrice(product.price)}
        </span>
        {product.originalPrice && (
          <span className="text-[11px] text-neutral-400 line-through">
            {formatOriginalPrice(product.originalPrice)}
          </span>
        )}
      </div>
      {discount > 0 && (
        <span className="text-[10px] font-semibold text-red-500">{discount}% OFF</span>
      )}
      <p className="text-[9px] text-neutral-400 mt-0.5 italic">{PRICE_DISCLAIMER}</p>
    </div>
  );

  // Horizontal card for scroll rows
  if (variant === 'horizontal') {
    return (
      <button
        onClick={() => navigate(`/product/${product.id}`)}
        className="flex-shrink-0 w-[168px] bg-white rounded-2xl overflow-hidden shadow-card hover:shadow-lg transition-all active:scale-[0.98] text-left"
      >
        <div className="relative w-full aspect-square bg-neutral-100">
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          {product.badge && (
            <span
              className={`absolute top-2 left-2 px-2 py-0.5 text-[10px] font-bold rounded-full text-white ${
                product.badge === 'SALE' ? 'bg-red-500' :
                product.badge === 'NEW' ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            >
              {product.badge}
            </span>
          )}
        </div>

        <div className="p-3">
          <h3 className="text-[12px] font-semibold text-gray-900 leading-snug line-clamp-2 min-h-[2.2em]">
            {product.name}
          </h3>
          <div className="flex items-center gap-1 mt-1">
            <Star size={11} className="text-amber-500 fill-amber-500" />
            <span className="text-[10px] font-medium text-neutral-600">{product.rating}</span>
            <span className="text-[10px] text-neutral-400">({product.reviewCount})</span>
          </div>
          <div className="mt-1.5">
            <PriceBlock />
          </div>
        </div>
      </button>
    );
  }

  // Grid card
  return (
    <button
      onClick={() => navigate(`/product/${product.id}`)}
      className="bg-white rounded-2xl overflow-hidden shadow-card hover:shadow-lg transition-all hover:-translate-y-0.5 active:scale-[0.98] text-left"
    >
      <div className="relative aspect-square bg-neutral-100">
        <img
          src={product.images[0]}
          alt={product.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {product.badge && (
          <span
            className={`absolute top-2 left-2 px-2 py-0.5 text-[10px] font-bold rounded-full text-white ${
              product.badge === 'SALE' ? 'bg-red-500' :
              product.badge === 'NEW' ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
          >
            {product.badge}
          </span>
        )}
        <button
          onClick={handleAddToCart}
          className="absolute bottom-2 right-2 w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center shadow-md hover:bg-amber-600 active:scale-90 transition-all"
        >
          <Plus size={16} className="text-white" />
        </button>
      </div>

      <div className="p-3">
        <h3 className="text-[12px] font-semibold text-gray-900 leading-snug line-clamp-2">
          {product.name}
        </h3>
        <div className="flex items-center gap-1 mt-1">
          <Star size={11} className="text-amber-500 fill-amber-500" />
          <span className="text-[10px] text-neutral-600">{product.rating}</span>
          <span className="text-[10px] text-neutral-400">({product.reviewCount})</span>
        </div>
        <div className="mt-1.5">
          <PriceBlock />
        </div>
      </div>
    </button>
  );
}
