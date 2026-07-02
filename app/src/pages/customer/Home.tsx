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
  Truck,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import Logo from '@/components/shared/Logo';
import { getUnreadNotificationCount } from '@/lib/customerOrders';

const quickActions = [
  { icon: Link2, label: 'Paste Link', path: '/paste-link' },
  { icon: ClipboardList, label: 'My Orders', path: '/orders' },
  { icon: Truck, label: 'Track Order', path: '/orders' },
  { icon: HelpCircle, label: 'Support', path: '/support' },
];

const steps = [
  { icon: Link2, title: 'Submit', text: 'Paste a product link or upload a screenshot.' },
  { icon: FileText, title: 'Quote', text: 'We verify price and send a clear quotation.' },
  { icon: CreditCard, title: 'Pay', text: 'Accept the quote and upload payment proof.' },
  { icon: PackageCheck, title: 'Track', text: 'Follow your order from your account.' },
];

const stores = ['Amazon.in', 'Flipkart', 'Myntra', 'Meesho'];

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
    <div className="min-h-screen bg-neutral-50">
      <header className="sticky top-0 z-40 border-b border-neutral-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Logo size="sm" />
          <button
            type="button"
            onClick={() => navigate('/notifications')}
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-neutral-50 text-neutral-700 ring-1 ring-neutral-200 transition-colors hover:bg-neutral-100"
            aria-label="Notifications"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
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
          <span className="text-xs text-neutral-500">
            Delivery: {appUser?.dzongkhag || 'Thimphu, Paro & Phuntsholing'}
          </span>
          <ChevronDown size={12} className="text-neutral-400" />
        </button>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-8 pt-4">
        <button
          type="button"
          onClick={() => navigate('/paste-link')}
          className="flex h-11 w-full items-center gap-3 rounded-2xl bg-white px-4 text-left text-sm shadow-sm ring-1 ring-neutral-100 transition-all hover:ring-amber-200"
        >
          <Search size={18} className="text-neutral-400" />
          <span className="text-neutral-400">Search products or paste a product link...</span>
        </button>

        <section className="mt-4 overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 p-5 text-white shadow-lg shadow-orange-100">
          <div className="flex flex-wrap gap-2">
            {stores.map((store) => (
              <span key={store} className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                {store}
              </span>
            ))}
          </div>

          <h1 className="mt-4 max-w-sm text-2xl font-bold leading-tight tracking-tight">
            Shop from India, receive in Bhutan
          </h1>
          <p className="mt-2 max-w-sm text-sm leading-6 text-orange-50">
            Send us the product link. We verify price, prepare a clear quotation, and help you track the order.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => navigate('/paste-link')}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-orange-600 shadow-sm transition-colors hover:bg-orange-50"
            >
              Request Quotation <ArrowRight size={16} />
            </button>
            <button
              type="button"
              onClick={() => navigate('/orders')}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white/15 px-5 text-sm font-semibold text-white ring-1 ring-white/25 transition-colors hover:bg-white/20"
            >
              Track Orders
            </button>
          </div>
        </section>

        <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-100">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Request quotation by link</h2>
              <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                Paste a URL. Auto-fetch works when the website allows it; otherwise we verify manually.
              </p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <Link2 size={18} />
            </span>
          </div>
          <button
            type="button"
            onClick={() => navigate('/paste-link')}
            className="mt-3 flex h-11 w-full items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-4 text-left text-sm text-neutral-400 transition-colors hover:border-amber-200 hover:bg-amber-50/60"
          >
            <span>https://...</span>
            <ArrowRight size={16} className="text-amber-500" />
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
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <Icon size={19} />
                </span>
                <span className="mt-2 block text-[11px] font-medium leading-tight text-neutral-700">{action.label}</span>
              </button>
            );
          })}
        </section>

        <section className="mt-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-100">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-gray-900">How it works</h2>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">Clear process</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="rounded-xl bg-neutral-50 p-3 ring-1 ring-neutral-100">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-semibold text-neutral-700 ring-1 ring-neutral-200">
                      {index + 1}
                    </span>
                    <Icon size={18} className="text-amber-500" />
                  </div>
                  <p className="text-xs font-semibold text-gray-900">{step.title}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">{step.text}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-5 grid grid-cols-3 gap-3 rounded-2xl bg-white p-4 text-center shadow-sm ring-1 ring-neutral-100">
          <div>
            <ShieldCheck size={21} className="mx-auto text-emerald-500" />
            <p className="mt-2 text-[11px] font-medium leading-tight text-neutral-600">Verified quote</p>
          </div>
          <div>
            <FileText size={21} className="mx-auto text-amber-500" />
            <p className="mt-2 text-[11px] font-medium leading-tight text-neutral-600">Clear charges</p>
          </div>
          <div>
            <Truck size={21} className="mx-auto text-blue-500" />
            <p className="mt-2 text-[11px] font-medium leading-tight text-neutral-600">Order tracking</p>
          </div>
        </section>

        <p className="mt-5 text-center text-[11px] leading-relaxed text-neutral-400">
          Orders accepted from all 20 dzongkhags. Delivery currently available in Thimphu, Paro, and Phuntsholing/Chhukha.
        </p>
      </main>
    </div>
  );
}
