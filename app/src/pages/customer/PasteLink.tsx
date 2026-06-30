import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link2, Camera, X, Trash2, ExternalLink, ArrowRight, Info } from 'lucide-react';
import { pasteLinkItems } from '@/data/mockData';

const platforms = [
  { name: 'Amazon', color: 'bg-orange-100 text-orange-700 border-orange-300', initial: 'A' },
  { name: 'Flipkart', color: 'bg-blue-100 text-blue-700 border-blue-300', initial: 'F' },
  { name: 'Myntra', color: 'bg-pink-100 text-pink-700 border-pink-300', initial: 'M' },
  { name: 'Meesho', color: 'bg-violet-100 text-violet-700 border-violet-300', initial: 'M' },
];

export default function PasteLink() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [items, setItems] = useState(pasteLinkItems);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  const handleAdd = () => {
    if (!url.trim()) return;
    const platform = url.includes('amazon') ? 'amazon' : url.includes('flipkart') ? 'flipkart' : url.includes('myntra') ? 'myntra' : 'meesho';
    setItems(prev => [...prev, {
      id: `pli-${Date.now()}`,
      sourceUrl: url,
      sourcePlatform: platform as 'amazon' | 'flipkart' | 'myntra' | 'meesho',
      productName: 'Product from ' + platform.charAt(0).toUpperCase() + platform.slice(1),
      price: 0, quantity: 1,
    }]);
    setUrl('');
  };

  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));
  const updateQty = (id: string, delta: number) => setItems(prev => prev.map(i => i.id === id ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i));

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <div className="bg-white px-5 pt-6 pb-5">
        <h1 className="text-2xl font-bold text-gray-900">Order from Any Website</h1>
        <p className="text-sm text-neutral-500 mt-1">Paste a product link from Amazon, Flipkart, Myntra, or Meesho</p>

        {/* Supported Platforms */}
        <div className="flex gap-4 mt-5 justify-center">
          {platforms.map(p => (
            <div key={p.name} className="flex flex-col items-center gap-1">
              <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center font-bold ${p.color}`}>
                {p.initial}
              </div>
              <span className="text-[11px] text-neutral-600">{p.name}</span>
            </div>
          ))}
        </div>

        {/* URL Input */}
        <div className="mt-5 bg-neutral-50 rounded-2xl p-4">
          <div className="relative">
            <Link2 size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste product URL here..."
              className="w-full h-12 pl-10 pr-10 bg-white border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
            {url && (
              <button onClick={() => setUrl('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">
                <X size={18} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 my-3">
            <div className="flex-1 h-px bg-neutral-200" />
            <span className="text-xs text-neutral-400">or</span>
            <div className="flex-1 h-px bg-neutral-200" />
          </div>

          <button className="w-full h-11 flex items-center justify-center gap-2 bg-white border border-neutral-300 rounded-lg text-sm text-neutral-600 hover:bg-neutral-50 transition-colors">
            <Camera size={16} />
            Scan QR Code
          </button>

          <button
            onClick={handleAdd}
            disabled={!url.trim()}
            className="w-full h-12 bg-amber-500 text-white font-semibold rounded-lg mt-3 hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Fetch Product
          </button>
        </div>
      </div>

      {/* Items List */}
      {items.length > 0 && (
        <div className="px-4 mt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-900">Your Order Items</h3>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">{items.length}</span>
          </div>

          <div className="space-y-3">
            {items.map(item => (
              <div key={item.id} className="bg-white rounded-xl p-3 shadow-card">
                <div className="flex gap-3">
                  {item.productImage ? (
                    <img src={item.productImage} alt="" className="w-16 h-16 rounded-lg object-cover bg-neutral-100" />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-neutral-100 flex items-center justify-center">
                      <ExternalLink size={20} className="text-neutral-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 line-clamp-1">{item.productName}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 bg-neutral-100 text-neutral-600 text-[10px] font-medium rounded-full uppercase">
                      {item.sourcePlatform}
                    </span>
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="number"
                        value={item.price || ''}
                        onChange={(e) => {
                          const newPrice = parseInt(e.target.value) || 0;
                          setItems(prev => prev.map(i => i.id === item.id ? { ...i, price: newPrice } : i));
                        }}
                        placeholder="Price in INR"
                        className="w-24 h-8 px-2 border border-neutral-300 rounded text-xs"
                      />
                      <div className="flex items-center gap-1 ml-auto">
                        <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 bg-neutral-100 rounded flex items-center justify-center">
                          <span className="text-xs">−</span>
                        </button>
                        <span className="w-6 text-center text-xs font-semibold">{item.quantity}</span>
                        <button onClick={() => updateQty(item.id, 1)} className="w-7 h-7 bg-neutral-100 rounded flex items-center justify-center">
                          <span className="text-xs">+</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => removeItem(item.id)} className="p-1 text-red-400">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* How It Works */}
      <div className="px-4 mt-5">
        <button
          onClick={() => setShowHowItWorks(!showHowItWorks)}
          className="flex items-center gap-2 text-sm text-neutral-600"
        >
          <Info size={16} />
          <span className="font-medium">How it works</span>
        </button>
        {showHowItWorks && (
          <div className="mt-3 bg-white rounded-xl p-4 space-y-3">
            {[
              'Paste the product link from any supported website',
              'We fetch the product details and verify availability',
              'Our team sends you a quotation with total cost',
              'Approve the quotation and upload your payment',
              'We order from India and deliver to your nearest hub',
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {i + 1}
                </span>
                <p className="text-sm text-neutral-600">{step}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Proceed Button */}
      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 p-4 z-40">
          <button
            onClick={() => navigate('/checkout')}
            className="w-full h-12 bg-amber-500 text-white font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-amber-600 transition-colors"
          >
            Proceed to Checkout
            <ArrowRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
