import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Share2, Heart, Star, Truck, ShoppingCart, Zap, Minus, Plus } from 'lucide-react';
import { products, reviews } from '@/data/mockData';
import { useApp } from '@/context/AppContext';

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart } = useApp();
  const product = products.find(p => p.id === id);
  const [quantity, setQuantity] = useState(1);
  const [liked, setLiked] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-neutral-500">Product not found</p>
      </div>
    );
  }

  const productReviews = reviews.filter(r => r.productId === id);
  const discount = product.originalPrice ? Math.round((1 - product.price / product.originalPrice) * 100) : 0;

  const handleAddToCart = () => {
    addToCart({
      id: `cart-${product.id}-${Date.now()}`,
      productId: product.id,
      product,
      quantity,
      selectedAttributes: {},
      addedAt: new Date().toISOString(),
    });
    navigate('/cart');
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Image Gallery */}
      <div className="relative aspect-[4/3] bg-neutral-100">
        <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-md"
        >
          <ArrowLeft size={20} className="text-neutral-700" />
        </button>
        <button className="absolute top-4 right-4 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-md">
          <Share2 size={18} className="text-neutral-700" />
        </button>
        <button
          onClick={() => setLiked(!liked)}
          className="absolute top-4 right-16 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-md"
        >
          <Heart size={18} className={liked ? 'text-red-500 fill-red-500' : 'text-neutral-700'} />
        </button>
      </div>

      {/* Content */}
      <div className="px-5 pt-4">
        {/* Badge */}
        {product.badge && (
          <span className={`inline-block px-2.5 py-0.5 text-[11px] font-semibold rounded-full mb-2 ${
            product.badge === 'SALE' ? 'bg-red-50 text-red-600' :
            product.badge === 'NEW' ? 'bg-emerald-50 text-emerald-600' :
            'bg-amber-50 text-amber-600'
          }`}>
            {product.badge}
          </span>
        )}

        <h1 className="text-xl font-bold text-gray-900 leading-tight">{product.name}</h1>

        {/* Rating */}
        <div className="flex items-center gap-2 mt-2">
          <div className="flex items-center gap-1">
            <Star size={16} className="text-amber-500 fill-amber-500" />
            <span className="text-sm font-medium">{product.rating}</span>
          </div>
          <span className="text-sm text-neutral-400">({product.reviewCount} reviews)</span>
        </div>

        {/* Price */}
        <div className="mt-3">
          <div className="flex items-center gap-3">
          <span className="text-2xl font-bold text-amber-600">Nu. {product.price.toLocaleString()}</span>
          {product.originalPrice && (
            <>
              <span className="text-lg text-neutral-400 line-through">Nu. {product.originalPrice.toLocaleString()}</span>
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-xs font-semibold rounded-full">
                Save {discount}%
              </span>
            </>
          )}
          </div>
          <p className="text-[10px] text-neutral-400 mt-1 italic">Final price confirmed after quotation</p>
        </div>

        <hr className="my-4 border-neutral-200" />

        {/* Description */}
        <p className="text-sm text-neutral-600 leading-relaxed">{product.description}</p>

        {/* Delivery Info */}
        <div className="mt-4 bg-neutral-50 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Truck size={20} className="text-emerald-500 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-gray-900">Delivery to your dzongkhag</p>
              <p className="text-xs text-neutral-500 mt-0.5">Orders accepted from all 20 dzongkhags</p>
              <p className="text-xs text-neutral-400 mt-0.5">Pickup/delivery hubs in Thimphu, Phuntsholing, and Paro</p>
            </div>
          </div>
        </div>

        {/* Quantity */}
        <div className="mt-4">
          <label className="text-xs font-medium text-neutral-700 uppercase tracking-wider">Quantity</label>
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-9 h-9 bg-neutral-100 rounded-lg flex items-center justify-center hover:bg-neutral-200 transition-colors"
            >
              <Minus size={16} />
            </button>
            <span className="w-10 text-center font-semibold">{quantity}</span>
            <button
              onClick={() => setQuantity(Math.min(product.stockQuantity, quantity + 1))}
              className="w-9 h-9 bg-amber-500 rounded-lg flex items-center justify-center hover:bg-amber-600 transition-colors"
            >
              <Plus size={16} className="text-white" />
            </button>
            <span className="text-xs text-neutral-400 ml-2">{product.stockQuantity} available</span>
          </div>
        </div>

        {/* Reviews */}
        {productReviews.length > 0 && (
          <div className="mt-6">
            <h3 className="text-base font-semibold text-gray-900 mb-3">Customer Reviews</h3>
            <div className="space-y-3">
              {(showAllReviews ? productReviews : productReviews.slice(0, 2)).map(review => (
                <div key={review.id} className="bg-neutral-50 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-xs font-bold">
                      {review.userName.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{review.userName}</p>
                      <p className="text-[11px] text-neutral-400">{review.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 mb-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={12} className={i < review.rating ? 'text-amber-500 fill-amber-500' : 'text-neutral-300'} />
                    ))}
                  </div>
                  <p className="text-sm text-neutral-600">{review.comment}</p>
                </div>
              ))}
            </div>
            {productReviews.length > 2 && (
              <button
                onClick={() => setShowAllReviews(!showAllReviews)}
                className="text-sm text-amber-600 font-medium mt-2"
              >
                {showAllReviews ? 'Show Less' : `Show All ${productReviews.length} Reviews`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Sticky Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 p-4 z-40">
        <div className="flex gap-3 max-w-lg mx-auto">
          <button
            onClick={handleAddToCart}
            className="flex-1 h-12 bg-amber-500 text-white font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-amber-600 transition-colors"
          >
            <ShoppingCart size={18} />
            Add to Cart
          </button>
          <button
            onClick={handleAddToCart}
            className="flex-1 h-12 bg-emerald-500 text-white font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-600 transition-colors"
          >
            <Zap size={18} />
            Buy Now
          </button>
        </div>
      </div>
    </div>
  );
}
