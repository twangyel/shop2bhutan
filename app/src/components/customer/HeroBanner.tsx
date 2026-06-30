import { ShoppingBag } from 'lucide-react';

export default function HeroBanner() {
  return (
    <div className="mt-4 relative rounded-2xl overflow-hidden bg-gray-900 shadow-md">
      <img
        src="/hero-bhutan.jpg"
        alt="Shop from India, delivered to Bhutan"
        className="w-full aspect-[16/9] object-cover opacity-85"
      />

      {/* Strong gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

      {/* Top-left platform pills */}
      <div className="absolute top-3 left-4 flex gap-1.5">
        {['Amazon.in', 'Flipkart', 'Myntra', 'Meesho'].map((p) => (
          <span
            key={p}
            className="px-2 py-0.5 bg-white/10 backdrop-blur-md border border-white/15 rounded-full text-[9px] font-semibold text-white/80"
          >
            {p}
          </span>
        ))}
      </div>

      {/* Main text — bottom-left, minimal */}
      <div className="absolute bottom-4 left-4 right-16">
        <div className="flex items-center gap-1.5 mb-1.5">
          <ShoppingBag size={12} className="text-amber-400" />
          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">
            Shop2Bhutan
          </span>
        </div>
        <h2 className="text-2xl font-bold text-white leading-[1.15] drop-shadow-lg">
          Shop from India,
          <br />
          <span className="text-amber-400">Delivered to Bhutan</span>
        </h2>
        <p className="text-xs text-white/70 mt-1.5 max-w-[220px] leading-relaxed">
          Any product. Any site. We handle shipping to your nearest hub.
        </p>
      </div>
    </div>
  );
}
