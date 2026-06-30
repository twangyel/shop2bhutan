import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Eye } from 'lucide-react';
import { orders } from '@/data/mockData';

export default function QuotationBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const order = orders.find(o => o.id === id);

  if (!order) return <div className="text-neutral-500">Order not found</div>;

  const [items, setItems] = useState(
    order.items.map(item => ({
      ...item,
      quotedPrice: item.unitPrice,
    }))
  );
  const [serviceCharge, setServiceCharge] = useState(200);
  const [deliveryFee, setDeliveryFee] = useState(150);
  const [taxPercent, setTaxPercent] = useState(5);
  const [notes, setNotes] = useState('');

  const productTotal = items.reduce((sum, item) => sum + item.quotedPrice * item.quantity, 0);
  const taxAmount = Math.round(productTotal * (taxPercent / 100));
  const totalAmount = productTotal + serviceCharge + deliveryFee + taxAmount;

  const updatePrice = (itemId: string, price: number) => {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, quotedPrice: price } : i));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors">
            <ArrowLeft size={20} className="text-neutral-600" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Build Quotation</h1>
            <p className="text-xs text-neutral-500">#{order.orderNumber} — {order.user.name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-neutral-100 text-neutral-700 text-sm font-medium rounded-lg hover:bg-neutral-200 transition-colors flex items-center gap-2">
            <Eye size={16} />
            Preview
          </button>
          <button className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-2">
            <Send size={16} />
            Send Quotation
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Items Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl p-5 shadow-card">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Items</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b border-neutral-200">
                    <th className="pb-2 text-xs font-medium text-neutral-500 uppercase">#</th>
                    <th className="pb-2 text-xs font-medium text-neutral-500 uppercase">Product</th>
                    <th className="pb-2 text-xs font-medium text-neutral-500 uppercase">Qty</th>
                    <th className="pb-2 text-xs font-medium text-neutral-500 uppercase">Cust. Price</th>
                    <th className="pb-2 text-xs font-medium text-neutral-500 uppercase">Your Price</th>
                    <th className="pb-2 text-xs font-medium text-neutral-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={item.id} className="border-b border-neutral-50 last:border-0">
                      <td className="py-3 text-sm text-neutral-500">{i + 1}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <img src={item.productImage} alt="" className="w-10 h-10 rounded-lg object-cover" />
                          <span className="text-sm font-medium truncate max-w-[150px]">{item.productName}</span>
                        </div>
                      </td>
                      <td className="py-3 text-sm">{item.quantity}</td>
                      <td className="py-3 text-sm text-neutral-500 line-through">Nu. {item.unitPrice.toLocaleString()}</td>
                      <td className="py-3">
                        <input
                          type="number"
                          value={item.quotedPrice}
                          onChange={(e) => updatePrice(item.id, parseInt(e.target.value) || 0)}
                          className="w-24 h-8 px-2 border border-neutral-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                        />
                      </td>
                      <td className="py-3 text-sm font-semibold">Nu. {(item.quotedPrice * item.quantity).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Fee Configuration */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-card">
              <h4 className="text-xs font-medium text-neutral-500 uppercase mb-2">Service Charge</h4>
              <input
                type="number"
                value={serviceCharge}
                onChange={(e) => setServiceCharge(parseInt(e.target.value) || 0)}
                className="w-full h-9 px-2 border border-neutral-200 rounded text-sm"
              />
              <p className="text-xs text-neutral-400 mt-1">Auto: Nu. 200</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-card">
              <h4 className="text-xs font-medium text-neutral-500 uppercase mb-2">Delivery Fee</h4>
              <input
                type="number"
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(parseInt(e.target.value) || 0)}
                className="w-full h-9 px-2 border border-neutral-200 rounded text-sm"
              />
              <p className="text-xs text-neutral-400 mt-1">{order.deliveryHub.name}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-card">
              <h4 className="text-xs font-medium text-neutral-500 uppercase mb-2">Tax %</h4>
              <input
                type="number"
                value={taxPercent}
                onChange={(e) => setTaxPercent(parseInt(e.target.value) || 0)}
                className="w-full h-9 px-2 border border-neutral-200 rounded text-sm"
              />
              <p className="text-xs text-neutral-400 mt-1">5% default</p>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl p-5 shadow-card">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Notes to Customer</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes for the customer..."
              className="w-full h-20 p-3 border border-neutral-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
        </div>

        {/* Right: Summary Panel */}
        <div className="bg-white rounded-xl p-5 shadow-card h-fit sticky top-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Quotation Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">Product Total</span>
              <span className="font-medium">Nu. {productTotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">Service Charge</span>
              <span className="font-medium">Nu. {serviceCharge.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">Delivery Fee</span>
              <span className="font-medium">Nu. {deliveryFee.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">Tax ({taxPercent}%)</span>
              <span className="font-medium">Nu. {taxAmount.toLocaleString()}</span>
            </div>
            <hr className="border-neutral-200" />
            <div className="flex justify-between">
              <span className="font-semibold">Total</span>
              <span className="text-xl font-bold text-amber-600">Nu. {totalAmount.toLocaleString()}</span>
            </div>
          </div>

          <div className="mt-4">
            <label className="text-xs font-medium text-neutral-500 uppercase">Valid For</label>
            <select className="w-full h-9 mt-1 px-2 border border-neutral-200 rounded text-sm bg-white">
              <option>24 hours</option>
              <option>48 hours</option>
              <option>72 hours</option>
            </select>
          </div>

          <button className="w-full h-11 mt-4 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition-colors">
            Send Quotation
          </button>
        </div>
      </div>
    </div>
  );
}
