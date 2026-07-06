import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Check, Package, Truck } from 'lucide-react';
import { addresses, deliveryHubs } from '@/data/mockData';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { SELF_PICKUP_HUBS, getPickupHubById } from '@/lib/fulfillment';
import type { FulfillmentMode } from '@/types';

export default function Checkout() {
  const navigate = useNavigate();
  const { cart } = useApp();
  const { user, isGuest } = useAuth();
  const [selectedAddress, setSelectedAddress] = useState(addresses[0].id);
  const [fulfillmentMode, setFulfillmentMode] = useState<FulfillmentMode>('delivery');
  const [pickupHubId, setPickupHubId] = useState(SELF_PICKUP_HUBS[0].id);
  const [step] = useState(1);
  const [error, setError] = useState('');

  const subtotal = cart.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const selectedPickupHub = getPickupHubById(pickupHubId);
  const isSelfPickup = fulfillmentMode === 'self_pickup';

  const handlePlaceOrder = () => {
    setError('');

    if (!user) {
      navigate('/login', { state: { from: '/checkout' } });
      return;
    }

    if (isGuest) {
      setError('Please sign in or register to place shopping orders. Guest mode is only for Parcel booking.');
      return;
    }

    navigate('/orders');
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1">
            <ArrowLeft size={22} className="text-neutral-700" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Checkout</h1>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center gap-2 mt-4 px-2">
          {[
            { num: 1, label: 'Cart', done: true },
            { num: 2, label: 'Fulfillment', done: step >= 2 },
            { num: 3, label: 'Payment', done: false },
          ].map((s, i) => (
            <div key={s.num} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                s.done ? 'bg-emerald-500 text-white' : i === 1 ? 'bg-amber-500 text-white' : 'bg-neutral-200 text-neutral-500'
              }`}>
                {s.done ? <Check size={14} /> : s.num}
              </div>
              <span className={`text-xs ${s.done ? 'text-emerald-600 font-medium' : i === 1 ? 'text-amber-600 font-medium' : 'text-neutral-400'}`}>
                {s.label}
              </span>
              {i < 2 && <div className={`flex-1 h-0.5 ${s.done ? 'bg-emerald-500' : 'bg-neutral-200'}`} />}
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {error && (
          <div className="rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-700">
            {error}
          </div>
        )}

        {/* Fulfillment Method */}
        <div className="rounded-xl bg-white p-4">
          <h3 className="text-base font-semibold text-gray-900 mb-3">Fulfillment Method</h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setFulfillmentMode('delivery')}
              className={`rounded-2xl border p-3 text-left transition ${fulfillmentMode === 'delivery' ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-neutral-200 bg-white text-neutral-600'}`}
            >
              <Truck size={18} />
              <p className="mt-2 text-sm font-bold">Deliver to me</p>
              <p className="text-xs opacity-75">Use saved address</p>
            </button>
            <button
              type="button"
              onClick={() => setFulfillmentMode('self_pickup')}
              className={`rounded-2xl border p-3 text-left transition ${fulfillmentMode === 'self_pickup' ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-neutral-200 bg-white text-neutral-600'}`}
            >
              <Package size={18} />
              <p className="mt-2 text-sm font-bold">I will pick up</p>
              <p className="text-xs opacity-75">Collect from S2B hub</p>
            </button>
          </div>

          {isSelfPickup && (
            <div className="mt-3 space-y-2">
              {SELF_PICKUP_HUBS.map((hub) => (
                <button
                  key={hub.id}
                  type="button"
                  onClick={() => setPickupHubId(hub.id)}
                  className={`w-full rounded-2xl border p-3 text-left transition ${pickupHubId === hub.id ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-neutral-200 bg-white text-neutral-600'}`}
                >
                  <p className="text-sm font-bold">{hub.name}</p>
                  <p className="text-xs text-neutral-500">{hub.pickupInstructions}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Delivery Address */}
        {!isSelfPickup && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-900">Deliver To</h3>
            <button className="text-xs text-amber-600 font-medium">+ Add New</button>
          </div>
          <div className="space-y-2">
            {addresses.map(addr => {
              const hub = deliveryHubs.find(h => h.id === addr.deliveryHubId);
              return (
                <button
                  key={addr.id}
                  onClick={() => setSelectedAddress(addr.id)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-colors ${
                    selectedAddress === addr.id ? 'border-amber-500 bg-amber-50/50' : 'border-neutral-200 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      selectedAddress === addr.id ? 'border-amber-500' : 'border-neutral-300'
                    }`}>
                      {selectedAddress === addr.id && <div className="w-2.5 h-2.5 bg-amber-500 rounded-full" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-semibold rounded-full uppercase">
                          {addr.label}
                        </span>
                        {addr.isDefault && (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-semibold rounded-full">
                            DEFAULT
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-gray-900 mt-1">{addr.recipientName}</p>
                      <p className="text-xs text-neutral-500">{addr.phone}</p>
                      <p className="text-xs text-neutral-600 mt-1">{addr.village}, {addr.gewog}, {addr.dzongkhag}</p>
                      <p className="text-xs text-neutral-400 mt-0.5">{addr.landmark}</p>
                      <div className="flex items-center gap-1 mt-2">
                        <MapPin size={12} className="text-emerald-500" />
                        <span className="text-xs text-emerald-600 font-medium">{hub?.name}</span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        )}

        {isSelfPickup && (
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-blue-800">
            <p className="text-sm font-bold">Self Pickup — {selectedPickupHub.name}</p>
            <p className="mt-1 text-xs leading-5">{selectedPickupHub.pickupInstructions}</p>
          </div>
        )}

        {/* Order Items */}
        <div className="bg-white rounded-xl p-4">
          <h3 className="text-base font-semibold text-gray-900 mb-3">Order Items ({cart.items.length})</h3>
          <div className="space-y-2">
            {cart.items.map(item => (
              <div key={item.id} className="flex items-center gap-3">
                <img src={item.product.images[0]} alt="" className="w-12 h-12 rounded-lg object-cover bg-neutral-100" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 line-clamp-1">{item.product.name}</p>
                  <p className="text-xs text-neutral-500">Qty: {item.quantity}</p>
                </div>
                <p className="text-sm font-semibold">Nu. {(item.product.price * item.quantity).toLocaleString()}</p>
              </div>
            ))}
          </div>
          <hr className="my-3 border-neutral-200" />
          <div className="flex justify-between">
            <span className="text-sm font-semibold text-gray-900">Total</span>
            <span className="text-base font-bold text-amber-600">Nu. {subtotal.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Place Order Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 p-4 z-40">
        <button
          onClick={handlePlaceOrder}
          className="w-full h-12 bg-amber-500 text-white font-semibold rounded-xl hover:bg-amber-600 transition-colors"
        >
          Place Order — Nu. {subtotal.toLocaleString()}
        </button>
      </div>
    </div>
  );
}
