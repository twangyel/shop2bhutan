import { useNavigate } from 'react-router-dom';
import { Minus, Plus, Trash2, MapPin, ShoppingCart, ArrowRight } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { deliveryHubs } from '@/data/mockData';
import EmptyState from '@/components/shared/EmptyState';

export default function Cart() {
  const navigate = useNavigate();
  const { cart, removeFromCart, updateQuantity } = useApp();
  const hub = deliveryHubs.find(h => h.id === cart.deliveryHubId);

  const subtotal = cart.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const deliveryFee = 150;
  const serviceCharge = Math.round(subtotal * 0.05);
  const tax = Math.round(subtotal * 0.05);

  if (cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col">
        <div className="px-4 py-4 bg-white border-b border-neutral-200">
          <h1 className="text-xl font-bold text-gray-900">Shopping Cart</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={<ShoppingCart size={40} className="text-neutral-300" />}
            title="Your cart is empty"
            description="Browse our catalog to add items"
            action={{ label: 'Start Shopping', onClick: () => navigate('/catalog') }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 pb-48">
      <div className="px-4 py-4 bg-white border-b border-neutral-200">
        <h1 className="text-xl font-bold text-gray-900">Shopping Cart</h1>
        <p className="text-sm text-neutral-500">{cart.items.length} item(s)</p>
      </div>

      <div className="px-4 py-4 space-y-3">
        {cart.items.map(item => (
          <div key={item.id} className="bg-white rounded-xl shadow-sm p-3 flex gap-3">
            <img
              src={item.product.images[0]}
              alt={item.product.name}
              className="w-20 h-20 rounded-lg object-cover bg-neutral-100 flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">{item.product.name}</h3>
              {Object.entries(item.selectedAttributes).length > 0 && (
                <p className="text-xs text-neutral-500 mt-0.5">
                  {Object.entries(item.selectedAttributes).map(([k, v]) => `${k}: ${v}`).join(', ')}
                </p>
              )}
              <p className="text-base font-bold text-amber-600 mt-1">Nu. {(item.product.price * item.quantity).toLocaleString()}</p>

              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="w-7 h-7 bg-neutral-100 rounded flex items-center justify-center hover:bg-neutral-200 transition-colors"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="w-7 h-7 bg-amber-500 rounded flex items-center justify-center hover:bg-amber-600 transition-colors"
                  >
                    <Plus size={14} className="text-white" />
                  </button>
                </div>
                <button
                  onClick={() => removeFromCart(item.id)}
                  className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pickup Hub */}
      <div className="px-4 mt-2">
        <div className="bg-neutral-50 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <MapPin size={18} className="text-amber-500 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Pickup Hub</p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">{hub?.name || 'Thimphu Hub'}</p>
              <p className="text-xs text-neutral-500 mt-0.5">Orders from all 20 dzongkhags. Hubs: Thimphu, Phuntsholing, Paro.</p>
            </div>
            <button className="text-xs text-amber-600 font-medium">Change</button>
          </div>
        </div>
      </div>

      {/* Order Summary - Sticky */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 p-4 z-40">
        <div className="bg-white border border-neutral-200 rounded-xl p-4 mb-3">
          <h3 className="text-base font-semibold text-gray-900 mb-3">Order Summary</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">Subtotal</span>
              <span className="font-medium">Nu. {subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">Delivery Fee</span>
              <span className="font-medium">Nu. {deliveryFee}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">Service Charge</span>
              <span className="font-medium">Nu. {serviceCharge}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">Tax</span>
              <span className="font-medium">Nu. {tax}</span>
            </div>
          </div>
          <hr className="my-3 border-neutral-200" />
          <div className="flex justify-between">
            <span className="text-base font-semibold text-gray-900">Total</span>
            <span className="text-lg font-bold text-amber-600">Nu. {(subtotal + deliveryFee + serviceCharge + tax).toLocaleString()}</span>
          </div>
          <p className="text-xs text-orange-600 mt-2 bg-orange-50 px-2 py-1 rounded-lg">
            📝 Estimated only. Final price confirmed after quotation.
          </p>
        </div>

        <button
          onClick={() => navigate('/checkout')}
          className="w-full h-12 bg-amber-500 text-white font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-amber-600 transition-colors"
        >
          Proceed to Checkout
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
