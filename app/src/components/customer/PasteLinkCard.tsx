import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link2, ArrowRight, Globe } from 'lucide-react';

const platforms = ['Amazon.in', 'Flipkart', 'Myntra', 'Meesho'];

export default function PasteLinkCard() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');

  const handleSubmit = () => {
    if (url.trim()) navigate('/paste-link');
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white border border-amber-100 shadow-md">
      {/* Subtle warm top accent */}
      <div className="h-1 bg-amber-500" />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <Link2 size={20} className="text-amber-600" />
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-gray-900 leading-snug">
              Paste product link
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              From Amazon, Flipkart, Myntra, or Meesho
            </p>
          </div>
        </div>

        {/* Input + Button */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Globe
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full h-11 pl-9 pr-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-300 transition-all"
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={!url.trim()}
            className="h-11 px-4 bg-amber-500 text-white text-sm font-bold rounded-xl hover:bg-amber-600 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 flex-shrink-0"
          >
            <span className="hidden sm:inline">Get Quotation</span>
            <span className="sm:hidden">Quote</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {/* Platform tags */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {platforms.map((p) => (
            <button
              key={p}
              onClick={() => setUrl(`https://${p.toLowerCase().replace('.in', '')}.in/`)
              }
              className="px-2.5 py-1 bg-neutral-50 hover:bg-amber-50 border border-neutral-100 hover:border-amber-200 rounded-lg text-[11px] font-medium text-neutral-600 hover:text-amber-700 transition-colors"
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
