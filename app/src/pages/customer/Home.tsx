import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  ChevronDown,
  ClipboardList,
  CreditCard,
  FileText,
  HelpCircle,
  Link2,
  MapPin,
  PackageCheck,
  Search,
  ShieldCheck,
  Sparkles,
  Truck,
  Wallet,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import Logo from '@/components/shared/Logo';
import { getUnreadNotificationCount } from '@/lib/customerOrders';

const howItWorksSteps = [
  { icon: Link2, title: 'Send link', text: 'Paste a product link or upload a screenshot.' },
  { icon: Search, title: 'We verify', text: 'We check price, availability, and details.' },
  { icon: FileText, title: 'Get quote', text: 'Review a clear quotation before paying.' },
  { icon: CreditCard, title: 'Confirm', text: 'Accept and upload payment proof securely.' },
  { icon: Truck, title: 'Track', text: 'Follow your order from your account.' },
];

const quickActions = [
  { icon: Link2, label: 'Paste Link', path: '/paste-link' },
  { icon: ClipboardList, label: 'My Orders', path: '/orders' },
  { icon: Truck, label: 'Track Order', path: '/orders' },
  { icon: HelpCircle, label: 'Support', path: '/support' },
];

const supportedStores = ['Amazon.in', 'Flipkart', 'Myntra', 'Meesho', 'AJIO', 'Nykaa'];

export default function Home() {
  const navigate = useNavigate();
  const { user: authUser, loading: authLoading } = useAuth();
  const { user: appUser } = useApp();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    if (!authUser || authLoading) {
      setUnreadCount(0);
      return;
    }

    try {
      const count = await getUnreadNotificationCount(authUser.id);
      setUnreadCount(count);
    } catch (error) {
      console.warn('[Home] Notification count skipped:', error);
      setUnreadCount(0);
    }
  }, [authLoading, authUser]);

  useEffect(() => {
    void refreshUnreadCount();
  }, [refreshUnreadCount]);

  useEffect(() => {
    const handleNotificationsUpdated = () => {
      void refreshUnreadCount();
    };

    window.addEventListener('shop2bhutan:notifications-updated', handleNotificationsUpdated);
    window.addEventListener('focus', handleNotificationsUpdated);

    return () => {
      window.removeEventListener('shop2bhutan:notifications-updated', handleNotificationsUpdated);
      window.removeEventListener('focus', handleNotificationsUpdated);
    };
  }, [refreshUnreadCount]);

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="sticky top-0 z-40 border-b border-white/70 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Logo size="sm" />
          <button
            type="button"
            onClick={() => navigate('/notifications')}
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 transition-colors hover:bg-neutral-200"
            aria-label="Notifications"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black leading-none text-white ring-2 ring-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>
        <button
          type="button"
          onClick={() => navigate('/account')}
          className="mx-auto flex max-w-3xl items-center gap-1 px-4 pb-3 text-left"
        >
          <MapPin size={14} className="text-amber-500" />
          <span className="text-xs font-medium text-neutral-500">
            Delivery: {appUser?.dzongkhag || 'Thimphu, Paro & Phuntsholing'}
          </span>
          <ChevronDown size={12} className="text-neutral-400" />
        </button>
      </div>

      <main className="mx-auto max-w-3xl px-4 pb-8 pt-4">
        <button
          type="button"
          onClick={() => navigate('/paste-link')}
          className="flex h-12 w-full items-center gap-3 rounded-2xl bg-white px-4 text-left text-sm shadow-sm ring-1 ring-neutral-100 transition-all hover:shadow-md"
        >
          <Search size={18} className="text-neutral-400" />
          <span className="text-neutral-400">Search products or paste a product link...</span>
        </button>

        <section className="relative mt-4 overflow-hidden rounded-[2rem] bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 p-5 text-white shadow-xl shadow-orange-100">
          <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10" />
          <div className="absolute -bottom-16 right-10 h-44 w-44 rounded-full bg-white/10" />
          <div className="relative z-10">
            <div className="mb-4 flex flex-wrap gap-2">
              {['Amazon.in', 'Flipkart', 'Myntra', 'Meesho'].map((store) => (
                <span key={store} className="rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold backdrop-blur-sm">
                  {store}
                </span>
              ))}
            </div>
            <h1 className="max-w-sm text-3xl font-black leading-tight tracking-tight">
              Shop from India, receive in Bhutan.
            </h1>
            <p className="mt-3 max-w-sm text-sm font-medium leading-relaxed text-orange-50">
              Send us the product. We verify it, quote it clearly, and help you track it until delivery.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => navigate('/paste-link')}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-black text-orange-600 shadow-lg shadow-orange-700/10 transition-colors hover:bg-orange-50"
              >
                Request Quotation <ArrowRight size={17} />
              </button>
              <button
                type="button"
                onClick={() => navigate('/orders')}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white/15 px-5 text-sm font-bold text-white ring-1 ring-white/30 backdrop-blur-sm transition-colors hover:bg-white/20"
              >
                Track Orders
              </button>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-[1.75rem] bg-white p-4 shadow-sm ring-1 ring-neutral-100">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-gray-950">Request quotation by link</h2>
              <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                Paste a product URL. Auto-fetch works when the website allows it; otherwise we verify manually.
              </p>
            </div>
            <div className="rounded-2xl bg-amber-50 p-2 text-amber-600">
              <Sparkles size={20} />
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/paste-link')}
            className="flex h-12 w-full items-center justify-between rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-left text-sm text-neutral-400 transition-colors hover:border-amber-200 hover:bg-amber-50/50"
          >
            <span>https://...</span>
            <ArrowRight size={17} className="text-amber-500" />
          </button>
        </section>

        <section className="mt-4 grid grid-cols-4 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                onClick={() => navigate(action.path)}
                className="rounded-2xl bg-white p-3 text-center shadow-sm ring-1 ring-neutral-100 transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                  <Icon size={20} />
                </span>
                <span className="mt-2 block text-[11px] font-bold leading-tight text-neutral-700">{action.label}</span>
              </button>
            );
          })}
        </section>

        <section className="mt-5 rounded-[1.75rem] bg-white p-4 shadow-sm ring-1 ring-neutral-100">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-black text-gray-950">How it works</h2>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">Clear process</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-5">
            {howItWorksSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="rounded-2xl bg-neutral-50 p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-950 text-xs font-black text-white">
                      {index + 1}
                    </span>
                    <Icon size={18} className="text-amber-500" />
                  </div>
                  <p className="text-xs font-black text-gray-950">{step.title}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">{step.text}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-5 rounded-[1.75rem] bg-white p-4 shadow-sm ring-1 ring-neutral-100">
          <h2 className="text-base font-black text-gray-950">Popular source sites</h2>
          <p className="mt-1 text-xs text-neutral-500">We support links and manual verification for common shopping sites.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {supportedStores.map((store) => (
              <span key={store} className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-bold text-neutral-600">
                {store}
              </span>
            ))}
          </div>
        </section>

        <section className="mt-5 grid grid-cols-3 gap-3 rounded-[1.75rem] bg-gray-950 p-4 text-white shadow-lg">
          <div className="text-center">
            <ShieldCheck size={22} className="mx-auto text-emerald-300" />
            <p className="mt-2 text-[11px] font-bold leading-tight text-white/80">Verified quotation</p>
          </div>
          <div className="text-center">
            <Wallet size={22} className="mx-auto text-amber-300" />
            <p className="mt-2 text-[11px] font-bold leading-tight text-white/80">No hidden charges</p>
          </div>
          <div className="text-center">
            <PackageCheck size={22} className="mx-auto text-violet-300" />
            <p className="mt-2 text-[11px] font-bold leading-tight text-white/80">Order tracking</p>
          </div>
        </section>

        <p className="mt-5 text-center text-[11px] leading-relaxed text-neutral-400">
          Orders accepted from all 20 dzongkhags. Delivery currently available in Thimphu, Paro, and Phuntsholing/Chhukha.
        </p>
      </main>
    </div>
  );
}
