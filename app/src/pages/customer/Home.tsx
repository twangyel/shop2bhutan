import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  ChevronDown,
  ClipboardList,
  CreditCard,
  FileText,
  Headphones,
  Link2,
  MapPin,
  Package,
  PackageCheck,
  ScanLine,
  ShieldCheck,
  Tag,
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
  { icon: Headphones, label: 'Support', path: '/support' },
];

const steps = [
  { icon: Link2, title: 'Send link', text: 'Paste link or upload screenshot' },
  { icon: FileText, title: 'Receive quote', text: 'We verify price clearly' },
  { icon: CreditCard, title: 'Accept & pay', text: 'Upload payment proof' },
  { icon: PackageCheck, title: 'Track delivery', text: 'Follow every update' },
];

const trustItems = [
  { icon: ShieldCheck, title: 'Secure & trusted', text: 'Your data is safe' },
  { icon: Tag, title: 'Best price check', text: 'We verify for you' },
  { icon: Headphones, title: 'Human support', text: 'We are here to help' },
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

  const deliveryLabel = appUser?.dzongkhag || 'Thimphu';

  return (
    <div className="min-h-screen bg-[#fbfaf8]">
      <header className="sticky top-0 z-40 border-b border-orange-100/40 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto max-w-3xl px-4 pb-3 pt-3">
          <div className="flex items-center justify-between">
            <Logo size="sm" />
            <button
              type="button"
              onClick={() => navigate('/notifications')}
              className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white text-neutral-700 shadow-sm ring-1 ring-neutral-200 transition-colors hover:bg-neutral-50"
              aria-label="Notifications"
            >
              <Bell size={18} strokeWidth={1.9} />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={() => navigate('/account')}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-orange-50/70 px-3 py-1.5 text-left text-xs font-medium text-neutral-600 transition-colors hover:bg-orange-100/70"
          >
            <MapPin size={14} className="text-orange-500" />
            <span>Delivering to: {deliveryLabel}</span>
            <ChevronDown size={12} className="text-neutral-400" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-8 pt-4">
        <section className="rounded-[1.65rem] bg-white p-4 shadow-sm ring-1 ring-orange-100/70 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
              <Link2 size={23} />
            </span>
            <div className="min-w-0 pt-0.5">
              <h1 className="text-lg font-bold leading-snug text-gray-950 sm:text-xl">
                Paste a product link or upload a screenshot
              </h1>
              <p className="mt-1 text-sm leading-6 text-neutral-500">
                We verify the price, prepare a quotation, and handle the rest.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/paste-link')}
            className="mt-4 flex h-12 w-full items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-left text-sm text-neutral-400 transition-colors hover:border-orange-200 hover:bg-orange-50/50"
          >
            <Link2 size={18} className="shrink-0 text-neutral-400" />
            <span className="min-w-0 flex-1 truncate">Paste Amazon, Flipkart, Myntra or Meesho link</span>
            <ScanLine size={18} className="shrink-0 text-neutral-400" />
          </button>

          <button
            type="button"
            onClick={() => navigate('/paste-link')}
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-sm font-bold text-white shadow-lg shadow-orange-200/60 transition-transform active:scale-[0.99]"
          >
            Request Quotation
            <ArrowRight size={18} />
          </button>
        </section>

        <section className="relative mt-4 overflow-hidden rounded-[1.5rem] border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-amber-50 p-4 shadow-sm">
          <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-orange-200/25" />
          <div className="absolute -bottom-12 right-8 h-28 w-28 rounded-full bg-amber-200/25" />
          <div className="relative z-10 flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-orange-500 shadow-sm ring-1 ring-orange-100">
              <ShieldCheck size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-gray-950">Shop from India, delivered to Bhutan</h2>
              <p className="mt-1 text-sm leading-6 text-neutral-600">
                Clear quotation, verified product details, and order tracking from your account.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {stores.map((store) => (
                  <span key={store} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-orange-600 ring-1 ring-orange-100">
                    {store}
                  </span>
                ))}
              </div>
            </div>
            <Package className="hidden shrink-0 text-orange-300 sm:block" size={54} strokeWidth={1.35} />
          </div>
        </section>

        <section className="mt-4 rounded-[1.35rem] bg-white p-2 shadow-sm ring-1 ring-neutral-100">
          <div className="grid grid-cols-4 divide-x divide-neutral-100">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => navigate(action.path)}
                  className="flex min-h-[82px] flex-col items-center justify-center gap-2 rounded-2xl px-1.5 py-2 text-center transition-colors hover:bg-orange-50/70"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
                    <Icon size={19} />
                  </span>
                  <span className="text-[11px] font-semibold leading-tight text-neutral-700">{action.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-gray-950">How it works</h2>
            <button type="button" onClick={() => navigate('/support')} className="text-xs font-semibold text-orange-600">
              Learn more
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2 rounded-[1.35rem] bg-white p-3 shadow-sm ring-1 ring-neutral-100">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="text-center">
                  <div className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-orange-50 text-xs font-bold text-orange-700">
                    {index + 1}
                  </div>
                  <span className="mx-auto mt-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
                    <Icon size={18} />
                  </span>
                  <p className="mt-2 text-[11px] font-bold leading-tight text-gray-900">{step.title}</p>
                  <p className="mt-1 hidden text-[10px] leading-4 text-neutral-500 min-[380px]:block">{step.text}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-4 grid grid-cols-3 divide-x divide-neutral-100 rounded-[1.35rem] bg-white p-3 shadow-sm ring-1 ring-neutral-100">
          {trustItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="px-2 text-center">
                <Icon size={20} className="mx-auto text-orange-500" />
                <p className="mt-2 text-[11px] font-bold leading-tight text-neutral-700">{item.title}</p>
                <p className="mt-0.5 hidden text-[10px] leading-4 text-neutral-400 min-[380px]:block">{item.text}</p>
              </div>
            );
          })}
        </section>

        <p className="mt-5 px-2 text-center text-[11px] leading-relaxed text-neutral-400">
          Orders accepted from all 20 dzongkhags. Delivery currently available in Thimphu, Paro, and Phuntsholing/Chhukha.
        </p>
      </main>
    </div>
  );
}
