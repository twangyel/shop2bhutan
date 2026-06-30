import { useNavigate } from 'react-router-dom';
import { Search, Bell, MapPin, ChevronDown, ShoppingBag } from 'lucide-react';
import { products } from '@/data/mockData';
import { useApp } from '@/context/AppContext';

import HeroBanner from '@/components/customer/HeroBanner';
import PasteLinkCard from '@/components/customer/PasteLinkCard';
import QuickActions from '@/components/customer/QuickActions';
import CategoryScroll from '@/components/customer/CategoryScroll';
import ProductSection from '@/components/customer/ProductSection';
import TrustProcess from '@/components/customer/TrustProcess';
import HowItWorks from '@/components/customer/HowItWorks';
import TrustBadges from '@/components/customer/TrustBadges';

export default function Home() {
  const navigate = useNavigate();
  const { unreadCount, user } = useApp();

  const curatedPicks = products
    .filter((p) => p.badge === 'BESTSELLER' || p.rating >= 4.3)
    .slice(0, 4);
  const trendingRequests = products
    .filter((p) => p.badge === 'SALE' || p.badge === 'HOT')
    .slice(0, 6);
  const newArrivals = products.filter((p) => p.badge === 'NEW').slice(0, 6);

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-neutral-100">
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
                <ShoppingBag size={16} className="text-white" />
              </div>
              <span className="text-base font-bold text-gray-900 tracking-tight">
                Shop2<span className="text-amber-500">Bhutan</span>
              </span>
            </div>
            <button
              onClick={() => navigate('/notifications')}
              className="relative p-2 -mr-2 rounded-full hover:bg-neutral-100 transition-colors"
            >
              <Bell size={20} className="text-neutral-600" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
              )}
            </button>
          </div>

          <button
            onClick={() => navigate('/catalog')}
            className="w-full h-10 mt-2.5 bg-neutral-100 rounded-full flex items-center px-4 gap-2.5 hover:bg-neutral-200/70 transition-colors"
          >
            <Search size={16} className="text-neutral-400" />
            <span className="text-sm text-neutral-400 flex-1 text-left">
              Search products or paste a link...
            </span>
          </button>

          <button className="flex items-center gap-1 mt-2 pb-0.5">
            <MapPin size={13} className="text-amber-500" />
            <span className="text-[11px] text-neutral-500 font-medium">Deliver to:</span>
            <span className="text-[11px] text-amber-600 font-bold">
              {user?.dzongkhag || 'Thimphu'}
            </span>
            <ChevronDown size={12} className="text-neutral-400" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 pb-6 space-y-5">
        <HeroBanner />
        <PasteLinkCard />
        <QuickActions />
        <CategoryScroll />

        <ProductSection
          title="Curated Picks"
          subtitle="Handpicked products from India"
          products={curatedPicks}
          layout="grid"
          maxItems={4}
        />

        <TrustProcess />

        <ProductSection
          title="Trending Requests"
          subtitle="Most requested by Bhutan shoppers"
          badge="HOT"
          badgeColor="bg-orange-50 text-orange-600"
          products={trendingRequests}
          layout="horizontal"
          maxItems={6}
        />

        <ProductSection
          title="New Arrivals"
          subtitle="Fresh additions to our catalog"
          badge="NEW"
          badgeColor="bg-emerald-50 text-emerald-600"
          products={newArrivals}
          layout="horizontal"
          maxItems={6}
        />

        <HowItWorks />
        <TrustBadges />
        <div className="h-2" />
      </main>
    </div>
  );
}
