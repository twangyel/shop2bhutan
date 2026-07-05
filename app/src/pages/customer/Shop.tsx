import { useNavigate } from 'react-router-dom'
import { ShoppingBag, ArrowRight, Package } from 'lucide-react'

export default function Shop() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 py-12">
      <div className="flex flex-col items-center text-center max-w-sm">
        {/* Icon */}
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-orange-500 shadow-lg shadow-orange-500/20 mb-6">
          <ShoppingBag size={36} className="text-white" strokeWidth={2} />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-neutral-900">Shop Coming Soon</h1>

        {/* Description */}
        <p className="text-sm text-neutral-500 mt-3 leading-relaxed">
          Curated products and local store items are on the way. For now, request anything from Amazon, Flipkart, Myntra, or Meesho — we will handle the rest.
        </p>

        {/* Primary CTA */}
        <button
          type="button"
          onClick={() => navigate('/paste-link')}
          className="mt-8 h-12 w-full rounded-2xl bg-orange-500 font-bold text-white shadow-sm flex items-center justify-center gap-2 transition hover:bg-orange-600 active:scale-[0.98]"
        >
          Request Product Now
          <ArrowRight size={18} />
        </button>

        {/* Secondary CTA */}
        <button
          type="button"
          onClick={() => navigate('/orders')}
          className="mt-3 h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 font-bold text-neutral-700 flex items-center justify-center gap-2 transition hover:bg-neutral-100 active:scale-[0.98]"
        >
          <Package size={18} />
          Track My Orders
        </button>
      </div>
    </div>
  )
}
